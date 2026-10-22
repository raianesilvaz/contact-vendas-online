(() => {
  const form = document.querySelector('#saleForm');
  const el = name => form.elements.namedItem(name);
  const cep = el('address_cep'), button = document.querySelector('#lookupCep'), status = document.querySelector('#cepStatus'), noNumber = document.querySelector('#addressNoNumber');
  let sequence = 0, controller = null, lastCep = '';
  const clean = value => String(value || '').trim().replace(/\s+/g, ' ');
  function syncAddress() {
    el('address_number').required = !noNumber.checked;
    el('address_number').disabled = noNumber.checked;
    el('endereco').value = cep.value + ' - ' + clean(el('address_street').value) + ', ' + (noNumber.checked ? 'S/N' : clean(el('address_number').value)) + ' - ' + clean(el('address_district').value) + ' - ' + clean(el('address_city').value) + '/' + el('address_state').value;
  }
  async function lookup(force = false) {
    const digits = cep.value.replace(/\D/g, '');
    if (digits.length !== 8) { status.textContent = 'Informe um CEP com 8 dígitos.'; return; }
    if (!force && digits === lastCep) return;
    controller?.abort();
    controller = new AbortController();
    const activeController = controller, token = ++sequence;
    const snapshot = ['address_street', 'address_district', 'address_city', 'address_state'].map(name => [name, el(name).value]);
    button.disabled = true;
    status.textContent = 'Buscando endereço...';
    const timer = setTimeout(() => activeController.abort(), 8000);
    try {
      const response = await fetch('https://viacep.com.br/ws/' + digits + '/json/', { signal: activeController.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error('Consulta indisponível');
      const data = await response.json();
      if (token !== sequence || cep.value.replace(/\D/g, '') !== digits) return;
      if (data.erro) { status.textContent = 'CEP não encontrado. Confira o CEP ou preencha o endereço manualmente.'; return; }
      const values = [data.logradouro, data.bairro, data.localidade, data.uf];
      snapshot.forEach(([name, previous], index) => {
        if (el(name).value === previous) el(name).value = values[index] || '';
      });
      lastCep = digits;
      status.textContent = '';
      syncAddress();
    } catch (_) {
      if (token === sequence) status.textContent = 'Não foi possível consultar. Preencha manualmente ou clique em Buscar CEP para tentar novamente.';
    } finally {
      clearTimeout(timer);
      if (token === sequence) button.disabled = false;
    }
  }
  cep.addEventListener('input', () => {
    ++sequence; controller?.abort(); button.disabled = false; lastCep = '';
    const digits = cep.value.replace(/\D/g, '').slice(0, 8);
    cep.value = digits.replace(/^(\d{5})(\d)/, '$1-$2');
    status.textContent = '';
    syncAddress();
    if (digits.length === 8) lookup();
  });
  cep.addEventListener('blur', () => lookup());
  button.addEventListener('click', () => lookup(true));
  noNumber.addEventListener('change', syncAddress);
  form.addEventListener('input', syncAddress);
  form.addEventListener('change', syncAddress);
  form.addEventListener('submit', syncAddress, true);
  form.addEventListener('reset', () => {
    ++sequence; controller?.abort(); lastCep = ''; button.disabled = false;
    status.textContent = '';
    setTimeout(syncAddress, 0);
  });
  syncAddress();
})();
