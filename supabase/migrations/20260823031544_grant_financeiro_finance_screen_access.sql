create policy finance_accounts_financeiro_select
on public.finance_accounts
for select
to authenticated
using (private.current_user_role() = 'financeiro'::public.user_role);

create policy finance_accounts_financeiro_update
on public.finance_accounts
for update
to authenticated
using (private.current_user_role() = 'financeiro'::public.user_role)
with check (private.current_user_role() = 'financeiro'::public.user_role);

create policy finance_installments_financeiro_all
on public.finance_installments
for all
to authenticated
using (private.current_user_role() = 'financeiro'::public.user_role)
with check (private.current_user_role() = 'financeiro'::public.user_role);
