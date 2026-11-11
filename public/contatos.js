(() => {
  const byId = id => document.getElementById(id);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char]));
  const digits = value => String(value ?? '').replace(/\D/g, '');
  const normalize = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const statusLabels = {
    conectado:'Conectada', reprovada:'Reprovada', cancelada:'Cancelada',
    pendente:'Aguardando análise', em_analise:'Em análise', aguardando_hp:'Aguardando HP',
    pendente_aceite:'Aceite pendente', pendente_instalacao:'Pendente de instalação'
  };
  const timeZone = 'America/Sao_Paulo';
  const isoDate = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' });
  const dateLabel = day => day ? day.split('-').reverse().join('/') : 'Data não informada';
  const filters = ['contactSearch', 'contactStatus', 'contactStart', 'contactEnd'].map(byId);
  const pageSize = 25;
  let contacts = [];
  let page = 1;

  function phoneNumber(value) {
    const text = String(value ?? '').trim();
    const number = digits(text);
    if (!/^[+\d\s().-]+$/.test(text) || !number) return text;
    if (number.length === 10 || number.length === 11) return '+55' + number;
    return '+' + number;
  }

  function phoneLabel(phone) {
    return phone.replace(/^\+55(\d{2})(\d{4,5})(\d{4})$/, '+55 ($1) $2-$3');
  }

  const stateCode = '(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)';
  const labeledState = new RegExp(String.raw`\b(?:estado|uf)\s*:?\s*${stateCode}\b`, 'i');
  const endingState = new RegExp(String.raw`(?:\s*[/–-]\s*|\s+\(?)${stateCode}\)?$`, 'i');
  const cityName = /^[\p{L}][\p{L} .’'-]*$/u;

  function addressCity(address) {
    const text = String(address ?? '').trim();
    const labeled = text.match(/(?:^|[,;\n])\s*cidade\s*:?\s*([^,;\n]+)/i);
    const location = (labeled?.[1] || text).replace(/\s*(?:[,;–-]\s*)?(?:CEP\s*:?\s*)?\d{5}-?\d{3}\s*$/i, '').trim();
    const suffix = location.match(endingState);
    if (!labeled && !suffix) return '';
    const cityPart = suffix ? location.slice(0, suffix.index).trim() : location;
    const city = labeled ? cityPart : cityPart.split(/[,;\n]|\s+[–-]\s+/).at(-1).trim();
    if (!cityName.test(city)) return '';
    const state = suffix?.[1] || text.match(labeledState)?.[1];
    return state ? city + '/' + state.toUpperCase() : city;
  }

  function organizeSales(sales) {
    const groups = new Map();
    for (const sale of sales.sort((a,b) => (b.created_at || '').localeCompare(a.created_at || ''))) {
      const cpf = digits(sale.cpf);
      const key = cpf.length === 11 ? 'cpf:' + cpf : 'sale:' + sale.id;
      if (!groups.has(key)) groups.set(key, { name:'', city:'', seller:sale.seller?.full_name?.trim() || '', phones:new Set(), sales:[] });
      const contact = groups.get(key);
      contact.name ||= sale.customer_name?.trim() || '';
      contact.city ||= addressCity(sale.full_address);
      for (const value of [sale.phone_1, sale.phone_2]) {
        const phone = phoneNumber(value);
        if (phone) contact.phones.add(phone);
      }
      contact.sales.push({
        status:sale.status,
        operator:sale.operators?.name || 'Operadora não informada',
        day:sale.created_at ? isoDate.format(new Date(sale.created_at)) : ''
      });
    }
    return [...groups.values()].map(contact => {
      const phones = [...contact.phones].map(phoneLabel);
      return { ...contact, phones, title:contact.name || phones[0] || 'Cliente sem nome' };
    });
  }

  function statusBadge(status) {
    const tone = status === 'conectado' ? 'conectado' : ['reprovada','cancelada'].includes(status) ? 'reprovada' : 'analise';
    return `<span class="status-badge ${tone}"><i></i>${safe(statusLabels[status] || 'Situação não informada')}</span>`;
  }

  function render() {
    const [term, status, start, end] = filters.map(field => field.value.trim());
    const phoneTerm = /^[+\d\s().-]+$/.test(term) ? digits(term) : '';
    const matches = contacts.flatMap((contact,index) => {
      if (term && !normalize(contact.title).includes(normalize(term)) &&
          !(phoneTerm && contact.phones.some(phone => digits(phone).includes(phoneTerm)))) return [];
      const sales = contact.sales.filter(sale => (!start || sale.day >= start) && (!end || sale.day && sale.day <= end));
      const statuses = [...new Set(sales.map(sale => sale.status))];
      if (!sales.length) return [];
      if (status === 'ambas' && !(statuses.includes('conectado') && statuses.includes('reprovada'))) return [];
      if (status && status !== 'ambas' && !statuses.includes(status)) return [];
      return [{ contact,index,sales,statuses }];
    });
    matches.sort((a,b) => b.sales[0].day.localeCompare(a.sales[0].day));
    const pages = Math.max(1, Math.ceil(matches.length/pageSize));
    page = Math.min(page,pages);
    byId('contactsCount').textContent = matches.length + (matches.length === 1 ? ' contato encontrado' : ' contatos encontrados');
    byId('contactsPager').hidden = pages === 1;
    byId('contactsPage').textContent = `Página ${page} de ${pages}`;
    byId('contactPrevious').disabled = page === 1;
    byId('contactNext').disabled = page === pages;
    byId('contactRows').innerHTML = matches.slice((page-1)*pageSize,page*pageSize).map(({contact,index,sales,statuses}) => {
      const initials = contact.name.split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase();
      return `<button type="button" class="contacts-row" data-contact-index="${index}" aria-label="Abrir contato ${safe(contact.title)}">
        <span class="contacts-person"><span class="avatar" aria-hidden="true">${safe(initials || '#')}</span><span><strong>${safe(contact.title)}</strong>${contact.city ? `<span class="contacts-label contacts-city">${safe(contact.city)}</span>` : ''}</span></span>
        <span><span class="contacts-label">Telefones</span>${contact.phones.map(phone => `<span class="contacts-number">${safe(phone)}</span>`).join('') || 'Telefone não informado'}</span>
        <span><span class="contacts-label">Vendas no período · ${sales.length}</span>${statuses.map(statusBadge).join('')}</span>
        <span><span class="contacts-label">Venda mais recente no período</span>${dateLabel(sales[0].day)}<span class="contacts-label contacts-seller">Vendedora da última venda</span><strong>${safe(contact.seller || 'Não informada')}</strong></span>
        <span class="contacts-arrow" aria-hidden="true">›</span>
      </button>`;
    }).join('') || '<p class="contacts-empty">Nenhum contato encontrado com esses filtros.</p>';
  }

  async function load() {
    const status = byId('contactsStatus');
    try {
      const user = await window.authReady;
      if (!user || !['admin','vendedora','financeiro'].includes(user.profile?.role)) return;
      status.textContent = 'Carregando contatos…';
      const sales = [];
      let lastId;
      for (;;) {
        let query = window.supabaseClient.from('sales')
          .select('id,cpf,customer_name,phone_1,phone_2,status,created_at,full_address,operators(name),seller:profiles!sales_seller_id_fkey(full_name)')
          .order('id').limit(500);
        if (user.profile.role === 'vendedora') query = query.eq('seller_id',user.id);
        if (lastId) query = query.gt('id',lastId);
        const {data,error} = await query;
        if (error) throw error;
        sales.push(...data);
        if (data.length < 500) break;
        lastId = data.at(-1).id;
      }
      contacts = organizeSales(sales);
      render();
      byId('contactsSummary').textContent = contacts.length + (contacts.length === 1 ? ' contato no total' : ' contatos no total');
      status.hidden = true;
      byId('contactsDirectory').hidden = false;
    } catch {
      status.textContent = 'Não foi possível carregar os contatos. Atualize a página para tentar novamente.';
    }
  }

  for (const filter of filters) filter.addEventListener('input', () => { page = 1; render(); });
  byId('contactClear').onclick = () => {
    filters.forEach(filter => { filter.value = ''; });
    page = 1;
    render();
  };
  byId('contactPrevious').onclick = () => { page--; render(); };
  byId('contactNext').onclick = () => { page++; render(); };
  byId('contactRows').onclick = event => {
    const row = event.target.closest('[data-contact-index]');
    if (!row) return;
    const contact = contacts[Number(row.dataset.contactIndex)];
    byId('contactName').textContent = contact.title;
    byId('contactCity').textContent = contact.city || 'Não informada';
    byId('contactSeller').textContent = contact.seller || 'Não informada';
    byId('contactPhones').innerHTML = contact.phones.map(phone => `<li>${safe(phone)}</li>`).join('') || '<li>Telefone não informado</li>';
    byId('contactSales').innerHTML = contact.sales.map(sale => `<li class="contacts-sale"><span>${safe(sale.operator)} · ${dateLabel(sale.day)}</span>${statusBadge(sale.status)}</li>`).join('');
    byId('contactDetail').showModal();
  };
  byId('menuButton').onclick = () => byId('sidebar').classList.toggle('open');
  load();
})();
