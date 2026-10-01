(() => {
  const panel = document.querySelector('#detailPanel');
  const bucket = window.supabaseClient.storage.from('sale-attachments');
  const lifetime = 48 * 60 * 60 * 1000;
  let currentSale = null;

  async function download(saleId, file, button) {
    button.disabled = true;
    button.textContent = 'Baixando...';
    try {
      const { data, error } = await bucket.download(`${saleId}/${file.name}`);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name.replace(/^[0-9a-f-]{36}-/, '');
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      window.showToast?.('Falha ao baixar', 'O arquivo pode ter expirado. Atualize a venda e tente novamente.', true);
    } finally {
      button.disabled = false;
      button.textContent = 'Baixar';
    }
  }

  async function showFiles(saleId, list) {
    list.hidden = false;
    list.textContent = 'Carregando anexos...';
    const { data, error } = await bucket.list(saleId, { limit: 100, sortBy: { column: 'created_at', order: 'asc' } });
    if (!list.isConnected || currentSale !== saleId) return;
    list.replaceChildren();
    if (error) {
      const message = document.createElement('span');
      message.className = 'sale-download-error';
      message.textContent = 'Não foi possível carregar os anexos. Tente novamente.';
      list.appendChild(message);
      return;
    }
    const files = (data || []).filter(file => file.id && Date.now() - new Date(file.created_at).getTime() < lifetime);
    if (!files.length) { list.textContent = 'Nenhum anexo disponível para esta venda.'; return; }
    for (const file of files) {
      const row = document.createElement('div');
      const label = document.createElement('span');
      label.textContent = file.name.replace(/^[0-9a-f-]{36}-/, '');
      const expiry = document.createElement('small');
      expiry.textContent = `Disponível até ${new Date(new Date(file.created_at).getTime() + lifetime).toLocaleString('pt-BR')}`;
      label.appendChild(expiry);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Baixar';
      button.addEventListener('click', () => download(saleId, file, button));
      row.append(label, button);
      list.appendChild(row);
    }
  }

  function mount() {
    const section = [...panel.querySelectorAll('.detail-section')].find(el => el.querySelector('h3')?.textContent.trim() === 'Dados da venda');
    if (!section || section.querySelector('.sale-download-toggle')) return;
    const saleId = selectedId;
    if (!saleId) return;
    currentSale = saleId;
    const heading = document.createElement('div');
    heading.className = 'sale-attachments-head';
    section.querySelector('h3').replaceWith(heading);
    const title = document.createElement('h3');
    title.textContent = 'Dados da venda';
    const toggle = document.createElement('button');
    toggle.className = 'sale-download-toggle';
    toggle.type = 'button';
    toggle.textContent = '📎 Baixar anexos';
    heading.append(title, toggle);
    const list = document.createElement('div');
    list.className = 'sale-download-list';
    list.hidden = true;
    heading.insertAdjacentElement('afterend', list);
    toggle.addEventListener('click', () => {
      if (!list.hidden) { list.hidden = true; return; }
      showFiles(saleId, list);
    });
  }
  new MutationObserver(mount).observe(panel, { childList: true, subtree: true });
  mount();
})();
