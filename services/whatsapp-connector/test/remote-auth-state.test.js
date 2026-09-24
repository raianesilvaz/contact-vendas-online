import assert from 'node:assert/strict';
import test from 'node:test';
import { useRemoteAuthState } from '../src/remote-auth-state.js';

const config = {
  supabaseUrl: 'https://example.supabase.co',
  secretKey: 'server-secret',
  encryptionSecret: '7f'.repeat(32)
};

function memoryStorage() {
  let object = null;
  return async (_url, options = {}) => {
    const method = options.method || 'GET';
    if (method === 'GET') {
      return object
        ? new Response(object, { status: 200 })
        : new Response(null, { status: 404 });
    }
    if (method === 'POST') {
      object = Buffer.from(options.body);
      return new Response(null, { status: 200 });
    }
    if (method === 'DELETE') {
      object = null;
      return new Response(null, { status: 200 });
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
