let users = [];
let currentFilter = 'todos';

const usersList = document.querySelector('#usersList');
const usersEmpty = document.querySelector('#usersEmpty');
const userSearch = document.querySelector('#userSearch');
const userFilters = document.querySelector('#userFilters');
const createCard = document.querySelector('#userCreateCard');
const userForm = document.querySelector('#userForm');
const toast = document.querySelector('#toast');

const roleLabels = { vendedora: 'Vendedor', admin: 'Administrador' };
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
const formatDate = value => value ? new Date(value).toLocaleString('pt-BR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Nunca acessou';

function showToast(title, message, error = false) {
  document.querySelector('#toastTitle').textContent = title;
  document.querySelector('#toastMessage').textContent = message;
  toast.classList.toggle('toast-error', error);
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4500);
}

const previewStorageKey = 'contact-preview-users-v1';
function previewUsers() {
  const saved = localStorage.getItem(previewStorageKey);
  if (saved) {
    const normalized = JSON.parse(saved).map(user => ({
      ...user,
      role: user.role === 'vendedor' ? 'vendedora' : (['bko', 'supervisora'].includes(user.role) ? 'admin' : user.role),
    }));
    localStorage.setItem(previewStorageKey, JSON.stringify(normalized));
    return normalized;
  }
  const items = [
    { id:window.currentUser.id, full_name:window.currentUser.profile.full_name, email:window.currentUser.email || 'admin@contact.com.br', role:'admin', active:true, last_sign_in_at:new Date().toISOString() },
    { id:'preview-seller', full_name:'Vendedor de exemplo', email:'vendedor@contact.com.br', role:'vendedora', active:true, last_sign_in_at:null },
    { id:'preview-admin', full_name:'Administrador de exemplo', email:'admin2@contact.com.br', role:'admin', active:false, last_sign_in_at:null },
  ];
  localStorage.setItem(previewStorageKey, JSON.stringify(items));
  return items;
}

async function callPreview(body) {
  await new Promise(resolve => setTimeout(resolve, 250));
  const items = previewUsers();
  if (body.action === 'list') return { ok:true, users:items };
  if (body.action === 'invite' || body.action === 'create_direct') {
    if (items.some(user => user.email.toLowerCase() === body.email.toLowerCase())) throw new Error('Já existe uma conta com este e-mail na prévia.');
    items.push({ id:crypto.randomUUID(), full_name:body.full_name, email:body.email, role:body.role, active:true, last_sign_in_at:null });
    localStorage.setItem(previewStorageKey, JSON.stringify(items));
    return { ok:true, created_direct:body.action === 'create_direct' };
  }
  if (body.action === 'set_active') {
    const user = items.find(item => item.id === body.user_id);
    if (user) user.active = body.active;
    localStorage.setItem(previewStorageKey, JSON.stringify(items));
    return { ok:true };
  }
  if (body.action === 'set_role') {
    const user = items.find(item => item.id === body.user_id);
    if (user) user.role = body.role;
    localStorage.setItem(previewStorageKey, JSON.stringify(items));
    return { ok:true };
  }
  if (body.action === 'reset_password' || body.action === 'set_password') return { ok:true };
  throw new Error('Ação de prévia desconhecida.');
}

async function callAdminUsers(body) {
  if (window.APP_PREVIEW_MODE) return callPreview(body);
  const { data, error } = await window.supabaseClient.functions.invoke('admin-users', { body });
  if (error) throw new Error(data?.error || error.message || 'Não foi possível concluir a operação.');
  if (!data?.ok) throw new Error(data?.error || 'Não foi possível concluir a operação.');
  return data;
}

function renderSummary() {
  document.querySelector('#usersTotal').textContent = users.length;
  document.querySelector('#usersActive').textContent = users.filter(user => user.active).length;
  document.querySelector('#usersSellers').textContent = users.filter(user => user.role === 'vendedora').length;
  document.querySelector('#usersAdmins').textContent = users.filter(user => user.role === 'admin').length;
}

function filteredUsers() {
  const term = userSearch.value.trim().toLocaleLowerCase('pt-BR');
  return users.filter(user => {
    const matchesTerm = !term || `${user.full_name} ${user.email}`.toLocaleLowerCase('pt-BR').includes(term);
    const matchesFilter = currentFilter === 'todos' || (currentFilter === 'inativos' ? !user.active : user.role === currentFilter);
    return matchesTerm && matchesFilter;
  });
}

function renderUsers() {
  const items = filteredUsers();
  usersList.closest('.users-table-wrap').hidden = !items.length;
  usersEmpty.hidden = Boolean(items.length);
  usersList.innerHTML = items.map(user => `
    <tr>
      <td><div class="user-identity"><span class="user-list-avatar">${escapeHtml(initials(user.full_name))}</span><div><strong>${escapeHtml(user.full_name)}</strong><small>${escapeHtml(user.email)}</small></div></div></td>
      <td><span class="role-badge ${escapeHtml(user.role)}">${escapeHtml(roleLabels[user.role] || user.role)}</span></td>
      <td><span class="account-status ${user.active ? 'active' : 'inactive'}"><i></i>${user.active ? 'Ativo' : 'Inativo'}</span></td>
      <td><span class="last-access">${escapeHtml(formatDate(user.last_sign_in_at))}</span></td>
      <td><div class="user-actions"><button type="button" data-action="role" data-id="${user.id}" title="Alterar perfil" aria-label="Alterar perfil">✎</button><button type="button" data-action="password" data-id="${user.id}" title="Definir senha temporária" aria-label="Definir senha temporária">🔑</button><button type="button" data-action="reset" data-id="${user.id}" title="Enviar recuperação de senha" aria-label="Enviar recuperação de senha">↻</button><button type="button" class="${user.active ? 'deactivate' : 'activate'}" data-action="toggle" data-id="${user.id}" title="${user.active ? 'Desativar conta' : 'Ativar conta'}" aria-label="${user.active ? 'Desativar conta' : 'Ativar conta'}">${user.active ? '○' : '✓'}</button></div></td>
    </tr>`).join('');
}

async function loadUsers() {
  usersList.innerHTML = '<tr><td colspan="5" class="users-loading">Carregando usuários...</td></tr>';
  try {
    const data = await callAdminUsers({ action: 'list' });
    users = data.users;
    renderSummary();
    renderUsers();
  } catch (error) {
    usersList.innerHTML = '<tr><td colspan="5" class="users-loading error-state">Não foi possível carregar os usuários.</td></tr>';
    showToast('Falha ao carregar', error.message, true);
  }
}

async function inviteUser(event) {
  event.preventDefault();
  const button = document.querySelector('#inviteButton');
  const formData = new FormData(userForm);
  const payload = { action:'invite', full_name:formData.get('full_name').trim(), email:formData.get('email').trim().toLowerCase(), role:formData.get('role') };
  button.disabled = true;
  button.querySelector('span').textContent = 'Enviando...';
  try {
    await callAdminUsers(payload);
    userForm.reset();
    createCard.hidden = true;
    await loadUsers();
    showToast('Convite enviado!', `${payload.full_name} receberá um e-mail para criar a senha.`);
  } catch (error) {
    const rateLimited = /limite temporário|rate.?limit|too many/i.test(error.message || '');
    if (rateLimited && window.confirm('O envio de e-mail está temporariamente limitado. Deseja criar a conta agora sem enviar e-mail? Depois você poderá definir a senha pelo botão 🔑.')) {
      try {
        await callAdminUsers({ ...payload, action:'create_direct' });
        userForm.reset();
        createCard.hidden = true;
        await loadUsers();
        showToast('Usuário criado!', `${payload.full_name} foi cadastrado. Agora defina a senha pelo botão 🔑.`);
        return;
      } catch (directError) {
        showToast('Não foi possível criar', directError.message, true);
        return;
      }
    }
    showToast('Não foi possível convidar', error.message, true);
  } finally {
    button.disabled = false;
    button.querySelector('span').textContent = 'Enviar convite';
  }
}

async function toggleUser(user) {
  if (user.id === window.currentUser.id) { showToast('Ação bloqueada', 'Você não pode desativar a própria conta.', true); return; }
  const nextActive = !user.active;
  if (!window.confirm(`${nextActive ? 'Ativar' : 'Desativar'} a conta de ${user.full_name}?`)) return;
  try {
    await callAdminUsers({ action:'set_active', user_id:user.id, active:nextActive });
    user.active = nextActive;
    renderSummary();
    renderUsers();
    showToast(`Conta ${nextActive ? 'ativada' : 'desativada'}`, `${user.full_name} foi atualizado com sucesso.`);
  } catch (error) {
    showToast('Não foi possível atualizar', error.message, true);
  }
}

async function changeRole(user) {
  if (user.id === window.currentUser.id) {
    showToast('Ação bloqueada', 'Você não pode alterar o próprio perfil.', true);
    return;
  }
  const currentLabel = roleLabels[user.role] || user.role;
  const nextRole = window.prompt(`Perfil atual de ${user.full_name}: ${currentLabel}\n\nDigite 1 para Vendedor ou 2 para Administrador:`);
  if (nextRole === null) return;
  const role = nextRole.trim() === '1' ? 'vendedora' : nextRole.trim() === '2' ? 'admin' : null;
  if (!role) {
    showToast('Perfil inválido', 'Digite 1 para Vendedor ou 2 para Administrador.', true);
    return;
  }
  if (role === user.role) {
    showToast('Sem alterações', `${user.full_name} já possui o perfil ${roleLabels[role]}.`);
    return;
  }
  if (!window.confirm(`Alterar ${user.full_name} de ${currentLabel} para ${roleLabels[role]}?`)) return;
  try {
    await callAdminUsers({ action:'set_role', user_id:user.id, role });
    user.role = role;
    renderSummary();
    renderUsers();
    showToast('Perfil atualizado', `${user.full_name} agora é ${roleLabels[role]}.`);
  } catch (error) {
    showToast('Não foi possível alterar o perfil', error.message, true);
  }
}

async function setTemporaryPassword(user) {
  const password = window.prompt(`Digite a senha temporária para ${user.full_name}:`);
  if (password === null) return;
  if (password.length < 6) {
    showToast('Senha inválida', 'A senha temporária precisa ter pelo menos 6 caracteres.', true);
    return;
  }
  if (!window.confirm(`Definir a nova senha temporária para ${user.full_name}?`)) return;
  try {
    await callAdminUsers({ action:'set_password', user_id:user.id, password });
    user.active = true;
    renderSummary();
    renderUsers();
    showToast('Senha temporária definida', `${user.full_name} já pode entrar no sistema com a nova senha.`);
  } catch (error) {
    showToast('Não foi possível definir a senha', error.message, true);
  }
}

async function resetPassword(user) {
  if (!window.confirm(`Enviar um e-mail de recuperação de senha para ${user.email}?`)) return;
  try {
    await callAdminUsers({ action:'reset_password', user_id:user.id });
    showToast('E-mail enviado', `${user.full_name} receberá as instruções de recuperação.`);
  } catch (error) {
    showToast('Não foi possível enviar', error.message, true);
  }
}

document.querySelector('#newUserButton').addEventListener('click', () => { createCard.hidden = false; createCard.scrollIntoView({ behavior:'smooth', block:'center' }); userForm.elements.full_name.focus(); });
document.querySelector('#closeCreate').addEventListener('click', () => { createCard.hidden = true; });
userForm.addEventListener('submit', inviteUser);
userSearch.addEventListener('input', renderUsers);
userFilters.addEventListener('click', event => { const button = event.target.closest('button[data-filter]'); if (!button) return; userFilters.querySelector('.active')?.classList.remove('active'); button.classList.add('active'); currentFilter = button.dataset.filter; renderUsers(); });
usersList.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const user = users.find(item => item.id === button.dataset.id);
  if (!user) return;
  if (button.dataset.action === 'toggle') return toggleUser(user);
  if (button.dataset.action === 'role') return changeRole(user);
  if (button.dataset.action === 'password') return setTemporaryPassword(user);
  return resetPassword(user);
});
document.querySelector('#menuButton').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('open'));

(async () => {
  const user = await window.authReady;
  if (!user) return;
  if (user.profile.role !== 'admin') { window.location.replace('vendas.html'); return; }
  document.querySelector('#previewNotice').hidden = !window.APP_PREVIEW_MODE;
  await loadUsers();
})();
