(()=>{
  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  let scheduled=false;

  function sync(){
    scheduled=false;
    const panel=document.querySelector('#detailPanel');
    if(!panel?.classList.contains('open'))return;

    const headerText=panel.querySelector('.detail-header p')?.textContent||'';
    const match=headerText.match(/Venda\s*#(\d+)/i);
    if(!match)return;

    const installationSection=[...panel.querySelectorAll('.detail-section')].find(section=>/endere[cç]o de instala[cç][aã]o/i.test(section.querySelector('h3')?.textContent||''));
    const grid=installationSection?.querySelector('.detail-grid');
    if(!grid)return;

    [...grid.querySelectorAll('.detail-item > span')].forEach(label=>{
      if(label.textContent.trim().toLowerCase()==='complemento')label.textContent='Complemento do endereço';
    });

    const protocol=Number(match[1]);
    const sale=typeof sales!=='undefined'&&Array.isArray(sales)?sales.find(item=>Number(item.protocol)===protocol):null;
    const note=sale?.seller_note?.trim()||'';
    const existing=grid.querySelector('.seller-note-sale');

    if(!note){
      if(existing)existing.remove();
      return;
    }

    if(existing){
      const current=existing.querySelector('strong')?.textContent||'';
      if(current===note)return;
      existing.innerHTML=`<span>Observação da venda</span><strong>${escapeHtml(note)}</strong>`;
      return;
    }

    const box=document.createElement('div');
    box.className='seller-note-sale detail-item wide';
    box.innerHTML=`<span>Observação da venda</span><strong>${escapeHtml(note)}</strong>`;
    grid.appendChild(box);
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(sync);
  }

  new MutationObserver(schedule).observe(document.querySelector('#detailPanel')||document.body,{childList:true,subtree:true});
  schedule();
})();