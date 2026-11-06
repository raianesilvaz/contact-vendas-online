-- Reconcile only a fully processed campaign. Never sends or edits recipients.
create or replace function public.finish_processed_campaign(p_run_id uuid)
returns jsonb language plpgsql security invoker set search_path = ''
as $function$
declare v_run public.campaign_runs; v_total integer; v_pending integer;
 v_sent integer; v_errors integer; v_cancelled integer;
begin
 if auth.uid() is null or private.current_user_role() is distinct from 'admin'::public.user_role then
  raise exception 'Somente administradores podem finalizar campanhas.' using errcode='42501';
 end if;
 select * into v_run from public.campaign_runs where id=p_run_id for update;
 if not found then raise exception 'Campanha não encontrada ou acesso não autorizado.' using errcode='42501';end if;
 select count(*),count(*) filter(where status not in ('sent','error','cancelled')),
 count(*) filter(where status='sent'),count(*) filter(where status='error'),count(*) filter(where status='cancelled')
 into v_total,v_pending,v_sent,v_errors,v_cancelled
 from public.campaign_recipients where run_id=p_run_id;
 if v_total<>v_run.quantity then raise exception 'A lista de destinatários está incompleta. Atualize o acompanhamento antes de finalizar.' using errcode='22023';end if;
 if v_pending>0 then raise exception 'Ainda há destinatários aguardando ou em envio. A campanha não foi finalizada.' using errcode='22023';end if;
 if v_run.status not in ('completed','cancelled') then
  update public.campaign_runs set status='completed',finished_at=coalesce(finished_at,now()) where id=p_run_id;
  v_run.status:='completed';
 end if;
 return jsonb_build_object('id',p_run_id,'status',v_run.status,'total',v_total,'sent',v_sent,'errors',v_errors,'cancelled',v_cancelled);
end;
$function$;
revoke all on function public.finish_processed_campaign(uuid) from public,anon;
grant execute on function public.finish_processed_campaign(uuid) to authenticated;
