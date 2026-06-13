@echo off
chcp 65001 >nul
title W[r]Digital Marketing HUB - Avvio

echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║           W[r]Digital Marketing HUB - Launcher                ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

REM Configurazione - MODIFICA QUESTI VALORI
set SERVER_URL=http://localhost:9002
set APP_PATH=%~dp0..\

echo [1/3] Verifico se il server è in esecuzione...

REM Prova a raggiungere il server
curl -s -o nul -w "%%{http_code}" %SERVER_URL% > temp_status.txt 2>nul
set /p STATUS=<temp_status.txt
del temp_status.txt 2>nul

if "%STATUS%"=="200" (
    echo       ✓ Server già in esecuzione!
    goto :OPEN_APP
)

echo       ✗ Server non trovato. Avvio in corso...
echo.
echo [2/3] Avvio del server Node.js...

REM Controlla se Node.js è installato
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ╔═══════════════════════════════════════════════════════════════╗
    echo ║  ERRORE: Node.js non è installato!                           ║
    echo ║                                                               ║
    echo ║  Scarica Node.js da: https://nodejs.org/                     ║
    echo ║  Dopo l'installazione, riavvia questo script.                ║
    echo ╚═══════════════════════════════════════════════════════════════╝
    echo.
    pause
    exit /b 1
)

REM Avvia il server in background
cd /d "%APP_PATH%"
start /min cmd /c "npm run dev"

echo       Attendo avvio del server (max 30 secondi)...

REM Attendi che il server sia pronto
set COUNTER=0
:WAIT_LOOP
timeout /t 2 /nobreak >nul
curl -s -o nul -w "%%{http_code}" %SERVER_URL% > temp_status.txt 2>nul
set /p STATUS=<temp_status.txt
del temp_status.txt 2>nul

if "%STATUS%"=="200" goto :SERVER_READY
set /a COUNTER+=1
if %COUNTER% LSS 15 goto :WAIT_LOOP

echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║  ATTENZIONE: Timeout avvio server                             ║
echo ║  Il server potrebbe richiedere più tempo per avviarsi.        ║
echo ║  Provo comunque ad aprire l'applicazione...                   ║
echo ╚═══════════════════════════════════════════════════════════════╝
goto :OPEN_APP

:SERVER_READY
echo       ✓ Server avviato correttamente!

:OPEN_APP
echo.
echo [3/3] Apertura W[r]Digital HUB...
echo.

REM Prova Chrome prima, poi Edge, poi il browser predefinito
where chrome >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start "" chrome --app=%SERVER_URL%/dashboard
    goto :DONE
)

REM Prova Microsoft Edge
where msedge >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start "" msedge --app=%SERVER_URL%/dashboard
    goto :DONE
)

REM Fallback al browser predefinito
start %SERVER_URL%/dashboard

:DONE
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║  ✓ W[r]Digital HUB avviato con successo!                      ║
echo ║                                                               ║
echo ║  Puoi chiudere questa finestra.                               ║
echo ║  Il server continuerà a funzionare in background.             ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

timeout /t 5
exit
