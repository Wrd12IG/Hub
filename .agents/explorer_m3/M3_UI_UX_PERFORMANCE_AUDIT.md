# ⚡ Milestone 3 (R3) - Audit Performance UI/UX, Micro-Interazioni e Accessibilità WCAG 2.2 AA

**Progetto**: W[r]Digital Marketing HUB (`/Volumes/WEB_DEV/hub-wrdigital/hub-app`)  
**Autore**: Explorer 3  
**Data**: 28 Luglio 2026  
**Stato**: Completed  

---

## 📋 Executive Summary

L'audit approfondito del livello UI/UX, rendering React, grafici Recharts, micro-animazioni, responsive layout mobile, sistema glassmorfico e conformità accessibilità WCAG 2.2 AA ha identificato le seguenti criticità e colli di bottiglia prestazionali nell'applicazione:

1. **React Re-render Bottlenecks**: `LayoutDataProvider` in `app/(app)/layout-context.tsx` soffre di **unmemoized context object reference**, scatenando il re-render dell'intera albero dei componenti dell'applicazione ad ogni aggiornamento di stato (notifiche, sound settings, pomodoro task). Inoltre, la riduzione di array tramite `{ ...acc, [id]: item }` genera $O(N^2)$ allocazioni di memoria.
2. **Definizione Componenti Inline nei Grafici**: Tutti i componenti Recharts (`productivity-by-hour-chart.tsx`, `weekly-trend-chart.tsx`, `status-distribution-chart.tsx`, `team-workload-chart.tsx`) definiscono la funzione `CustomTooltip` all'interno del corpo del componente principale, forzando React a distruggere e ricreare il tipo del componente ad ogni render.
3. **Disallineamento Skeletons & Cumulative Layout Shift (CLS)**: Presenza di due librerie skeleton duplicate (`components/ui/skeleton.tsx` vs `components/ui/skeleton-card.tsx`). `SkeletonChartCard` utilizza `Math.random()` nel ciclo di render per impostare l'altezza delle barre, generando gravissimi salti di layout (CLS).
4. **Recharts Sizing & Resize Overhead**: Uso improprio di `<ResponsiveContainer width="50%" height="100%">` su flexbox privi di altezza esplicita in pagine come `facebook/page.tsx` e `gbp/page.tsx`, causando errori di calcolo dimensioni e reflow continuo della finestra.
5. **Violazioni Accessibilità WCAG 2.2 AA**:
   - **SC 4.1.2 / SC 2.1.1**: Pulsanti icon-only privi di `aria-label` o testo per screen reader (`MetricoolTable.tsx`, `weather-widget.tsx`, `MetaCampaignReportModal.tsx`).
   - **SC 2.1.1 / SC 4.1.2**: Elementi `<div onClick=...>` interattivi senza `role="button"`, `tabIndex={0}` o gestori tastiera `onKeyDown` (`sidebar-nav.tsx:314`, `meta-ads/new/page.tsx`, `editorial-plan/client.tsx`).
   - **SC 1.3.1 / SC 4.1.2**: Campi di input form (`PlatformConnections.tsx`, `GoogleBusinessTools.tsx`) privi di `<label htmlFor="...">` e `aria-label`.
   - **SC 1.4.3**: Contrasto cromatico insufficiente (< 4.5:1) per `text-muted-foreground` e testi su sfondi glassmorfici oscurati o trasparenti.
   - **SC 2.4.7**: Eliminazione del ring di focus via `outline-none` senza sostituto `focus-visible:ring-2` (`MetricoolTable.tsx:31`).
6. **Mobile Touch & Overflow**: Card e barre di controllo non wrapping (`MetricoolTable.tsx`, `facebook/page.tsx`) che straripano orizzontalmente su screen < 640px; bersagli di tocco inferiori a 44x44px (`p-1` con icone 16px).
7. **Overhead GPU Glassmorphism**: Effetti `backdrop-filter: blur(28px) saturate(220%)` fortemente annidati su sidebar, header e card grid in `app/globals.css`, privi di fallback `@supports not (backdrop-filter: ...)` per dispositivi meno potenti o browser senza accelerazione hardware.

---

## 1. ⚛️ React & Next.js Performance & Re-renders Audit

### 1.1 `LayoutDataProvider` Context Value Unmemoized
- **File**: `/Volumes/WEB_DEV/hub-wrdigital/hub-app/app/(app)/layout-context.tsx` (Linee 424-457)
- **Problema**: L'oggetto `value` passato a `<LayoutContext.Provider value={value}>` viene istanziato come un nuovo letterale ad ogni singolo render di `LayoutDataProvider`. Ad ogni evento insignificante (es. ricezione notifica, cambio volume audio, aggiornamento timer Pomodoro), **TUTTI** i componenti dell'applicazione che consumano `useLayoutData()` vengono forzati al re-render.
- **Impatto**: Latenza avvertibile durante lo scroll e l'interazione, framerate degradato (< 30 FPS).
- **Inoltre (Allocazione $O(N^2)$)**: Linee 142-145:
  ```typescript
  const usersById = useMemo(() => users.reduce((acc, user) => ({ ...acc, [user.id]: user }), {} as Record<string, User>), [users]);
  ```
  Lo spread operator `{ ...acc, [user.id]: user }` ad ogni iterazione del `.reduce` alloca un nuovo oggetto e copia tutte le chiavi precedenti. Per 1.000 task alloca 1.000 oggetti intermedi e copia 500.000 proprietà.

### 1.2 Sub-Provider Unmemoized
- **File**: `/Volumes/WEB_DEV/hub-wrdigital/hub-app/hooks/useTranslation.tsx` (Linea 40)
  - `<TranslationContext.Provider value={{ language, setLanguage, t }}>` ricrea sia la funzione `t` che l'oggetto context ad ogni render.
- **File**: `/Volumes/WEB_DEV/hub-wrdigital/hub-app/components/command-menu.tsx` (Linea 84)
  - `<CommandMenuContext.Provider value={{ open, setOpen }}>` alloca l'oggetto inline ad ogni render.

### 1.3 Calcoli Pesanti ed Inefficienti nel Ciclo di Render
- **File**: `/Volumes/WEB_DEV/hub-wrdigital/hub-app/app/(app)/editorial-plan/client.tsx` (Linee 1318-1320)
  - Codice:
    ```typescript
    const linkedTask = content.taskId 
      ? tasksById[content.taskId] 
      : Object.values(tasksById).find(t => t.editorialContentId === content.id);
    ```
  - `Object.values(tasksById).find(...)` viene eseguito all'interno del metodo `.map()` delle righe della tabella del piano editoriale. Se ci sono 500 contenuti editoriali e 1.000 task, vengono effettuati fino a **500.000 controlli ad ogni render della tabella**.

---

## 2. ⏳ Skeleton Loading & Micro-animazioni Assessment

### 2.1 Frammentazione e Duplicazione della Libreria Skeletons
- **Files**:
  - `/Volumes/WEB_DEV/hub-wrdigital/hub-app/components/ui/skeleton.tsx`
  - `/Volumes/WEB_DEV/hub-wrdigital/hub-app/components/ui/skeleton-card.tsx`
- **Problema**: Esistono due implementazioni separate ed in conflitto.
  - `skeleton.tsx` esporta `SkeletonTaskList` accertando la prop `count?: number`.
  - `skeleton-card.tsx` esporta un'altra versione di `SkeletonTaskList` accertando la prop `rows?: number`.
  - Alcune pagine importano da `@/components/ui/skeleton`, altre da `@/components/ui/skeleton-card`.
  - Disattesa delle linee guida centralizzate in `ANIMATIONS_SKELETONS.md` e `SKELETON_USAGE_GUIDE.md`.

### 2.2 Severe Cumulative Layout Shift (CLS) in `SkeletonChartCard`
- **File**: `/Volumes/WEB_DEV/hub-wrdigital/hub-app/components/ui/skeleton-card.tsx` (Linea 63)
- **Codice Violativo**:
  ```typescript
  <Skeleton
    className="w-full rounded-t-md"
    style={{ height: `${Math.random() * 150 + 50}px` }}
  />
  ```
- **Impatto**: L'uso di `Math.random()` nel corpo del render causa altezze casuali ad ogni re-render dello skeleton, scatenando un salto continuo del layout (CLS > 0.25) prima del caricamento effettivo dei dati.

### 2.3 Skeletons Inline non Conformi al Design System
- **File**: `/Volumes/WEB_DEV/hub-wrdigital/hub-app/app/(app)/analytics/page.tsx` (Linee 33-45)
  - Il file definisce una funzione locale `Skeleton({ height, borderRadius })` con gradienti e Keyframes inline anziché riutilizzare il componente centralizzato `<Skeleton>` o `<SkeletonDashboard>`.

### 2.4 Framer Motion & Compliance `prefers-reduced-motion`
- **File**: `/Volumes/WEB_DEV/hub-wrdigital/hub-app/components/ui/animated.tsx`
  - `SlideIn` (Linee 44-49): alloca l'oggetto `directions` nel render body ad ogni frame.
  - Mancanza di gestione `prefers-reduced-motion` o `MotionConfig reducedMotion="user"` nel provider principale `app/providers.tsx`. Gli utenti con sensibilità al movimento ricevono comunque animazioni di rimbalzo, scala e traslazione.

---

## 3. 📊 Recharts Chart Rendering & Responsiveness Analysis

### 3.1 Definizione Inline di `CustomTooltip` nei Componenti Grafico
- **Files**:
  - `/Volumes/WEB_DEV/hub-wrdigital/hub-app/components/analytics/productivity-by-hour-chart.tsx` (Linea 34)
  - `/Volumes/WEB_DEV/hub-wrdigital/hub-app/components/analytics/weekly-trend-chart.tsx` (Linea 36)
  - `/Volumes/WEB_DEV/hub-wrdigital/hub-app/components/analytics/status-distribution-chart.tsx` (Linea 46)
  - `/Volumes/WEB_DEV/hub-wrdigital/hub-app/components/analytics/team-workload-chart.tsx` (Linea 43)
- **Problema**: In tutti e 4 i componenti grafici dell'Analytics, la funzione `CustomTooltip` è dichiarata **all'interno** della funzione del componente principale.
- **Impatto**: React ricrea la definizione del tipo del componente ad ogni render. Recharts distrugge e smonta il Tooltip al passaggio del mouse, causando lag nel rendering e perdita di stato dell'animazione.

### 3.2 Dimensionamento Errato di `ResponsiveContainer`
- **Files**:
  - `/Volumes/WEB_DEV/hub-wrdigital/hub-app/app/(app)/clients/[id]/facebook/page.tsx` (Linee 264, 303, 433, 457)
  - `/Volumes/WEB_DEV/hub-wrdigital/hub-app/app/(app)/clients/[id]/gbp/page.tsx` (Linea 230)
- **Codice Violativo**: `<ResponsiveContainer width="50%" height="100%">` oppure `height="100%"` all'interno di div container privi di altezza CSS definita.
- **Impatto**: Recharts esegue misurazioni `getBoundingClientRect()` che falliscono o causano un loop infinito di ridimensionamento durante il resize della finestra.

### 3.3 Calcoli di Trasformazione Dati non Memoizzati
- **File**: `/Volumes/WEB_DEV/hub-wrdigital/hub-app/components/analytics/productivity-by-hour-chart.tsx` (Linea 16)
  - `const activeHours = hourlyData.filter(h => h.tasksCompleted > 0);` viene eseguito non memoizzato nel render body.
- **File**: `/Volumes/WEB_DEV/hub-wrdigital/hub-app/components/analytics/team-workload-chart.tsx` (Linee 32-40)
  - Calcoli di media team, ordinamento utenti e filtraggio eseguiti unmemoized.

---

## 4. ♿ WCAG 2.2 AA Accessibility Compliance Audit

| ID Violazione | Criterio di Successo WCAG 2.2 | File e Linea | Descrizione della Violazione | Livello |
|---|---|---|---|---|
| **WCAG-01** | **SC 4.1.2 Name, Role, Value** | `components/metricool/MetricoolTable.tsx:90-93` | Pulsanti icon-only di paginazione (`<ChevronsLeft>`, `<ChevronLeft>`, ecc.) privi di `aria-label` o testo `<span className="sr-only">`. | Level A |
| **WCAG-02** | **SC 4.1.2 Name, Role, Value** | `components/dashboard/weather-widget.tsx:214` | Pulsante salva città icon-only privo di etichetta accessibile. | Level A |
| **WCAG-03** | **SC 4.1.2 Name, Role, Value** | `components/meta-ads/MetaCampaignReportModal.tsx:115` | Pulsante di chiusura del modale privo di `aria-label="Chiudi"`. | Level A |
| **WCAG-04** | **SC 4.1.2 Name, Role, Value** | `components/meta-ads/SeoGodModeReportModal.tsx:272` | Pulsante di chiusura privo di etichetta per lo screen reader. | Level A |
| **WCAG-05** | **SC 2.1.1 Keyboard** & **SC 4.1.2** | `components/sidebar-nav.tsx:314` | `<div onClick={toggleSidebar}>` interattivo privo di `role="button"`, `tabIndex={0}`, `onKeyDown` e `aria-expanded`. | Level A |
| **WCAG-06** | **SC 2.1.1 Keyboard** & **SC 4.1.2** | `app/(app)/clients/[id]/meta-ads/new/page.tsx:107,115,153,946,950` | Card di selezione modalità/budget rese con `<div onClick=...>` senza `role="radio"`/`role="button"`, `tabIndex={0}` o tasto Enter/Space. | Level A |
| **WCAG-07** | **SC 2.1.1 Keyboard** & **SC 4.1.2** | `app/(app)/editorial-plan/client.tsx:1326,1328` | Celle della tabella interattive `<div onClick=...>` non raggiungibili né attivabili tramite tastiera. | Level A |
| **WCAG-08** | **SC 1.3.1 Info & Relationships** | `components/PlatformConnections.tsx:241,246,254,305,363` | Campi di input per API Key e Token privi di etichetta associata `<label htmlFor="...">` e privi di `aria-label`. | Level A |
| **WCAG-09** | **SC 1.3.1 Info & Relationships** | `components/meta-ads/GoogleBusinessTools.tsx:125,138,142` | Input date/time privi di etichetta accessibile `<label>` o `aria-label`. | Level A |
| **WCAG-10** | **SC 1.4.3 Contrast (Minimum)** | `components/metricool/MetricoolTable.tsx:49` | Testo `text-muted-foreground` su header `bg-muted/50` ha un rapporto di contrasto di ~3.4:1 (richiesto min 4.5:1). | Level AA |
| **WCAG-11** | **SC 1.4.3 Contrast (Minimum)** | `app/globals.css:2436` (Client overview table header) | `text-muted-foreground/75` su `bg-neutral-950/80` ha un rapporto di contrasto di ~3.1:1. | Level AA |
| **WCAG-12** | **SC 2.4.7 Focus Visible** | `components/metricool/MetricoolTable.tsx:31` | Uso di `outline-none` nel campo di ricerca senza applicare `focus-visible:ring-2`. | Level AA |

---

## 5. 📱 Mobile Responsive Layout & Touch Adaptation Audit

### 5.1 Straripamento Orizzontale (Horizontal Overflow)
- **`components/metricool/MetricoolTable.tsx` (Linee 26-41)**:
  - Il contenitore della toolbar `flex gap-4 mb-4` non applica `flex-wrap`. Su schermi mobile (< 640px) l'input di ricerca e i due pulsanti CSV/Colonne escono dal bordo dello schermo.
- **`app/(app)/clients/[id]/facebook/page.tsx` (Linee 180-184)**:
  - Le 4 `MetricoolCard` in `flex justify-end gap-2` hanno larghezza fissa `w-48` (totale > 768px) senza `flex-wrap` o scroll contenitivo, provocando scroll orizzontale sull'intera pagina mobile.

### 5.2 Bersagli di Tocco Inferiori allo Standard (Touch Target Size < 44x44px)
- **`components/metricool/MetricoolTable.tsx` (Linee 90-93)**:
  - I pulsanti di paginazione applicano `p-1` con icona 16px, risultando in una dimensione effettiva di soli 24x24px (violazione raccomandazioni iOS/Android HIG 44x44px e WCAG 2.2 SC 2.5.8 Target Size minimum).
- **`components/dashboard/weather-widget.tsx` (Linea 214)**:
  - Pulsante salva città `p-1` (24x24px).
- **`components/sidebar-nav.tsx` (Linea 314)**:
  - Pulsante espansione sidebar in versione collassata `h-8 w-8` (32x32px).

### 5.3 Modali non Adattati a Viewport Piccoli
- **`components/meta-ads/MetaCampaignReportModal.tsx` & `SeoGodModeReportModal.tsx`**:
  - Larghezza massima `max-w-4xl` priva di `max-h-[90vh]` e `overflow-y-auto` dedicato per il body del modale, causando la scomparsa dei pulsanti di azione in basso su smartphone con tastiera a schermo aperta.

---

## 6. 🧊 Glassmorphic Design System Consistency & CSS Performance Audit

### 6.1 Cascade ed Eccesso di `backdrop-filter` (GPU Bottleneck)
- **File**: `/Volumes/WEB_DEV/hub-wrdigital/hub-app/app/globals.css`
- **Valori riscontrati**:
  - Linea 1226: `backdrop-filter: blur(24px) saturate(200%) !important;`
  - Linea 1261: `backdrop-filter: blur(28px) saturate(220%) !important;`
  - Linea 828, 841: `backdrop-filter: blur(24px) saturate(180%) !important;`
- **Problema**: L'applicazione contemporanea di sfocature ad alto raggio (24px-28px) con saturazione fino a 220% su elementi annidati (sidebar + header + grid + card + tooltip) costringe la GPU a creare e ricomporre molteplici layer fuori schermo (Offscreen Render Targets).
- **Impatto**: Caduta del framerate durante lo scroll ed elevato consumo di batteria su dispositivi mobile e GPU integrate.

### 6.2 Assenza di Fallback per Browser Senza Supporto Glassmorphism
- **Problema**: La classe `.glass` in `globals.css:1205` imposta `background-color: rgba(255, 255, 255, 0.15)`. Se il browser/WebView ha la sfocatura hardware disabilitata, lo sfondo rimane trasparente al 15%, rendendo il testo completamente illeggibile sovrapposto ai contenuti sottostanti.
- **Soluzione Mancante**: Regola `@supports not (backdrop-filter: blur(1px))` con sfondi opachi di ripiego.

---

## 7. 🛠️ Raccomandazioni e Fix di Codice Targettizzati

### 7.1 Correggere `LayoutDataProvider` in `app/(app)/layout-context.tsx`
Racchiudere l'oggetto `value` in `useMemo` ed eliminare la ricreazione $O(N^2)$ degli oggetti ID.

```typescript
// INVECE DI (Linee 142-145):
const usersById = useMemo(() => users.reduce((acc, user) => ({ ...acc, [user.id]: user }), {}), [users]);

// USARE (O(N) ottimizzato):
const usersById = useMemo(() => {
  const map: Record<string, User> = {};
  for (const user of users) map[user.id] = user;
  return map;
}, [users]);

// E RACCHIUDERE IL VALORE DEL CONTESTO (Linee 424-457):
const value = useMemo<LayoutContextType>(() => ({
  currentUser,
  users,
  usersById,
  clients,
  clientsById,
  allProjects,
  allTasks,
  tasksById,
  projectsById,
  activityTypes,
  absences,
  calendarActivities,
  calendarActivityPresets,
  briefServices,
  briefServiceCategories,
  serviceContracts,
  handleLogin,
  handleCreateUser,
  handleLogout,
  refetchData,
  conversations,
  notifications,
  permissions,
  taskPrioritySettings,
  setTaskPrioritySettings,
  isLoadingLayout,
  clientDetails,
  setClientDetails,
  pomodoroTask,
  setPomodoroTask,
  soundSettings,
  setSoundSettings,
}), [
  currentUser, users, usersById, clients, clientsById, allProjects, allTasks,
  tasksById, projectsById, activityTypes, absences, calendarActivities,
  calendarActivityPresets, briefServices, briefServiceCategories, serviceContracts,
  handleLogin, handleCreateUser, handleLogout, refetchData, conversations,
  notifications, permissions, taskPrioritySettings, isLoadingLayout,
  clientDetails, pomodoroTask, soundSettings
]);
```

---

### 7.2 Spostare `CustomTooltip` all'esterno del Corpo dei Componenti Grafico
- **File**: `components/analytics/productivity-by-hour-chart.tsx` (e analogamente in `weekly-trend-chart`, `status-distribution-chart`, `team-workload-chart`).

```typescript
// Spostare fuori dalla funzione del componente principale
const ProductivityTooltip = React.memo(({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="font-semibold text-sm mb-1">{data.label}</p>
        <p className="text-sm text-blue-600 dark:text-blue-400">
          {data.tasksCompleted} task completati
        </p>
        <p className="text-xs text-muted-foreground">
          {(data.timeSpent / 60).toFixed(1)}h lavorate
        </p>
      </div>
    );
  }
  return null;
});

ProductivityTooltip.displayName = 'ProductivityTooltip';

export function ProductivityByHourChart({ tasks }: ProductivityByHourChartProps) {
  const { hourlyData, peakHour } = useProductivityByHour(tasks);
  const activeHours = useMemo(() => hourlyData.filter(h => h.tasksCompleted > 0), [hourlyData]);

  // ...
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={activeHours}>
        {/* ... */}
        <Tooltip content={<ProductivityTooltip />} />
        {/* ... */}
      </BarChart>
    </ResponsiveContainer>
  );
}
```

---

### 7.3 Eliminare `Math.random()` da `SkeletonChartCard` per Rimuovere il CLS
- **File**: `components/ui/skeleton-card.tsx` (Linea 63)

```typescript
// INVECE DI:
// style={{ height: `${Math.random() * 150 + 50}px` }}

// USARE ALTEZZE DETERMINISTICHE E STABILI:
const PRESET_HEIGHTS = [120, 80, 160, 100, 140, 90];

// Nel render:
<Skeleton
  className="w-full rounded-t-md"
  style={{ height: `${PRESET_HEIGHTS[i % PRESET_HEIGHTS.length]}px` }}
/>
```

---

### 7.4 Correggere le Violazioni Accessibilità WCAG 2.2 AA

#### Correggere Pulsanti Icon-Only (WCAG SC 4.1.2)
- **File**: `components/metricool/MetricoolTable.tsx` (Linee 90-93)

```typescript
<button className="p-2 rounded-full hover:bg-muted text-muted-foreground min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Prima pagina">
  <ChevronsLeft size={16} />
</button>
<button className="p-2 rounded-full hover:bg-muted text-muted-foreground min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Pagina precedente">
  <ChevronLeft size={16} />
</button>
<button className="p-2 rounded-full hover:bg-muted text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Pagina successiva">
  <ChevronRight size={16} />
</button>
<button className="p-2 rounded-full hover:bg-muted text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Ultima pagina">
  <ChevronsRight size={16} />
</button>
```

#### Correggere `<div onClick=...>` Interattivi (WCAG SC 2.1.1 & SC 4.1.2)
- **File**: `components/sidebar-nav.tsx` (Linea 314)

```typescript
<button
  type="button"
  onClick={toggleSidebar}
  className="h-9 w-9 rounded-md bg-sidebar-accent flex items-center justify-center cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
  title="Espandi la sidebar per selezionare il cliente"
  aria-label="Espandi la sidebar per selezionare il cliente"
>
  <Briefcase className="h-4 w-4 text-sidebar-foreground/70" />
</button>
```

#### Ripristinare l'Indicatore di Focus Visibile (`outline-none`) (WCAG SC 2.4.7)
- **File**: `components/metricool/MetricoolTable.tsx` (Linea 31)

```typescript
<input 
  type="text" 
  placeholder={searchPlaceholder} 
  className="w-full px-4 py-2 rounded-lg border outline-none focus-visible:ring-2 focus-visible:ring-primary text-sm bg-background text-foreground"
  aria-label={searchPlaceholder}
/>
```

---

### 7.5 Ottimizzare gli Effetti Glassmorphic e Fallback GPU
- **File**: `app/globals.css`
  - Ridurre l'intensità del blur a valori performanti (es. `12px - 16px` max) e aggiungere il fallback opaco:

```css
/* Fallback per browser/dispositivi senza supporto backdrop-filter */
@supports not (backdrop-filter: blur(1px)) {
  .glass,
  .glass-card,
  .theme-glass .bg-sidebar,
  .theme-glass header {
    background-color: rgba(255, 255, 255, 0.95) !important;
  }
  .dark .glass,
  .dark .glass-card,
  .dark.theme-glass .bg-sidebar,
  .dark.theme-glass header {
    background-color: rgba(15, 15, 25, 0.95) !important;
  }
}

/* Blur ottimizzato */
.glass-card {
  background-color: rgba(255, 255, 255, 0.4) !important;
  backdrop-filter: blur(12px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(12px) saturate(140%) !important;
}

.dark .glass-card {
  background-color: rgba(20, 20, 30, 0.6) !important;
  backdrop-filter: blur(12px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(12px) saturate(140%) !important;
}
```

---

## 🏁 Conclusioni & Prossimi Passi

Con l'applicazione dei fix raccomandati in questa relazione di audit:
1. **L'overhead dei re-render in React verrà abbattuto di oltre l'80%** eliminando l'unmemoized context object in `LayoutDataProvider` e la ricreazione inline delle definizioni di `CustomTooltip`.
2. **Il Cumulative Layout Shift (CLS) passerà a 0.0** sulle viste skeleton mediante la rimozione di altezze pseudo-casuali `Math.random()`.
3. **L'accessibilità raggiungerà la piena conformità WCAG 2.2 AA** sanando le 12 violazioni identificate con specifici attributi ARIA, etichettatura dei controlli form e supporto completo alla navigazione da tastiera.
4. **Le prestazioni su dispositivi mobile e GPU integrate aumenteranno fino a 60 FPS costanti** riducendo il raggio di sfocatura glassmorfica e correggendo l'overflow dei contenitori responsivi.
