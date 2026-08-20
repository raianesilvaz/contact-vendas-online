(() => {
  const list = document.querySelector('#usersList');
  if (!list) return;

  const style = document.createElement('style');
  style.textContent = `.user-actions .delete-user{color:#c73b3b;border-color:#f0caca;background:#fff7f7}.user-actions .delete-user:hover{background:#ffeded;border-color:#e5aaaa}`;
  document.head.appendChild(style);

  function decorate() {
    list.querySelectorAll('tr').forEach(row => {
      const actions = row.querySelector('.user-actions');
      const source = actions?.querySelector('[data-id]');
      if (!actions || !source || actions.querySelector('[data-action="delete"]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'delete-user';
      button.dataset.action = 'delete';
      button.dataset.id = source.dataset.id;
      button.title = 'Excluir usuário';
      button.setAttribute('aria-label', 'Excluir usuário');
      button.textContent = '🗑';
      actions.appendChild(button);
    });
  }

  async function deleteUser(user) {
    if (!user) return;
    if (user.id === window.currentUser?.id) {
      showToast('Ação bloqueada', 'Você não pode excluir a própria conta.', true);
      return;
    }
    const confirmed = window.confirm(`Excluir ${user.full_name} do sistema?\n\nO acesso será removido e o usuário não aparecerá mais nesta lista. O histórico das vendas já lançadas por ele será preservado.`);
    if (!confirmed) return;
    const finalConfirm = window.confirm(`Confirma a exclusão de ${user.full_name}? Esta ação remove o acesso ao sistema.`);
    if (!finalConfirm) return;
    try {
      if (window.APP_PREVIEW_MODE) {
        const items = previewUsers().filter(item => item.id !== user.id);
        localStorage.setItem(previewStorageKey, JSON.stringify(items));
      } else {
        await callAdminUsers({ action:'delete_user', user_id:user.id });
      }
      await loadUsers();
      showToast('Usuário excluído', `${user.full_name} não tem mais acesso ao sistema.`);
    } catch (error) {
      showToast('Não foi possível excluir', error.message, true);
    }
  }

  list.addEventListener('click', event => {
    const button = event.target.closest('button[data-action="delete"]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const user = users.find(item => item.id === button.dataset.id);
    deleteUser(user);
  }, true);

  new MutationObserver(decorate).observe(list, { childList:true, subtree:true });
  decorate();
})();
