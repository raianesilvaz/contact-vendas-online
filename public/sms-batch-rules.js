// CONTACT SMS: regras puras da fila. Não envia mensagens e não contém credenciais.
// Datas e históricos devem vir do servidor/banco, nunca de localStorage.
export const SMS_BATCH_SIZE = 50;
export const SMS_COOLDOWN_DAYS = 7;
const DAY_MS = 86400000;

export function normalizeBrazilPhone(value) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  if (![10, 11].includes(digits.length) || digits[0] === '0' || digits[1] === '0') return null;
  return '55' + digits;
}

export function prepareSmsQueue(contacts, history, campaignId, now = new Date()) {
  if (!campaignId) throw new Error('Campanha obrigatória');
  const timestamp = new Date(now).getTime();
  if (!Number.isFinite(timestamp)) throw new Error('Data inválida');
  const seen = new Set();
  const blocked = [];
  const eligible = [];
  for (const contact of contacts) {
    const phone = normalizeBrazilPhone(contact.phone);
    if (!phone) { blocked.push({ contact, reason: 'invalid_phone' }); continue; }
    if (seen.has(phone)) { blocked.push({ contact, reason: 'duplicate_phone' }); continue; }
    seen.add(phone);
    if (contact.sms_consent !== true || contact.sms_opt_out === true) {
      blocked.push({ contact, reason: 'no_consent' }); continue;
    }
    const records = history.filter(row => normalizeBrazilPhone(row.phone) === phone);
    // Sucesso anterior na mesma campanha: bloqueio permanente.
    if (records.some(row => row.campaign_id === campaignId && row.status === 'sent')) {
      blocked.push({ contact, reason: 'already_sent_campaign' }); continue;
    }
    // Tentativas em curso ou com resultado desconhecido: nunca reenviar automaticamente.
    if (records.some(row => row.status === 'sending' || row.status === 'unknown')) {
      blocked.push({ contact, reason: 'unresolved_attempt' }); continue;
    }
    if (records.some(row => row.status === 'sent' && Number.isFinite(Date.parse(row.sent_at)) &&
        timestamp - Date.parse(row.sent_at) >= 0 && timestamp - Date.parse(row.sent_at) < SMS_COOLDOWN_DAYS * DAY_MS)) {
      blocked.push({ contact, reason: 'cooldown_7_days' }); continue;
    }
    eligible.push({ ...contact, normalized_phone: phone });
  }
  return { eligible, blocked, batches: Array.from({ length: Math.ceil(eligible.length / SMS_BATCH_SIZE) }, (_, i) =>
    eligible.slice(i * SMS_BATCH_SIZE, (i + 1) * SMS_BATCH_SIZE)) };
}

export function nextManualBatch(batches, processedPhones = []) {
  const processed = new Set(processedPhones.map(normalizeBrazilPhone).filter(Boolean));
  const pending = batches.flat().filter(c => !processed.has(c.normalized_phone));
  return pending.slice(0, SMS_BATCH_SIZE);
}
