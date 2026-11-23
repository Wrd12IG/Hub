/**
 * lib/publish-notify.ts
 *
 * Manda gli avvisi sulla pubblicazione (notifica in app a amministratori e responsabili del cliente). Solo server.
 * Un errore qui non deve mai far fallire la pubblicazione: si registra e si va avanti.
 */
import { adminDb } from '@/lib/firebase-admin';
import { notifyUsers } from '@/lib/server-notify';
import { CHANNEL_LABEL } from '@/lib/content-approval';
import type { BlockedAlert, FailureAlert } from '@/lib/publish-alerts';

async function recipients(clientId?: string): Promise<string[]> {
    const ids = new Set<string>();
    const admins = await adminDb.collection('users').where('role', '==', 'Amministratore').get();
    for (const d of admins.docs) if (d.get('status') !== 'Inattivo') ids.add(d.id);
    if (clientId) {
        const c = await adminDb.collection('clients').doc(clientId).get();
        for (const id of (c.get('managedBy') as string[] | undefined) || []) ids.add(id);
        const sm = c.get('socialManagerId') as string | undefined;
        if (sm) ids.add(sm);
    }
    return Array.from(ids);
}

export async function sendFailureAlerts(alerts: FailureAlert[]): Promise<number> {
    let sent = 0;
    for (const a of alerts) {
        try {
            await notifyUsers(await recipients(a.clientId), {
                title: '❌ Pubblicazione non riuscita',
                text: `Il post "${a.topic}" di ${a.clientName} non è uscito su ${CHANNEL_LABEL[a.channel] || a.channel}: ${a.detail}`,
                type: 'editorial_publish_failed', category: 'editorial', priority: 'urgent',
                link: a.clientId ? `/clients/${a.clientId}/editorial-plan` : '/editorial-plan',
                resourceId: a.contentId, resourceType: 'editorial_content',
            });
            sent++;
        } catch (e) { console.error('[publish-notify] errore', e); }
    }
    return sent;
}

export async function sendBlockedAlerts(alerts: BlockedAlert[], now: Date): Promise<number> {
    let sent = 0;
    for (const a of alerts) {
        try {
            const client = await adminDb.collection('clients').doc(a.clientId).get();
            await notifyUsers(await recipients(a.clientId), {
                title: '⏸️ Post fermo prima di uscire',
                text: `Il post "${a.topic}" di ${String(client.get('name') ?? 'cliente')} doveva uscire ma ${a.message}.`,
                type: 'editorial_publish_blocked', category: 'editorial', priority: 'high',
                link: `/clients/${a.clientId}/editorial-plan`, resourceId: a.contentId, resourceType: 'editorial_content',
            });
            // Si ricorda il motivo: lo stesso avviso non si ripete ad ogni giro della cron
            await adminDb.collection('editorialContents').doc(a.contentId).update({ publishAlert: { kind: a.reason, at: now.toISOString() } });
            sent++;
        } catch (e) { console.error('[publish-notify] errore', e); }
    }
    return sent;
}
