/* Fonte única dos indicadores e do gráfico de produtividade do CONTACT. */
(function(){
'use strict';
const day=value=>{const d=new Date(value);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const approved=new Set(['pendente_aceite','pendente_instalacao','conectado']);
const rejected=new Set(['reprovada','cancelada']);
const fmt=n=>Number(n||0).toLocaleString('pt-BR');
const pct=n=>Number(n||0).toFixed(1).replace('.',',')+'%';
function metrics(sales){
 const total=sales.length,approvedCount=sales.filter(s=>approved.has(s.status)).length,connected=sales.filter(s=>s.status==='conectado').length,rejectedCount=sales.filter(s=>rejected.has(s.status)).length;
 return {total,approved:approvedCount,connected,rejected:rejectedCount,approvalRate:approvedCount+rejectedCount?100*approvedCount/(approvedCount+rejectedCount):null,installationRate:approvedCount?100*connected/approvedCount:null};
}
function render(sales,from,to){
 const m=metrics(sales);
 const steps=[['Cadastros',m.total,'#324b57'],['Aprovadas',m.approved,'#00a6a0'],['Conectadas',m.connected,'#74cbc3']];
 document.querySelector('#productivityFunnel').innerHTML=steps.map(([name,value,color],i)=>'<div class="funnel-step"><div class="funnel-step-heading"><strong>'+name+'</strong><b>'+fmt(value)+'</b></div><div class="funnel-track"><div class="funnel-fill" style="width:'+(m.total?100*value/m.total:0)+'%;background:'+color+'"></div></div><small>'+(i===0?'Cadastros realizados no período':pct(m.total?100*value/m.total:0)+' dos cadastros do período')+'</small></div>').join('');
 document.querySelector('#funnelApproval').textContent=m.approvalRate===null?'Em avaliação':pct(m.approvalRate);
 document.querySelector('#funnelInstallation').textContent=m.installationRate===null?'Em avaliação':pct(m.installationRate);
 const dates=[];for(let d=new Date(from+'T12:00:00');d<=new Date(to+'T12:00:00')&&dates.length<366;d.setDate(d.getDate()+1))dates.push(day(d));
 const stride=Math.max(1,Math.ceil(dates.length/31)),visible=dates.filter((_,i)=>i%stride===0),counts=new Map();sales.forEach(s=>{const date=day(s.created_at);counts.set(date,(counts.get(date)||0)+1)});
 const bars=visible.map(date=>({date,total:counts.get(date)||0})),max=Math.max(1,...bars.map(x=>x.total));
 document.querySelector('#salesChart').innerHTML=bars.length?bars.map(x=>'<div class="chart-col"><div class="chart-pair"><div class="chart-series"><strong>'+x.total+'</strong><div class="chart-bar" style="height:'+Math.max(3,105*x.total/max)+'px"></div></div></div><small>'+x.date.slice(8)+'/'+x.date.slice(5,7)+'</small></div>').join(''):'<p class="dashboard-empty">Sem dados no período.</p>';
 return m;
}
window.ContactProductivityChart={metrics,render,day};
})();
