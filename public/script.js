const form = document.querySelector('#saleForm');
const toast = document.querySelector('#toast');
const cpf = document.querySelector('#cpf');
const cpfField = cpf.closest('.field');
const cpfError = cpfField.querySelector('.error');
const defaultCpfError = cpfError.textContent;
const valorInternet = document.querySelector('#valorInternet');
const valorMovel = document.querySelector('#valorMovel');
const valorTotal = document.querySelector('#valorTotal');
const valorPromo = document.querySelector('#valorPromo');
const legacyPromoField = document.querySelector('#legacyPromoField');
const hasPromotion = document.querySelector('#hasPromotion');
const promotionToggleField = document.querySelector('#promotionToggleField');
const promotionMonths = document.querySelector('#promotionMonths');
const promotionMonthsField = document.querySelector('#promotionMonthsField');
const postPromoValue = document.querySelector('#postPromoValue');
const postPromoValueField = document.querySelector('#postPromoValueField');
const promotionNote = document.querySelector('#promotionNote');
const promotionSummary = document.querySelector('#promotionSummary');
const isMulti = document.querySelector('#isMulti');
const multiToggleWrap = document.querySelector('#multiToggleWrap');
const internetValueField = document.querySelector('#internetValueField');
const mobileValueField = document.querySelector('#mobileValueField');
const operatorSelect = form.elements.operadora;
let availableOperators = [];
const submitButton = document.querySelector('#submitButton');

function digits(value) { return value.replace(/\D/g, ''); }
function maskCpf(value) { return digits(value).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); }
function maskPhone(value) { const d = digits(value).slice(0, 11); return d.length <= 10 ? d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2') : d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2'); }
function validCpf(value) { const d = digits(value); if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false; const calc = (base, factor) => { let sum = 0; for (const n of base) sum += Number(n) * factor--; const r = (sum * 10) % 11; return r === 10 ? 0 : r; }; return calc(d.slice(0, 9), 10) === Number(d[9]) && calc(d.slice(0, 10), 11) === Number(d[10]); }
function parseMoney(value) { return Number(value.replace(/\./g, '').replace(',', '.')); }
function formatMoneyInput(input) { const number = Number(digits(input.value)) / 100; input.value = number ? number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''; }
function showToast(title, message, error = false) { document.querySelector('#toastTitle').textContent = title; document.querySelector('#toastMessage').textContent = message; toast.classList.toggle('toast-error', error); toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 5000); }
function showDuplicateCpfError() { cpfError.textContent = 'Este CPF já possui uma venda cadastrada.'; cpfField.classList.add('invalid'); cpf.focus(); showToast('CPF já cadastrado', 'Não é possível criar outra venda para este CPF.', true); }

async function loadOperators() {
  const user = await window.authReady;
  if (!user) return;
  const { data, error } = await window.supabaseClient.from('operators').select('id, name').eq('active', true).order('name');
  if (error) { operatorSelect.innerHTML = '<option value="">Não foi possível carregar</option>'; showToast('Falha na conexão', 'Atualize a página e tente novamente.', true); return; }
  availableOperators = user.profile.role === 'parceiro' ? data.filter((item) => item.name.toLowerCase() === 'claro') : data;
  operatorSelect.innerHTML = '<option value="">Selecione a operadora</option>' + availableOperators.map((item) => `<option value="${item.id}">${item.name}</option>`).join('');
  if (user.profile.role === 'parceiro' && availableOperators.length === 1) operatorSelect.value = availableOperators[0].id;
  operatorSelect.disabled = false;
  syncPricingMode();
}

function selectedOperatorIsClaro() {
  const selected = availableOperators.find((item) => item.id === operatorSelect.value);
  return selected?.name.trim().toLowerCase() === 'claro';
}

function moneyValue(input) {
  return input.value.trim() ? parseMoney(input.value) : 0;
}

function recalculateTotal() {
  if (!selectedOperatorIsClaro()) return;
  const total = moneyValue(valorInternet) + (isMulti.checked ? moneyValue(valorMovel) : 0);
  valorTotal.value = total > 0 ? total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  updateDiscountSummary();
}

function formatCurrency(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function updateDiscountSummary() {
  if (!promotionSummary) return;
  const initialTotal = moneyValue(valorTotal);
  const months = Number(promotionMonths.value || 0);
  const afterValue = moneyValue(postPromoValue);
  promotionSummary.textContent = initialTotal > 0 && months >= 3 && months <= 6 && afterValue > initialTotal
    ? `O cliente pagará ${formatCurrency(initialTotal)} durante ${months} meses. A partir do ${months + 1}º mês, pagará ${formatCurrency(afterValue)}.`
    : 'Preencha a duração e o novo valor para conferir a cobrança.';
}

function syncPromotionMode() {
  const multi = selectedOperatorIsClaro() && isMulti.checked;
  const active = multi && hasPromotion.checked;

  legacyPromoField.hidden = multi;
  promotionToggleField.hidden = !multi;
  promotionMonthsField.hidden = !active;
  postPromoValueField.hidden = !active;
  promotionNote.hidden = !active;
  promotionMonths.required = active;
  postPromoValue.required = active;

  if (multi) {
    valorPromo.value = '';
  } else {
    hasPromotion.checked = false;
    promotionMonths.value = '';
    postPromoValue.value = '';
  }

  if (!active) {
    promotionMonths.value = '';
    postPromoValue.value = '';
  }

  updateDiscountSummary();
}

function syncPricingMode() {
  const claro = selectedOperatorIsClaro();
  multiToggleWrap.hidden = !claro;
  internetValueField.hidden = !claro;
  mobileValueField.hidden = !claro || !isMulti.checked;
  valorInternet.required = claro;
  valorMovel.required = claro && isMulti.checked;
  valorTotal.readOnly = claro;
  valorTotal.required = true;

  if (claro) {
    recalculateTotal();
  } else {
    isMulti.checked = false;
    valorInternet.value = '';
    valorMovel.value = '';
    valorTotal.readOnly = false;
  }

  syncPromotionMode();
}

cpf.addEventListener('input', () => { cpf.value = maskCpf(cpf.value); cpfError.textContent = defaultCpfError; });
document.querySelectorAll('.phone').forEach((input) => input.addEventListener('input', () => { input.value = maskPhone(input.value); }));
[valorInternet, valorMovel, valorTotal, valorPromo, postPromoValue].forEach((input) => input?.addEventListener('input', () => {
  formatMoneyInput(input);
  if (input === valorInternet || input === valorMovel) recalculateTotal();
  if (input === postPromoValue) updateDiscountSummary();
}));
operatorSelect.addEventListener('change', syncPricingMode);
isMulti.addEventListener('change', () => {
  if (!isMulti.checked) valorMovel.value = '';
  syncPricingMode();
});
hasPromotion.addEventListener('change', syncPromotionMode);
promotionMonths.addEventListener('change', updateDiscountSummary);
form.addEventListener('input', (event) => event.target.closest('.field')?.classList.remove('invalid'));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  cpfError.textContent = defaultCpfError;
  let valid = true;
  form.querySelectorAll('[required]').forEach((input) => { const ok = input.checkValidity() && (input !== cpf || validCpf(input.value)); input.closest('.field').classList.toggle('invalid', !ok); if (!ok) valid = false; });
  if (!valid) { form.querySelector('.invalid input, .invalid select')?.focus(); return; }

  const user = await window.authReady;
  if (!user) return;
  const isPartner = user.profile.role === 'parceiro';
  submitButton.disabled = true;
  submitButton.querySelector('span').textContent = 'Salvando...';

  const data = new FormData(form);
  const claro = selectedOperatorIsClaro();
  const multi = claro && isMulti.checked;
  const internetValue = claro ? moneyValue(valorInternet) : null;
  const mobileValue = multi ? moneyValue(valorMovel) : null;
  const totalValue = claro ? internetValue + (mobileValue || 0) : moneyValue(valorTotal);
  const promoRaw = data.get('valor_promo')?.trim() || '';
  const promoValue = !multi && promoRaw ? parseMoney(promoRaw) : null;
  const promotionActive = multi && hasPromotion.checked;
  const promotionDuration = promotionActive ? Number(promotionMonths.value) : null;
  const afterPromotionValue = promotionActive ? moneyValue(postPromoValue) : null;

  if (promoValue !== null && (promoValue <= 0 || promoValue > totalValue)) {
    valorPromo.closest('.field').classList.add('invalid');
    valorPromo.focus();
    submitButton.disabled = false;
    submitButton.querySelector('span').textContent = isPartner ? 'Enviar indicação' : 'Salvar venda';
    return;
  }

  if (promotionActive && (promotionDuration < 3 || promotionDuration > 6 || afterPromotionValue <= totalValue)) {
    if (promotionDuration < 3 || promotionDuration > 6) promotionMonthsField.classList.add('invalid');
    if (afterPromotionValue <= totalValue) postPromoValueField.classList.add('invalid');
    (promotionDuration < 3 || promotionDuration > 6 ? promotionMonths : postPromoValue).focus();
    submitButton.disabled = false;
    submitButton.querySelector('span').textContent = isPartner ? 'Enviar indicação' : 'Salvar venda';
    return;
  }

  const sale = { seller_id: user.id, origin: isPartner ? 'parceiro' : 'interna', operator_id: data.get('operadora'), plan_name: data.get('plano').trim(), is_multi: multi, internet_value: internetValue, mobile_value: mobileValue, value: totalValue, promo_value: promoValue, has_promotion: promotionActive, promotion_months: promotionDuration, post_promo_value: afterPromotionValue, due_day: Number(digits(data.get('vencimento'))), customer_name: data.get('nome').trim(), mother_name: data.get('mae').trim(), birth_date: data.get('nascimento'), cpf: digits(data.get('cpf')), full_address: data.get('endereco').trim(), address_complement: data.get('complemento').trim() || null, phone_1: digits(data.get('telefone1')), phone_2: digits(data.get('telefone2')) || null, email: data.get('email').trim().toLowerCase() };
  const { error } = await window.supabaseClient.from('sales').insert(sale);

  submitButton.disabled = false;
  submitButton.querySelector('span').textContent = isPartner ? 'Enviar indicação' : 'Salvar venda';
  if (error) {
    if (error.code === '23505') { showDuplicateCpfError(); return; }
    showToast('Não foi possível salvar', error.code === '42501' ? 'Seu usuário não tem permissão para cadastrar vendas.' : 'Confira os dados e tente novamente.', true);
    return;
  }

  showToast(isPartner ? 'Indicação enviada!' : 'Venda cadastrada!', isPartner ? 'Os dados foram gravados e já estão em Minhas indicações.' : 'Os dados foram gravados e já estão em Minhas vendas.');
  form.reset();
  syncPricingMode();
  setTimeout(() => { window.location.href = 'vendas.html'; }, 1400);
});

document.querySelector('#clearButton').addEventListener('click', () => { if (confirm('Deseja limpar todos os campos preenchidos?')) { form.reset(); syncPricingMode(); cpfError.textContent = defaultCpfError; form.querySelectorAll('.invalid').forEach((element) => element.classList.remove('invalid')); } });
document.querySelector('#menuButton').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('open'));
loadOperators();
