(()=>{
  // Corrige a busca da Fila BKO para localizar contratos com ou sem prefixos,
  // hífens e espaços, além de manter nome e CPF funcionando normalmente.
  if(typeof applySearchFilter==='function'){
    applySearchFilter=function(query){
      if(!appliedSearch)return query;
      const raw=String(appliedSearch||'').trim();
      const clean=raw.replace(/[,%()]/g,' ').trim();
      const compact=raw.replace(/[^a-zA-Z0-9]/g,'');
      const digits=raw.replace(/\D/g,'');
      const conditions=[`customer_name.ilike.%${clean}%`,`contract_number.ilike.%${clean}%`];
      if(compact&&compact!==clean)conditions.push(`contract_number.ilike.%${compact}%`);
      if(digits){
        conditions.push(`contract_number.ilike.%${digits}%`,`cpf.ilike.%${digits}%`);
        const protocol=Number(digits);
        if(Number.isSafeInteger(protocol))conditions.push(`protocol.eq.${protocol}`);
      }
      return query.or([...new Set(conditions)].join(','));
    };
  }

  const panel=document.querySelector('#detailPanel');
  if(!panel)return;
  const clean=value=>String(value||'').trim();
  async function copy(text,label='Dado'){
    try{
      await navigator.clipboard.writeText(text);
      const title=document.querySelector('#toastTitle'),message=document.querySelector('#toastMessage'),toast=document.querySelector('#toast');
      if(title&&message&&toast){title.textContent='Copiado!';message.textContent=`${label} copiado para a área de transferência.`;toast.classList.remove('toast-error');toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800)}
    }catch{window.prompt('Copie o conteúdo abaixo:',text)}
  }
  function addCopy(item){
    const label=item.querySelector(':scope > span')?.textContent.trim();
    const strong=item.querySelector('strong');
    if(!label||!strong)return;
    const value=clean(strong.textContent);
    if(!value||/^não informad/i.test(value)||/^aguardando/i.test(value))return;
    if(strong.parentElement?.classList.contains('phone-detail-value')){
      const wrap=strong.parentElement;
      if(!wrap.querySelector('.copy-field-btn'))wrap.insertBefore(button(value,label),wrap.querySelector('.whatsapp-contact-link'));
    }else{
      strong.classList.add('copyable-value');
      if(!item.querySelector('.copy-field-btn'))item.appendChild(button(value,label));
    }
  }
  function enhance(){
    const sections=[...panel.querySelectorAll('.detail-section')];
    const client=sections.find(s=>s.querySelector('h3')?.textContent.trim()==='Cliente');
    if(!client)return;
    const installation=sections.find(s=>s.querySelector('h3')?.textContent.trim()==='Instalação');
    const sale=sections.find(s=>/Dados da venda/i.test(s.querySelector('h3')?.textContent.trim()||''));
    const items=[...client.querySelectorAll('.detail-item')];
    const installItems=installation?[...installation.querySelectorAll('.detail-item')]:[];
    const saleItems=sale?[...sale.querySelectorAll('.detail-item')]:[];
    [...items,...installItems,...saleItems].forEach(addCopy);
    const heading=client.querySelector('h3');
    if(heading&&!client.querySelector('.copy-all-client-btn')){
      const all=document.createElement('button');all.type='button';all.className='copy-all-client-btn';all.innerHTML='<span>⧉</span> Copiar dados';
      all.addEventListener('click',()=>{
        const lines=[];
        [...items,...installItems].forEach(item=>{const label=item.querySelector(':scope > span')?.textContent.trim(),strong=item.querySelector('strong'),value=clean(strong?.textContent);if(label&&value&&!/^não informad/i.test(value)&&!/^aguardando/i.test(value))lines.push(`${label}: ${value}`)});
        copy(lines.join('\n'),'Dados do cliente');
      });
      heading.insertAdjacentElement('afterend',all);
    }
  }
  function button(value,label){const b=document.createElement('button');b.type='button';b.className='copy-field-btn';b.title=`Copiar ${label}`;b.setAttribute('aria-label',`Copiar ${label}`);b.textContent='⧉';b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();copy(value,label)});return b}
  new MutationObserver(enhance).observe(panel,{childList:true,subtree:true});enhance();
})();