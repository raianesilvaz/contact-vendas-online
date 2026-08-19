window.authReady = (async () => {
  const { data: { user }, error } = await window.supabaseClient.auth.getUser();
  if (error || !user) { window.location.replace('login.html'); return null; }
  const { data: profile } = await window.supabaseClient.from('profiles').select('full_name, role, active').eq('id', user.id).single();
  if (!profile || !profile.active) { await window.supabaseClient.auth.signOut(); window.location.replace('login.html'); return null; }
  const roleNames = { vendedora:'Vendedora', bko:'BKO', supervisora:'Supervisora', admin:'Administradora' };
  const initials = profile.full_name.split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase();
  document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = profile.full_name);
  document.querySelectorAll('[data-user-role]').forEach(el => el.textContent = roleNames[profile.role] || 'Usuário');
  document.querySelectorAll('[data-user-initials]').forEach(el => el.textContent = initials);
  const isBko = ['bko', 'admin'].includes(profile.role);
  document.querySelectorAll('[data-bko-only]').forEach(el => el.hidden = !isBko);
  window.currentUser = { ...user, profile };
  return window.currentUser;
})();
document.querySelectorAll('[data-logout]').forEach(button => button.addEventListener('click', async () => { await window.supabaseClient.auth.signOut(); window.location.replace('login.html'); }));
