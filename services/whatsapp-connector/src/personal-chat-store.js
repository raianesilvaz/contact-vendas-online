// One bounded, encrypted inbox document per CONTACT user and WhatsApp identity.
export async function openPersonalInbox({ read, write, identity, maxBytes = 512 * 1024 }) {
  const previous = await read();
  let messages = previous?.identity === identity && Array.isArray(previous.messages) ? previous.messages : [];
  let pending = Promise.resolve();

  function save(batch) {
    const entries = new Map(messages.map(message => [`${message.jid}|${message.id}`, message]));
    for (const message of batch) entries.set(`${message.jid}|${message.id}`, message);
    messages = [...entries.values()].sort((a,b) => a.at - b.at).slice(-1000);
    let snapshot = JSON.stringify({ identity, messages });
    while (messages.length && Buffer.byteLength(snapshot) > maxBytes) {
      messages = messages.slice(Math.max(1, Math.floor(messages.length / 10)));
      snapshot = JSON.stringify({ identity, messages });
    }
    const document = JSON.parse(snapshot);
    pending = pending.catch(() => {}).then(() => write(document));
    return pending;
  }

  return {
    save,
    flush: () => pending,
    conversations() {
      const latest = new Map();
      for (const message of messages) {
        const previous = latest.get(message.jid);
        latest.set(message.jid, { jid: message.jid, name: message.name || previous?.name || '', at: message.at, body: message.body.slice(0,160) });
      }
      return [...latest.values()].sort((a,b) => b.at - a.at).slice(0, 100);
    },
    messages: jid => messages.filter(message => message.jid === jid).slice(-100),
    has: jid => messages.some(message => message.jid === jid),
  };
}
