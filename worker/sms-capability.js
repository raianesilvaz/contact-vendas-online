// Safe, read-only SMS capability status. No recipient data or credentials.
export function smsCapabilityStatus(request) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({error:'method_not_allowed'}),{status:405,headers:{'content-type':'application/json; charset=utf-8','allow':'GET','cache-control':'no-store'}});
  }
  return new Response(JSON.stringify({
    mode:'manual',
    batch_size:50,
    cooldown_days:7,
    persistence_ready:false,
    provider_connected:false,
    send_enabled:false,
    reason:'Histórico persistente, autorização e integração segura ainda não configurados'
  }),{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
