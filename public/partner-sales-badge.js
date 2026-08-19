(() => {
  const originalCard = window.card;
  if (typeof originalCard !== 'function') return;

  window.card = function partnerAwareCard(s) {
    const html = originalCard(s);
    if (s?.origin !== 'parceiro') return html;
    const safeName = typeof window.escapeHtml === 'function' ? window.escapeHtml(s.customer_name) : String(s.customer_name || '');
    const plainTitle = `<h2>${safeName}</h2>`;
    const taggedTitle = `<h2>${safeName}<span class="partner-sales-tag">PARCEIRO</span></h2>`;
    return html.replace(plainTitle, taggedTitle);
  };
})();
