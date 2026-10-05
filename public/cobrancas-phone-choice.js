(() => {
  const dialog = document.createElement('dialog');
  dialog.className = 'collection-phone-choice';
  dialog.setAttribute('aria-labelledby', 'collectionPhoneChoiceTitle');
  const title = document.createElement('h2');
  title.id = 'collectionPhoneChoiceTitle';
  title.textContent = 'Escolha o telefone';
  const description = document.createElement('p');
  description.textContent = 'A mensagem será aberta no WhatsApp para o número escolhido.';
  const options = document.createElement('div');
  options.className = 'collection-phone-options';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'collection-phone-close';
  close.textContent = 'Cancelar';
  close.addEventListener('click', () => dialog.close());
  dialog.append(title, description, options, close);
  document.body.appendChild(dialog);

  function displayPhone(phone) {
    const local = phone.startsWith('55') ? phone.slice(2) : phone;
    return local.length === 11
      ? local.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
      : local.length === 10
        ? local.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3')
        : phone;
  }

  document.addEventListener('click', event => {
    const action = event.target.closest('.collection-item .wa-btn[data-phone-2]');
    if (!action) return;
    const phone1 = action.dataset.phone1;
    const phone2 = action.dataset.phone2;
    if (!phone1 || !phone2 || phone1 === phone2) return;
    event.preventDefault();
    options.replaceChildren();
    for (const [label, phone] of [['Telefone 1', phone1], ['Telefone 2', phone2]]) {
      const link = document.createElement('a');
      const url = new URL(action.href);
      url.pathname = `/${phone}`;
      link.href = url.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `${label}: ${displayPhone(phone)}`;
      link.addEventListener('click', () => dialog.close());
      options.appendChild(link);
    }
    dialog.showModal();
  });
})();
