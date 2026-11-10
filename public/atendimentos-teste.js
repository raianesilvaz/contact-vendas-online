(async () => {
  const status = document.getElementById('status');
  const login = document.getElementById('login');
  const notice = document.getElementById('notice');
  const preview = document.getElementById('preview');
  let signedOut = false;
  const showLogin = () => {
    signedOut = true;
    preview.hidden = true;
    preview.removeAttribute('srcdoc');
    notice.hidden = false;
    status.textContent = 'Entre no CONTACT e depois reabra este link para testar a tela.';
    login.hidden = false;
  };
  const connector = 'https://contact-whatsapp.onrender.com';
  const methods = {status:'GET',connect:'POST',disconnect:'POST',send:'POST'};
  const session = () => window.supabaseClient.auth.getSession();

  try {
    if (!await window.authReady) return showLogin();
    window.supabaseClient.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') showLogin();
    });
    window.addEventListener('pageshow', event => {
      if (event.persisted) session().then(({ data }) => {
        if (!data.session?.access_token) showLogin();
      }).catch(showLogin);
    });
    const { data, error } = await session();
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
    window.addEventListener('message', async event => {
      const {id,action,payload} = event.data || {};
      if (signedOut || event.source!==preview.contentWindow || event.origin!=='null' || event.data?.source!=='contact-personal-whatsapp' || !Number.isSafeInteger(id) || !Object.hasOwn(methods,action)) return;
      const reply = result => event.source.postMessage({source:'contact-personal-whatsapp-response',id,...result},'*');
      try {
        const {data} = await session();
        const accessToken = data.session?.access_token;
        if (!accessToken) return showLogin();
        if (signedOut) return;
        const url=new URL(`/api/whatsapp/personal/${action}`,connector);
        if (action==='status'&&typeof payload?.jid==='string') url.searchParams.set('jid',payload.jid.slice(0,60));
        const body=action==='send'?JSON.stringify({message:payload?.message,jid:payload?.jid,phone:payload?.phone}):undefined;
        const res=await fetch(url,{method:methods[action],headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body,cache:'no-store',redirect:'error'});
        if (res.status === 401 || res.status === 403) return showLogin();
        const value=await res.json();
        if (signedOut) return;
        return res.ok?reply({value}):reply({error:value.error||'Não foi possível concluir esta operação.'});
      } catch {
        reply({error:'Não foi possível consultar o conector. Tente novamente.'});
      }
    });
    const markup = await response.text();
    if (signedOut) return;
    preview.srcdoc = markup;
    preview.hidden = false;
    notice.hidden = true;
  } catch {
    status.textContent = 'Não foi possível carregar Atendimentos. Atualize a página para tentar de novo.';
  }
})();
