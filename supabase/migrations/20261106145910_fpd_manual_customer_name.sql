-- Manual customer names belong only to the current FPD workspace.
-- Keep the previous RPC intact for already-open older screens.
create or replace function public.save_fpd_row(
 p_id uuid, p_version integer, p_status text, p_notes text, p_customer_name text
) returns public.fpd_records
language plpgsql security invoker set search_path = ''
as $function$
declare v_record public.fpd_records;
begin
 if auth.uid() is null or private.current_user_role() is distinct from 'admin'::public.user_role then
  raise exception 'Acesso não autorizado.' using errcode='42501';
 end if;
 if char_length(coalesce(p_customer_name,'')) > 300 then
  raise exception 'O nome do cliente deve ter até 300 caracteres.' using errcode='22023';
 end if;
 update public.fpd_records
 set customer_name=nullif(btrim(p_customer_name),''),
     treatment_status=coalesce(p_status,''),notes=coalesce(p_notes,''),
     annotation_version=annotation_version+1,treated_by=auth.uid(),treated_at=now()
 where id=p_id and annotation_version=p_version returning * into v_record;
 if not found then
  raise exception 'Este registro mudou em outra sessão. Atualize a tabela antes de salvar novamente.' using errcode='40001';
 end if;
 return v_record;
end;
$function$;
revoke all on function public.save_fpd_row(uuid,integer,text,text,text) from public,anon;
grant execute on function public.save_fpd_row(uuid,integer,text,text,text) to authenticated;
