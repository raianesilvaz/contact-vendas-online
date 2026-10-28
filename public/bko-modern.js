(() => {
  const panel = document.querySelector('#detailPanel'), overlay = document.querySelector('#mobileOverlay');
  const root = document.documentElement;
  let returnFocus = null, locked = false, previousOverflow = '';
  const brands = {claro:['Claro','#da291c','#fff'],desktop:['DESKTOP','#fff200','#222'],vero:['vero','#d92b73','#fff'],alares:['alares','#753bbd','#fff'],vivo:['vivo','#660099','#fff'],tim:['TIM','#004691','#fff']};
  if (typeof window.queueCard === 'function') {
    const original = window.queueCard;
    window.queueCard = function(s, index) {
      const name = String(s.operators?.name || 'Operadora');
      const key = Object.keys(brands).find(key => name.toLowerCase().includes(key));
      const brand = key ? brands[key] : [name,'#edf1f7','#344152'];
      const badge = '<span class="modern-operator-brand" style="--brand-bg:' + brand[1] + ';--brand-fg:' + brand[2] + '" aria-label="Operadora ' + escapeHtml(name) + '">' + escapeHtml(brand[0]) + '</span>';
      return original(s,index).replace('<div class="queue-return">',badge + '<div class="queue-return">');
    };
    window.render?.();
  }
  function syncDrawer() {
    const active = root.classList.contains('modern-visual-enabled') && panel.classList.contains('open');
    if (active && !locked) {
      locked = true; returnFocus = document.activeElement;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true'); panel.setAttribute('aria-label','Detalhes da venda');
      panel.querySelector('.close-detail')?.focus({preventScroll:true});
    } else if (!active && locked) {
      locked = false; document.body.style.overflow = previousOverflow;
      panel.removeAttribute('role'); panel.removeAttribute('aria-modal'); panel.removeAttribute('aria-label');
      if (!panel.classList.contains('open') && returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
    }
  }
  new MutationObserver(syncDrawer).observe(panel,{attributes:true,attributeFilter:['class']});
  new MutationObserver(syncDrawer).observe(root,{attributes:true,attributeFilter:['class']});
  document.addEventListener('keydown',event => {
    if (!locked || event.key !== 'Tab') return;
    const nodes = [...panel.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(el=>!el.disabled && el.getClientRects().length);
    if (!nodes.length) return;
    const first=nodes[0],last=nodes[nodes.length-1];
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus()}
  });
  syncDrawer();
})();
