const SUPABASE_URL = 'https://loemekgsmzijuccekfei.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_B6uEZRaz1xAFu43X_eSYGg_bgQwez9N';
window.APP_PREVIEW_MODE = false;
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

(()=>{
  const path=location.pathname.replace(/\/+$/,'');
  const file=path.endsWith('/bko')||path.endsWith('/bko.html')?'seller-note-bko.js':(path===''||path==='/'||path.endsWith('/index')||path.endsWith('/index.html'))?'seller-note-form.js':null;
  if(!file)return;
  const script=document.createElement('script');
  script.src=`${file}?v=1`;
  script.defer=true;
  document.head.appendChild(script);
})();
