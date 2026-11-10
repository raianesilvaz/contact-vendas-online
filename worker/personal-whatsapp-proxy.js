const methods = {status:'GET',connect:'POST',disconnect:'POST',send:'POST'};
const connector = 'https://contact-whatsapp.onrender.com';

export async function personalWhatsAppProxy(request, action, fetchApi = fetch) {
  const headers = { 'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff' };
  const error = (status, message) => Response.json({error:message},{status,headers});
  if (!Object.hasOwn(methods, action)) return error(404,'Operação desconhecida.');
  if (request.method !== methods[action]) return error(405,'Método não permitido.');
  const authorization = request.headers.get('Authorization');
  if (!authorization?.match(/^Bearer [^\s]+$/i)) return error(401,'Entre no CONTACT.');
  const target = new URL(`${connector}/api/whatsapp/personal/${action}`);
  const jid = new URL(request.url).searchParams.get('jid');
  if (action==='status'&&jid) target.searchParams.set('jid',jid);
  let body;
  if (action==='send') {
    const reader = request.body?.getReader();
    if (!reader) return error(400,'Mensagem inválida.');
    let size = 0, raw = '';
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 16384) { await reader.cancel(); return error(413,'Mensagem muito grande.'); }
        raw += decoder.decode(chunk.value,{stream:true});
      }
      raw += decoder.decode();
    } catch { return error(400,'Mensagem inválida.'); }
    let value;
    try { value = JSON.parse(raw); } catch { return error(400,'Mensagem inválida.'); }
    if (!value || typeof value.message!=='string' || value.message.length>2000) return error(400,'Mensagem inválida.');
    body=JSON.stringify({message:value.message,jid:String(value.jid||'').slice(0,60),phone:String(value.phone||'').slice(0,30)});
  }
  try {
    const upstream = await fetchApi(target,{method:request.method,body,
      headers:{Authorization:authorization,'Content-Type':'application/json'},signal:AbortSignal.timeout(50_000),redirect:'error'});
    if (!upstream.headers.get('content-type')?.includes('application/json')) return error(503,'A conexão do WhatsApp está indisponível. Tente novamente.');
    return new Response(upstream.body,{status:upstream.status,headers});
  } catch {
    return error(503,'O conector do WhatsApp demorou a responder. Tente novamente.');
  }
}
