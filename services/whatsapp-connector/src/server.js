import express from 'express';
import QRCode from 'qrcode';
import pkg from 'whatsapp-web.js';
import path from 'node:path';

const { Client, LocalAuth } = pkg;
const PORT = Number(process.env.PORT || 3100);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGIN || 'http://localhost:8787')
  .split(',').map(value => value.trim()).filter(Boolean);
const SESSION_PATH = path.resolve(process.env.SESSION_PATH || '.wwebjs_auth');
const HEADLESS = String(process.env.WHATSAPP_HEADLESS || 'false').toLowerCase() === 'true';
const MAX_INITIALIZE_ATTEMPTS = 3;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY são obrigatórios.');
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
  if (!profile?.active || !['admin', 'financeiro'].includes(profile.role)) {
    return response.status(403).json({ error: 'Acesso não autorizado.' });
  }
  request.contactUser = { id: user.id, role: profile.role };
  next();
}

function attachEvents(instance) {
  instance.on('qr', async qr => {
    try {
      const dataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
      updateState({ status: 'qr_ready', qr: dataUrl, phone: null, name: null, error: null });
    } catch (error) {
      updateState({ status: 'error', qr: null, error: error.message });
    }
  });
  instance.on('authenticated', () => updateState({ status: 'authenticated', qr: null, error: null }));
  instance.on('ready', () => {
    const info = instance.info || {};
    updateState({ status: 'connected', qr: null, phone: info.wid?.user || null, name: info.pushname || null, error: null });
  });
  instance.on('auth_failure', message => updateState({ status: 'error', qr: null, error: message || 'Falha de autenticação.' }));
  instance.on('disconnected', reason => {
    updateState({ status: 'disconnected', qr: null, phone: null, name: null, error: reason || null });
    client = null;
    initializePromise = null;
  });
}

function isRecoverableBrowserError(error) {
  const message = String(error?.message || error || '');
  return message.includes('Execution context was destroyed') ||
    message.includes('Target closed') ||
    message.includes('Session closed');
}

async function closeClient(instance) {
  if (!instance) return;
  try { await instance.destroy(); } catch {}
  try { await instance.pupBrowser?.close(); } catch {}
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function startClientWithRecovery() {
  let lastError;
  for (let attempt = 1; attempt <= MAX_INITIALIZE_ATTEMPTS; attempt += 1) {
    const instance = new Client({
      authStrategy: new LocalAuth({ clientId: 'contact-financeiro', dataPath: SESSION_PATH }),
      authTimeoutMs: 120_000,
      puppeteer: {
        headless: HEADLESS,
        protocolTimeout: 120_000,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-default-browser-check'
        ]
      }
    });
    client = instance;
    attachEvents(instance);
    console.log(`Iniciando WhatsApp (tentativa ${attempt}/${MAX_INITIALIZE_ATTEMPTS})...`);
    try {
      await instance.initialize();
      return instance;
    } catch (error) {
      lastError = error;
      console.error(`Falha na tentativa ${attempt}:`, error?.message || error);
      await closeClient(instance);
      if (client === instance) client = null;
      if (!isRecoverableBrowserError(error) || attempt === MAX_INITIALIZE_ATTEMPTS) break;
      updateState({ status: 'initializing', qr: null, error: null });
      await wait(3_000);
    }
  }
  throw lastError;
}

async function initializeClient() {
  if (initializePromise) return initializePromise;
  if (client && ['initializing', 'qr_ready', 'authenticated', 'connected'].includes(state.status)) return client;
  updateState({ status: 'initializing', qr: null, error: null });
  initializePromise = startClientWithRecovery()
    .catch(error => {
      const friendlyError = isRecoverableBrowserError(error)
        ? 'O navegador do WhatsApp reiniciou durante a conexão. Feche o conector, abra novamente e tente gerar o QR Code.'
        : error.message;
      updateState({ status: 'error', qr: null, error: friendlyError });
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
    const chatId = `${phone}@c.us`;
    if (!await client.isRegisteredUser(chatId)) return response.status(400).json({ error: 'Este número não possui WhatsApp.' });
    const sent = await client.sendMessage(chatId, message);
    lastSendAt = Date.now();
    response.json({ ok: true, messageId: sent.id?._serialized || null });
  } catch (error) {
    response.status(500).json({ error: error.message || 'Não foi possível enviar a mensagem.' });
  }
});
app.post('/api/whatsapp/disconnect', requireFinanceAccess, async (_request, response) => {
  try { if (client) await client.logout(); } catch {}
  try { if (client) await client.destroy(); } catch {}
  client = null;
  initializePromise = null;
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
