(() => {
  const byId = id => document.getElementById(id);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char]));
  const digits = value => String(value ?? '').replace(/\D/g, '');
  const normalize = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const whatsappMessage = "🤔 POSSO TE CONTAR UMA COISA?\n\nVocê pode ter internet em casa, internet no celular e Globoplay pagando apenas **R$ 89,90 por mês!** 😍\n\nIsso mesmo!\n\n🌐 600 MEGA\n📱 CHIP com 40GB\n🎬 Globoplay incluso\n\nUma oferta dessas merece pelo menos uma olhadinha, né?\n\nMe responde **QUERO SABER** que te explico! 💬";
  function whatsappLink(phone) {
    const number = digits(phone);
    return /^55[1-9]\d{9,10}$/.test(number)
      ? 'https://api.whatsapp.com/send?phone=' + number + '&text=' + encodeURIComponent(whatsappMessage)
      : '';
  }
  function phoneWithWhatsapp(phone) {
    const link = whatsappLink(phone);
    return '<span class="contacts-phone-line"><span class="contacts-number">' + safe(phone) + '</span>' +
      (link ? '<a class="contacts-whatsapp" href="' + safe(link) + '" target="_blank" rel="noopener noreferrer" aria-label="Abrir WhatsApp para ' + safe(phone) + '" title="Abrir no WhatsApp">☎</a>' : '') + '</span>';
  }

  const statusLabels = {
    sem_venda:'Sem venda',
    conectado:'Conectada', reprovada:'Reprovada', cancelada:'Cancelada',
    pendente:'Aguardando análise', em_analise:'Em análise', aguardando_hp:'Aguardando HP',
    pendente_aceite:'Aceite pendente', pendente_instalacao:'Pendente de instalação'
  };
  const timeZone = 'America/Sao_Paulo';
  const isoDate = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' });
  const dateLabel = day => day ? day.split('-').reverse().join('/') : 'Data não informada';
  const filters = ['contactSearch', 'contactStatus', 'contactStart', 'contactEnd', 'contactTreatmentFilter'].map(byId);
  const treatmentLabels = {
    venda:'Venda', inviabilidade:'Inviabilidade', sem_interacao:'Sem interação',
    restricao_cpf:'Restrição CPF', clicou_sem_querer:'Clicou sem querer',
    debitos_com_operadora:'Débitos com operadora', chance_venda_retorno:'Chance de venda - retorno',
    cliente:'Cliente', em_contato:'Em contato',
    contratou_outra_operadora:'Contratou com outra operadora', inv_total:'Inv. total'
  };
  const previousTreatmentLabels = {
    a_tratar:'A tratar', em_atendimento:'Em atendimento', aguardando_retorno:'Aguardando retorno',
    encerrado_sem_venda:'Encerrado sem venda', nao_contatar:'Não contatar'
  };
  const treatmentDate = new Intl.DateTimeFormat('pt-BR', { timeZone, dateStyle:'short', timeStyle:'short' });
  const pageSize = 25;
  let pageRevision = 0;
  let detailRevision = 0;
  let detail = null;
  let contacts = [];
  let page = 1;
  let filterRevision = 0;
  let treatmentIndexRequest;

  function phoneNumber(value) {
    const text = String(value ?? '').trim();
    const number = digits(text).replace(/^0(?=[1-9]\d{9,10}$)/, '');
    if (!/^[+\d\s().-]+$/.test(text) || !number) return text;
    if (number.length === 10 || number.length === 11) return '+55' + number;
    return '+' + number;
  }

  function treatmentPhones(contact) {
    return [...new Set(contact.phones.flatMap(value => {
      if (!/^[+\d\s().-]+$/.test(value)) return [];
      const number = digits(value).replace(/^550(?=[1-9]\d{9,10}$)/, '55');
      return /^55[1-9]\d{9,10}$/.test(number) ? [number] : [];
    }))];
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

  async function render() {
    const revision = ++filterRevision;
    const filter = byId('contactTreatmentFilter').value;
    if (!filter) {
      renderList();
      return;
    }

    if (!treatmentIndexRequest) {
      byId('contactsCount').textContent = 'Carregando status de atendimento…';
      byId('contactRows').replaceChildren();
      byId('contactsPager').hidden = true;
      pageRevision++;
      treatmentIndexRequest = loadTreatmentIndex();
    }
    const request = treatmentIndexRequest;
    try {
      const index = await request;
      if (revision === filterRevision) renderList(index);
    } catch {
      if (request === treatmentIndexRequest) treatmentIndexRequest = null;
      if (revision !== filterRevision) return;
      byId('contactsCount').textContent = 'Não foi possível carregar os status. Selecione o filtro novamente para tentar.';
      byId('contactRows').replaceChildren();
      byId('contactsPager').hidden = true;
      pageRevision++;
    }
  }

  function renderList(treatmentIndex) {
    const [term, status, start, end, treatmentFilter] = filters.map(field => field.value.trim());
    const phoneTerm = /^[+\d\s().-]+$/.test(term) ? digits(term) : '';
    const matches = contacts.flatMap((contact,index) => {
      if (term && !normalize(contact.title).includes(normalize(term)) &&
          !(phoneTerm && contact.phones.some(phone => digits(phone).includes(phoneTerm)))) return [];
      if (treatmentIndex) {
        const phones = treatmentPhones(contact);
        const status = effectiveTreatmentStatus(contact, latestTreatmentStatus(phones, treatmentIndex));
        if (!phones.length || (treatmentFilter === 'sem_status' ? status : status !== treatmentFilter)) return [];
      }
      if (contact.lead) {
        return !start && !end && (!status || status === 'sem_venda')
          ? [{ contact,index,sales:[],statuses:['sem_venda'] }]
          : [];
      }
      const sales = contact.sales.filter(sale => (!start || sale.day >= start) && (!end || sale.day && sale.day <= end));
      const statuses = [...new Set(sales.map(sale => sale.status))];
      if (!sales.length) return [];
      if (status === 'ambas' && !(statuses.includes('conectado') && statuses.includes('reprovada'))) return [];
      if (status && status !== 'ambas' && !statuses.includes(status)) return [];
      return [{ contact,index,sales,statuses }];
    });
    matches.sort((a,b) => (b.sales[0]?.day || '').localeCompare(a.sales[0]?.day || ''));
    const pages = Math.max(1, Math.ceil(matches.length/pageSize));
    page = Math.min(page,pages);
    byId('contactsCount').textContent = matches.length + (matches.length === 1 ? ' contato encontrado' : ' contatos encontrados');
    byId('contactsPager').hidden = pages === 1;
    byId('contactsPage').textContent = `Página ${page} de ${pages}`;
    byId('contactPrevious').disabled = page === 1;
    byId('contactNext').disabled = page === pages;
    byId('contactRows').innerHTML = matches.slice((page-1)*pageSize,page*pageSize).map(({contact,index,sales,statuses}) => {
      const initials = contact.name.split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase();
      return `<div class="contacts-row" role="button" tabindex="0" data-contact-index="${index}" aria-label="Abrir contato ${safe(contact.title)}">
        <span class="contacts-person"><span class="avatar" aria-hidden="true">${safe(initials || '#')}</span><span><strong>${safe(contact.title)}</strong>${contact.city ? `<span class="contacts-label contacts-city">${safe(contact.city)}</span>` : ''}</span></span>
        <span><span class="contacts-label">Telefones</span>${contact.phones.map(phoneWithWhatsapp).join('') || 'Telefone não informado'}</span>
        <span class="contacts-statuses">
          <span><span class="contacts-label">${contact.lead ? 'Vendas no período' : `Vendas no período · ${sales.length}`}</span><span class="contacts-sale-badges">${contact.lead ? statusBadge('sem_venda') : statuses.map(statusBadge).join('')}</span></span>
          <span class="contacts-treatment"><span class="contacts-label">Atendimento</span><strong class="contacts-treatment-badge" data-treatment-status>Carregando…</strong><span data-treatment-note class="contacts-treatment-note" hidden></span></span>
        </span>
        ${contact.lead ? '' : `<span class="contacts-sale-info">
          <span><span class="contacts-label">Última venda no período</span>${sales[0].day ? `<time datetime="${safe(sales[0].day)}">${dateLabel(sales[0].day)}</time>` : dateLabel('')}</span>
          <span><span class="contacts-label">Vendedora da última venda</span><strong>${safe(contact.seller || 'Não informada')}</strong></span>
        </span>`}
        <span class="contacts-arrow" aria-hidden="true">›</span>
      </div>`;
    }).join('') || '<p class="contacts-empty">Nenhum contato encontrado com esses filtros.</p>';
    void renderTreatmentSummaries();
  }

  async function loadTreatmentIndex() {
    const index = new Map();
    let cursor;
    for (;;) {
      let query = window.supabaseClient.from('contact_treatment_summaries')
        .select('phone,id,status,created_at').not('status', 'is', null).order('phone').limit(500);
      if (cursor) query = query.gt('phone', cursor);
      const {data,error} = await query;
      if (error) throw error;
      for (const event of data) index.set(event.phone, event);
      if (data.length < 500) return index;
      cursor = data.at(-1).phone;
    }
  }

  // Todo contato originado de uma venda recebe Venda como status padrão.
  // Um atendimento classificado manualmente mantém sua classificação.
  function effectiveTreatmentStatus(contact, manualStatus) {
    return manualStatus || (contact.sales?.length ? 'venda' : '');
  }

  function latestTreatmentStatus(phones, index) {
    let latest;
    for (const phone of phones) {
      const event = index.get(phone);
      if (event && (!latest || newestFirst(event, latest) < 0)) latest = event;
    }
    return latest?.status || '';
  }

  async function renderTreatmentSummaries() {
    const revision = ++pageRevision;
    const rows = [...byId('contactRows').querySelectorAll('[data-contact-index]')];
    const phonesByRow = rows.map(row => treatmentPhones(contacts[Number(row.dataset.contactIndex)]));
    const phones = [...new Set(phonesByRow.flat())];
    let events = [];
    let failed = false;
    if (phones.length) {
      try {
        for (let start = 0; start < phones.length; start += 150) {
          const {data,error} = await window.supabaseClient.from('contact_treatment_summaries')
            .select('phone,id,status,note,created_at').in('phone', phones.slice(start,start+150));
          if (error) throw error;
          events.push(...data);
        }
      } catch {
        failed = true;
      }
    }
    if (revision !== pageRevision) return;
    events.sort(newestFirst);
    const statusIndex = new Map(events.filter(event => event.status).map(event => [event.phone, event]));
    rows.forEach((row,index) => {
      const linked = phonesByRow[index];
      const contact = contacts[Number(row.dataset.contactIndex)];
      const status = effectiveTreatmentStatus(contact, latestTreatmentStatus(linked, statusIndex));
      const badge = row.querySelector('[data-treatment-status]');
      badge.dataset.tone = linked.length && !failed ? status : 'neutral';
      badge.textContent =
        !linked.length ? 'Telefone indisponível' : failed ? 'Indisponível' : treatmentLabels[status] || previousTreatmentLabels[status] || 'Sem status';
      const note = row.querySelector('[data-treatment-note]');
      note.textContent = failed ? '' : events.find(event => event.note && linked.includes(event.phone))?.note || '';
      note.hidden = !note.textContent;
    });
  }

  function newestFirst(a,b) {
    return b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id);
  }

  async function loadPages(table, columns, key, sellerId, phones) {
    const records = [];
    let cursor;
    for (;;) {
      let query = window.supabaseClient.from(table).select(columns).order(key).limit(500);
      if (sellerId) query = query.eq('seller_id', sellerId);
      if (phones) query = query.in('phone', phones);
      if (cursor) query = query.gt(key, cursor);
      const {data,error} = await query;
      if (error) throw error;
      records.push(...data);
      if (data.length < 500) return records;
      cursor = data.at(-1)[key];
    }
  }

  function organizeLeads(leads, customers) {
    const customerPhones = new Set(customers.flatMap(contact => contact.phones.map(digits)));
    return leads.filter(lead => !customerPhones.has(lead.phone)).map(lead => {
      const phone = phoneLabel('+' + lead.phone);
      return { lead:true, name:'', title:phone, city:lead.city, phones:[phone], seller:'', sales:[] };
    });
  }

  async function load() {
    const status = byId('contactsStatus');
    try {
      const user = await window.authReady;
      if (!user || !['admin','vendedora','financeiro'].includes(user.profile?.role)) return;
      status.textContent = 'Carregando contatos…';
      const seller = user.profile.role === 'vendedora';
      const [sales, leads] = await Promise.all([
        loadPages('sales', 'id,cpf,customer_name,phone_1,phone_2,status,created_at,full_address,operators(name),seller:profiles!sales_seller_id_fkey(full_name)', 'id', seller ? user.id : undefined),
        seller ? [] : loadPages('contact_leads', 'phone,city', 'phone')
      ]);
      const customers = organizeSales(sales);
      contacts = [...customers, ...organizeLeads(leads, customers)];
      byId('contactLeadOption').hidden = seller;
      byId('contactLeadOption').disabled = seller;
      render();
      byId('contactsSummary').textContent = contacts.length + (contacts.length === 1 ? ' contato no total' : ' contatos no total');
      status.hidden = true;
      byId('contactsDirectory').hidden = false;
    } catch {
      status.textContent = 'Não foi possível carregar os contatos. Atualize a página para tentar novamente.';
    }
  }

  async function openTreatment(contact, message = '') {
    const revision = ++detailRevision;
    detail = null;
    const phones = treatmentPhones(contact);
    const form = byId('contactTreatmentForm');
    const feedback = byId('contactTreatmentFeedback');
    const history = byId('contactTreatmentHistory');
    form.hidden = true;
    history.replaceChildren();
    feedback.textContent = phones.length ? 'Carregando atendimento…' : 'Cadastre um telefone válido para registrar o atendimento.';
    if (!phones.length) return;
    try {
      const events = await loadPages('contact_treatments', 'id,phone,status,note,author_name,created_at', 'id', undefined, phones);
      if (revision !== detailRevision) return;
      events.sort(newestFirst);
      const currentStatus = effectiveTreatmentStatus(contact, events.find(event => event.status)?.status || '');
      detail = {contact,phone:phones[0],status:currentStatus,retry:null};
      const isNewStatus = Object.hasOwn(treatmentLabels, currentStatus);
      byId('contactTreatmentPlaceholder').textContent = previousTreatmentLabels[currentStatus] || 'Selecione um status';
      byId('contactTreatmentStatus').value = isNewStatus ? currentStatus : '';
      byId('contactTreatmentNote').value = '';
      byId('contactTreatmentSave').disabled = false;
      byId('contactTreatmentStatus').disabled = false;
      byId('contactTreatmentNote').disabled = false;
      history.innerHTML = events.filter(event => event.note).map(event =>
        `<li><small>${safe(event.author_name)} · ${safe(treatmentDate.format(new Date(event.created_at)))}</small><p>${safe(event.note)}</p></li>`
      ).join('') || '<li>Nenhuma observação registrada.</li>';
      feedback.textContent = message;
      form.hidden = false;
    } catch {
      if (revision === detailRevision) feedback.textContent = 'Não foi possível carregar o atendimento. Feche a ficha e tente novamente.';
    }
  }

  const treatmentSelect = byId('contactTreatmentStatus');
  for (const [value, label] of Object.entries(treatmentLabels)) {
    treatmentSelect.add(new Option(label, value));
    byId('contactTreatmentFilter').add(new Option(label, value));
  }

  byId('contactTreatmentForm').onsubmit = async event => {
    event.preventDefault();
    const session = detail;
    const button = byId('contactTreatmentSave');
    if (!session || button.disabled) return;
    const status = byId('contactTreatmentStatus').value || session.status;
    const note = byId('contactTreatmentNote').value.trim();
    const feedback = byId('contactTreatmentFeedback');
    if ((status !== session.status && !Object.hasOwn(treatmentLabels,status)) || (status === session.status && !note)) {
      feedback.textContent = 'Altere o status ou escreva uma observação.';
      return;
    }
    const changedStatus = status === session.status ? null : status;
    if (!session.retry || session.retry.status !== changedStatus || session.retry.note !== (note || null)) {
      session.retry = {id:crypto.randomUUID(), phone:session.phone, status:changedStatus, note:note || null};
    }
    const statusField = byId('contactTreatmentStatus');
    const noteField = byId('contactTreatmentNote');
    button.disabled = statusField.disabled = noteField.disabled = true;
    feedback.textContent = 'Salvando…';
    try {
      const {error} = await window.supabaseClient.from('contact_treatments')
        .upsert(session.retry, {onConflict:'id',ignoreDuplicates:true});
      if (error) throw error;
      treatmentIndexRequest = null;
      if (byId('contactTreatmentFilter').value) void render();
      else void renderTreatmentSummaries();
      if (detail === session) await openTreatment(session.contact, 'Atendimento salvo.');
    } catch {
      if (detail === session) {
        feedback.textContent = 'Não foi possível confirmar o salvamento. Tente novamente.';
        button.disabled = statusField.disabled = noteField.disabled = false;
      }
    }
  };

  byId('contactDetail').addEventListener('close', () => {
    detailRevision++;
    detail = null;
  });

  for (const filter of filters) filter.addEventListener('input', () => {
    if (filter.id === 'contactTreatmentFilter') treatmentIndexRequest = null;
    page = 1;
    void render();
  });
  byId('contactClear').onclick = () => {
    filters.forEach(filter => { filter.value = ''; });
    page = 1;
    render();
  };
  byId('contactPrevious').onclick = () => { page--; render(); };
  byId('contactNext').onclick = () => { page++; render(); };
  byId('contactRows').addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.contacts-row')) {
      event.preventDefault();
      event.target.click();
    }
  });
  byId('contactRows').onclick = event => {
    if (event.target.closest('.contacts-whatsapp')) return;
    const row = event.target.closest('[data-contact-index]');
    if (!row) return;
    const contact = contacts[Number(row.dataset.contactIndex)];
    byId('contactName').textContent = contact.title;
    byId('contactCity').textContent = contact.city || 'Não informada';
    byId('contactSeller').parentElement.hidden = Boolean(contact.lead);
    byId('contactSeller').textContent = contact.seller || 'Não informada';
    byId('contactPhones').innerHTML = contact.phones.map(phone => `<li>${safe(phone)}</li>`).join('') || '<li>Telefone não informado</li>';
    byId('contactSales').innerHTML = contact.sales.map(sale => `<li class="contacts-sale"><span>${safe(sale.operator)} · ${dateLabel(sale.day)}</span>${statusBadge(sale.status)}</li>`).join('') || '<li>Sem venda registrada.</li>';
    byId('contactDetail').showModal();
    void openTreatment(contact);
  };
  byId('menuButton').onclick = () => byId('sidebar').classList.toggle('open');
  load();
})();
