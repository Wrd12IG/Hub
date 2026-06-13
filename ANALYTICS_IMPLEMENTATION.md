# 📊 Dashboard Analytics - Implementazione

## ✅ Completato

### 1. Hook Analytics
**File**: `hooks/useAnalytics.ts`

#### `useTaskAnalytics()`
Calcola metriche complete sui task.

**Metriche Calcolate:**
- ✅ Task per status (Da Fare, In Lavorazione, etc.)
- ✅ Task per priorità (Bassa, Media, Alta, Critica)
- ✅ Completion rate (%)
- ✅ Tempo medio completamento (ore)
- ✅ Task in ritardo
- ✅ Task urgenti (< 24h)
- ✅ Efficienza (tempo stimato vs effettivo)
- ✅ Trend settimanale (ultimi 7 giorni)
- ✅ Produttività per utente
- ✅ Tempo speso per tipo attività

**Utilizzo:**
```typescript
import { useTaskAnalytics } from '@/hooks/useAnalytics';

const analytics = useTaskAnalytics(tasks, users);

console.log(analytics.completionRate); // 75.5
console.log(analytics.avgCompletionTime); // 12.3 ore
console.log(analytics.weeklyTrend); // Array trend 7 giorni
```

#### `useProductivityByHour()`
Analizza produttività per ora del giorno.

**Dati Forniti:**
- Task completati per ogni ora (0-23)
- Tempo speso per ora
- Ora di picco produttività

**Utilizzo:**
```typescript
import { useProductivityByHour } from '@/hooks/useAnalytics';

const { hourlyData, peakHour } = useProductivityByHour(tasks);

console.log(peakHour); // 14 (ore 14:00)
console.log(hourlyData[14].tasksCompleted); // 23 task
```

#### `useTeamMetrics()`
Metriche di bilanciamento team.

**Metriche Calcolate:**
- Carico di lavoro medio
- Distribuzione carico per utente
- Utenti sovraccarichi (>150% media)
- Utenti sottoutilizzati (<50% media)
- Balance score (0-100)

**Utilizzo:**
```typescript
import { useTeamMetrics } from '@/hooks/useAnalytics';

const metrics = useTeamMetrics(tasks, users);

console.log(metrics.avgWorkload); // 5.2 task/utente
console.log(metrics.overloadedUsers); // Array utenti sovraccarichi
console.log(metrics.balanceScore); // 85
```

---

### 2. Componenti Visuali
**File**: `components/analytics/metric-card.tsx`

#### `MetricCard`
Card per singola metrica con design accattivante.

**Props:**
- `title` - Titolo metrica
- `value` - Valore principale
- `subtitle` - Sottotitolo opzionale
- `icon` - Icona Lucide
- `trend` - Trend con valore e label
- `color` - Colore tema (blue, green, orange, red, purple, gray)

**Utilizzo:**
```typescript
<MetricCard
  title="Tasso Completamento"
  value="75.5%"
  subtitle="120 task totali"
  icon={CheckCircle2}
  color="green"
  trend={{ value: 5, label: 'vs mese scorso' }}
/>
```

#### `MetricsGrid`
Grid predefinita con 6 metriche principali.

**Metriche Mostrate:**
1. Tasso Completamento
2. Tempo Medio
3. Task in Ritardo
4. Task Urgenti
5. Efficienza
6. Produttività

**Utilizzo:**
```typescript
<MetricsGrid
  completionRate={75.5}
  avgCompletionTime={12.3}
  overdueTasks={3}
  urgentTasks={5}
  efficiency={92}
  totalTasks={120}
/>
```

#### `MiniMetric`
Versione compatta per sidebar/header.

```typescript
<MiniMetric
  label="Completati"
  value="75%"
  icon={CheckCircle2}
  color="green"
/>
```

---

## 🎨 Design Features

### Codifica Colori Automatica
Le card cambiano colore in base al valore:

**Completion Rate:**
- 🟢 Verde: ≥80%
- 🟠 Arancione: 60-79%
- 🔴 Rosso: <60%

**Task in Ritardo:**
- 🟢 Verde: 0
- 🟠 Arancione: 1-3
- 🔴 Rosso: >3

**Efficienza:**
- 🟢 Verde: ≥90%
- 🔵 Blu: 70-89%
- 🟠 Arancione: <70%

### Trend Indicators
- ↗️ TrendingUp: Valore positivo
- ↘️ TrendingDown: Valore negativo
- ➖ Minus: Valore stabile

### Responsive Design
- **Desktop**: Grid 3 colonne
- **Tablet**: Grid 2 colonne
- **Mobile**: 1 colonna

---

## 📊 Metriche Disponibili

### Metriche Base
| Metrica | Descrizione | Tipo |
|---------|-------------|------|
| Total Tasks | Task totali nel periodo | Number |
| Completed Tasks | Task completati | Number |
| Completion Rate | % task completati | Percentage |
| Avg Completion Time | Tempo medio completamento | Hours |
| Overdue Tasks | Task in ritardo | Number |
| Urgent Tasks | Task con deadline <24h | Number |
| Efficiency | Tempo stimato vs effettivo | Percentage |

### Distribuzioni
| Metrica | Descrizione | Tipo |
|---------|-------------|------|
| Tasks by Status | Distribuzione per status | Object |
| Tasks by Priority | Distribuzione per priorità | Object |
| Time by Activity | Tempo per tipo attività | Object |

### Trend & Performance
| Metrica | Descrizione | Tipo |
|---------|-------------|------|
| Weekly Trend | Trend ultimi 7 giorni | Array |
| Productivity by User | Performance per utente | Array |
| Hourly Data | Produttività per ora | Array |

### Team Metrics
| Metrica | Descrizione | Tipo |
|---------|-------------|------|
| Avg Workload | Carico medio per utente | Number |
| Workload Distribution | Distribuzione carico | Array |
| Overloaded Users | Utenti sovraccarichi | Array |
| Underutilized Users | Utenti sottoutilizzati | Array |
| Balance Score | Punteggio bilanciamento | Number (0-100) |

---

## 🚀 Integrazione

### Nella Dashboard
```typescript
// app/(app)/analytics/page.tsx
import { useTaskAnalytics } from '@/hooks/useAnalytics';
import { MetricsGrid } from '@/components/analytics/metric-card';
import { useLayoutData } from '@/app/(app)/layout-context';

export default function AnalyticsPage() {
  const { allTasks, users } = useLayoutData();
  const analytics = useTaskAnalytics(allTasks, users);

  return (
    <div className="space-y-6">
      <h1>Analytics Dashboard</h1>
      
      <MetricsGrid
        completionRate={analytics.completionRate}
        avgCompletionTime={analytics.avgCompletionTime}
        overdueTasks={analytics.overdueTasks}
        urgentTasks={analytics.urgentTasks}
        efficiency={analytics.efficiency}
        totalTasks={analytics.totalTasks}
      />
      
      {/* Altri grafici e visualizzazioni */}
    </div>
  );
}
```

### In Sidebar/Header
```typescript
import { useTaskAnalytics } from '@/hooks/useAnalytics';
import { MiniMetric } from '@/components/analytics/metric-card';

const analytics = useTaskAnalytics(tasks, users);

<div className="space-y-2">
  <MiniMetric
    label="Completamento"
    value={`${analytics.completionRate.toFixed(0)}%`}
    icon={CheckCircle2}
    color="green"
  />
  <MiniMetric
    label="In Ritardo"
    value={analytics.overdueTasks}
    icon={AlertTriangle}
    color="red"
  />
</div>
```

---

## 📈 Grafici (Da Implementare)

### Suggeriti per Prossime Iterazioni

#### 1. Productivity by Hour Chart
```typescript
// Grafico a barre per produttività oraria
import { BarChart } from 'recharts';

const { hourlyData } = useProductivityByHour(tasks);

<BarChart data={hourlyData}>
  <Bar dataKey="tasksCompleted" fill="#4285F4" />
</BarChart>
```

#### 2. Weekly Trend Chart
```typescript
// Grafico linee per trend settimanale
import { LineChart } from 'recharts';

<LineChart data={analytics.weeklyTrend}>
  <Line dataKey="completed" stroke="#34A853" />
  <Line dataKey="created" stroke="#FBBC05" />
</LineChart>
```

#### 3. Status Distribution Pie
```typescript
// Grafico a torta per distribuzione status
import { PieChart } from 'recharts';

const statusData = Object.entries(analytics.tasksByStatus).map(([name, value]) => ({
  name,
  value
}));

<PieChart data={statusData} />
```

#### 4. Team Workload Bar
```typescript
// Grafico barre per carico team
const { workloadDistribution } = useTeamMetrics(tasks, users);

<BarChart data={workloadDistribution}>
  <Bar dataKey="activeTasks" fill="#EA4335" />
</BarChart>
```

---

## 🎯 Use Cases

### 1. Manager Dashboard
Mostra overview completa team:
- Metriche principali
- Produttività per utente
- Bilanciamento carico
- Trend settimanale

### 2. Personal Dashboard
Mostra metriche personali:
- Task completati
- Efficienza personale
- Ore lavorate
- Prossime scadenze

### 3. Report Settimanale
Genera report automatico:
- Completion rate settimana
- Task completati vs creati
- Ore lavorate totali
- Top performer

---

## 🔧 Personalizzazione

### Modificare Range Date
```typescript
const analytics = useTaskAnalytics(tasks, users, {
  start: subDays(new Date(), 7), // Ultimi 7 giorni
  end: new Date()
});
```

### Filtrare per Utente
```typescript
const userTasks = tasks.filter(t => t.assignedUserId === userId);
const analytics = useTaskAnalytics(userTasks, users);
```

### Filtrare per Cliente
```typescript
const clientTasks = tasks.filter(t => t.clientId === clientId);
const analytics = useTaskAnalytics(clientTasks, users);
```

### Custom Metriche
```typescript
// Aggiungi tue metriche custom
const customMetric = useMemo(() => {
  return tasks.filter(t => /* tua logica */).length;
}, [tasks]);
```

---

## 📊 Performance

### Ottimizzazioni Implementate
- ✅ `useMemo` per calcoli pesanti
- ✅ Filtraggio efficiente con date-fns
- ✅ Calcoli incrementali dove possibile
- ✅ Cache risultati intermedi

### Suggerimenti
- Usa date range limitati (max 90 giorni)
- Filtra task prima di passare agli hook
- Considera virtualizzazione per liste lunghe
- Implementa lazy loading per grafici

---

## 🐛 Troubleshooting

### Metriche a 0
- ✅ Verifica che ci siano task nel range
- ✅ Controlla formato date (ISO 8601)
- ✅ Verifica filtri applicati

### Performance lente
- ✅ Riduci range date
- ✅ Filtra task non necessari
- ✅ Usa React.memo per componenti pesanti

### Trend non accurato
- ✅ Verifica campo `updatedAt` popolato
- ✅ Controlla timezone date
- ✅ Assicurati status sia corretto

---

## 🚀 Next Steps

1. **Implementare grafici** con Recharts
2. **Creare pagina Analytics** dedicata
3. **Aggiungere export** PDF/Excel
4. **Implementare filtri** avanzati
5. **Aggiungere comparazioni** periodo precedente
6. **Notifiche** per metriche critiche

---

**Status**: ✅ Base implementata  
**Prossimo**: Grafici e visualizzazioni avanzate  
**Tempo stimato**: 4-6 ore per completare dashboard completa
