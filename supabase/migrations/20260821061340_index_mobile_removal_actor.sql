create index if not exists sales_mobile_removed_by_idx
  on public.sales (mobile_removed_by)
  where mobile_removed_by is not null;
