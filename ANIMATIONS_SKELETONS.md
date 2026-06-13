# ✨ Skeleton Loaders & Micro-animazioni

## ✅ Implementato

### 1. Skeleton Loaders
**File**: `components/ui/skeleton.tsx`

Componenti skeleton per mostrare placeholder durante il caricamento.

#### Componenti Disponibili:

**`Skeleton`** - Base
```typescript
<Skeleton className="h-4 w-32" />
```

**`SkeletonCard`** - Card metrica
```typescript
<SkeletonCard />
```

**`SkeletonTaskList`** - Lista task
```typescript
<SkeletonTaskList count={5} />
```

**`SkeletonTable`** - Tabella
```typescript
<SkeletonTable rows={10} columns={5} />
```

**`SkeletonDashboard`** - Dashboard completa
```typescript
<SkeletonDashboard />
```

---

### 2. Animazioni CSS
**File**: `styles/animations.css`

Collezione completa di micro-animazioni CSS.

#### Categorie:

**Fade Animations**
- `.fade-in` - Dissolvenza in entrata
- `.fade-out` - Dissolvenza in uscita

**Slide Animations**
- `.slide-in-right` - Slide da destra
- `.slide-in-left` - Slide da sinistra
- `.slide-in-up` - Slide dal basso
- `.slide-in-down` - Slide dall'alto

**Scale Animations**
- `.scale-in` - Scala in entrata
- `.scale-out` - Scala in uscita

**Special Effects**
- `.bounce-in` - Rimbalzo in entrata
- `.shake` - Scuotimento (per errori)
- `.wiggle` - Oscillazione
- `.glow` - Effetto bagliore
- `.pulse-slow` - Pulsazione lenta
- `.pulse-fast` - Pulsazione veloce
- `.spin-slow` - Rotazione lenta
- `.spin-fast` - Rotazione veloce

**Hover Effects**
- `.hover-lift` - Solleva al hover
- `.hover-scale` - Scala al hover
- `.hover-glow` - Bagliore al hover
- `.hover-rotate` - Ruota al hover

**Loading Animations**
- `.loading-dots` - Puntini caricamento
- `.loading-spinner` - Spinner rotante
- `.shimmer` - Effetto shimmer
- `.ripple` - Effetto ripple al click

**Transitions**
- `.transition-smooth` - Transizione fluida
- `.transition-bounce` - Transizione elastica

**List Animations**
- `.stagger-item` - Animazione scaglionata per liste

---

### 3. Componenti Animati React
**File**: `components/ui/animated.tsx`

Componenti React con Framer Motion per animazioni avanzate.

#### Componenti:

**`FadeIn`** - Dissolvenza
```typescript
<FadeIn delay={0.2} duration={0.3}>
  <div>Contenuto</div>
</FadeIn>
```

**`SlideIn`** - Slide
```typescript
<SlideIn direction="up" delay={0.1}>
  <div>Contenuto</div>
</SlideIn>
```

**`ScaleIn`** - Scala
```typescript
<ScaleIn delay={0.1}>
  <div>Contenuto</div>
</ScaleIn>
```

**`BounceIn`** - Rimbalzo
```typescript
<BounceIn delay={0.2}>
  <div>Contenuto</div>
</BounceIn>
```

**`StaggerChildren`** - Lista scaglionata
```typescript
<StaggerChildren staggerDelay={0.1}>
  <StaggerItem><div>Item 1</div></StaggerItem>
  <StaggerItem><div>Item 2</div></StaggerItem>
  <StaggerItem><div>Item 3</div></StaggerItem>
</StaggerChildren>
```

**`HoverScale`** - Scala al hover
```typescript
<HoverScale scale={1.05}>
  <button>Hover me</button>
</HoverScale>
```

**`HoverLift`** - Solleva al hover
```typescript
<HoverLift>
  <div>Card</div>
</HoverLift>
```

**`Shake`** - Scuotimento (errori)
```typescript
<Shake trigger={hasError}>
  <input />
</Shake>
```

**`Pulse`** - Pulsazione
```typescript
<Pulse duration={2}>
  <div>Notification</div>
</Pulse>
```

**`Rotate`** - Rotazione
```typescript
<Rotate duration={2}>
  <Loader />
</Rotate>
```

**`Flip`** - Flip card
```typescript
<Flip isFlipped={isFlipped}>
  <div>Front/Back</div>
</Flip>
```

**`ExpandCollapse`** - Espandi/Comprimi
```typescript
<ExpandCollapse isExpanded={isOpen}>
  <div>Contenuto collassabile</div>
</ExpandCollapse>
```

**`ProgressBar`** - Barra progresso
```typescript
<ProgressBar progress={75} color="#4285F4" />
```

**`NotificationToast`** - Toast animato
```typescript
<NotificationToast isVisible={show} onClose={() => setShow(false)}>
  <div>Notifica</div>
</NotificationToast>
```

**`ModalAnimation`** - Modal animato
```typescript
<ModalAnimation isOpen={isOpen}>
  <div>Modal content</div>
</ModalAnimation>
```

**`PageTransition`** - Transizione pagina
```typescript
<PageTransition>
  <div>Page content</div>
</PageTransition>
```

---

## 🎯 Esempi d'Uso

### Skeleton durante caricamento
```typescript
import { SkeletonTaskList } from '@/components/ui/skeleton';

function TaskList() {
  const { tasks, isLoading } = useTasks();
  
  if (isLoading) {
    return <SkeletonTaskList count={5} />;
  }
  
  return <div>{/* Task reali */}</div>;
}
```

### Animazione entrata lista
```typescript
import { StaggerChildren, StaggerItem } from '@/components/ui/animated';

function List({ items }) {
  return (
    <StaggerChildren staggerDelay={0.1}>
      {items.map(item => (
        <StaggerItem key={item.id}>
          <div>{item.name}</div>
        </StaggerItem>
      ))}
    </StaggerChildren>
  );
}
```

### Hover effect su card
```typescript
import { HoverLift } from '@/components/ui/animated';

function Card() {
  return (
    <HoverLift>
      <div className="p-4 border rounded-lg">
        Card content
      </div>
    </HoverLift>
  );
}
```

### Shake su errore
```typescript
import { Shake } from '@/components/ui/animated';
import { useState } from 'react';

function LoginForm() {
  const [error, setError] = useState(false);
  
  const handleSubmit = async () => {
    try {
      // ...
    } catch (e) {
      setError(true);
      setTimeout(() => setError(false), 500);
    }
  };
  
  return (
    <Shake trigger={error}>
      <form onSubmit={handleSubmit}>
        {/* form fields */}
      </form>
    </Shake>
  );
}
```

### Modal animato
```typescript
import { ModalAnimation } from '@/components/ui/animated';

function MyModal({ isOpen, onClose }) {
  return (
    <ModalAnimation isOpen={isOpen}>
      <div className="bg-white p-6 rounded-lg">
        <h2>Modal Title</h2>
        <button onClick={onClose}>Close</button>
      </div>
    </ModalAnimation>
  );
}
```

---

## 🎨 Best Practices

### 1. Performance
- Usa skeleton solo per caricamenti > 300ms
- Evita troppe animazioni simultanee
- Preferisci CSS animations per effetti semplici
- Usa Framer Motion per animazioni complesse

### 2. Accessibilità
- Rispetta `prefers-reduced-motion`
- Non animare elementi critici
- Mantieni animazioni < 500ms
- Fornisci alternative statiche

### 3. UX
- Usa skeleton che rispecchiano il contenuto reale
- Animazioni consistenti in tutta l'app
- Non esagerare con gli effetti
- Feedback immediato su interazioni

---

## 🔧 Configurazione

### Importare CSS Animations
```typescript
// app/layout.tsx o globals.css
import '@/styles/animations.css';
```

### Rispettare prefers-reduced-motion
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Configurare Framer Motion
```typescript
// Disabilita animazioni in test
import { MotionConfig } from 'framer-motion';

<MotionConfig reducedMotion="user">
  <App />
</MotionConfig>
```

---

## 📊 Timing Guidelines

### Durate Consigliate
- **Micro-interazioni**: 100-200ms
- **Transizioni**: 200-300ms
- **Animazioni complesse**: 300-500ms
- **Skeleton loaders**: Fino a completamento

### Easing Functions
- **ease-out**: Entrate (default)
- **ease-in**: Uscite
- **ease-in-out**: Transizioni
- **spring**: Interazioni naturali

---

## 🎯 Use Cases

### Dashboard
```typescript
// Skeleton durante caricamento
<SkeletonDashboard />

// Fade in quando caricato
<FadeIn>
  <Dashboard data={data} />
</FadeIn>
```

### Lista Task
```typescript
// Skeleton
<SkeletonTaskList count={10} />

// Stagger animation
<StaggerChildren>
  {tasks.map(task => (
    <StaggerItem key={task.id}>
      <HoverLift>
        <TaskCard task={task} />
      </HoverLift>
    </StaggerItem>
  ))}
</StaggerChildren>
```

### Form con validazione
```typescript
<Shake trigger={hasError}>
  <input 
    className={hasError ? 'border-red-500' : ''}
  />
</Shake>
```

### Notifiche
```typescript
<NotificationToast 
  isVisible={showNotification}
  onClose={() => setShowNotification(false)}
>
  <div className="bg-green-500 text-white p-4 rounded-lg">
    ✓ Salvato con successo!
  </div>
</NotificationToast>
```

---

## 🚀 Prossimi Miglioramenti

1. **Skeleton personalizzabili** per ogni componente
2. **Animazioni gesture** (swipe, drag)
3. **Parallax effects**
4. **Scroll animations**
5. **Loading states** più sofisticati
6. **Transition groups** per liste dinamiche

---

**Status**: ✅ Completato  
**File Creati**: 3
- `components/ui/skeleton.tsx`
- `styles/animations.css`
- `components/ui/animated.tsx`

**Linee di Codice**: ~1,200
**Tempo**: ~2 ore

---

**Micro-animazioni e skeleton loaders pronti per migliorare l'UX!** ✨
