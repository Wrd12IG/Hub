/**
 * lib/admin-permissions-model.ts
 *
 * Il modello della schermata Admin → Permessi: cosa si può spuntare, in quale gruppo sta, cosa fa davvero.
 * Le CHIAVI (gli indirizzi delle pagine e i nomi `_azione`) sono quelle già salvate in `rolePermissions`: non vanno cambiate.
 *
 * Cosa fanno oggi (verificato nel codice il 12/11/2026):
 *  - le spunte delle PAGINE decidono solo se la voce compare nel menu e nella barra in basso. Non bloccano l'indirizzo: le
 *    rotte dei report e le regole del database sono aperte a tutto lo staff;
 *  - quattro AZIONI sono lette dall'app: _create-task, _approve-tasks, _create-recurring-projects e _view-financials (budget e note riservate dei clienti: l'Amministratore le vede sempre);
 *  - il ruolo Cliente non passa da qui: vede un elenco fisso (risultati, PED e brief del proprio cliente).
 */
import { PAGES_ALWAYS_FOR_PM } from '@/lib/nav-permissions';

export type EditableRole = 'Project Manager' | 'Collaboratore';
export const EDITABLE_ROLES: EditableRole[] = ['Project Manager', 'Collaboratore'];

export interface PermissionItem { key: string; label: string; description: string }
export interface PermissionGroup { id: string; title: string; hint?: string; items: PermissionItem[] }

/** Pagine: la spunta mostra la voce nel menu. */
export const PAGE_GROUPS: PermissionGroup[] = [
    {
        id: 'clients',
        title: 'Clienti e report',
        hint: 'Chi ha «Clienti» apre la scheda e i report di TUTTI i clienti: oggi non si può limitare a singoli clienti o a singole persone.',
        items: [
            { key: '/clients', label: 'Clienti', description: 'Elenco dei clienti, scheda di ognuno e i suoi report (Meta Ads, Google Ads, GA4, SEO, social, piano editoriale).' },
            { key: '/reports', label: 'Report', description: 'I report generali dell\'agenzia.' },
        ],
    },
    {
        id: 'work',
        title: 'Lavoro quotidiano',
        items: [
            { key: '/dashboard', label: 'Dashboard', description: 'La panoramica con i widget personali.' },
            { key: '/tasks', label: 'Tasks', description: 'Le attività, proprie e del team.' },
            { key: '/projects', label: 'Progetti', description: 'I progetti dei clienti.' },
            { key: '/calendar', label: 'Calendario', description: 'Scadenze, riunioni e attività pianificate.' },
            { key: '/briefs', label: 'Brief', description: 'Le richieste dei clienti da trasformare in lavoro.' },
            { key: '/absences', label: 'Assenze', description: 'Ferie e permessi del team.' },
        ],
    },
    {
        id: 'content',
        title: 'Contenuti e comunicazione',
        items: [
            { key: '/editorial-plan', label: 'Piano Editoriale', description: 'Il PED di tutti i clienti.' },
            { key: '/social-strategies', label: 'Strategie Social', description: 'Le strategie social generate per i clienti.' },
            { key: '/chat', label: 'Chat', description: 'Le conversazioni interne.' },
            { key: '/documents', label: 'Documenti', description: 'File e media dei clienti.' },
        ],
    },
    {
        id: 'admin',
        title: 'Amministrazione',
        items: [
            { key: '/admin/recurring-tasks', label: 'Task Ricorrenti', description: 'Modelli di task che si ripetono.' },
            { key: '/admin/recurring-projects', label: 'Progetti Ricorrenti', description: 'Modelli di progetto che si ripetono.' },
            { key: '/admin', label: 'Pannello Admin', description: 'Utenti, clienti, permessi e impostazioni: da dare con cautela.' },
        ],
    },
];

/** Azioni che l'app legge davvero. */
export const ACTIVE_ACTIONS: PermissionItem[] = [
    { key: '_create-task', label: 'Crea Task', description: 'Permette di creare un nuovo task.' },
    { key: '_approve-tasks', label: 'Approva Task', description: 'Permette di approvare i task completati.' },
    { key: '_create-recurring-projects', label: 'Task e Progetti Ricorrenti', description: 'Mostra le voci Task Ricorrenti e Progetti Ricorrenti e permette di crearli.' },
    { key: '_view-financials', label: 'Visualizza Budget e Costi', description: 'Mostra budget e note riservate dei clienti (scheda Admin → Clienti, Redditività nella dashboard, scheda Finanza delle analisi). Senza la spunta restano nascosti anche al server. L\'Amministratore li vede sempre.' },
];

/**
 * Azioni che l'app NON legge: nessuna. _view-financials è attiva dal 12/11/2026 (era l'ultima ancora senza effetto).
 * Le altre cinque, che non avevano né effetto né motivo di averlo, sono state tolte lo stesso giorno:
 * _manage-users (gli utenti li gestiscono solo gli amministratori, per regole del database e per la pagina Admin),
 * _approve-absences (le assenze si approvano da sole), _manage-clients (si modificano da Admin → Clienti), _delete-task
 * (solo l'amministratore vede «Elimina») e _manage-editorial-plan (nessun PED in sola lettura richiesto).
 * Le chiavi già salvate nei ruoli restano nel database, ignorate: non serve ripulirle.
 */
export const INACTIVE_ACTIONS: PermissionItem[] = [];

export const ALL_PAGE_ITEMS: PermissionItem[] = PAGE_GROUPS.flatMap((g) => g.items);
export const ALL_ITEMS: PermissionItem[] = [...ALL_PAGE_ITEMS, ...ACTIVE_ACTIONS, ...INACTIVE_ACTIONS];

/** Per il Project Manager alcune pagine sono sempre attive (la casella è bloccata). */
export const isLockedOn = (role: EditableRole, key: string) => role === 'Project Manager' && PAGES_ALWAYS_FOR_PM.includes(key);

export type Permissions = Record<string, string[]>;

export const has = (perms: Permissions, role: string, key: string) => (perms[role] || []).includes(key);

/** Quante spunte sono cambiate rispetto a ciò che è salvato (somma su tutti i ruoli). */
export function changedCount(initial: Permissions, current: Permissions): number {
    const roles = new Set([...Object.keys(initial), ...Object.keys(current)]);
    let n = 0;
    roles.forEach((r) => {
        const a = new Set(initial[r] || []), b = new Set(current[r] || []);
        a.forEach((k) => { if (!b.has(k)) n++; });
        b.forEach((k) => { if (!a.has(k)) n++; });
    });
    return n;
}

/** Aggiunge o toglie una chiave senza doppioni e senza toccare gli altri ruoli. */
export function toggle(perms: Permissions, role: string, key: string, on: boolean): Permissions {
    const cur = perms[role] || [];
    const next = on ? (cur.includes(key) ? cur : [...cur, key]) : cur.filter((k) => k !== key);
    return { ...perms, [role]: next };
}
