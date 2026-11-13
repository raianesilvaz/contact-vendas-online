import attendanceMarkup from './attendance-preview.html';
import { attendancePreview } from './attendance-preview.js';
import { smsCapabilityStatus } from './sms-capability.js';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/sms/capabilities') return smsCapabilityStatus(request, env);
    if (path.startsWith('/api/sms/')) return new Response(JSON.stringify({error:'sms_not_enabled'}), {status:503,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
    if (path === '/api/atendimentos-teste') {
      return attendancePreview(request, attendanceMarkup, {
        url: env.SUPABASE_URL,
        publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
      });
    }
    return env.ASSETS.fetch(request);
  },
};
