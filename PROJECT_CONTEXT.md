# CONTACT — Contexto do Projeto

> Documento de continuidade do desenvolvimento. Deve ser atualizado quando houver mudanças importantes de produto, arquitetura, permissões ou fluxo operacional.

## Objetivo

Sistema interno de cadastro, acompanhamento e tratamento de vendas da CONTACT. O fluxo principal é vendedor → cadastro da venda → fila BKO/Admin → atualização de status → retorno ao vendedor.

## Stack / fonte da verdade

- Frontend versionado neste repositório GitHub.
- Supabase para banco de dados, autenticação, RLS e Realtime.
- Produção publicada a partir do projeto versionado.
- Código e schema do banco são a fonte da verdade técnica; este documento registra decisões de produto e contexto operacional.

## Perfis atuais

### Administrador / BKO
- Acesso à fila BKO.
- Pode tratar vendas e alterar classificação/status.
- Pode administrar usuários conforme as ferramentas existentes no sistema.

### Vendedor
- Cadastra vendas.
- Visualiza suas próprias vendas e retornos.

## Perfil planejado — Indicador / Parceiro

Ainda não implementado.

Direção aprovada para discussão/implementação futura:
- Criar perfil separado de vendedor interno.
- Acesso enxuto: Nova indicação + Minhas indicações.
- Sem acesso à Fila BKO, Painel, Usuários ou vendas de terceiros.
- Usar a mesma tabela/fluxo de vendas, evitando duplicação de estrutura.
- Identificar origem da venda como interna ou indicação.
- Possível `indicator_id`/responsável pela indicação.
- Manter indicações na mesma Fila BKO, com identificação visual e possibilidade de filtro por origem.
- Estrutura deve permitir futuramente comissão, ranking e relatórios de indicação.

## Status de venda

Status atualmente utilizados incluem:
- Aguardando análise (`pendente`)
- Em análise (`em_analise`)
- Aceite pendente (`pendente_aceite`)
- Pendente de instalação (`pendente_instalacao`) — identidade visual roxa
- Conectado (`conectado`)
- Reprovado (`reprovada`)
- Cancelado (`cancelada`)

Observação: ao adicionar novos status, manter enum/constraint do banco, frontend, filtros, labels e notificações sincronizados.

## Cadastro de venda

Dados da venda incluem operadora, plano, valor, vencimento e demais dados do cliente/instalação.

### Valor promocional
- Campo `Valor promo` foi adicionado ao cadastro.
- É opcional.
- Fica visualmente ao lado do campo Valor, reduzindo a largura do Valor para não aumentar o formulário.
- Deve aparecer nos detalhes da venda para vendedor e BKO/Admin quando aplicável.

## Notificações — V1

Arquitetura aprovada:
- Notificações leves no banco.
- Supabase Realtime.
- Retenção/limpeza de notificações antigas em 90 dias.
- Sino no topo com contador de não lidas.
- Ao clicar no sino, abrir dropdown/balão ancorado abaixo dele, não painel lateral fixo.
- Toast de nova notificação no topo direito, abaixo do sino.
- Notificação clicável deve levar à venda relacionada.
- Possibilidade de marcar todas como lidas.

### Eventos atuais

1. **Nova venda cadastrada**
   - Recebe: Administradores/BKO.
   - O vendedor que acabou de cadastrar não precisa receber a própria ação.

2. **Status alterado**
   - Recebe: somente o vendedor responsável pela venda.
   - Admin/BKO não recebe notificação da mudança que realizou.

3. **Venda cancelada**
   - Recebe: somente o vendedor responsável.
   - Pode ter tratamento visual de alerta especial.

Eventos deliberadamente removidos da V1 como notificações separadas: venda entrou em análise, venda conectada, venda reprovada, retorno/correção para análise, usuário criado, perfil alterado e conta ativada/desativada.

## Realtime das vendas

O sistema usa atualização em tempo real para evitar F5 constante. Alterações devem preservar o trabalho em andamento do usuário e não devem provocar refresh completo da página que faça perder um tratamento de venda aberto.

Também existe atualização manual no topo como alternativa operacional quando aplicável.

## Fila BKO

- Continua sendo a fila operacional central.
- Alterar um status deve refletir para o vendedor responsável via Realtime/notificação conforme as regras acima.
- O status Pendente de instalação deve aparecer em roxo.
- Ao adicionar futuramente vendas de indicação, a preferência é manter a mesma fila e diferenciar visualmente a origem, com filtro `Todos | Internas | Indicações` se necessário.

## Operadoras

A operadora Algar foi adicionada às opções do sistema.

## Identidade / navegação

- Marca CONTACT com o `C` utilizado também como favicon.
- Favicon deve aparecer em todas as páginas/subpáginas do projeto.
- Manter a interface compacta, escura, clara operacionalmente e sem elementos que ocupem espaço sem necessidade.

## Princípios para próximas alterações

1. Evitar duplicar tabelas e fluxos quando uma coluna de classificação/origem resolver.
2. Priorizar RLS e permissões por perfil no banco, não apenas esconder elementos no frontend.
3. Não criar notificações para ações que o próprio usuário acabou de executar quando isso não traz valor.
4. Preservar o estado de trabalho durante atualizações Realtime.
5. Antes de adicionar um novo enum/status, revisar constraints antigas para evitar erro de validação.
6. Campos opcionais devem permanecer realmente opcionais no frontend e no banco.
7. Manter este arquivo atualizado após decisões estruturais importantes.

## Próxima decisão em aberto

Detalhar e implementar o perfil **Indicador / Parceiro**, incluindo permissões, identificação de origem da venda e apresentação na Fila BKO.
