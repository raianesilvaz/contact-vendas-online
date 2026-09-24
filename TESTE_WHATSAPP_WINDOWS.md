# Teste local do WhatsApp no Windows

1. Baixe e extraia a branch `feat/whatsapp-qr-teste`.
2. Abra a pasta extraída.
3. Clique duas vezes em `iniciar-teste-whatsapp.bat`.
4. Na primeira execução, aguarde a instalação dos componentes.
5. Faça login no CONTACT local.
6. Entre em **Financeiro → Envio de Cobranças**.
7. Clique em **Conectar WhatsApp**.
8. Use `http://localhost:3100` como URL do conector.
9. Clique em **Gerar QR Code** e leia o código pelo WhatsApp do celular.

Durante o teste, uma janela do Chrome controlada pelo conector poderá aparecer. Não a feche: ela faz parte da conexão do WhatsApp. Se a primeira inicialização for interrompida pelo próprio WhatsApp Web, o conector tentará novamente de forma automática.

Mantenha as duas janelas pretas abertas durante todo o teste. Para encerrar, feche as duas janelas.

O conector usa Node 20 isoladamente por compatibilidade com o navegador interno do `whatsapp-web.js`. O Node instalado no Windows não é substituído.
