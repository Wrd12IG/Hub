// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { blockedByApproval, failureAlerts } from '@/lib/publish-alerts';
import { contentFingerprint } from '@/lib/content-approval';
import { MAX_ATTEMPTS } from '@/lib/publisher';
import type { EditorialContent } from '@/lib/data';

const NOW = new Date('2026-12-10T10:00:00Z');
const c = (o: Partial<EditorialContent> = {}): EditorialContent => ({
    id: 'c1', topic: 'Open day', clientId: 'cl', format: 'Post', status: 'Approvato', publicationDate: '2026-12-10',
    facebook: false, instagram: true, linkedin: false, tiktok: false, youtube: false, gbp: false, copy: 'Ciao', ...o,
});

describe('avvisi di fallimento', () => {
    const o = (over: object) => ({ contentId: 'c1', topic: 'Open day', clientId: 'cl', clientName: 'Acme', channel: 'instagram', result: 'fallito: Media ID is not available', ...over });
    it('si avvisa solo a tentativi finiti, non ad ogni ritentativo della cron', () => {
        expect(failureAlerts([o({ attempts: 1 })])).toHaveLength(0);
        expect(failureAlerts([o({ attempts: MAX_ATTEMPTS - 1 })])).toHaveLength(0);
        const a = failureAlerts([o({ attempts: MAX_ATTEMPTS })]);
        expect(a).toHaveLength(1);
        expect(a[0]).toMatchObject({ clientName: 'Acme', channel: 'instagram', detail: 'Media ID is not available' });
    });
    it('un tentativo a mano fallito si segnala sempre; i riusciti e le simulazioni mai', () => {
        expect(failureAlerts([o({ attempts: 1 })], true)).toHaveLength(1);
        expect(failureAlerts([o({ result: 'pubblicato', attempts: 3 }), o({ result: 'uscirebbe su Acme: x' })], true)).toHaveLength(0);
    });
});

describe('contenuti fermi prima di uscire', () => {
    it('data arrivata e senza approvazione vera: avviso; con approvazione valida: niente', () => {
        const r = blockedByApproval([c(), c({ id: 'c2', approval: { status: 'approved', requestedAt: 'x' } })], NOW);
        expect(r.map((x) => x.contentId)).toEqual(['c1']);
        expect(r[0].reason).toBe('no-approval');
    });
    it('modificato dopo l\'approvazione: avviso con il motivo giusto', () => {
        const hash = contentFingerprint(c());
        const r = blockedByApproval([c({ copy: 'Testo cambiato', approval: { status: 'approved', requestedAt: 'x', contentHash: hash } })], NOW);
        expect(r[0].reason).toBe('changed-after-approval');
    });
    it('non avvisa se la data è futura, manca o è passata da più di 3 giorni', () => {
        expect(blockedByApproval([c({ publicationDate: '2026-12-20' }), c({ publicationDate: undefined }), c({ publicationDate: '2026-11-01' })], NOW)).toHaveLength(0);
    });
    it('non ripete l\'avviso già mandato per lo stesso motivo', () => {
        expect(blockedByApproval([c({ publishAlert: { kind: 'no-approval', at: 'x' } })], NOW)).toHaveLength(0);
        expect(blockedByApproval([c({ publishAlert: { kind: 'changed-after-approval', at: 'x' } })], NOW)).toHaveLength(1);
    });
});
