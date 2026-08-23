create or replace function private.finance_due_date(
  p_first_month date,
  p_due_day integer,
  p_month_offset integer
)
returns date
language sql
immutable
set search_path = ''
as $$
  with target_month as (
    select (date_trunc('month', p_first_month)::date + make_interval(months => p_month_offset))::date as month_start
  )
  select (
    month_start
    + (
      least(
        greatest(p_due_day, 1),
        extract(day from (month_start + interval '1 month - 1 day'))::integer
      ) - 1
    )
  )::date
  from target_month;
$$;

revoke all on function private.finance_due_date(date, integer, integer) from public, anon, authenticated;

create or replace function public.create_finance_account_for_connected_claro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  op_name text;
  account_id uuid;
  month_start date;
  candidate_due date;
  first_month date;
begin
  select o.name into op_name
  from public.operators o
  where o.id = new.operator_id;

  if new.installation_date is null
     or lower(trim(coalesce(op_name, ''))) <> 'claro' then
    return new;
  end if;

  insert into public.finance_accounts (sale_id, installation_date)
  values (new.id, new.installation_date)
  on conflict (sale_id)
  do update set installation_date = excluded.installation_date
  returning id into account_id;

  if not exists (
    select 1 from public.finance_installments fi
    where fi.account_id = account_id and fi.cycle = 'original'
  ) then
    month_start := date_trunc('month', new.installation_date)::date;
    candidate_due := private.finance_due_date(month_start, new.due_day, 0);
    first_month := case
      when candidate_due >= new.installation_date then month_start
      else (month_start + interval '1 month')::date
    end;

    insert into public.finance_installments (
      account_id, cycle, installment_no, due_date, amount, status
    )
    select
      account_id,
      'original',
      n,
      private.finance_due_date(first_month, new.due_day, n - 1),
      case
        when new.has_promotion and n <= coalesce(new.promotion_months, 0) then new.value
        when new.has_promotion then coalesce(new.post_promo_value, new.value)
        else new.value
      end,
      case when n = 1 then 'pendente' else 'futuro' end
    from generate_series(1, 4) as n;

    update public.finance_accounts
    set first_due_date = private.finance_due_date(first_month, new.due_day, 0),
        invoice_value = new.value,
        status = 'em_acompanhamento'
    where id = account_id;
  end if;

  return new;
end;
$function$;

revoke all on function public.create_finance_account_for_connected_claro() from public, anon, authenticated;

do $backfill$
declare
  rec record;
  first_month date;
  candidate_due date;
begin
  for rec in
    select fa.id as account_id, s.installation_date, s.due_day, s.value,
           s.has_promotion, s.promotion_months, s.post_promo_value
    from public.finance_accounts fa
    join public.sales s on s.id = fa.sale_id
    where not exists (
      select 1 from public.finance_installments fi
      where fi.account_id = fa.id and fi.cycle = 'original'
    )
  loop
    candidate_due := private.finance_due_date(
      date_trunc('month', rec.installation_date)::date, rec.due_day, 0
    );
    first_month := case
      when candidate_due >= rec.installation_date
        then date_trunc('month', rec.installation_date)::date
      else (date_trunc('month', rec.installation_date)::date + interval '1 month')::date
    end;

    insert into public.finance_installments (
      account_id, cycle, installment_no, due_date, amount, status
    )
    select
      rec.account_id,
      'original',
      n,
      private.finance_due_date(first_month, rec.due_day, n - 1),
      case
        when rec.has_promotion and n <= coalesce(rec.promotion_months, 0) then rec.value
        when rec.has_promotion then coalesce(rec.post_promo_value, rec.value)
        else rec.value
      end,
      case when n = 1 then 'pendente' else 'futuro' end
    from generate_series(1, 4) as n;

    update public.finance_accounts
    set first_due_date = private.finance_due_date(first_month, rec.due_day, 0),
        invoice_value = rec.value,
        status = 'em_acompanhamento'
    where id = rec.account_id;
  end loop;
end;
$backfill$;
