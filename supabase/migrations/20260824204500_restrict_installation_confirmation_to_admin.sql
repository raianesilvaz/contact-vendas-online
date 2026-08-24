revoke execute on function public.confirm_own_installation(uuid, date) from public;
revoke execute on function public.confirm_own_installation(uuid, date) from anon;
revoke execute on function public.confirm_own_installation(uuid, date) from authenticated;
grant execute on function public.confirm_own_installation(uuid, date) to service_role;
