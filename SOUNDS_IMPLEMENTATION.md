# 🔊 Sistema Suoni Personalizzati - Implementazione

## ✅ Completato

### 1. Tipi di Suoni Espansi
Ho aggiunto 7 nuovi tipi di suoni in `lib/sounds.ts`:

- ✅ `task_completed` - Task completato
- ✅ `task_assigned` - Task assegnato  
- ✅ `deadline_warning` - Deadline imminente
- ✅ `new_comment` - Nuovo commento
- ✅ `achievement` - Achievement sbloccato
- ✅ `level_up` - Level up gamification
- ✅ `konami_activated` - Konami code attivato

### 2. Hook React Creati
File: `hooks/useSound.ts`

**Hook Disponibili:**
- `useSound()` - Hook base per riprodurre qualsiasi suono
- `useTaskSounds()` - Suoni specifici per task
- `useChatSounds()` - Suoni per messaggi e commenti
- `useGamificationSounds()` - Suoni per achievement e level up
- `useGeneralSounds()` - Suoni generici (success, error, notification)

**Esempio d'uso:**
```typescript
import { useTaskSounds } from '@/hooks/useSound';

function MyComponent() {
  const { onTaskCompleted, onTaskAssigned } = useTaskSounds();
  
  const handleComplete = () => {
    // ... logica
    onTaskCompleted(); // Riproduce suono + trigger confetti
  };
  
  return <button onClick={handleComplete}>Completa</button>;
}
```

### 3. Documentazione
File: `SOUND_FILES_GUIDE.md`

Guida completa con:
- Lista file audio necessari
- Dove trovarli (siti gratuiti)
- Come crearli (generatori online)
- Specifiche tecniche
- Esempi di configurazione

## 📋 Come Usare

### Nei Componenti React
```typescript
import { useTaskSounds } from '@/hooks/useSound';

const { onTaskCompleted } = useTaskSounds();

// Quando completi un task
onTaskCompleted();
```

### Direttamente (senza hook)
```typescript
import { playSound } from '@/lib/sounds';

playSound('task_completed', 0.6); // volume 0-1
```

### Con Evento Custom (per confetti)
```typescript
const { onTaskCompleted } = useTaskSounds();

// Questo triggera anche l'evento 'taskCompleted' 
// che fa partire i confetti in Bukowski Mode
onTaskCompleted();
```

## 🎵 File Audio

### Esistenti (già configurati)
- notification.mp3
- message.mp3
- timer.mp3
- success.mp3
- error.mp3
- task_rejected.mp3
- task_approval.mp3
- ding.mp3

### Da Aggiungere in `/public/sounds/`
- task-complete.mp3
- task-assigned.mp3
- deadline-warning.mp3
- new-comment.mp3
- achievement.mp3
- level-up.mp3
- konami-activated.mp3

**Nota**: L'app funziona anche senza questi file. Se mancano, mostra solo un warning in console.

## 🎯 Integrazioni Suggerite

### 1. Task Completato
**File**: `components/task-card.tsx` o simile

```typescript
import { useTaskSounds } from '@/hooks/useSound';

const { onTaskCompleted } = useTaskSounds();

const handleComplete = async () => {
  await updateTaskStatus(task.id, 'Completato');
  onTaskCompleted(); // Suono + confetti
  toast.success('Task completato!');
};
```

### 2. Nuovo Messaggio Chat
**File**: `components/chat/...`

```typescript
import { useChatSounds } from '@/hooks/useSound';

const { onNewMessage } = useChatSounds();

useEffect(() => {
  // Quando arriva nuovo messaggio
  if (newMessage && newMessage.senderId !== currentUser.id) {
    onNewMessage();
  }
}, [messages]);
```

### 3. Deadline Warning
**File**: `components/task-list.tsx` o dashboard

```typescript
import { useTaskSounds } from '@/hooks/useSound';

const { onDeadlineWarning } = useTaskSounds();

useEffect(() => {
  // Check task con deadline < 24h
  const urgentTasks = tasks.filter(t => {
    const hoursUntil = getHoursUntilDeadline(t.dueDate);
    return hoursUntil > 0 && hoursUntil < 24;
  });
  
  if (urgentTasks.length > 0) {
    onDeadlineWarning();
  }
}, [tasks]);
```

### 4. Achievement Sbloccato
**File**: Futuro sistema gamification

```typescript
import { useGamificationSounds } from '@/hooks/useSound';

const { onAchievement, onLevelUp } = useGamificationSounds();

const unlockAchievement = (achievement) => {
  onAchievement();
  showAchievementPopup(achievement);
};
```

## ⚙️ Configurazione Admin

Il sistema supporta già:
- ✅ Volume personalizzabile per ogni suono
- ✅ Upload suoni custom
- ✅ Abilitazione/disabilitazione globale
- ✅ Cache per performance

Accessibile da: **Admin → Suoni** (se implementato)

## 🔧 Personalizzazione

### Cambiare Volume Default
In `lib/sounds.ts`:
```typescript
return {
  url: defaultSoundFiles[type],
  volume: 0.5, // Cambia qui (0-1)
};
```

### Aggiungere Nuovo Tipo
1. Aggiungi a `SoundType` in `lib/sounds.ts`
2. Aggiungi path in `defaultSoundFiles`
3. Aggiungi file in `/public/sounds/`
4. (Opzionale) Aggiungi funzione in `useSound.ts`

## 📊 Performance

- **Cache**: 1 minuto per impostazioni
- **Lazy Loading**: Suoni caricati solo quando riprodotti
- **Fallback**: Se custom fallisce, usa default
- **Async**: Non blocca UI

## 🐛 Troubleshooting

### Suono non si sente
1. ✅ Verifica volume browser
2. ✅ Controlla console per errori
3. ✅ Verifica file esista in `/public/sounds/`
4. ✅ Testa con `playSound('success')` in console

### Warning "Could not play sound"
- Normale se file non esiste
- L'app continua a funzionare
- Aggiungi il file audio per risolvere

### Suono ritardato
- Normale per primo caricamento
- File vengono cachati dal browser
- Usa `playSoundSync()` per playback immediato

## 🚀 Next Steps

1. **Aggiungere file audio** in `/public/sounds/`
2. **Integrare nei componenti** (task, chat, notifiche)
3. **Testare** con utenti reali
4. **Raccogliere feedback** su volume e tipo suoni
5. **Iterare** in base a preferenze team

## 📝 File Modificati

- ✅ `lib/sounds.ts` - Tipi espansi
- ✅ `hooks/useSound.ts` - Hook creati
- ✅ `SOUND_FILES_GUIDE.md` - Documentazione

## 🎨 Integrazione con Features Esistenti

### Bukowski Mode
- `onTaskCompleted()` triggera confetti automaticamente
- Evento custom `taskCompleted` ascoltato da `BukowskiConfetti`

### Konami Code  
- Suono `konami_activated` quando codice inserito
- Volume 0.3 per non essere troppo forte

### Birthday Celebration
- Potenziale: aggiungere suono festivo all'apertura
- Tipo suggerito: `birthday_celebration`

---

**Status**: ✅ Sistema implementato e pronto all'uso
**Prossimo**: Aggiungere file audio e integrare nei componenti
