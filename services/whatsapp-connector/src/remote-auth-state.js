import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { BufferJSON, initAuthCreds, proto } from '@whiskeysockets/baileys';

const FORMAT_VERSION = 1;

function encryptionKey(value) {
  const normalized = String(value || '').trim();
  const key = /^[a-f\d]{64}$/i.test(normalized)
    ? Buffer.from(normalized, 'hex')
    : Buffer.from(normalized, 'base64');
  if (key.length !== 32) {
    throw new Error('SESSION_ENCRYPTION_KEY deve conter exatamente 32 bytes (hex ou base64).');
  }
  return key;
}

export function encryptSession(value, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const plaintext = Buffer.from(JSON.stringify(value, BufferJSON.replacer), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([FORMAT_VERSION]), iv, tag, ciphertext]);
}

export function decryptSession(value, secret) {
  const payload = Buffer.from(value);
  if (payload[0] !== FORMAT_VERSION || payload.length < 30) {
    throw new Error('Formato da sessão remota não reconhecido.');
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), payload.subarray(1, 13));
  decipher.setAuthTag(payload.subarray(13, 29));
  const plaintext = Buffer.concat([decipher.update(payload.subarray(29)), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'), BufferJSON.reviver);
}

function rpcUrl(baseUrl, name) {
  return `${String(baseUrl).replace(/\/+$/, '')}/rest/v1/rpc/${name}`;
}

export async function useRemoteAuthState({
  supabaseUrl,
  publishableKey,
  accessToken,
  encryptionSecret,
  sessionId = 'primary',
  fetchImpl = fetch
}) {
  if (!supabaseUrl || !publishableKey || !accessToken || !encryptionSecret) {
    throw new Error('Configuração da sessão remota incompleta.');
  }

  const headers = { apikey: publishableKey, 'Content-Type': 'application/json' };
  const call = async (name, body) => fetchImpl(rpcUrl(supabaseUrl, name), {
    method: 'POST', headers, body: JSON.stringify(body)
  });
  let document = { creds: initAuthCreds(), keys: {} };
  let writesEnabled = true;
  let writeQueue = Promise.resolve();

  const downloaded = await call('contact_get_whatsapp_connector_session', {
    p_token: accessToken, p_session_id: sessionId
  });
  if (downloaded.ok) {
    const payload = await downloaded.json();
    if (payload) document = decryptSession(Buffer.from(payload, 'base64'), encryptionSecret);
  } else {
    throw new Error(`Falha ao recuperar a sessão remota (${downloaded.status}).`);
  }

  const persist = () => {
    if (!writesEnabled) return writeQueue;
    const snapshot = encryptSession(document, encryptionSecret);
    writeQueue = writeQueue.then(async () => {
      if (!writesEnabled) return;
      const response = await call('contact_put_whatsapp_connector_session', {
        p_token: accessToken,
        p_session_id: sessionId,
        p_payload: snapshot.toString('base64')
      });
      if (!response.ok) {
        throw new Error(`Falha ao salvar a sessão remota (${response.status}).`);
      }
    });
    return writeQueue;
  };

  return {
    state: {
      creds: document.creds,
      keys: {
        get: async (type, ids) => Object.fromEntries(ids.map(id => {
          let value = document.keys?.[type]?.[id] ?? null;
          if (type === 'app-state-sync-key' && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value);
          }
          return [id, value];
        })),
        set: async data => {
          for (const [type, values] of Object.entries(data)) {
            document.keys[type] ||= {};
            for (const [id, value] of Object.entries(values)) {
              if (value) document.keys[type][id] = value;
              else delete document.keys[type][id];
            }
            if (!Object.keys(document.keys[type]).length) delete document.keys[type];
          }
          await persist();
        }
      }
    },
    saveCreds: persist,
    clear: async () => {
      writesEnabled = false;
      await writeQueue.catch(() => {});
      const response = await call('contact_delete_whatsapp_connector_session', {
        p_token: accessToken, p_session_id: sessionId
      });
      if (!response.ok) {
        throw new Error(`Falha ao remover a sessão remota (${response.status}).`);
      }
      document = { creds: initAuthCreds(), keys: {} };
    }
  };
}
