import { createHash } from 'node:crypto';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { useRemoteAuthState, encryptSession, decryptSession } from './remote-auth-state.js';
import { sessionRpc } from './remote-session-rpc.js';
import { useRetryMessageStore, createRetryCounterCache } from './retry-message-store.js';
import { sendRecoverableText, serialSender } from './reliable-text-send.js';
import { openPersonalInbox } from './personal-chat-store.js';

const roles = new Set(['admin','vendedora','financeiro']);
const privateJid = jid => typeof jid === 'string' && /^\d+(?::\d+)?@(s\.whatsapp\.net|lid)$/.test(jid);
const sessionKey = id => `atendimento-individual-${id}`;
const stateFor = slot => ({status:slot?.status || 'disconnected', qr:slot?.qr || null, phone:slot?.phone || null, error:slot?.error || null});
const clean = message => {
  const { key, message:content } = message;
  if (!key?.id || !privateJid(key.remoteJid) || !content) return null;
  const body = (content.conversation || content.extendedTextMessage?.text || '').trim().slice(0,4000);
  if (!body) return null;
  const seconds = Number(message.messageTimestamp ?? 0);
  return { id:String(key.id), jid:jidNormalizedUser(key.remoteJid), body, direction:key.fromMe?'out':'in',
    at:Number.isFinite(seconds)&&seconds>0?seconds*1000:Date.now(),
    name:key.fromMe?'':String(message.pushName||'').trim().slice(0,100) };
};

export function installPersonalAttendance(app, config, { makeSocket = makeWASocket, getVersion = fetchLatestBaileysVersion } = {}) {
  const slots = new Map();
  const rpc = sessionRpc(config);
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
      if (!/^[0-9a-f-]{36}$/i.test(user.id||'')) return response.status(401).json({error:'Sessão inválida.'});
      const url = new URL(`${config.supabaseUrl}/rest/v1/profiles`);
      url.search = new URLSearchParams({id:`eq.${user.id}`,select:'role,active',limit:'1'});
      const result = await fetchApi(url,{headers,signal:AbortSignal.timeout(8000)});
      if (!result.ok) throw Error('profile');
      const [profile] = await result.json();
      if (!profile?.active || !roles.has(profile.role)) return response.status(403).json({error:'Seu perfil não tem acesso a Atendimentos.'});
      request.attendanceOwner = user.id;
      return next();
    } catch {
      return response.status(503).json({error:'Não foi possível verificar o acesso. Tente novamente.'});
    }
  }

  async function readDocument(id) {
    const result = await rpc('contact_get_whatsapp_connector_session',{p_session_id:id});
    if (!result.ok) throw Error('Armazenamento indisponível.');
    const data = await result.json();
    return data ? decryptSession(Buffer.from(data,'base64'),config.encryptionSecret) : null;
  }
  async function writeDocument(id, value) {
    const payload = encryptSession(value,config.encryptionSecret).toString('base64');
    const result = await rpc('contact_put_whatsapp_connector_session',{p_session_id:id,p_payload:payload});
    if (!result.ok) throw Error('Não foi possível salvar as mensagens.');
  }
  async function deleteDocument(id) {
    const result = await rpc('contact_delete_whatsapp_connector_session',{p_session_id:id});
    if (!result.ok) throw Error('Não foi possível apagar os dados da conexão.');
  }
  const slotFor = id => {
    if (!slots.has(id)) slots.set(id,{id,status:'disconnected',generation:0,retries:0,enqueue:serialSender()});
    return slots.get(id);
  };

  async function disconnect(slot) {
    slot.generation++;
    clearTimeout(slot.timer); clearTimeout(slot.pairingTimer);
    const socket=slot.socket;
    slot.socket=null; slot.qr=null; slot.phone=null; slot.error=null; slot.status='disconnecting';
    try {
      // Wait for any connection setup and pending writes before deleting data.
      await slot.starting?.catch(()=>{});
      await slot.enqueue(async()=>{});
      if (socket?.user) await Promise.race([socket.logout().catch(()=>{}), new Promise(resolve=>{const timer=setTimeout(resolve,5000);timer.unref();})]);
      try {socket?.end(undefined);} catch {}
      await slot.inbox?.flush().catch(()=>{});
      await slot.store?.clear();
      await slot.recovery?.clear();
      await Promise.all([deleteDocument(sessionKey(slot.id)),deleteDocument(`${sessionKey(slot.id)}-message-retry`),deleteDocument(`${sessionKey(slot.id)}-inbox`)]);
      slot.store=null;slot.recovery=null;slot.inbox=null;slot.status='disconnected';
    } catch {
      slot.status='error';slot.error='A sessão foi interrompida, mas a limpeza falhou. Tente desconectar novamente.';
      slot.cleanupPending=true;
      return;
    }
    slot.cleanupPending=false;
  }

  function start(slot, pair) {
    if (slot.starting || slot.socket || slot.status==='disconnecting' || slot.cleanupPending) return;
    if ([...slots.values()].filter(other=>other!==slot&&(other.socket||other.starting||other.status==='connecting')).length>=8) {
      slot.status='error';slot.error='O piloto está com oito conexões ativas. Tente mais tarde.';return;
    }
    const generation=++slot.generation;
    const current=()=>slot.generation===generation;
    const id=sessionKey(slot.id);
    slot.status='connecting';slot.error=null;
    slot.starting=(async()=>{
      const store=slot.store||await useRemoteAuthState({...config,sessionId:id});
      if (!current()) return;
      if (!pair&&!(store.state.creds.registered||store.state.creds.me?.id)) {slot.status='disconnected';return;}
      slot.store=store;
      const identity=createHash('sha256').update(store.state.creds.signedIdentityKey.public).digest('hex');
      const inbox=slot.inbox||await openPersonalInbox({identity,read:()=>readDocument(`${id}-inbox`),write:document=>writeDocument(`${id}-inbox`,document)});
      const recovery=slot.recovery||await useRetryMessageStore({...config,identity,sessionId:id});
      const version=await baileysVersion();
      if (!current()) return;
      slot.inbox=inbox;slot.recovery=recovery;
      slot.retryCounters ||= createRetryCounterCache();
      const socket=makeSocket({version,auth:store.state,logger:config.logger,printQRInTerminal:false,
        browser:['CONTACT Atendimento individual','Chrome','1.0.0'],markOnlineOnConnect:false,
        syncFullHistory:false,shouldSyncHistoryMessage:()=>false,generateHighQualityLinkPreview:false,
        getMessage:async key=>recovery.get(key),msgRetryCounterCache:slot.retryCounters,maxMsgRetryCount:5});
      slot.socket=socket;
      const live=()=>current()&&slot.socket===socket;
      socket.ev.on('creds.update',()=>{
        if (live()) store.saveCreds().catch(()=>{if(live())slot.error='Não foi possível confirmar o salvamento da sessão.';});
      });
      socket.ev.on('messages.upsert',({type,messages=[]})=>{
        if (!live()||slot.status!=='connected'||type!=='notify') return;
        const batch=messages.map(clean).filter(Boolean);
        if(batch.length) inbox.save(batch).catch(()=>{if(live())slot.error='Uma mensagem não pôde ser salva. Confira seu WhatsApp.';});
      });
      socket.ev.on('connection.update',async ({connection,qr,lastDisconnect})=>{
        if(!live())return;
        if(qr){
          try {
            const data=await QRCode.toDataURL(qr,{width:300,margin:2});
            if(live()&&slot.status!=='connected'){slot.qr=data;slot.status='qr_ready';}
          } catch {if(live())slot.error='Não foi possível gerar o QR Code.';}
        }
        if(connection==='open'){
          try {await store.saveCreds();}
          catch {if(live())slot.error='A conexão foi aberta, mas a sessão não pôde ser salva.';}
          if(!live())return;
          clearTimeout(slot.pairingTimer);
          slot.phone=String(socket.user?.id||'').split('@')[0].split(':')[0]||null;
          slot.qr=null;slot.status='connected';slot.retries=0;
        }
        if(connection==='close'&&live()){
          slot.socket=null;slot.qr=null;slot.phone=null;
          clearTimeout(slot.pairingTimer);
          const code=lastDisconnect?.error?.output?.statusCode;
          if(code===DisconnectReason.loggedOut){await disconnect(slot);return;}
          const registered=store.state.creds.registered||store.state.creds.me?.id;
          if(registered&&slot.retries<4&&code!==DisconnectReason.connectionReplaced){
            slot.status='connecting';slot.retries++;
            slot.timer=setTimeout(()=>{if(current())start(slot,false);},2000*slot.retries);
          }else{slot.status='error';slot.error='Conexão interrompida. Clique em Conectar meu WhatsApp para tentar novamente.';}
        }
      });
      slot.pairingTimer=setTimeout(()=>{
        if(!live()||slot.status==='connected')return;
        slot.socket=null;slot.qr=null;slot.status='error';slot.error='O QR Code expirou. Abra uma nova conexão.';
        try{socket.end(undefined);}catch{}
      },120_000);
    })().catch(()=>{
      if(current()){slot.status='error';slot.error='Não foi possível iniciar a conexão individual. Tente novamente.';}
    }).finally(()=>{slot.starting=null;});
  }

  app.get(`${base}/status`,authorize,(request,response)=>{
    const slot=slotFor(request.attendanceOwner);
    if(!slot.checked){slot.checked=true;start(slot,false);}
    const connected=slot.status==='connected',jid=request.query.jid;
    response.json({...stateFor(slot),conversations:connected?slot.inbox.conversations():[],
      messages:connected&&privateJid(jid)?slot.inbox.messages(jid):[]});
  });
  app.post(`${base}/connect`,authorize,(request,response)=>{
    const slot=slotFor(request.attendanceOwner);
    slot.checked=true;slot.retries=0;start(slot,true);
    response.status(202).json(stateFor(slot));
  });
  app.post(`${base}/disconnect`,authorize,async (request,response)=>{
    const slot=slotFor(request.attendanceOwner);
    if(slot.status!=='disconnecting')await disconnect(slot);
    response.status(slot.cleanupPending?503:200).json(stateFor(slot));
  });
  app.post(`${base}/send`,authorize,async (request,response)=>{
    const slot=slotFor(request.attendanceOwner);
    const body=typeof request.body?.message==='string'?request.body.message.trim():'';
    if(!body||body.length>2000)return response.status(400).json({error:'Informe uma mensagem de até 2.000 caracteres.'});
    if(!slot.socket||slot.status!=='connected')return response.status(409).json({error:'Conecte seu WhatsApp para enviar.'});
    if(slot.sending)return response.status(429).json({error:'Aguarde a confirmação do envio anterior.'});
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
        try {await slot.inbox.save([message]);}
        catch {slot.error='A mensagem foi enviada, mas o registro não foi confirmado.';}
        return message;
      });
      return response.json(sent);
    } catch(error) {
      return response.status(error.statusCode||502).json({error:error.statusCode?error.message:'O envio não pôde ser confirmado. Confira o WhatsApp antes de tentar novamente.'});
    } finally {slot.sending=false;}
  });
}
