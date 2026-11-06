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

A confirmação de encerramento usa a RPC finish_processed_campaign, restrita a
administradores e executada com as permissões/RLS do chamador. Ela confere a
quantidade completa e só conclui quando todos os destinatários estão em sent,
error ou cancelled. A operação é idempotente e não envia nem modifica mensagens.
Listas incompletas ou com waiting/sending são rejeitadas. Não há finalização
forçada de destinatários pendentes.

Se a persistência falhar, a interface deixa de mostrar envio ativo e oferece
Finalizar campanha para repetir apenas a confirmação. A confirmação tem limite
de espera de 12 segundos. O monitor também oferece esse botão para execuções
salvas que já tenham sido inteiramente processadas. O último resultado continua
consultável ao fechar o resumo. A rota antiga /campanhas usa a mesma confirmação
e conclui após o último destinatário, sem aguardar mais um intervalo.

Validação: testes com stubs exercitam os dois remetentes, pausa durante envio,
exclusão de chamadas simultâneas, cancelamento antes do HTTP, falha e repetição
de encerramento sem reenvio e timeout da confirmação. Testes transacionais da
RPC verificam idempotência e rejeição de waiting, sending e lista incompleta;
todos os registros sintéticos são revertidos. Nenhuma mensagem real foi enviada.
