create or replace function private.set_sale_acceptance_internal(
  p_sale_id uuid,
  p_completed boolean
)
returns public.sales
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role public.user_role;
  v_sale public.sales;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid() and p.active = true;

  if v_role is null or v_role not in ('admin'::public.user_role, 'financeiro'::public.user_role) then
    raise exception 'Apenas administradores e o Financeiro podem confirmar o aceite.' using errcode = '42501';
  end if;

  update public.sales
  set acceptance_completed = coalesce(p_completed, false),
      acceptance_completed_at = case when coalesce(p_completed, false) then now() else null end,
      acceptance_completed_by = case when coalesce(p_completed, false) then auth.uid() else null end
  where id = p_sale_id
  returning * into v_sale;

  if v_sale.id is null then
    raise exception 'Venda não encontrada.' using errcode = 'P0002';
  end if;

  return v_sale;
end;
$function$;

revoke all on function private.set_sale_acceptance_internal(uuid, boolean) from public;
revoke all on function private.set_sale_acceptance_internal(uuid, boolean) from anon;
grant execute on function private.set_sale_acceptance_internal(uuid, boolean) to authenticated;

create or replace function public.set_sale_acceptance(
  p_sale_id uuid,
  p_completed boolean
)
returns public.sales
language sql
security invoker
set search_path = ''
as $function$
  select private.set_sale_acceptance_internal(p_sale_id, p_completed);
$function$;

revoke all on function public.set_sale_acceptance(uuid, boolean) from public;
revoke all on function public.set_sale_acceptance(uuid, boolean) from anon;
grant execute on function public.set_sale_acceptance(uuid, boolean) to authenticated;
