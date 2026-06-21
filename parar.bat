@echo off
REM Para o bot (continua registrado no PM2, mas offline). Duplo-clique para usar.
cd /d "%~dp0"
call pm2 stop musicbot
echo.
echo Bot parado. Use iniciar.bat para ligar de novo.
pause
