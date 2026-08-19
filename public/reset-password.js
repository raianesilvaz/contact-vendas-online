const form = document.querySelector('#passwordForm');
const button = document.querySelector('#passwordButton');
const errorBox = document.querySelector('#passwordError');

(async () => {
  const { data: { session } } = await window.supabaseClient.auth.getSession();
  if (!session) errorBox.textContent = 'Este link é inválido ou expirou. Solicite um novo convite ou recuperação de senha.';
})();

form.addEventListener('submit', async event => {
  event.preventDefault();
  errorBox.textContent = '';
  const data = new FormData(form);
  const password = String(data.get('password'));
  const confirmation = String(data.get('confirmation'));
  if (password.length < 8) { errorBox.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; return; }
  if (password !== confirmation) { errorBox.textContent = 'As senhas não são iguais.'; return; }
  button.disabled = true;
  button.querySelector('span').textContent = 'Salvando...';
  const { error } = await window.supabaseClient.auth.updateUser({ password });
  if (error) {
    errorBox.textContent = 'Não foi possível salvar a senha. Solicite um novo link.';
    button.disabled = false;
    button.querySelector('span').textContent = 'Salvar nova senha';
    return;
  }
  await window.supabaseClient.auth.signOut();
  window.location.replace('login.html?password=updated');
});
