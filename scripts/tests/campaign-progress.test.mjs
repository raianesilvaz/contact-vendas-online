import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import '../../public/campaign-progress.js';
const report=globalThis.ContactCampaignProgress;
test('a paused recipient list with no pending messages is settled, not still sending',()=>{
 const s=report.summarize([{status:'sent'}],1);assert.equal(s.settled,true);assert.equal(s.sent,1);assert.equal(s.waiting,0);assert.equal(s.percent,100);
});
test('progress separates errors, in-flight and missing recipient records',()=>{
 const s=report.summarize([{status:'sent'},{status:'error'},{status:'sending'},{status:'waiting'},{status:'cancelled'}],6);
 assert.deepEqual([s.sent,s.errors,s.sending,s.waiting,s.cancelled,s.processed],[1,1,1,2,1,3]);assert.equal(s.settled,false);
 assert.equal(report.summarize([],1).settled,false);
});
const source=readFileSync(new URL('../../public/cobrancas-central.js',import.meta.url),'utf8');
const finish=source.slice(source.indexOf('async function completeRun('),source.indexOf('async function startCampaign('));
const process=source.slice(source.indexOf('async function processRun('),source.indexOf('window.contactCampaignExecution='));
function runner({pauseDuringSend=false,cancelBeforeSend=false,finishFails=false}={}){
 const updates=[],timers=[],phases=[];let requests=0,finalizations=0;
 const state={id:'fixture-run',items:[{id:'recipient',sale_id:'sale',status:'waiting',phone:'fixture'}],index:0,interval:30,source:new Map([['sale',{}]])};
 const sandbox={activeRun:state,sendTimer:null,WA:'https://fixture.invalid',historyLoaded:true,Date,Map,Error,clearTimeout:()=>{},setTimeout:(fn,delay)=>{timers.push(delay);return 1},runModal:()=>phases.push(state.items[0].status),markSentToday:()=>{},eligibleNow:async()=>true,alreadySent:async()=>false,fetch:async()=>{requests++;if(pauseDuringSend)state.paused=true;return {ok:true,json:async()=>({messageId:'fixture-message'})}},window:{ContactCampaignFinalizer:{finish:async()=>{finalizations++;if(finishFails)throw Error('fixture offline');return {status:'completed'}}},contactCollections:{message:()=>'fixture message'},ContactCampaignProgress:report,supabaseClient:{auth:{getSession:async()=>{if(cancelBeforeSend){state.done=true;state.cancelled=true;}return {data:{session:{access_token:'fixture-token'}}}}},from:table=>({update:values=>({eq:async()=>{updates.push({table,values});return {error:null}}})})}}};
 vm.createContext(sandbox);vm.runInContext(finish+'\n'+process,sandbox);
 return {state,updates,timers,phases,get requests(){return requests},get finalizations(){return finalizations},retry:()=>sandbox.completeRun(state),run:()=>sandbox.processRun()};
}
test('last message completes immediately even if paused while request is in flight',async()=>{
 const r=runner({pauseDuringSend:true});await r.run();assert.equal(r.requests,1);assert.equal(r.state.done,true);assert.equal(r.state.paused,false);assert.equal(r.timers.length,0);assert.equal(r.finalizations,1);assert.equal(r.state.completionConfirmed,true);assert.ok(r.phases.includes('sending'));
});
test('concurrent process calls cannot send the same recipient twice',async()=>{
 const r=runner();await Promise.all([r.run(),r.run()]);assert.equal(r.requests,1);assert.equal(r.state.items[0].status,'sent');
});
test('cancellation before the HTTP request prevents sending',async()=>{
 const r=runner({cancelBeforeSend:true});await r.run();assert.equal(r.requests,0);assert.equal(r.state.items[0].status,'cancelled');assert.equal(r.timers.length,0);
});

test('failed confirmation releases sending state and retry never resends',async()=>{
 const r=runner({finishFails:true});await r.run();assert.equal(r.state.done,true);assert.equal(r.state.finalizing,false);assert.match(r.state.syncError,/fixture offline/);await r.retry();assert.equal(r.finalizations,2);assert.equal(r.requests,1);assert.equal(r.timers.length,0);
});
test('manual completion cannot skip a pending recipient',async()=>{
 const r=runner();await r.retry();assert.equal(r.finalizations,0);assert.equal(r.state.done,undefined);assert.match(r.state.syncError,/aguardando/);
});
test('confirmation timeout clears pending UI and uses only the safe RPC',async()=>{
 let expire,cleared=false,calls=0;const box={window:{supabaseClient:{rpc:(name,args)=>{calls++;assert.equal(name,'finish_processed_campaign');assert.equal(args.p_run_id,'fixture');return new Promise(()=>{});}}},setTimeout:fn=>{expire=fn;return 1;},clearTimeout:()=>{cleared=true;},Error,Promise};
 vm.createContext(box);vm.runInContext(readFileSync(new URL('../../public/campaign-finalizer.js',import.meta.url),'utf8'),box);
 const result=box.window.ContactCampaignFinalizer.finish('fixture');expire();await assert.rejects(result,/nenhuma mensagem será reenviada/);assert.equal(calls,1);assert.equal(cleared,true);
});
const legacy=readFileSync(new URL('../../public/campanhas.js',import.meta.url),'utf8');
function legacyRunner({finishFails=false}={}){
 let sends=0,finishes=0;const state={run:{id:'fixture',message_template:'fixture'},items:[{id:'recipient',status:'waiting'}],index:0,interval:30};
 const box={runState:state,runTimer:null,prepared:null,WA:'https://fixture.invalid',token:async()=>'',msg:()=>'',chooseMessage:()=>'',fetch:async()=>{sends++;return {ok:true,json:async()=>({})};},Date,Error,showCompleted:()=>{},showRun:()=>{},clearTimeout:()=>{},setTimeout:()=>{throw Error('Unexpected last interval');},window:{ContactCampaignFinalizer:{finish:async()=>{finishes++;if(finishFails)throw Error('offline');}},supabaseClient:{from:()=>({update:()=>({eq:async()=>({error:null})})})}}};
 vm.createContext(box);vm.runInContext(legacy.slice(legacy.indexOf('async function finishLegacyRun('),legacy.indexOf('function result(')),box);
 return {state,run:()=>box.processNext(),retry:()=>box.finishLegacyRun(),get sends(){return sends},get finishes(){return finishes}};
}
test('standalone campaign finishes immediately and prevents overlapping sends',async()=>{
 const r=legacyRunner();await Promise.all([r.run(),r.run()]);assert.equal(r.sends,1);assert.equal(r.finishes,1);assert.equal(r.state.completionConfirmed,true);assert.equal(r.state.done,true);
});
test('standalone campaign confirmation retry never sends again',async()=>{
 const r=legacyRunner({finishFails:true});await r.run();assert.equal(r.state.done,true);assert.equal(r.state.finalizing,false);await r.retry();assert.equal(r.sends,1);assert.equal(r.finishes,2);
});
