-- Protege o cadastro contra CPF duplicado.
alter table public.sales
  add constraint sales_cpf_key unique (cpf);

-- A restrição única já cria o índice necessário.
drop index if exists public.sales_cpf_idx;

-- Mantém os mesmos IDs para preservar vínculos de vendas existentes.
update public.operators
set name = case name
  when 'Algar' then 'Desktop'
  when 'TIM' then 'Vero'
  when 'Vivo' then 'Alcans'
  else name
end
where name in ('Algar', 'TIM', 'Vivo');
