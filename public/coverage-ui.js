(()=>{
'use strict';
const $=s=>document.querySelector(s);
let address='',mapped=[],vero=[],mapNote='';
function render(){const section=$('#cepConsult'),grid=$('#providerGrid');grid.replaceChildren();section.hidden=!address&&!mapped.length&&!vero.length&&!mapNote;if(section.hidden)return;$('#resultAddress').textContent=address||'Resultados por cidade';$('#resultCount').textContent=vero.length>1&&!mapped.length?'VERO · '+vero.length+' cidades':[mapped.length+vero.length,'operadora'+(mapped.length+vero.length===1?'':'s')].join(' ');for(const row of [...mapped,...vero]){const card=document.createElement('article');card.className='provider-card '+(row.operator==='vero'?'municipal':'mapped');const brand=document.createElement('div');brand.className='provider-brand';if(row.operator==='alcans'){brand.textContent='Alcans'}else{const img=document.createElement('img');img.src='operator-logos/'+row.operator+'.svg';img.alt=row.operator==='vero'?'VERO':'Desktop';brand.append(img)}const content=document.createElement('div');content.className='provider-info';const status=document.createElement('span');status.className='provider-status';status.textContent=row.operator==='vero'?'Atende na cidade':row.border?'Próximo ao limite':'Cobertura mapeada';const note=document.createElement('p');note.textContent=row.operator==='vero'?(address?'Consulte a disponibilidade no endereço':row.city+'/'+row.uf+' · Consulte o endereço'):'No ponto aproximado da rua';content.append(status,note);card.append(brand,content);if(row.operator==='vero'){const a=document.createElement('a');a.href='https://ping.veronet.com.br/home';a.target='_blank';a.rel='noopener noreferrer';a.textContent='Consultar ↗';a.setAttribute('aria-label','Consultar disponibilidade na VERO');card.append(a)}grid.append(card)}$('#resultNote').textContent=mapNote||(mapped.length?'A localização no mapa é aproximada. Ajuste o ponto até o imóvel, se necessário.':'A presença na cidade não confirma cobertura do imóvel.');}
window.ContactCoverageResults={
 reset(){address='';mapped=[];vero=[];mapNote='';render()},
 address(value){address=value;render()},
 mapped(rows,note=''){mapped=rows;mapNote=note;render()},
 vero(rows){vero=rows.map(r=>({...r,operator:'vero'}));render()},
 note(value){mapNote=value;render()}
};
$('#areaSearch').addEventListener('input',()=>{window.ContactCoverageResults.reset();$('#mapSection').hidden=true;$('#mapSection').open=false});
})();