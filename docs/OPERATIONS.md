# CONTACT — desenvolvimento e produção

## Acessos verificados em 05/11/2026

- GitHub: conector com permissões admin, push e pull no repositório.
- Supabase: projeto contact-vendas (loemekgsmzijuccekfei), ACTIVE_HEALTHY; consulta SQL somente leitura confirmada.
- Cloudflare: navegador chegou ao login; autenticação Google bloqueada pela revisão automática. Histórico e configurações de Builds ainda não auditados.
- CONTACT: navegador sem sessão autenticada. HTML público de /cobrancas idêntico ao commit 094a710; contém FPD depois de Histórico. Isso não comprova todos os arquivos nem o deployment ID.

## Fluxo

1. Criar branch a partir de main; revisar o escopo e preservar os dados existentes.
2. Executar npm ci, npm run build, npm run validate e npx --no-install wrangler deploy --dry-run --outdir dist.
3. Abrir PR e conferir a validação automática. Não executar migrações como parte do build.
4. Fazer merge somente após validação. A integração existente da Cloudflare deve publicar main; conferir o resultado no painel.
5. Conferir /deployment-version.json com cache desabilitado e comparar commit com o SHA publicado; testar login, cobranças e a funcionalidade alterada com conta autorizada.

O build gera apenas deployment-version.json (SHA e horário, sem segredos). O frontend e o Worker permanecem intactos.

## Cloudflare — verificar após autenticação

Conferir repositório/branch main, diretório raiz, comando de build npm run build e deploy npx wrangler deploy. Confirmar valores reais antes de alterar. Investigar logs e causas individuais de Queued/Skipped; esses estados não permitem concluir a causa sem o painel.

Publicação manual: npm run deploy, somente com autenticação Cloudflare já autorizada. Não gravar tokens no repositório ou no frontend. Evitar dois mecanismos publicando simultaneamente.

Antes de publicar, registrar deployment ID e versão anterior. Para recuperação, selecionar explicitamente a versão anterior no painel ou usar wrangler rollback com o ID verificado. Rollback de código não reverte dados do Supabase; nenhuma rotina de rollback deve excluir dados.

## FPD

A versão 094a710 fornece uma aba e texto explicativo; não implementa importação. Existem fpd_imports e fpd_records no Supabase, com políticas para admin. Nenhum registro foi alterado nesta auditoria.

Antes da implementação, inspecionar funções, gatilhos, constraints e uso dessas tabelas. Implementar substituição atômica da tabela de trabalho, sem histórico de importações. Cliente e Vendedor devem vir de consultas por contrato, somente leitura. Status e Observação são escritos apenas no armazenamento FPD. Não reutilizar rotinas de alteração de sales, clientes, contratos ou cobranças.

Testar falha de importação sem perder a tabela anterior, contratos não encontrados/ambíguos, persistência após recarregar, edição concorrente e isolamento dos registros originais. Usar ambiente de teste para substituições, nunca apagar dados de produção para testar.

## Limites

As conexões podem expirar ou ser revogadas. Não há garantia de acesso permanente nem monitoramento contínuo configurado. Alterações sensíveis de permissão, emissão de credenciais persistentes e operações destrutivas exigem aprovação específica.
