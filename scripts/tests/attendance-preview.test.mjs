import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attendancePreview } from '../../worker/attendance-preview.js';

const config = { url: 'https://auth.example.invalid', publishableKey: 'fixture' };
const markup = '<main>Demo fixture</main>';
const request = (token) => new Request('https://contact.example.invalid/api/atendimentos-teste', {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});

function authFixture(profile, identityStatus = 200) {
  return async (url, { headers }) => {
    assert.equal(headers.Authorization, 'Bearer fixture-token');
    assert.equal(headers.apikey, config.publishableKey);
    const parsed = new URL(url);
    if (parsed.pathname === '/auth/v1/user') {
      return Response.json({ id: 'fixture-user' }, { status: identityStatus });
    }
    assert.equal(parsed.pathname, '/rest/v1/profiles');
    assert.equal(parsed.searchParams.get('id'), 'eq.fixture-user');
    return Response.json(profile ? [profile] : []);
  };
}

test('an anonymous or expired session cannot load the demo markup', async () => {
  const anonymous = await attendancePreview(request(), markup, config);
  assert.equal(anonymous.status, 401);
  assert.notEqual(await anonymous.text(), markup);
  const expired = await attendancePreview(request('fixture-token'), markup, { ...config, fetchApi: authFixture(null, 401) });
  assert.equal(expired.status, 401);
});

test('the demo is restricted to active administrators, sellers and finance profiles', async () => {
  for (const role of ['admin', 'vendedora', 'financeiro', 'parceiro', 'supervisora']) {
    for (const active of [true, false]) {
      const allowed = active && ['admin', 'vendedora', 'financeiro'].includes(role);
      const response = await attendancePreview(request('fixture-token'), markup, { ...config, fetchApi: authFixture({ role, active }) });
      assert.equal(response.status, allowed ? 200 : 403, `${role}, active=${active}`);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal((await response.text()) === markup, allowed);
    }
  }
});

test('missing profiles and upstream failures do not expose the demo', async () => {
  const missing = await attendancePreview(request('fixture-token'), markup, { ...config, fetchApi: authFixture(null) });
  assert.equal(missing.status, 403);
  const failure = await attendancePreview(request('fixture-token'), markup, { ...config, fetchApi: async () => { throw Error('offline'); } });
  assert.equal(failure.status, 503);
});
