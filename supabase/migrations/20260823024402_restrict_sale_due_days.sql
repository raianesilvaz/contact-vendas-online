alter table public.sales drop constraint sales_due_day_check;

alter table public.sales
  add constraint sales_due_day_check
  check (due_day = any (array[5, 10, 15, 20, 25]::smallint[]));
