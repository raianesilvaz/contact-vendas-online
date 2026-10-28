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
    return '<button class="sale-card modern-sale-card ' + (selectedId === s.id ? 'selected' : '') + '" data-id="' + escapeHtml(s.id) + '" data-operator="' + escapeHtml(name) + '" aria-label="Abrir venda de ' + escapeHtml(s.customer_name) + '"><div class="modern-sale-top"><div class="card-badges"><span class="status-badge ' + (cssStatus[s.status] || 'analise') + '"><i></i>' + escapeHtml(labels[s.status] || s.status) + '</span>' + acceptanceBadge(s) + companyBadge + '</div><small>Recebida ' + escapeHtml(formatDateTime(s.created_at)) + '</small></div><h2>' + escapeHtml(s.customer_name) + partner + '</h2><p class="modern-sale-plan">' + escapeHtml(s.seller?.full_name || '—') + ' · ' + escapeHtml(s.plan_name || '') + '</p><div class="modern-sale-contract">' + (s.contract_number ? 'Contrato <b>' + escapeHtml(s.contract_number) + '</b>' : '') + '</div><div class="modern-sale-installation">' + installationCardInfo(s) + '</div><div class="modern-sale-bottom"><span class="modern-sale-logo">' + logo + '</span><span class="modern-sale-obs" title="' + escapeHtml(s.bko_return || 'Aguardando retorno do BKO') + '">' + escapeHtml(s.bko_return || 'Aguardando retorno do BKO') + '</span></div></button>';
  };
  window.card.__partnerAware = true;
  let previous = root.classList.contains('modern-visual-enabled');
  new MutationObserver(() => {
    const active = root.classList.contains('modern-visual-enabled');
    if (active !== previous) { previous = active; window.render?.(); }
  }).observe(root,{attributes:true,attributeFilter:['class']});
  window.render?.();
})();
