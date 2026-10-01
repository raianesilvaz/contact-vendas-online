alter table public.sales
  add column partner_company text;

alter table public.sales
  add constraint sales_partner_company_check
  check (partner_company is null or partner_company in (
    'Rampin',
    'Guilherme - Vero',
    'Guilherme - Desktop',
    'MidiaSimples - Vero',
    'MidiaSimples - Alares',
    'Nelson - Desktop'
  ));

update public.sales
set partner_company = 'Rampin'
where is_rampin is true;

comment on column public.sales.partner_company is
  'Empresa parceira da venda no BKO; o identificador Rampin anterior permanece compatível.';
