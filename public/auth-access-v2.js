/* Shared CONTACT date controls, including forms inserted after page load. */
(()=>{const base=new URL('.',document.currentScript.src),version='20261111-month-calendar';const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('contact-date-picker.css?v='+version,base).href;document.head.append(css);const script=document.createElement('script');script.src=new URL('contact-date-picker.js?v='+version,base).href;document.head.append(script)})();
(() => {
  if (!document.querySelector('link[rel="icon"]')) {
    const favicon = document.createElement('link'); favicon.rel='icon'; favicon.type='image/svg+xml'; favicon.href='favicon.svg'; document.head.appendChild(favicon);
  }
  ['notifications.css?v=20261028-actions-2','sale-status-extra.css','partner-sales-badge.css'].forEach(href=>{if(!document.querySelector(`link[href="${href}"]`)){const s=document.createElement('link');s.rel='stylesheet';s.href=href;document.head.appendChild(s)}});
})();
function addSidebarDisclosure(parentLink, label, submenuId, links) {
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'nav-item nav-disclosure';
  trigger.title = label;
  trigger.setAttribute('aria-label', label);
  trigger.setAttribute('aria-controls', submenuId);
  trigger.setAttribute('aria-expanded', 'false');
  trigger.classList.toggle('active', links.some(link => link.classList.contains('active')));
  const caption = document.createElement('span');
  caption.textContent = label;
  const caret = document.createElement('span');
  caret.className = 'nav-disclosure-caret';
  caret.setAttribute('aria-hidden', 'true');
  trigger.append(parentLink.firstElementChild.cloneNode(true), caption, caret);

  const submenu = document.createElement('div');
  submenu.className = 'nav-submenu';
  submenu.id = submenuId;
  submenu.hidden = true;
  for (const link of links) {
    link.classList.add('nav-subitem');
    const name = link.lastElementChild.textContent;
    link.setAttribute('aria-label', name);
    link.title = name;
    if (link.classList.contains('active')) link.setAttribute('aria-current', 'page');
  }
  parentLink.replaceWith(trigger, submenu);
  submenu.append(...links);

  function setExpanded(expanded) {
    submenu.hidden = !expanded;
    trigger.setAttribute('aria-expanded', String(expanded));
  }
  trigger.addEventListener('click', () => setExpanded(submenu.hidden));
  submenu.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    setExpanded(false);
    trigger.focus();
  });
}

function addPanelSubmenu(currentPath,isAdmin) {
  const onOverview=['painel','painel.html'].includes(currentPath);
  const onIntelligence=['inteligencia-comercial','inteligencia-comercial.html'].includes(currentPath);
  document.querySelectorAll('.sidebar nav').forEach((nav,index)=>{
    const panel=nav.querySelector('a[href="painel.html"]');
    if(!panel||nav.querySelector('#panel-submenu-'+index))return;
    panel.classList.toggle('active',onOverview);
    panel.lastElementChild.textContent='Visão geral';
    const links=[panel];
    if(isAdmin){
      const intelligence=document.createElement('a');
      intelligence.href='inteligencia-comercial.html';
      intelligence.className='nav-item'+(onIntelligence?' active':'');
      intelligence.innerHTML='<span aria-hidden="true">◫</span><span>Inteligência comercial</span>';
      links.push(intelligence);
    }
    addSidebarDisclosure(panel,'Painel','panel-submenu-'+index,links);
  });
}

function addRankingSubmenu(currentPath) {
  const onRanking = ['ranking-produtividade', 'ranking-produtividade.html'].includes(currentPath);
  const onBonus = ['bonus', 'bonus.html'].includes(currentPath);
  document.querySelectorAll('.sidebar nav').forEach((nav, index) => {
    const ranking = nav.querySelector('a[href="ranking-produtividade.html"]');
    if (!ranking || nav.querySelector('a[href="bonus.html"]')) return;
    const bonus = document.createElement('a');
    bonus.href = 'bonus.html';
    bonus.className = 'nav-item' + (onBonus ? ' active' : '');
    bonus.innerHTML = '<span aria-hidden="true">◇</span><span>Bônus</span>';
    ranking.classList.toggle('active', onRanking);
    ranking.lastElementChild.textContent = 'Ver ranking';
    addSidebarDisclosure(ranking, 'Ranking de produtividade', 'ranking-submenu-' + index, [ranking, bonus]);
  });
}

function addContactsLink(currentPath) {
  const active = ['contatos', 'contatos.html'].includes(currentPath);
  document.querySelectorAll('.sidebar nav').forEach(nav => {
    const anchor = nav.querySelector('a[href="cobertura.html"]') || nav.querySelector('a[href="vendas.html"]');
    if (!anchor || nav.querySelector('a[href="contatos.html"]')) return;
    const link = document.createElement('a');
    link.href = 'contatos.html';
    link.className = 'nav-item' + (active ? ' active' : '');
    link.title = 'Contatos';
    link.innerHTML = '<span aria-hidden="true">♙</span><span>Contatos</span>';
    if (active) link.setAttribute('aria-current', 'page');
    anchor.insertAdjacentElement('afterend', link);
  });
}

window.authReady=(async()=>{const{data:{user},error}=await window.supabaseClient.auth.getUser();if(error||!user){location.replace('login.html');return null}const{data:profile}=await window.supabaseClient.from('profiles').select('full_name, role, active').eq('id',user.id).single();if(!profile||!profile.active){await window.supabaseClient.auth.signOut();location.replace('login.html');return null}const roleNames={vendedora:'Vendedor',parceiro:'Parceiro',financeiro:'Financeiro',admin:'Administrador'},initials=profile.full_name.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase();document.querySelectorAll('[data-user-name]').forEach(el=>el.textContent=profile.full_name);document.querySelectorAll('[data-user-role]').forEach(el=>el.textContent=roleNames[profile.role]||'Usuário');document.querySelectorAll('[data-user-initials]').forEach(el=>el.textContent=initials);const isAdmin=profile.role==='admin',isPartner=profile.role==='parceiro',isFinanceiro=profile.role==='financeiro';const canAttend=isAdmin||profile.role==='vendedora';const currentPath=location.pathname.split('/').pop()||'index.html';const canViewContacts=isAdmin||isFinanceiro||profile.role==='vendedora';if(['contatos','contatos.html'].includes(currentPath)&&!canViewContacts){location.replace('vendas.html');return null}if(isFinanceiro&&!['inicio','inicio.html','vendas','vendas.html','financeiro','financeiro.html','tarefas','tarefas.html','atendimentos-teste','atendimentos-teste.html','contatos','contatos.html'].includes(currentPath)){location.replace('vendas.html');return null}document.querySelectorAll('.sidebar nav').forEach(nav=>{if(!nav.querySelector('a[href="chips.html"]')){const sales=nav.querySelector('a[href="vendas.html"]');if(sales){const a=document.createElement('a');a.className='nav-item';a.href='chips.html';a.innerHTML='<span>▣</span><span>Gestão de chips</span>';sales.insertAdjacentElement('afterend',a)}}});if(isAdmin){document.querySelectorAll('.sidebar nav').forEach(nav=>{if(!nav.querySelector('a[href="instalacoes.html"]')){const bko=nav.querySelector('a[href="bko.html"]');if(bko){const a=document.createElement('a');a.className='nav-item'+(currentPath==='instalacoes.html'?' active':'');a.href='instalacoes.html';a.setAttribute('data-admin-only','');a.innerHTML='<span>▦</span><span>Gestão de instalações</span>';bko.insertAdjacentElement('afterend',a)}}})}if(isAdmin){document.querySelectorAll('.sidebar nav').forEach(nav=>{if(!nav.querySelector('a[href="geral.html"]')){const financeiro=nav.querySelector('a[href="financeiro.html"]');if(financeiro){const a=document.createElement('a');a.className='nav-item'+(currentPath==='geral.html'?' active':'');a.href='geral.html';a.setAttribute('data-admin-only','');a.innerHTML='<span>▦</span><span>GERAL</span>';financeiro.insertAdjacentElement('afterend',a)}}})}document.querySelectorAll('[data-admin-only]').forEach(el=>el.hidden=!isAdmin);document.querySelectorAll('.sidebar nav a').forEach(a=>{const label=a.querySelector('span:last-child')?.textContent?.trim();if(label==='Painel'){a.href='painel.html';a.hidden=false;a.removeAttribute('data-admin-only')}});if(!isFinanceiro){document.querySelectorAll('.sidebar nav').forEach(nav=>{if(!nav.querySelector('a[href="ranking-produtividade.html"]')){const painel=nav.querySelector('a[href="painel.html"]');if(painel){const a=document.createElement('a');a.className='nav-item'+(currentPath==='ranking-produtividade.html'?' active':'');a.href='ranking-produtividade.html';a.innerHTML='<span>🏆</span><span>Ranking de produtividade</span>';painel.insertAdjacentElement('afterend',a)}}});}if(['bonus','bonus.html'].includes(currentPath)&&!['admin','vendedora'].includes(profile.role)){location.replace('painel.html');return null}if(['admin','vendedora'].includes(profile.role))addRankingSubmenu(currentPath);if(currentPath==='inteligencia-comercial.html'&&!isAdmin){location.replace('painel.html');return null;}addPanelSubmenu(currentPath,isAdmin);if(currentPath==='configuracoes.html'&&!isAdmin){location.replace('painel.html');return null;}if(currentPath==='ranking-produtividade.html'&&!['vendedora','parceiro','admin'].includes(profile.role)){location.replace('painel.html');return null;}if(isAdmin){document.querySelectorAll('.sidebar nav').forEach(nav=>{if(!nav.querySelector('a[href="financeiro.html"]')){const painel=nav.querySelector('a[href="painel.html"]');if(painel){const a=document.createElement('a');a.className='nav-item';a.href='financeiro.html';a.setAttribute('data-admin-only','');a.innerHTML='<span>▦</span><span>Financeiro</span>';painel.insertAdjacentElement('afterend',a)}}if(!nav.querySelector('a[href="saude.html"]')){const users=nav.querySelector('a[href="usuarios.html"]');if(users){const a=document.createElement('a');a.className='nav-item';a.href='saude.html';a.setAttribute('data-admin-only','');a.innerHTML='<span>♡</span><span>Saúde do sistema</span>';users.insertAdjacentElement('afterend',a)}}})}if(isAdmin){document.querySelectorAll('.sidebar nav').forEach(nav=>{if(!nav.querySelector('a[href="configuracoes.html"]')){const saude=nav.querySelector('a[href="saude.html"]');if(saude){const a=document.createElement('a');a.className='nav-item'+(currentPath==='configuracoes.html'?' active':'');a.href='configuracoes.html';a.setAttribute('data-admin-only','');a.innerHTML='<span>⚙</span><span>Configurações</span>';saude.insertAdjacentElement('afterend',a)}}})}if(isFinanceiro){const onFinance=['financeiro','financeiro.html'].includes(currentPath);const onContacts=['contatos','contatos.html'].includes(currentPath);document.querySelectorAll('.sidebar nav').forEach(nav=>{nav.innerHTML=`<a class="nav-item ${!onFinance&&!onContacts?'active':''}" href="vendas.html"><span>▤</span><span>Minhas vendas</span></a><a class="nav-item ${onFinance?'active':''}" href="financeiro.html"><span>▦</span><span>Financeiro</span></a>`})}if(['comissao','comissao.html'].includes(currentPath)&&!isAdmin){location.replace('painel.html');return null}if(isAdmin){document.querySelectorAll('.sidebar nav').forEach(nav=>{if(nav.querySelector('a[href="comissao.html"]'))return;const financeiro=nav.querySelector('a[href="financeiro.html"]');if(!financeiro)return;const a=document.createElement('a');a.className='nav-item'+(['comissao','comissao.html'].includes(currentPath)?' active':'');a.href='comissao.html';a.setAttribute('data-admin-only','');a.innerHTML='<span>◈</span><span>Comissão</span>';financeiro.insertAdjacentElement('afterend',a)})}{const coverageAllowed=['admin','vendedora','parceiro'].includes(profile.role),coverageAdminPage=['cobertura-gerenciar','cobertura-gerenciar.html'].includes(currentPath),coveragePage=['cobertura','cobertura.html','cobertura-gerenciar','cobertura-gerenciar.html'].includes(currentPath);if(coverageAdminPage&&!isAdmin){location.replace('cobertura.html');return null}if(coveragePage&&!coverageAllowed){location.replace('painel.html');return null}document.querySelectorAll('.sidebar nav').forEach(nav=>{let link=nav.querySelector('a[href="cobertura.html"]');if(!coverageAllowed){link?.remove();return}if(!link){const sales=nav.querySelector('a[href="vendas.html"]');if(!sales)return;link=document.createElement('a');link.href='cobertura.html';link.innerHTML='<span aria-hidden="true">⌖</span><span>Cobertura</span>';sales.insertAdjacentElement('afterend',link)}link.className='nav-item'+(coveragePage?' active':'');link.title='Cobertura';if(coveragePage)link.setAttribute('aria-current','page')})}document.querySelectorAll('.sidebar nav').forEach(nav=>{if(nav.querySelector('a[href="tarefas.html"]'))return;const anchor=nav.querySelector('a[href="cobertura.html"]')||nav.querySelector('a[href="vendas.html"]');if(!anchor)return;const a=document.createElement('a');a.className='nav-item'+(['tarefas','tarefas.html'].includes(currentPath)?' active':'');a.href='tarefas.html';a.title='Minhas tarefas';a.innerHTML='<span aria-hidden="true">✓</span><span>Minhas tarefas</span>';anchor.insertAdjacentElement('afterend',a)});if(canViewContacts)addContactsLink(currentPath);
// Início é a página principal e deve permanecer no menu de todos os perfis.
document.querySelectorAll('.sidebar nav').forEach(nav=>{
  let home=nav.querySelector('a[href="inicio.html"]');
  if(!home){
    home=document.createElement('a');
    home.href='inicio.html';
    home.innerHTML='<span aria-hidden="true">⌂</span><span>Início</span>';
    nav.prepend(home);
  }
  home.className='nav-item'+(['inicio','inicio.html'].includes(currentPath)?' active':'');
  home.title='Início';
  if(['inicio','inicio.html'].includes(currentPath))home.setAttribute('aria-current','page');
  else home.removeAttribute('aria-current');
  if(nav.firstElementChild!==home)nav.prepend(home);
  if(['inicio','inicio.html'].includes(currentPath)){
    nav.querySelectorAll('a.nav-item').forEach(a=>{if(a!==home){a.classList.remove('active');a.removeAttribute('aria-current')}});
  }
});window.currentUser={...user,profile};
if(isPartner){document.querySelectorAll('a[href="index.html"] span:last-child').forEach(el=>el.textContent='Nova indicação');document.querySelectorAll('a[href="vendas.html"] span:last-child').forEach(el=>el.textContent='Minhas indicações');const path=location.pathname.split('/').pop()||'index.html';if(path==='index.html'||path===''){document.querySelector('.topbar-title strong')&&(document.querySelector('.topbar-title strong').textContent='Nova indicação');document.querySelector('.page-heading h1')&&(document.querySelector('.page-heading h1').textContent='Cadastrar nova indicação');document.querySelector('.page-heading p')&&(document.querySelector('.page-heading p').textContent='Preencha os dados abaixo para registrar uma nova indicação.');document.querySelector('.seller-label')&&(document.querySelector('.seller-label').textContent='PARCEIRO RESPONSÁVEL');document.querySelector('#submitButton span')&&(document.querySelector('#submitButton span').textContent='Enviar indicação')}if(path==='vendas.html'){document.querySelector('.topbar-title strong')&&(document.querySelector('.topbar-title strong').textContent='Minhas indicações');document.querySelector('.page-heading h1')&&(document.querySelector('.page-heading h1').textContent='Minhas indicações');document.querySelector('.page-heading p')&&(document.querySelector('.page-heading p').textContent='Acompanhe o andamento das indicações enviadas por você.')}}
if(!document.querySelector('script[src^="notifications.js"]')){const script=document.createElement('script');script.src='notifications.js?v=20261105-no-copy-button';script.onload=()=>window.initNotifications?.();document.body.appendChild(script)}else window.initNotifications?.();if(!document.querySelector('script[src="sale-status-extra.js"]')){const s=document.createElement('script');s.src='sale-status-extra.js';document.body.appendChild(s)}if((location.pathname.split('/').pop()||'')==='vendas.html'&&!document.querySelector('script[src="partner-sales-badge.js"]')){const s=document.createElement('script');s.src='partner-sales-badge.js';document.body.appendChild(s)}if(['bko.html','vendas.html'].includes(location.pathname.split('/').pop()||'')&&!document.querySelector('script[src="installation-flow.js"]')){const s=document.createElement('script');s.src='installation-flow.js?v=20260824-admin-only';document.body.appendChild(s)}if(['bko.html','vendas.html'].includes(location.pathname.split('/').pop()||'')&&!document.querySelector('script[src="aguardando-hp.js"]')){const s=document.createElement('script');s.src='aguardando-hp.js';document.body.appendChild(s)}return window.currentUser})();
let leavingContact = false;
document.querySelectorAll('[data-logout]').forEach(button => button.addEventListener('click', async () => {
  if (leavingContact) return;
  leavingContact = true;
  button.disabled = true;
  const auth = window.supabaseClient.auth;
  try {
    const { data } = await auth.getSession();
    const accessToken = data.session?.access_token;
    if (accessToken) {
      await fetch('https://contact-whatsapp.onrender.com/api/whatsapp/personal/signout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        keepalive: true,
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      });
    }
  } catch {
    // The temporary WhatsApp session expires if the connector cannot be reached.
  }
  await auth.signOut();
  location.replace('login.html');
}));
;(()=>{const sidebar=document.querySelector('.sidebar'),button=document.querySelector('#menuButton');if(!sidebar||!button)return;const KEY='contact-sidebar-collapsed',desktop=window.matchMedia('(min-width:901px)');button.classList.add('sidebar-collapse-button');button.setAttribute('aria-controls','sidebar');sidebar.querySelectorAll('.nav-item').forEach(item=>{const label=item.querySelector('span:nth-child(2)')?.textContent?.trim();if(label)item.title=label});function stored(){try{return localStorage.getItem(KEY)==='true'}catch{return false}}function apply(collapsed,persist){const active=desktop.matches&&collapsed;document.body.classList.toggle('sidebar-collapsed',active);button.textContent=desktop.matches?(active?'›':'‹'):'☰';button.setAttribute('aria-expanded',String(!active));button.setAttribute('aria-label',desktop.matches?(active?'Expandir menu lateral':'Recolher menu lateral'):'Abrir menu');button.title=desktop.matches?(active?'Expandir menu':'Recolher menu'):'Abrir menu';if(persist){try{localStorage.setItem(KEY,String(collapsed))}catch{}}}button.addEventListener('click',event=>{if(!desktop.matches)return;event.preventDefault();event.stopImmediatePropagation();apply(!document.body.classList.contains('sidebar-collapsed'),true)},true);apply(stored(),false);desktop.addEventListener?.('change',()=>apply(stored(),false))})();

;(() => {
  const icons = {"inicio":"<path d=\"m3 10 9-7 9 7v10H3V10Z\"/><path d=\"M9 20v-7h6v7\"/>","contatos":"<rect x=\"5\" y=\"3\" width=\"15\" height=\"18\" rx=\"2\"/><path d=\"M3 7h3m-3 5h3m-3 5h3m3 0a4 4 0 0 1 8 0\"/><circle cx=\"13\" cy=\"10\" r=\"2\"/>","tarefas":"<rect x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"2\"/><path d=\"m7 8 1 1 2-2m3 1h4m-10 6 1 1 2-2m3 1h4\"/>","cobertura":"<circle cx=\"12\" cy=\"12\" r=\"7\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/><path d=\"M12 2v3m0 14v3M2 12h3m14 0h3\"/>","bonus":"<rect x=\"3\" y=\"8\" width=\"18\" height=\"13\" rx=\"2\"/><path d=\"M12 8v13M3 12h18\"/><path d=\"M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z\"/>","comissao":"<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M6 9h.01M18 15h.01\"/>","painel":"<path d=\"M3 3v18h18M7 14v3m5-8v8m5-12v12\"/>","vendas":"<path d=\"M6 7h12l2 14H4L6 7Z\"/><path d=\"M9 7V5a3 3 0 0 1 6 0v2\"/>","index":"<path d=\"M6 7h12l2 14H4L6 7Z\"/><path d=\"M9 7V5a3 3 0 0 1 6 0v2M12 11v6m-3-3h6\"/>","atendimentos":"<path d=\"M21 11a8 8 0 0 1-8 8H7l-4 3v-7a8 8 0 1 1 18-4Z\"/><path d=\"M7 10h10M7 14h6\"/>","chips":"<path d=\"M7 3h7l5 5v13H5V5a2 2 0 0 1 2-2Z\"/><rect x=\"8\" y=\"10\" width=\"8\" height=\"8\" rx=\"1\"/><path d=\"M12 10v8m-4-4h8\"/>","instalacoes":"<rect x=\"3\" y=\"14\" width=\"18\" height=\"7\" rx=\"2\"/><path d=\"M7 18h.01M11 18h.01M6 14V8m12 6V8M8 6a6 6 0 0 1 8 0M10.5 9a2 2 0 0 1 3 0\"/>","bko":"<rect x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"2\"/><path d=\"m7 8 1 1 2-2m3 1h4m-10 6 1 1 2-2m3 1h4\"/>","financeiro":"<path d=\"M20 8V5a2 2 0 0 0-2-2L4 6v13a2 2 0 0 0 2 2h14V8H5a2 2 0 0 1 0-4\"/><path d=\"M20 12h-5v5h5m-3-2.5h.01\"/>","geral":"<rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"/>","usuarios":"<circle cx=\"9\" cy=\"7\" r=\"3\"/><path d=\"M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3\"/>","configuracoes":"<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1.3 1.6V21h-4v-.08A1.7 1.7 0 0 0 8.4 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4 15a1.7 1.7 0 0 0-1.6-1.3H2v-4h.4A1.7 1.7 0 0 0 4 8.4a1.7 1.7 0 0 0-.34-1.88L3.6 6.46 6.46 3.6l.06.06A1.7 1.7 0 0 0 8.4 4a1.7 1.7 0 0 0 1.3-1.6V2h4v.4A1.7 1.7 0 0 0 15 4a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 8.4a1.7 1.7 0 0 0 1.6 1.3h1v4h-1a1.7 1.7 0 0 0-1.6 1.3Z\"/>","saude":"<path d=\"M20 13c4-5-2-12-8-6C6 1 0 8 4 13l8 8 8-8Z\"/><path d=\"M3 12h5l2-4 3 8 2-4h6\"/>","campanhas":"<path d=\"m3 10 17-6v16L3 14v-4Zm4 5 2 6h4l-2-5M20 9l2 1v4l-2 1\"/>","cobrancas":"<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"M3 10h18m-14 5h4\"/>"};
  const style = document.createElement('style');
  style.textContent = '.sidebar .nav-submenu{margin:0 0 7px 24px;padding-left:9px;border-left:1px solid #36515a}.sidebar .nav-submenu .nav-subitem{padding:9px 10px;font-size:12px;margin:2px 0}.sidebar-collapsed .sidebar .nav-submenu{margin-left:0;padding-left:0;border-left:0}.sidebar .nav-item>span.contact-nav-icon{width:20px;min-width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 20px;color:#b4bfce;line-height:1}.sidebar .nav-item>span.contact-nav-icon svg{display:block;width:20px;height:20px}.sidebar .nav-item.active>span.contact-nav-icon{color:#ff6b2c}.sidebar .nav-item:hover>span.contact-nav-icon{color:#ff8a4c}';
  style.textContent += `
    .sidebar .nav-disclosure{width:100%;border:0;background:transparent;font:inherit;font-weight:600;text-align:left;cursor:pointer}
    .sidebar .nav-disclosure:hover{background:#16363c}
    .sidebar .nav-disclosure-caret{width:7px;height:7px;flex:0 0 7px;margin-left:auto;border:solid currentColor;border-width:0 1.5px 1.5px 0;transform:rotate(45deg)}
    .sidebar .nav-disclosure[aria-expanded="true"] .nav-disclosure-caret{transform:rotate(225deg)}
    .sidebar .nav-submenu[hidden]{display:none}
    @media(min-width:901px){.sidebar-collapsed .sidebar .nav-disclosure-caret{display:none}}
  `;
  document.head.appendChild(style);
  function applyMenuIcons() {
    document.querySelectorAll('.sidebar nav a.nav-item').forEach(link => {
      const key = (link.getAttribute('href') || '').split('/').pop().split('?')[0].replace(/\.html$/, '');
      const paths = icons[key];
      const slot = link.querySelector('span:first-child');
      if (!paths || !slot) return;
      slot.classList.add('contact-nav-icon');
      slot.setAttribute('aria-hidden', 'true');
      slot.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">' + paths + '</svg>';
    });
  }
  applyMenuIcons();
  window.authReady?.then(user => { if (user) applyMenuIcons(); }).catch(() => {});
})();

;(() => {
  const theme = document.createElement('link');
  theme.rel = 'stylesheet'; theme.href = 'contact-identity.css?v=20261028';
  document.head.appendChild(theme);
  document.querySelectorAll('.sidebar .brand').forEach(brand => {
    const img = document.createElement('img');
    img.className = 'contact-official-logo'; img.src = 'contact-brand-logo.svg';
    img.alt = 'Contact'; img.width = 154; img.height = 68;
    brand.replaceChildren(img); const homeLink=document.createElement('a');homeLink.href='inicio.html';homeLink.setAttribute('aria-label','Voltar ao início do CONTACT');homeLink.title='Ir para início';homeLink.style.cssText='display:flex;align-items:center;justify-content:center;width:100%;height:100%;text-decoration:none';homeLink.append(img);brand.replaceChildren(homeLink);
  });
})();

;(()=>{if(location.pathname.endsWith('/configuracoes.html'))return;const s=document.createElement('script');s.src='referral-reminder.js?v=20261029-admin-test-2';document.body.appendChild(s)})();

