/**
 * lib/server-notify.ts
 *
 * Notifiche in app scritte dal server (Admin SDK) per gli utenti indicati. Un errore qui non deve mai far fallire
 * l'azione che l'ha generata: si registra e si va avanti.
 */
import { adminDb } from '@/lib/firebase-admin';
import type { NotificationType } from '@/lib/data';

export interface ServerNotification {
    title: string;
    text: string;
    type: NotificationType;
    category: 'task' | 'project' | 'absence' | 'chat' | 'brief' | 'editorial' | 'calendar' | 'system';
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    link?: string;
    resourceId?: string;
    resourceType?: string;
}

export async function notifyUsers(userIds: Iterable<string>, n: ServerNotification): Promise<void> {
    try {
        const ids = Array.from(new Set(Array.from(userIds).filter(Boolean)));
        const timestamp = new Date().toISOString();
        await Promise.all(ids.map((userId) => adminDb.collection('users').doc(userId).collection('notifications').add({
            userId, ...n, priority: n.priority || 'normal', isRead: false, timestamp,
        })));
    } catch (error) {
        console.error('[server-notify]', error);
    }
}

/** Gli utenti con ruolo Cliente di un cliente (chi può approvare il suo PED). */
export async function clientUserIds(clientId: string): Promise<string[]> {
    const snap = await adminDb.collection('users').where('clientId', '==', clientId).get();
    return snap.docs.filter((d) => d.data().role === 'Cliente').map((d) => d.id);
}
