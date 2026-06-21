@echo off
REM Inicia o bot com PM2 (build + start). Duplo-clique para usar.
cd /d "%~dp0"

if not exist logs mkdir logs

echo === Compilando o projeto (build) ===
call npm run build
if errorlevel 1 (
  echo.
  echo ERRO no build. Verifique se rodou "npm install" antes.
  pause
  exit /b 1
)

echo === Iniciando o bot com PM2 ===
call pm2 start ecosystem.config.js
call pm2 save

echo.
echo Bot iniciado. Use status.bat para ver o estado e parar.bat para parar.
pause
