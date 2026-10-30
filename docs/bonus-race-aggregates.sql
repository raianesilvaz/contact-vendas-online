create or replace function private.bonus_race_month(p_month date)
returns table(seller_id uuid,full_name text,connected bigint,claro bigint)
language plpgsql stable security definer set search_path=''
as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role::text in ('vendedora','admin')) then
  raise exception 'Acesso não autorizado' using errcode='42501';
 end if;
 if p_month is null or extract(day from p_month)<>1 then raise exception 'Informe o primeiro dia do mês'; end if;
 return query
 select p.id,p.full_name,count(s.id),count(s.id) filter(where lower(o.name) like '%claro%')
 from public.profiles p
 left join public.sales s on s.seller_id=p.id and s.status::text='conectado'
  and s.installation_date>=p_month and s.installation_date<(p_month+interval '1 month')::date
 left join public.operators o on o.id=s.operator_id
 where p.role::text='vendedora' and p.active
 group by p.id,p.full_name order by count(s.id) desc,p.full_name;
end;$$;
revoke all on function private.bonus_race_month(date) from public,anon;
grant execute on function private.bonus_race_month(date) to authenticated;
create or replace function public.bonus_race_month(p_month date)
returns table(seller_id uuid,full_name text,connected bigint,claro bigint)
language sql stable security invoker set search_path=''
as $$ select * from private.bonus_race_month(p_month); $$;
revoke all on function public.bonus_race_month(date) from public,anon;
grant execute on function public.bonus_race_month(date) to authenticated;
grant usage on schema private to authenticated;
