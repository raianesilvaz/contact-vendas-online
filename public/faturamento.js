(async function () {
  const user = await window.authReady;
  if (!user) return;
  if (user.profile.role !== 'admin') {
    window.location.replace('vendas.html');
    return;
  }
  document.querySelector('#menuButton')?.addEventListener('click', () => document.querySelector('#sidebar')?.classList.toggle('open'));
})();