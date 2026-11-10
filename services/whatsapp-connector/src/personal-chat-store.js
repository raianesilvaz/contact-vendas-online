// Bounded text history for the lifetime of one linked device.
export function openPersonalInbox({ maxBytes = 512 * 1024 } = {}) {
  let messages = [];
  let chats = [];

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
    conversations() {
      const latest = new Map(chats.map(chat => [chat.jid, chat]));
      for (const message of messages) {
        const previous = latest.get(message.jid);
        latest.set(message.jid, {
          jid: message.jid, name: message.name || previous?.name || '',
          at: Math.max(message.at, previous?.at || 0), body: message.body.slice(0, 160)
        });
      }
      return [...latest.values()].sort((a, b) => b.at - a.at).slice(0, 100);
    },
    messages: jid => messages.filter(message => message.jid === jid).slice(-100),
    has: jid => chats.some(chat => chat.jid === jid) || messages.some(message => message.jid === jid),
    clear() { messages = []; chats = []; }
  };
}
