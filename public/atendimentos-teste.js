(async () => {
  const status = document.getElementById('status');
  const login = document.getElementById('login');
  const showLogin = () => {
    status.textContent = 'Entre no CONTACT e depois reabra este link para testar a tela.';
    login.hidden = false;
  };

  try {
    if (!await window.authReady) return showLogin();
    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error || !data.session?.access_token) return showLogin();
    const response = await fetch('/api/atendimentos-teste', {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      cache: 'no-store',
    });
    if (response.status === 401) return showLogin();
    if (response.status === 403) {
      status.textContent = 'Esta prévia está disponível para administração, vendas e financeiro.';
      return;
    }
    if (!response.ok) throw new Error('Preview unavailable');
    const preview = document.getElementById('preview');
    preview.srcdoc = await response.text();
    preview.hidden = false;
    document.getElementById('notice').hidden = true;
  } catch {
    status.textContent = 'Não foi possível carregar a prévia. Atualize a página para tentar de novo.';
  }
})();
