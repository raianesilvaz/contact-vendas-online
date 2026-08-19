(() => {
  let notificationChannel = null;
  let notifications = [];
  let toastTimer = null;

  const iconByType = { new_sale: '🛒', status_changed: '🔄', sale_cancelled: '⚠️' };

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  const formatRelative = value => {
    const diff = Math.max(0, Date.now() - new Date(value).getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h`;
    const days = Math.floor(hours / 24);
    return `${days} d`;
  };

  function buildUi() {
    if (document.querySelector('#notificationBell')) return;
    const profile = document.querySelector('.topbar .profile');
    if (!profile) return;

    const wrap = document.createElement('div');
    wrap.className = 'topbar-notification-wrap';
    wrap.innerHTML = `<div class="topbar-notifications"><button class="notification-bell" id="notificationBell" type="button" aria-label="Abrir notificações">🔔<span class="notification-count" id="notificationCount" hidden>0</span></button></div>`;
    profile.parentNode.insertBefore(wrap, profile);
    wrap.appendChild(profile);

    document.body.insertAdjacentHTML('beforeend', `
      <div class="notification-overlay" id="notificationOverlay"></div>
      <aside class="notification-panel" id="notificationPanel" aria-hidden="true">
        <div class="notification-panel-head"><div><span>CENTRAL</span><h2>Notificações</h2></div><button class="notification-panel-close" id="notificationPanelClose" type="button" aria-label="Fechar">×</button></div>
        <div class="notification-panel-tools"><button id="notificationMarkAll" type="button">Marcar todas como lidas</button></div>
        <div class="notification-list" id="notificationList"></div>
      </aside>
      <div class="notification-toast" id="notificationToast"><span class="notification-toast-icon" id="notificationToastIcon">🔔</span><div><strong id="notificationToastTitle">Nova notificação</strong><small id="notificationToastMessage"></small></div></div>`);

    document.querySelector('#notificationBell').addEventListener('click', openPanel);
    document.querySelector('#notificationPanelClose').addEventListener('click', closePanel);
    document.querySelector('#notificationOverlay').addEventListener('click', closePanel);
    document.querySelector('#notificationMarkAll').addEventListener('click', markAllRead);
    document.querySelector('#notificationList').addEventListener('click', event => {
      const item = event.target.closest('[data-notification-id]');
      if (item) openNotification(item.dataset.notificationId);
    });
  }

  function render() {
    const count = document.querySelector('#notificationCount');
    const list = document.querySelector('#notificationList');
    if (!count || !list) return;
    const unread = notifications.filter(item => !item.read_at).length;
    count.hidden = unread === 0;
    count.textContent = unread > 99 ? '99+' : unread;
    if (!notifications.length) {
      list.innerHTML = '<div class="notification-empty">Nenhuma notificação por enquanto.</div>';
      return;
    }
    list.innerHTML = notifications.map(item => `
      <button class="notification-item ${item.read_at ? '' : 'unread'}" type="button" data-notification-id="${item.id}">
        <span class="notification-item-icon">${iconByType[item.type] || '🔔'}</span>
        <span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p><small>${formatRelative(item.created_at)} · Ver venda →</small></span>
      </button>`).join('');
  }

  async function loadNotifications() {
    const user = window.currentUser;
    if (!user) return;
    const { data, error } = await window.supabaseClient.from('notifications').select('id,user_id,sale_id,type,title,message,read_at,created_at').eq('user_id', user.id).order('created_at', { ascending:false }).limit(100);
    if (!error) { notifications = data || []; render(); }
  }

  function showToast(item) {
    const toast = document.querySelector('#notificationToast');
    if (!toast || document.querySelector('#notificationPanel')?.classList.contains('open')) return;
    document.querySelector('#notificationToastIcon').textContent = iconByType[item.type] || '🔔';
    document.querySelector('#notificationToastTitle').textContent = item.title;
    document.querySelector('#notificationToastMessage').textContent = item.message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 4500);
  }

  function openPanel() {
    document.querySelector('#notificationToast')?.classList.remove('show');
    document.querySelector('#notificationPanel')?.classList.add('open');
    document.querySelector('#notificationOverlay')?.classList.add('show');
    document.querySelector('#notificationPanel')?.setAttribute('aria-hidden','false');
  }

  function closePanel() {
    document.querySelector('#notificationPanel')?.classList.remove('open');
    document.querySelector('#notificationOverlay')?.classList.remove('show');
    document.querySelector('#notificationPanel')?.setAttribute('aria-hidden','true');
  }

  async function markAllRead() {
    const unreadIds = notifications.filter(item => !item.read_at).map(item => item.id);
    if (!unreadIds.length) return;
    const now = new Date().toISOString();
    const { error } = await window.supabaseClient.from('notifications').update({ read_at:now }).in('id', unreadIds);
    if (!error) {
      notifications = notifications.map(item => unreadIds.includes(item.id) ? { ...item, read_at:now } : item);
      render();
    }
  }

  async function openNotification(id) {
    const item = notifications.find(row => row.id === id);
    if (!item) return;
    if (!item.read_at) {
      const now = new Date().toISOString();
      const { error } = await window.supabaseClient.from('notifications').update({ read_at:now }).eq('id', item.id);
      if (!error) { item.read_at = now; render(); }
    }
    if (!item.sale_id) return;
    const target = window.currentUser?.profile?.role === 'admin' ? 'bko.html' : 'vendas.html';
    window.location.href = `${target}?sale=${encodeURIComponent(item.sale_id)}`;
  }

  function openSaleFromQuery() {
    const saleId = new URLSearchParams(window.location.search).get('sale');
    if (!saleId || !['bko.html','vendas.html'].some(page => window.location.pathname.endsWith(page))) return;
    const tryOpen = () => {
      const card = document.querySelector(`[data-id="${CSS.escape(saleId)}"]`);
      if (!card) return false;
      card.click();
      const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
      history.replaceState(null, '', cleanUrl);
      return true;
    };
    if (tryOpen()) return;
    const observer = new MutationObserver(() => {
      if (tryOpen()) observer.disconnect();
    });
    const target = document.querySelector('#salesList') || document.body;
    observer.observe(target, { childList:true, subtree:true });
    setTimeout(() => observer.disconnect(), 10000);
  }

  function setupRealtime() {
    const user = window.currentUser;
    if (!user || notificationChannel) return;
    notificationChannel = window.supabaseClient.channel(`notifications-${user.id}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'notifications', filter:`user_id=eq.${user.id}` }, payload => {
        const item = payload.new;
        notifications = [item, ...notifications.filter(row => row.id !== item.id)].slice(0,100);
        render();
        showToast(item);
      })
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'notifications', filter:`user_id=eq.${user.id}` }, payload => {
        notifications = notifications.map(row => row.id === payload.new.id ? payload.new : row);
        render();
      })
      .subscribe();
  }

  window.initNotifications = async () => {
    buildUi();
    await loadNotifications();
    setupRealtime();
    openSaleFromQuery();
  };

  window.addEventListener('beforeunload', () => {
    if (notificationChannel) window.supabaseClient.removeChannel(notificationChannel);
  });
})();