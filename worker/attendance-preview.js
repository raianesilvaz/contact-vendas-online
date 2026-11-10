const allowedRoles = new Set(['admin', 'vendedora', 'financeiro']);

function reply(message, status) {
  return new Response(message, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function attendancePreview(request, markup, { url, publishableKey, fetchApi = fetch }) {
  if (request.method !== 'GET') return reply('Método não permitido.', 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.match(/^Bearer [^\s]+$/i)) return reply('Entre no CONTACT para continuar.', 401);

  const headers = { Authorization: authorization, apikey: publishableKey };
  try {
    const identity = await fetchApi(`${url}/auth/v1/user`, { headers });
    if (identity.status === 401 || identity.status === 403) return reply('Sua sessão expirou.', 401);
    if (!identity.ok) return reply('Não foi possível verificar a sessão.', 503);
    const user = await identity.json();
    if (!user.id) return reply('Sua sessão expirou.', 401);

    const profileUrl = new URL(`${url}/rest/v1/profiles`);
    profileUrl.search = new URLSearchParams({ select: 'role,active', id: `eq.${user.id}`, limit: '1' });
    const result = await fetchApi(profileUrl, { headers });
    if (!result.ok) return reply('Não foi possível verificar o perfil.', 503);
    const [profile] = await result.json();
    if (!profile?.active || !allowedRoles.has(profile.role)) return reply('Seu perfil não tem acesso a esta prévia.', 403);
    return reply(markup, 200);
  } catch {
    return reply('Não foi possível verificar o acesso. Tente novamente.', 503);
  }
}
