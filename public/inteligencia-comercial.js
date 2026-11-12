(()=>{
'use strict';
const $=id=>document.getElementById(id),fmt=n=>Number(n||0).toLocaleString('pt-BR'),day=x=>{const d=new Date(x);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sales=[],operators=new Map();const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function dates(){const today=new Date(),end=day(today),type=$('period').value;if(type==='today')return[end,end];if(type==='week'){today.setDate(today.getDate()-6);return[day(today),end]}if(type==='previous'){today.setDate(1);today.setDate(0);const last=day(today);today.setDate(1);return[day(today),last]}if(type==='custom')return[$('from').value||end,$('to').value||end];today.setDate(1);return[day(today),end]}
function barList(id,items){const max=Math.max(1,...items.map(x=>x.value));$(id).innerHTML=items.length?items.map(x=>'<div class="intel-bar"><span class="intel-bar-name" title="'+esc(x.name)+'">'+esc(x.name)+'</span><strong>'+fmt(x.value)+'</strong><div class="intel-track"><i style="width:'+(x.value/max*100)+'%"></i></div></div>').join(''):'<p style="color:#73858e;font-size:13px">Sem dados para este período.</p>'}
function cityOf(address){
const text=String(address||'').normalize('NFC').replace(/\s+/g,' ').trim();
if(!text)return '';
// Aceita somente campo CIDADE explicitamente rotulado; não deduz pelo CEP ou bairro.
const match=text.match(/\bCIDADE\s*[:=,-]?\s*([\p{L}][\p{L} .'-]{1,55}?)(?=\s*(?:[,;\/]|\bESTADO\b|\bUF\b|\bCEP\b|\bBAIRRO\b|\bN[ÚU]MERO\b|\d{5}[- ]?\d{3}\b|$))/iu);
if(!match)return '';
let city=match[1].trim().replace(/[-.,\s]+$/,'').replace(/\s*-\s*(?:SP|RJ|MG|PR|SC|RS|BA|GO|DF|ES|MS|MT|PA|PE|CE|MA|PB|RN|PI|AL|SE|TO|RO|RR|AP|AC|AM)\s*$/i,'').trim();
if(!city||city.length<3||/\d/.test(city)||/^(?:estado|cep|rua|bairro)$/i.test(city))return '';
return city.toLocaleLowerCase('pt-BR').replace(/(^|[\s'-])\p{L}/gu,x=>x.toLocaleUpperCase('pt-BR'));
}
function render(){
const [from,to]=dates(),op=$('operator').value;
if(from>to){$('intelStatus').textContent='A data inicial deve ser anterior à data final.';return}
const a=sales.filter(x=>{const d=day(x.created_at);return d>=from&&d<=to&&(!op||x.operator_id===op)});
const amounts=a.filter(x=>x.value!==null&&Number.isFinite(Number(x.value))).map(x=>Number(x.value));
const total=amounts.reduce((v,n)=>v+n,0);
$('kTotal').textContent=fmt(a.length);
$('kValue').textContent=money(total);
$('kTicket').textContent=amounts.length?money(total/amounts.length):'—';
$('kPlans').textContent=fmt(new Set(a.map(x=>String(x.plan_name||'').trim().toLocaleLowerCase('pt-BR')).filter(Boolean)).size);
const ops=new Map(),plans=new Map(),cities=new Map(),days=new Map();let unidentified=0;
a.forEach(x=>{
const k=x.operator_id||'sem-operadora',p=String(x.plan_name||'').trim()||'Não informado',d=day(x.created_at),city=cityOf(x.full_address);
ops.set(k,(ops.get(k)||0)+1);plans.set(p,(plans.get(p)||0)+1);
if(city)cities.set(city,(cities.get(city)||0)+1);else unidentified++;
days.set(d,(days.get(d)||0)+1);
});
barList('operators',[...ops].map(([id,value])=>({name:operators.get(id)||'Não informada',value})).sort((a,b)=>b.value-a.value));
barList('plans',[...plans].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,12));
barList('cities',[...cities].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,12));
const chart=$('trend');chart.replaceChildren();const keys=[...days.keys()].sort(),max=Math.max(1,...days.values());
if(!keys.length){chart.innerHTML='<p style="color:#73858e;font-size:13px">Sem cadastros neste período.</p>'}else{keys.forEach(d=>{const n=days.get(d),item=document.createElement('div');item.className='intel-day';item.title=d.split('-').reverse().join('/')+' — '+n+' cadastros';item.innerHTML='<i style="height:'+Math.max(3,n/max*155)+'px"></i><small>'+d.slice(8)+'</small>';chart.append(item)})}
$('intelStatus').textContent=fmt(a.length)+' cadastros no período • '+fmt(unidentified)+' sem cidade identificável • '+fmt(amounts.length)+' com valor informado.';
}
async function paged(table,columns){let all=[];for(let offset=0;offset<50000;offset+=1000){const {data,error}=await window.supabaseClient.from(table).select(columns).order('created_at',{ascending:false}).range(offset,offset+999);if(error)throw error;all.push(...(data||[]));if(!data||data.length<1000)break}return all}
async function names(table,ids,cols,target){for(let i=0;i<ids.length;i+=150){const {data,error}=await window.supabaseClient.from(table).select(cols).in('id',ids.slice(i,i+150));if(error)throw error;(data||[]).forEach(x=>target.set(x.id,x.full_name||x.name||'Não informado'))}}
async function init(){const user=await window.authReady;if(!user)return;if(user.profile?.role!=='admin'){location.replace('painel.html');return}
$('from').value=day(new Date());$('to').value=day(new Date());$('period').addEventListener('change',()=>{$('customDates').hidden=$('period').value!=='custom';render()});['operator','from','to'].forEach(id=>$(id).addEventListener('change',render));
try{sales=await paged('sales','id,operator_id,plan_name,value,full_address,created_at');await names('operators',[...new Set(sales.map(x=>x.operator_id).filter(Boolean))],'id,name',operators);[...operators].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR')).forEach(([id,name])=>$('operator').add(new Option(name,id)));render()}catch(err){console.error('Inteligência comercial:',err);$('intelStatus').textContent='Não foi possível carregar os indicadores. Verifique as permissões ou tente atualizar a página.'}}
$('menuButton')?.addEventListener('click',()=>$('sidebar').classList.toggle('open'));init();
})();