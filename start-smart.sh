#!/bin/bash

# Script di avvio intelligente per WRDigital Hub
# Controlla se esiste una build valida, altrimenti la crea automaticamente

APP_DIR="/Users/wrdigital/.gemini/antigravity/scratch/hub-wrdigital/hub-app"
BUILD_ID_FILE="$APP_DIR/.next/BUILD_ID"
LOG_FILE="/tmp/wrdigital-hub-startup.log"

# Funzione di logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== Avvio WRDigital Hub ==="

# Vai alla directory dell'app
cd "$APP_DIR" || {
    log "ERRORE: Impossibile accedere alla directory $APP_DIR"
    exit 1
}

# Controlla se esiste una build valida
# Verifica sia BUILD_ID che file critici della build
if [ -f "$BUILD_ID_FILE" ] && \
   [ -d "$APP_DIR/.next/server" ] && \
   [ -f "$APP_DIR/.next/server/middleware-manifest.json" ]; then
    log "✓ Build esistente trovata (BUILD_ID: $(cat $BUILD_ID_FILE))"
    log "✓ Avvio del server in modalità produzione..."
else
    log "⚠ Build non trovata o non valida"
    log "→ Creazione della build di produzione..."
    
    # Rimuovi eventuali build parziali
    rm -rf "$APP_DIR/.next"
    
    # Crea la build
    if /usr/local/bin/npm run build >> "$LOG_FILE" 2>&1; then
        log "✓ Build completata con successo"
    else
        log "✗ ERRORE: Build fallita. Controlla il log: $LOG_FILE"
        exit 1
    fi
fi

# Avvia il server
log "→ Avvio del server sulla porta 9002..."
exec /usr/local/bin/npm run start -- -p 9002 -H 0.0.0.0
