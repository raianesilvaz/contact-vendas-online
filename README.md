# Contact Vendas Online

Sistema web para cadastro, acompanhamento e classificação de vendas da CONTACT.

## Perfis

- **Vendedora:** cadastra vendas e acompanha os retornos do BKO.
- **BKO:** recebe as vendas na fila, atualiza o status, o contrato e a mensagem de retorno.

## Tecnologias

- HTML, CSS e JavaScript
- Supabase (autenticação e banco de dados)
- Cloudflare Workers Static Assets
- GitHub integrado ao deploy automático

## Publicação

A branch `main` está conectada ao Worker `contact-vendas-online`. Novos commits enviados para essa branch iniciam automaticamente uma publicação no Cloudflare.

O conteúdo público fica em `public/`, e o comportamento do Worker está configurado em `worker/cloudflare.js` e `wrangler.jsonc`.
