alter table public.sales
  add column if not exists mobile_removed_at timestamptz,
  add column if not exists mobile_removed_by uuid references public.profiles(id) on delete set null,
  add column if not exists mobile_removal_reason text;

create index if not exists sales_mobile_management_idx
  on public.sales (seller_id, installation_date)
  where is_multi = true and installation_date is not null;

create or replace function public.validate_mobile_removal()
returns trigger language plpgsql set search_path = ''
as $$
declare v_operator_name text;
begin
  if new.mobile_removed_at is null
     and new.mobile_removed_by is null
     and new.mobile_removal_reason is null then
    return new;
  end if;

  if new.mobile_removed_at is null
     or new.mobile_removed_by is null
     or nullif(trim(new.mobile_removal_reason), '') is null then
    raise exception 'Informe o responsável, a data e o motivo da remoção do Móvel.' using errcode = '23514';
  end if;

  if char_length(trim(new.mobile_removal_reason)) < 3 then
    raise exception 'Informe um motivo válido para remover o Móvel.' using errcode = '23514';
  end if;

  select o.name into v_operator_name
  from public.operators o
  where o.id = new.operator_id;

  if lower(trim(coalesce(v_operator_name, ''))) <> 'claro'
     or not coalesce(new.is_multi, false) then
    raise exception 'A remoção do Móvel só pode ser registrada em vendas Claro MULTI.' using errcode = '23514';
  end if;

  if new.installation_date is null then
    raise exception 'A Internet precisa estar instalada antes da remoção do Móvel.' using errcode = '23514';
  end if;

  if new.mobile_activation_date is not null then
    raise exception 'Não é possível remover um chip já ativado.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_mobile_removal_trigger on public.sales;
create trigger validate_mobile_removal_trigger
before insert or update of mobile_removed_at, mobile_removed_by, mobile_removal_reason,
  mobile_activation_date, installation_date, operator_id, is_multi
on public.sales for each row execute function public.validate_mobile_removal();

create or replace function public.remove_mobile_from_plan(p_sale_id uuid, p_reason text)
returns public.sales
language plpgsql security definer set search_path = ''
as $$
declare v_role public.user_role; v_sale public.sales;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid() and p.active = true;

  if v_role <> 'admin'::public.user_role then
    raise exception 'Apenas administradores podem remover o Móvel do plano.' using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null
     or char_length(trim(p_reason)) < 3 then
    raise exception 'Informe o motivo da remoção do Móvel.' using errcode = '23514';
  end if;

  select s.* into v_sale
  from public.sales s
  where s.id = p_sale_id
  for update;

  if v_sale.id is null then
    raise exception 'Venda não encontrada.' using errcode = '42501';
  end if;

  if not coalesce(v_sale.is_multi, false)
     or v_sale.installation_date is null
     or v_sale.mobile_activation_date is not null
     or v_sale.mobile_removed_at is not null then
    raise exception 'Este Móvel não está pendente de ativação.' using errcode = '23514';
  end if;

  update public.sales
  set mobile_removed_at = now(),
      mobile_removed_by = auth.uid(),
      mobile_removal_reason = trim(p_reason)
  where id = p_sale_id
  returning * into v_sale;

  return v_sale;
end;
$$;

revoke all on function public.remove_mobile_from_plan(uuid,text) from public, anon;
grant execute on function public.remove_mobile_from_plan(uuid,text) to authenticated;

create or replace function public.confirm_mobile_activation(p_sale_id uuid, p_activation_date date)
returns public.sales
language plpgsql security definer set search_path = ''
as $$
declare v_role public.user_role; v_sale public.sales;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.' using errcode = '42501'; end if;
  select p.role into v_role from public.profiles p where p.id = auth.uid() and p.active = true;
  if v_role not in ('vendedora'::public.user_role, 'parceiro'::public.user_role, 'admin'::public.user_role) then
    raise exception 'Seu perfil não pode informar a ativação do chip.' using errcode = '42501';
  end if;
  if p_activation_date is null then raise exception 'Informe a data de ativação do chip.' using errcode = '23514'; end if;
  select s.* into v_sale from public.sales s where s.id = p_sale_id for update;
  if v_sale.id is null then raise exception 'Venda não encontrada.' using errcode = '42501'; end if;
  if v_role <> 'admin'::public.user_role and v_sale.seller_id <> auth.uid() then
    raise exception 'Venda não encontrada.' using errcode = '42501';
  end if;
  if v_sale.mobile_removed_at is not null then
    raise exception 'O Móvel foi removido deste plano e não pode ser ativado.' using errcode = '23514';
  end if;
  if v_role <> 'admin'::public.user_role and v_sale.mobile_activation_date is not null then
    raise exception 'A ativação já foi informada. Solicite correção ao administrador.' using errcode = '23514';
  end if;
  update public.sales set mobile_activation_date = p_activation_date where id = p_sale_id returning * into v_sale;
  return v_sale;
end;
$$;

revoke all on function public.confirm_mobile_activation(uuid,date) from public, anon;
grant execute on function public.confirm_mobile_activation(uuid,date) to authenticated;

comment on column public.sales.mobile_removed_at is 'Data em que um administrador retirou o componente Móvel do plano sem apagar o histórico.';
comment on column public.sales.mobile_removed_by is 'Administrador responsável pela retirada do componente Móvel.';
comment on column public.sales.mobile_removal_reason is 'Motivo informado pelo administrador para retirar o componente Móvel.';
