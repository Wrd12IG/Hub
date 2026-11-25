/**
 * lib/roles.ts
 *
 * Il modello dei ruoli dell'Hub, in un posto solo. Definizione e motivi: docs/ruoli.md. Pura (nessun I/O).
 *
 * Un ruolo è un elenco di CAPACITÀ (cosa si può fare). Quasi tutte valgono solo sui clienti ASSEGNATI alla persona
 * (responsabili, social manager, PM di backup: stessa regola della scheda cliente); l'Amministratore le ha su tutti.
 *
 * Regole che non si scavalcano:
 *  - un ruolo sconosciuto, mancante o un utente inattivo NON ha nessuna capacità (si nega, non si presume «staff»);
 *  - i ruoli aggiuntivi (`extraRoles`) sommano le capacità, ma non possono mai essere Amministratore né Cliente;
 *  - un utente Cliente non ottiene mai capacità dello staff, qualunque cosa ci sia in `extraRoles`;
 *  - budget e costi (`economics.view`) li ha l'Amministratore; gli altri solo se il ruolo ha la spunta «Visualizza Budget e Costi».
 *
 * Stato: R1 del piano. Non è ancora collegato a nessuna pagina né API: per ora non cambia nulla per nessuno.
 */
import { assigneeIds } from './client-scheda/access';
import type { ClientAssignees } from './client-scheda/types';

// ─── Ruoli ───────────────────────────────────────────────────────────────────

/** Ruoli dello staff, Amministratore compreso. L'ordine è quello mostrato nelle schermate. */
export const STAFF_ROLES = [
    'Amministratore',
    'Project Manager',
    'Social Media Manager',
    'Grafico',
    'Copywriter',
    'Ads Specialist',
    'Collaboratore',
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const CLIENT_ROLE = 'Cliente' as const;

/**
 * Livelli dell'accesso Cliente. `referente` approva e invia brief; `lettore` vede solo i risultati.
 * (Non confonderlo con il «referente» dello staff in lib/assignments: quello è la persona dell'agenzia che segue il cliente.)
 */
export const PORTAL_LEVELS = ['referente', 'lettore'] as const;
export type PortalLevel = (typeof PORTAL_LEVELS)[number];

/** Livello degli utenti cliente che ne sono privi: tutti gli accessi esistenti oggi fanno quello che farebbe un referente. */
export const DEFAULT_PORTAL_LEVEL: PortalLevel = 'referente';

// ─── Capacità ────────────────────────────────────────────────────────────────

export const CAPABILITIES = [
    // Per tutto lo staff
    'workspace.basic',        // chat, calendario, assenze
    'results.view',           // risultati dei clienti assegnati
    'reports.ownHours',       // le proprie ore e i propri costi
    // Task
    'tasks.viewOwn',
    'tasks.createOwn',
    'tasks.viewClient',       // tutti i task dei clienti assegnati
    'tasks.assign',
    'tasks.approve',
    // Brief
    'briefs.viewLinked',      // solo i brief collegati a un proprio task
    'briefs.view',
    'briefs.manage',          // cambiare stato, creare il progetto
    // Piano editoriale
    'editorial.view',
    'editorial.editAll',
    'editorial.editMedia',
    'editorial.editCopy',
    'editorial.editAssigned', // solo i contenuti assegnati a sé
    'editorial.generate',     // «Genera con AI» e «Importa»
    'editorial.requestApproval',
    'social.publish',         // pubblicare e collegare gli account social
    // Campagne
    'ads.view',
    'ads.approve',
    'ads.manage',
    // Report
    'reports.teamHours',
    'reports.clients',        // Andamento clienti, KPI concessionari, Mail mensile
    // Riservate
    'economics.view',         // budget, costi, redditività
    'admin.manage',           // utenti, ruoli, permessi, impostazioni
    // Accesso Cliente
    'portal.results',
    'portal.approve',
    'portal.brief',
    'portal.notifications',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const STAFF_BASE: Capability[] = ['workspace.basic', 'results.view', 'reports.ownHours', 'tasks.viewOwn', 'tasks.createOwn', 'briefs.viewLinked', 'editorial.view'];

const ALL_STAFF_CAPABILITIES = CAPABILITIES.filter((c) => !c.startsWith('portal.'));

/** Cosa dà ogni ruolo. La tabella leggibile è in docs/ruoli.md; il test la tiene allineata a questa. */
export const ROLE_CAPABILITIES: Record<StaffRole, readonly Capability[]> = {
    Amministratore: ALL_STAFF_CAPABILITIES,
    'Project Manager': [
        ...STAFF_BASE,
        'tasks.viewClient', 'tasks.assign', 'tasks.approve',
        'briefs.view', 'briefs.manage',
        'editorial.editAll', 'editorial.generate', 'editorial.requestApproval', 'social.publish',
        'ads.view', 'ads.approve',
        'reports.teamHours', 'reports.clients',
    ],
    'Social Media Manager': [
        ...STAFF_BASE,
        'briefs.view',
        'editorial.editAll', 'editorial.generate', 'editorial.requestApproval', 'social.publish',
        'ads.view',
    ],
    Grafico: [...STAFF_BASE, 'editorial.editMedia'],
    Copywriter: [...STAFF_BASE, 'editorial.editCopy', 'editorial.generate'],
    'Ads Specialist': [...STAFF_BASE, 'ads.view', 'ads.manage'],
    Collaboratore: [...STAFF_BASE, 'editorial.editAssigned'],
};

export const PORTAL_CAPABILITIES: Record<PortalLevel, readonly Capability[]> = {
    referente: ['portal.results', 'portal.approve', 'portal.brief', 'portal.notifications'],
    lettore: ['portal.results'],
};

/** Capacità che non riguardano un cliente in particolare: non serve (né ha senso) indicarlo. */
const NOT_CLIENT_SCOPED: ReadonlySet<Capability> = new Set<Capability>([
    'workspace.basic', 'reports.ownHours', 'tasks.viewOwn', 'tasks.createOwn', 'admin.manage',
]);

// ─── Utenti ──────────────────────────────────────────────────────────────────

export interface RoleUser {
    id: string;
    role?: string | null;
    /** Mansioni in più oltre a quella principale. Mai Amministratore né Cliente. */
    extraRoles?: readonly string[] | null;
    status?: string | null;
    /** Solo per il ruolo Cliente: il cliente a cui appartiene. */
    clientId?: string | null;
    /** Solo per il ruolo Cliente. Assente = referente. */
    portalLevel?: string | null;
}

export const isStaffRole = (role: unknown): role is StaffRole => typeof role === 'string' && (STAFF_ROLES as readonly string[]).includes(role);
export const isPortalLevel = (level: unknown): level is PortalLevel => typeof level === 'string' && (PORTAL_LEVELS as readonly string[]).includes(level);

const isActive = (u: RoleUser | null | undefined): u is RoleUser => !!u && u.status !== 'Inattivo';

/** Le mansioni valide di un utente dello staff: la principale più quelle aggiuntive (senza doppioni e senza Amministratore). */
export function staffRolesOf(user: RoleUser | null | undefined): StaffRole[] {
    if (!isActive(user) || !isStaffRole(user.role)) return [];
    const extra = (user.extraRoles ?? []).filter((r): r is StaffRole => isStaffRole(r) && r !== 'Amministratore');
    return Array.from(new Set<StaffRole>([user.role, ...extra]));
}

export function isAdminUser(user: RoleUser | null | undefined): boolean {
    return isActive(user) && user.role === 'Amministratore';
}

/** Utente dello staff, attivo e con un ruolo che esiste. Un ruolo mancante o sconosciuto NON è staff. */
export function isStaffUser(user: RoleUser | null | undefined): boolean {
    return staffRolesOf(user).length > 0;
}

export function isPortalUser(user: RoleUser | null | undefined): boolean {
    return isActive(user) && user.role === CLIENT_ROLE && !!user.clientId;
}

/** Il livello effettivo di un utente cliente. Un valore sconosciuto vale `lettore`: nel dubbio, il meno. */
export function portalLevelOf(user: RoleUser): PortalLevel {
    if (user.portalLevel === undefined || user.portalLevel === null) return DEFAULT_PORTAL_LEVEL;
    return isPortalLevel(user.portalLevel) ? user.portalLevel : 'lettore';
}

// ─── Verifiche ───────────────────────────────────────────────────────────────

export interface CapabilityOptions {
    /** Il ruolo ha la spunta «Visualizza Budget e Costi» (rolePermissions → `_view-financials`). Vale solo per lo staff. */
    financialsGranted?: boolean;
}

/**
 * L'utente HA la capacità, indipendentemente dal cliente? Serve a decidere cosa mostrare (voci di menu, pulsanti).
 * Non basta per consentire un'azione su un cliente: per quello c'è `can`.
 */
export function hasCapability(user: RoleUser | null | undefined, capability: Capability, opts: CapabilityOptions = {}): boolean {
    if (!isActive(user)) return false;

    if (user.role === CLIENT_ROLE) {
        // Un utente cliente ha solo le capacità del suo livello, e solo se è legato a un cliente.
        if (!user.clientId) return false;
        return PORTAL_CAPABILITIES[portalLevelOf(user)].includes(capability);
    }

    const roles = staffRolesOf(user);
    if (roles.length === 0) return false;
    if (capability === 'economics.view') return roles.includes('Amministratore') || opts.financialsGranted === true;
    return roles.some((r) => ROLE_CAPABILITIES[r].includes(capability));
}

/** Il cliente su cui si agisce: gli ids degli assegnati (staff) e il suo id (accesso Cliente). */
export type ClientRef = ClientAssignees & { id: string };

/**
 * L'utente può usare la capacità su QUESTO cliente?
 *  - Amministratore: su tutti;
 *  - altri dello staff: solo sui clienti in cui è assegnato;
 *  - utente Cliente: solo sul proprio;
 *  - capacità non legate a un cliente (le proprie ore, la chat…): `client` si ignora.
 * Senza `client`, una capacità legata ai clienti si nega: meglio un rifiuto di troppo che un accesso di troppo.
 */
export function can(user: RoleUser | null | undefined, capability: Capability, client?: ClientRef | null, opts: CapabilityOptions = {}): boolean {
    if (!hasCapability(user, capability, opts)) return false;
    if (NOT_CLIENT_SCOPED.has(capability)) return true;
    if (!client) return false;

    if (user!.role === CLIENT_ROLE) return !!user!.clientId && user!.clientId === client.id;
    if (isAdminUser(user)) return true;
    return assigneeIds(client).includes(user!.id);
}
