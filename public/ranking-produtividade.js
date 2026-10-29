(()=>{
'use strict';
const $=s=>document.querySelector(s),fmt=n=>Number(n||0).toLocaleString('pt-BR'),pct=n=>n.toFixed(1).replace('.',',')+'%';
const day=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
let sales=[],mode='month',user=null,teamSales=[],teamPeople=[],rankingMode='quality';
const isDone=s=>['conectado','reprovada'].includes(s.status);
function range(){const d=new Date(),today=day(d);if(mode==='today')return[today,today];if(mode==='week'){d.setDate(d.getDate()-6);return[day(d),today]}if(mode==='previous'){d.setDate(1);d.setDate(0);const end=day(d);d.setDate(1);return[day(d),end]}if(mode==='custom')return[$('#dateFrom').value||today,$('#dateTo').value||today];d.setDate(1);return[day(d),today]}
const inRange=(s,from,to)=>day(s.created_at)>=from&&day(s.created_at)<=to;
function drawChart(a){const [from,to]=range(),days=[];for(let d=new Date(from+'T12:00:00');d<=new Date(to+'T12:00:00')&&days.length<366;d.setDate(d.getDate()+1))days.push(day(d));const shown=days.filter((_,i)=>i%Math.max(1,Math.ceil(days.length/31))===0);const counts=shown.map(x=>({date:x,total:a.filter(s=>day(s.created_at)===x).length,connected:a.filter(s=>day(s.created_at)===x&&s.status==='conectado').length}));const max=Math.max(1,...counts.map(x=>x.total));$('#salesChart').innerHTML=counts.map(x=>'<div class="chart-col"><div class="chart-pair"><div class="chart-series"><strong>'+x.total+'</strong><div class="chart-bar" style="height:'+Math.max(3,155*x.total/max)+'px"></div></div><div class="chart-series"><strong>'+x.connected+'</strong><div class="chart-bar connected" style="height:'+Math.max(3,155*x.connected/max)+'px"></div></div></div><small>'+x.date.slice(8)+'/'+x.date.slice(5,7)+'</small></div>').join('')}
function render(){const [from,to]=range(),a=sales.filter(s=>s.status!=='cancelada'&&inRange(s,from,to)),connected=a.filter(s=>s.status==='conectado').length,rejected=a.filter(s=>s.status==='reprovada').length,pending=a.filter(s=>!isDone(s)).length,done=connected+rejected;
$('#kpiTotal').textContent=fmt(a.length);$('#kpiConnected').textContent=fmt(connected);$('#kpiPending').textContent=fmt(pending);$('#kpiConversion').textContent=done>=5?pct(100*connected/done):'Em avaliação';$('#kpiRejected').textContent=fmt(rejected);drawChart(a);
const [prevFrom,prevTo]=(()=>{const start=new Date(from+'T12:00:00'),end=new Date(to+'T12:00:00'),length=Math.round((end-start)/86400000)+1;start.setDate(start.getDate()-length);end.setDate(end.getDate()-length);return[day(start),day(end)]})();const prev=sales.filter(s=>s.status==='conectado'&&inRange(s,prevFrom,prevTo)).length;$('#comparison').textContent=prev?'Instalações: '+(connected>=prev?'+':'')+pct(100*(connected-prev)/prev)+' em relação ao período anterior.':'Instalações no período anterior: 0. Comparação percentual indisponível.';
const today=day(new Date()),todayInstall=sales.filter(s=>s.scheduled_installation_date===today&&!['conectado','cancelada','reprovada'].includes(s.status)).length,accept=sales.filter(s=>s.status==='pendente_aceite').length,stale=sales.filter(s=>!isDone(s)&&s.status!=='cancelada'&&Date.now()-new Date(s.created_at).getTime()>3*86400000).length;$('#priorityList').innerHTML=[['📅','Instalações previstas para hoje',todayInstall],['📋','Clientes aguardando aceite',accept],['⚠️','Vendas em andamento há mais de 3 dias',stale]].map(([icon,title,n])=>'<a class="personal-priority" href="vendas.html"><span>'+icon+' '+title+'</span><b>'+fmt(n)+' →</b></a>').join('');
const totalConnected=sales.filter(s=>s.status==='conectado').length,activeDays=new Set(a.map(s=>day(s.created_at))).size;const medals=[['🏅','Primeiras 10 instalações',totalConnected>=10,fmt(totalConnected)+'/10 conectadas'],['🔥','Constância',activeDays>=5,fmt(activeDays)+'/5 dias com cadastros no período'],['💎','Qualidade',done>=5&&connected/done>=.9,done>=5?pct(100*connected/done)+' de conversão':'Aguardando 5 vendas resolvidas']];$('#achievements').innerHTML=medals.map(([icon,title,earned,description])=>'<div class="achievement '+(earned?'earned':'')+'"><span>'+icon+'</span><div><strong>'+title+'</strong><small>'+description+'</small></div><b>'+(earned?'Conquistado':'Em progresso')+'</b></div>').join('');
renderSellerRanking();
$('#progressSummary').innerHTML='<div class="personal-progress"><span>Cadastros no período <b>'+fmt(a.length)+'</b></span><div><i style="width:100%"></i></div></div><div class="personal-progress"><span>Instalações concluídas <b>'+fmt(connected)+'</b></span><div><i style="width:'+(a.length?100*connected/a.length:0)+'%"></i></div></div><div class="personal-progress"><span>Vendas resolvidas <b>'+fmt(done)+'</b></span><div><i style="width:'+(a.length?100*done/a.length:0)+'%"></i></div></div>'}

const safe=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
async function fetchTeamRanking(){
  if(user.profile.role==='parceiro')return;
  const {data:people,error:peopleError}=await window.supabaseClient.from('profiles').select('id,full_name,role').eq('role','vendedora').eq('active',true).order('full_name');
  if(peopleError)throw peopleError;
  teamPeople=people||[];
  if(!teamPeople.length)return;
  // A consulta retorna somente indicadores necessários ao ranking, sem dados pessoais dos clientes.
  let offset=0;teamSales=[];
  while(true){
    const {data,error}=await window.supabaseClient.from('sales').select('seller_id,status,created_at').in('seller_id',teamPeople.map(p=>p.id)).order('created_at',{ascending:false}).range(offset,offset+999);
    if(error)throw error;
    teamSales.push(...(data||[]));
    if(!data||data.length<1000)break;
    offset+=1000;if(offset>=50000)break;
  }
  $('#sellerRankingSection').hidden=false;
  renderSellerRanking();
}
function renderSellerRanking(){
  if($('#sellerRankingSection').hidden)return;
  const [from,to]=range();
  const members=teamPeople.map(p=>{
    const items=teamSales.filter(s=>s.seller_id===p.id&&s.status!=='cancelada'&&inRange(s,from,to));
    const connected=items.filter(s=>s.status==='conectado').length,rejected=items.filter(s=>s.status==='reprovada').length;
    const done=connected+rejected,eligible=done>=5,conversion=done?100*connected/done:0;
    const days=new Set(items.map(s=>day(s.created_at))).size;
    return {id:p.id,name:p.full_name,total:items.length,connected,rejected,eligible,conversion,days};
  });
  const maxConnected=Math.max(1,...members.map(m=>m.connected));
  const maxDays=Math.max(1,Math.min(7,Math.round((new Date(to+'T12:00:00')-new Date(from+'T12:00:00'))/86400000)+1));
  members.forEach(m=>m.score=Math.round(40*m.connected/maxConnected+(m.eligible?50*m.conversion/100:0)+10*Math.min(1,m.days/maxDays)));
  const ranked=[...members];
  if(rankingMode==='quality')ranked.sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.conversion-a.conversion||b.connected-a.connected);
  else if(rankingMode==='production')ranked.sort((a,b)=>b.connected-a.connected||b.total-a.total);
  else ranked.sort((a,b)=>b.score-a.score||b.connected-a.connected);
  const positions=new Map();let place=0;
  ranked.forEach(m=>{if(rankingMode==='quality'&&!m.eligible)return;positions.set(m.id,++place)});
  const me=ranked.find(m=>m.id===user.id);
  const myPlace=positions.get(user.id);
  $('#myRankBanner').hidden=user.profile.role!=='vendedora';
  if(user.profile.role==='vendedora')$('#myRankBanner').innerHTML=myPlace?'<strong>🏆 Sua posição: '+myPlace+'º lugar</strong><span>Você está entre '+place+' vendedores classificados neste período.</span>':'<strong>💎 Você está em avaliação</strong><span>São necessárias 5 vendas resolvidas para entrar no ranking de qualidade.</span>';
  $('#sellerRankingRows').innerHTML=ranked.map(m=>{
    const position=positions.get(m.id),label=position?(position===1?'🥇':position===2?'🥈':position===3?'🥉':position+'º'):'—';
    return '<div class="ranking-row'+(m.id===user.id?' is-me':'')+'"><span><b class="rank-medal">'+label+'</b><b>'+safe(m.name)+'</b>'+(m.id===user.id?'<small>Você</small>':'')+'</span><span>'+fmt(m.total)+'</span><span>'+fmt(m.connected)+'</span><span>'+fmt(m.rejected)+'</span><span>'+(m.eligible?pct(m.conversion):'Em avaliação')+'</span><strong>'+(rankingMode==='quality'&&!m.eligible?'—':m.score+'/100')+'</strong></div>';
  }).join('');
}

async function init(){user=await window.authReady;if(!user)return;if(!['vendedora','parceiro','admin'].includes(user.profile.role)){location.replace('painel.html');return}let offset=0;try{if(user.profile.role!=='parceiro')fetchTeamRanking().catch(e=>{console.error('Ranking vendedores:',e);$('#sellerRankingSection').hidden=false;$('#sellerRankingRows').innerHTML='<div class="dashboard-empty-box">Não foi possível carregar a classificação neste momento.</div>'});if(user.profile.role==='admin'){const {data:people,error:peopleError}=await window.supabaseClient.from('profiles').select('id,full_name,role').in('role',['vendedora','parceiro']).eq('active',true).order('full_name');if(peopleError)throw peopleError;const selector=$('#adminSellerSelect');(people||[]).forEach(p=>selector.add(new Option(p.full_name+' ('+(p.role==='parceiro'?'Parceiro':'Vendedor')+')',p.id)));$('#adminSellerLabel').hidden=false;selector.addEventListener('change',()=>loadSales(selector.value));await loadSales(selector.value);return;}await loadSales(user.id)}catch(e){console.error(e);$('#priorityList').textContent='Não foi possível carregar seus dados. Atualize a página.'}}
async function loadSales(sellerId){sales=[];let offset=0;try{while(true){let query=window.supabaseClient.from('sales').select('id,status,created_at,scheduled_installation_date,seller_id');if(sellerId)query=query.eq('seller_id',sellerId);const {data,error}=await query.order('created_at',{ascending:false}).range(offset,offset+999);if(error)throw error;sales.push(...(data||[]));if(!data||data.length<1000)break;offset+=1000;if(offset>=50000)break}render()}catch(e){console.error(e);$('#priorityList').textContent='Não foi possível carregar seus dados. Atualize a página.'}}
const today=day(new Date());$('#dateFrom').value=today;$('#dateTo').value=today;$('#periodTabs').addEventListener('click',e=>{const b=e.target.closest('[data-period]');if(!b)return;mode=b.dataset.period;$('#periodTabs').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));$('#customPeriod').hidden=mode!=='custom';if(mode!=='custom')render()});$('#applyPeriod').addEventListener('click',render);$('#sellerRankingTabs').addEventListener('click',e=>{const b=e.target.closest('[data-rank]');if(!b)return;rankingMode=b.dataset.rank;$('#sellerRankingTabs').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));renderSellerRanking()});init();
})();