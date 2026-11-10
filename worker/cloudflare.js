import attendanceMarkup from './attendance-preview.html';
import { attendancePreview } from './attendance-preview.js';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/atendimentos-teste') {
      return attendancePreview(request, attendanceMarkup, {
        url: env.SUPABASE_URL,
        publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
      });
    }
    return env.ASSETS.fetch(request);
  },
};
