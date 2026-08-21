alter table public.sales
  drop constraint if exists sales_promotion_months_valid,
  add constraint sales_promotion_months_valid
    check (promotion_months is null or promotion_months between 1 and 6);

create or replace function public.validate_sale_pricing()
returns trigger
language plpgsql
set search_path = ''
as $$
declare operator_is_claro boolean;
begin
  select lower(trim(o.name)) = 'claro' into operator_is_claro
  from public.operators o where o.id = new.operator_id;
  if operator_is_claro is null then raise exception 'Operadora inválida.'; end if;

  if operator_is_claro then
    if new.internet_value is null or new.internet_value <= 0 then raise exception 'Informe o Valor Internet para vendas da Claro.'; end if;
    if coalesce(new.is_multi, false) then
      if new.mobile_value is null or new.mobile_value <= 0 then raise exception 'Informe o Valor Móvel para vendas MULTI.'; end if;
    else
      new.is_multi := false;
      new.mobile_value := null;
    end if;

    new.value := new.internet_value + coalesce(new.mobile_value, 0);
    new.promo_value := null;

    if coalesce(new.has_promotion, false) then
      if new.promotion_months is null or new.promotion_months < 1 or new.promotion_months > 6 then
        raise exception 'Informe a duração do desconto entre 1 e 6 meses.';
      end if;
      if new.post_promo_value is null or new.post_promo_value <= new.value then
        raise exception 'O Valor depois do desconto deve ser maior que o Total inicial.';
      end if;
    else
      new.has_promotion := false; new.promotion_months := null; new.post_promo_value := null;
    end if;
  else
    new.is_multi := false; new.internet_value := null; new.mobile_value := null;
    new.has_promotion := false; new.promotion_months := null; new.post_promo_value := null;
    if new.value is null or new.value <= 0 then raise exception 'Informe o Valor Total do plano.'; end if;
  end if;

  if new.promo_value is not null then
    if new.promo_value <= 0 then raise exception 'O Valor Promo deve ser maior que zero.'; end if;
    if new.promo_value > new.value then raise exception 'O Valor Promo não pode ser maior que o Valor Total.'; end if;
  end if;
  return new;
end;
$$;

comment on column public.sales.has_promotion is 'Venda Claro com desconto nos primeiros meses, com ou sem MULTI.';
comment on column public.sales.promotion_months is 'Quantidade de meses do desconto inicial, entre 1 e 6, contados desde a instalação.';
