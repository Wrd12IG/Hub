/**
 * lib/roles-guard.ts
 *
 * La decisione di accesso per le API, separata dalla lettura dei dati (che sta in lib/api-auth.ts). Pura (nessun I/O).
 *
 * Due modalità, scelte con la variabile d'ambiente ROLES_ENFORCEMENT:
 *  - «observe» (predefinita): il controllo per capacità e per clienti assegnati NON blocca; scrive nel log
 *    «sarebbe negato…» e lascia passare. Serve a vedere, con l'uso vero, chi verrebbe fermato prima di fermare nessuno
 *    (oggi tutto lo staff apre qualunque cliente, e alcuni clienti non hanno ancora un referente assegnato);
 *  - «enforce»: nega davvero. Da accendere solo dopo la prova con un account per ruolo (docs/ruoli.md, R6).
 */
import { can, hasCapability, isClientScoped, type Capability, type ClientRef, type RoleUser } from './roles';

export type EnforcementMode = 'observe' | 'enforce';

/** Qualunque valore diverso da «enforce» (o «1», «true») vale «observe»: nel dubbio non si blocca. */
export function enforcementMode(value: string | undefined | null): EnforcementMode {
    const v = (value || '').trim().toLowerCase();
    return v === 'enforce' || v === '1' || v === 'true' ? 'enforce' : 'observe';
}

export type DenialReason = 'no-user' | 'no-capability' | 'no-client' | 'not-assigned';

export interface AccessDecision { allowed: boolean; reason?: DenialReason }

export function decideAccess(input: { user: RoleUser | null | undefined; capability: Capability; client?: ClientRef | null; financialsGranted?: boolean }): AccessDecision {
    const { user, capability, client } = input;
    const opts = { financialsGranted: input.financialsGranted === true };
    if (!user) return { allowed: false, reason: 'no-user' };
    if (!hasCapability(user, capability, opts)) return { allowed: false, reason: 'no-capability' };
    if (isClientScoped(capability) && !client) return { allowed: false, reason: 'no-client' };
    return can(user, capability, client, opts) ? { allowed: true } : { allowed: false, reason: 'not-assigned' };
}

/** Si blocca solo se l'accesso è negato E si è in modalità «enforce». */
export const shouldBlock = (decision: AccessDecision, mode: EnforcementMode): boolean => !decision.allowed && mode === 'enforce';

const REASON_TEXT: Record<DenialReason, string> = {
    'no-user': 'utente non trovato',
    'no-capability': 'il ruolo non ha la capacità',
    'no-client': 'cliente non indicato o non trovato',
    'not-assigned': 'non è assegnato a questo cliente',
};

/** Riga di log: ruolo e capacità, mai nomi o email. */
export function describeDenial(mode: EnforcementMode, uid: string, role: string | null | undefined, capability: Capability, clientId: string | undefined, reason: DenialReason): string {
    const head = mode === 'enforce' ? 'NEGATO' : 'sarebbe negato (solo osservazione)';
    return `[roles] ${head}: uid=${uid} ruolo=${role ?? '-'} capacità=${capability} cliente=${clientId ?? '-'} — ${REASON_TEXT[reason]}`;
}
