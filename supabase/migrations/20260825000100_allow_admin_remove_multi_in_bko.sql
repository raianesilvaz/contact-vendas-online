
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
language plpgsql
set search_path to ''
as $function$
declare
  v_role public.user_role;
  v_sale public.sales;
  v_operator_name text;
  v_before jsonb;
  v_after jsonb;
  v_new_origin text;
  v_added_by uuid;
  v_added_at timestamptz;
  v_removing_mobile boolean;
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

  v_removing_mobile := coalesce(v_sale.is_multi,false)
    and not coalesce(p_is_multi,false)
    and v_sale.mobile_removed_at is null;

  if v_removing_mobile and v_sale.mobile_activation_date is not null then
    raise exception 'O chip já foi ativado e não pode ser retirado por esta edição.' using errcode='23514';
  end if;
  if v_sale.mobile_removed_at is not null and coalesce(p_is_multi,false) then
    raise exception 'O Móvel desta venda foi removido. O histórico não pode ser reativado por esta edição.' using errcode='23514';
  end if;

  v_before := jsonb_build_object(
    'plan_name',v_sale.plan_name,'is_multi',v_sale.is_multi,
    'internet_value',v_sale.internet_value,'mobile_value',v_sale.mobile_value,
    'value',v_sale.value,'promo_value',v_sale.promo_value,
    'has_promotion',v_sale.has_promotion,'promotion_months',v_sale.promotion_months,
    'post_promo_value',v_sale.post_promo_value,'mobile_origin',v_sale.mobile_origin,
    'mobile_removed_at',v_sale.mobile_removed_at
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
      mobile_removed_at=case when v_removing_mobile then now() else v_sale.mobile_removed_at end,
      mobile_removed_by=case when v_removing_mobile then auth.uid() else v_sale.mobile_removed_by end,
      mobile_removal_reason=case when v_removing_mobile then trim(p_reason) else v_sale.mobile_removal_reason end,
      commercial_terms_updated_by=auth.uid(),
      commercial_terms_updated_at=now()
  where id=p_sale_id
  returning * into v_sale;

  v_after := jsonb_build_object(
    'plan_name',v_sale.plan_name,'is_multi',v_sale.is_multi,
    'internet_value',v_sale.internet_value,'mobile_value',v_sale.mobile_value,
    'value',v_sale.value,'promo_value',v_sale.promo_value,
    'has_promotion',v_sale.has_promotion,'promotion_months',v_sale.promotion_months,
    'post_promo_value',v_sale.post_promo_value,'mobile_origin',v_sale.mobile_origin,
    'mobile_removed_at',v_sale.mobile_removed_at
  );

  insert into public.sale_commercial_history(sale_id,previous_terms,new_terms,changed_by,reason)
  values(v_sale.id,v_before,v_after,auth.uid(),trim(p_reason));
  return v_sale;
end;
$function$;

create or replace function public.remove_mobile_from_plan(p_sale_id uuid, p_reason text)
returns public.sales
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role public.user_role;
  v_sale public.sales;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.' using errcode = '42501'; end if;

  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid() and p.active = true;

  if v_role <> 'admin'::public.user_role then
    raise exception 'Somente o administrador pode remover o Móvel do plano.' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Informe o motivo da remoção do Móvel.' using errcode = '23514';
  end if;

  select s.* into v_sale
  from public.sales s
  where s.id = p_sale_id
  for update;

  if v_sale.id is null then raise exception 'Venda não encontrada.' using errcode = '42501'; end if;
  if not v_sale.is_multi then raise exception 'Esta venda não possui Móvel ativo no plano.' using errcode = '23514'; end if;
  if v_sale.mobile_activation_date is not null then raise exception 'O chip já foi ativado.' using errcode = '23514'; end if;
  if v_sale.mobile_removed_at is not null then raise exception 'O Móvel já foi removido do plano.' using errcode = '23514'; end if;

  update public.sales
  set is_multi = false,
      mobile_value = null,
      value = coalesce(internet_value, value),
      mobile_removed_at = now(),
      mobile_removed_by = auth.uid(),
      mobile_removal_reason = trim(p_reason),
      commercial_terms_updated_by = auth.uid(),
      commercial_terms_updated_at = now()
  where id = p_sale_id
  returning * into v_sale;

  return v_sale;
end;
$function$;
