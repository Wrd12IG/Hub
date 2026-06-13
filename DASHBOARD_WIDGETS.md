# 📊 Dashboard Widgets - Documentazione

## Widget Implementati

### 1. 📅 Deadline Countdown Widget
**File**: `components/dashboard/deadline-countdown.tsx`

Mostra le scadenze imminenti dei task con countdown in tempo reale.

#### Features
- ✅ Countdown in tempo reale (aggiornamento ogni minuto)
- ✅ Codifica colori per urgenza:
  - 🔴 **Rosso**: In ritardo o < 3h
  - 🟠 **Arancione**: < 24h
  - 🟡 **Giallo**: < 48h
  - 🔵 **Blu**: < 72h
- ✅ Mostra fino a 5 task più urgenti
- ✅ Click su task per aprirlo
- ✅ Legenda colori
- ✅ Contatore task in ritardo

#### Utilizzo
```typescript
import { DeadlineCountdownWidget } from '@/components/dashboard/deadline-countdown';

<DeadlineCountdownWidget 
  tasks={tasks}
  onTaskClick={(taskId) => router.push(`/tasks/${taskId}`)}
/>
```

#### Versione Compatta
```typescript
import { DeadlineCountdownCompact } from '@/components/dashboard/deadline-countdown';

<DeadlineCountdownCompact tasks={tasks} />
```

---

### 2. 🎂 Upcoming Birthdays Widget
**File**: `components/birthday-celebration.tsx`

Mostra i prossimi compleanni del team.

#### Features
- ✅ Prossimi 30 giorni
- ✅ Massimo 5 compleanni
- ✅ Evidenzia "Oggi" e "Domani"
- ✅ Avatar colorati
- ✅ Ordinati per data

#### Utilizzo
```typescript
import { UpcomingBirthdaysWidget } from '@/components/birthday-celebration';

<UpcomingBirthdaysWidget users={users} />
```

---

### 3. 🌤️ Weather Widget
**File**: `components/dashboard/weather-widget.tsx`

Mostra meteo locale con dati OpenWeather o mock.

#### Features
- ✅ Temperatura attuale e percepita
- ✅ Descrizione condizioni
- ✅ Umidità, vento, pressione, visibilità
- ✅ Icone animate per condizioni meteo
- ✅ Gradient background dinamico
- ✅ Geolocation automatica
- ✅ Dati mock se no API key
- ✅ Versione compatta

#### Utilizzo

**Con API Key (dati reali):**
```typescript
import { WeatherWidget } from '@/components/dashboard/weather-widget';

<WeatherWidget 
  apiKey="YOUR_OPENWEATHER_API_KEY"
  city="Milano" // Opzionale, altrimenti usa geolocation
/>
```

**Senza API Key (dati mock):**
```typescript
<WeatherWidget city="Milano" />
```

**Versione Compatta:**
```typescript
<WeatherWidget compact />
```

#### Ottenere API Key OpenWeather
1. Vai su https://openweathermap.org/
2. Crea account gratuito
3. Vai su API Keys
4. Copia la tua chiave
5. Free tier: 1000 chiamate/giorno

---

## Dashboard Widgets Container

### DashboardWidgets
Container principale per tutti i widget.

```typescript
import { DashboardWidgets } from '@/components/dashboard/dashboard-widgets';

<DashboardWidgets
  users={users}
  tasks={tasks}
  currentUser={currentUser}
  onTaskClick={(id) => router.push(`/tasks/${id}`)}
  weatherApiKey={process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY}
  weatherCity="Milano"
/>
```

### CustomWidgetGrid
Permette di scegliere quali widget mostrare.

```typescript
import { CustomWidgetGrid } from '@/components/dashboard/dashboard-widgets';

<CustomWidgetGrid
  users={users}
  tasks={tasks}
  currentUser={currentUser}
  widgets={{
    deadlines: true,
    birthdays: true,
    weather: false // Nascondi meteo
  }}
/>
```

### DashboardWidgetsCompact
Versione compatta per sidebar.

```typescript
import { DashboardWidgetsCompact } from '@/components/dashboard/dashboard-widgets';

<DashboardWidgetsCompact
  users={users}
  tasks={tasks}
  currentUser={currentUser}
/>
```

---

## Layout Responsive

### Desktop (xl: ≥1280px)
```
┌──────────┬──────────┬──────────┐
│ Deadline │ Birthday │ Weather  │
└──────────┴──────────┴──────────┘
```

### Tablet (lg: ≥1024px)
```
┌──────────┬──────────┐
│ Deadline │ Birthday │
├──────────┴──────────┤
│      Weather        │
└─────────────────────┘
```

### Mobile (< 1024px)
```
┌─────────────────────┐
│      Deadline       │
├─────────────────────┤
│      Birthday       │
├─────────────────────┤
│      Weather        │
└─────────────────────┘
```

---

## Integrazione nella Dashboard

### Opzione 1: Nella Home/Dashboard
```typescript
// app/(app)/page.tsx o dashboard/page.tsx
import { DashboardWidgets } from '@/components/dashboard/dashboard-widgets';
import { useLayoutData } from '@/app/(app)/layout-context';

export default function DashboardPage() {
  const { users, allTasks, currentUser } = useLayoutData();
  
  return (
    <div className="space-y-6">
      <h1>Dashboard</h1>
      
      {/* Widgets */}
      <DashboardWidgets
        users={users}
        tasks={allTasks}
        currentUser={currentUser}
      />
      
      {/* Altri contenuti dashboard */}
    </div>
  );
}
```

### Opzione 2: Widget Separati
```typescript
<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
  <DeadlineCountdownWidget tasks={tasks} />
  <UpcomingBirthdaysWidget users={users} />
  <WeatherWidget />
</div>
```

---

## Personalizzazione

### Creare Widget Custom

Usa `WidgetWrapper` per mantenere stile consistente:

```typescript
import { WidgetWrapper } from '@/components/dashboard/dashboard-widgets';
import { TrendingUp } from 'lucide-react';

function MyCustomWidget() {
  return (
    <WidgetWrapper
      title="Il Mio Widget"
      icon={<TrendingUp className="w-5 h-5 text-green-600" />}
      gradient="from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20"
    >
      <div>
        {/* Contenuto widget */}
      </div>
    </WidgetWrapper>
  );
}
```

### Modificare Colori Urgenza

In `deadline-countdown.tsx`:

```typescript
const getUrgencyColor = (hoursUntil: number) => {
  if (hoursUntil < 0) return 'text-red-600';
  if (hoursUntil <= 3) return 'text-red-500';
  if (hoursUntil <= 24) return 'text-orange-500';
  // ... personalizza qui
};
```

### Modificare Numero Task Mostrati

```typescript
.slice(0, 5); // Cambia 5 con il numero desiderato
```

---

## Performance

### Ottimizzazioni Implementate

1. **Deadline Widget**
   - Aggiornamento ogni 60s (non ogni secondo)
   - Filtra solo task rilevanti
   - Massimo 5 task mostrati

2. **Weather Widget**
   - Dati cachati dal browser
   - Fallback a dati mock
   - Lazy loading icone

3. **Birthday Widget**
   - Calcolo solo al mount e cambio users
   - Filtra solo prossimi 30 giorni

### Suggerimenti

- Usa `useMemo` per calcoli pesanti
- Implementa virtualizzazione per liste lunghe
- Considera lazy loading per widget sotto la fold

---

## Testing

### Test Deadline Widget
```typescript
// Crea task con deadline diverse
const testTasks = [
  { id: '1', title: 'Urgente', dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() }, // 2h
  { id: '2', title: 'Domani', dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }, // 24h
  { id: '3', title: 'In ritardo', dueDate: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() }, // -5h
];
```

### Test Birthday Widget
```typescript
// Imposta birthDate a oggi per un utente
const testUser = {
  ...user,
  birthDate: new Date().toISOString().split('T')[0]
};
```

### Test Weather Widget
```typescript
// Testa senza API key (dati mock)
<WeatherWidget city="Milano" />

// Testa con API key invalida (gestione errori)
<WeatherWidget apiKey="invalid" />
```

---

## Troubleshooting

### Widget non appare
- ✅ Verifica che ci siano dati (tasks, users)
- ✅ Controlla filtri (es. deadline nei prossimi 72h)
- ✅ Verifica console per errori

### Meteo non funziona
- ✅ Controlla API key valida
- ✅ Verifica quota OpenWeather non esaurita
- ✅ Controlla permessi geolocation browser

### Countdown non aggiorna
- ✅ Verifica che il componente sia montato
- ✅ Controlla che `useEffect` non abbia errori
- ✅ Verifica formato date ISO 8601

---

## Future Enhancements

Possibili miglioramenti:

- 📊 **Analytics Widget** - Statistiche produttività
- 📈 **Progress Widget** - Avanzamento progetti
- 💬 **Recent Activity** - Ultime attività team
- 🎯 **Goals Widget** - Obiettivi mensili
- 📅 **Calendar Widget** - Eventi prossimi
- 🏆 **Leaderboard** - Classifica team
- 💰 **Budget Widget** - Stato budget progetti
- ⏱️ **Time Tracking** - Ore lavorate oggi

---

**Status**: ✅ Implementato e pronto all'uso
**Versione**: 1.0
**Ultimo aggiornamento**: 9 Gennaio 2026
