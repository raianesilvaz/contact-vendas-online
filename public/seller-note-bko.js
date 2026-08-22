(()=>{
  if(!window.supabaseClient)return;
  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  let lastProtocol=null,requestId=0;
  const style=document.createElement('style');
  style.textContent='.seller-note-bko{margin:0;padding:0}.seller-note-bko .detail-item{margin:0}.seller-note-bko[hidden]{display:none!important}';
  document.head.appendChild(style);

  async function sync(){
    const panel=document.querySelector('#detailPanel');
    const headerText=panel?.querySelector('.detail-header p')?.textContent||'';
    const match=headerText.match(/Protocolo\s*#(\d+)/i);
    if(!panel||!match)return;

    const installationSection=[...panel.querySelectorAll('.detail-section')].find(section=>/instala[cç][aã]o/i.test(section.querySelector('h3')?.textContent||''));
    const grid=installationSection?.querySelector('.detail-grid');
    if(!grid)return;

    [...grid.querySelectorAll('.detail-item > span')].forEach(label=>{
      if(label.textContent.trim().toLowerCase()==='complemento')label.textContent='Complemento do endereço';
    });

    const protocol=Number(match[1]);
    if(protocol===lastProtocol&&panel.querySelector('.seller-note-bko'))return;
    lastProtocol=protocol;
    const current=++requestId;
    panel.querySelector('.seller-note-bko')?.remove();
    const{data,error}=await window.supabaseClient.from('sales').select('seller_note').eq('protocol',protocol).maybeSingle();
    if(current!==requestId||error||!data?.seller_note?.trim())return;

    const box=document.createElement('div');
    box.className='seller-note-bko detail-item wide';
    box.innerHTML=`<span>Observação da venda</span><strong>${escapeHtml(data.seller_note.trim())}</strong>`;
    grid.appendChild(box);
  }

  new MutationObserver(()=>queueMicrotask(sync)).observe(document.querySelector('#detailPanel')||document.body,{childList:true,subtree:true});
  sync();
})();