(() => {
  if (!document.querySelector('link[rel="icon"]')) {
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/svg+xml';
    favicon.href = 'favicon.svg';
    document.head.appendChild(favicon);
  }
  if (!document.querySelector('link[href="notifications.css"]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'notifications.css';
    document.head.appendChild(stylesheet);
  }
  if (!document.querySelector('link[href="sale-status-extra.css"]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'sale-status-extra.css';
    document.head.appendChild(stylesheet);
  }
})();

window.authReady = (async () => {
  const { data: { user }, error } = await window.supabaseClient.auth.getUser();
  if (error || !user) { window.location.replace('login.html'); return null; }
  const { data: profile } = await window.supabaseClient.from('profiles').select('full_name, role, active').eq('id', user.id).single();
  if (!profile || !profile.active) { await window.supabaseClient.auth.signOut(); window.location.replace('login.html'); return null; }
  const roleNames = { vendedora:'Vendedor', parceiro:'Parceiro', admin:'Administrador' };
  const initials = profile.full_name.split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase();
  document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = profile.full_name);
  document.querySelectorAll('[data-user-role]').forEach(el => el.textContent = roleNames[profile.role] || 'Usuário');
  document.querySelectorAll('[data-user-initials]').forEach(el => el.textContent = initials);
  const isAdmin = profile.role === 'admin';
  const isPartner = profile.role === 'parceiro';
  document.querySelectorAll('[data-admin-only]').forEach(el => el.hidden = !isAdmin);
  window.currentUser = { ...user, profile };

  if (isPartner) {
    document.querySelectorAll('a[href="index.html"] span:last-child').forEach(el => el.textContent = 'Nova indicação');
    document.querySelectorAll('a[href="vendas.html"] span:last-child').forEach(el => el.textContent = 'Minhas indicações');
    const path = location.pathname.split('/').pop() || 'index.html';
    if (path === 'index.html' || path === '') {
      const topStrong = document.querySelector('.topbar-title strong');
      if (topStrong) topStrong.textContent = 'Nova indicação';
      const heading = document.querySelector('.page-heading h1');
      if (heading) heading.textContent = 'Cadastrar nova indicação';
      const headingText = document.querySelector('.page-heading p');
      if (headingText) headingText.textContent = 'Preencha os dados abaixo para registrar uma nova indicação.';
      const sellerLabel = document.querySelector('.seller-label');
      if (sellerLabel) sellerLabel.textContent = 'PARCEIRO RESPONSÁVEL';
      const submitText = document.querySelector('#submitButton span');
      if (submitText) submitText.textContent = 'Enviar indicação';
    }
    if (path === 'vendas.html') {
      const topStrong = document.querySelector('.topbar-title strong');
      if (topStrong) topStrong.textContent = 'Minhas indicações';
      const heading = document.querySelector('.page-heading h1');
      if (heading) heading.textContent = 'Minhas indicações';
      const headingText = document.querySelector('.page-heading p');
      if (headingText) headingText.textContent = 'Acompanhe o andamento das indicações enviadas por você.';
    }
  }

  if (!document.querySelector('script[src="notifications.js"]')) {
    const script = document.createElement('script');
    script.src = 'notifications.js';
    script.onload = () => window.initNotifications?.();
    document.body.appendChild(script);
  } else {
    window.initNotifications?.();
  }

  if (!document.querySelector('script[src="sale-status-extra.js"]')) {
    const statusScript = document.createElement('script');
    statusScript.src = 'sale-status-extra.js';
    document.body.appendChild(statusScript);
  }

  return window.currentUser;
})();
document.querySelectorAll('[data-logout]').forEach(button => button.addEventListener('click', async () => { await window.supabaseClient.auth.signOut(); window.location.replace('login.html'); }));
