const SUPABASE_URL = 'https://loemekgsmzijuccekfei.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_B6uEZRaz1xAFu43X_eSYGg_bgQwez9N';
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
