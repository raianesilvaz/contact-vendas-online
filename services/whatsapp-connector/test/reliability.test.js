import assert from 'node:assert/strict';
import test from 'node:test';
import { proto } from '@whiskeysockets/baileys';
import { useRemoteAuthState, decryptSession } from '../src/remote-auth-state.js';
import { useRetryMessageStore, createRetryCounterCache } from '../src/retry-message-store.js';
import { sendRecoverableText, serialSender } from '../src/reliable-text-send.js';
import { sessionRpc } from '../src/remote-session-rpc.js';

const config = { supabaseUrl:'https://example.supabase.co',publishableKey:'public',accessToken:'test',encryptionSecret:'8a'.repeat(32),sleep:async()=>{} };
const key = { id:'message-1',remoteJid:'5511000000000@s.whatsapp.net',fromMe:true };
function storage() {
  const objects = new Map();
  let failure = null;
  return { objects, fail(value) { failure=value; }, async fetch(url, options) {
    const body=JSON.parse(options.body),id=body.p_session_id;
    if (url.endsWith('contact_get_whatsapp_connector_session')) return Response.json(objects.get(id)||null);
    if (url.endsWith('contact_put_whatsapp_connector_session')) {
      if (failure) return new Response(null,{status:failure});
      objects.set(id,body.p_payload); return Response.json(null);
    }
    if (url.endsWith('contact_delete_whatsapp_connector_session')) { objects.delete(id);return Response.json(null); }
    throw Error('Unexpected RPC');
  }};
}
test('a failed key persistence does not poison later Signal key or credential writes', async()=>{
  const remote=storage(),store=await useRemoteAuthState({...config,fetchImpl:remote.fetch});
  remote.fail(503);
  await assert.rejects(store.state.keys.set({session:{first:Buffer.from('first')}}),/Falha ao salvar/);
  remote.fail(null);
  await store.state.keys.set({session:{second:Buffer.from('second')}});
  await store.saveCreds();
  const restored=await useRemoteAuthState({...config,fetchImpl:remote.fetch});
  assert.deepEqual(await restored.state.keys.get('session',['first','second']),{first:Buffer.from('first'),second:Buffer.from('second')});
});
test('RPC retries transient network and server errors but never invalid credentials', async()=>{
  let calls=0;
  const call=sessionRpc({...config,fetchImpl:async()=>{calls++;if(calls===1)throw Error('temporary network');if(calls===2)return new Response(null,{status:503});return Response.json('ok')}});
  assert.equal(await (await call('test')).json(),'ok');assert.equal(calls,3);
  calls=0;
  const denied=sessionRpc({...config,fetchImpl:async()=>{calls++;return new Response(null,{status:401})}});
  assert.equal((await denied('test')).status,401);assert.equal(calls,1);
});
test('exact protocol contents survive encrypted storage and process restart', async()=>{
  const remote=storage(),opts={...config,identity:'identity-one',fetchImpl:remote.fetch};
  const first=await useRetryMessageStore(opts);
  const content=proto.Message.fromObject({extendedTextMessage:{text:'Texto privado para recuperação',contextInfo:{stanzaId:'context-1'}}});
  await first.remember({key,message:content},['123456789@lid']);
  const payload=Buffer.from(remote.objects.get('primary-message-retry'),'base64');
  assert.equal(payload.includes(Buffer.from('Texto privado')),false);
  assert.equal(decryptSession(payload,config.encryptionSecret).messages.length,1);
  const restored=await useRetryMessageStore(opts);
  assert.deepEqual(proto.Message.encode(restored.get(key)).finish(),proto.Message.encode(content).finish());
  assert.equal(restored.get({...key,id:'unknown'}),undefined);
  assert.equal(restored.get({...key,remoteJid:'5511000000001@s.whatsapp.net'}),undefined);
  assert.ok(restored.get({...key,remoteJid:'5511000000000:4@s.whatsapp.net'}));
  assert.ok(restored.get({...key,remoteJid:'123456789@lid'}));
  assert.equal(restored.get({...key,remoteJid:'999999999@lid'}),undefined);
  const differentSession=await useRetryMessageStore({...opts,sessionId:'another'});
  assert.equal(differentSession.get(key),undefined);
  const differentIdentity=await useRetryMessageStore({...opts,identity:'new-pairing'});
  assert.equal(differentIdentity.get(key),undefined);
});
test('archive failure blocks network transmission, and a later successful write recovers', async()=>{
  const remote=storage(),store=await useRetryMessageStore({...config,identity:'id',fetchImpl:remote.fetch});
  let sends=0;
  const socket={user:{id:'5511999999999:1@s.whatsapp.net'},relayMessage:async()=>{sends++}};
  const generated={key,message:{extendedTextMessage:{text:'test'}}};
  remote.fail(503);
  await assert.rejects(sendRecoverableText(socket,store,key.remoteJid,'test',async()=>generated),/Falha ao guardar/);
  assert.equal(sends,0);
  remote.fail(null);
  await sendRecoverableText(socket,store,key.remoteJid,'test',async()=>generated);
  assert.equal(sends,1);
});
test('message is durably cached before relay, uses exact generated ID and fresh device discovery', async()=>{
  const remote=storage(),store=await useRetryMessageStore({...config,identity:'id',fetchImpl:remote.fetch});
  let relayed;
  const socket={user:{id:'5511999999999:1@s.whatsapp.net'},async relayMessage(jid,message,options){
    const restored=await useRetryMessageStore({...config,identity:'id',fetchImpl:remote.fetch});
    assert.ok(restored.get({remoteJid:jid,id:options.messageId}));
    assert.equal(options.useUserDevicesCache,false);
    assert.deepEqual(proto.Message.encode(restored.get({remoteJid:jid,id:options.messageId})).finish(),proto.Message.encode(message).finish());
    relayed={jid,message,options};
  }};
  // Real Baileys protocol generation, with a fake socket: no WhatsApp connection or send.
  const sent=await sendRecoverableText(socket,store,key.remoteJid,'Olá, mensagem de teste.');
  assert.equal(sent.key.id,relayed.options.messageId);
  assert.equal(sent.key.remoteJid,key.remoteJid);
  assert.equal(sent.key.fromMe,true);
});
test('message retention is bounded and clear prevents reuse of a logged-out archive', async()=>{
  const remote=storage();let clock=100;
  const opts={...config,identity:'id',fetchImpl:remote.fetch,now:()=>clock,maxEntries:2,ttlMs:100};
  const store=await useRetryMessageStore(opts);
  for(let n=1;n<=3;n++)await store.remember({key:{...key,id:'id-'+n},message:{conversation:'test'}});
  assert.equal(store.get({...key,id:'id-1'}),undefined);
  assert.ok(store.get({...key,id:'id-3'}));
  clock=201;assert.equal(store.get({...key,id:'id-3'}),undefined);
  await store.clear();assert.equal(remote.objects.has('primary-message-retry'),false);
  await assert.rejects(store.remember({key,message:{conversation:'test'}}),/encerrada/);
});
test('concurrent outbound operations are serialized, and one failure does not block later sends', async()=>{
  const enqueue=serialSender(),events=[];let release;
  const barrier=new Promise(resolve=>release=resolve);
  const a=enqueue(async()=>{events.push('first-start');await barrier;events.push('first-end');throw Error('first failed')});
  const b=enqueue(async()=>events.push('second'));
  await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(events,['first-start']);
  release();await assert.rejects(a,/first failed/);await b;
  assert.deepEqual(events,['first-start','first-end','second']);
});
test('retry counters survive socket reuse but expire and have bounded memory',()=>{
  let now=0;const cache=createRetryCounterCache({now:()=>now,ttlMs:100,maxEntries:2});
  cache.set('a',1);assert.equal(cache.get('a'),1);cache.set('b',2);cache.set('c',3);assert.equal(cache.get('a'),undefined);
  now=101;assert.equal(cache.get('b'),undefined);cache.flushAll();assert.equal(cache.get('c'),undefined);
});
