(()=>{
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
  function enhance(){
    const client=[...panel.querySelectorAll('.detail-section')].find(s=>s.querySelector('h3')?.textContent.trim()==='Cliente');
    if(!client||client.dataset.copyReady==='1')return;
    client.dataset.copyReady='1';
    const installation=[...panel.querySelectorAll('.detail-section')].find(s=>s.querySelector('h3')?.textContent.trim()==='Instalação');
    const items=[...client.querySelectorAll('.detail-item')];
    const installItems=installation?[...installation.querySelectorAll('.detail-item')]:[];
    const addCopy=item=>{
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
    };
    [...items,...installItems].forEach(addCopy);
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