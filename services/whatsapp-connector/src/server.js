import express from 'express';
import QRCode from 'qrcode';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { useRemoteAuthState } from './remote-auth-state.js';

const PORT = Number(process.env.PORT || 3100);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SESSION_ENCRYPTION_KEY = process.env.SESSION_ENCRYPTION_KEY;
const SESSION_BUCKET = process.env.SESSION_BUCKET || 'whatsapp-connector-private';
const SESSION_OBJECT = process.env.SESSION_OBJECT || 'primary/auth-state.bin';
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGIN || 'http://localhost:8787')
  .split(',').map(value => value.trim()).filter(Boolean);
const logger = pino({ level: process.env.WHATSAPP_LOG_LEVEL || 'silent' });

if (!SUPABASE_URL || !SUPABASE_KEY || !SUPABASE_SECRET_KEY || !SESSION_ENCRYPTION_KEY) {
  throw new Error('SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY e SESSION_ENCRYPTION_KEY são obrigatórios.');
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use((request, response, next) => {
  const origin = request.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (request.method === 'OPTIONS') return response.sendStatus(204);
  next();
});

let client = null;
let initializePromise = null;
let authStore = null;
let manualDisconnect = false;
let lastSendAt = 0;
const state = {
  status: 'disconnected', qr: null, phone: null, name: null, error: null,
  updatedAt: new Date().toISOString()
};

function updateState(next) {
  Object.assign(state, next, { updatedAt: new Date().toISOString() });
}

function publicState() {
  return {
    status: state.status, hasQr: Boolean(state.qr), phone: state.phone,
    name: state.name, error: state.error, updatedAt: state.updatedAt
  };
}

async function requireFinanceAccess(request, response, next) {
  const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return response.status(401).json({ error: 'Sessão não informada.' });

  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` };
  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers });
  if (!authResponse.ok) return response.status(401).json({ error: 'Sessão inválida.' });
  const user = await authResponse.json();
  const profileUrl = new URL(`${SUPABASE_URL}/rest/v1/profiles`);
  profileUrl.searchParams.set('id', `eq.${user.id}`);
  profileUrl.searchParams.set('select', 'role,active');
  profileUrl.searchParams.set('limit', '1');
  const profileResponse = await fetch(profileUrl, { headers });
  const [profile] = profileResponse.ok ? await profileResponse.json() : [];
  if (!profile?.active || profile.role !== 'admin') {
    return response.status(403).json({ error: 'Acesso não autorizado.' });
  }
  request.contactUser = { id: user.id, role: profile.role };
  next();
}

function disconnectCode(lastDisconnect) {
  return lastDisconnect?.error?.output?.statusCode ||
    lastDisconnect?.error?.data?.statusCode ||
    lastDisconnect?.error?.statusCode || null;
}

async function createSocket() {
  authStore = await useRemoteAuthState({
    supabaseUrl: SUPABASE_URL,
    secretKey: SUPABASE_SECRET_KEY,
    encryptionSecret: SESSION_ENCRYPTION_KEY,
    bucket: SESSION_BUCKET,
    objectPath: SESSION_OBJECT
  });
  const { state: authState, saveCreds } = authStore;
  const { version } = await fetchLatestBaileysVersion();
  const socket = makeWASocket({
    version,
    auth: authState,
    logger,
    printQRInTerminal: false,
    browser: ['CONTACT', 'Chrome', '1.0.0'],
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false
  });
  client = socket;
  socket.ev.on('creds.update', saveCreds);
  socket.ev.on('connection.update', async update => {
    if (client !== socket) return;
    const { connection, qr, lastDisconnect } = update;
    if (qr) {
      try {
        const dataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
        updateState({ status: 'qr_ready', qr: dataUrl, phone: null, name: null, error: null });
        console.log('QR Code pronto para leitura.');
      } catch (error) {
        updateState({ status: 'error', qr: null, error: error.message });
      }
    }
    if (connection === 'open') {
      const rawPhone = String(socket.user?.id || '').split('@')[0].split(':')[0];
      updateState({
        status: 'connected', qr: null, phone: rawPhone || null,
        name: socket.user?.name || null, error: null
      });
      console.log(`WhatsApp conectado${rawPhone ? `: ${rawPhone}` : '.'}`);
    }
    if (connection === 'close') {
      const code = disconnectCode(lastDisconnect);
      const loggedOut = code === DisconnectReason.loggedOut;
      client = null;
      initializePromise = null;
      if (manualDisconnect || loggedOut) {
        updateState({ status: 'disconnected', qr: null, phone: null, name: null, error: null });
        manualDisconnect = false;
        return;
      }
      updateState({ status: 'initializing', qr: null, error: null });
      console.log(`Conexão reiniciada pelo WhatsApp${code ? ` (código ${code})` : ''}. Reconectando...`);
      setTimeout(() => initializeClient().catch(console.error), 1_500);
    }
  });
  return socket;
}

async function initializeClient() {
  if (initializePromise) return initializePromise;
  if (client && ['initializing', 'qr_ready', 'authenticated', 'connected'].includes(state.status)) return client;
  manualDisconnect = false;
  updateState({ status: 'initializing', qr: null, error: null });
  console.log('Iniciando conexão direta com o WhatsApp...');
  initializePromise = createSocket()
    .catch(error => {
      console.error('Falha ao iniciar WhatsApp:', error?.message || error);
      updateState({ status: 'error', qr: null, error: error.message || 'Não foi possível iniciar o WhatsApp.' });
      client = null;
      throw error;
    })
    .finally(() => { initializePromise = null; });
  return initializePromise;
}

app.get('/health', (_request, response) => response.json({ ok: true, whatsapp: state.status }));
app.get('/api/whatsapp/status', requireFinanceAccess, (_request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.json(publicState());
});
app.get('/api/whatsapp/qr', requireFinanceAccess, (_request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.json({ qr: state.qr, status: state.status });
});
app.post('/api/whatsapp/connect', requireFinanceAccess, (_request, response) => {
  initializeClient().catch(() => {});
  response.status(202).json(publicState());
});
app.post('/api/whatsapp/send-test', requireFinanceAccess, async (request, response) => {
  if (!client || state.status !== 'connected') return response.status(409).json({ error: 'WhatsApp não está conectado.' });
  if (Date.now() - lastSendAt < 10_000) return response.status(429).json({ error: 'Aguarde 10 segundos antes de outro teste.' });
  let phone = String(request.body?.phone || '').replace(/\D/g, '');
  const message = String(request.body?.message || '').trim();
  if (phone.length === 10 || phone.length === 11) phone = `55${phone}`;
  if (phone.length < 12 || phone.length > 13) return response.status(400).json({ error: 'Informe um telefone brasileiro válido com DDD.' });
  if (!message || message.length > 2000) return response.status(400).json({ error: 'A mensagem deve ter entre 1 e 2.000 caracteres.' });
  try {
    const [registration] = await client.onWhatsApp(phone);
    if (!registration?.exists) return response.status(400).json({ error: 'Este número não possui WhatsApp.' });
    const sent = await client.sendMessage(registration.jid, { text: message });
    lastSendAt = Date.now();
    response.json({ ok: true, messageId: sent?.key?.id || null });
  } catch (error) {
    response.status(500).json({ error: error.message || 'Não foi possível enviar a mensagem.' });
  }
});
app.post('/api/whatsapp/disconnect', requireFinanceAccess, async (_request, response) => {
  manualDisconnect = true;
  const socket = client;
  client = null;
  initializePromise = null;
  const store = authStore;
  authStore = null;
  try { await store?.clear(); } catch (error) {
    console.error('Falha ao remover sessão remota:', error?.message || error);
  }
  try { await socket?.logout(); } catch {}
  try { socket?.end(undefined); } catch {}
  updateState({ status: 'disconnected', qr: null, phone: null, name: null, error: null });
  response.json(publicState());
});
app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'Erro interno do conector.' });
});

app.listen(PORT, () => {
  console.log(`Conector WhatsApp disponível na porta ${PORT}.`);
  if (String(process.env.AUTO_START).toLowerCase() === 'true') initializeClient().catch(console.error);
});
