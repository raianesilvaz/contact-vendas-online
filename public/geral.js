const tbody=document.querySelector('#generalTableBody');
let sales=[],reloadTimer=null,currentPeriod='month';

const statusNames={aguardando_analise:'Aguardando análise',em_analise:'Em análise',aguardando_hp:'Aguardando HP',aguardando_aceite:'Aceite pendente',pendente_instalacao:'Pendente de instalação',conectado:'Conectado',reprovada:'Reprovado',cancelada:'Cancelado'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const brDate=v=>{if(!v)return'—';const[y,m,d]=String(v).slice(0,10).split('-');return d&&m&&y?`${d}/${m}/${y}`:'—'};
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const localDate=value=>{if(!value)return null;const[y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d)};
const startOfDay=date=>new Date(date.getFullYear(),date.getMonth(),date.getDate());
const addDays=(date,days)=>{const copy=new Date(date);copy.setDate(copy.getDate()+days);return copy};
const toIsoStart=date=>startOfDay(date).toISOString();

function periodBounds(){
  const today=startOfDay(new Date());
  let start,end;
  if(currentPeriod==='today'){start=today;end=addDays(today,1)}
  else if(currentPeriod==='week'){const mondayOffset=(today.getDay()+6)%7;start=addDays(today,-mondayOffset);end=addDays(today,1)}
  else if(currentPeriod==='last7'){start=addDays(today,-6);end=addDays(today,1)}
  else if(currentPeriod==='month'){start=new Date(today.getFullYear(),today.getMonth(),1);end=new Date(today.getFullYear(),today.getMonth()+1,1)}
  else{
    const startValue=document.querySelector('#startDateFilter').value;
    const endValue=document.querySelector('#endDateFilter').value;
    if(!startValue||!endValue)return null;
    start=localDate(startValue);end=addDays(localDate(endValue),1);
    if(start>=end)return null;
  }
  return{start:toIsoStart(start),end:toIsoStart(end)};
}

function toast(message){const el=document.querySelector('#generalToast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3500)}
function fillOptions(id,values){const el=document.querySelector(id),current=el.value;el.innerHTML=el.options[0].outerHTML+[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');el.value=current}
function filtered(){const q=norm(document.querySelector('#searchFilter').value),status=document.querySelector('#statusFilter').value,operator=document.querySelector('#operatorFilter').value,seller=document.querySelector('#sellerFilter').value;return sales.filter(s=>(!q||norm([s.customer_name,s.cpf,s.contract_number,s.plan_name].join(' ')).includes(q))&&(!status||s.status===status)&&(!operator||s.operator?.name===operator)&&(!seller||s.seller?.full_name===seller))}
function render(){const rows=filtered();document.querySelector('#recordCount').textContent=`${rows.length} ${rows.length===1?'registro exibido':'registros exibidos'}`;document.querySelector('#sumTotal').textContent=rows.length;document.querySelector('#sumConnected').textContent=rows.filter(s=>s.status==='conectado').length;document.querySelector('#sumRejected').textContent=rows.filter(s=>s.status==='reprovada').length;document.querySelector('#sumCanceled').textContent=rows.filter(s=>s.status==='cancelada').length;document.querySelector('#sumPending').textContent=rows.filter(s=>!['conectado','reprovada','cancelada'].includes(s.status)).length;document.querySelector('#sumValue').textContent=money(rows.reduce((t,s)=>t+Number(s.value||0),0));if(!rows.length){tbody.innerHTML='<tr><td colspan="16" class="empty">Nenhuma venda encontrada para os filtros selecionados.</td></tr>';return}tbody.innerHTML=rows.map(s=>`<tr><td>${brDate(s.created_at)}</td><td title="${esc(s.customer_name)}">${esc(s.customer_name)}</td><td>${esc(s.cpf||'—')}</td><td><span class="status-pill status-${esc(s.status)}">${esc(statusNames[s.status]||s.status)}</span></td><td>${esc(s.contract_number||'—')}</td><td>${esc(s.operator?.name||'—')}</td><td>${brDate(s.scheduled_installation_date)}</td><td>${brDate(s.installation_date)}</td><td>${esc(s.seller?.full_name||'—')}</td><td>${esc(s.plan_name||'—')}</td><td>${money(s.value)}</td><td>Dia ${esc(s.due_day||'—')}</td><td class="${s.is_multi?'flag-yes':'flag-no'}">${s.is_multi?'Sim':'Não'}</td><td class="${s.mobile_activation_date?'flag-yes':'flag-no'}">${s.mobile_activation_date?brDate(s.mobile_activation_date):'Não'}</td><td class="${s.acceptance_completed?'flag-yes':'flag-no'}">${s.acceptance_completed?'Feito':'Pendente'}</td><td title="${esc(s.bko_return||'')}">${esc(s.bko_return||'—')}</td></tr>`).join('')}

async function load(){
  const bounds=periodBounds();
  if(!bounds){
    sales=[];
    render();
    tbody.innerHTML='<tr><td colspan="16" class="empty">Selecione a data inicial e a data final.</td></tr>';
    return;
  }
  tbody.innerHTML='<tr><td colspan="16" class="empty">Carregando vendas...</td></tr>';
  const{data,error}=await window.supabaseClient.from('sales').select('id,created_at,customer_name,cpf,status,contract_number,plan_name,value,due_day,is_multi,mobile_activation_date,acceptance_completed,bko_return,scheduled_installation_date,installation_date,seller:profiles!sales_seller_id_fkey(full_name),operator:operators(name)').gte('created_at',bounds.start).lt('created_at',bounds.end).order('created_at',{ascending:true}).limit(1000);
  if(error){tbody.innerHTML='<tr><td colspan="16" class="empty">Não foi possível carregar as vendas.</td></tr>';toast(error.message||'Erro ao carregar os dados.');return}
  sales=data||[];
  fillOptions('#statusFilter',sales.map(s=>statusNames[s.status]||s.status));
  const statusEl=document.querySelector('#statusFilter');
  [...statusEl.options].forEach(o=>{const key=Object.keys(statusNames).find(k=>statusNames[k]===o.value);if(key)o.value=key});
  fillOptions('#operatorFilter',sales.map(s=>s.operator?.name));
  fillOptions('#sellerFilter',sales.map(s=>s.seller?.full_name));
  render();
}

function selectPeriod(period){
  currentPeriod=period;
  document.querySelectorAll('[data-period]').forEach(button=>button.classList.toggle('active',button.dataset.period===period));
  document.querySelector('#customRange').hidden=period!=='custom';
  if(period!=='custom'||periodBounds())load();
  else{
    sales=[];
    render();
    tbody.innerHTML='<tr><td colspan="16" class="empty">Selecione a data inicial e a data final.</td></tr>';
  }
}

(async()=>{
  const user=await window.authReady;
  if(!user)return;
  if(user.profile.role!=='admin'){location.replace('vendas.html');return}
  document.querySelector('#menuButton')?.addEventListener('click',()=>document.querySelector('#sidebar')?.classList.toggle('open'));
  document.querySelectorAll('[data-period]').forEach(button=>button.addEventListener('click',()=>selectPeriod(button.dataset.period)));
  const startInput=document.querySelector('#startDateFilter'),endInput=document.querySelector('#endDateFilter');
  startInput.addEventListener('change',()=>{endInput.min=startInput.value;if(endInput.value&&endInput.value<startInput.value)endInput.value='';if(startInput.value&&endInput.value)load()});
  endInput.addEventListener('change',()=>{startInput.max=endInput.value;if(startInput.value&&endInput.value)load()});
  ['#searchFilter','#statusFilter','#operatorFilter','#sellerFilter'].forEach(id=>document.querySelector(id).addEventListener(id==='#searchFilter'?'input':'change',render));
  document.querySelector('#clearFilters').addEventListener('click',()=>{
    document.querySelector('#searchFilter').value='';
    document.querySelector('#statusFilter').value='';
    document.querySelector('#operatorFilter').value='';
    document.querySelector('#sellerFilter').value='';
    startInput.value='';endInput.value='';startInput.max='';endInput.min='';
    selectPeriod('month');
  });
  await load();
  window.supabaseClient.channel('geral-readonly').on('postgres_changes',{event:'*',schema:'public',table:'sales'},()=>{clearTimeout(reloadTimer);reloadTimer=setTimeout(load,600)}).subscribe();
})();