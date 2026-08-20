(() => {
  const todayKey=()=>new Date().toISOString().slice(0,10);
  function ensureModal(){
    let overlay=document.querySelector('#bkoInstallGuardOverlay');
    if(overlay)return overlay;
    const style=document.createElement('style');style.textContent=`#bkoInstallGuardOverlay{position:fixed;inset:0;background:rgba(17,24,39,.48);display:none;align-items:center;justify-content:center;padding:20px;z-index:2000}#bkoInstallGuardOverlay.show{display:flex}.bko-install-guard-modal{width:min(430px,100%);background:#fff;border-radius:14px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.25)}.bko-install-guard-modal h3{margin:0 0 7px;font-size:18px}.bko-install-guard-modal p{margin:0 0 17px;color:#718096;font-size:12px;line-height:1.5}.bko-install-guard-modal label{display:block;font-size:10px;font-weight:800;color:#384555;margin-bottom:7px}.bko-install-guard-modal input{width:100%;height:44px;border:1px solid #d7dde4;border-radius:9px;padding:0 12px;font:inherit}.bko-install-guard-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.bko-install-guard-actions button{height:40px;border-radius:8px;padding:0 14px;border:1px solid #d9dfe6;background:#fff;font:inherit;font-size:12px;font-weight:700;cursor:pointer}.bko-install-guard-actions .confirm{background:#f36c21;border-color:#f36c21;color:#fff}`;document.head.appendChild(style);
    overlay=document.createElement('div');overlay.id='bkoInstallGuardOverlay';overlay.innerHTML=`<div class="bko-install-guard-modal"><h3>Confirmar instalação</h3><p>Para salvar a venda como CONECTADO, informe a data em que o cliente foi instalado.</p><label>DATA DE INSTALAÇÃO *</label><input type="date" id="bkoInstallGuardDate"><div class="bko-install-guard-actions"><button type="button" id="bkoInstallGuardCancel">Cancelar</button><button type="button" class="confirm" id="bkoInstallGuardConfirm">Confirmar conectado</button></div></div>`;document.body.appendChild(overlay);return overlay;
  }
  function askDate(){return new Promise(resolve=>{const overlay=ensureModal(),input=overlay.querySelector('#bkoInstallGuardDate'),cancel=overlay.querySelector('#bkoInstallGuardCancel'),confirm=overlay.querySelector('#bkoInstallGuardConfirm');input.max=todayKey();input.value=todayKey();overlay.classList.add('show');const finish=v=>{overlay.classList.remove('show');cancel.onclick=null;confirm.onclick=null;resolve(v)};cancel.onclick=()=>finish(null);confirm.onclick=()=>{if(!input.value)return alert('Informe a data de instalação.');if(input.value>todayKey())return alert('A data de instalação não pode ser futura.');finish(input.value)};});}

  document.addEventListener('submit',async e=>{
    const form=e.target;if(!(form instanceof HTMLFormElement)||form.id!=='bkoForm')return;
    const status=form.querySelector('[name="status"]')?.value;if(status!=='conectado')return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const selected=document.querySelector('.bko-card.selected');
    const saleId=selected?.dataset.id;
    if(!saleId){showToast?.('Não foi possível atualizar','Venda não identificada. Tente abrir novamente.',true);return;}

    const button=form.querySelector('button[type="submit"]');
    const buttonText=button?.querySelector('span');
    if(button){button.disabled=true;if(buttonText)buttonText.textContent='Salvando...';}

    try{
      const {data:sale,error:readError}=await window.supabaseClient.from('sales').select('id,installation_date').eq('id',saleId).single();
      if(readError)throw readError;

      let installationDate=sale?.installation_date||null;
      if(!installationDate){
        installationDate=await askDate();
        if(!installationDate)return;
      }

      const data=new FormData(form);
      const typedReturn=String(data.get('bko_return')||'').trim();
      const payload={
        status:'conectado',
        installation_date:installationDate,
        contract_number:String(data.get('contract_number')||'').trim()||null,
        bko_return:typedReturn||'Conectado'
      };

      const {error}=await window.supabaseClient.from('sales').update(payload).eq('id',saleId).select('updated_at').single();
      if(error)throw error;

      if(typeof loadPage==='function'&&typeof loadSummary==='function')await Promise.all([loadPage(true),loadSummary()]);
      if(typeof showToast==='function')showToast('Venda atualizada!','Status conectado e data de instalação salvos.');
    }catch(error){
      console.error('connected-save-error',error);
      if(typeof showToast==='function')showToast('Não foi possível atualizar',error?.message||'Tente novamente.',true);
      else alert(error?.message||'Não foi possível atualizar.');
    }finally{
      if(button){button.disabled=false;if(buttonText)buttonText.textContent='Salvar classificação';}
    }
  },true);
})();