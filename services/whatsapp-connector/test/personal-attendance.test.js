import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import { installPersonalAttendance } from '../src/personal-attendance.js';

const ids = {alice:'11111111-1111-4111-8111-111111111111',bob:'22222222-2222-4222-8222-222222222222',partner:'33333333-3333-4333-8333-333333333333'};
const delay = ms => new Promise(resolve => setTimeout(resolve,ms));

test('personal connector binds QR, storage, messages and disconnect to the verified owner', async t => {
  const documents = new Map(), sockets = [];
  const app=express();app.use(express.json());
  const fetchImpl=async (input, options) => {
    const url=new URL(input);
    if (url.pathname==='/auth/v1/user') {
      const id=ids[options.headers.Authorization.slice(7)];
      return id?Response.json({id}):Response.json({}, {status:401});
    }
    if (url.pathname==='/rest/v1/profiles') {
      return Response.json([{role:url.searchParams.get('id').endsWith(ids.partner)?'parceiro':'vendedora',active:true}]);
    }
    const {p_session_id:id,p_payload:value}=JSON.parse(options.body);
    if(url.pathname.endsWith('/contact_get_whatsapp_connector_session'))return Response.json(documents.get(id)||null);
    if(url.pathname.endsWith('/contact_put_whatsapp_connector_session'))documents.set(id,value);
    else if(url.pathname.endsWith('/contact_delete_whatsapp_connector_session'))documents.delete(id);
    else assert.fail(url.pathname);
    return Response.json(null);
  };
  installPersonalAttendance(app,{supabaseUrl:'https://supabase.example.invalid',publishableKey:'test',accessToken:'fixture',encryptionSecret:'a'.repeat(64),fetchImpl},{
    getVersion:async()=>({version:[2,3000,0]}),
    makeSocket:()=>{const socket={ev:new EventEmitter(),sent:[],end(){},logout:async()=>{socket.loggedOut=true;},relayMessage:async (jid,body)=>socket.sent.push({jid,body})};sockets.push(socket);return socket;}
  });
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const root=`http://127.0.0.1:${server.address().port}/api/whatsapp/personal`;
  const call=async (owner,path,method='GET',body)=>{
    const response=await fetch(root+path,{method,headers:{Authorization:`Bearer ${owner}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
    return {status:response.status,data:await response.json()};
  };
  async function until(operation) {
    for(let i=0;i<50;i++){const result=await operation();if(result)return result;await delay(10);}
    assert.fail('Estado esperado não apareceu');
  }
  assert.equal((await call('partner','/connect','POST')).status,403);
  assert.equal((await call('unknown','/connect','POST')).status,401);
  assert.equal((await call('alice','/connect','POST',{userId:ids.bob})).status,202);
  const alice=await until(()=>sockets[0]);alice.ev.emit('connection.update',{qr:'fictitious-qr'});
  await until(async()=> (await call('alice','/status')).data.qr);
  assert.equal((await call('bob','/status?owner='+ids.alice)).data.qr,null);
  alice.user={id:'5511000000001@s.whatsapp.net'};
  alice.ev.emit('connection.update',{connection:'open'});
  await until(async()=> (await call('alice','/status')).data.status==='connected');
  const jid='5511000000002@s.whatsapp.net';
  alice.ev.emit('messages.upsert',{type:'notify',messages:[{key:{id:'msg1',remoteJid:jid},message:{conversation:'Mensagem fictícia'},messageTimestamp:1,pushName:'Contato Teste'}]});
  const own=await until(async()=>{const x=await call('alice','/status?jid='+encodeURIComponent(jid));return x.data.messages?.length&&x.data;});
  assert.equal(own.messages[0].body,'Mensagem fictícia');
  assert.deepEqual((await call('bob','/status?jid='+encodeURIComponent(jid))).data.messages,[]);
  assert.ok(documents.has(`atendimento-individual-${ids.alice}-inbox`));
  assert.equal((await call('bob','/send','POST',{jid,message:'fixture'})).status,409);
  assert.equal((await call('alice','/send','POST',{jid,message:'Resposta fictícia'})).status,200);
  assert.equal(alice.sent.length,1);
  assert.equal(alice.sent[0].jid,jid);
  assert.equal((await call('alice','/status?jid='+encodeURIComponent(jid))).data.messages.at(-1).body,'Resposta fictícia');
  assert.equal((await call('bob','/disconnect','POST',{owner:ids.alice})).status,200);
  assert.equal((await call('alice','/status')).data.status,'connected');
  assert.equal((await call('alice','/disconnect','POST')).status,200);
  assert.equal(alice.loggedOut,true);
  assert.equal(documents.has(`atendimento-individual-${ids.alice}-inbox`),false);
});
