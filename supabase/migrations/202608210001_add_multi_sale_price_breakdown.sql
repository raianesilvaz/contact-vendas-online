alter table public.sales
  add column if not exists is_multi boolean not null default false,
  add column if not exists internet_value numeric,
  add column if not exists mobile_value numeric;

alter table public.sales
  drop constraint if exists sales_internet_value_positive,
  add constraint sales_internet_value_positive check (internet_value is null or internet_value > 0),
  drop constraint if exists sales_mobile_value_positive,
  add constraint sales_mobile_value_positive check (mobile_value is null or mobile_value > 0),
  drop constraint if exists sales_promo_value_valid,
  add constraint sales_promo_value_valid check (promo_value is null or (promo_value > 0 and promo_value <= value));

update public.sales as s
set internet_value = s.value, mobile_value = null, is_multi = false
from public.operators as o
where o.id = s.operator_id
  and lower(trim(o.name)) = 'claro'
  and s.internet_value is null;

create or replace function public.validate_sale_pricing()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  operator_is_claro boolean;
begin
  select lower(trim(o.name)) = 'claro'
    into operator_is_claro
  from public.operators o
  where o.id = new.operator_id;

  if operator_is_claro is null then raise exception 'Operadora inválida.'; end if;

  if operator_is_claro then
    if new.internet_value is null or new.internet_value <= 0 then
      raise exception 'Informe o Valor Internet para vendas da Claro.';
    end if;
    if coalesce(new.is_multi, false) then
      if new.mobile_value is null or new.mobile_value <= 0 then
        raise exception 'Informe o Valor Móvel para vendas MULTI.';
      end if;
    else
      new.is_multi := false;
      new.mobile_value := null;
    end if;
    new.value := new.internet_value + coalesce(new.mobile_value, 0);
  else
    new.is_multi := false;
    new.internet_value := null;
    new.mobile_value := null;
    if new.value is null or new.value <= 0 then
      raise exception 'Informe o Valor Total do plano.';
    end if;
  end if;

  if new.promo_value is not null then
    if new.promo_value <= 0 then raise exception 'O Valor Promo deve ser maior que zero.'; end if;
    if new.promo_value > new.value then raise exception 'O Valor Promo não pode ser maior que o Valor Total.'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_sale_pricing_trigger on public.sales;
create trigger validate_sale_pricing_trigger
before insert or update of operator_id, is_multi, internet_value, mobile_value, value, promo_value
on public.sales
for each row execute function public.validate_sale_pricing();

comment on column public.sales.is_multi is 'Indica venda Claro com pacote Internet + Móvel.';
comment on column public.sales.internet_value is 'Valor da internet; obrigatório para vendas Claro.';
comment on column public.sales.mobile_value is 'Valor móvel; obrigatório somente para vendas Claro MULTI.';
