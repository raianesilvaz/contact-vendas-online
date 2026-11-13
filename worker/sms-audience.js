import {verifySmsAdmin} from './sms-capability.js';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
function normalize(value){
 let d=String(value??'').replace(/\D/g,'');
 if(d.startsWith('55')&&(d.length===12||d.length===13))d=d.slice(2);
 return /^[1-9][0-9][1-9][0-9][0-9]{6,7}$/.test(d)?'55'+d:null;
}
async function queryAll(url,headers,fetchApi){
 const result=[];let offset=0;
 while(true){
  if(offset>=100000)throw Error('too_many_records');
  const page=new URL(url);page.searchParams.set('limit','1000');page.searchParams.set('offset',String(offset));
  const response=await fetchApi(page.toString(),{headers});
  if(!response.ok)throw Error('data_unavailable');
  const rows=await response.json();
  if(!Array.isArray(rows))throw Error('invalid_data');
  result.push(...rows);
  if(rows.length<1000)return result;
  offset+=1000;
 }
}
export async function smsAudienceSummary(request,env,fetchApi=fetch){
 if(request.method!=='GET')return json({error:'method_not_allowed'},405);
 const auth=await verifySmsAdmin(request,env,fetchApi);
 if(auth.error)return auth.error;
 // This endpoint cannot work until the service-role secret is configured server-side.
 // Never send this secret to the browser. No write operations and no SMS sends.
 if(!env.SUPABASE_SERVICE_ROLE_KEY)return json({error:'sms_backend_not_configured'},503);
 const base=env.SUPABASE_URL;
 const publicHeaders={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY};
 const privateHeaders={...publicHeaders,'Accept-Profile':'contact_sms_private'};
 try{
  const [manual,leads,permissions,suppression,history]=await Promise.all([
   queryAll(base+'/rest/v1/contact_manual?select=id,phone',publicHeaders,fetchApi),
   queryAll(base+'/rest/v1/contact_leads?select=phone',publicHeaders,fetchApi),
   queryAll(base+'/rest/v1/permissions?select=phone_e164,allowed',privateHeaders,fetchApi),
   queryAll(base+'/rest/v1/suppression?select=phone_e164',privateHeaders,fetchApi),
   queryAll(base+'/rest/v1/recipients?select=phone_e164,status,sent_at',privateHeaders,fetchApi)
  ]);
  const unique=new Set();let invalid=0,duplicates=0;
  for(const row of [...manual,...leads]){
   const phone=normalize(row.phone);
   if(!phone){invalid++;continue;}
   if(unique.has(phone)){duplicates++;continue;}
   unique.add(phone);
  }
  const permitted=new Set(permissions.filter(p=>p.allowed===true).map(p=>p.phone_e164));
  const excluded=new Set(suppression.map(p=>p.phone_e164));
  const now=Date.now(),cooldown=new Set(),unresolved=new Set();
  for(const row of history){
   if(['reserved','sending','unknown'].includes(row.status))unresolved.add(row.phone_e164);
   if(row.status==='sent'&&row.sent_at&&now-Date.parse(row.sent_at)>=0&&now-Date.parse(row.sent_at)<7*86400000)cooldown.add(row.phone_e164);
  }
  let eligible=0,withoutPermission=0,suppressed=0,held=0;
  for(const phone of unique){
   if(excluded.has(phone)){suppressed++;continue;}
   if(!permitted.has(phone)){withoutPermission++;continue;}
   if(cooldown.has(phone)||unresolved.has(phone)){held++;continue;}
   eligible++;
  }
  return json({total_unique:unique.size,invalid,duplicates,eligible,without_permission:withoutPermission,suppressed,held,batches:Math.ceil(eligible/50),send_enabled:false,source_counts:{manual:manual.length,leads:leads.length}});
 }catch{return json({error:'sms_data_unavailable'},503);}
}
