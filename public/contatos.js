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
      ? 'whatsapp://send?phone=' + number + '&text=' + encodeURIComponent(whatsappMessage)
      : '';
  }
  const whatsappIcon = "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M20.52 3.48A11.88 11.88 0 0 0 12.05 0C5.45 0 .07 5.37.06 11.98c0 2.11.55 4.17 1.61 5.99L0 24l6.19-1.62a11.9 11.9 0 0 0 5.86 1.49h.01c6.6 0 11.98-5.38 11.99-11.99a11.9 11.9 0 0 0-3.53-8.4ZM12.06 21.85a9.85 9.85 0 0 1-5.03-1.38l-.36-.21-3.73.98.99-3.64-.24-.38a9.88 9.88 0 0 1-1.52-5.24C2.18 6.49 6.57 2.1 12.06 2.1c2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.9 7c-.01 5.48-4.41 9.85-9.89 9.85Zm5.42-7.39c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.23-.65.08-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.11 3.22 5.11 4.52.71.31 1.27.49 1.71.63.72.23 1.37.2 1.89.12.58-.09 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z\"/></svg>";
  function contactPhonesCell(contact) {
    const numbers = contact.phones.filter(phone => whatsappLink(phone));
    const phones = contact.phones.map(phone => '<span class="contacts-number">' + safe(phone) + '</span>').join('') || 'Telefone não informado';
    return '<span class="contacts-phone-cell"><span class="contacts-phone-numbers">' + phones + '</span>' +
      (numbers.length ? '<button type="button" class="contacts-whatsapp whatsapp-contact-link" data-whatsapp-contact aria-label="Chamar contato no WhatsApp" title="Chamar no WhatsApp">' + whatsappIcon + '</button>' : '') + '</span>';
  }
  function openContactWhatsapp(contact) {
    const numbers = [...new Map(contact.phones.filter(phone => whatsappLink(phone)).map(phone => [digits(phone), phone])).values()];
    if (!numbers.length) return;
    const dialog = byId('contactWhatsappDialog');
    const options = byId('contactWhatsappNumbers');
    options.replaceChildren();
    numbers.forEach((phone, index) => {
      const link = document.createElement('a');
      link.href = whatsappLink(phone);
      link.textContent = 'Telefone ' + (index + 1) + ': ' + phone.replace(/^\\+55 /, '');
      link.addEventListener('click', () => dialog.close());
      options.appendChild(link);
    });
    dialog.showModal();
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
        <span><span class="contacts-label">Telefones</span>${contactPhonesCell(contact)}</span>
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
    return manualStatus || contact.manualStatus || (contact.sales?.length ? 'venda' : '');
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
      const [sales, leads, manual] = await Promise.all([
        loadPages('sales', 'id,cpf,customer_name,phone_1,phone_2,status,created_at,full_address,operators(name),seller:profiles!sales_seller_id_fkey(full_name)', 'id', seller ? user.id : undefined),
        seller ? [] : loadPages('contact_leads', 'phone,city', 'phone'),
        loadPages('contact_manual', 'id,name,phone,city,seller_id,status,created_at', 'id', seller ? user.id : undefined)
      ]);
      const customers = organizeSales(sales);
      const sellers = await window.supabaseClient.from('profiles').select('id,full_name,role,active').eq('active',true);
      if (sellers.error) throw sellers.error;
      const sellerNames = new Map((sellers.data || []).map(item => [item.id,item.full_name]));
      const manualContacts = manual.map(item => ({lead:true,manual:true,name:item.name || '',title:item.name || phoneLabel('+' + item.phone),city:item.city,phones:[phoneLabel('+' + item.phone)],seller:sellerNames.get(item.seller_id) || '',manualStatus:item.status,sales:[]}));
      contacts = [...customers, ...organizeLeads(leads, customers), ...manualContacts];
      const sellerSelect = byId('newContactSeller');
      sellerSelect.replaceChildren(new Option('Selecione a vendedora',''));
      for (const item of (sellers.data || []).filter(item => item.role === 'vendedora' || item.role === 'admin')) sellerSelect.add(new Option(item.full_name,item.id));
      if (seller) { sellerSelect.value=user.id; sellerSelect.dataset.ownerId=user.id; sellerSelect.disabled=true; }
      else sellerSelect.disabled=false;
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

  const cityInput = byId('newContactCity');
  const cityOptions = byId('newContactCitySuggestions');
  let cityCatalog = null;
  let cityMatches = [];
  let citySelected = '';
  let cityActive = -1;
  const cityNormalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  async function loadCities() {
    if (cityCatalog) return cityCatalog;
    const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado');
    if (!response.ok) throw Error('Municípios indisponíveis');
    const items = await response.json();
    cityCatalog = items.map(item => ({label:item['municipio-nome'] + '/' + item['UF-sigla'],name:cityNormalize(item['municipio-nome']),uf:item['UF-sigla']}));
    return cityCatalog;
  }
  function closeCityOptions() {
    cityOptions.hidden=true;
    cityInput.setAttribute('aria-expanded','false');
    cityActive=-1;
  }
  function chooseCity(item) {
    citySelected=item.label;
    cityInput.value=item.label;
    closeCityOptions();
  }
  function showCityOptions() {
    const term=cityNormalize(cityInput.value);
    citySelected=citySelected===cityInput.value ? citySelected : '';
    cityMatches=term.length>=2 && cityCatalog ? cityCatalog.filter(item => item.name.startsWith(term)).sort((a,b) => a.name.localeCompare(b.name,'pt-BR')).slice(0,9) : [];
    cityOptions.replaceChildren(...cityMatches.map((item,index) => {
      const option=document.createElement('button');
      option.type='button';option.className='contact-city-option';option.setAttribute('role','option');
      option.textContent=item.label;
      option.addEventListener('mousedown',event=>event.preventDefault());
      option.addEventListener('click',()=>chooseCity(item));
      return option;
    }));
    cityOptions.hidden=!cityMatches.length;
    cityInput.setAttribute('aria-expanded',String(Boolean(cityMatches.length)));
  }
  cityInput.addEventListener('input',async()=>{
    if (!cityCatalog && cityInput.value.trim().length>=2) {
      try {await loadCities();} catch {cityOptions.hidden=true;return;}
    }
    showCityOptions();
  });
  cityInput.addEventListener('keydown',event=>{
    if (event.key==='Escape') {closeCityOptions();return;}
    if (event.key==='Tab' && cityMatches.length===1 && !cityOptions.hidden) {chooseCity(cityMatches[0]);return;}
    if (event.key==='ArrowDown' && !cityOptions.hidden) {event.preventDefault();cityActive=(cityActive+1)%cityMatches.length;cityOptions.querySelectorAll('button').forEach((button,index)=>button.classList.toggle('is-active',index===cityActive));return;}
    if (event.key==='Enter' && !cityOptions.hidden && cityMatches.length) {event.preventDefault();chooseCity(cityMatches[cityActive>=0?cityActive:0]);}
  });
  cityInput.addEventListener('blur',()=>setTimeout(closeCityOptions,120));

  // Máscara de telefone brasileiro aplicada durante a digitação.
  const newContactPhone = byId('newContactPhone');
  function formatNewContactPhone(value) {
    let number = digits(value).slice(0,13);
    if (number.startsWith('55') && number.length > 11) number = number.slice(2);
    number = number.slice(0,11);
    if (!number) return '';
    if (number.length < 3) return '(' + number;
    const ddd = '(' + number.slice(0,2) + ') ';
    const local = number.slice(2);
    if (local.length <= 4) return ddd + local;
    return ddd + local.slice(0,local.length > 8 ? 5 : 4) + '-' + local.slice(local.length > 8 ? 5 : 4);
  }
  newContactPhone.addEventListener('input', () => {
    const before = newContactPhone.selectionStart;
    const digitsBefore = digits(newContactPhone.value.slice(0,before)).length;
    newContactPhone.value = formatNewContactPhone(newContactPhone.value);
    let position = 0, seen = 0;
    while (position < newContactPhone.value.length && seen < digitsBefore) {
      if (/\\d/.test(newContactPhone.value[position])) seen++;
      position++;
    }
    newContactPhone.setSelectionRange(position,position);
  });

  const newContactStatus = byId('newContactStatus');
  for (const [value,label] of Object.entries(treatmentLabels)) newContactStatus.add(new Option(label,value));
  byId('newContactOpen').onclick = () => { byId('newContactForm').reset(); citySelected=''; closeCityOptions(); if (byId('newContactSeller').disabled) byId('newContactSeller').value = byId('newContactSeller').dataset.ownerId || ''; byId('newContactFeedback').textContent=''; byId('newContactDialog').showModal(); };
  byId('newContactForm').onsubmit = async event => {
    event.preventDefault();
    const form = byId('newContactForm');
    const submit = byId('newContactSave');
    const feedback = byId('newContactFeedback');
    const raw = digits(byId('newContactPhone').value);
    const phone = raw.length===10 || raw.length===11 ? '55'+raw : raw;
    const city = byId('newContactCity').value.trim();
    const seller_id = byId('newContactSeller').value;
    const status = newContactStatus.value;
    if (!/^55[1-9]\d{9,10}$/.test(phone) || !city || !seller_id || !Object.hasOwn(treatmentLabels,status)) {
      feedback.textContent='Preencha cidade, telefone válido, vendedora e status.'; return;
    }
    submit.disabled=true;
    feedback.textContent='Salvando contato…';
    try {
      const {error}=await window.supabaseClient.from('contact_manual').insert({name:byId('newContactName').value.trim() || null,city,phone,seller_id,status});
      if(error) throw error;
      byId('newContactDialog').close();
      await load();
    } catch(error) {
      feedback.textContent=error.code==='23505' ? 'Este telefone já foi cadastrado manualmente.' : 'Não foi possível salvar o contato. Confira os dados e tente novamente.';
    } finally {submit.disabled=false;}
  };

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
    const whatsapp = event.target.closest('[data-whatsapp-contact]');
    if (whatsapp) {
      const row = whatsapp.closest('[data-contact-index]');
      if (row) openContactWhatsapp(contacts[Number(row.dataset.contactIndex)]);
      return;
    }
    const row = event.target.closest('[data-contact-index]');
    if (!row) return;
    const contact = contacts[Number(row.dataset.contactIndex)];
    byId('contactName').textContent = contact.title;
    byId('contactCity').textContent = contact.city || 'Não informada';
    byId('contactSeller').parentElement.hidden = Boolean(contact.lead && !contact.manual);
    byId('contactSeller').textContent = contact.seller || 'Não informada';
    byId('contactPhones').innerHTML = contact.phones.map(phone => `<li>${safe(phone)}</li>`).join('') || '<li>Telefone não informado</li>';
    byId('contactSales').innerHTML = contact.sales.map(sale => `<li class="contacts-sale"><span>${safe(sale.operator)} · ${dateLabel(sale.day)}</span>${statusBadge(sale.status)}</li>`).join('') || '<li>Sem venda registrada.</li>';
    byId('contactDetail').showModal();
    void openTreatment(contact);
  };
  byId('menuButton').onclick = () => byId('sidebar').classList.toggle('open');
  load();
})();
