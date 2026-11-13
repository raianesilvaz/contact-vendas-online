// Read-only SMS status; all send routes remain disabled.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
export async function verifySmsAdmin(request, env, fetchApi=fetch) {
  const authorization=request.headers.get('Authorization');
  if (!/^Bearer [^\\s]+$/i.test(authorization||'')) return {error:json({error:'authentication_required'},401)};
  if (!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY) return {error:json({error:'auth_unavailable'},503)};
  const headers={Authorization:authorization,apikey:env.SUPABASE_PUBLISHABLE_KEY};
  try {
    const identity=await fetchApi(env.SUPABASE_URL+'/auth/v1/user',{headers});
    if (!identity.ok) return {error:json({error:'invalid_session'},identity.status===401?401:503)};
    const user=await identity.json();
    if (!user?.id) return {error:json({error:'invalid_session'},401)};
    const profileUrl=new URL(env.SUPABASE_URL+'/rest/v1/profiles');
    profileUrl.search=new URLSearchParams({select:'role,active',id:'eq.'+user.id,limit:'1'});
    const result=await fetchApi(profileUrl,{headers});
    if (!result.ok) return {error:json({error:'profile_unavailable'},503)};
    const profiles=await result.json();
    if (!Array.isArray(profiles)||profiles[0]?.active!==true||profiles[0]?.role!=='admin') return {error:json({error:'forbidden'},403)};
    return {userId:user.id};
  } catch {return {error:json({error:'auth_unavailable'},503)};}
}
export async function smsCapabilityStatus(request,env,fetchApi=fetch) {
  if(request.method!=='GET') return json({error:'method_not_allowed'},405);
  const auth=await verifySmsAdmin(request,env,fetchApi);
  if(auth.error)return auth.error;
  return json({mode:'manual',batch_size:50,cooldown_days:7,persistence_ready:false,provider_connected:false,send_enabled:false,reason:'Histórico e reserva segura ainda não integrados ao servidor'});
}
