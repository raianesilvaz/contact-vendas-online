(()=>{
  const style=document.createElement('style');
  style.textContent=`
    .detail-header{position:relative}
    .seller-install-header-action{position:absolute;right:52px;top:24px;display:flex;align-items:center}
    .seller-install-header-action .inform-installation{margin:0!important;width:auto!important;height:36px!important;padding:0 13px!important;border:1px solid #ffd3bf!important;border-radius:8px!important;background:#fff7f2!important;color:#e95f22!important;font:inherit!important;font-size:11px!important;font-weight:800!important;box-shadow:none!important;white-space:nowrap}
    .seller-install-header-action .inform-installation:hover{background:#fff0e8!important}
    .seller-install-header-action .inform-installation:disabled{opacity:.6;cursor:wait}
    @media(max-width:700px){.seller-install-header-action{position:static;margin-top:10px}.detail-header{padding-right:46px}.seller-install-header-action .inform-installation{height:34px!important}}
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