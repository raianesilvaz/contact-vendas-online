const loginForm = document.querySelector('#loginForm');
const loginButton = document.querySelector('#loginButton');
const loginError = document.querySelector('#loginError');

(async () => {
  const { data: { user } } = await window.supabaseClient.auth.getUser();
  if (user) window.location.replace('index.html');
})();

loginForm.addEventListener('submit', async event => {
  event.preventDefault(); loginError.textContent = ''; loginButton.disabled = true;
  loginButton.querySelector('span').textContent = 'Entrando...';
  const data = new FormData(loginForm);
  const { error } = await window.supabaseClient.auth.signInWithPassword({ email: data.get('email').trim(), password: data.get('password') });
  if (error) {
    loginError.textContent = error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar. Tente novamente.';
    loginButton.disabled = false; loginButton.querySelector('span').textContent = 'Entrar no sistema'; return;
  }
  window.location.replace('index.html');
});
