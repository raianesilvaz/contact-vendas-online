-- Keep existing records valid while the contact form offers the new options.
alter table public.contact_treatments
  drop constraint contact_treatments_status_check,
  add constraint contact_treatments_status_check check (status in (
    'a_tratar', 'em_atendimento', 'aguardando_retorno', 'encerrado_sem_venda', 'nao_contatar',
    'venda', 'inviabilidade', 'sem_interacao', 'restricao_cpf', 'clicou_sem_querer',
    'debitos_com_operadora', 'chance_venda_retorno', 'cliente', 'em_contato',
    'contratou_outra_operadora', 'inv_total'
  ));
