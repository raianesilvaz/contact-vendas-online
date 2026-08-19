# Contact Vendas Online

Sistema web para cadastro, acompanhamento e classificação de vendas de internet da CONTACT.

<p align="center">
  <a href="https://contact-vendas-online.raianesilvaazevedo.workers.dev/"><strong>Acessar o sistema online</strong></a>
</p>

## Visão geral

O Contact Vendas Online reúne o lançamento das vendas, o acompanhamento da vendedora e a operação administrativa em um único ambiente integrado ao Supabase.

<p align="center">
  <img src="docs/screenshots/fila-bko.png" alt="Fila de vendas do painel administrativo" width="100%">
</p>

## Principais telas

### Login

<p align="center">
  <img src="docs/screenshots/login.jpg" alt="Tela de login do Contact Vendas Online" width="78%">
</p>

### Cadastro de nova venda

<p align="center">
  <img src="docs/screenshots/nova-venda.jpg" alt="Tela de cadastro de uma nova venda" width="100%">
</p>

## Perfis de acesso

- **Administrador:** possui acesso a todas as telas, gerencia usuários, acompanha a fila e classifica as vendas.
- **Vendedor:** cadastra novas vendas e acompanha seus respectivos status e retornos.

## Funcionalidades

- Cadastro completo de vendas de internet;
- Validação para impedir vendas com CPF duplicado;
- Fila administrativa com busca, filtros e paginação;
- Atualização de status, contrato e mensagem de retorno;
- Acompanhamento individual das vendas por vendedor;
- Gerenciamento de contas de administradores e vendedores;
- Controle de acesso por perfil.

## Tecnologias

- HTML, CSS e JavaScript;
- Supabase para autenticação e banco de dados;
- Cloudflare Workers Static Assets;
- GitHub integrado à publicação automática.

## Publicação

A branch `main` está conectada ao Worker `contact-vendas-online`. Novos commits enviados para essa branch iniciam automaticamente uma publicação no Cloudflare.

O conteúdo público fica em `public/`, e o comportamento do Worker está configurado em `worker/cloudflare.js` e `wrangler.jsonc`.

> Os dados reais das vendas e dos usuários permanecem armazenados no Supabase e não fazem parte deste repositório.