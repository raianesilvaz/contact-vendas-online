import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, initAuthCreds, jidNormalizedUser, proto } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { createRetryMessageStore, createRetryCounterCache } from './retry-message-store.js';
import { sendRecoverableText, serialSender } from './reliable-text-send.js';
import { openPersonalInbox, privateJid } from './personal-chat-store.js';

const roles = new Set(['admin','vendedora','financeiro']);
const sessionIdFormat = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const historyTypes = proto.Message.HistorySyncNotification.HistorySyncType;
const initialHistory = new Set([historyTypes.INITIAL_BOOTSTRAP, historyTypes.RECENT, historyTypes.PUSH_NAME]);
const timestamp = value => {
  const seconds = Number(value);
  return seconds > 0 && seconds <= 8.64e12 ? seconds * 1000 : 0;
};

function memoryAuth() {
  const keys = new Map();
  let active = true;
  const state = {
    creds: initAuthCreds(),
    keys: {
      async get(type, ids) {
        const values = keys.get(type);
        return Object.fromEntries(ids.flatMap(id => {
          const value = values?.get(id);
          if (!value) return [];
          return [[id, type === 'app-state-sync-key' ? proto.Message.AppStateSyncKeyData.fromObject(value) : value]];
        }));
      },
      async set(data) {
        if (!active) return;
        for (const [type, items] of Object.entries(data)) {
          const values = keys.get(type) || new Map();
          for (const [id, value] of Object.entries(items)) {
            if (value) values.set(id, value);
            else values.delete(id);
          }
          if (values.size) keys.set(type, values);
          else keys.delete(type);
        }
      }
    }
  };
  return { state, clear() { active = false; keys.clear(); } };
}
const stateFor = slot => ({status:slot?.status || 'disconnected', qr:slot?.qr || null, phone:slot?.phone || null, error:slot?.error || null});
const clean = (message, fallbackTime) => {
  const { key, message:content } = message;
  if (!key?.id || !privateJid(key.remoteJid) || !content) return null;
  const body = (content.conversation || content.extendedTextMessage?.text || '').trim().slice(0,4000);
  if (!body) return null;
  return { id:String(key.id), jid:jidNormalizedUser(key.remoteJid), body, direction:key.fromMe?'out':'in',
    at:timestamp(message.messageTimestamp)||fallbackTime,
    name:key.fromMe?'':String(message.pushName||'').trim().slice(0,100) };
};

export function installPersonalAttendance(app, config, { makeSocket = makeWASocket, getVersion = fetchLatestBaileysVersion, idleMs = 10 * 60_000 } = {}) {
  const slots = new Map();
  const fetchApi = config.fetchImpl || fetch;
  const base = '/api/whatsapp/personal';
  let versionRequest;
  const baileysVersion = () => versionRequest ||= getVersion().then(result=>result.version).catch(error=>{versionRequest=null;throw error;});

  async function authorize(request, response, next) {
    response.set('Cache-Control','no-store');
    const token = request.headers.authorization;
    if (!token?.match(/^Bearer [^\s]+$/i)) return response.status(401).json({error:'Entre no CONTACT para continuar.'});
    const headers = {Authorization:token,apikey:config.publishableKey};
    try {
      const identity = await fetchApi(`${config.supabaseUrl}/auth/v1/user`,{headers,signal:AbortSignal.timeout(8000)});
      if ([401,403].includes(identity.status)) return response.status(401).json({error:'Sua sessão expirou.'});
      if (!identity.ok) throw Error('identity');
      const user = await identity.json();
      // Read the session claim only after Supabase has verified the bearer token.
      const claims = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString() || '{}');
      if (!sessionIdFormat.test(user.id) || claims.sub !== user.id || !sessionIdFormat.test(claims.session_id)) {
        return response.status(401).json({error:'Sessão inválida.'});
      }
      const url = new URL(`${config.supabaseUrl}/rest/v1/profiles`);
      url.search = new URLSearchParams({id:`eq.${user.id}`,select:'role,active',limit:'1'});
      const result = await fetchApi(url,{headers,signal:AbortSignal.timeout(8000)});
      if (!result.ok) throw Error('profile');
      const [profile] = await result.json();
      if (!profile?.active || !roles.has(profile.role)) return response.status(403).json({error:'Seu perfil não tem acesso a Atendimentos.'});
      request.attendanceOwner = user.id;
      request.attendanceSession = claims.session_id;
      return next();
    } catch {
      return response.status(503).json({error:'Não foi possível verificar o acesso. Tente novamente.'});
    }
  }

  function disconnect(slot) {
    if (!slot) return;
    if (slot.closing) return slot.closing;
    clearTimeout(slot.timer);
    clearTimeout(slot.pairingTimer);
    clearTimeout(slot.lease);
    const socket = slot.socket;
    slot.socket = null;
    slot.qr = null;
    slot.phone = null;
    slot.error = null;
    slot.status = 'disconnecting';
    slot.inbox.clear();
    slot.auth.clear();
    slot.recovery.clear();
    slot.retryCounters.flushAll();

    slot.closing = (async () => {
      let timeout;
      try {
        if (socket?.user) {
          await Promise.race([
            socket.logout(),
            new Promise(resolve => { timeout = setTimeout(resolve, 2500); timeout.unref(); })
          ]);
        }
      } catch {
        // The device may already have been unlinked in WhatsApp.
      } finally {
        clearTimeout(timeout);
        try { socket?.end(undefined); } catch {}
      }
    })().finally(() => { slots.delete(slot.id); });
    return slot.closing;
  }

  function start(slot) {
    slot.status = 'connecting';
    slot.error = null;
    const current = () => slots.get(slot.id) === slot && !slot.closing;
    baileysVersion().then(version => {
      if (!current()) return;
      const { auth, inbox, recovery, retryCounters } = slot;
      const socket = makeSocket({version,auth:auth.state,logger:config.logger,printQRInTerminal:false,
        browser:['CONTACT Atendimento individual','Chrome','1.0.0'],markOnlineOnConnect:false,
        syncFullHistory:false,shouldSyncHistoryMessage:message=>initialHistory.has(message.syncType),
        generateHighQualityLinkPreview:false,
        getMessage:async key=>recovery.get(key),msgRetryCounterCache:retryCounters,maxMsgRetryCount:5});
      slot.socket = socket;
      const live = () => current() && slot.socket === socket;
      function recordMessages(messages, fallbackTime) {
        for (const message of messages) {
          const { key } = message;
          if (!key?.fromMe && privateJid(key?.remoteJid)) {
            inbox.identify({ id: key.remoteJid, jid: key.senderPn, lid: key.senderLid,
              notify: message.pushName, verifiedName: message.verifiedBizName });
          }
        }
        inbox.save(messages.map(message => clean(message, fallbackTime)).filter(Boolean));
      }
      function recordContacts(contacts) {
        if (live()) for (const contact of contacts) inbox.identify(contact);
      }
      socket.ev.on('contacts.upsert', recordContacts);
      socket.ev.on('contacts.update', recordContacts);
      socket.ev.on('chats.phoneNumberShare', ({ lid, jid }) => {
        if (live()) inbox.identify({ id: lid, jid });
      });
      socket.ev.on('messaging-history.set', ({ chats = [], contacts = [], messages = [] }) => {
        if (!live()) return;
        recordContacts(contacts);
        const recent = chats.filter(chat => privateJid(chat.id));
        for (const chat of recent) {
          inbox.identify({ id: chat.id, jid: chat.pnJid, lid: chat.lidJid, name: chat.name });
        }
        inbox.addChats(recent.map(chat => ({
          jid: jidNormalizedUser(chat.id), name: String(chat.displayName || '').trim().slice(0,100),
          at: timestamp(chat.lastMsgTimestamp || chat.conversationTimestamp)
        })));
        recordMessages(messages, 0);
      });
      socket.ev.on('messages.upsert', ({ type, messages = [] }) => {
        if (live() && ['notify', 'append'].includes(type)) recordMessages(messages, Date.now());
      });
      socket.ev.on('connection.update', async ({connection,qr,lastDisconnect})=>{
        if(!live())return;
        if(qr){
          try {
            const data=await QRCode.toDataURL(qr,{width:300,margin:2});
            if(live()&&slot.status!=='connected'){slot.qr=data;slot.status='qr_ready';}
          } catch {if(live())slot.error='Não foi possível gerar o QR Code.';}
        }
        if(!live())return;
        if(connection==='open'){
          clearTimeout(slot.pairingTimer);
          slot.phone=String(socket.user?.id||'').split('@')[0].split(':')[0]||null;
          slot.qr=null;slot.status='connected';slot.retries=0;
        }
        if(connection==='close'){
          slot.socket=null;slot.qr=null;slot.phone=null;
          clearTimeout(slot.pairingTimer);
          const code=lastDisconnect?.error?.output?.statusCode;
          const registered=auth.state.creds.registered||auth.state.creds.me?.id;
          if(registered&&slot.retries<4&&code!==DisconnectReason.connectionReplaced&&code!==DisconnectReason.loggedOut){
            slot.status='connecting';slot.retries++;
            slot.timer=setTimeout(()=>{if(current())start(slot);},2000*slot.retries);
          }else{
            await disconnect(slot);
          }
        }
      });
      slot.pairingTimer=setTimeout(()=>{
        if(live()&&slot.status!=='connected') void disconnect(slot);
      },120_000);
      slot.pairingTimer.unref();
    }).catch(()=>{
      if(current()) {
        slot.status='error';
        slot.error='Não foi possível iniciar a conexão individual. Tente novamente.';
      }
    });
  }

  const ownSlot = request => {
    const slot = slots.get(request.attendanceOwner);
    return slot?.session === request.attendanceSession ? slot : undefined;
  };

  app.get(`${base}/status`,authorize,(request,response)=>{
    const slot=ownSlot(request);
    if (slot?.status !== 'disconnecting') slot?.lease.refresh();
    const connected=slot?.status==='connected',jid=request.query.jid;
    response.json({...stateFor(slot),conversations:connected?slot.inbox.conversations():[],
      messages:connected&&privateJid(jid)?slot.inbox.messages(jid):[]});
  });
  app.post(`${base}/connect`,authorize,async (request,response)=>{
    const id = request.attendanceOwner;
    let slot = slots.get(id);
    if (slot && (slot.session !== request.attendanceSession || slot.status === 'error' || slot.closing)) {
      await disconnect(slot);
      slot = slots.get(id);
    }
    if (slot && slot.session !== request.attendanceSession) {
      return response.status(409).json({error:'Já existe uma tentativa de conexão neste usuário.'});
    }
    if (!slot) {
      if (slots.size >= 8) return response.status(409).json({error:'O piloto está com oito conexões ativas. Tente mais tarde.'});
      slot = {id,session:request.attendanceSession,retries:0,enqueue:serialSender(),
        auth:memoryAuth(),inbox:openPersonalInbox(),recovery:createRetryMessageStore(),retryCounters:createRetryCounterCache()};
      slots.set(id,slot);
      const active = slot;
      slot.lease = setTimeout(() => { void disconnect(active); }, idleMs);
      slot.lease.unref();
      start(slot);
    }
    slot.lease.refresh();
    response.status(202).json(stateFor(slot));
  });
  app.post(`${base}/disconnect`,authorize,async (request,response)=>{
    await disconnect(ownSlot(request));
    response.json(stateFor());
  });
  app.post(`${base}/signout`,authorize,async (request,response)=>{
    await disconnect(slots.get(request.attendanceOwner));
    response.json(stateFor());
  });
  app.post(`${base}/send`,authorize,async (request,response)=>{
    const slot=ownSlot(request);
    const body=typeof request.body?.message==='string'?request.body.message.trim():'';
    if(!body||body.length>2000)return response.status(400).json({error:'Informe uma mensagem de até 2.000 caracteres.'});
    if(!slot?.socket||slot.status!=='connected')return response.status(409).json({error:'Conecte seu WhatsApp para enviar.'});
    if(slot.sending)return response.status(429).json({error:'Aguarde a confirmação do envio anterior.'});
    slot.lease.refresh();
    slot.sending=true;
    try {
      const sent=await slot.enqueue(async()=>{
        const socket=slot.socket;
        if(!socket||slot.status!=='connected')throw Object.assign(Error('A conexão foi interrompida.'),{statusCode:409});
        let jid=request.body?.jid,aliases=[];
        if(!privateJid(jid)||!slot.inbox.has(jid)){
          let phone=String(request.body?.phone||'').replace(/\D/g,'');
          if([10,11].includes(phone.length))phone=`55${phone}`;
          if(!/^55\d{10,11}$/.test(phone))throw Object.assign(Error('Informe um telefone brasileiro com DDD.'),{statusCode:400});
          const [registered]=await socket.onWhatsApp(phone);
          if(!registered?.exists||!privateJid(registered.jid))throw Object.assign(Error('O número não foi encontrado no WhatsApp.'),{statusCode:400});
          jid=jidNormalizedUser(registered.jid);aliases=[registered.lid];
        }
        if(slot.socket!==socket||slot.status!=='connected')throw Object.assign(Error('A conexão foi interrompida.'),{statusCode:409});
        const result=await sendRecoverableText(socket,slot.recovery,jid,body,undefined,aliases);
        const message={id:result.key.id,jid,body,direction:'out',at:Date.now(),name:''};
        if (slot.socket !== socket && slot.closing) throw Object.assign(Error('A conexão foi encerrada.'),{statusCode:409});
        slot.inbox.save([message]);
        return message;
      });
      return response.json(sent);
    } catch(error) {
      return response.status(error.statusCode||502).json({error:error.statusCode?error.message:'O envio não pôde ser confirmado. Confira o WhatsApp antes de tentar novamente.'});
    } finally {slot.sending=false;}
  });
}
