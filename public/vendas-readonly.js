let sales=[],filter='todos',selectedId=null,realtimeChannel=null,realtimeRefreshTimer=null,periodStart='',periodEnd='',responsibleFilter='all',currentSalesUser=null;const list=document.querySelector('#salesList'),detail=document.querySelector('#detailPanel'),search=document.querySelector('#saleSearch'),tabs=document.querySelector('#filterTabs'),emptyList=document.querySelector('#emptyList'),overlay=document.querySelector('#mobileOverlay');const labels={reprovada:'Reprovado',conectado:'Conectado',pendente_aceite:'Aceite pendente',pendente_instalacao:'Pendente de instalação',aguardando_hp:'Aguardando HP',cancelada:'Cancelado',pendente:'Aguardando análise',em_analise:'Em análise'},cssStatus={pendente:'analise',em_analise:'analise',aguardando_hp:'analise',pendente_aceite:'aceite',pendente_instalacao:'aceite',conectado:'conectado',reprovada:'reprovada',cancelada:'reprovada'};const escapeHtml=value=>String(value??'').replace(/[&<>'\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt',"'":'&#39;','\"':'&quot;'}[char])),normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),formatCpf=value=>String(value).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4'),formatPhone=value=>{if(!value)return'Não informado';const d=String(value);return d.length===11?d.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3'):d.replace(/(\d{2})(\d{4})(\d{4})/,'($1) $2-$3')},formatDate=value=>value?new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR'):'Não informado',formatDateTime=value=>new Date(value).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}),formatMoney=value=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),todayKey=()=>new Date().toISOString().slice(0,10);

const salesPageSize = 10;
let salesPage = 1, salesTotal = 0, salesRequest = 0, salesSearchTimer;
const salesPager = document.createElement('nav');
salesPager.className = 'pagination'; salesPager.setAttribute('aria-label','Páginas de vendas');
const salesRange = document.createElement('p'); salesRange.className = 'result-range';
list.after(salesPager, salesRange);
function salesBaseQuery(columns, options, includeSearch = true) {
  let query = window.supabaseClient.from('sales').select(columns, options);
  if (responsibleFilter !== 'all') query = query.eq('seller_id', responsibleFilter);
  if (periodStart && periodEnd) {
    const start = new Date(periodStart + 'T00:00:00'), end = new Date(periodEnd + 'T00:00:00');
    end.setDate(end.getDate() + 1);
    query = query.gte('created_at', start.toISOString()).lt('created_at', end.toISOString());
  }
  const term = search.value.trim().replace(/[,%()_*]/g,' ').trim();
  if (includeSearch && term) {
    const conditions = ['customer_name','plan_name','contract_number'].map(field => field + '.ilike.%' + term + '%');
    const digits = term.replace(/\D/g,'');
    if (digits) conditions.push('cpf.ilike.%' + digits + '%');
    if (/^\d+$/.test(term) && Number.isSafeInteger(Number(term))) conditions.push('protocol.eq.' + term);
    query = query.or(conditions.join(','));
  }
  return query;
}
function renderSalesPager() {
  const pages = Math.max(1,Math.ceil(salesTotal / salesPageSize));
  salesPager.hidden = pages <= 1;
  const numbers = new Set([1,pages]);
  for (let page=Math.max(1,salesPage-2);page<=Math.min(pages,salesPage+2);page++) numbers.add(page);
  let previous=0;
  const buttons=[...numbers].sort((a,b)=>a-b).map(page=>{
    const gap=previous&&page>previous+1?'<span>…</span>':'';
    previous=page;
    return gap+'<button type="button" data-page="'+page+'" class="'+(page===salesPage?'active':'')+'" '+(page===salesPage?'aria-current="page"':'')+'>'+page+'</button>';
  }).join('');
  salesPager.innerHTML='<button type="button" data-page="'+(salesPage-1)+'" '+(salesPage===1?'disabled':'')+' aria-label="Página anterior">‹</button>'+buttons+'<button type="button" data-page="'+(salesPage+1)+'" '+(salesPage===pages?'disabled':'')+' aria-label="Próxima página">›</button>';
  salesRange.textContent=salesTotal?'Mostrando '+((salesPage-1)*salesPageSize+1)+'–'+Math.min(salesPage*salesPageSize,salesTotal)+' de '+salesTotal+' vendas':'';
}
function requestSalesPage() { salesPage=1; closeDetail(); loadSales(); }
salesPager.addEventListener('click',event=>{
  const button=event.target.closest('button[data-page]');
  if (!button || button.disabled) return;
  salesPage=Number(button.dataset.page); closeDetail(); loadSales();
  list.scrollIntoView({block:'start',behavior:'smooth'});
});

function acceptanceBadge(s){if(!s.acceptance_completed)return'';const title=s.acceptance_completed_at?` title="Aceite confirmado em ${escapeHtml(formatDateTime(s.acceptance_completed_at))}"`:'';return`<span class="acceptance-badge"${title}>✓ ACEITE FEITO</span>`}
function installationCardInfo(s) {
  let text;
  if (s.installation_date) {
    text = 'Instalada em: ' + formatDate(s.installation_date);
  } else if (['cancelada', 'reprovada'].includes(s.status)) {
    return '';
  } else if (s.scheduled_installation_date) {
    const start = String(s.scheduled_installation_start || '').slice(0, 5);
    const end = String(s.scheduled_installation_end || '').slice(0, 5);
    text = 'Instalação prevista: ' + formatDate(s.scheduled_installation_date);
    if (start && end) text += ' · ' + start + ' às ' + end;
  } else {
    text = 'Instalação: aguardando agendamento';
  }
  return '<span class="sale-installation-preview" style="grid-column:1/-1;display:block;font-size:11px;line-height:1.5;color:#475569;padding:4px 0;overflow-wrap:anywhere">📅 ' + escapeHtml(text) + '</span>';
}
function card(s){const status=cssStatus[s.status]||'analise',contract=s.contract_number?`<div class="contract-preview"><span>CONTRATO</span><strong>${escapeHtml(s.contract_number)}</strong></div>`:'',partnerBadge=s.origin==='parceiro'?'<span style="display:inline-flex;align-items:center;margin-left:7px;padding:3px 6px;border-radius:999px;background:#f1eafe;color:#7146b7;font-size:8px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;vertical-align:middle">PARCEIRO</span>':'',bkoChip=s.mobile_origin==='bko'&&!s.mobile_removed_at?'<span class="mobile-bko-badge">CHIP VENDIDO PELO BKO</span>':'';return `<button class="sale-card ${selectedId===s.id?'selected':''}" data-operator="${escapeHtml(s.operators?.name||'')}" data-id="${s.id}" aria-label="Abrir venda de ${escapeHtml(s.customer_name)}"><div class="card-top"><span class="card-badges"><span class="status-badge ${status}"><i></i>${labels[s.status]||s.status}</span>${acceptanceBadge(s)}</span><small>${formatDateTime(s.updated_at)}</small></div><div class="sale-card-title-row"><h2>${escapeHtml(s.customer_name)}${partnerBadge}</h2>${contract}</div><p class="return-preview">${escapeHtml(s.bko_return||'Aguardando retorno do BKO')}</p><div class="card-footer"><span>${escapeHtml(s.operators?.name||'Operadora')} · ${escapeHtml(s.plan_name)} ${bkoChip}</span><b>${formatMoney(s.value)}</b>${installationCardInfo(s)}<span style="grid-column:1;font-size:11px;font-weight:700;color:#718096;align-self:end">${escapeHtml(s.seller?.full_name||'—')}</span><span class="open-detail" style="grid-column:2;align-self:end">Ver detalhes →</span></div></button>`}function matchesSalesPeriod(s){if(!periodStart||!periodEnd)return true;const date=new Date(s.created_at),start=new Date(`${periodStart}T00:00:00`),end=new Date(`${periodEnd}T00:00:00`);end.setDate(end.getDate()+1);return date>=start&&date<end}
function render(){list.innerHTML=sales.map(card).join('');list.hidden=!sales.length;emptyList.hidden=!!sales.length;document.querySelector('#emptyListMessage').textContent='Tente alterar a busca ou os filtros selecionados.';renderSalesPager()}function row(label,value,wide=false){return `<div class="detail-item ${wide?'wide':''}"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`}
function mobileRemovalNotice(s){return `<div class="mobile-removal-alert detail-item wide" role="status"><span class="mobile-removal-icon" aria-hidden="true">!</span><div><span class="mobile-removal-label">MÓVEL REMOVIDO DO PLANO</span><strong>Removido pelo administrador</strong><small><b>Motivo:</b> ${escapeHtml(s.mobile_removal_reason||'Não informado')}</small></div></div>`}
function mobileBkoNotice(s){return s.mobile_origin==='bko'&&!s.mobile_removed_at?`<div class="mobile-bko-alert" role="status"><span class="mobile-bko-icon" aria-hidden="true">BKO</span><div><span>CHIP VENDIDO PELO BKO</span><strong>Móvel incluído após o lançamento da venda</strong><small>Este chip não compõe o bônus do vendedor/parceiro.</small></div></div>`:''}
function ensureInstallModal(){let modal=document.querySelector('#sellerInstallModal');if(modal)return modal;const style=document.createElement('style');style.textContent=`#sellerInstallModal{position:fixed;inset:0;background:rgba(17,24,39,.48);display:none;align-items:center;justify-content:center;padding:20px;z-index:2200}#sellerInstallModal.show{display:flex}.seller-install-box{width:min(430px,100%);background:#fff;border-radius:14px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.25)}.seller-install-box h3{margin:0 0 7px;font-size:18px}.seller-install-box p{margin:0 0 17px;color:#718096;font-size:12px;line-height:1.5}.seller-install-box label{display:block;font-size:10px;font-weight:800;color:#384555;margin-bottom:7px}.seller-install-box input{width:100%;height:44px;border:1px solid #d7dde4;border-radius:9px;padding:0 12px;font:inherit}.seller-install-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.seller-install-actions button{height:40px;border-radius:8px;padding:0 14px;border:1px solid #d9dfe6;background:#fff;font:inherit;font-size:12px;font-weight:700;cursor:pointer}.seller-install-actions .confirm{background:#f36c21;border-color:#f36c21;color:#fff}.inform-installation{margin-top:14px;width:100%;height:42px;border:0;border-radius:9px;background:#f36c21;color:#fff;font:inherit;font-size:12px;font-weight:800;cursor:pointer}`;document.head.appendChild(style);modal=document.createElement('div');modal.id='sellerInstallModal';modal.innerHTML=`<div class="seller-install-box"><h3>Informar instalação</h3><p>Informe a data em que o cliente foi instalado. Depois de confirmar, somente o BKO poderá corrigir essa data.</p><label>DATA DE INSTALAÇÃO *</label><input type="date" id="sellerInstallDate"><div class="seller-install-actions"><button type="button" id="sellerInstallCancel">Cancelar</button><button type="button" class="confirm" id="sellerInstallConfirm">Confirmar instalação</button></div></div>`;document.body.appendChild(modal);return modal}
function askInstallDate(){return new Promise(resolve=>{const modal=ensureInstallModal(),input=modal.querySelector('#sellerInstallDate'),cancel=modal.querySelector('#sellerInstallCancel'),confirm=modal.querySelector('#sellerInstallConfirm');input.max=todayKey();input.value=todayKey();modal.classList.add('show');const finish=v=>{modal.classList.remove('show');cancel.onclick=null;confirm.onclick=null;resolve(v)};cancel.onclick=()=>finish(null);confirm.onclick=()=>{if(!input.value)return alert('Informe a data de instalação.');if(input.value>todayKey())return alert('A data de instalação não pode ser futura.');finish(input.value)}})}
async function informInstallation(s){const value=await askInstallDate();if(!value)return;const button=detail.querySelector('.inform-installation');if(button){button.disabled=true;button.textContent='Salvando instalação...'}const{error}=await window.supabaseClient.rpc('confirm_own_installation',{p_sale_id:s.id,p_installation_date:value});if(error){if(button){button.disabled=false;button.textContent='Informar instalação'}alert(error.message||'Não foi possível informar a instalação.');return}await loadSales(true)}
function openSale(id){const s=sales.find(item=>item.id===id);if(!s)return;selectedId=id;render();const status=cssStatus[s.status]||'analise',canInform=false;detail.innerHTML=`<div class="detail-header"><div><div class="detail-statuses"><span class="status-badge ${status}"><i></i>${labels[s.status]||s.status}</span>${acceptanceBadge(s)}</div><h2>${escapeHtml(s.customer_name)}</h2><p>Venda #${s.protocol} · Atualizada ${formatDateTime(s.updated_at)}</p></div><button class="close-detail" aria-label="Fechar detalhes">×</button></div>${mobileBkoNotice(s)}<div class="bko-return ${status}"><span>RETORNO DO BKO</span><strong>${escapeHtml(s.bko_return||'Aguardando análise e retorno do BKO.')}</strong></div><div class="detail-section"><h3>Dados da venda</h3><div class="detail-grid">${row('Operadora',s.operators?.name||'—')}${row('Plano',s.plan_name)}${s.operators?.name?.trim().toLowerCase()==='claro'?`${row('MULTI',s.is_multi?'Sim':'Não')}${row('Valor Internet',formatMoney(s.internet_value??s.value))}${s.is_multi?row('Valor Móvel',formatMoney(s.mobile_value)):''}`:''}${row(s.has_promotion?'Total inicial':'Valor Total',formatMoney(s.value))}${s.has_promotion?`${row('Duração do desconto',`${s.promotion_months} meses`)}${row('Total após o desconto',formatMoney(s.post_promo_value))}`:row('Valor promo',s.promo_value!=null?formatMoney(s.promo_value):'Não informado')}${row('Vencimento',`Dia ${String(s.due_day).padStart(2,'0')}`)}${row('Contrato',s.contract_number||'Não informado')}</div></div><div class="detail-section"><h3>Dados do cliente</h3><div class="detail-grid">${row('CPF',formatCpf(s.cpf))}${row('Data de nascimento',formatDate(s.birth_date))}${row('Nome da mãe',s.mother_name,true)}${row('E-mail',s.email,true)}${row('Telefone 1',formatPhone(s.phone_1))}${row('Telefone 2',formatPhone(s.phone_2))}</div></div><div class="detail-section"><h3>Endereço de instalação</h3><div class="detail-grid">${row('Endereço completo',s.full_address,true)}${row('Complemento',s.address_complement||'Não informado',true)}${row('Data de instalação',formatDate(s.installation_date),true)}${s.is_multi?(s.mobile_removed_at?mobileRemovalNotice(s):row('Ativação do chip',s.mobile_activation_date?formatDate(s.mobile_activation_date):'Aguardando ativação',true)):''}</div>${canInform?'<button type="button" class="inform-installation">Informar instalação</button>':''}</div>`;detail.classList.add('open');overlay.classList.add('show');detail.querySelector('.close-detail').addEventListener('click',closeDetail);detail.querySelector('.inform-installation')?.addEventListener('click',()=>informInstallation(s))}function closeDetail(){detail.classList.remove('open');overlay.classList.remove('show');selectedId=null;render()}
async function setupSalesResponsibleFilter(user) {
  const box=document.querySelector('#salesResponsibleBox'),select=document.querySelector('#salesResponsibleFilter');
  if(user.profile.role!=='admin'){box.hidden=true;responsibleFilter='all';return}
  box.hidden=false;
  if(select.dataset.loaded) return;
  const {data,error}=await window.supabaseClient.from('profiles').select('id,full_name,role').in('role',['admin','vendedora','parceiro']).order('full_name');
  if(error)return;
  select.innerHTML='<option value="all">Todos os responsáveis</option>'+(data||[]).map(p=>'<option value="'+escapeHtml(p.id)+'">'+escapeHtml(p.full_name)+' — '+(p.role==='parceiro'?'Parceiro':'Vendedor')+'</option>').join('');
  select.value=responsibleFilter; select.dataset.loaded='true';
}
async function loadSales(silent=false){
  const user=await window.authReady;if(!user)return;
  currentSalesUser=user;await setupSalesResponsibleFilter(user);
  const token=++salesRequest,openId=selectedId;
  if(!silent){list.hidden=false;emptyList.hidden=true;list.innerHTML='<div class="loading-card">Carregando esta página...</div>'}
  let query=salesBaseQuery('*, operators(name), seller:profiles!sales_seller_id_fkey(full_name)',{count:'exact'});
  if(filter!=='todos')query=query.eq('status',filter);
  const offset=(salesPage-1)*salesPageSize;
  const count=states=>{let q=salesBaseQuery('id',{count:'exact',head:true},false);return states?q.in('status',states):q};
  const [result,total,pending,connected,rejected]=await Promise.all([
    query.order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+salesPageSize-1),
    count(),count(['pendente','em_analise','aguardando_hp','pendente_aceite','pendente_instalacao']),count(['conectado']),count(['reprovada','cancelada'])
  ]);
  if(token!==salesRequest)return;
  if(result.error){list.innerHTML='<div class="loading-card error-state">Não foi possível carregar as vendas. Atualize a página.</div>';return}
  salesTotal=result.count||0;
  const pages=Math.max(1,Math.ceil(salesTotal/salesPageSize));
  if(salesPage>pages){salesPage=pages;return loadSales(silent)}
  sales=result.data||[];
  for(const [id,res] of [['totalCount',total],['pendingCount',pending],['connectedCount',connected],['rejectedCount',rejected]])if(!res.error)document.querySelector('#'+id).textContent=res.count||0;
  render();
  if(openId&&sales.some(item=>item.id===openId))openSale(openId);else if(openId)closeDetail();
  setupRealtime(user);
}
function scheduleRealtimeRefresh(){clearTimeout(realtimeRefreshTimer);realtimeRefreshTimer=setTimeout(()=>loadSales(true),400)}
function setupRealtime(user){if(realtimeChannel)return;const canSeeAll=['admin','financeiro'].includes(user.profile.role),config={event:'*',schema:'public',table:'sales'};if(!canSeeAll)config.filter=`seller_id=eq.${user.id}`;realtimeChannel=window.supabaseClient.channel(`sales-${user.profile.role}-${user.id}`).on('postgres_changes',config,scheduleRealtimeRefresh).subscribe()}
const salesStartDate=document.querySelector('#salesStartDate'),salesEndDate=document.querySelector('#salesEndDate'),salesPeriodClear=document.querySelector('#salesPeriodClear'),salesResponsibleFilter=document.querySelector('#salesResponsibleFilter');const maxSalesDate=todayKey();salesStartDate.max=maxSalesDate;salesEndDate.max=maxSalesDate;function applySalesPeriodAutomatically(){if(salesStartDate.value&&salesEndDate.value){periodStart=salesStartDate.value;periodEnd=salesEndDate.value}else{periodStart='';periodEnd=''}requestSalesPage()}salesStartDate.addEventListener('change',()=>{salesEndDate.min=salesStartDate.value;if(salesEndDate.value&&salesEndDate.value<salesStartDate.value)salesEndDate.value=salesStartDate.value;applySalesPeriodAutomatically()});salesEndDate.addEventListener('change',()=>{salesStartDate.max=salesEndDate.value||maxSalesDate;if(salesStartDate.value&&salesStartDate.value>salesEndDate.value)salesStartDate.value=salesEndDate.value;applySalesPeriodAutomatically()});salesPeriodClear.addEventListener('click',()=>{periodStart='';periodEnd='';salesStartDate.value='';salesEndDate.value='';salesStartDate.max=maxSalesDate;salesEndDate.min='';requestSalesPage()});
salesResponsibleFilter.addEventListener('change',event=>{responsibleFilter=event.target.value;requestSalesPage()});
list.addEventListener('click',e=>{const item=e.target.closest('.sale-card');if(item)openSale(item.dataset.id)});search.addEventListener('input',()=>{clearTimeout(salesSearchTimer);salesSearchTimer=setTimeout(requestSalesPage,300)});tabs.addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;tabs.querySelector('.active')?.classList.remove('active');button.classList.add('active');filter=button.dataset.filter;requestSalesPage()});overlay.addEventListener('click',closeDetail);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDetail()});document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleRealtimeRefresh()});window.addEventListener('beforeunload',()=>{if(realtimeChannel)window.supabaseClient.removeChannel(realtimeChannel)});document.querySelector('#menuButton').addEventListener('click',()=>document.querySelector('#sidebar').classList.toggle('open'));loadSales();