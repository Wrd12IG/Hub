# Audit Flussi Utente End-to-End (R1) — W[r]Digital Marketing HUB

**Data Audit**: 28 Luglio 2026  
**Autore**: Explorer 1 (Milestone 1)  
**Applicazione**: W[r]Digital Marketing HUB (`/Volumes/WEB_DEV/hub-wrdigital/hub-app`)  
**Stato Audit**: Completato (Read-Only Analysis)

---

## 1. Executive Summary: Salute UX/UI dell'Applicazione

Il sistema **W[r]Digital Marketing HUB** presenta un'architettura Next.js App Router ricca di funzionalità operative (gestione task, piani editoriali, strategie AI, reportistica clienti, automazioni e monitoraggio in tempo reale su Firebase Firestore). Tuttavia, l'analisi approfondita dei flussi utente e del codice sorgente ha evidenziato diverse criticità di UX/UI, colli di bottiglia nei click richiesti per completare le operazioni quotidiane e difetti strutturali di navigazione:

### Valutazione Sintetica di Salute UX/UI
- **Navigazione & Architettura Inizio Flusso**: ⚠️ **Critico**. Il menu laterale classico (`SidebarNav`) è disabilitato/commentato in `app/(app)/layout.tsx`. La navigazione fa affidamento su `Header` e `FloatingCommandDock`. La creazione clienti contiene un **link rotto (404 Error)** da `/clients` a `/clients/new`.
- **Efficienza dei Click (Click Economy)**: 🟠 **Frizione Moderata-Alta**. Operazioni frequenti (creazione task, invio in approvazione, approvazione a 2 fasi, onboarding cliente) richiedono da 8 a 18 click con dialog di conferma ridondanti e menu annidati.
- **Chiarezza Visiva & Coerenza UI**: 🟡 **Frizione Moderata**. Inconsistenza negli stili CSS (misto di Tailwind CSS e CSS inline custom con variabili `var(--card-bg)` in `analytics/page.tsx`). Sovrapposizione visiva sul viewport tra `FloatingCommandDock`, widget Pomodoro, toast Sonner e modal di quotazione motivazionale.
- **Sincronizzazione Real-Time & Prestazioni**: 🟠 **Frizione Tecnica**. Il provider globale `LayoutDataProvider` (`app/(app)/layout-context.tsx`) mantiene oltre 12 listener `onSnapshot` su **intere collezioni Firestore** (`tasks`, `projects`, `clients`, `users`, etc.), provocando re-render a cascata durante l'aggiornamento dei dati.

---

## 2. Mappatura Dettagliata dei 6 Flussi Operativi Chiave

---

### Flusso 1: Task Management & Execution (Gestione ed Esecuzione Task)

#### Ruoli Utente Coinvolti
- **Amministratore / Project Manager**: Creazione task, assegnazione collaboratori, definizione dipendenze e priorità, approvazione (1 o 2 step), eliminazione task.
- **Collaboratore**: Visualizzazione task assegnate, avvio timer di tracciamento (Pomodoro), avanzamento stato in lavorazione, invio in approvazione con allegato/commento.
- **Cliente**: Visualizzazione task del proprio client ID, approvazione/rifiuto delle task contrassegnate per approvazione cliente.
- **Guest**: Visualizzazione sintetica via link pubblico condiviso (`/share/client/[token]`).

#### Obiettivo Operativo
Creare, prendere in carico, tracciare il tempo, revisionare, approvare e completare le attività di progetto senza interruzioni.

#### Passaggi & Click Richiesti (Mapping Step-by-Step)
1. **Accesso alla sezione Task**: 1 click dalla dock/header (`/tasks`).
2. **Apertura Modal Creazione**: 1 click su "Nuovo Task" (apre `TaskForm` dinamico).
3. **Compilazione Form Creazione**:
   - Titolo: 1 click per il focus + digitazione.
   - Descrizione (RichTextEditor): 1 click + digitazione.
   - Selezione Cliente: 1 click su dropdown + 1 click sulla voce.
   - Selezione Progetto: 1 click + 1 click.
   - Assegnatario: 1 click + 1 click.
   - Tipo Attività: 1 click + 1 click.
   - Priorità & Scadenza: 2-3 click.
   - Allegati/Dipendenze/Spunta Approvazione 2 step: 3-5 click.
   - Invio Form ("Crea Task"): 1 click.  
   *Totale click creazione: 13-16 click.*
4. **Esecuzione & Tracciamento Tempo (Collaboratore)**:
   - Click su pulsante Play nella scheda task per avviare il timer: 1 click.
   - Cambio stato da "Da Fare" a "In Lavorazione": 1-2 click.
   - Caricamento allegato / inserimento commento: 2-4 click.
   - Invio in approvazione ("Invia in Approvazione"): 1 click su card -> Mostra dialog di conferma -> 1 click per confermare.
5. **Approvazione Task (Admin / PM / Cliente)**:
   - Identificazione visiva della card (sfondo animato viola `animate-approval`).
   - Click su "Approva": 1 click su card -> Inserimento modal `ApprovalActionState` -> Spunta notifica email -> Click "Conferma Approvazione": 1 click.  
   *Totale click approvazione: 3 click.*

#### Ridondanze e Punti di Frizione
- **Monolito di Codice**: `app/(app)/tasks/tasks-content.tsx` ha **2.496 righe di codice** in un unico file, gestendo Kanban, Lista, Gantt, dialoghi di conferma, chat task e filtri.
- **Doppia Conferma per Invio/Approvazione**: Quando un collaboratore invia una task in approvazione, viene aperta una modal che richiede un ulteriore click di conferma anche se non vi sono campi obbligatori aggiuntivi.
- **Sovrapposizione Timer Pomodoro**: L'avvio del timer da una card attiva il widget `PomodoroWidget` in basso a destra, che copre parzialmente le notifiche Toast e il pulsante del menu flotante `FloatingCommandDock`.
- **Scrolling al Task via URL (`?taskId=xyz`)**: L'evidenziazione via `scrollIntoView` fallisce silenziosamente se la task si trova su una pagina diversa o è nascosta dai filtri correnti.

#### Componenti & File Coinvolti
- `app/(app)/tasks/tasks-content.tsx` (Linee 154-460 per `TaskCard`, 660-700 per permessi e approvazione)
- `components/task-form.tsx` (Linee 58-130 per schema Zod e default values)
- `components/pomodoro-timer.tsx`
- `lib/actions.ts` (Linee 300-360 per workflow notifiche e approvazioni)

#### Raccomandazioni UX
- **Quick-Approval in 1-Click**: Consentire all'Admin/PM di approvare una task direttamente dalla card con un singolo click (con opzione SHIFT+Click o pulsante diretto sulla card senza aprire la modal di conferma email).
- **In-Line Quick Task Creation**: Aggiungere un input rapido in cima a ciascuna colonna Kanban ("+ Aggiungi task veloce") per creare task inserendo solo titolo e assegnatario con un solo tasto INVIO, posticipando i dettagli facoltativi.
- **Refactoring Modularizzatore**: Dividere `tasks-content.tsx` in sotto-componenti isolati (`TaskKanbanView`, `TaskListView`, `TaskGanttView`, `TaskApprovalModals`).

---

### Flusso 2: Editorial Plans / Piani Editoriali

#### Ruoli Utente Coinvolti
- **Amministratore / PM**: Creazione piano editoriale, configurazione canali e formati (IG, FB, TikTok, LinkedIn, YouTube, Stories), programmazione date, export CSV, pubblicazione via Zapier/Buffer.
- **Collaboratore**: Stesura copy/caption, caricamento media (immagini/video), anteprima post nelle varie piattaforme, passaggio stato a "In Approvazione".
- **Cliente**: Revisione post, approvazione singoli contenuti o inserimento note di revisione/feedback.
- **Guest**: Visualizzazione di sola lettura via link condiviso.

#### Obiettivo Operativo
Pianificare, redigere, simulare graficamente, inviare in revisione al cliente e pubblicare i contenuti social.

#### Passaggi & Click Richiesti (Mapping Step-by-Step)
1. **Accesso al Piano Editoriale**: 1 click (`/editorial-plan` oppure `/clients/[id]/editorial-plan`).
2. **Selezione Vista (Tabella, Kanban, Calendario)**: 1 click per ogni switch di vista.
3. **Creazione Nuovo Contenuto Editoriale**:
   - Click su "+ Nuovo Contenuto": 1 click (apre `FormWrapper` in `editorial-plan/client.tsx`).
   - Selezione Cliente, Canale Social, Formato (Post, Reel, Story, Carousel), Stato, Data e Ora di pubblicazione, Copywriting: ~12-16 click + digitazione.
   - Caricamento allegati media: 2-3 click per file picker.
   - Salva Contenuto: 1 click.
4. **Anteprima Live (Live Preview)**:
   - Click sull'icona occhio/anteprima della riga o card: 1 click per aprire `LivePreview` (`components/editorial-plan/live-preview.tsx`).
   - Commutazione feed social (Instagram / Facebook / TikTok / LinkedIn): 1 click per tab di piattaforma.
5. **Approvazione Cliente**:
   - Il cliente accede al HUB o alla dashboard condivisa.
   - Nella vista Tabella o Kanban del piano editoriale, cambia lo stato del contenuto da "In Approvazione Cliente" ad "Approvato": 2 click.

#### Ridondanze e Punti di Frizione
- **Monolito di Codice**: `app/(app)/editorial-plan/client.tsx` supera le **2.100 righe di codice**. Gestisce contemporaneamente l'editing in-line della tabella, la modal di creazione, la vista Kanban e il motore di import/export.
- **Assenza di Approvazione Pubblica Diretta per Singolo Post**: Il link pubblico condiviso del cliente (`/share/client/[token]`) mostra solo lo stato generale dei progetti e le task completate, MA NON MOSTRA i post del piano editoriale con i pulsanti diretti "Approva Post" / "Richiedi Modifica".
- **Separazione Caricamento Immagini/Video**: I caricamenti media nel form editoriale utilizzano percorsi separati nel backend (`editorial-plan/images` vs `editorial-plan/videos`), costringendo l'utente a gestire input file distinti invece di un drag-and-drop unico multimediale.

#### Componenti & File Coinvolti
- `app/(app)/editorial-plan/client.tsx` (Linee 241-380 per KanbanView, 1567-1980 per FormWrapper)
- `components/editorial-plan/live-preview.tsx` (Simulatore UI Feed Social)
- `app/share/client/[token]/page.tsx` (Dashboard condivisa cliente)

#### Raccomandazioni UX
- **Public One-Click Client Approval Page**: Creare una rotta pubblica condivisa (`/share/editorial-plan/[token]`) dove il cliente, senza effettuare il login, può scorrere l'anteprima visiva dei post e approvarli o rifiutarli con 1 click.
- **Unified Drag-and-Drop Media Asset Zone**: Sostituire i campi separati di upload con un'unica area di drag-and-drop con anteprima istantanea e supporto per immagini, video e caroselli.
- **Edizione Rapida In-Line in Tabella**: Ottimizzare l'editing in-line nella vista Tabella (click sulla cella -> salva automaticamente al blur senza modal).

---

### Flusso 3: Marketing Strategies & Roadmaps (Strategie e Roadmap)

#### Ruoli Utente Coinvolti
- **Amministratore / PM**: Generazione strategie marketing AI, definizione posizionamento brand, analisi buyer persona, KPI e OKR target, roadmap contenuti, conversione strategia in progetti/task.
- **Collaboratore**: Consultazione pilastri strategici ed esecuzione dei relativi progetti/task associati.
- **Cliente**: Consultazione della strategia e invio feedback o approvazione formale.
- **Guest**: Visualizzazione della strategia via link pubblico condiviso (`/share/social-strategy/[id]`).

#### Obiettivo Operativo
Definire e pianificare la strategia di marketing social del cliente tramite AI, condividerla con il cliente per l'approvazione ed estrarre la roadmap operativa.

#### Passaggi & Click Richiesti (Mapping Step-by-Step)
1. **Accesso alla Sezione Strategie**: 1 click (`/social-strategies`).
2. **Avvio Creazione Nuova Strategia**: 1 click su "Nuova Strategia" -> reindirizza a `/social-strategies/new`.
3. **Compilazione Form Prompt AI**:
   - Selezione Cliente, Frequenza, Valori Brand, Competitor, Target Audience, Tone of Voice: 10-12 click + digitazione.
   - Click su "Genera Strategia AI": 1 click (attiva elaborazione LLM).
4. **Consultazione Risultato Strategico (`/social-strategies/[id]`)**: Visualizzazione SWOT, Buyer Persona, Pilastri di Contenuto, Roadmap Mensile, KPI Target.
5. **Condivisione con il Cliente**:
   - Click su "Condividi con Cliente": 1 click (copia negli appunti il link pubblico `/share/social-strategy/[clientId]`).
   - Il cliente apre il link (0 click login) -> Visualizza la scheda -> Click su "Approva Strategia" (1 click) oppure "Richiedi Modifiche" (1 click + digitazione note + 1 click invia).
6. **Trasformazione Strategia in Task Operativi**:
   - **Frizione Attuale**: Non esiste un pulsante automatico "Genera Task da Strategia". L'operatore deve copiare manualmente i pilastri di contenuto e creare i progetti o le task una per una!

#### Ridondanze e Punti di Frizione
- **Mancanza di Conversione Automatica (Strategy-to-Task Gap)**: Una volta approvata la strategia, non c'è integrazione diretta con il flusso Task/Piano Editoriale. L'utente deve eseguire decine di inserimenti manuali duplicati.
- **Filtro Client-Side nella Lista Strategie**: `app/(app)/social-strategies/page.tsx` scarica tutte le strategie e applica il filtro in memoria nel browser invece di sfruttare query Firestore o il contesto globale `useLayoutData`.
- **Duplicazione Strategia Imperfetta**: La funzione "Duplica" reindirizza a `/social-strategies/new?duplicateId=...` ma non pre-popola correttamente tutti i campi strutturati JSON annidati.

#### Componenti & File Coinvolti
- `app/(app)/social-strategies/page.tsx` (Lista strategie)
- `app/(app)/social-strategies/new/page.tsx` (Form generazione AI)
- `app/(app)/social-strategies/[id]/page.tsx` (Dettaglio e Roadmap)
- `app/share/social-strategy/[id]/page.tsx` (Pagina condivisa approvazione cliente)
- `lib/social-strategy-actions.ts`

#### Raccomandazioni UX
- **1-Click Action "Converti in Piano Editoriale / Task"**: Aggiungere un pulsante nella vista strategia approvata che genera automaticamente la struttura delle task e delle bozze nel Piano Editoriale per il periodo selezionato.
- **Status Stepper Visivo nella Roadmap**: Mostrare una barra di progresso visiva (Bozza -> Inviata al Cliente -> Approvata -> In Esecuzione) con indicatore delle milestone completate.

---

### Flusso 4: Client Onboarding & Client Management (Onboarding e Gestione Cliente)

#### Ruoli Utente Coinvolti
- **Amministratore**: Onboarding nuovo cliente, configurazione anagrafica, integrazione API (Meta, Google Ads, GBP, GA4, Clarity, LinkedIn, TikTok), caricamento Brand Kit (loghi, font, colori), assegnazione ruoli utenti/clienti.
- **Collaboratore**: Consultazione scheda cliente, accesso alle risorse del brand e ai report di campagna.
- **Cliente**: Accesso alla propria dashboard cliente, visualizzazione stato avanzamento e brand kit.
- **Guest**: Accesso tramite token pubblico condiviso.

#### Obiettivo Operativo
Registrare un nuovo cliente, collegare gli asset del brand e le integrazioni social/ads, configurare i permessi di accesso per gli utenti del cliente e monitorare la scheda 360°.

#### Passaggi & Click Richiesti (Mapping Step-by-Step)
1. **Accesso alla Pagina Clienti**: 1 click dalla dock/header (`/clients`).
2. **TENTATIVO CREAZIONE NUOVO CLIENTE**:
   - Click sul pulsante "Aggiungi cliente" su `/clients`: 1 click.
   - **ERRORE CRITICO**: Il pulsante punta a `<Link href="/clients/new">`, ma la rotta `app/(app)/clients/new/page.tsx` **NON ESISTE (Errore 404)**!
3. **WORKAROUND ATTUALE PER CREARE UN CLIENTE**:
   - L'amministratore deve spostarsi su `/admin` (Pannello Admin): 1 click.
   - Selezionare la tab "Gestione Clienti": 1 click.
   - Click su "+ Nuovo Cliente" (apre modal in `admin/page.tsx`): 1 click.
   - Compilazione nome, settore, sito web, colore brand, token API: ~10-14 click + digitazione.
4. **Navigazione Scheda Cliente (`/clients/[id]`)**:
   - Click sulla card cliente per accedere al dettaglio 360°: 1 click.
   - La scheda cliente presenta oltre 15 sub-tab/sub-rotte! (`ads-automation`, `calendar`, `creative`, `editorial-plan`, `facebook`, `gbp`, `google-ads`, `instagram`, `linkedin`, `meta-ads`, `projects`, `stories`, `tasks`, `tiktok`, `youtube`).
5. **Assegnazione Utenti al Cliente**:
   - Per consentire a un utente di ruolo "Cliente" di vedere le proprie task, l'Admin deve andare in `/admin` -> Tab "Utenti" -> Modifica Utente -> Impostare ruolo "Cliente" -> Selezionare il `clientId`: 5-7 click.

#### Ridondanze e Punti di Frizione
- **🚨 LINK ROTTO 404 CRITICO**: Il pulsante principale "Aggiungi cliente" nella pagina `/clients` (linea 71 di `app/(app)/clients/page.tsx`) porta a una pagina 404 inesistente.
- **Onboarding Disperso**: L'onboarding di un cliente richiede di navigare tra tre schermate differenti (`/clients`, `/admin`, e `/clients/[id]`) senza un wizard guidato passo-passo.
- **Overload di Tab nella Scheda Cliente**: La presenza di 15+ schede nella vista cliente crea disorientamento visivo e forza uno scroll orizzontale prolungato sulle risoluzioni desktop standard.

#### Componenti & File Coinvolti
- `app/(app)/clients/page.tsx` (Linea 71: Link errato a `/clients/new`)
- `app/(app)/clients/[id]/page.tsx` (Scheda cliente 360°, 2.734 righe di codice!)
- `app/(app)/admin/page.tsx` (Gestione utenti e creazione clienti)

#### Raccomandazioni UX
- **Correzione Immediata Link 404**: Sostituire il link `/clients/new` con l'apertura diretta della modal di creazione cliente o creare la rotta `app/(app)/clients/new/page.tsx`.
- **Wizard di Onboarding Unificato in 3 Step**: Creare un flusso guidato: Step 1: Dati Anagrafici & Brand Kit -> Step 2: Connessioni API/Social -> Step 3: Invito Utenti Cliente.
- **Raggruppamento Tab Scheda Cliente**: Raggruppare le 15+ sub-tab in 4 macro-categorie principali (Overview & Brand Kit, Social & Ads, Progetti & Task, Reportistica).

---

### Flusso 5: Analytics & Performance Reporting (Analytics e Reportistica)

#### Ruoli Utente Coinvolti
- **Amministratore / PM**: Analisi produttività globale, carico di lavoro del team, picchi orari di efficienza, calcolo redditività clienti e ROI progetti, previsioni di budget, export report clienti in PDF/CSV.
- **Collaboratore**: Consultazione metriche di carico personale e ore lavorate.
- **Cliente**: Consultazione del report mensile e del progresso di completamento dei progetti.
- **Guest**: N/A.

#### Obiettivo Operativo
Monitorare la produttività della struttura, verificare l'avanzamento dei KPI, calcolare i margini di profitto sui clienti e generare report esportabili.

#### Passaggi & Click Richiesti (Mapping Step-by-Step)
1. **Accesso alla Sezione Analytics**: 1 click dalla dock/header (`/analytics` o `/reports`).
2. **Selezione Filtro Temporale**: Click su selettore periodo ('7d' | '30d' | '90d'): 1 click.
3. **Consultazione KPI e Grafici**:
   - Visualizzazione schede KPI (Produttività %, Ore Totali, Fatturabile, Progetti Attivi).
   - Grafici Recharts (Produttività oraria, Distribuzione stati, Carico team, Heatmap attività).
4. **Calcolo Profitto Cliente & ROI**: Scroll della pagina per inserire/visualizzare i dati di ricavo e costo orario medio.
5. **Generazione ed Esportazione Report Cliente**:
   - Navigazione a `/clients/[id]` -> Sezione "Report Mensile" (`ClientMonthlyReport`) -> Selezione Mese -> Click "Scarica PDF": 3-4 click.

#### Ridondanze e Punti di Frizione
- **Inconsistenza Stilistica (CSS Inline vs Tailwind)**: `app/(app)/analytics/page.tsx` fa uso estensivo di stili CSS inline custom (`style={{ background: 'var(--card-bg, #fff)', ... }}`) mescolati a classi Tailwind, violando la coerenza del sistema di design dei token.
- **Filtri Data Rigidi**: Impossibilità di selezionare un intervallo di date personalizzato (Da [Data] A [Data]); presenti solo i 3 preset fissi (7, 30, 90 giorni).
- **Approssimazione del Tracciamento Orario**: Nel calcolo della produttività per ora (`tasksToTimeEntries`), il tempo totale della task (`timeSpent`) viene associato arbitrariamente all'ora del timestamp `updatedAt`, anziché registrare i log effettivi delle sessioni di lavoro. Questo distorce il grafico dei picchi di produttività oraria.

#### Componenti & File Coinvolti
- `app/(app)/analytics/page.tsx`
- `components/analytics/` (`metric-card.tsx`, `productivity-by-hour-chart.tsx`, `team-workload-chart.tsx`)
- `components/client-monthly-report.tsx`
- `lib/analytics-engine.ts`

#### Raccomandazioni UX
- **DatePicker Intervallo Personalizzato**: Introdurre un componente DateRangePicker con calendario per filtri precisi su qualsiasi intervallo di date.
- **Centro Esportazione Report Unificato**: Raggruppare tutte le funzionalità di export (PDF/CSV/Excel) in un'unica vista "Centro Report", senza costringere l'utente a cercarle dentro le singole schede cliente.
- **Uniformazione Design Token**: Riconvertire gli stili inline di `analytics/page.tsx` con le classi standard Tailwind CSS e `glass-card`.

---

### Flusso 6: Notifications & Real-Time Sync (Notifiche e Sincronizzazione)

#### Ruoli Utente Coinvolti
- **Tutti i Ruoli Utente (Admin, Collaboratore, Cliente, Guest)**: Ricezione avvisi in tempo reale per task assegnate, menzioni, approvazioni, rifiuti di task, messaggi chat e aggiornamenti di sistema.

#### Obiettivo Operativo
Garantire consapevolezza operativa istantanea tramite feed notifiche, avvisi audio contestuali, notifiche push del browser e badge visivi di conteggio non letti.

#### Passaggi & Click Richiesti (Mapping Step-by-Step)
1. **Indicatore Notifiche in Header**: L'icona a forma di cassetta postale/cuore nell'Header mostra il badge rosso pulsante con il numero di notifiche non lette (es. "3").
2. **Apertura Centro Notifiche**: 1 click sull'icona delle notifiche nell'Header -> Apre il pannello laterale `NotificationCenter` (`components/notification-center.tsx`).
3. **Filtro Notifiche per Categoria**: 1 click sulle tab (Tutte, Non Lette, Task, Progetti, Sistema).
4. **Azione su Singola Notifica**:
   - Click sulla notifica: 1 click -> Segna la notifica come letta e reindirizza alla rotta di destinazione (`notification.link`).
5. **Gestione Massiva**:
   - Click "Segna tutte come lette": 1 click.
   - Click "Elimina lette": 1 click.

#### Ridondanze e Punti di Frizione
- **Eccesso di Listener Firestore Real-Time Globali**: `LayoutDataProvider` (`app/(app)/layout-context.tsx`) attiva all'avvio dell'applicazione oltre 12 listener `onSnapshot` simultanei su **intere collezioni Firestore** (`users`, `clients`, `projects`, `tasks`, `absences`, `activityTypes`, `calendarActivities`, `calendarActivityPresets`, `briefServices`, `briefServiceCategories`, `serviceContracts`, `rolePermissions`). Questo provoca un consumo elevato di banda e re-render superflui di tutti i componenti dell'app ad ogni minima modifica.
- **Rotte Legacy nei Link Notifiche**: Alcuni link di notifica salvati nel database contengono il prefisso legacy `/app/...`, rendendo necessaria una correzione stringa in fase di click (`notification.link.replace(/^\/app/, '')`) sia in `header.tsx` che in `notification-center.tsx`.
- **Sovrapposizione Visiva sul Viewport**: La parte inferiore/destra dello schermo risulta affollata da elementi sovrapposti: `FloatingCommandDock`, Widget Pomodoro, notifica Toast Sonner e popup per gli easter egg o citazioni motivazionali.

#### Componenti & File Coinvolti
- `app/(app)/layout-context.tsx` (Linee 316-415 per i listener `onSnapshot` Firestore)
- `components/header.tsx` (Linee 203-233 per Notifiche e Badge)
- `components/notification-center.tsx` (Pannello gestione notifiche)
- `lib/sounds.ts` e `lib/push-notifications.ts`

#### Raccomandazioni UX
- **Ottimizzazione Listener Real-Time**: Limitare i listener `onSnapshot` globali solo alle collezioni essenziali (es. notifiche utente e chat) e caricare le altre collezioni (`tasks`, `projects`, `clients`) on-demand o con paginazione/query filtrate per ruolo.
- **Normalizzazione URL Notifiche**: Assicurare in fase di scrittura su Firestore che i link inseriti siano già puliti senza prefissi `/app/`.
- **Z-Index & Layout Docking Manager**: Definire livelli di `z-index` e posizionamenti rigidi per evitare che il timer Pomodoro nasconda il pulsante del menu flotante o i messaggi toast.

---

## 3. Matrice Comparativa dei Ruoli Utente & Permessi

| Flusso Operativo | Amministratore (Admin) | Collaboratore | Cliente (Client) | Guest |
| :--- | :--- | :--- | :--- | :--- |
| **1. Task Management** | Creazione, assegnazione, approvazione 1/2 step, eliminazione full | Visualizzazione proprie task, avvio timer, invio in approvazione | Approvazione task `In Approvazione Cliente` | Vista sintetica via link pubblico |
| **2. Piano Editoriale** | Gestione completa, export CSV, invio a Zapier/Buffer | Stesura copy, caricamento media, cambio stato ad "In Approvazione" | Approvazione/rifiuto post con note | Vista sola lettura su link condiviso |
| **3. Strategie Marketing** | Generazione AI, modifica KPI, conversione roadmap | Consultazione pilastri e task | Approvazione o richiesta modifiche | Vista pubblicazione condivisa |
| **4. Onboarding Cliente** | Registrazione clienti, setup token API, gestione permessi | Accesso alla scheda 360° e Brand Kit | Accesso alla propria dashboard riservata | Vista via token pubblico |
| **5. Analytics & Report** | Accesso completo a margini, costi orari e reportistica | Vista personalizzata su ore e carico lavoro | Report mensile riassuntivo PDF | N/A |
| **6. Notifiche Real-Time** | Ricezione avvisi su tutte le attività e approvazioni pendenti | Ricezione avvisi su task assegnate e menzioni | Notifiche su contenuti in attesa di approvazione | N/A |

---

## 4. Sintesi dei File e Componenti Critici da Ottimizzare

1. **`app/(app)/clients/page.tsx` (Linea 71)**:  
   *Problema*: Link a `/clients/new` inesistente (Errore 404).  
   *Azione*: Sostituire con modal di creazione cliente o implementare la rotta `/clients/new`.

2. **`app/(app)/tasks/tasks-content.tsx` (2.496 righe)**:  
   *Problema*: Componente monolitico con troppi re-render e doppia conferma per invio/approvazione task.  
   *Azione*: Refactoring in moduli separati ed eliminazione dei dialog di conferma non necessari.

3. **`app/(app)/editorial-plan/client.tsx` (2.100+ righe)**:  
   *Problema*: Gestione stato monolitica; mancanza di vista pubblica di approvazione 1-click per i post del cliente.  
   *Azione*: Creare la rotta `/share/editorial-plan/[token]` per l'approvazione esterna del cliente.

4. **`app/(app)/clients/[id]/page.tsx` (2.734 righe)**:  
   *Problema*: Scheda cliente con 15+ sub-tab senza raggruppamento logico.  
   *Azione*: Raggruppare le schede in 4 macro-sezioni principali.

5. **`app/(app)/layout-context.tsx` (Linee 316-415)**:  
   *Problema*: 12+ listener `onSnapshot` Firestore aperti contemporaneamente su intere collezioni.  
   *Azione*: Query paginate e filtrate in base all'utente attivo.

6. **`app/(app)/analytics/page.tsx`**:  
   *Problema*: Stili CSS inline non coerenti con Tailwind CSS; mancanza di un selettore intervallo date libero.  
   *Azione*: Uniformare la grafica ai token di sistema e inserire il `DateRangePicker`.

---

## 5. Piano di Azione Consigliato per le Prossime Milestone

1. **Priorità 1 (Bug Fix Immediati)**: Ripristinare il corretto funzionamento del pulsante "Aggiungi cliente" su `/clients` rimuovendo il link 404 e introducendo la modal di onboarding.
2. **Priorità 2 (Riduzione Click & Friction)**: Introdurre la funzione di Quick-Approval a 1-Click nelle task e l'approvazione pubblica senza login dei post nel Piano Editoriale.
3. **Priorità 3 (Integrazione Flussi)**: Creare l'azione "Converti Strategia in Task/Piano Editoriale" per colmare il gap tra la generazione della strategia AI e l'operatività quotidiana.
4. **Priorità 4 (Refactoring & Performance)**: Modulorizzare i file monolitici (`tasks-content.tsx`, `editorial-plan/client.tsx`, `clients/[id]/page.tsx`) e ottimizzare le query Firestore real-time.
