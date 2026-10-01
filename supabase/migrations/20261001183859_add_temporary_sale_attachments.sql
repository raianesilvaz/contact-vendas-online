-- Private files use Storage metadata only. The file bytes are never put in sales.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sale-attachments', 'sale-attachments', false, 10485760,
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

create policy "sale_attachments_seller_upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'sale-attachments'
  and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.sales s
    where s.id = ((storage.foldername(name))[1])::uuid
      and s.seller_id = (select auth.uid())
      and s.created_at > now() - interval '30 minutes'
  )
);

create policy "sale_attachments_bko_download"
on storage.objects for select to authenticated
using (
  bucket_id = 'sale-attachments'
  and created_at > now() - interval '48 hours'
  and (select private.current_user_role()) in ('admin'::public.user_role, 'bko'::public.user_role)
);

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table private.sale_attachment_cleanup_config (
  id boolean primary key default true check (id),
  token text not null
);
insert into private.sale_attachment_cleanup_config (id, token)
values (true, encode(extensions.gen_random_bytes(32), 'hex'));
revoke all on private.sale_attachment_cleanup_config from public, anon, authenticated;

create function public.sale_attachment_cleanup_allowed(p_token text)
returns boolean
language sql security definer set search_path = ''
as $$
  select exists (
    select 1 from private.sale_attachment_cleanup_config
    where id = true and token = p_token
  );
$$;
revoke all on function public.sale_attachment_cleanup_allowed(text) from public, anon, authenticated;
grant execute on function public.sale_attachment_cleanup_allowed(text) to service_role;

create function public.expired_sale_attachment_paths()
returns table(path text)
language sql security definer set search_path = ''
as $$
  select name
  from storage.objects
  where bucket_id = 'sale-attachments'
    and created_at <= now() - interval '48 hours'
  order by created_at, id
  limit 100;
$$;
revoke all on function public.expired_sale_attachment_paths() from public, anon, authenticated;
grant execute on function public.expired_sale_attachment_paths() to service_role;

create function private.request_sale_attachment_cleanup()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://loemekgsmzijuccekfei.supabase.co/functions/v1/purge-sale-attachments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cleanup-Token', (select token from private.sale_attachment_cleanup_config where id = true)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;
revoke all on function private.request_sale_attachment_cleanup() from public, anon, authenticated;

select cron.schedule(
  'purge-sale-attachments-hourly',
  '0 * * * *',
  'select private.request_sale_attachment_cleanup()'
);
