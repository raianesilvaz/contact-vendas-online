# Tratamento FPD

Acesso: administrador → Financeiro → Envio de Cobranças → FPD.

1. Importar Excel (.xlsx/.xls, até 10 MB, 1 a 10.000 registros).
2. Conferir a prévia e confirmar a substituição integral da tabela anterior.
3. Editar Status/Observação e usar Salvar alterações na linha.

Colunas aceitas do arquivo FPD CONTACT: NUM_FATURA, NUM_CONTRATO,
DSC_TIPO_COBRANCA, DAT_INSTALACAO, DAT_VENCIMENTO, DAT_PAGAMENTO,
DSC_SITUACAO_COBRANCA, NR_ANO_MES_INST, DIAS_EM_ABERTO, ACOMPANHAMENTO.
CLIENTE, STATUS, VENDEDOR e OBS da planilha não são importados: nomes vêm das
vendas; tratamentos começam em branco. Contratos repetidos com faturas diferentes
são aceitos; pares contrato/fatura duplicados são rejeitados.

O arquivo é lido no navegador com SheetJS CE 0.20.3, distribuído localmente.
Os registros normalizados são enviados à função existente import_fpd_records.
A migração fpd_replace_workspace muda somente o workspace FPD: validação,
bloqueio de importações concorrentes, exclusão de registros/importação anterior,
inserção com consulta de sales/profiles e resumo, tudo na mesma transação.
Erros revertem a substituição inteira. Retries do mesmo request_id são idempotentes
enquanto aquela importação for a vigente. Nenhum arquivo Excel nem histórico é retido.

As funções permanecem SECURITY INVOKER. As políticas de exclusão são limitadas
a administradores ativos nas tabelas FPD. As políticas de CONTACT não mudam.
Contratos sem correspondência ou ambíguos ficam sinalizados, sem escolher uma
venda arbitrária. Status/Observação são atualizados por save_fpd_treatment com
annotation_version; conflitos exigem recarregar após preservar o texto pendente.

Verificações: npm run build (inclui testes do parser), npm run validate,
Wrangler dry-run, leitura real da planilha de 540 linhas, teste visual com dados
fictícios e testes transacionais no banco revertidos ao final: matching, edição,
conflito de versão, retry, rollback após falha e substituição sem histórico.
Não foi realizada uma importação permanente de dados reais nesta entrega.

Rollback de interface: reverter o PR desta funcionalidade. A função de substituição
pode permanecer no banco sem uso pela interface anterior; não restaurar a função
antiga de acúmulo/histórico nem excluir tabelas ou tratamentos durante rollback.

## Correção safeupdate

O papel authenticator usado pelo PostgREST carrega safeupdate, que exige WHERE
em DELETE/UPDATE. A conexão de gestão SQL não carrega esse módulo; por isso os
testes anteriores de substituição não reproduziram a proteção da API. A migração
fpd_safeupdate_import captura os IDs FPD dentro do bloqueio de importação e usa
WHERE id = ANY(ids) nas duas exclusões. Nenhuma configuração ou permissão é
modificada. O teste de regressão verifica os predicados e o isolamento das escritas.

## Visualização em planilha

A grade compacta usa uma coluna por campo, cabeçalho fixo e Fatura/Contrato
congelados na rolagem horizontal. Cada cabeçalho abre filtro com busca de valores,
seleção múltipla (inclui células vazias) e ordenação crescente/decrescente. Filtros
são combinados sobre todos os registros carregados antes da paginação. A pesquisa
de valores do filtro seleciona os resultados encontrados; o botão Aplicar confirma.

Status/Observação são editáveis diretamente nas células. Salvar alterações grava
todas as linhas pendentes; Enter ou o indicador no número da linha grava uma linha.
As alterações ficam em memória ao filtrar, ordenar ou trocar de página. Falhas de
salvamento preservam as linhas ainda pendentes. A atualização da tabela requer
confirmação quando houver alterações não salvas.

Cores: campos da planilha em azul; campos de cliente/tratamento em rosa; pagamento
ou renegociação em verde; status Desabilitado em roxo; Conectado/Pago em verde.
Essas cores são derivadas dos valores exibidos e não alteram o banco. O botão
Ampliar planilha ocupa a janela, com saída por Reduzir planilha ou Escape.
Nenhuma migração ou alteração dos dados é necessária para esta visualização.
