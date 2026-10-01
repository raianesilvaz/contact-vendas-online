import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

Deno.serve(async request => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return new Response('Configuration unavailable', { status: 500 });
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data: allowed, error: authError } = await client.rpc('sale_attachment_cleanup_allowed', {
    p_token: request.headers.get('X-Cleanup-Token') || '',
  });
  if (authError || allowed !== true) return new Response('Forbidden', { status: 403 });

  let removed = 0;
  for (let batch = 0; batch < 10; batch++) {
    const { data: files, error } = await client.rpc('expired_sale_attachment_paths');
    if (error) return new Response('Could not list expired files', { status: 500 });
    if (!files?.length) break;
    const paths = files.map((file: { path: string }) => file.path);
    const { error: removeError } = await client.storage.from('sale-attachments').remove(paths);
    if (removeError) return new Response('Could not remove expired files', { status: 500 });
    removed += paths.length;
  }
  return Response.json({ removed });
});
