import { generateWAMessage } from '@whiskeysockets/baileys';

// Persist the exact protocol message BEFORE transmission. WhatsApp recovery reuses its ID.
export async function sendRecoverableText(socket, store, jid, text, generate = generateWAMessage, aliases = []) {
  if (!socket?.user?.id || !store) throw new Error('Recuperação de mensagens indisponível.');
  const message = await generate(jid, { text }, { userJid: socket.user.id });
  await store.remember(message, aliases);
  await socket.relayMessage(jid, message.message, { messageId: message.key.id, useUserDevicesCache: false });
  return message;
}

export function serialSender() {
  let queue = Promise.resolve();
  return operation => { const next = queue.catch(() => {}).then(operation); queue = next; return next; };
}
