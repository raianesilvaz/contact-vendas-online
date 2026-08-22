drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or private.current_user_role()::text = any (array['bko','supervisora','admin','financeiro'])
);

drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales
for select to authenticated
using (
  seller_id = (select auth.uid())
  or private.current_user_role()::text = any (array['bko','supervisora','admin','financeiro'])
);

drop policy if exists finance_accounts_financeiro_select on public.finance_accounts;
create policy finance_accounts_financeiro_select on public.finance_accounts
for select to authenticated
using (private.current_user_role()::text = 'financeiro');

drop policy if exists finance_installments_financeiro_select on public.finance_installments;
create policy finance_installments_financeiro_select on public.finance_installments
for select to authenticated
using (private.current_user_role()::text = 'financeiro');
