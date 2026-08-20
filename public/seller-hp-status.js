(() => {
  if ((location.pathname.split('/').pop() || '') !== 'vendas.html') return;

  function enableHpStatus() {
    try {
      if (typeof labels !== 'undefined') labels.aguardando_hp = 'Aguardando HP';
      if (typeof cssStatus !== 'undefined') cssStatus.aguardando_hp = 'analise';

      const tabs = document.querySelector('#filterTabs');
      if (tabs && !tabs.querySelector('[data-filter="aguardando_hp"]')) {
        const analysis = tabs.querySelector('[data-filter="em_analise"]');
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.filter = 'aguardando_hp';
        button.textContent = 'Aguardando HP';
        if (analysis) analysis.insertAdjacentElement('afterend', button);
        else tabs.appendChild(button);
      }

      if (typeof render === 'function' && !render.__hpWrapped) {
        const baseRender = render;
        const hpRender = function (...args) {
          const result = baseRender.apply(this, args);
          try {
            const pending = document.querySelector('#pendingCount');
            if (pending && typeof sales !== 'undefined') {
              pending.textContent = sales.filter(s => ['pendente','em_analise','aguardando_hp','pendente_aceite'].includes(s.status)).length;
            }
          } catch (_) {}
          return result;
        };
        hpRender.__hpWrapped = true;
        render = hpRender;
      }

      if (typeof render === 'function') render();
    } catch (error) {
      console.error('Não foi possível habilitar Aguardando HP para o vendedor.', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enableHpStatus, { once: true });
  else enableHpStatus();
})();