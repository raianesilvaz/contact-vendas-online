alter table public.sales
  add column if not exists scheduled_installation_date date,
  add column if not exists scheduled_installation_start time without time zone,
  add column if not exists scheduled_installation_end time without time zone;

comment on column public.sales.scheduled_installation_date is
  'Previsão interna de instalação. Não representa a instalação efetiva e não aciona Financeiro, Faturamento ou Gestão de chips.';
comment on column public.sales.scheduled_installation_start is
  'Horário inicial previsto da janela de instalação.';
comment on column public.sales.scheduled_installation_end is
  'Horário final previsto da janela de instalação.';

alter table public.sales
  drop constraint if exists sales_scheduled_installation_time_window_check;

alter table public.sales
  add constraint sales_scheduled_installation_time_window_check
  check (
    (scheduled_installation_start is null and scheduled_installation_end is null)
    or
    (
      scheduled_installation_start is not null
      and scheduled_installation_end is not null
      and scheduled_installation_end > scheduled_installation_start
    )
  );

create index if not exists sales_pending_installation_schedule_idx
  on public.sales (
    scheduled_installation_date,
    scheduled_installation_start,
    created_at
  )
  where status = 'pendente_instalacao';