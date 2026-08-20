(()=>{
  const style=document.createElement('style');
  style.textContent=`
    .detail-header{position:relative;padding-right:205px}
    .seller-install-header-action{position:absolute;right:54px;top:20px;display:flex;align-items:center}
    .seller-install-header-action .inform-installation{margin:0!important;width:auto!important;height:40px!important;padding:0 16px!important;border:1px solid #ff642d!important;border-radius:9px!important;background:#ff642d!important;color:#fff!important;font:inherit!important;font-size:11px!important;font-weight:800!important;box-shadow:0 6px 16px rgba(255,100,45,.18)!important;white-space:nowrap;display:inline-flex!important;align-items:center!important;justify-content:center!important}
    .seller-install-header-action .inform-installation:hover{background:#ee5722!important;border-color:#ee5722!important}
    .seller-install-header-action .inform-installation:disabled{opacity:.6;cursor:wait}
    @media(max-width:700px){.detail-header{padding-right:46px}.seller-install-header-action{position:static;margin-top:12px}.seller-install-header-action .inform-installation{height:38px!important}}
  `;
  document.head.appendChild(style);
  const adjust=()=>{
    const panel=document.querySelector('#detailPanel');
    if(!panel)return;
    const button=panel.querySelector('.inform-installation');
    const header=panel.querySelector('.detail-header');
    if(!button||!header)return;
    let slot=header.querySelector('.seller-install-header-action');
    if(!slot){slot=document.createElement('div');slot.className='seller-install-header-action';header.appendChild(slot)}
    if(button.parentElement!==slot)slot.appendChild(button);
  };
  new MutationObserver(()=>queueMicrotask(adjust)).observe(document.querySelector('#detailPanel')||document.body,{childList:true,subtree:true});
  adjust();
})();