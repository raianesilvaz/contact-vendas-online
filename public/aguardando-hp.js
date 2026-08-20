(()=>{
  const rawPath=location.pathname.split('/').pop()||'';
  const path=rawPath.replace(/\.html$/,'');
  if(!['bko','vendas'].includes(path))return;

  const addStatusStyles=()=>{
    if(document.querySelector('#hp-status-style'))return;
    const style=document.createElement('style');style.id='hp-status-style';style.textContent=`
      .status-badge.hp{background:#eef4ff!important;color:#2f62c9!important}
      .status-badge.hp i{background:#2f62c9!important}
    `;document.head.appendChild(style);
  };

  function normalizeBadges(){
    document.querySelectorAll('.status-badge').forEach(b=>{
      const t=b.textContent.trim().toLowerCase();
      if(t==='aguardando_hp'||t==='aguardando hp'||t==='undefined'){
        b.innerHTML='<i></i>Aguardando HP';
        b.classList.remove('analise','aceite','conectado','reprovada');
        b.classList.add('hp');
      }
    });
  }

  function enhanceBko(){
    const tabs=document.querySelector('#filterTabs');
    if(tabs&&!tabs.querySelector('[data-filter="aguardando_hp"]')){
      const ref=tabs.querySelector('[data-filter="em_analise"]');
      const b=document.createElement('button');b.type='button';b.dataset.filter='aguardando_hp';b.textContent='Aguardando HP';
      if(ref)ref.insertAdjacentElement('afterend',b);else tabs.appendChild(b);
    }
    document.querySelectorAll('#detailPanel select[name="status"]').forEach(sel=>{
      if(!sel.querySelector('option[value="aguardando_hp"]')){
        const ref=sel.querySelector('option[value="em_analise"]');
        const opt=document.createElement('option');opt.value='aguardando_hp';opt.textContent='Aguardando HP';
        if(ref)ref.insertAdjacentElement('afterend',opt);else sel.appendChild(opt);
      }
      const form=sel.closest('form');
      if(form&&!form.dataset.hpGuard){
        form.dataset.hpGuard='1';
        form.addEventListener('submit',()=>{
          if(sel.value==='aguardando_hp'){
            const ta=form.querySelector('[name="bko_return"]');
            if(ta&&!ta.value.trim())ta.value='Aguardando HP';
          }
        },true);
      }
    });
    normalizeBadges();
  }

  function enhanceSeller(){
    const tabs=document.querySelector('#filterTabs');
    if(tabs&&!tabs.querySelector('[data-filter="aguardando_hp"]')){
      const ref=tabs.querySelector('[data-filter="em_analise"]');
      const b=document.createElement('button');b.type='button';b.dataset.filter='aguardando_hp';b.textContent='Aguardando HP';
      if(ref)ref.insertAdjacentElement('afterend',b);else tabs.appendChild(b);
    }
    normalizeBadges();
    document.querySelectorAll('.bko-return strong,.return-preview').forEach(el=>{
      if(['aguardando_hp','aguardando hp'].includes(el.textContent.trim().toLowerCase()))el.textContent='Aguardando HP';
    });
  }

  addStatusStyles();
  const run=()=>path==='bko'?enhanceBko():enhanceSeller();
  new MutationObserver(()=>queueMicrotask(run)).observe(document.body,{childList:true,subtree:true});
  run();
})();