(() => {
  const value = 'pendente_instalacao';
  const label = 'Pendente de instalação';

  function addFilter() {
    const tabs = document.querySelector('#filterTabs');
    if (!tabs || tabs.querySelector(`[data-filter="${value}"]`)) return;
    const ref = tabs.querySelector('[data-filter="conectado"]');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.filter = value;
    button.textContent = label;
    if (ref) tabs.insertBefore(button, ref); else tabs.appendChild(button);
  }

  function addStatusOption() {
    document.querySelectorAll('select[name="status"]').forEach(select => {
      if (select.querySelector(`option[value="${value}"]`)) return;
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      const ref = select.querySelector('option[value="conectado"]');
      if (ref) select.insertBefore(option, ref); else select.appendChild(option);
    });
  }

  function paintBadges() {
    document.querySelectorAll('.status-badge').forEach(badge => {
      const text = badge.textContent.trim();
      if (text !== value && text !== 'undefined' && text !== label) return;
      badge.classList.remove('analise','aceite','conectado','reprovada','aprovada','concluida');
      badge.classList.add('pendente-instalacao');
      badge.innerHTML = `<i></i>${label}`;
      const detail = badge.closest('.detail-header')?.parentElement;
      const returnBox = detail?.querySelector('.bko-return');
      if (returnBox) {
        returnBox.classList.remove('analise','aceite','conectado','reprovada','aprovada','concluida','undefined');
        returnBox.classList.add('pendente-instalacao');
      }
    });
  }

  function fixToast() {
    const message = document.querySelector('#toastMessage');
    if (!message) return;
    message.textContent = message.textContent.replace('undefined', label).replace(value, label);
  }

  function enhance() {
    addFilter();
    addStatusOption();
    paintBadges();
    fixToast();
  }

  document.addEventListener('change', event => {
    const select = event.target.closest?.('select[name="status"]');
    if (!select || select.value !== value) return;
    const form = select.closest('form');
    const textarea = form?.querySelector('textarea[name="bko_return"]');
    if (textarea && !textarea.value.trim()) textarea.placeholder = label;
  });

  document.addEventListener('submit', event => {
    const form = event.target;
    const select = form?.querySelector?.('select[name="status"]');
    const textarea = form?.querySelector?.('textarea[name="bko_return"]');
    if (select?.value === value && textarea && !textarea.value.trim()) textarea.value = label;
  }, true);

  const observer = new MutationObserver(enhance);
  observer.observe(document.documentElement, { childList:true, subtree:true, characterData:true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance);
  else enhance();
})();