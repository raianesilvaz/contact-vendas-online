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
     or pg_catalog.encode(extensions.digest(p_token, 'sha256'), 'hex') <> expected_hash then
    raise exception 'invalid connector credential' using errcode = '28000';
  end if;

  select pg_catalog.encode(payload, 'base64') into result
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
     or pg_catalog.encode(extensions.digest(p_token, 'sha256'), 'hex') <> expected_hash then
    raise exception 'invalid connector credential' using errcode = '28000';
  end if;

  decoded_payload := pg_catalog.decode(p_payload, 'base64');
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
     or pg_catalog.encode(extensions.digest(p_token, 'sha256'), 'hex') <> expected_hash then
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


