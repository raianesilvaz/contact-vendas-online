-- Uma pessoa pode contratar planos em endereços diferentes.
-- Cada venda continua identificada por sales.id e mantém seus próprios vínculos.
alter table public.sales drop constraint if exists sales_cpf_key;

-- Mantém as buscas por CPF rápidas, sem exigir que o CPF seja único.
create index if not exists sales_cpf_idx on public.sales (cpf);
