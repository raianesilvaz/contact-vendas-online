# Acompanhamento das campanhas de Cobranças

A página Cobranças mostra o acompanhamento somente dentro da aba Campanhas.
O painel fica oculto em Fila de cobranças, Histórico e FPD. A execução mais recente aparece primeiro e até 11 anteriores ficam
em Outras execuções. Dados salvos são consultados a cada cinco segundos enquanto
a página está visível; falhas preservam o último resultado com aviso de desatualização.

Cada cartão mostra nome, status, enviados, erros, aguardando, mensagens em
processamento nesta aba, progresso e último envio. Ver detalhes consulta os nomes,
status e mensagens de erro dos destinatários. Para a execução desta aba, Acompanhar
reabre os controles já existentes. Minimizar não pausa; o cartão permanece visível.
Em uma execução pausada da régua, Abrir controles permite continuar ou cancelar
com a mesma conta que iniciou o envio, inclusive após recarregar a página.

O remetente continua sendo o navegador. Abrir os controles consulta a fila salva.
Continuar reserva a execução pausada, relê os destinatários e processa apenas quem
ainda aguarda, com a mesma verificação de faturas e envios do dia. O status de
envio é reservado antes de contatar o WhatsApp. A retomada não é automática.
Status running persistido não comprova que outra aba esteja enviando. Paused/running
com todos os destinatários terminais é apresentado como fila processada com
encerramento não registrado, sem alterar registros históricos automaticamente.

A última mensagem agora finaliza a execução imediatamente, sem esperar o intervalo
para uma nova chamada. Há proteção contra processamentos simultâneos nesta aba,
indicação Enviando antes da requisição e conferência de pausa/cancelamento antes do
HTTP. A pausa é registrada após concluir qualquer requisição em andamento. Se a
confirmação de um envio falhar, o destinatário fica reservado e a fila para
para conferência, evitando um reenvio automático.

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
