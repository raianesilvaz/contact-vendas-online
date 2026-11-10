import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import { proto } from '@whiskeysockets/baileys';
import { installPersonalAttendance } from '../src/personal-attendance.js';

const ids = {alice:'11111111-1111-4111-8111-111111111111',bob:'22222222-2222-4222-8222-222222222222',partner:'33333333-3333-4333-8333-333333333333'};
const identityFor = owner => ids[owner === 'aliceOther' ? 'alice' : owner];
const tokenFor = owner => `${owner}.${Buffer.from(JSON.stringify({
  sub: identityFor(owner), session_id: owner === 'aliceOther' ? ids.partner : identityFor(owner)
})).toString('base64url')}.fixture`;
const delay = ms => new Promise(resolve => setTimeout(resolve,ms));

test('personal connector syncs recent conversations in memory and discards them at disconnect or CONTACT sign-out', async t => {
  const unexpected = [], sockets = [];
  const app=express();app.use(express.json());
  const fetchImpl=async (input, options) => {
    const url=new URL(input);
    if (url.pathname==='/auth/v1/user') {
      const id=identityFor(options.headers.Authorization.slice(7).split('.')[0]);
      return id?Response.json({id}):Response.json({}, {status:401});
    }
    if (url.pathname==='/rest/v1/profiles') {
      return Response.json([{role:url.searchParams.get('id').endsWith(ids.partner)?'parceiro':'vendedora',active:true}]);
    }
    unexpected.push(url.pathname);
    return Response.json({}, {status:500});
  };
  installPersonalAttendance(app,{supabaseUrl:'https://supabase.example.invalid',publishableKey:'test',fetchImpl},{
    idleMs: 750,
    getVersion:async()=>({version:[2,3000,0]}),
    makeSocket:options=>{
      const socket={options,ev:new EventEmitter(),sent:[],end(){socket.ended=true;},
        logout:async()=>{socket.loggedOut=true;},relayMessage:async (jid,body)=>socket.sent.push({jid,body})};
      sockets.push(socket);
      return socket;
    }
  });
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const root=`http://127.0.0.1:${server.address().port}/api/whatsapp/personal`;
  const call=async (owner,path,method='GET',body)=>{
    const response=await fetch(root+path,{method,headers:{Authorization:`Bearer ${tokenFor(owner)}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
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
  const history = proto.Message.HistorySyncNotification.HistorySyncType;
  assert.equal(alice.options.shouldSyncHistoryMessage({syncType:history.RECENT}),true);
  assert.equal(alice.options.shouldSyncHistoryMessage({syncType:history.FULL}),false);
  await until(async()=> (await call('alice','/status')).data.qr);
  assert.equal((await call('bob','/status?owner='+ids.alice)).data.qr,null);
  const jid='5511000000002@s.whatsapp.net';
  alice.ev.emit('messaging-history.set',{
    chats:[{id:jid,conversationTimestamp:1},{id:'999@g.us',name:'Grupo'}],
    contacts:[{id:jid,name:'Contato Teste'}],
    messages:[{key:{id:'old1',remoteJid:jid},message:{conversation:'Histórico fictício'},messageTimestamp:1},
      {key:{id:'group1',remoteJid:'999@g.us'},message:{conversation:'Mensagem de grupo'},messageTimestamp:1}]
  });
  alice.user={id:'5511000000001@s.whatsapp.net'};
  alice.ev.emit('connection.update',{connection:'open'});
  await until(async()=> (await call('alice','/status')).data.status==='connected');
  const historyResult=await call('alice','/status?jid='+encodeURIComponent(jid));
  assert.equal(historyResult.data.messages[0].body,'Histórico fictício');
  assert.deepEqual(historyResult.data.conversations.map(item=>item.name),['Contato Teste']);
  assert.deepEqual((await call('aliceOther','/status?jid='+encodeURIComponent(jid))).data.messages,[]);
  await call('aliceOther','/disconnect','POST');
  assert.equal((await call('alice','/status')).data.status,'connected');
  alice.ev.emit('messages.upsert',{type:'notify',messages:[{key:{id:'msg1',remoteJid:jid},message:{conversation:'Mensagem fictícia'},messageTimestamp:2,pushName:'Contato Teste'}]});
  const own=await until(async()=>{const x=await call('alice','/status?jid='+encodeURIComponent(jid));return x.data.messages?.length===2&&x.data;});
  assert.equal(own.messages.at(-1).body,'Mensagem fictícia');
  assert.deepEqual((await call('bob','/status?jid='+encodeURIComponent(jid))).data.messages,[]);
  assert.equal((await call('bob','/send','POST',{jid,message:'fixture'})).status,409);
  assert.equal((await call('alice','/send','POST',{jid,message:'Resposta fictícia'})).status,200);
  assert.equal(alice.sent.length,1);
  assert.equal(alice.sent[0].jid,jid);
  assert.equal((await call('alice','/status?jid='+encodeURIComponent(jid))).data.messages.at(-1).body,'Resposta fictícia');
  assert.equal((await call('bob','/disconnect','POST',{owner:ids.alice})).status,200);
  assert.equal((await call('alice','/status')).data.status,'connected');
  assert.equal((await call('alice','/disconnect','POST')).status,200);
  assert.equal(alice.loggedOut,true);
  assert.equal(await alice.options.getMessage({id:'anything',remoteJid:jid}),undefined);
  assert.deepEqual((await call('alice','/status')).data.conversations,[]);

  await call('alice','/connect','POST');
  const second=await until(()=>sockets[1]);
  second.user=alice.user;
  second.ev.emit('connection.update',{connection:'open'});
  assert.deepEqual((await call('alice','/status?jid='+encodeURIComponent(jid))).data.messages,[]);
  assert.equal((await call('bob','/signout','POST')).status,200);
  assert.equal((await call('alice','/status')).data.status,'connected');
  assert.equal((await call('aliceOther','/signout','POST')).status,200);
  assert.equal(second.loggedOut,true);
  assert.deepEqual((await call('alice','/status')).data.conversations,[]);

  await call('alice','/connect','POST');
  const idle=await until(()=>sockets[2]);
  idle.user=alice.user;
  idle.ev.emit('connection.update',{connection:'open'});
  for(let i=0;!idle.loggedOut&&i<50;i++)await delay(25);
  assert.equal(idle.loggedOut,true);
  assert.equal((await call('alice','/status')).data.status,'disconnected');
  assert.deepEqual(unexpected,[]);

});
