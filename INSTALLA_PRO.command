#!/bin/bash

# WRDigital HUB - Script di Installazione/Aggiornamento PRO
# Questo script aggiorna l'applicazione preservando la configurazione locale.

INSTALL_DIR="$HOME/WRDigitalHUB"
TEMP_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_NAME="com.wrdigital.hub"

echo "=================================================="
echo "   WRDigital HUB - INSTALLAZIONE/AGGIORNAMENTO    "
echo "=================================================="
echo ""

# 1. Verifica Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js non trovato! Installa Node.js prima di procedere."
    exit 1
fi

echo "✅ Node.js rilevato: $(node -v)"

# 2. Stop servizi esistenti
echo "🛑 Arresto servizi in corso..."
# Ferma il processo node se attivo sulla porta 9002
lsof -ti:9002 | xargs kill -9 2>/dev/null || true
# Ferma il servizio launchctl se esiste
if launchctl list | grep -q "$SERVICE_NAME"; then
    launchctl unload "$HOME/Library/LaunchAgents/$SERVICE_NAME.plist" 2>/dev/null || true
    echo "   Servizio launchctl fermato."
else
    echo "   Nessun servizio launchctl attivo trovato."
fi

# 3. Preparazione directory
echo "📂 Preparazione directory di installazione ($INSTALL_DIR)..."
mkdir -p "$INSTALL_DIR"

# Backup .env.local se esiste
if [ -f "$INSTALL_DIR/.env.local" ]; then
    echo "   Salvataggio configurazione esistente (.env.local)..."
    cp "$INSTALL_DIR/.env.local" "$TEMP_DIR/.env.local.backup"
fi

# 4. Copia dei file
echo "📦 Copia dei nuovi file..."
# Copia tutto dalla cartella corrente alla destinazione, escludendo node_modules, .git, ecc.
# Usiamo rsync per efficienza se disponibile, altrimenti cp
if command -v rsync &> /dev/null; then
    rsync -av --exclude 'node_modules' --exclude '.next' --exclude '.git' --exclude 'INSTALLA_PRO.command' --exclude '*.zip' "$TEMP_DIR/" "$INSTALL_DIR/"
else
    cp -R "$TEMP_DIR/"* "$INSTALL_DIR/" 2>/dev/null || true
    # Rimuovi file non necessari se copiati brutalmente
    rm -rf "$INSTALL_DIR/node_modules" "$INSTALL_DIR/.next"
fi

# Ripristina .env.local
if [ -f "$TEMP_DIR/.env.local.backup" ]; then
    echo "   Ripristino configurazione (.env.local)..."
    mv "$TEMP_DIR/.env.local.backup" "$INSTALL_DIR/.env.local"
else
    echo "⚠️  Attenzione: Nessun file .env.local trovato. Assicurati di configurarlo se è una nuova installazione."
fi

# 5. Installazione e Build
echo "⚙️  Installazione dipendenze e compilazione..."
cd "$INSTALL_DIR" || exit

echo "   Esecuzione npm install..."
npm install --legacy-peer-deps

echo "   Esecuzione npm run build..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build completata con successo!"
else
    echo "❌ Errore durante la build. Controllo log..."
    exit 1
fi

# 6. Configurazione Avvio Automatico (Opzionale/Reset)
# Si assume che il file plist esista o venga creato se necessario. 
# Per sicurezza, ricreiamo il plist base se non c'è.
PLIST_PATH="$HOME/Library/LaunchAgents/$SERVICE_NAME.plist"
NODE_PATH=$(command -v node)
NPM_PATH=$(command -v npm)

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$SERVICE_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NPM_PATH</string>
        <string>start</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/$SERVICE_NAME.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/$SERVICE_NAME.err</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH</string>
        <key>PORT</key>
        <string>9002</string>
    </dict>
</dict>
</plist>
EOF

echo "🚀 Riavvio servizio..."
launchctl load -w "$PLIST_PATH" 2>/dev/null || launchctl start "$SERVICE_NAME"

echo "⏳ Attesa avvio server..."
sleep 5

# 7. Apertura Browser
echo "🌍 Apertura applicazione..."
open "http://localhost:9002"

echo ""
echo "=================================================="
echo "        INSTALLAZIONE COMPLETATA CON SUCCESSO     "
echo "=================================================="
