# 🎯 GUIDA PRATICA - Come Usare gli Skeleton Loaders

## ✅ **Cosa Sono**

Gli skeleton loaders sono **placeholder animati** che mostri **mentre i dati si caricano**.

**Invece di:**
```
[Spinner] Caricamento...
```

**Mostri:**
```
┌─────────────────┐
│ ████ ░░░░░░░░░ │  ← Grigio che pulsa
│ ░░░░░░░░░░░░░░ │
└─────────────────┘
```

---

## 📝 **PATTERN BASE**

```typescript
{isLoading ? (
  <Skeleton className="h-10 w-full" />  // ← Placeholder
) : (
  <div>Contenuto reale</div>            // ← Dati veri
)}
```

---

## 🎨 **ESEMPI PRATICI**

### **1. Skeleton per Singolo Elemento**

```typescript
import { Skeleton } from '@/components/ui/skeleton';

{isLoading ? (
  <Skeleton className="h-8 w-32" />
) : (
  <h1>{title}</h1>
)}
```

---

### **2. Skeleton per Card**

```typescript
import { SkeletonCard } from '@/components/ui/skeleton';

{isLoading ? (
  <SkeletonCard />
) : (
  <Card>
    <CardHeader>{title}</CardHeader>
    <CardContent>{content}</CardContent>
  </Card>
)}
```

---

### **3. Skeleton per Lista**

```typescript
import { SkeletonTaskList } from '@/components/ui/skeleton';

{isLoading ? (
  <SkeletonTaskList count={5} />
) : (
  <div>
    {tasks.map(task => (
      <TaskCard key={task.id} task={task} />
    ))}
  </div>
)}
```

---

### **4. Skeleton per Tabella**

```typescript
import { SkeletonTable } from '@/components/ui/skeleton';

{isLoading ? (
  <SkeletonTable rows={10} columns={4} />
) : (
  <Table>
    <TableHeader>...</TableHeader>
    <TableBody>
      {data.map(row => <TableRow key={row.id}>...</TableRow>)}
    </TableBody>
  </Table>
)}
```

---

### **5. Skeleton per Dashboard Completa**

```typescript
import { SkeletonDashboard } from '@/components/ui/skeleton';

{isLoading ? (
  <SkeletonDashboard />
) : (
  <div>
    <h1>Dashboard</h1>
    <MetricsGrid />
    <Charts />
  </div>
)}
```

---

## 🚀 **ESEMPIO COMPLETO - Pagina Task**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { SkeletonTaskList } from '@/components/ui/skeleton';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simula caricamento dati
    setTimeout(() => {
      setTasks([/* dati task */]);
      setIsLoading(false);
    }, 1000);
  }, []);

  return (
    <div className="space-y-6">
      <h1>I Miei Task</h1>
      
      {isLoading ? (
        <SkeletonTaskList count={5} />
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 🎯 **SKELETON PERSONALIZZATI**

### **Crea il Tuo Skeleton:**

```typescript
// components/my-skeleton.tsx
import { Skeleton } from '@/components/ui/skeleton';

export function MyCustomSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      
      {/* Content */}
      <Skeleton className="h-40 w-full" />
      
      {/* Footer */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}
```

---

## 📊 **DIMENSIONI COMUNI**

```typescript
// Testo
<Skeleton className="h-4 w-32" />  // Titolo piccolo
<Skeleton className="h-6 w-48" />  // Titolo medio
<Skeleton className="h-8 w-64" />  // Titolo grande

// Paragrafo
<Skeleton className="h-4 w-full" />
<Skeleton className="h-4 w-3/4" />
<Skeleton className="h-4 w-1/2" />

// Avatar
<Skeleton className="h-10 w-10 rounded-full" />
<Skeleton className="h-12 w-12 rounded-full" />

// Pulsante
<Skeleton className="h-10 w-24 rounded-md" />

// Card
<Skeleton className="h-40 w-full rounded-lg" />
<Skeleton className="h-60 w-full rounded-lg" />

// Immagine
<Skeleton className="h-48 w-full rounded-lg" />
<Skeleton className="aspect-video w-full rounded-lg" />
```

---

## ⚡ **BEST PRACTICES**

### **1. Usa skeleton per caricamenti > 300ms**
```typescript
// ❌ NON usare per operazioni veloci
{isLoading ? <Skeleton /> : <div>Ciao</div>}

// ✅ USA per caricamenti da API
{isLoadingData ? <SkeletonTable /> : <DataTable />}
```

### **2. Rispecchia la struttura reale**
```typescript
// ❌ Skeleton generico
<Skeleton className="h-40 w-full" />

// ✅ Skeleton che rispecchia il contenuto
<div className="space-y-3">
  <Skeleton className="h-6 w-48" />  {/* Titolo */}
  <Skeleton className="h-4 w-full" /> {/* Descrizione */}
  <Skeleton className="h-10 w-24" /> {/* Pulsante */}
</div>
```

### **3. Usa componenti predefiniti quando possibile**
```typescript
// ❌ Crea skeleton custom ogni volta
<div className="space-y-2">
  <Skeleton className="h-5 w-3/4" />
  <Skeleton className="h-4 w-1/2" />
  ...
</div>

// ✅ Usa componenti predefiniti
<SkeletonTaskList count={5} />
```

---

## 🎨 **ANIMAZIONI**

Gli skeleton hanno già l'animazione **pulse** integrata:

```css
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

---

## 🔧 **INTEGRAZIONE NELL'APP**

### **Dove li Abbiamo Già Integrati:**

1. ✅ **Admin Dashboard** - Widget (linea 1574-1591)
   ```typescript
   {isLoadingLayout ? (
     <>
       <Skeleton className="h-[200px] w-full rounded-lg" />
       <Skeleton className="h-[200px] w-full rounded-lg" />
       <Skeleton className="h-[200px] w-full rounded-lg" />
     </>
   ) : (
     <>
       <DeadlineCountdownWidget ... />
       <UpcomingBirthdaysWidget ... />
       <WeatherWidget ... />
     </>
   )}
   ```

2. ✅ **User Dashboard** - Già usa `DashboardSkeleton` (linea 267)

---

## 📍 **DOVE AGGIUNGERLI PROSSIMAMENTE**

### **1. Pagina Tasks**
```typescript
// app/(app)/tasks/page.tsx
{isLoading ? (
  <SkeletonTaskList count={10} />
) : (
  <TaskList tasks={tasks} />
)}
```

### **2. Pagina Projects**
```typescript
// app/(app)/projects/page.tsx
{isLoading ? (
  <div className="grid grid-cols-3 gap-4">
    <SkeletonCard />
    <SkeletonCard />
    <SkeletonCard />
  </div>
) : (
  <ProjectGrid projects={projects} />
)}
```

### **3. Pagina Analytics**
```typescript
// app/(app)/analytics/page.tsx
{isLoading ? (
  <SkeletonDashboard />
) : (
  <AnalyticsDashboard data={analytics} />
)}
```

---

## 🎯 **COMPONENTI DISPONIBILI**

### **Nel File `components/ui/skeleton.tsx`:**

| Componente | Uso | Props |
|------------|-----|-------|
| `Skeleton` | Base personalizzabile | `className` |
| `SkeletonCard` | Card metrica | - |
| `SkeletonTaskList` | Lista task | `count?: number` |
| `SkeletonTable` | Tabella | `rows?: number, columns?: number` |
| `SkeletonDashboard` | Dashboard completa | - |

---

## 💡 **TIPS & TRICKS**

### **1. Skeleton con Transizione**
```typescript
<div className={cn(
  "transition-opacity duration-300",
  isLoading ? "opacity-100" : "opacity-0"
)}>
  <Skeleton className="h-10 w-full" />
</div>
```

### **2. Skeleton Progressivo**
```typescript
// Mostra skeleton con delay crescente
{Array.from({ length: 5 }).map((_, i) => (
  <Skeleton 
    key={i}
    className="h-10 w-full"
    style={{ animationDelay: `${i * 100}ms` }}
  />
))}
```

### **3. Skeleton Condizionale per Sezioni**
```typescript
<div>
  <h1>Dashboard</h1>
  
  {/* Sezione 1 */}
  {isLoadingMetrics ? (
    <SkeletonCard />
  ) : (
    <MetricsCard data={metrics} />
  )}
  
  {/* Sezione 2 */}
  {isLoadingCharts ? (
    <Skeleton className="h-60 w-full" />
  ) : (
    <Chart data={chartData} />
  )}
</div>
```

---

## 🚀 **QUICK START**

### **Per Iniziare Subito:**

1. **Importa il componente:**
   ```typescript
   import { SkeletonTaskList } from '@/components/ui/skeleton';
   ```

2. **Aggiungi condizione:**
   ```typescript
   {isLoading ? <SkeletonTaskList /> : <TaskList />}
   ```

3. **Fatto!** ✅

---

## 📚 **RISORSE**

- **File Skeleton**: `components/ui/skeleton.tsx`
- **Documentazione**: `ANIMATIONS_SKELETONS.md`
- **Esempi**: Admin Dashboard (linea 1574)

---

**Gli skeleton sono ora pronti all'uso in tutta l'app!** ✨

Per aggiungerli ad altre pagine, segui gli esempi sopra. 🚀
