create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table if not exists private.whatsapp_connector_sessions (
  session_id text primary key,
  payload bytea not null,
  updated_at timestamptz not null default now(),
  constraint whatsapp_connector_sessions_payload_limit
    check (octet_length(payload) <= 2097152)
);

create table if not exists private.whatsapp_connector_credentials (
  credential_id text primary key,
  token_sha256 text not null,
  updated_at timestamptz not null default now()
);

insert into private.whatsapp_connector_credentials (credential_id, token_sha256)
values ('primary', '7ff8ed3078abaf0fd57ecd3f3f6196eb267d6e0c8b9fbdbd6d36d4fb2eb028a0')
on conflict (credential_id) do update
set token_sha256 = excluded.token_sha256,
    updated_at = now();

revoke all on all tables in schema private from public, anon, authenticated;

create or replace function public.contact_get_whatsapp_connector_session(
  p_token text,
  p_session_id text default 'primary'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_hash text;
  result text;
begin
  select token_sha256 into expected_hash
  from private.whatsapp_connector_credentials
  where credential_id = 'primary';

  if expected_hash is null
     or extensions.encode(extensions.digest(p_token, 'sha256'), 'hex') <> expected_hash then
    raise exception 'invalid connector credential' using errcode = '28000';
  end if;

  select extensions.encode(payload, 'base64') into result
  from private.whatsapp_connector_sessions
  where session_id = p_session_id;

  return result;
end;
$$;

create or replace function public.contact_put_whatsapp_connector_session(
  p_token text,
  p_session_id text,
  p_payload text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_hash text;
  decoded_payload bytea;
begin
  select token_sha256 into expected_hash
  from private.whatsapp_connector_credentials
  where credential_id = 'primary';

  if expected_hash is null
     or extensions.encode(extensions.digest(p_token, 'sha256'), 'hex') <> expected_hash then
    raise exception 'invalid connector credential' using errcode = '28000';
  end if;

  decoded_payload := extensions.decode(p_payload, 'base64');
  if octet_length(decoded_payload) > 2097152 then
    raise exception 'session payload too large' using errcode = '22001';
  end if;

  insert into private.whatsapp_connector_sessions (session_id, payload, updated_at)
  values (p_session_id, decoded_payload, now())
  on conflict (session_id) do update
  set payload = excluded.payload,
      updated_at = excluded.updated_at;
end;
$$;

create or replace function public.contact_delete_whatsapp_connector_session(
  p_token text,
  p_session_id text default 'primary'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_hash text;
begin
  select token_sha256 into expected_hash
  from private.whatsapp_connector_credentials
  where credential_id = 'primary';

  if expected_hash is null
     or extensions.encode(extensions.digest(p_token, 'sha256'), 'hex') <> expected_hash then
    raise exception 'invalid connector credential' using errcode = '28000';
  end if;

  delete from private.whatsapp_connector_sessions
  where session_id = p_session_id;
end;
$$;

revoke all on function public.contact_get_whatsapp_connector_session(text, text) from public;
revoke all on function public.contact_put_whatsapp_connector_session(text, text, text) from public;
revoke all on function public.contact_delete_whatsapp_connector_session(text, text) from public;

grant execute on function public.contact_get_whatsapp_connector_session(text, text) to anon;
grant execute on function public.contact_put_whatsapp_connector_session(text, text, text) to anon;
grant execute on function public.contact_delete_whatsapp_connector_session(text, text) to anon;

