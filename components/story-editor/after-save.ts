/**
 * components/story-editor/after-save.ts
 *
 * Dopo il salvataggio di una storia: chiede l'approvazione al cliente o la dà subito (solo chi ne ha il permesso), con la
 * stessa route del PED. La chiamata è passata da fuori (`post`) così si collauda senza rete.
 */
import type { AfterSave } from '@/lib/story-editor/schedule';

export interface AfterSaveResult { level: 'success' | 'warning' | 'error'; message: string; shareUrl?: string }

export async function runAfterSave(args: {
    clientId: string;
    contentId: string;
    mode: AfterSave;
    post: (url: string, init: { method: 'POST'; body: string }) => Promise<Response>;
}): Promise<AfterSaveResult | null> {
    const { clientId, contentId, mode, post } = args;
    if (mode === 'draft') return null;
    try {
        const res = await post(`/api/clients/${clientId}/editorial-approval`, { method: 'POST', body: JSON.stringify({ contentIds: [contentId], bypass: mode === 'approve' }) });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok) return { level: 'error', message: `Salvata come bozza, ma ${mode === 'approve' ? 'l\'approvazione' : 'la richiesta al cliente'} non è andata a buon fine: ${data.error || `errore ${res.status}`}.` };
        if (Array.isArray(data.skipped) && data.skipped.length > 0) return { level: 'warning', message: `Salvata, ma non inviata: ${data.skipped[0].reason}.` };
        if (mode === 'approve') return { level: 'success', message: 'Salvata e approvata: esce da sola alla data scelta.' };
        if (data.shareUrl) return { level: 'success', message: 'Salvata e in attesa del cliente. Link di approvazione copiato negli appunti.', shareUrl: data.shareUrl };
        return { level: 'warning', message: 'Salvata e segnata in attesa, ma il cliente non ha ancora un link pubblico: generalo dalla sua scheda.' };
    } catch (e: any) {
        return { level: 'error', message: `Salvata come bozza, ma non sono riuscito a contattare il server: ${e?.message || 'errore di rete'}.` };
    }
}
