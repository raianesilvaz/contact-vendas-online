create table public.employee_tasks (
 id uuid primary key default gen_random_uuid(),
 created_by uuid not null references public.profiles(id),
 assignee_id uuid not null references public.profiles(id),
 title text not null check(length(trim(title)) between 1 and 160),
 notes text not null default '' check(length(notes)<=10000),
 priority text not null default 'normal' check(priority in ('normal','urgent')),
 status text not null default 'pending' check(status in ('pending','completed','cancelled')),
 due_at timestamptz,reminder_at timestamptz,reminder_sent_at timestamptz,
 sale_id uuid references public.sales(id) on delete set null,
 completed_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(reminder_at is null or (due_at is not null and reminder_at<=due_at))
);
create index employee_tasks_assignee_due on public.employee_tasks(assignee_id,status,due_at,id);
create index employee_tasks_creator on public.employee_tasks(created_by,assignee_id,status);
create index employee_tasks_due_reminder on public.employee_tasks(reminder_at) where status='pending' and reminder_sent_at is null and reminder_at is not null;
create index employee_tasks_sale on public.employee_tasks(sale_id) where sale_id is not null;
alter table public.employee_tasks enable row level security;
revoke all on public.employee_tasks from anon;
grant select,insert,update on public.employee_tasks to authenticated;
create policy employee_tasks_read on public.employee_tasks for select to authenticated using ((select private.current_user_role()) is not null and (assignee_id=(select auth.uid()) or created_by=(select auth.uid())));
create policy employee_tasks_insert on public.employee_tasks for insert to authenticated with check(created_by=(select auth.uid()) and (select private.current_user_role()) is not null and (assignee_id=(select auth.uid()) or (select private.current_user_role())='admin'));
create policy employee_tasks_update on public.employee_tasks for update to authenticated using((select private.current_user_role()) is not null and (assignee_id=(select auth.uid()) or (created_by=(select auth.uid()) and (select private.current_user_role())='admin'))) with check((select private.current_user_role()) is not null and (assignee_id=(select auth.uid()) or (created_by=(select auth.uid()) and (select private.current_user_role())='admin')));
create function private.validate_employee_task() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is not null then
  if TG_OP='INSERT' then new.created_by=auth.uid();new.created_at=now();new.reminder_sent_at=null;
  else
   if new.created_by<>old.created_by or new.created_at<>old.created_at or new.id<>old.id then raise exception 'A autoria da tarefa não pode ser alterada';end if;
   if new.assignee_id<>old.assignee_id and not (private.current_user_role()='admin' and old.created_by=auth.uid()) then raise exception 'Somente quem atribuiu a tarefa pode mudar o responsável';end if;
   new.reminder_sent_at=old.reminder_sent_at;
  end if;
  if not exists(select 1 from public.profiles where id=new.assignee_id and active) then raise exception 'Responsável inativo ou indisponível';end if;
  if new.sale_id is not null and (TG_OP='INSERT' or new.sale_id is distinct from old.sale_id or new.assignee_id is distinct from old.assignee_id) then
   if not exists(select 1 from public.sales where id=new.sale_id) then raise exception 'Venda indisponível para seu perfil';end if;
   if exists(select 1 from public.profiles where id=new.assignee_id and role in ('vendedora','parceiro')) and not exists(select 1 from public.sales where id=new.sale_id and seller_id=new.assignee_id) then raise exception 'A venda deve pertencer ao responsável pela tarefa';end if;
  end if;
 end if;
 if TG_OP='UPDATE' and (new.reminder_at is distinct from old.reminder_at or new.assignee_id<>old.assignee_id or (new.status='pending' and old.status<>'pending')) then new.reminder_sent_at=null;end if;
 new.completed_at=case when new.status='completed' then coalesce(new.completed_at,now()) else null end;
 new.updated_at=now();return new;
end $$;
revoke all on function private.validate_employee_task() from public;
create trigger employee_task_validate before insert or update on public.employee_tasks for each row execute function private.validate_employee_task();
alter table public.notifications add column task_id uuid references public.employee_tasks(id) on delete set null;
create index notifications_task on public.notifications(task_id) where task_id is not null;
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check(type in ('new_sale','status_changed','sale_cancelled','installation_reminder','task_assigned','task_reminder'));
create function private.notify_employee_task_assigned() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.assignee_id<>new.created_by and (TG_OP='INSERT' or new.assignee_id is distinct from old.assignee_id) then
  insert into public.notifications(user_id,task_id,type,title,message) values(new.assignee_id,new.id,'task_assigned','Nova tarefa para você',new.title);
 end if;return new;
end $$;
revoke all on function private.notify_employee_task_assigned() from public,anon,authenticated;
create trigger employee_task_assigned after insert or update on public.employee_tasks for each row execute function private.notify_employee_task_assigned();
create function private.dispatch_employee_task_reminders() returns integer language plpgsql security definer set search_path='' as $$
declare t record;n integer:=0;
begin
 for t in select e.* from public.employee_tasks e join public.profiles p on p.id=e.assignee_id and p.active where e.status='pending' and e.reminder_at<=now() and e.reminder_sent_at is null order by e.reminder_at limit 500 for update of e skip locked loop
  insert into public.notifications(user_id,task_id,type,title,message) values(t.assignee_id,t.id,'task_reminder','Lembrete de tarefa',t.title||case when t.due_at is not null then ' · Prazo: '||to_char(t.due_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') else '' end);
  update public.employee_tasks set reminder_sent_at=now() where id=t.id;n=n+1;
 end loop;return n;
end $$;
revoke all on function private.dispatch_employee_task_reminders() from public,anon,authenticated;
select cron.schedule('employee-task-reminders','* * * * *','select private.dispatch_employee_task_reminders()');
