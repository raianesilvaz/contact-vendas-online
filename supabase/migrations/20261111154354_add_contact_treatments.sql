create function private.contact_treatment_phone(value text)
returns text
language sql immutable strict
set search_path = ''
as $$
  select case
    when number ~ '^0[1-9][0-9]{9,10}$' then '55' || substr(number, 2)
    when number ~ '^[1-9][0-9]{9,10}$' then '55' || number
    when number ~ '^55[1-9][0-9]{9,10}$' then number
  end
  from (select regexp_replace(value, '[^0-9]', '', 'g') as number) digits
  where btrim(value) ~ '^[+0-9[:space:]().-]+$';
$$;

create function private.can_access_contact_treatment(target_phone text)
returns boolean
language sql stable
set search_path = ''
as $$
  with access_profile as (select private.current_user_role() as role)
  select case
    when role in ('admin', 'financeiro') then
      exists (select 1 from public.contact_leads where phone = target_phone)
      or exists (
        select 1 from public.sales where target_phone in (
          private.contact_treatment_phone(phone_1), private.contact_treatment_phone(phone_2)
        )
      )
    when role = 'vendedora' then exists (
      select 1 from public.sales
      where seller_id = (select auth.uid())
        and target_phone in (
          private.contact_treatment_phone(phone_1), private.contact_treatment_phone(phone_2)
        )
    )
    else false
  end
  from access_profile;
$$;

create function private.contact_treatment_author()
returns text
language sql stable
set search_path = ''
as $$
  select coalesce(
    (select nullif(btrim(full_name), '') from public.profiles where id = (select auth.uid())),
    'Usuário'
  );
$$;

revoke all on function private.contact_treatment_phone(text), private.can_access_contact_treatment(text),
  private.contact_treatment_author() from public, anon;
grant execute on function private.contact_treatment_phone(text), private.can_access_contact_treatment(text),
  private.contact_treatment_author() to authenticated;

create table public.contact_treatments (
  id uuid primary key default gen_random_uuid(),
  phone text not null check (phone ~ '^55[1-9][0-9]{9,10}$'),
  status text check (status in ('a_tratar', 'em_atendimento', 'aguardando_retorno', 'encerrado_sem_venda', 'nao_contatar')),
  note text check (note is null or char_length(btrim(note)) between 1 and 2000),
  author_id uuid not null default auth.uid(),
  author_name text not null default private.contact_treatment_author(),
  created_at timestamptz not null default clock_timestamp(),
  check (status is not null or note is not null)
);

create index contact_treatments_phone_date_idx on public.contact_treatments (phone, created_at desc, id desc);

alter table public.contact_treatments enable row level security;
revoke all on public.contact_treatments from public, anon, authenticated;
grant select on public.contact_treatments to authenticated;
grant insert (id, phone, status, note) on public.contact_treatments to authenticated;

create policy contact_treatments_select on public.contact_treatments
for select to authenticated using (private.can_access_contact_treatment(phone));

create policy contact_treatments_insert on public.contact_treatments
for insert to authenticated
with check (author_id = (select auth.uid()) and private.can_access_contact_treatment(phone));

create view public.contact_treatment_summaries with (security_invoker = true) as
select distinct on (phone, (kind.status))
  phone, id, created_at,
  case when kind.status then event.status end as status,
  case when not kind.status then note end as note
from public.contact_treatments event
cross join (values (true), (false)) as kind(status)
where (kind.status and event.status is not null) or (not kind.status and note is not null)
order by phone, kind.status, created_at desc, id desc;

revoke all on public.contact_treatment_summaries from public, anon, authenticated;
grant select on public.contact_treatment_summaries to authenticated;
