import { BufferJSON, jidNormalizedUser } from '@whiskeysockets/baileys';
import { encryptSession, decryptSession } from './remote-auth-state.js';
import { sessionRpc } from './remote-session-rpc.js';

const WEEK = 7 * 24 * 60 * 60 * 1000;
const keyFor = key => key?.id && key?.remoteJid ? `${jidNormalizedUser(key.remoteJid)}|${key.id}` : null;

// A separate encrypted document keeps message retention from inflating Signal auth state.
export async function useRetryMessageStore({ identity, sessionId = 'primary', ...config }) {
  if (!identity || !config.encryptionSecret) throw new Error('Identidade da recuperação não configurada.');
  const call = sessionRpc(config), remoteId = `${sessionId}-message-retry`;
  const response = await call('contact_get_whatsapp_connector_session', { p_session_id: remoteId });
  if (!response.ok) throw new Error(`Falha ao recuperar mensagens para recuperação (${response.status}).`);
  const encoded = await response.json();
  const previous = encoded && decryptSession(Buffer.from(encoded, 'base64'), config.encryptionSecret);
  return createRetryMessageStore({
    ...config,
    initial: previous?.identity === identity ? previous.messages : [],
    async write(messages) {
      const p_payload = encryptSession({ version: 1, identity, messages }, config.encryptionSecret).toString('base64');
      const saved = await call('contact_put_whatsapp_connector_session', { p_session_id: remoteId, p_payload });
      if (!saved.ok) throw new Error(`Falha ao guardar a mensagem para recuperação (${saved.status}).`);
    },
    async remove() {
      const result = await call('contact_delete_whatsapp_connector_session', { p_session_id: remoteId });
      if (!result.ok) throw new Error(`Falha ao limpar recuperação (${result.status}).`);
    }
  });
}

export function createRetryMessageStore({ initial = [], write, remove, now = Date.now,
  maxEntries = 256, maxBytes = 512 * 1024, ttlMs = WEEK } = {}) {
  const records = new Map();
  let writesEnabled = true, queue = Promise.resolve();
  for (const record of initial) {
    const id = keyFor(record.key);
    if (id && record.message && record.createdAt > now() - ttlMs) records.set(id, record);
  }
  function prune() {
    for (const [id, record] of records) if (record.createdAt <= now() - ttlMs) records.delete(id);
    while (records.size && (records.size > maxEntries || Buffer.byteLength(JSON.stringify([...records.values()], BufferJSON.replacer)) > maxBytes)) records.delete(records.keys().next().value);
  }
  prune();
  return {
    get(key) {
      prune();
      const exact = records.get(keyFor(key));
      if (exact) return exact.message;
      // LID aliases come ONLY from WhatsApp's authenticated onWhatsApp response.
      const jid = key?.remoteJid && jidNormalizedUser(key.remoteJid);
      if (jid && key.id) for (const record of records.values()) {
        if (record.key.id === key.id && record.aliases?.includes(jid)) return record.message;
      }
      return undefined;
    },
    async remember(message, aliases = []) {
      if (!writesEnabled) throw new Error('Sessão de recuperação encerrada.');
      const id = keyFor(message?.key);
      if (!id || !message.message || !message.key.fromMe) throw new Error('Mensagem de recuperação inválida.');
      const record = { key: { id: message.key.id, remoteJid: jidNormalizedUser(message.key.remoteJid) }, aliases: [...new Set(aliases.filter(jid=>typeof jid==='string'&&jid.includes('@')).map(jidNormalizedUser))], message: message.message, createdAt: now() };
      if (Buffer.byteLength(JSON.stringify(record, BufferJSON.replacer)) > maxBytes / 2) throw new Error('Mensagem excede o limite de recuperação.');
      records.delete(id); records.set(id, record); prune();
      if (!records.has(id)) throw new Error('Não foi possível reter a mensagem para recuperação.');
      if (!write) return;
      const snapshot = [...records.values()];
      queue = queue.catch(() => {}).then(() => {
        if (!writesEnabled) throw new Error('Sessão de recuperação encerrada.');
        return write(snapshot);
      });
      await queue;
    },
    flush: () => queue,
    async clear() {
      writesEnabled = false;
      records.clear();
      await queue.catch(() => {});
      await remove?.();
    }
  };
}

// Share bounded retry counters across reconnects rather than resetting on each socket.
export function createRetryCounterCache({ now = Date.now, ttlMs = 60 * 60 * 1000, maxEntries = 2048 } = {}) {
  const values = new Map();
  return {
    get(key) { const item = values.get(key); if (!item || item.expires <= now()) { values.delete(key); return undefined; } return item.value; },
    set(key, value) { values.delete(key); values.set(key, { value, expires: now() + ttlMs }); while (values.size > maxEntries) values.delete(values.keys().next().value); return true; },
    del(keys) { let removed = 0; for (const key of Array.isArray(keys) ? keys : [keys]) removed += Number(values.delete(key)); return removed; },
    flushAll() { values.clear(); }
  };
}
