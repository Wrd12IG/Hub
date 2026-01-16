@echo off
chcp 65001 >nul
title W[r]Digital HUB - Installazione PWA

echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║      INSTALLAZIONE PWA - W[r]Digital Marketing HUB            ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.
echo Questo script configurerà Chrome per permettere l'installazione
echo della PWA su rete locale (HTTP).
echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║  ISTRUZIONI:                                                   ║
echo ║                                                                ║
echo ║  1. Si aprirà Chrome con le impostazioni necessarie           ║
echo ║  2. Trova: "Insecure origins treated as secure"               ║
echo ║  3. Aggiungi: http://localhost:9002                           ║
echo ║  4. Imposta su "Enabled"                                       ║
echo ║  5. Clicca "Relaunch" per riavviare Chrome                    ║
echo ║                                                                ║
echo ║  Dopo il riavvio, vai su http://localhost:9002                ║
echo ║  e clicca l'icona di installazione nella barra degli indirizzi║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.
pause

REM Apre Chrome alle impostazioni PWA
start "" chrome "chrome://flags/#unsafely-treat-insecure-origin-as-secure"

echo.
echo Chrome è stato aperto. Segui le istruzioni visualizzate sopra.
echo.
pause
