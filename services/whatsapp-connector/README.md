# Conector WhatsApp — BETA

Serviço Node separado do Cloudflare Worker. Ele mantém a sessão vinculada, entrega o QR Code à tela de cobranças e permite o envio controlado de uma única mensagem de teste.

## Executar localmente

1. Copie `.env.example` para `.env` e preencha as variáveis.
2. Execute `npm install`.
3. Carregue as variáveis do `.env` no ambiente e execute `npm start`.
4. Na tela **Envio de Cobranças**, abra **Conectar WhatsApp**, informe a URL do serviço e gere o QR Code.

Exemplo de URL local: `http://localhost:3100`.

## Limites desta versão

- Apenas conexão, desconexão e uma mensagem manual de teste.
- Não há disparo em lote ou automático.
- Somente usuários ativos com perfil `admin` passam pela API.
- A sessão é criptografada com AES-256-GCM antes de ser salva no bucket privado do Supabase.
- `SUPABASE_SECRET_KEY` e `SESSION_ENCRYPTION_KEY` são segredos exclusivos do servidor e nunca devem ir para o navegador ou Git.
- Para acesso por uma página HTTPS, o serviço também deve ser publicado com HTTPS.

## Hospedagem BETA

- O `Dockerfile` executa o serviço com Node 20.
- Configure `ALLOWED_ORIGIN` com a origem exata do CONTACT em produção.
- Aplique a migração que cria o bucket privado `whatsapp-connector-private`.
- Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` e `SESSION_ENCRYPTION_KEY` como variáveis secretas do servidor.
- Gere `SESSION_ENCRYPTION_KEY` com `openssl rand -hex 32` e guarde uma cópia segura. Sem ela, a sessão armazenada não poderá ser restaurada.
- No Koyeb, selecione exclusivamente a instância `Free` e use `AUTO_START=true`.
- Use o endpoint `/health` para a verificação de disponibilidade.

Esta integração usa Baileys, uma solução não oficial sujeita a mudanças e bloqueios pelo WhatsApp. Não há disparos automáticos nesta versão.
