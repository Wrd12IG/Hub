/**
 * lib/publish-alerts.ts
 *
 * Quando avvisare di un problema nella pubblicazione. Funzioni pure: chi chiama manda le notifiche.
 *  - «fallito»: un canale è fallito per l'ultima volta (finiti i tentativi della cron) o per un tentativo a mano.
 *  - «fermo»: la data è arrivata ma il contenuto non può uscire perché manca l'approvazione o è stato modificato dopo.
 */
import { MAX_ATTEMPTS } from './publisher';
import { approvalGate } from './content-approval';
import { scheduledInstant, MAX_OVERDUE_MS } from './publisher';
import type { EditorialContent } from './data';
import { needsBusinessSuite } from './story-editor/business-suite';

export interface OutcomeLike {
    contentId: string; topic?: string; clientId?: string; clientName?: string; channel: string; result: string; attempts?: number;
}

export interface FailureAlert { contentId: string; clientId?: string; clientName: string; topic: string; channel: string; detail: string }

/** Solo i fallimenti definitivi: la cron ritenta fino a MAX_ATTEMPTS volte e non si manda un avviso ad ogni tentativo. */
export function failureAlerts(outcomes: OutcomeLike[], manual = false): FailureAlert[] {
    return outcomes
        .filter((o) => o.result.startsWith('fallito') && (manual || (o.attempts ?? 0) >= MAX_ATTEMPTS))
        .map((o) => ({
            contentId: o.contentId, clientId: o.clientId, clientName: o.clientName || 'cliente', topic: o.topic || 'post',
            channel: o.channel, detail: o.result.replace(/^fallito:\s*/, '').slice(0, 300),
        }));
}

export interface BlockedAlert { contentId: string; clientId: string; topic: string; reason: 'no-approval' | 'changed-after-approval'; message: string }

/** Contenuti «Approvato» con la data arrivata (e non da più di 3 giorni) che NON escono per mancanza di approvazione vera. */
export function blockedByApproval(contents: EditorialContent[], now: Date): BlockedAlert[] {
    const out: BlockedAlert[] = [];
    for (const c of contents) {
        const gate = approvalGate(c);
        if (gate.ok || (gate.reason !== 'no-approval' && gate.reason !== 'changed-after-approval')) continue;
        const at = scheduledInstant(c.publicationDate);
        if (!at) continue;
        const late = now.getTime() - at.getTime();
        if (late < 0 || late > MAX_OVERDUE_MS) continue;
        // già avvisato per lo stesso motivo: non si ripete ogni 10 minuti
        if (c.publishAlert?.kind === gate.reason) continue;
        out.push({ contentId: c.id, clientId: c.clientId, topic: c.topic || 'post', reason: gate.reason, message: gate.message });
    }
    return out;
}

export interface SuiteAlert { contentId: string; clientId: string; topic: string; publicationDate?: string }

/** Promemoria in anticipo: oltre questa distanza dalla data non si avvisa ancora (la storia si programma più avanti). */
export const SUITE_REMINDER_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Storie Instagram con link sticker approvate davvero e non ancora programmate: non escono da sole (vedi
 * lib/story-editor/business-suite.ts), quindi si ricorda una volta a chi segue il cliente di programmarle in Business Suite,
 * a partire da una settimana prima della data e fino a quando il contenuto smette di essere pubblicabile.
 */
export function businessSuiteReminders(contents: EditorialContent[], now: Date): SuiteAlert[] {
    const out: SuiteAlert[] = [];
    for (const c of contents) {
        if (!needsBusinessSuite(c) || c.publishResults?.igStories?.status === 'published') continue;
        if (!approvalGate(c).ok) continue;
        const at = scheduledInstant(c.publicationDate);
        if (!at) continue;
        const delta = at.getTime() - now.getTime();
        if (delta > SUITE_REMINDER_AHEAD_MS || -delta > MAX_OVERDUE_MS) continue;
        if (c.publishAlert?.kind === 'business-suite') continue;
        out.push({ contentId: c.id, clientId: c.clientId, topic: c.topic || 'storia', publicationDate: c.publicationDate });
    }
    return out;
}
