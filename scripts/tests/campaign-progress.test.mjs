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
function runner({pauseDuringSend=false,cancelBeforeSend=false}={}){
 const updates=[],timers=[],phases=[];let requests=0;
 const state={id:'fixture-run',items:[{id:'recipient',sale_id:'sale',status:'waiting',phone:'fixture'}],index:0,interval:30,source:new Map([['sale',{}]])};
 const sandbox={activeRun:state,sendTimer:null,WA:'https://fixture.invalid',historyLoaded:true,Date,Map,Error,clearTimeout:()=>{},setTimeout:(fn,delay)=>{timers.push(delay);return 1},runModal:()=>phases.push(state.items[0].status),markSentToday:()=>{},eligibleNow:async()=>true,alreadySent:async()=>false,fetch:async()=>{requests++;if(pauseDuringSend)state.paused=true;return {ok:true,json:async()=>({messageId:'fixture-message'})}},window:{contactCollections:{message:()=>'fixture message'},ContactCampaignProgress:report,supabaseClient:{auth:{getSession:async()=>{if(cancelBeforeSend){state.done=true;state.cancelled=true;}return {data:{session:{access_token:'fixture-token'}}}}},from:table=>({update:values=>({eq:async()=>{updates.push({table,values});return {error:null}}})})}}};
 vm.createContext(sandbox);vm.runInContext(finish+'\n'+process,sandbox);
 return {state,updates,timers,phases,get requests(){return requests},run:()=>sandbox.processRun()};
}
test('last message completes immediately even if paused while request is in flight',async()=>{
 const r=runner({pauseDuringSend:true});await r.run();assert.equal(r.requests,1);assert.equal(r.state.done,true);assert.equal(r.state.paused,false);assert.equal(r.timers.length,0);assert.ok(r.updates.some(x=>x.table==='campaign_runs'&&x.values.status==='completed'));assert.ok(r.phases.includes('sending'));
});
test('concurrent process calls cannot send the same recipient twice',async()=>{
 const r=runner();await Promise.all([r.run(),r.run()]);assert.equal(r.requests,1);assert.equal(r.state.items[0].status,'sent');
});
test('cancellation before the HTTP request prevents sending',async()=>{
 const r=runner({cancelBeforeSend:true});await r.run();assert.equal(r.requests,0);assert.equal(r.state.items[0].status,'cancelled');assert.equal(r.timers.length,0);
});
