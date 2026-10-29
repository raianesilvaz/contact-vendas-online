/* Distribuição de vendas aprovadas por operadora: componente compartilhado. */
(function(){
'use strict';
const approved=new Set(['pendente_aceite','pendente_instalacao','conectado']);
const colors=['#008f89','#4078c0','#e88eaa','#e7ac46','#7466c7','#63a6a1','#d67e5c','#82919d'];
const fmt=n=>Number(n||0).toLocaleString('pt-BR');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
function render(target,sales,operatorNames){
 const node=typeof target==='string'?document.querySelector(target):target;if(!node)return;
 const counts=new Map();(sales||[]).forEach(s=>{if(!approved.has(s.status))return;const id=s.operator_id||'unknown';counts.set(id,(counts.get(id)||0)+1)});
 const rows=[...counts].map(([id,count])=>({id,name:operatorNames?.get(id)||'Operadora não identificada',count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'pt-BR'));
 const total=rows.reduce((sum,r)=>sum+r.count,0);
 if(!total){node.innerHTML='<p class="operator-pie-empty">Nenhuma venda aprovada no período selecionado.</p>';return}
 let start=0;const stops=rows.map((r,i)=>{const end=start+100*r.count/total,part=colors[i%colors.length]+' '+start+'% '+end+'%';start=end;return part});
 node.innerHTML='<div class="operator-pie-layout"><div class="operator-pie-circle" role="img" aria-label="Distribuição de '+fmt(total)+' vendas aprovadas por operadora" style="background:conic-gradient('+stops.join(',')+')"><div class="operator-pie-center"><strong>'+fmt(total)+'</strong><small>aprovadas</small></div></div><div class="operator-pie-legend">'+rows.map((r,i)=>'<div class="operator-pie-legend-row"><i style="background:'+colors[i%colors.length]+'"></i><span>'+esc(r.name)+'</span><strong>'+fmt(r.count)+'</strong><small>'+(100*r.count/total).toFixed(1).replace('.',',')+'%</small></div>').join('')+'</div></div>';
}
window.ContactOperatorPie={render};
})();
