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
  const roleNames = { vendedora:'Vendedor', admin:'Administrador' };
  const initials = profile.full_name.split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase();
  document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = profile.full_name);
  document.querySelectorAll('[data-user-role]').forEach(el => el.textContent = roleNames[profile.role] || 'Usuário');
  document.querySelectorAll('[data-user-initials]').forEach(el => el.textContent = initials);
  const isAdmin = profile.role === 'admin';
  document.querySelectorAll('[data-admin-only]').forEach(el => el.hidden = !isAdmin);
  window.currentUser = { ...user, profile };

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
