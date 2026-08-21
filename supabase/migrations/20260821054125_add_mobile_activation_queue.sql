alter table public.sales add column if not exists mobile_activation_date date;

create or replace function public.validate_mobile_activation_date()
returns trigger language plpgsql set search_path = ''
as $$
declare v_operator_name text;
begin
  if new.mobile_activation_date is null then return new; end if;
  select o.name into v_operator_name from public.operators o where o.id = new.operator_id;
  if lower(trim(coalesce(v_operator_name, ''))) <> 'claro' or not coalesce(new.is_multi, false) then
    raise exception 'A ativação do chip só pode ser informada em vendas Claro MULTI.' using errcode = '23514';
  end if;
  if new.installation_date is null then raise exception 'Informe primeiro a instalação da Internet.' using errcode = '23514'; end if;
  if new.mobile_activation_date < new.installation_date then raise exception 'A ativação do chip não pode ser anterior à instalação da Internet.' using errcode = '23514'; end if;
  if new.mobile_activation_date > current_date then raise exception 'A ativação do chip não pode ser futura.' using errcode = '23514'; end if;
  return new;
end;
$$;

drop trigger if exists validate_mobile_activation_date_trigger on public.sales;
create trigger validate_mobile_activation_date_trigger
before insert or update of mobile_activation_date, installation_date, operator_id, is_multi
on public.sales for each row execute function public.validate_mobile_activation_date();

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
  if v_role <> 'admin'::public.user_role and v_sale.mobile_activation_date is not null then
    raise exception 'A ativação já foi informada. Solicite correção ao administrador.' using errcode = '23514';
  end if;
  update public.sales set mobile_activation_date = p_activation_date where id = p_sale_id returning * into v_sale;
  return v_sale;
end;
$$;

revoke all on function public.confirm_mobile_activation(uuid,date) from public, anon;
grant execute on function public.confirm_mobile_activation(uuid,date) to authenticated;
comment on column public.sales.mobile_activation_date is 'Data real de ativação do chip em venda Claro MULTI.';
