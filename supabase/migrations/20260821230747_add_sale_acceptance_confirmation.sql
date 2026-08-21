alter table public.sales
  add column if not exists acceptance_completed boolean not null default false,
  add column if not exists acceptance_completed_at timestamptz,
  add column if not exists acceptance_completed_by uuid references public.profiles(id);

alter table public.sales drop constraint if exists sales_acceptance_completion_consistency;
alter table public.sales add constraint sales_acceptance_completion_consistency check (
  (acceptance_completed and acceptance_completed_at is not null and acceptance_completed_by is not null)
  or
  (not acceptance_completed and acceptance_completed_at is null and acceptance_completed_by is null)
);

create index if not exists sales_acceptance_completed_by_idx
  on public.sales (acceptance_completed_by)
  where acceptance_completed_by is not null;

create or replace function public.set_sale_acceptance(
  p_sale_id uuid,
  p_completed boolean
)
returns public.sales
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_role public.user_role;
  v_sale public.sales;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.' using errcode='42501';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid() and p.active = true;

  if v_role <> 'admin'::public.user_role then
    raise exception 'Apenas administradores podem confirmar o aceite.' using errcode='42501';
  end if;

  update public.sales
  set acceptance_completed = coalesce(p_completed, false),
      acceptance_completed_at = case when coalesce(p_completed, false) then now() else null end,
      acceptance_completed_by = case when coalesce(p_completed, false) then auth.uid() else null end
  where id = p_sale_id
  returning * into v_sale;

  if v_sale.id is null then
    raise exception 'Venda não encontrada.' using errcode='P0002';
  end if;

  return v_sale;
end;
$function$;

revoke all on function public.set_sale_acceptance(uuid, boolean) from public;
revoke all on function public.set_sale_acceptance(uuid, boolean) from anon;
grant execute on function public.set_sale_acceptance(uuid, boolean) to authenticated;