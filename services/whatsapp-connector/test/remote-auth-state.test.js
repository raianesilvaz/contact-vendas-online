import assert from 'node:assert/strict';
import test from 'node:test';
import { useRemoteAuthState } from '../src/remote-auth-state.js';

const config = {
  supabaseUrl: 'https://example.supabase.co',
  publishableKey: 'publishable-key',
  accessToken: 'connector-token',
  encryptionSecret: '7f'.repeat(32)
};

function memoryStorage() {
  let object = null;
  return async (url, options = {}) => {
    const body = JSON.parse(options.body);
    if (url.endsWith('contact_get_whatsapp_connector_session')) {
      return Response.json(object?.toString('base64') || null);
    }
    if (url.endsWith('contact_put_whatsapp_connector_session')) {
      object = Buffer.from(body.p_payload, 'base64');
      return Response.json(null);
    }
    if (url.endsWith('contact_delete_whatsapp_connector_session')) {
      object = null;
      return Response.json(null);
    }
    return new Response(null, { status: 405 });
  };
}

test('persiste, restaura e remove uma sessão criptografada', async () => {
  const fetchImpl = memoryStorage();
  const first = await useRemoteAuthState({ ...config, fetchImpl });
  first.state.creds.me = { id: '5511999999999:1@s.whatsapp.net', name: 'CONTACT' };
  await first.state.keys.set({ session: { abc: Buffer.from('segredo') } });
  await first.saveCreds();

  const restored = await useRemoteAuthState({ ...config, fetchImpl });
  assert.equal(restored.state.creds.me.name, 'CONTACT');
  const keys = await restored.state.keys.get('session', ['abc']);
  assert.deepEqual(keys.abc, Buffer.from('segredo'));

  await restored.clear();
  const empty = await useRemoteAuthState({ ...config, fetchImpl });
  assert.equal(empty.state.creds.me, undefined);
  assert.deepEqual(await empty.state.keys.get('session', ['abc']), { abc: null });
});
