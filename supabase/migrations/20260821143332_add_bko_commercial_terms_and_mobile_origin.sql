alter table public.sales
  add column if not exists initial_is_multi boolean,
  add column if not exists mobile_origin text,
  add column if not exists mobile_added_by uuid references public.profiles(id) on delete set null,
  add column if not exists mobile_added_at timestamptz,
  add column if not exists commercial_terms_updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists commercial_terms_updated_at timestamptz;

update public.sales
set initial_is_multi = coalesce(is_multi,false),
    mobile_origin = case when coalesce(is_multi,false) then 'seller' else null end
where initial_is_multi is null;

alter table public.sales alter column initial_is_multi set default false;
alter table public.sales alter column initial_is_multi set not null;

alter table public.sales drop constraint if exists sales_mobile_origin_check;
alter table public.sales add constraint sales_mobile_origin_check
  check (mobile_origin is null or mobile_origin in ('seller','bko'));

alter table public.sales drop constraint if exists sales_mobile_origin_consistency_check;
alter table public.sales add constraint sales_mobile_origin_consistency_check
  check (
    (mobile_origin = 'seller' and initial_is_multi = true)
    or (mobile_origin = 'bko' and mobile_added_by is not null and mobile_added_at is not null)
    or (mobile_origin is null and initial_is_multi = false)
  );

create table if not exists public.sale_commercial_history (
  id bigint generated always as identity primary key,
  sale_id uuid not null references public.sales(id) on delete cascade,
  previous_terms jsonb not null,
  new_terms jsonb not null,
  changed_by uuid references public.profiles(id) on delete set null,
  reason text not null check (length(trim(reason)) >= 3),
  created_at timestamptz not null default now()
);

create index if not exists sale_commercial_history_sale_created_idx
  on public.sale_commercial_history (sale_id, created_at desc);
create index if not exists sales_mobile_added_by_idx
  on public.sales (mobile_added_by) where mobile_added_by is not null;
create index if not exists sales_commercial_updated_by_idx
  on public.sales (commercial_terms_updated_by) where commercial_terms_updated_by is not null;

alter table public.sale_commercial_history enable row level security;
drop policy if exists sale_commercial_history_admin_select on public.sale_commercial_history;
create policy sale_commercial_history_admin_select
on public.sale_commercial_history for select to authenticated
using ((select private.current_user_role()) = 'admin'::public.user_role);

revoke all on table public.sale_commercial_history from anon;
grant select on table public.sale_commercial_history to authenticated;

create or replace function public.set_initial_mobile_origin()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare v_role public.user_role;
begin
  new.initial_is_multi := coalesce(new.is_multi,false);
  if new.initial_is_multi then
    select p.role into v_role from public.profiles p
    where p.id = auth.uid() and p.active = true;
    if new.seller_id = auth.uid() and v_role in ('vendedora'::public.user_role,'parceiro'::public.user_role) then
      new.mobile_origin := 'seller';
      new.mobile_added_by := null;
      new.mobile_added_at := null;
    else
      new.mobile_origin := 'bko';
      new.mobile_added_by := auth.uid();
      new.mobile_added_at := now();
    end if;
  else
    new.mobile_origin := null;
    new.mobile_added_by := null;
    new.mobile_added_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists sales_set_initial_mobile_origin on public.sales;
create trigger sales_set_initial_mobile_origin
before insert on public.sales for each row
execute function public.set_initial_mobile_origin();

create or replace function public.update_sale_commercial_terms(
  p_sale_id uuid,
  p_plan_name text,
  p_is_multi boolean,
  p_internet_value numeric,
  p_mobile_value numeric,
  p_total_value numeric,
  p_promo_value numeric,
  p_has_promotion boolean,
  p_promotion_months smallint,
  p_post_promo_value numeric,
  p_reason text
)
returns public.sales
language plpgsql security invoker set search_path = ''
as $$
declare
  v_role public.user_role;
  v_sale public.sales;
  v_operator_name text;
  v_before jsonb;
  v_after jsonb;
  v_new_origin text;
  v_added_by uuid;
  v_added_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.' using errcode='42501'; end if;
  select p.role into v_role from public.profiles p where p.id=auth.uid() and p.active=true;
  if v_role <> 'admin'::public.user_role then
    raise exception 'Apenas administradores podem alterar o plano da venda.' using errcode='42501';
  end if;
  if length(trim(coalesce(p_plan_name,''))) < 2 then
    raise exception 'Informe o nome do plano.' using errcode='23514';
  end if;
  if length(trim(coalesce(p_reason,''))) < 3 then
    raise exception 'Informe o motivo da alteração.' using errcode='23514';
  end if;

  select s.* into v_sale from public.sales s where s.id=p_sale_id for update;
  if v_sale.id is null then raise exception 'Venda não encontrada.' using errcode='42501'; end if;
  select o.name into v_operator_name from public.operators o where o.id=v_sale.operator_id;

  if lower(trim(coalesce(v_operator_name,''))) <> 'claro' and coalesce(p_is_multi,false) then
    raise exception 'Somente vendas Claro podem receber Móvel.' using errcode='23514';
  end if;
  if coalesce(v_sale.is_multi,false) and not coalesce(p_is_multi,false) then
    raise exception 'Para retirar um Móvel já lançado, utilize a Gestão de chips.' using errcode='23514';
  end if;
  if v_sale.mobile_removed_at is not null and coalesce(p_is_multi,false) then
    raise exception 'O Móvel desta venda foi removido. O histórico não pode ser reativado por esta edição.' using errcode='23514';
  end if;

  v_before := jsonb_build_object(
    'plan_name',v_sale.plan_name,'is_multi',v_sale.is_multi,
    'internet_value',v_sale.internet_value,'mobile_value',v_sale.mobile_value,
    'value',v_sale.value,'promo_value',v_sale.promo_value,
    'has_promotion',v_sale.has_promotion,'promotion_months',v_sale.promotion_months,
    'post_promo_value',v_sale.post_promo_value,'mobile_origin',v_sale.mobile_origin
  );

  v_new_origin := v_sale.mobile_origin;
  v_added_by := v_sale.mobile_added_by;
  v_added_at := v_sale.mobile_added_at;
  if not coalesce(v_sale.is_multi,false) and coalesce(p_is_multi,false) then
    v_new_origin := 'bko';
    v_added_by := auth.uid();
    v_added_at := now();
  end if;

  update public.sales
  set plan_name=trim(p_plan_name),
      is_multi=coalesce(p_is_multi,false),
      internet_value=p_internet_value,
      mobile_value=case when coalesce(p_is_multi,false) then p_mobile_value else null end,
      value=p_total_value,
      promo_value=p_promo_value,
      has_promotion=coalesce(p_has_promotion,false),
      promotion_months=case when coalesce(p_has_promotion,false) then p_promotion_months else null end,
      post_promo_value=case when coalesce(p_has_promotion,false) then p_post_promo_value else null end,
      mobile_origin=v_new_origin,
      mobile_added_by=v_added_by,
      mobile_added_at=v_added_at,
      commercial_terms_updated_by=auth.uid(),
      commercial_terms_updated_at=now()
  where id=p_sale_id
  returning * into v_sale;

  v_after := jsonb_build_object(
    'plan_name',v_sale.plan_name,'is_multi',v_sale.is_multi,
    'internet_value',v_sale.internet_value,'mobile_value',v_sale.mobile_value,
    'value',v_sale.value,'promo_value',v_sale.promo_value,
    'has_promotion',v_sale.has_promotion,'promotion_months',v_sale.promotion_months,
    'post_promo_value',v_sale.post_promo_value,'mobile_origin',v_sale.mobile_origin
  );

  insert into public.sale_commercial_history(sale_id,previous_terms,new_terms,changed_by,reason)
  values(v_sale.id,v_before,v_after,auth.uid(),trim(p_reason));
  return v_sale;
end;
$$;

revoke all on function public.update_sale_commercial_terms(uuid,text,boolean,numeric,numeric,numeric,numeric,boolean,smallint,numeric,text)
from public, anon;
grant execute on function public.update_sale_commercial_terms(uuid,text,boolean,numeric,numeric,numeric,numeric,boolean,smallint,numeric,text)
to authenticated;

comment on column public.sales.initial_is_multi is 'Registra se a venda entrou originalmente no BKO com Móvel.';
comment on column public.sales.mobile_origin is 'seller quando o Móvel veio no lançamento; bko quando foi incluído posteriormente pelo administrativo.';
comment on column public.sales.mobile_added_by is 'Administrador que incluiu o Móvel posteriormente.';
comment on column public.sales.mobile_added_at is 'Data da inclusão administrativa do Móvel.';
comment on table public.sale_commercial_history is 'Histórico auditável das alterações comerciais de plano e valores feitas pelo administrador.';
