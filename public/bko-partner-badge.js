(() => {
  const partnerIds = new Set();
  let observer = null;

  function decorateCards() {
    document.querySelectorAll('.bko-card[data-id]').forEach(card => {
      const id = card.dataset.id;
      const title = card.querySelector('.bko-card-body h2');
      if (!title) return;
      const existing = title.querySelector('.partner-origin-badge');
      if (partnerIds.has(id)) {
        if (!existing) title.insertAdjacentHTML('beforeend', '<span class="partner-origin-badge">Parceiro</span>');
      } else if (existing) {
        existing.remove();
      }
    });
  }

  async function refreshPartnerIds() {
    const user = await window.authReady;
    if (!user || user.profile.role !== 'admin') return;
    const { data, error } = await window.supabaseClient.from('sales').select('id').eq('origin', 'parceiro');
    if (error) return;
    partnerIds.clear();
    (data || []).forEach(item => partnerIds.add(item.id));
    decorateCards();
  }

  window.authReady?.then(() => {
    refreshPartnerIds();
    const list = document.querySelector('#salesList');
    if (list) {
      observer = new MutationObserver(decorateCards);
      observer.observe(list, { childList: true, subtree: true });
    }
    window.supabaseClient.channel('partner-origin-bko-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, refreshPartnerIds)
      .subscribe();
  });
})();
