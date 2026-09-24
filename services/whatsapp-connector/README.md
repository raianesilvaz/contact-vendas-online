# Conector WhatsApp — teste

Serviço Node separado do Cloudflare Worker. Ele mantém uma sessão do WhatsApp Web, entrega o QR Code à tela de cobranças e permite o envio controlado de uma única mensagem de teste.

## Executar localmente

1. Copie `.env.example` para `.env` e preencha as variáveis.
2. Execute `npm install`.
3. Carregue as variáveis do `.env` no ambiente e execute `npm start`.
4. Na tela **Envio de Cobranças**, abra **Conectar WhatsApp**, informe a URL do serviço e gere o QR Code.

Exemplo de URL local: `http://localhost:3100`.

## Limites desta versão

- Apenas conexão, desconexão e uma mensagem manual de teste.
- Não há disparo em lote ou automático.
- Somente usuários ativos dos perfis `admin` e `financeiro` passam pela API.
- A pasta definida em `SESSION_PATH` deve ser persistente e nunca deve ser versionada.
- Para acesso por uma página HTTPS, o serviço também deve ser publicado com HTTPS.

Esta integração usa `whatsapp-web.js`, uma solução não oficial sujeita a mudanças e bloqueios pelo WhatsApp.
