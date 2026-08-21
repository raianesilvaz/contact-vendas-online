drop policy if exists sale_commercial_history_admin_insert on public.sale_commercial_history;
create policy sale_commercial_history_admin_insert
on public.sale_commercial_history for insert to authenticated
with check (
  (select private.current_user_role()) = 'admin'::public.user_role
  and changed_by = (select auth.uid())
);
grant insert on table public.sale_commercial_history to authenticated;
grant usage, select on sequence public.sale_commercial_history_id_seq to authenticated;