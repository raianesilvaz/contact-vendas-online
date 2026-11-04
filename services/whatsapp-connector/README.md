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

## Recuperação de mensagens de cobrança

- O conector gera a mensagem Baileys, grava o conteúdo exato criptografado e só então transmite. Falha de armazenamento interrompe o envio antes da transmissão.
- `getMessage` atende às solicitações de recuperação do WhatsApp com o mesmo identificador. Os contadores de recuperação são limitados e preservados nas reconexões.
- O arquivo usa a RPC privada existente, separado das chaves Signal, com até 256 mensagens, 512 KiB e 7 dias. A identidade do pareamento é validada; outra sessão ou destinatário não pode recuperar esse conteúdo. Os aliases LID vêm apenas da resposta autenticada do WhatsApp.
- Reconexões reutilizam o estado de autenticação em memória. Uma gravação temporariamente malsucedida deixa de bloquear as seguintes. Uma sessão substituída aguarda 45 segundos para a instância anterior encerrar, faz uma única tentativa e para se a disputa continuar, em vez de reconectar indefinidamente.
- Mensagens e chaves não são impressas nos logs. As operações de envio são serializadas e a lista de dispositivos é consultada novamente na transmissão.
- `GET /health` inclui `version`, `build` (quando o Render informa a revisão), `messageRecoveryReady` e `lastDisconnectCode`, sem credenciais ou mensagens. A versão desta correção é `20261104-message-recovery-2`.
- Uma resposta de envio significa encaminhamento ao WhatsApp, não confirmação de entrega ou leitura. Mensagens anteriores à implantação não possuem necessariamente o conteúdo original no arquivo e podem continuar indisponíveis; não reenviar campanhas inteiras para testar.

Validação: `npm run check` e `npm test`, incluindo geração real do protocolo Baileys com socket simulado, recuperação após reinício, identidade/LID, falhas de armazenamento, limites e serialização. Nenhuma mensagem real é enviada pelos testes.

