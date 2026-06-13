# 🖥️ W[r]Digital HUB - Electron Desktop App

## 📋 Prerequisiti

Per effettuare il build dell'installer Windows, hai bisogno di:

- **Node.js 18+** installato
- **npm** (viene con Node.js)
- **Windows** per il build nativo (o Wine su macOS/Linux)

## 🚀 Quick Start

### 1. Installa le dipendenze

```bash
cd electron-app
npm install
```

### 2. Test in Development

```bash
npm start
```

### 3. Build Installer Windows

```bash
npm run build:win
```

L'installer verrà creato in `electron-app/dist/`

## 📦 File Generati

Dopo il build, troverai in `dist/`:

| File | Descrizione |
|------|-------------|
| `WRDigital HUB-1.0.0-Setup.exe` | Installer NSIS (installazione classica) |
| `WRDigital HUB-1.0.0.exe` | Versione portable (no installazione) |

## 🔧 Struttura

```
electron-app/
├── main.js          # Main process Electron
├── preload.js       # Preload script
├── splash.html      # Splash screen
├── package.json     # Configurazione e dipendenze
├── assets/          # Risorse runtime
│   └── icon.png
└── build/           # Risorse per il build
    └── icon.png
```

## ⚙️ Configurazione

### Cambiare Porta Server

In `main.js`, modifica:
```javascript
const SERVER_PORT = 9002;
```

### Personalizzare Installer

In `package.json`, sezione `build`:
- `appId`: ID univoco dell'app
- `productName`: Nome visualizzato
- `nsis`: Opzioni installer Windows

## 🍎 Build per Altri Sistemi

```bash
# macOS
npm run build:mac

# Linux  
npm run build:linux

# Tutti
npm run build
```

## ❓ Troubleshooting

### "npm install" fallisce
- Assicurati di avere Node.js 18+
- Prova `npm cache clean --force` e riprova

### L'app non si avvia
- Verifica che la porta 9002 non sia in uso
- Controlla i log nella console

### Build Windows fallisce su macOS
- Installa Wine: `brew install --cask wine-stable`
- Oppure usa una VM Windows

## 📄 Licenza

MIT License - W[r]Digital 2024
