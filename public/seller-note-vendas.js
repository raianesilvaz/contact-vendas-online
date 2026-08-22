(()=>{
  if(!window.supabaseClient)return;
  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  let requestId=0;

  async function sync(){
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

    panel.querySelector('.seller-note-sale')?.remove();
    const current=++requestId;
    const protocol=Number(match[1]);
    const {data,error}=await window.supabaseClient.from('sales').select('seller_note').eq('protocol',protocol).maybeSingle();
    if(current!==requestId||error||!data?.seller_note?.trim())return;

    const box=document.createElement('div');
    box.className='seller-note-sale detail-item wide';
    box.innerHTML=`<span>Observação da venda</span><strong>${escapeHtml(data.seller_note.trim())}</strong>`;
    grid.appendChild(box);
  }

  new MutationObserver(()=>queueMicrotask(sync)).observe(document.querySelector('#detailPanel')||document.body,{childList:true,subtree:true});
  sync();
})();