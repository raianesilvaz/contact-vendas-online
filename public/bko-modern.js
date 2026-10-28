(() => {
  const tabs = document.querySelector('#filterTabs');
  if (!tabs) return;
  const label = document.createElement('label');
  label.className = 'modern-bko-filter';
  const text = document.createElement('span');
  text.textContent = 'Status da fila';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Filtrar fila por status');
  label.append(text, select);
  tabs.after(label);
  function sync() {
    const buttons = [...tabs.querySelectorAll('button[data-filter]')];
    const selected = buttons.find(button => button.classList.contains('active'));
    select.replaceChildren(...buttons.map(button => {
      const option = document.createElement('option');
      option.value = button.dataset.filter;
      option.textContent = button.textContent;
      return option;
    }));
    select.value = selected?.dataset.filter || 'todos';
  }
  select.addEventListener('change', () => {
    [...tabs.querySelectorAll('button[data-filter]')].find(button => button.dataset.filter === select.value)?.click();
  });
  new MutationObserver(sync).observe(tabs, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  sync();
})();
