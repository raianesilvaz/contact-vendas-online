(() => {
  const originalCard = window.card;
  if (typeof originalCard !== 'function') return;
  const root = document.documentElement;
  window.card = function(s) {
    if (!root.classList.contains('modern-visual-enabled')) return originalCard(s);
    const name = s.operators?.name || 'Operadora';
    const key = ['claro','vero','desktop','alares'].find(key => name.toLowerCase().includes(key));
    const logo = key ? '<img src="operator-logos/' + key + '.svg" alt="' + escapeHtml(name) + '" width="76" height="30">' : '<span>' + escapeHtml(name) + '</span>';
    const company = s.partner_company || (s.is_rampin ? 'Rampin' : '');
    const companyBadge = company ? '<span class="rampin-badge" title="' + escapeHtml(company) + '">' + escapeHtml(company[0].toUpperCase()) + '</span>' : '';
    const partner = s.origin === 'parceiro' ? '<span class="partner-sales-tag">PARCEIRO</span>' : '';
    const status=cssStatus[s.status]||'analise';
    const install=s.installation_date?'Instalada em '+formatDate(s.installation_date):s.scheduled_installation_date?'Prevista: '+formatDate(s.scheduled_installation_date)+(s.scheduled_installation_start?' · '+String(s.scheduled_installation_start).slice(0,5):'')+(s.scheduled_installation_end?' às '+String(s.scheduled_installation_end).slice(0,5):''):['reprovada','cancelada'].includes(s.status)?'Não agendada':'Aguardando agendamento';
    const note=s.bko_return||'Aguardando retorno do BKO';
    const contract=s.contract_number?escapeHtml(s.contract_number):'Não informado';
    return '<button class="sale-card modern-sale-card ' + (selectedId === s.id ? 'selected' : '') + '" data-id="' + escapeHtml(s.id) + '" data-operator="' + escapeHtml(name) + '" aria-label="Abrir venda de ' + escapeHtml(s.customer_name) + '">'+
      '<div class="modern-sale-top"><div class="card-badges"><span class="status-badge '+status+'"><i></i>'+escapeHtml(labels[s.status]||s.status)+'</span>'+acceptanceBadge(s)+companyBadge+'</div><small>Recebida '+escapeHtml(formatDateTime(s.created_at))+'</small></div>'+
      '<div class="modern-sale-person"><h2>'+escapeHtml(s.customer_name)+partner+'</h2><p class="modern-sale-plan"><span aria-hidden="true">♙</span> '+escapeHtml(s.seller?.full_name||'—')+' <span class="modern-sale-separator">│</span> <span aria-hidden="true">◉</span> '+escapeHtml(s.plan_name||'Não informado')+'</p></div>'+
      '<div class="modern-sale-facts"><div><span class="modern-fact-icon" aria-hidden="true">▦</span><span><small>Instalação</small><strong>'+escapeHtml(install)+'</strong></span></div><div><span class="modern-fact-icon" aria-hidden="true">▤</span><span><small>Contrato</small><strong>'+contract+'</strong></span></div></div>'+
      '<div class="modern-sale-bottom"><span class="modern-sale-logo">'+logo+'</span><span class="modern-sale-obs" title="'+escapeHtml(note)+'"><span aria-hidden="true">◯</span> '+escapeHtml(note)+'</span><span class="modern-sale-arrow" aria-hidden="true">›</span></div></button>';
  };
  window.card.__partnerAware = true;
  let previous = root.classList.contains('modern-visual-enabled');
  new MutationObserver(() => {
    const active = root.classList.contains('modern-visual-enabled');
    if (active !== previous) { previous = active; window.render?.(); }
  }).observe(root,{attributes:true,attributeFilter:['class']});
  window.render?.();
})();
