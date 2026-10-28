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
      const badge = '<span class="modern-operator-brand" style="--brand-bg:' + brand[1] + ';--brand-fg:' + brand[2] + '" aria-label="Operadora ' + escapeHtml(name) + '">' + (['claro','vero','desktop','alares'].includes(key) ? '<img src="operator-logos/' + key + '.svg" alt="' + escapeHtml(name) + '" width="76" height="30" style="display:block;width:76px;height:30px;object-fit:cover;border-radius:4px">' : escapeHtml(brand[0])) + '</span>';
      const originalHtml = original(s,index);
      const operatorText = ' · ' + escapeHtml(s.operators?.name || 'Operadora') + ' · ';
      const compactHtml = originalHtml.replace(operatorText, ' · ');
      const bodyHtml = root.classList.contains('modern-visual-enabled') ? compactHtml : originalHtml;
      return bodyHtml.replace('<div class="queue-return">',badge + '<div class="queue-return">');
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
  let previousModern = root.classList.contains('modern-visual-enabled');
  new MutationObserver(() => { syncDrawer(); const modern = root.classList.contains('modern-visual-enabled'); if (modern !== previousModern) { previousModern = modern; window.render?.(); } }).observe(root,{attributes:true,attributeFilter:['class']});
  document.addEventListener('keydown',event => {
    if (!locked || event.key !== 'Tab') return;
    const nodes = [...panel.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(el=>!el.disabled && el.getClientRects().length);
    if (!nodes.length) return;
    const first=nodes[0],last=nodes[nodes.length-1];
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus()}
  });
  // Novo layout é o padrão; o usuário pode voltar ao clássico quando desejar.
  const key = 'contact-bko-layout-v2';
  const saved = sessionStorage.getItem(key);
  root.classList.toggle('modern-visual-enabled', saved !== 'classic');
  const topbar = document.querySelector('.topbar');
  if (topbar && !document.getElementById('bkoLayoutToggle')) {
    const btn = document.createElement('button');
    btn.id = 'bkoLayoutToggle'; btn.type = 'button'; btn.className = 'bko-layout-toggle';
    btn.setAttribute('aria-label', 'Alternar layout da Fila BKO');
    btn.title = 'Alternar layout da Fila BKO';
    const update = () => {
      const modern = root.classList.contains('modern-visual-enabled');
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M10 3v18"/></svg>';\n      btn.title = modern ? 'Ativar modo antigo da BKO' : 'Ativar novo layout da BKO';\n      btn.setAttribute('aria-label', btn.title);
      btn.setAttribute('aria-pressed', String(!modern));
    };
    btn.addEventListener('click', () => {
      const modern = !root.classList.contains('modern-visual-enabled');
      root.classList.toggle('modern-visual-enabled', modern);
      sessionStorage.setItem(key, modern ? 'modern' : 'classic');
      update();
    });
    topbar.insertBefore(btn, topbar.querySelector('.profile'));
    update();
  }
  syncDrawer();
})();
