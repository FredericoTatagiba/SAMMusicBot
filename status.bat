@echo off
REM Mostra o estado do bot e os logs ao vivo (Ctrl+C para sair dos logs).
cd /d "%~dp0"
call pm2 status
echo.
echo === Logs ao vivo (Ctrl+C para sair) ===
call pm2 logs musicbot
