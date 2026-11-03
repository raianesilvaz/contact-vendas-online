alter table public.sales drop constraint sales_partner_company_check;
alter table public.sales add constraint sales_partner_company_check check (partner_company is null or partner_company in ('Rampin','Guilherme - Vero','Guilherme - Desktop','Guilherme - Alares','MidiaSimples - Vero','MidiaSimples - Alares','Nelson - Desktop'));
