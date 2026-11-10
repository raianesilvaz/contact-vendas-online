import attendanceMarkup from './attendance-preview.html';
import { attendancePreview } from './attendance-preview.js';
import { personalWhatsAppProxy } from './personal-whatsapp-proxy.js';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    const prefix = '/api/atendimentos-teste/whatsapp/';
    if (path.startsWith(prefix)) return personalWhatsAppProxy(request, path.slice(prefix.length));
    if (path === '/api/atendimentos-teste') {
      return attendancePreview(request, attendanceMarkup, {
        url: env.SUPABASE_URL,
        publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
      });
    }
    return env.ASSETS.fetch(request);
  },
};
