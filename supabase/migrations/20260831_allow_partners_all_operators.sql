-- Permite que parceiros cadastrem indicações em qualquer operadora ativa.
-- A interface continua enviando seller_id do próprio usuário e origin = parceiro.

alter policy sales_insert on public.sales
with check (
  (
    seller_id = (select auth.uid())
    and (select private.current_user_role()) = 'vendedora'::public.user_role
    and origin = 'interna'::public.sale_origin
  )
  or
  (
    seller_id = (select auth.uid())
    and (select private.current_user_role()) = 'parceiro'::public.user_role
    and origin = 'parceiro'::public.sale_origin
  )
  or
  (
    (select private.current_user_role()) = any (
      array[
        'bko'::public.user_role,
        'supervisora'::public.user_role,
        'admin'::public.user_role
      ]
    )
  )
);
