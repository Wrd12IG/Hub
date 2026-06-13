# 🔊 Guida File Audio per Notifiche

## File Audio Necessari

Posiziona i seguenti file audio nella directory `/public/sounds/`:

### Suoni Esistenti (già configurati)
- `notification.mp3` - Notifica generica
- `message.mp3` - Nuovo messaggio
- `timer.mp3` - Timer/Pomodoro
- `success.mp3` - Azione riuscita
- `error.mp3` - Errore
- `task_rejected.mp3` - Task rifiutato
- `task_approval.mp3` - Task approvato
- `ding.mp3` - Ding generico

### Nuovi Suoni da Aggiungere
- `task-complete.mp3` - Task completato ✅
- `task-assigned.mp3` - Task assegnato 📋
- `deadline-warning.mp3` - Deadline imminente ⏰
- `new-comment.mp3` - Nuovo commento 💬
- `achievement.mp3` - Achievement sbloccato 🏆
- `level-up.mp3` - Level up 🎮
- `konami-activated.mp3` - Konami code attivato 🎮

## Dove Trovare i Suoni

### Opzione 1: Siti Gratuiti
- **Freesound.org** - https://freesound.org/
- **Zapsplat** - https://www.zapsplat.com/
- **Mixkit** - https://mixkit.co/free-sound-effects/
- **Pixabay** - https://pixabay.com/sound-effects/

### Opzione 2: Generatori Online
- **Bfxr** - https://www.bfxr.net/ (retro game sounds)
- **ChipTone** - https://sfbgames.itch.io/chiptone
- **Jfxr** - https://jfxr.frozenfractal.com/

### Opzione 3: Creare con Audacity
1. Scarica Audacity (gratis)
2. Genera → Tono
3. Personalizza frequenza e durata
4. Esporta come MP3

## Caratteristiche Consigliate

### Task Completato
- **Tipo**: Suono positivo, celebrativo
- **Durata**: 0.5-1 secondo
- **Tono**: Ascendente, allegro
- **Esempio**: Ding-ding-ding crescente

### Task Assegnato
- **Tipo**: Neutro, informativo
- **Durata**: 0.3-0.5 secondi
- **Tono**: Medio, chiaro
- **Esempio**: Singolo beep

### Deadline Warning
- **Tipo**: Urgente ma non aggressivo
- **Durata**: 0.5-0.8 secondi
- **Tono**: Medio-alto, ripetuto
- **Esempio**: Beep-beep veloce

### New Comment
- **Tipo**: Leggero, discreto
- **Durata**: 0.2-0.4 secondi
- **Tono**: Medio, morbido
- **Esempio**: Pop o click morbido

### Achievement
- **Tipo**: Celebrativo, soddisfacente
- **Durata**: 1-1.5 secondi
- **Tono**: Ascendente con riverbero
- **Esempio**: Fanfara breve

### Level Up
- **Tipo**: Epico, motivante
- **Durata**: 1.5-2 secondi
- **Tono**: Ascendente drammatico
- **Esempio**: Jingle vittorioso

### Konami Activated
- **Tipo**: Retro gaming, nostalgico
- **Durata**: 1-2 secondi
- **Tono**: 8-bit style
- **Esempio**: Power-up retro

## Specifiche Tecniche

### Formato
- **Preferito**: MP3 (compatibilità universale)
- **Alternativo**: OGG, WAV
- **Bitrate**: 128-192 kbps (sufficiente per effetti)

### Dimensione
- **Target**: < 50KB per file
- **Massimo**: 100KB
- **Totale**: < 1MB per tutti i suoni

### Qualità Audio
- **Sample Rate**: 44.1 kHz
- **Canali**: Mono (sufficiente per notifiche)
- **Normalizzazione**: -3dB peak per evitare clipping

## Testing

### Test Manuale
1. Apri DevTools Console
2. Esegui: `playSound('task_completed')`
3. Verifica volume e qualità

### Test Automatico
```typescript
import { checkSoundExists } from '@/lib/sounds';

// Verifica se il file esiste
const exists = await checkSoundExists('task_completed');
console.log('Sound exists:', exists);
```

## Fallback

Se un file audio non esiste:
- Il sistema proverà a riprodurlo comunque
- Se fallisce, mostrerà un warning in console
- L'app continuerà a funzionare normalmente

## Personalizzazione Admin

Gli admin possono:
1. Andare su Admin → Suoni
2. Caricare suoni personalizzati
3. Regolare il volume per ogni tipo
4. Abilitare/disabilitare suoni

## Licenze

⚠️ **Importante**: Assicurati che i suoni siano:
- Royalty-free
- Con licenza commerciale (se applicabile)
- Correttamente attribuiti se richiesto

## Quick Start

### Placeholder Temporanei
Se vuoi testare subito senza file audio:
1. I suoni esistenti funzioneranno
2. I nuovi suoni mostreranno warning ma non crasheranno
3. Aggiungi i file reali quando disponibili

### Generazione Rapida con Bfxr
1. Vai su https://www.bfxr.net/
2. Clicca "Pickup/Coin" per task completato
3. Clicca "Powerup" per achievement
4. Clicca "Blip/Select" per notifiche
5. Esporta come WAV, converti in MP3

## Esempi di Configurazione

### Task Completato (Bfxr)
```
Wave: Square
Frequency: 800 → 1200 Hz
Duration: 0.3s
Volume: 0.5
```

### Achievement (Bfxr)
```
Wave: Sawtooth
Frequency: 400 → 800 Hz
Duration: 1.0s
Vibrato: Enabled
Volume: 0.6
```

### Deadline Warning (Bfxr)
```
Wave: Square
Frequency: 1000 Hz
Duration: 0.2s
Repeat: 2x
Volume: 0.7
```

---

**Nota**: I file audio sono opzionali. L'app funziona anche senza, ma i suoni migliorano significativamente l'esperienza utente! 🎵
