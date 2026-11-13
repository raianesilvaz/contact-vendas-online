-- Backend-only reservation, called inside a trusted server transaction.
-- Returns up to 50 eligible pending recipients; never contacts SMS provider.
create or replace function contact_sms_private.reserve_next_batch(
  p_campaign_id uuid,
  p_limit integer default 50
) returns table(recipient_id uuid, phone_e164 text, batch_number integer)
language plpgsql security invoker
set search_path = pg_catalog, contact_sms_private
as $$
declare v_campaign_status text;
begin
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'Batch limit must be 1..50';
  end if;
  -- One reservation at a time per campaign, including simultaneous requests.
  perform pg_advisory_xact_lock(hashtextextended(p_campaign_id::text, 17413));
  select c.status into v_campaign_status
  from contact_sms_private.campaigns c where c.id=p_campaign_id for update;
  if v_campaign_status is distinct from 'ready' then
    raise exception 'Campaign not ready or not found';
  end if;
  return query
  with chosen as (
    select r.id
    from contact_sms_private.recipients r
    where r.campaign_id=p_campaign_id
      and r.status='pending'
      and r.consent_recorded_at is not null
      and r.opted_out_at is null
      and not exists (
        select 1 from contact_sms_private.suppression s
        where s.phone_e164=r.phone_e164
      )
      and not exists (
        select 1 from contact_sms_private.recipients prev
        where prev.phone_e164=r.phone_e164
          and prev.id<>r.id
          and (
            prev.status in ('reserved','sending','unknown')
            or (prev.status='sent' and (
              prev.campaign_id=p_campaign_id
              or prev.sent_at >= now()-interval '7 days'
            ))
          )
      )
    order by r.batch_number,r.created_at,r.id
    limit p_limit
    for update of r skip locked
  ), reserved as (
    update contact_sms_private.recipients r
    set status='reserved',reserved_at=now()
    from chosen where r.id=chosen.id
    returning r.id,r.phone_e164,r.batch_number
  )
  select reserved.id,reserved.phone_e164,reserved.batch_number from reserved;
end;
$$;
revoke all on function contact_sms_private.reserve_next_batch(uuid,integer) from public,anon,authenticated;
-- Fail closed: never expose the private schema through PostgREST.
