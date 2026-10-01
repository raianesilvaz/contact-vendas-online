(()=>{
  const db=()=>window.supabaseClient;
  const choices=['Rampin','Guilherme - Vero','Guilherme - Desktop','MidiaSimples - Vero','MidiaSimples - Alares','Nelson - Desktop'];
  const flags=new Map();
  let busy=false;
  const labelFor=s=>choices.includes(s?.partner_company)?s.partner_company:(s?.is_rampin?'Rampin':null);
  const badge=label=>{const el=document.createElement('span');el.className='rampin-badge';el.textContent=label[0].toUpperCase();el.title=`Venda ${label}`;el.setAttribute('aria-label',`Venda ${label}`);return el};
  function setBadge(host,label){if(!host)return;const old=host.querySelector('.rampin-badge');if(!label){old?.remove();return}if(old&&old.title===`Venda ${label}`)return;old?.remove();host.appendChild(badge(label))}
  function decorateCards(){document.querySelectorAll('.bko-card[data-id]').forEach(card=>setBadge(card.querySelector('.card-badges'),flags.get(card.dataset.id)))}
  async function decorateDetail(){
    const selected=document.querySelector('.bko-card.selected[data-id]'),form=document.querySelector('#bkoForm');
    if(!selected||!form)return;
    const id=selected.dataset.id;
    if(!flags.has(id)){
      const{data}=await db().from('sales').select('partner_company,is_rampin').eq('id',id).maybeSingle();
      if(!form.isConnected||document.querySelector('.bko-card.selected[data-id]')?.dataset.id!==id)return;
      flags.set(id,labelFor(data));
    }
    const selectedLabel=flags.get(id);
    setBadge(document.querySelector('.detail-statuses'),selectedLabel);
    if(form.querySelector('#partnerCompany'))return;
    const acceptance=form.querySelector('.acceptance-toggle');
    if(!acceptance)return;
    const wrap=document.createElement('div');wrap.className='rampin-toggle-wrap field-full';acceptance.parentNode.insertBefore(wrap,acceptance);wrap.appendChild(acceptance);
    const label=document.createElement('label');label.className='rampin-toggle';
    const heading=document.createElement('span');heading.textContent='Empresa parceira';
    const select=document.createElement('select');select.id='partnerCompany';select.setAttribute('aria-label','Empresa parceira');
    const none=document.createElement('option');none.value='';none.textContent='Nenhuma empresa';select.appendChild(none);
    choices.forEach(name=>{const option=document.createElement('option');option.value=name;option.textContent=`Venda ${name}`;select.appendChild(option)});
    select.value=selectedLabel||'';
    label.append(heading,select);wrap.appendChild(label);
    select.addEventListener('change',async()=>{
      const next=select.value||null,previous=flags.get(id)||null;
      select.disabled=true;
      const{error}=await db().from('sales').update({partner_company:next,is_rampin:next==='Rampin'}).eq('id',id);
      select.disabled=false;
      if(error){select.value=previous||'';window.showToast?.('Não foi possível atualizar','Tente novamente.',true);return}
      flags.set(id,next);decorateCards();
      if(form.isConnected&&document.querySelector('.bko-card.selected[data-id]')?.dataset.id===id)setBadge(document.querySelector('.detail-statuses'),next);
      window.showToast?.(next?`Venda ${next}`:'Empresa removida',next?'A empresa parceira foi atualizada.':'A identificação da empresa foi removida.');
    });
  }
  async function refresh(){
    if(busy||!db())return;busy=true;
    try{
      const ids=[...document.querySelectorAll('.bko-card[data-id]')].map(card=>card.dataset.id).filter(Boolean);
      if(ids.length){const{data,error}=await db().from('sales').select('id,partner_company,is_rampin').in('id',ids);if(!error)(data||[]).forEach(s=>flags.set(String(s.id),labelFor(s)))}
      decorateCards();await decorateDetail();
    }finally{busy=false}
  }
  const observer=new MutationObserver(()=>{clearTimeout(observer.t);observer.t=setTimeout(refresh,80)});
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('load',refresh);setTimeout(refresh,400);
})();
