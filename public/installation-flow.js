(() => {
  const path = location.pathname.split('/').pop() || '';
  if (!['bko.html','vendas.html'].includes(path)) return;

  const style = document.createElement('style');
  style.textContent = `
    .installation-action{margin-top:14px;padding-top:14px;border-top:1px solid #edf0f3;display:flex;align-items:center;justify-content:space-between;gap:12px}
    .installation-action-info span,.installation-action-info strong{display:block}.installation-action-info span{font-size:10px;color:#8b95a3;margin-bottom:4px}.installation-action-info strong{font-size:12px;color:#344152}
    .installation-action button{border:0;border-radius:8px;padding:9px 12px;font:inherit;font-size:11px;font-weight:800;cursor:pointer;background:#fff1e8;color:#d75b13}
    .installation-action button.edit{background:#eef4ff;color:#2c6bff}
    .installation-modal-overlay{position:fixed;inset:0;background:rgba(17,24,39,.48);display:none;align-items:center;justify-content:center;padding:20px;z-index:1000}
    .installation-modal-overlay.show{display:flex}.installation-modal{width:min(430px,100%);background:#fff;border-radius:14px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.25)}
    .installation-modal h3{font-size:18px;margin:0 0 7px}.installation-modal p{font-size:12px;line-height:1.5;color:#718096;margin:0 0 17px}
    .installation-modal label{display:block;font-size:10px;font-weight:800;color:#384555;margin-bottom:7px}.installation-modal input{width:100%;height:44px;border:1px solid #d7dde4;border-radius:9px;padding:0 12px;font:inherit;outline:none}
    .installation-modal input:focus{border-color:#f36c21;box-shadow:0 0 0 3px rgba(243,108,33,.12)}.installation-modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}
    .installation-modal-actions button{height:40px;border-radius:8px;padding:0 14px;border:1px solid #d9dfe6;background:#fff;font:inherit;font-size:12px;font-weight:700;cursor:pointer}.installation-modal-actions .confirm{border-color:#f36c21;background:#f36c21;color:#fff}
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.className = 'installation-modal-overlay';
  overlay.innerHTML = `<div class="installation-modal" role="dialog" aria-modal="true"><h3 id="installationModalTitle">Confirmar instalação</h3><p id="installationModalText">Informe a data em que o cliente foi instalado.</p><label for="installationModalDate">DATA DE INSTALAÇÃO *</label><input id="installationModalDate" type="date"><div class="installation-modal-actions"><button type="button" id="installationModalCancel">Cancelar</button><button type="button" class="confirm" id="installationModalConfirm">Confirmar</button></div></div>`;
  document.body.appendChild(overlay);

  const modalTitle = overlay.querySelector('#installationModalTitle');
  const modalText = overlay.querySelector('#installationModalText');
  const modalDate = overlay.querySelector('#installationModalDate');
  const modalCancel = overlay.querySelector('#installationModalCancel');
  const modalConfirm = overlay.querySelector('#installationModalConfirm');
  let resolver = null;

  const todayKey = () => new Date().toISOString().slice(0,10);
  const fmtDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Não informada';
  function toast(title,message,error=false){ if(typeof showToast==='function') return showToast(title,message,error); alert(`${title}\n${message}`); }
  function askInstallationDate({title='Confirmar instalação',text='Informe a data em que o cliente foi instalado.',initial='' }={}){
    return new Promise(resolve=>{
      resolver = resolve;
      modalTitle.textContent = title;
      modalText.textContent = text;
      modalDate.max = todayKey();
      modalDate.value = initial || todayKey();
      overlay.classList.add('show');
      setTimeout(()=>modalDate.focus(),30);
    });
  }
  function closeModal(value=null){ overlay.classList.remove('show'); if(resolver){const r=resolver;resolver=null;r(value);} }
  modalCancel.addEventListener('click',()=>closeModal(null));
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeModal(null)});
  modalConfirm.addEventListener('click',()=>{
    const value=modalDate.value;
    if(!value){alert('Informe a data de instalação.');return}
    if(value>todayKey()){alert('A data de instalação não pode ser futura.');return}
    closeModal(value);
  });

  async function currentSale(){
    try{
      if(typeof selectedId==='undefined' || !selectedId) return null;
      const {data,error}=await window.supabaseClient.from('sales').select('id,status,installation_date,customer_name').eq('id',selectedId).single();
      if(error) return null;
      return data;
    }catch(_){ return null; }
  }

  async function enhanceBko(){
    const panel=document.querySelector('#detailPanel'),form=panel?.querySelector('#bkoForm');
    if(!panel||!form||form.dataset.installationEnhanced==='1') return;
    form.dataset.installationEnhanced='1';
    const sale=await currentSale(); if(!sale) return;
    form.dataset.installationDate=sale.installation_date||'';

    const installationSection=[...panel.querySelectorAll('.detail-section')].find(sec=>sec.querySelector('h3')?.textContent.trim()==='Instalação');
    if(installationSection && !installationSection.querySelector('[data-installation-admin]')){
      const control=document.createElement('div');control.dataset.installationAdmin='1';control.className='installation-action';
      control.innerHTML=`<div class="installation-action-info"><span>DATA DE INSTALAÇÃO</span><strong>${fmtDate(sale.installation_date)}</strong></div>${sale.installation_date?'<button type="button" class="edit">Editar data</button>':''}`;
      installationSection.appendChild(control);
      control.querySelector('button')?.addEventListener('click',async()=>{
        const value=await askInstallationDate({title:'Alterar data de instalação',text:'Somente o BKO/Admin pode corrigir esta data depois de registrada.',initial:form.dataset.installationDate});
        if(!value)return;
        const {error}=await window.supabaseClient.from('sales').update({installation_date:value}).eq('id',sale.id);
        if(error){toast('Não foi possível alterar','Verifique os dados e tente novamente.',true);return}
        form.dataset.installationDate=value; control.querySelector('strong').textContent=fmtDate(value); toast('Data atualizada','A data de instalação foi corrigida.');
      });
    }

    form.addEventListener('submit',async event=>{
      const status=form.querySelector('[name="status"]')?.value;
      if(status!=='conectado' || form.dataset.installationDate) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const value=await askInstallationDate({title:'Confirmar instalação',text:'Para salvar a venda como CONECTADO, informe a data em que o cliente foi instalado.'});
      if(!value)return;
      const {error}=await window.supabaseClient.from('sales').update({installation_date:value}).eq('id',sale.id);
      if(error){toast('Não foi possível salvar a instalação','Verifique a data e tente novamente.',true);return}
      form.dataset.installationDate=value;
      form.requestSubmit();
    },true);
  }

  async function enhanceSeller(){
    const panel=document.querySelector('#detailPanel');
    if(!panel||panel.dataset.installationEnhanced==='1') return;
    panel.dataset.installationEnhanced='1';
    const sale=await currentSale(); if(!sale){panel.dataset.installationEnhanced='';return}
    const installationSection=[...panel.querySelectorAll('.detail-section')].find(sec=>sec.querySelector('h3')?.textContent.trim()==='Endereço de instalação');
    if(!installationSection)return;
    const control=document.createElement('div'); control.className='installation-action'; control.dataset.installationSeller='1';
    const blocked=['cancelada','reprovada'].includes(sale.status);
    if(sale.installation_date){
      control.innerHTML=`<div class="installation-action-info"><span>DATA DE INSTALAÇÃO</span><strong>${fmtDate(sale.installation_date)}</strong></div>`;
    }else if(!blocked){
      control.innerHTML=`<div class="installation-action-info"><span>INSTALAÇÃO</span><strong>Cliente já foi instalado?</strong></div><button type="button">Informar instalação</button>`;
      control.querySelector('button').addEventListener('click',async()=>{
        const value=await askInstallationDate({title:'Informar instalação',text:'Confirme a data em que o cliente foi instalado. Depois de enviado, somente o BKO/Admin poderá corrigir esta data.'});
        if(!value)return;
        const {data,error}=await window.supabaseClient.rpc('confirm_own_installation',{p_sale_id:sale.id,p_installation_date:value});
        if(error){toast('Não foi possível informar a instalação',error.message||'Tente novamente.',true);return}
        toast('Instalação confirmada','A venda foi marcada como CONECTADO.');
        if(typeof loadSales==='function') await loadSales(true); else location.reload();
      });
    }else{
      control.innerHTML=`<div class="installation-action-info"><span>INSTALAÇÃO</span><strong>Indisponível para venda cancelada/reprovada</strong></div>`;
    }
    installationSection.appendChild(control);
  }

  window.authReady?.then(user=>{
    if(!user)return;
    const panel=document.querySelector('#detailPanel'); if(!panel)return;
    const run=()=>{ if(path==='bko.html'&&user.profile.role==='admin') enhanceBko(); if(path==='vendas.html'&&['vendedora','parceiro'].includes(user.profile.role)) enhanceSeller(); };
    new MutationObserver(()=>setTimeout(run,0)).observe(panel,{childList:true,subtree:true});
    run();
  });
})();