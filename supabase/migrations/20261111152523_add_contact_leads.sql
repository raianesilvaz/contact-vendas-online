create table public.contact_leads (
  phone text primary key check (phone ~ '^55[1-9][0-9]{9,10}$'),
  city text check (city is null or (city = btrim(city) and char_length(city) between 1 and 120))
);

alter table public.contact_leads enable row level security;

revoke all on public.contact_leads from public, anon, authenticated;
grant select on public.contact_leads to authenticated;

create policy contact_leads_select on public.contact_leads
for select to authenticated
using ((select private.current_user_role()) in ('admin', 'financeiro'));
