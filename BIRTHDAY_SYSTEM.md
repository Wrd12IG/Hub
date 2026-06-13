# 🎂 Sistema Celebrazioni Compleanno

## Panoramica

Il sistema di celebrazioni compleanno mostra automaticamente un'animazione speciale quando un membro del team compie gli anni.

## Come Funziona

### 1. Aggiungere Date di Nascita

Le date di nascita vengono gestite nella sezione **Admin → Utenti**:

1. Vai su **Admin**
2. Clicca su un utente esistente o crea un nuovo utente
3. Compila il campo **"Data di Nascita 🎂"**
4. Salva

### 2. Celebrazione Automatica

Quando un utente accede all'app nel giorno del suo compleanno:

- 🎉 **Animazione full-screen** con:
  - Palloncini animati
  - Icone festive (torta, regalo, party popper)
  - Confetti colorati
  - Messaggio personalizzato
- ⏱️ **Durata**: 10 secondi (chiudibile manualmente)
- 🎨 **Design**: Gradient colorato con animazioni fluide

### 3. Widget Prossimi Compleanni

Un widget mostra i prossimi compleanni (prossimi 30 giorni):

- 📅 Data del compleanno
- ⏰ Giorni mancanti
- 🎯 Evidenzia "Oggi" e "Domani"
- 👤 Avatar utente con colore personalizzato

## Componenti

### `BirthdayCelebration`
Componente principale per l'animazione di celebrazione.

**Props:**
- `users: User[]` - Array di tutti gli utenti

**Comportamento:**
- Controlla automaticamente se ci sono compleanni oggi
- Mostra l'animazione solo il giorno del compleanno
- Si chiude automaticamente dopo 10 secondi
- Chiudibile cliccando fuori o sul pulsante

### `UpcomingBirthdaysWidget`
Widget per dashboard che mostra i prossimi compleanni.

**Props:**
- `users: User[]` - Array di tutti gli utenti

**Caratteristiche:**
- Mostra massimo 5 compleanni
- Ordinati per data (più vicini prima)
- Solo prossimi 30 giorni
- Design responsive

## Integrazione

### Nel Layout
```typescript
import { BirthdayCelebration } from '@/components/birthday-celebration';

// Nel componente
<BirthdayCelebration users={users} />
```

### Nel Dashboard
```typescript
import { UpcomingBirthdaysWidget } from '@/components/birthday-celebration';

// Nel componente
<UpcomingBirthdaysWidget users={users} />
```

## Struttura Dati

### Campo User.birthDate
```typescript
interface User {
  // ... altri campi
  birthDate?: string; // Formato: "YYYY-MM-DD"
}
```

**Esempio:**
```typescript
{
  id: "user123",
  name: "Mario Rossi",
  birthDate: "1990-03-15" // 15 Marzo 1990
}
```

## Animazioni

### Palloncini
- 15 palloncini emoji 🎈
- Movimento dal basso verso l'alto
- Rotazione casuale
- Loop infinito con delay casuali

### Icone Festive
- **Torta** 🎂 - Oscillazione e scala
- **Party Popper** 🎉 - Scala e rotazione
- **Regalo** 🎁 - Movimento verticale e rotazione

### Confetti
- 50 particelle colorate
- Esplosione dal centro
- Colori: rosso, turchese, giallo, verde, rosa
- Animazione ripetuta

## Personalizzazione

### Modificare Durata Animazione
In `birthday-celebration.tsx`:
```typescript
const timer = setTimeout(() => {
  setShowCelebration(false);
}, 10000); // Cambia 10000 (10 secondi)
```

### Modificare Colori Gradient
```typescript
className="bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500"
// Cambia i colori: from-[colore] via-[colore] to-[colore]
```

### Modificare Numero Palloncini
```typescript
{[...Array(15)].map((_, i) => ( // Cambia 15
```

### Modificare Giorni Widget
```typescript
.filter(item => item.daysUntil <= 30) // Cambia 30
```

## Testing

### Test Manuale
1. Crea un utente di test
2. Imposta `birthDate` alla data odierna
3. Ricarica l'app
4. Dovresti vedere l'animazione

### Test con Date Diverse
```typescript
// In birthday-celebration.tsx, modifica temporaneamente:
const today = new Date('2024-03-15'); // Data di test
```

## Troubleshooting

### L'animazione non appare
- ✅ Verifica che `birthDate` sia impostato
- ✅ Controlla il formato data (YYYY-MM-DD)
- ✅ Assicurati che `users` sia passato correttamente
- ✅ Controlla la console per errori

### Widget non mostra compleanni
- ✅ Verifica che ci siano compleanni nei prossimi 30 giorni
- ✅ Controlla che `birthDate` sia valido
- ✅ Verifica che il componente riceva `users`

### Animazioni non fluide
- ✅ Verifica che `framer-motion` sia installato
- ✅ Controlla le performance del browser
- ✅ Riduci il numero di particelle se necessario

## Future Enhancements

Possibili miglioramenti futuri:

- 📧 **Email automatica** al team il giorno del compleanno
- 🎵 **Suono festivo** all'apertura dell'animazione
- 🎁 **Messaggi personalizzati** dai colleghi
- 📊 **Statistiche** compleanni celebrati
- 🌍 **Multi-lingua** per messaggi
- 🎨 **Temi personalizzabili** per celebrazioni
- 📅 **Reminder** 1 giorno prima
- 🎂 **Conteggio anni** dall'inizio lavoro

## Credits

- **Animazioni**: Framer Motion
- **Icone**: Lucide React
- **Date**: date-fns

---

**Buon compleanno a tutto il team! 🎉🎂🎈**
