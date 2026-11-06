# Acompanhamento das campanhas de Cobranças

A página Cobranças mostra um painel persistente, independentemente da aba interna
selecionada. A execução mais recente aparece primeiro e até 11 anteriores ficam
em Outras execuções. Dados salvos são consultados a cada cinco segundos enquanto
a página está visível; falhas preservam o último resultado com aviso de desatualização.

Cada cartão mostra nome, status, enviados, erros, aguardando, mensagens em
processamento nesta aba, progresso e último envio. Ver detalhes consulta os nomes,
status e mensagens de erro dos destinatários. Para a execução desta aba, Acompanhar
reabre os controles já existentes. Minimizar não pausa; o cartão permanece visível.

O remetente continua sendo o navegador. Não há worker de fila em segundo plano
nesta mudança. Recarregar/fechar a aba perde o processo local; o monitor restaura
somente a consulta ao banco e nunca inicia, retoma ou reenvia automaticamente.
Status running persistido não comprova que outra aba esteja enviando. Paused/running
com todos os destinatários terminais é apresentado como fila processada com
encerramento não registrado, sem alterar registros históricos automaticamente.

A última mensagem agora finaliza a execução imediatamente, sem esperar o intervalo
para uma nova chamada. Há proteção contra processamentos simultâneos nesta aba,
indicação Enviando antes da requisição e conferência de pausa/cancelamento antes do
HTTP. Pausar durante uma requisição não impede registrar sua conclusão. Mensagens
aceitas pelo conector permanecem como enviadas no estado local mesmo se o registro
no banco falhar; um aviso pede conferência para evitar reenvio indevido.

Escopo: interface de campanhas integrada em /cobrancas. A consulta é restrita aos
mesmos perfis admin/financeiro já usados no histórico. Não muda schema, RLS,
serviço WhatsApp nem dados operacionais durante a publicação. Testes usam stubs,
sem mensagens reais. Os testes exercitam o código de processamento extraído do
arquivo de produção: finalização após pausa durante envio, exclusão de execução
simultânea e cancelamento antes do HTTP.
