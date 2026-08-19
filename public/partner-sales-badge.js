(() => {
  let attempts = 0;
  const install = () => {
    if (typeof window.card !== 'function') {
      if (attempts++ < 80) setTimeout(install, 50);
      return;
    }
    if (window.card.__partnerAware) return;
    const originalCard = window.card;
    const partnerAwareCard = function (s) {
      const html = originalCard(s);
      if (s?.origin !== 'parceiro') return html;
      const safeName = String(s.customer_name ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
      const plainTitle = `<h2>${safeName}</h2>`;
      const taggedTitle = `<h2>${safeName}<span class="partner-sales-tag">PARCEIRO</span></h2>`;
      return html.replace(plainTitle, taggedTitle);
    };
    partnerAwareCard.__partnerAware = true;
    window.card = partnerAwareCard;
    if (typeof window.render === 'function') window.render();
  };
  install();
})();
