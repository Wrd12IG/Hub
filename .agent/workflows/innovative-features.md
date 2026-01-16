---
description: Piano implementazione funzionalità innovative per W[r]Digital Hub
---

# Piano Implementazione Funzionalità Innovative

## 1. Dashboard Personalizzabile (Widget-Based)

### Stato Attuale
- Esiste già `user-dashboard.tsx` con widget configurabili tramite localStorage
- L'admin può configurare `visibleDashboardWidgets` per ogni utente in `admin-user-widgets`
- I widget disponibili sono definiti in un array `WIDGETS`

### Miglioramenti Proposti
1. **Nuovi Widget da Aggiungere:**
   - `kpi_hours_this_week` - Ore lavorate questa settimana
   - `kpi_efficiency` - Rapporto ore stimate/effettive
   - `widget_recent_clients` - Clienti a cui si sta lavorando recentemente
   - `widget_team_workload` - Carico di lavoro del team (per PM/Admin)
   - `widget_quick_actions` - Azioni rapide (nuovo task, registra tempo, ecc.)
   - `widget_notifications_summary` - Riepilogo notifiche recenti

2. **Drag & Drop Reordering:**
   - Permettere agli utenti di riordinare i widget
   - Salvare l'ordine in localStorage

3. **Widget Ridimensionabili:**
   - Small, Medium, Large layouts per alcuni widget

---

## 2. Time Tracking Automatico con IA

### Stato Attuale
- `TaskPrioritySettings` definisce giorni automatici per priorità:
  - Critica: 1 giorno
  - Alta: 3 giorni
  - Media: 7 giorni
  - Bassa: 14 giorni
- Ogni task ha `estimatedDuration` e `timeSpent`

### Miglioramenti Proposti
1. **Suggerimento Tempo Stimato Automatico:**
   - Quando si crea un task, basandosi su:
     - Tipo di attività (`activityType`)
     - Cliente
     - Task storici simili (stesso tipo, stesso cliente)
   - Mostrare "Tempo suggerito: X ore" nel form di creazione task

2. **Scadenza Automatica Basata su Priorità:**
   - Se non viene specificata una scadenza, calcolarla automaticamente usando `TaskPrioritySettings`
   - Checkbox "Usa scadenza automatica" nel task form

3. **Alert Tempo Superato:**
   - Notifica quando il tempo effettivo supera il 80% del tempo stimato
   - Badge visivo sul task quando supera il 100%

4. **Analytics Tempo:**
   - Metriche per utente: media tempo per tipo attività
   - Confronto stime vs effettivo per migliorare le previsioni future

---

## 3. Sistema di Template per Task/Progetti

### Stato Attuale
- Esistono già `RecurringProject` e `TaskTemplate` nel modello dati
- I template di task sono usati nei progetti ricorrenti

### Miglioramenti Proposti
1. **Template di Task Standalone:**
   - Nuova entità `TaskTemplateStandalone`:
     ```typescript
     interface TaskTemplateStandalone {
       id: string;
       name: string;
       description?: string;
       category?: string; // Es: "Social Media", "Design", "Development"
       tasks: TaskTemplate[];
       createdBy: string;
       isPublic: boolean; // Disponibile a tutto il team
     }
     ```

2. **Creazione Template da Task Esistente:**
   - Pulsante "Salva come Template" nel menu task
   - Possibilità di includere subtask

3. **UI Template Picker:**
   - Nel form di creazione task/progetto, dropdown "Usa Template"
   - Anteprima del template prima dell'applicazione
   - Possibilità di modificare prima di applicare

4. **Template Default per Cliente:**
   - Associare template a specifici clienti
   - Quando si crea un task per quel cliente, suggerire i template associati

---

## Ordine di Implementazione

### Fase 1: Time Tracking Automatico (più semplice)
1. Aggiungere logica suggerimento tempo nel task-form
2. Implementare scadenza automatica basata su priorità
3. Aggiungere badge tempo superato nella task card

### Fase 2: Dashboard Personalizzabile
1. Aggiungere nuovi widget
2. Implementare drag & drop con `@dnd-kit`
3. Salvare ordine widget

### Fase 3: Sistema Template
1. Creare schema e actions per template standalone
2. UI per gestione template in admin
3. Picker template nel task/project form
