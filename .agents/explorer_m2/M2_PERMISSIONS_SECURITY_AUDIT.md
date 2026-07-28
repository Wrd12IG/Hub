# M2 — Audit Architettura Permessi e Sicurezza dei Dati (R2)
**W[r]Digital Marketing HUB**
**Data Audit:** 28 Luglio 2026  
**Auditor:** Explorer 2 (Milestone 2)

---

## 1. Executive Summary & Audit Scope

L'obiettivo del presente audit è verificare l'architettura dei permessi basata sui ruoli (RBAC) e la sicurezza dei confini dei dati all'interno dell'applicazione W[r]Digital Marketing HUB per i quattro ruoli principali:
1. **Amministratore (Admin)** — Accesso completo e di gestione su tutta la piattaforma.
2. **Collaboratore (Collaborator / PM)** — Operatività su task, progetti, calendari e contenuti assegnati/rilevanti.
3. **Cliente (Client)** — Accesso limitato alla visione e approvazione delle risorse relative alla propria azienda/brand.
4. **Guest (Non autenticato)** — Nessun accesso consentito oltre alla pagina di login `/login`.

### Sintesi delle Criticità Riscontrate
- 🔴 **Assenza di Middleware e Route Guards Server-Side**: Non è presente un file `middleware.ts` a livello root. Le pagine riservate (es. `/admin`, `/admin/dashboard`, `/admin/recurring-projects`, `/admin/recurring-tasks`, `/clients`) sono prive di guardie di navigazione. Un utente autenticato con ruolo `Cliente` o `Collaboratore` può accedere a tali rotte digitando direttamente l'URL nel browser.
- 🔴 **Data Leakage Integrale via Real-time Listeners Firestore**: Il provider di contesto globale (`app/(app)/layout-context.tsx`) inizializza subscription `onSnapshot` su collezioni sensibili (`users`, `clients`, `projects`, `tasks`, `rolePermissions`, `serviceContracts`, ecc.) per **qualsiasi utente autenticato**. Dati riservati quali stipendi (`salary`), costi orari (`hourlyRate`), budget clienti e dati finanziari vengono scaricati integralmente nel browser di tutti gli utenti (inclusi i Clienti).
- 🔴 **Mancanza di File `firestore.rules` nel Repository**: Il codice sorgente non definisce né traccia le regole di sicurezza Firestore (è presente solo `firestore.indexes.json`). Se nel Firebase Console le regole sono impostate a `allow read, write: if request.auth != null;`, qualsiasi utente autenticato può leggere e modificare qualsiasi documento Firestore tramite client SDK (`lib/actions.ts`).
- 🟠 **Vulnerabilità ed Esposizione nelle API Route**: Diverse rotte API sotto `app/api/` (es. `app/api/clients/[id]/route.ts`, `app/api/publish-zapier/route.ts`) non eseguono controlli sul ruolo o sull'assegnazione al cliente. `app/api/publish-zapier/route.ts` non richiede neanche l'autenticazione Bearer token.
- 🟡 **Security through Obscurity per i Menu**: La Sidebar e il Command Dock nascondono gli elementi di navigazione in base ai permessi di ruolo, ma la protezione si limita all'interfaccia grafica senza alcun blocco a livello di pagina o di dati.

---

## 2. Role Permission Matrix Across Modules & Views

Di seguito la matrice effettiva dei permessi correntemente rilevata dall'analisi del codice (UI vs Accesso Reale ai Dati):

| Modulo / Vista | Admin (Reale) | PM / Collaboratore (UI) | PM / Collaboratore (Reale) | Cliente (UI) | Cliente (Reale) | Guest (Reale) |
|---|---|---|---|---|---|---|
| **`/login`** | Accessibile | Accessibile | Accessibile | Accessibile | Accessibile | Accessibile |
| **`/dashboard`** | Full | Visible | Full Data Access | Nascosto UI | Full Data Access | Redirezione `/login` |
| **`/admin`** | Full | Nascosto UI | **Accessibile (No Guard)** | Nascosto UI | **Accessibile (No Guard)** | Redirezione `/login` |
| **`/admin/dashboard`** | Full | Nascosto UI | **Accessibile (Data Leak)** | Nascosto UI | **Accessibile (Data Leak)** | Redirezione `/login` |
| **`/admin/recurring-projects`** | Full | Visible (se perm) | **Accessibile (No Guard)** | Nascosto UI | **Accessibile (No Guard)** | Redirezione `/login` |
| **`/admin/recurring-tasks`** | Full | Visible (se perm) | **Accessibile (No Guard)** | Nascosto UI | **Accessibile (No Guard)** | Redirezione `/login` |
| **`/clients`** | Full | Nascosto UI | **Accessibile (Data Leak)** | Nascosto UI | **Accessibile (All Clients)** | Redirezione `/login` |
| **`/clients/[id]`** | Full | Visible (Filtro UI) | **Accessibile (All Clients)** | Visible (Filtro UI) | **Accessibile (All Clients)** | Redirezione `/login` |
| **`/projects`** | Full | Visible (Filtro UI) | **Accessibile (All Proj in Memory)** | Nascosto UI | **Accessibile (All Proj in Memory)** | Redirezione `/login` |
| **`/tasks`** | Full | Visible (Filtro UI) | **Accessibile (All Tasks in Memory)** | Nascosto UI | **Accessibile (All Tasks in Memory)** | Redirezione `/login` |
| **`/calendar`** | Full | Visible | Accessibile | Nascosto UI | **Accessibile (Data Leak)** | Redirezione `/login` |
| **`/briefs`** | Full | Visible | Accessibile | Visible | Accessibile | Redirezione `/login` |
| **`/documents`** | Full | Visible | Accessibile | Visible | Accessibile | Redirezione `/login` |
| **`/reports`** | Full | Visible | Accessibile | Nascosto UI | **Accessibile (Data Leak)** | Redirezione `/login` |
| **`/chat`** | Full | Visible | Accessibile (Filtered by memberIds) | Nascosto UI | **Accessibile (Conversations)** | Redirezione `/login` |

*Legenda:*
- **Full**: Accesso completo consentito sia da UI che da logica dati.
- **Nascosto UI**: Elemento rimosso dal menu di navigazione (Sidebar/Dock).
- **Accessibile (No Guard)**: La rotta non verifica il ruolo dell'utente ed è accessibile inserendo l'URL.
- **Accessibile (Data Leak)**: I dati sottostanti sono scaricati in memoria client tramite `LayoutContext` a prescindere dal ruolo.

---

## 3. Detailed Audit Findings

### 3.1 Route & Page Level Permissions (Guardie di Rotta)

#### Osservazioni & Analisi del Codice:
1. **Assenza di Middleware globale**:
   - Nella radice del progetto `/Volumes/WEB_DEV/hub-wrdigital/hub-app/` non esiste il file `middleware.ts`.
   - Nessuna rotta beneficia di controlli preliminari lato edge/server prima del rendering.

2. **Layout Client (`app/(app)/layout.tsx`)**:
   - In `app/(app)/layout.tsx`, righe 38-42:
     ```tsx
     useEffect(() => {
       if (isMounted && !isLoadingLayout && !currentUser) {
         router.replace('/login');
       }
     }, [currentUser, isLoadingLayout, router, isMounted]);
     ```
   - *Verifica*: L'unico controllo presente in `layout.tsx` è l'autenticazione generica (`!currentUser`). Non viene effettuata alcuna verifica sul ruolo (`role`) né sui permessi per limitare l'accesso alle sotto-rotte.

3. **Rotta Amministrativa `/admin` (`app/(app)/admin/page.tsx`)**:
   - Nel file `app/(app)/admin/page.tsx`, non è presente alcun controllo sul ruolo dell'utente (`currentUser.role === 'Amministratore'`).
   - *Impatto*: Se un utente con ruolo `Cliente` o `Collaboratore` naviga su `http://localhost:3000/admin`, la pagina viene caricata completamente, mostrando le schede Utenti, Clienti, Permessi, Priorità, Reparti, Costi Aziendali e Automazioni.

4. **Dashboard Amministrativa `/admin/dashboard` (`app/(app)/admin/dashboard/page.tsx`)**:
   - Alle righe 301-304 il codice definisce:
     ```tsx
     const isAccessDenied = !isLoadingLayout && currentUser && currentUser.role !== 'Amministratore';
     ```
   - Tuttavia, il commento recita: *"NOTA: non usare early return qui — violerebbe le Rules of Hooks. Il check viene applicato nel JSX sottostante."*
   - *Verifica nel JSX*: Cercando `isAccessDenied` in tutto il file `app/(app)/admin/dashboard/page.tsx`, la variabile **non viene mai usata** per condizionare il rendering del JSX né per bloccare l'accesso.
   - *Impatto*: Un qualsiasi utente autenticato che naviga su `/admin/dashboard` può visualizzare tutti i grafici finanziari, costi mensili, redditività clienti, tassi di occupazione e tariffe orarie dell'intero team.

5. **Pagine Amministrative Ricorrenti (`/admin/recurring-projects`, `/admin/recurring-tasks`)**:
   - Sia in `app/(app)/admin/recurring-projects/page.tsx` sia in `app/(app)/admin/recurring-tasks/page.tsx`, non è presente alcuna guardia di rotto o controllo di ruolo al caricamento della pagina.

6. **Vista Elenco Clienti `/clients` (`app/(app)/clients/page.tsx`)**:
   - Non viene effettuato alcun controllo per verificare se l'utente sia un `Cliente`.
   - Se un utente `Cliente` inserisce `/clients` nell'URL, visualizza la griglia con tutti i clienti registrati nel sistema HUB.

7. **Pagina `/unauthorized` (`app/(app)/unauthorized/page.tsx`)**:
   - Il componente di errore 403 `UnauthorizedPage` esiste nel codebase, ma **nessuna rotta della piattaforma effettua mai un re-indirizzamento a `/unauthorized`**.

---

### 3.2 Navigation & Sidebar Permissions

#### Osservazioni & Analisi del Codice:
1. **Sidebar (`components/sidebar-nav.tsx`)**:
   - Le funzioni `visibleNavItems` (righe 187-219) e `visibleAdminItems` (righe 221-242) utilizzano l'helper `getRolePermissions` per filtrare gli elementi del menu in base ai permessi definiti nel DB per ciascun ruolo (`permissions`).
   - Per il ruolo `Cliente`, `visibleNavItems` restituisce unicamente `clientNavItems` (`/briefs`, `/documents`).
   - *Valutazione*: Il filtraggio della Sidebar funziona correttamente per scopi di usabilità visuale, ma costituisce una difesa puramente di facciata (*Security through Obscurity*), in quanto le pagine sottostanti rimangono direttamente accessibili via URL.

2. **Command Dock Fluttuante (`components/floating-command-dock.tsx`)**:
   - Alle righe 139-175, la lista degli strumenti e le azioni rapide (`visibleQuickActions`) vengono filtrate rispecchiando la logica della sidebar.
   - Valgono le medesime osservazioni: l'interfaccia nasconde i pulsanti, ma non protegge le risorse.

---

### 3.3 Action Components & Edit Forms (Pulsanti e Form di Azione)

#### Osservazioni & Analisi del Codice:
1. **Pannello Admin (`app/(app)/admin/page.tsx`)**:
   - Form e modali quali `Nuovo Utente`, `Modifica Utente`, `Elimina Utente`, `Pannello Permessi` e `Costi Aziendali` non verificano lato client se l'utente corrente è un Amministratore prima di abilitare l'invio del form.

2. **Card Progetto (`components/project-card.tsx`)**:
   - Alle righe 123-139, il menu a tendina `DropdownMenu` mostra per qualsiasi utente i comandi:
     - *Programma su Piano Editoriale*
     - *Modifica*
     - *Elimina* (se la prop `onDelete` è passata)
   - Un `Collaboratore` o `Cliente` che visualizza una `ProjectCard` vede i pulsanti per modificare o eliminare il progetto.

3. **Gestione Task e Progetti (`app/(app)/projects/projects-content.tsx` e `tasks-content.tsx`)**:
   - I form di creazione e modifica (`ProjectForm`, `TaskForm`) e i pulsanti di eliminazione (`confirmDelete`) dipendono da chiamate dirette al client SDK di Firestore (`deleteProject`, `deleteTask` in `lib/actions.ts`). Non viene verificata la proprietà del progetto o la qualifica di Admin/PM prima di scatenare l'azione.

---

### 3.4 Data Fetching & Firestore Query Security

#### Osservazioni & Analisi del Codice:
1. **Over-fetching Globale e Leakage Dati in `LayoutContext` (`app/(app)/layout-context.tsx`)**:
   - Alle righe 319-346, l'effetto primario di `LayoutDataProvider` sottoscrive listener in tempo reale (`onSnapshot`) su **12 collezioni Firestore dell'intera applicazione**:
     ```tsx
     const collectionsToListen = [
       { name: 'users', setter: setUsers },
       { name: 'clients', setter: setClients },
       { name: 'projects', setter: setAllProjects },
       { name: 'tasks', setter: setAllTasks },
       { name: 'absences', setter: setAbsences },
       { name: 'activityTypes', setter: setActivityTypes },
       { name: 'calendarActivities', setter: setCalendarActivities },
       { name: 'calendarActivityPresets', setter: setCalendarActivityPresets },
       { name: 'briefServices', setter: setBriefServices },
       { name: 'briefServiceCategories', setter: setBriefServiceCategories },
       { name: 'serviceContracts', setter: setServiceContracts },
       { name: 'rolePermissions', setter: ... },
     ];
     ```
   - *Impatto critico sulla privacy e riservatezza*:
     - **Tutti i dati dell'applicazione** (tutti i task di tutti i clienti, tutti i progetti, tutti i contratti, tutte le retribuzioni degli utenti `salary`, i costi orari `hourlyRate`, le note interne sui clienti) vengono caricati nello stato React del client **senza alcun filtro lato query o lato server**.
     - Il filtraggio avviene esclusivamente lato client nei singoli componenti (es. `filteredProjects` in `projects-content.tsx` righe 239-259).
     - Qualsiasi utente (compreso un `Cliente` esterno) può aprire i Developer Tools di Chrome o React DevTools e ispezionare il contesto `LayoutContext` per estrarre l'intero database di clienti, contratti, task, progetti e stipendi dei collaboratori.

2. **Mancanza di File `firestore.rules`**:
   - Nel repository è presente solo `firestore.indexes.json`. Non esiste alcun file `firestore.rules` né alcun test per le regole Firestore.
   - *Rischio*: Poiché i componenti client effettuano operazioni CRUD tramite `addDoc`, `updateDoc`, `deleteDoc` (in `lib/actions.ts`), l'integrità del database dipende al 100% dalle regole configurate manualmente nella console Firebase. In assenza di regole stringenti definite nel codice, il DB è vulnerabile a modifiche arbitrarie.

3. **Verifica delle API Route (`app/api/`)**:
   - **`app/api/clients/route.ts`**: Verifica l'autenticazione token (`verifyAuth`), ma non controlla il ruolo. Un `Cliente` può effettuare `GET /api/clients` e ottenere tutti i clienti.
   - **`app/api/clients/[id]/route.ts`**: Nessun controllo che l'utente autenticato appartenga al cliente `[id]`. Un `Cliente` può inviare `PATCH /api/clients/[id]` e aggiornare configurazioni aziendali.
   - **`app/api/publish-zapier/route.ts` (Vulnerabilità Critica)**:
     ```tsx
     export async function POST(request: Request) {
         try {
             const body = await request.json();
             const { contentId, type, clientId } = body;
             // Nessun controllo di autenticazione!
     ```
     La rotta `POST /api/publish-zapier` **non invoca `verifyAuth`**. Chiunque sul web invii una richiesta HTTP POST a questa rotta può forzare l'invio di contenuti editoriali a Zapier e cambiarne lo stato in `Pubblicato`.

---

## 4. Registry delle Criticità e Vulnerabilità Riscontrate

| ID | Modulo / File | Linee | Livello Rischio | Descrizione della Criticità |
|---|---|---|---|---|
| **SEC-01** | `app/(app)/layout-context.tsx` | 319-346 | 🔴 **CRITICO** | **Data Leakage Globale via `onSnapshot`**: Scaricamento di 12 collezioni complete nel client per tutti i ruoli, inclusi dati sensibili (`salary`, `hourlyRate`, contratti). |
| **SEC-02** | `app/api/publish-zapier/route.ts` | 4-12 | 🔴 **CRITICO** | **Endpoint API Non Autenticato**: Rotta pubblica senza `verifyAuth` che consente di pubblicare contenuti e modificarne lo stato. |
| **SEC-03** | `app/(app)/admin/page.tsx` | 207-208 | 🟠 **ALTO** | **Assenza Route Guard su `/admin`**: Nessuna verifica del ruolo `Amministratore` sul caricamento della pagina del pannello admin. |
| **SEC-04** | `app/(app)/admin/dashboard/page.tsx` | 301-305 | 🟠 **ALTO** | **Bypass Guardie su `/admin/dashboard`**: La variabile `isAccessDenied` viene calcolata ma mai applicata nel JSX, esponendo dati finanziari e KPI a qualsiasi utente. |
| **SEC-05** | Root Project | - | 🟠 **ALTO** | **Mancanza di Middleware Next.js**: Assenza di `middleware.ts` per la protezione server-side delle rotte amministrative e riservate. |
| **SEC-06** | Root Project | - | 🟠 **ALTO** | **Assenza di `firestore.rules`**: Nessuna traccia nel codice di regole di sicurezza per la protezione del database a livello di collezione/documento. |
| **SEC-07** | `app/api/clients/[id]/route.ts` | 6-12, 52-58 | 🟠 **ALTO** | **Mancanza di Isolation Tenant sulle API Clienti**: Le rotte `GET`, `PUT`, `PATCH`, `DELETE` per un cliente non verificano se l'utente richiedente è assegnato a quel `clientId`. |
| **SEC-08** | `app/(app)/clients/page.tsx` | 15-30 | 🟡 **MEDIO** | **Assenza filtro ruolo su `/clients`**: Pagina accessibile ai clienti esterni senza restrizione di ruolo. |
| **SEC-09** | `components/project-card.tsx` | 123-139 | 🟡 **MEDIO** | **Azioni non protette nell'UI**: I pulsanti Modifica/Elimina progetto sono visibili a tutti i ruoli indipendentemente dai permessi reali. |

---

## 5. Recommendations & Remediation Plan

### 5.1 Implementazione Middleware di Protezione Rotte (`middleware.ts`)
Creare un file `middleware.ts` nella radice dell'applicazione Next.js per intercettare tutte le richieste ed eseguire la verifica dei ruoli prima del rendering:

```typescript
// middleware.ts (Esempio raccomandato)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_ROUTES = ['/admin', '/admin/dashboard', '/admin/recurring-projects', '/admin/recurring-tasks'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('token')?.value; // o token di sessione/header

  // Se l'utente tenta di accedere a rotte admin ma non ha il ruolo opportuno
  if (ADMIN_ROUTES.some(route => pathname.startsWith(route))) {
    // Verifica ruolo tramite token/sessione
    // Se non autorizzato -> redirect ad /unauthorized
  }

  return NextResponse.next();
}
```

### 5.2 Ristrutturazione Firestore Data Access & Tenant Isolation
1. **Rimuovere la Subscription Globale in `LayoutContext`**:
   - Eliminare `onSnapshot(collection(db, 'users'))`, `onSnapshot(collection(db, 'clients'))`, ecc. dal provider di layout principale per gli utenti non-admin.
   - Sostituire con query filtrate per tenant/ruolo:
     - Per il ruolo `Cliente`: caricare solo `collection('clients').doc(user.clientId)` e i task/progetti con `where('clientId', '==', user.clientId)`.
     - Per il ruolo `Collaboratore`: caricare solo i progetti ed i task dove `assignedUserId == user.id` o dove l'utente fa parte del team.
2. **Rimozione dei Campi Sensibili nelle Query Utente**:
   - Sanificare i dati utente prima di inviarli al client: i campi `salary` e `hourlyRate` devono essere accessibili esclusivamente agli Amministratori tramite chiamate server-side o API dedicate.

### 5.3 Definizione delle Firestore Security Rules (`firestore.rules`)
Aggiungere il file `firestore.rules` al repository per garantire che anche in caso di chiamate dirette dal SDK client, le operazioni vengano verificate dal motore Firebase:

```sublime-syntax
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return isAuthenticated() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Amministratore';
    }

    function isClientUser(clientId) {
      return isAuthenticated() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.clientId == clientId;
    }

    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    match /clients/{clientId} {
      allow read: if isAdmin() || isClientUser(clientId);
      allow write: if isAdmin();
    }

    match /tasks/{taskId} {
      allow read, write: if isAuthenticated(); // Rafforzare in base alla logica di assegnazione
    }
  }
}
```

### 5.4 Messa in Sicurezza delle API Route
1. **Aggiungere `verifyAuth` a `app/api/publish-zapier/route.ts`**:
   Rendere obbligatoria la verifica del token Bearer per prevenire chiamate non autorizzate dall'esterno.
2. **Tenant Isolation nelle API Clienti**:
   In `app/api/clients/[id]/route.ts`, verificare che se `user.role === 'Cliente'`, `user.clientId` corrisponda esattamente a `params.id`.

### 5.5 Applicazione Guardie sulle Pagine Admin
In `app/(app)/admin/page.tsx` e `app/(app)/admin/dashboard/page.tsx`, aggiungere un blocco immediato di re-indirizzamento:

```tsx
if (!isLoadingLayout && currentUser && currentUser.role !== 'Amministratore') {
  router.replace('/unauthorized');
  return null;
}
```

---
*Fine del Report di Audit M2.*
