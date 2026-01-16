@echo off
echo ================================================
echo    WRDigital HUB - Aggiornamento
echo ================================================

cd /d "%~dp0"

echo.
echo [1/3] Scarico le ultime modifiche...
git pull

if errorlevel 1 (
    echo.
    echo ERRORE: Git pull fallito!
    echo    Probabilmente hai modifiche non salvate.
    echo    Fa: git stash, poi riprova.
    echo.
    pause
    exit /b 1
)

echo.
echo [2/3] Installo le dipendenze...
call npm install

echo.
echo [3/3] Ricompilo l'applicazione...
if exist .next rmdir /s /q .next
call npm run build

echo.
echo ================================================
echo ✅ Aggiornamento completato con successo!
echo ================================================
echo.
echo Ora puoi riavviare il server con: npm run dev
echo.
pause
