import assert from 'node:assert/strict';
import {test} from 'node:test';
import {smsCapabilityStatus} from '../worker/sms-capability.js';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public'};
const mock=(role='admin',active=true)=>async url=>{
  if(String(url).includes('/auth/v1/user'))return new Response(JSON.stringify({id:'user-1'}),{status:200});
  return new Response(JSON.stringify([{role,active}]),{status:200});
};
test('SMS capability denies unauthenticated requests',async()=>{
  const response=await smsCapabilityStatus(new Request('https://example.com/api/sms/capabilities'),env,mock());
  assert.equal(response.status,401);
});
test('SMS capability denies seller role',async()=>{
  const response=await smsCapabilityStatus(new Request('https://example.com/api/sms/capabilities',{headers:{Authorization:'Bearer token'}}),env,mock('vendedora'));
  assert.equal(response.status,403);
});
test('SMS capability denies inactive admin',async()=>{
  const response=await smsCapabilityStatus(new Request('https://example.com/api/sms/capabilities',{headers:{Authorization:'Bearer token'}}),env,mock('admin',false));
  assert.equal(response.status,403);
});
test('SMS capability is read-only and sending disabled for admin',async()=>{
  const request=new Request('https://example.com/api/sms/capabilities',{headers:{Authorization:'Bearer token'}});
  const response=await smsCapabilityStatus(request,env,mock());
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.send_enabled,false);
  assert.equal(data.batch_size,50);
  assert.equal(data.cooldown_days,7);
});
