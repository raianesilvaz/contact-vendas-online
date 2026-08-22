(()=>{
  if(!window.supabaseClient)return;
  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  let lastProtocol=null,requestId=0;
  const style=document.createElement('style');
  style.textContent='.seller-note-bko{margin:14px 18px 0;padding:13px 14px;border:1px solid #ffd7c5;border-radius:10px;background:#fff8f4}.seller-note-bko span{display:block;margin-bottom:5px;color:#d95c22;font-size:9px;font-weight:800;letter-spacing:.08em}.seller-note-bko strong{display:block;color:#273349;font-size:12px;line-height:1.45;white-space:pre-wrap}.seller-note-bko[hidden]{display:none!important}';
  document.head.appendChild(style);

  async function sync(){
    const panel=document.querySelector('#detailPanel');
    const headerText=panel?.querySelector('.detail-header p')?.textContent||'';
    const match=headerText.match(/Protocolo\s*#(\d+)/i);
    if(!panel||!match)return;
    const protocol=Number(match[1]);
    if(protocol===lastProtocol&&panel.querySelector('.seller-note-bko'))return;
    lastProtocol=protocol;
    const current=++requestId;
    panel.querySelector('.seller-note-bko')?.remove();
    const{data,error}=await window.supabaseClient.from('sales').select('seller_note').eq('protocol',protocol).maybeSingle();
    if(current!==requestId||error||!data?.seller_note?.trim())return;
    const form=panel.querySelector('#bkoForm');
    if(!form)return;
    const box=document.createElement('div');
    box.className='seller-note-bko';
    box.innerHTML=`<span>OBS DO VENDEDOR / PARCEIRO</span><strong>${escapeHtml(data.seller_note.trim())}</strong>`;
    form.before(box);
  }

  new MutationObserver(()=>queueMicrotask(sync)).observe(document.querySelector('#detailPanel')||document.body,{childList:true,subtree:true});
  sync();
})();