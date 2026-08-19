(() => {
  const value = 'pendente_instalacao';
  const label = 'Pendente de instalação';
  let scheduled = false;

  function addFilter() {
    const tabs = document.querySelector('#filterTabs');
    if (!tabs || tabs.querySelector(`[data-filter="${value}"]`)) return false;
    const ref = tabs.querySelector('[data-filter="conectado"]');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.filter = value;
    button.textContent = label;
    if (ref) tabs.insertBefore(button, ref); else tabs.appendChild(button);
    return true;
  }

  function addStatusOption() {
    let changed = false;
    document.querySelectorAll('select[name="status"]').forEach(select => {
      if (select.querySelector(`option[value="${value}"]`)) return;
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      const ref = select.querySelector('option[value="conectado"]');
      if (ref) select.insertBefore(option, ref); else select.appendChild(option);
      changed = true;
    });
    return changed;
  }

  function paintBadges() {
    let changed = false;
    document.querySelectorAll('.status-badge').forEach(badge => {
      const text = badge.textContent.trim();
      if (text !== value && text !== 'undefined' && text !== label) return;

      if (!badge.classList.contains('pendente-instalacao')) {
        badge.classList.remove('analise','aceite','conectado','reprovada','aprovada','concluida');
        badge.classList.add('pendente-instalacao');
        changed = true;
      }
      if (badge.textContent.trim() !== label) {
        badge.innerHTML = `<i></i>${label}`;
        changed = true;
      }

      const detail = badge.closest('.detail-header')?.parentElement;
      const returnBox = detail?.querySelector('.bko-return');
      if (returnBox && !returnBox.classList.contains('pendente-instalacao')) {
        returnBox.classList.remove('analise','aceite','conectado','reprovada','aprovada','concluida','undefined');
        returnBox.classList.add('pendente-instalacao');
        changed = true;
      }
    });
    return changed;
  }

  function fixToast() {
    const message = document.querySelector('#toastMessage');
    if (!message) return false;
    const current = message.textContent;
    if (!current.includes('undefined') && !current.includes(value)) return false;
    message.textContent = current.replaceAll('undefined', label).replaceAll(value, label);
    return true;
  }

  function enhance() {
    scheduled = false;
    addFilter();
    addStatusOption();
    paintBadges();
    fixToast();
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
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

  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.body, { childList:true, subtree:true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance, { once:true });
  else enhance();
})();