const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Retry transport failures only; invalid credentials and other 4xx must fail closed.
export function sessionRpc({ supabaseUrl, publishableKey, accessToken, fetchImpl = fetch, sleep = wait }) {
  return async (name, body = {}) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await fetchImpl(`${String(supabaseUrl).replace(/\/+$/, '')}/rest/v1/rpc/${name}`, {
          method: 'POST',
          headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_token: accessToken, ...body }),
          signal: AbortSignal.timeout(15_000)
        });
      } catch (error) {
        if (attempt === 2) throw new Error('Armazenamento temporariamente indisponível.', { cause: error });
      }
      if (response && (response.ok || (response.status !== 429 && response.status < 500) || attempt === 2)) return response;
      await sleep(300 * (attempt + 1));
    }
  };
}
