@echo off
setlocal
title CONTACT - Preparando teste do WhatsApp

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado. Instale a versao LTS e tente novamente.
  pause
  exit /b 1
)

if not exist "services\whatsapp-connector\.env" (
  copy /y "services\whatsapp-connector\.env.example" "services\whatsapp-connector\.env" >nul
)

echo Instalando os componentes do CONTACT...
call npm install
if errorlevel 1 goto :erro

echo Instalando o conector do WhatsApp...
pushd "services\whatsapp-connector"
call npm install
if errorlevel 1 (
  popd
  goto :erro
)
popd

echo Abrindo o CONTACT e o conector...
start "CONTACT - Tela de teste" cmd /k "cd /d ""%~dp0"" && npx wrangler dev --port 8787"
start "CONTACT - WhatsApp" cmd /k "cd /d ""%~dp0services\whatsapp-connector"" && npm start"

echo.
echo Aguarde alguns segundos. A tela de cobrancas sera aberta no navegador.
timeout /t 10 /nobreak >nul
start "" "http://localhost:8787/cobrancas.html"
exit /b 0

:erro
echo.
echo Nao foi possivel preparar o teste. Tire uma foto desta janela e envie no chat.
pause
exit /b 1
