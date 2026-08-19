const form = document.querySelector('#saleForm');
const toast = document.querySelector('#toast');
const cpf = document.querySelector('#cpf');
const cpfField = cpf.closest('.field');
const cpfError = cpfField.querySelector('.error');
const defaultCpfError = cpfError.textContent;
const valor = document.querySelector('#valor');
const operatorSelect = form.elements.operadora;
const submitButton = document.querySelector('#submitButton');

function digits(value) { return value.replace(/\D/g, ''); }
function maskCpf(value) { return digits(value).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); }
function maskPhone(value) { const d = digits(value).slice(0, 11); return d.length <= 10 ? d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2') : d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2'); }
function validCpf(value) { const d = digits(value); if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false; const calc = (base, factor) => { let sum = 0; for (const n of base) sum += Number(n) * factor--; const r = (sum * 10) % 11; return r === 10 ? 0 : r; }; return calc(d.slice(0, 9), 10) === Number(d[9]) && calc(d.slice(0, 10), 11) === Number(d[10]); }
function parseMoney(value) { return Number(value.replace(/\./g, '').replace(',', '.')); }
function showToast(title, message, error = false) { document.querySelector('#toastTitle').textContent = title; document.querySelector('#toastMessage').textContent = message; toast.classList.toggle('toast-error', error); toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 5000); }
function showDuplicateCpfError() { cpfError.textContent = 'Este CPF já possui uma venda cadastrada.'; cpfField.classList.add('invalid'); cpf.focus(); showToast('CPF já cadastrado', 'Não é possível criar outra venda para este CPF.', true); }

async function loadOperators() {
  const user = await window.authReady;
  if (!user) return;
  const { data, error } = await window.supabaseClient.from('operators').select('id, name').eq('active', true).order('name');
  if (error) { operatorSelect.innerHTML = '<option value="">Não foi possível carregar</option>'; showToast('Falha na conexão', 'Atualize a página e tente novamente.', true); return; }
  operatorSelect.innerHTML = '<option value="">Selecione a operadora</option>' + data.map((item) => `<option value="${item.id}">${item.name}</option>`).join('');
  operatorSelect.disabled = false;
}

cpf.addEventListener('input', () => { cpf.value = maskCpf(cpf.value); cpfError.textContent = defaultCpfError; });
document.querySelectorAll('.phone').forEach((input) => input.addEventListener('input', () => { input.value = maskPhone(input.value); }));
valor.addEventListener('input', () => { const number = Number(digits(valor.value)) / 100; valor.value = number ? number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''; });
form.addEventListener('input', (event) => event.target.closest('.field')?.classList.remove('invalid'));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  cpfError.textContent = defaultCpfError;
  let valid = true;
  form.querySelectorAll('[required]').forEach((input) => { const ok = input.checkValidity() && (input !== cpf || validCpf(input.value)); input.closest('.field').classList.toggle('invalid', !ok); if (!ok) valid = false; });
  if (!valid) { form.querySelector('.invalid input, .invalid select')?.focus(); return; }

  const user = await window.authReady;
  if (!user) return;
  submitButton.disabled = true;
  submitButton.querySelector('span').textContent = 'Salvando...';

  const data = new FormData(form);
  const sale = { seller_id: user.id, operator_id: data.get('operadora'), plan_name: data.get('plano').trim(), value: parseMoney(data.get('valor')), due_day: Number(digits(data.get('vencimento'))), customer_name: data.get('nome').trim(), mother_name: data.get('mae').trim(), birth_date: data.get('nascimento'), cpf: digits(data.get('cpf')), full_address: data.get('endereco').trim(), address_complement: data.get('complemento').trim() || null, phone_1: digits(data.get('telefone1')), phone_2: digits(data.get('telefone2')) || null, email: data.get('email').trim().toLowerCase() };
  const { error } = await window.supabaseClient.from('sales').insert(sale);

  submitButton.disabled = false;
  submitButton.querySelector('span').textContent = 'Salvar venda';
  if (error) {
    if (error.code === '23505') { showDuplicateCpfError(); return; }
    showToast('Não foi possível salvar', error.code === '42501' ? 'Seu usuário não tem permissão para cadastrar vendas.' : 'Confira os dados e tente novamente.', true);
    return;
  }

  showToast('Venda cadastrada!', 'Os dados foram gravados e já estão em Minhas vendas.');
  form.reset();
  setTimeout(() => { window.location.href = 'vendas.html'; }, 1400);
});

document.querySelector('#clearButton').addEventListener('click', () => { if (confirm('Deseja limpar todos os campos preenchidos?')) { form.reset(); cpfError.textContent = defaultCpfError; form.querySelectorAll('.invalid').forEach((element) => element.classList.remove('invalid')); } });
document.querySelector('#menuButton').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('open'));
loadOperators();
