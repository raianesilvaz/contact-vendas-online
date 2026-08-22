drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (select private.current_user_role()) = any (
    array['bko'::public.user_role,'supervisora'::public.user_role,'admin'::public.user_role,'financeiro'::public.user_role]
  )
);

drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales
for select to authenticated
using (
  seller_id = (select auth.uid())
  or (select private.current_user_role()) = any (
    array['bko'::public.user_role,'supervisora'::public.user_role,'admin'::public.user_role,'financeiro'::public.user_role]
  )
);
