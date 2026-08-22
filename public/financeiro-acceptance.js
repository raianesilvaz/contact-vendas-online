(() => {
  let enabled = false;
  let scheduled = false;

  function scheduleSync() {
    if (!enabled || scheduled) return;
    scheduled = true;
    requestAnimationFrame(syncControl);
  }

  function syncControl() {
    scheduled = false;
    const panel = document.querySelector('#detailPanel');
    if (!panel?.classList.contains('open')) return;
    if (panel.querySelector('.financeiro-acceptance-control')) return;
    if (typeof selectedId === 'undefined' || typeof sales === 'undefined') return;

    const sale = sales.find(item => item.id === selectedId);
    if (!sale) return;

    const control = document.createElement('label');
    control.className = 'acceptance-toggle financeiro-acceptance-control';
    control.innerHTML = `<input type="checkbox" ${sale.acceptance_completed ? 'checked' : ''}><span><b>Aceite realizado</b><small>Marque quando o aceite do cliente estiver concluído. Esta é a única alteração permitida ao Financeiro.</small></span>`;

    const returnBox = panel.querySelector('.bko-return');
    const header = panel.querySelector('.detail-header');
    (returnBox || header)?.insertAdjacentElement('afterend', control);

    control.querySelector('input').addEventListener('change', async event => {
      const input = event.currentTarget;
      const completed = input.checked;
      input.disabled = true;

      const { error } = await window.supabaseClient.rpc('set_sale_acceptance', {
        p_sale_id: sale.id,
        p_completed: completed,
      });

      if (error) {
        input.checked = !completed;
        input.disabled = false;
        window.alert(error.message || 'Não foi possível atualizar o aceite.');
        return;
      }

      await loadSales(true);
    });
  }

  window.authReady.then(user => {
    if (!user || user.profile.role !== 'financeiro') return;
    enabled = true;
    new MutationObserver(scheduleSync).observe(document.querySelector('#detailPanel') || document.body, {
      childList: true,
      subtree: true,
    });
    scheduleSync();
  }).catch(error => console.error('Aceite do Financeiro:', error));
})();
