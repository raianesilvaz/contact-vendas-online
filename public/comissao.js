(()=>{
const $=s=>document.querySelector(s),money=v=>(v/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),date=v=>v?String(v).slice(0,10).split('-').reverse().join('/'):'—';
let rows=[],page=1,request=0,selectedOperator='claro';const size=15;
function baseCents(s){const value=s.has_promotion?s.post_promo_value:s.value;if(value==null||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0)return null;return Math.round(Number(value)*100)}
function amount(s){const base=baseCents(s);return base===null?null:Math.round(base*(s.is_multi?43:33)/10)}
function half(s){return Number(s.installation_date.slice(8,10))<=15?1:2}
function total(items){return items.reduce((n,s)=>n+(amount(s)??0),0)}
function render(){const term=$('#commissionSearch').value.trim().toLocaleLowerCase('pt-BR'),q=$('#commissionHalf').value,type=$('#commissionType').value;
const filtered=rows.filter(s=>(!q||half(s)===Number(q))&&(!type||(type==='multi')===!!s.is_multi)&&(!term||[s.customer_name,s.contract_number,s.plan_name,s.seller?.full_name].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(term))));
const normal=filtered.filter(s=>!s.is_multi),multi=filtered.filter(s=>s.is_multi),missing=filtered.filter(s=>amount(s)===null).length;
$('#commissionStatus').textContent='Valores previstos pelas regras atuais · filtros aplicados ao resumo, quinzenas e lista';
$('#commissionTotal').textContent=money(total(filtered));$('#commissionCount').textContent=filtered.length;$('#commissionNormal').textContent=money(total(normal));$('#commissionMulti').textContent=money(total(multi));$('#normalCount').textContent=normal.length+' vendas · fator 3,3×';$('#multiCount').textContent=multi.length+' vendas · fator 4,3×';
$('#commissionWarning').hidden=!missing;$('#commissionWarning').textContent=missing+' venda(s) sem base de cálculo válida. Essas vendas não entram na soma prevista.';
const month=$('#commissionMonth').value,last=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();
$('#commissionAgenda').innerHTML=[1,2].map(h=>{const group=filtered.filter(s=>half(s)===h);return '<article class="commission-period"><h3>'+h+'ª quinzena</h3><span>Instalações de '+(h===1?'01 a 15':'16 a '+last)+'/'+month.slice(5,7)+'/'+month.slice(0,4)+'</span><strong>'+money(total(group))+'</strong><small>'+group.length+' vendas instaladas</small><span>Data de pagamento: a definir</span></article>'}).join('');
const pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages);
$('#commissionRows').innerHTML=filtered.slice((page-1)*size,page*size).map(s=>'<tr><td><strong>'+safe(s.customer_name)+'</strong><small>'+safe(s.seller?.full_name||'Sem responsável')+'</small></td><td>'+safe(s.contract_number||'—')+'</td><td>'+date(s.installation_date)+'</td><td>'+half(s)+'ª quinzena</td><td>'+safe(s.plan_name||'—')+'<small>'+(s.is_multi?'MULTI':'Sem MULTI')+'</small></td><td>'+(baseCents(s)===null?'—':money(baseCents(s)))+'<small>'+(s.has_promotion?'Total após o desconto':'Valor total da venda')+'</small>'+'</td><td>'+(s.is_multi?'4,3×':'3,3×')+'</td><td><strong>'+(amount(s)===null?'Valor a conferir':money(amount(s)))+'</strong><small>Prevista</small></td></tr>').join('');
$('#commissionEmpty').hidden=!!filtered.length;$('#commissionTable').hidden=!filtered.length;$('#commissionEmpty').textContent=rows.length?'Nenhuma venda encontrada com esses filtros.':'Nenhuma venda Claro instalada neste mês.';
const nums=new Set([1,pages]);for(let n=Math.max(1,page-2);n<=Math.min(pages,page+2);n++)nums.add(n);let prev=0;
$('#commissionPagination').innerHTML='<button data-page="'+(page-1)+'" '+(page===1?'disabled':'')+' aria-label="Página anterior">‹</button>'+[...nums].sort((a,b)=>a-b).map(n=>{const gap=prev&&n>prev+1?'<span>…</span>':'';prev=n;return gap+'<button data-page="'+n+'" class="'+(n===page?'active':'')+'" '+(n===page?'aria-current="page"':'')+'>'+n+'</button>'}).join('')+'<button data-page="'+(page+1)+'" '+(page===pages?'disabled':'')+' aria-label="Próxima página">›</button>';
$('#commissionPagination').hidden=!filtered.length;$('#commissionRange').textContent=filtered.length?'Mostrando '+((page-1)*size+1)+'–'+Math.min(page*size,filtered.length)+' de '+filtered.length+' vendas':'';
}
async function load(){if(selectedOperator!=='claro')return;const token=++request;const month=$('#commissionMonth').value;if(!/^\d{4}-\d{2}$/.test(month))return;$('#commissionStatus').textContent='Carregando instalações…';$('#commissionResults').hidden=true;$('#commissionDashboard').hidden=true;
try{const user=await window.authReady;if(user?.profile?.role!=='admin')return;if(token!==request)return;const db=window.supabaseClient;const operators=await db.from('operators').select('id,name').ilike('name','%claro%');if(operators.error)throw operators.error;const ids=(operators.data||[]).map(o=>o.id);let loaded=[];const year=Number(month.slice(0,4)),m=Number(month.slice(5,7)),next=m===12?(year+1)+'-01':year+'-'+String(m+1).padStart(2,'0');
if(ids.length){for(let offset=0;;offset+=500){const r=await db.from('sales').select('id,customer_name,contract_number,plan_name,value,is_multi,has_promotion,post_promo_value,installation_date,seller:profiles!sales_seller_id_fkey(full_name)').in('operator_id',ids).not('status','in','(cancelada,reprovada)').gte('installation_date',month+'-01').lt('installation_date',next+'-01').order('installation_date',{ascending:false}).order('id',{ascending:false}).range(offset,offset+499);if(token!==request)return;if(r.error)throw r.error;loaded.push(...(r.data||[]));if((r.data||[]).length<500)break}}
if(token!==request)return;rows=loaded;page=1;render();$('#commissionResults').hidden=false;$('#commissionDashboard').hidden=false;
}catch(e){if(token!==request)return;$('#commissionStatus').textContent='Não foi possível carregar as comissões. Tente atualizar novamente.';console.error('Comissões:',e)}}
const operatorNames={claro:'Claro',desktop:'Desktop',vero:'Vero',alares:'Alares'};
function selectOperator(key){
 if(!operatorNames[key]||key===selectedOperator)return;
 selectedOperator=key;request++;
 document.querySelectorAll('[data-commission-operator]').forEach(button=>{const active=button.dataset.commissionOperator===key;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1});
 
 $('#commissionClaroPanel').hidden=key!=='claro';$('#commissionPendingPanel').hidden=key==='claro';
 $('#commissionPendingTitle').textContent='Comissões '+operatorNames[key];
 if(key==='claro')load();
}
const operatorTabs=$('#commissionOperatorTabs');
operatorTabs.addEventListener('click',event=>{const button=event.target.closest('[data-commission-operator]');if(button)selectOperator(button.dataset.commissionOperator)});
operatorTabs.addEventListener('keydown',event=>{const button=event.target.closest('[data-commission-operator]');if(!button)return;const buttons=[...operatorTabs.querySelectorAll('[data-commission-operator]')],index=buttons.indexOf(button);let next;if(event.key==='ArrowRight')next=(index+1)%buttons.length;else if(event.key==='ArrowLeft')next=(index+buttons.length-1)%buttons.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=buttons.length-1;else return;event.preventDefault();selectOperator(buttons[next].dataset.commissionOperator);buttons[next].focus()});
$('#commissionMonth').value=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
$('#commissionMonth').addEventListener('change',load);$('#commissionRefresh').addEventListener('click',load);
for(const id of ['commissionSearch','commissionHalf','commissionType'])$('#'+id).addEventListener(id==='commissionSearch'?'input':'change',()=>{page=1;render()});
$('#commissionPagination').addEventListener('click',e=>{const b=e.target.closest('button[data-page]');if(!b||b.disabled)return;page=Number(b.dataset.page);render()});
$('#menuButton').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));load();
})();