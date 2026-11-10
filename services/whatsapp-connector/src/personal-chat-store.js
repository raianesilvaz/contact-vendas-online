import { jidNormalizedUser } from '@whiskeysockets/baileys';

export const privateJid = jid => typeof jid === 'string' && /^\d+(?::\d+)?@(s\.whatsapp\.net|lid)$/.test(jid);
const contactJid = jid => privateJid(jid) ? jidNormalizedUser(jid) : '';
const nameField = value => typeof value === 'string' ? value.trim().slice(0, 100) : '';

// Bounded text history for the lifetime of one linked device.
export function openPersonalInbox({ maxBytes = 512 * 1024 } = {}) {
  let messages = [];
  let chats = [];
  const contacts = new Map();

  function identify(contact) {
    const id = contactJid(contact.id);
    if (!id) return;
    const previous = contacts.get(id);
    const pn = [id, contactJid(contact.jid), previous?.pn].find(jid => jid?.endsWith('@s.whatsapp.net'));
    const lid = [id, contactJid(contact.lid), previous?.lid].find(jid => jid?.endsWith('@lid'));
    for (const key of new Set([id, pn, lid].filter(Boolean))) {
      const current = contacts.get(key);
      contacts.delete(key);
      contacts.set(key, {
        pn, lid,
        name: nameField(contact.name) || current?.name,
        notify: nameField(contact.notify) || current?.notify,
        verifiedName: nameField(contact.verifiedName) || current?.verifiedName
      });
    }
    while (contacts.size > 5000) contacts.delete(contacts.keys().next().value);
  }

  function save(batch) {
    const entries = new Map(messages.map(message => [`${message.jid}|${message.id}`, message]));
    for (const message of batch) {
      const key = `${message.jid}|${message.id}`;
      if (!entries.has(key)) entries.set(key, message);
    }
    const latest = [...entries.values()].sort((a, b) => b.at - a.at).slice(0, 1000);
    let bytes = 0;
    messages = [];
    for (const message of latest) {
      bytes += Buffer.byteLength(JSON.stringify(message));
      if (bytes > maxBytes) break;
      messages.push(message);
    }
    messages.reverse();
  }

  function addChats(batch) {
    const entries = new Map(chats.map(chat => [chat.jid, chat]));
    for (const chat of batch) {
      const previous = entries.get(chat.jid);
      entries.set(chat.jid, { ...chat, name: chat.name || previous?.name || '', at: Math.max(chat.at, previous?.at || 0) });
    }
    chats = [...entries.values()].sort((a, b) => b.at - a.at).slice(0, 100);
  }

  return {
    save,
    addChats,
    identify,
    conversations() {
      const latest = new Map(chats.map(chat => [chat.jid, chat]));
      for (const message of messages) {
        const previous = latest.get(message.jid);
        latest.set(message.jid, {
          jid: message.jid, name: message.name || previous?.name || '',
          at: Math.max(message.at, previous?.at || 0), body: message.body.slice(0, 160)
        });
      }
      return [...latest.values()].sort((a, b) => b.at - a.at).slice(0, 100).map(conversation => {
        const contact = contacts.get(conversation.jid);
        const linked = contacts.get(contact?.pn === conversation.jid ? contact?.lid : contact?.pn);
        const alternate = linked?.pn === contact?.pn && linked?.lid === contact?.lid ? linked : undefined;
        const name = contact?.name || alternate?.name || contact?.verifiedName || alternate?.verifiedName ||
          contact?.notify || alternate?.notify || conversation.name;
        const numberJid = contact?.pn || (conversation.jid.endsWith('@s.whatsapp.net') ? conversation.jid : '');
        const digits = numberJid.split('@')[0];
        return { ...conversation, name, phone: /^\d{7,15}$/.test(digits) ? '+' + digits : null };
      });
    },
    messages: jid => messages.filter(message => message.jid === jid).slice(-100),
    has: jid => chats.some(chat => chat.jid === jid) || messages.some(message => message.jid === jid),
    clear() { messages = []; chats = []; contacts.clear(); }
  };
}
