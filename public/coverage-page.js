(()=>{
'use strict';
const allowed=['admin','vendedora','parceiro'];
const sidebar=document.querySelector('#sidebar'),menu=document.querySelector('#menuButton');
menu?.addEventListener('click',()=>{if(window.matchMedia('(max-width:900px)').matches){sidebar.classList.toggle('open');menu.setAttribute('aria-expanded',String(sidebar.classList.contains('open')))}});
document.addEventListener('click',event=>{if(window.matchMedia('(max-width:900px)').matches&&!sidebar.contains(event.target)&&!menu.contains(event.target)){sidebar.classList.remove('open');menu.setAttribute('aria-expanded','false')}});
function script(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('Falha ao carregar a consulta'));document.body.appendChild(s)})}
async function init(){try{const user=await window.authReady;if(!user)return;if(!allowed.includes(user.profile?.role)){location.replace('painel.html');return}for(const src of ['coverage-ui.js?v=20261102-claro','coverage-map.js?v=20261102-grouped','coverage-cep.js?v=20261102-claro','coverage-vero.js?v=20261102-clean'])await script(src);document.querySelector('#coverageLoading').hidden=true;document.querySelector('#coverageContent').hidden=false}catch{document.querySelector('#coverageLoading').textContent='Não foi possível abrir a consulta. Atualize a página para tentar novamente.'}}
init();
})();