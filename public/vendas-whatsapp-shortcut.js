(()=>{
  const panel=document.querySelector('#detailPanel');
  if(!panel)return;

  const whatsappSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.52 3.48A11.87 11.87 0 0 0 12.07 0C5.5 0 .16 5.34.16 11.91c0 2.1.55 4.15 1.6 5.96L.06 24l6.28-1.65a11.9 11.9 0 0 0 5.72 1.46h.01c6.57 0 11.91-5.34 11.91-11.91 0-3.18-1.23-6.17-3.46-8.42Zm-8.45 18.32h-.01a9.86 9.86 0 0 1-5.02-1.37l-.36-.21-3.73.98 1-3.64-.23-.37a9.84 9.84 0 0 1-1.51-5.28c0-5.44 4.43-9.87 9.88-9.87a9.8 9.8 0 0 1 6.98 2.9 9.8 9.8 0 0 1 2.89 6.98c-.01 5.44-4.44 9.88-9.89 9.88Zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47a8.92 8.92 0 0 1-1.65-2.05c-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.08-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z"/></svg>';

  function sync(){
    const customerSection=[...panel.querySelectorAll('.detail-section')].find(section=>/dados do cliente/i.test(section.querySelector('h3')?.textContent||''));
    if(!customerSection)return;

    customerSection.querySelectorAll('.detail-item').forEach(item=>{
      const label=item.querySelector(':scope > span')?.textContent?.trim()||'';
      if(!/^Telefone [12]$/i.test(label)||item.querySelector('.whatsapp-contact-link'))return;
      const strong=item.querySelector(':scope > strong');
      if(!strong)return;
      const digits=strong.textContent.replace(/\D/g,'');
      if(digits.length<10)return;
      const international=digits.startsWith('55')&&digits.length>=12?digits:`55${digits}`;
      const wrap=document.createElement('div');
      wrap.className='phone-detail-value';
      strong.replaceWith(wrap);
      wrap.appendChild(strong);
      const link=document.createElement('a');
      link.className='whatsapp-contact-link';
      link.href=`https://wa.me/${international}`;
      link.target='_blank';
      link.rel='noopener noreferrer';
      link.title='Chamar no WhatsApp';
      link.setAttribute('aria-label',`Chamar ${label} no WhatsApp`);
      link.innerHTML=whatsappSvg;
      wrap.appendChild(link);
      item.classList.add('phone-detail-item');
    });
  }

  const observer=new MutationObserver(()=>queueMicrotask(sync));
  observer.observe(panel,{childList:true,subtree:true});
  sync();
})();