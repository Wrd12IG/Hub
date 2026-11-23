import { describe, it, expect } from 'vitest';
import { canRequestApproval, requestApproval, parseDecision, applyDecision, toPublicContent, STATUS_PENDING, approvalGate, contentFingerprint } from '../content-approval';
import type { EditorialContent } from '../data';

const now = new Date('2026-10-22T10:00:00Z');
const content = (o: Partial<EditorialContent> = {}): EditorialContent => ({
    id: 'c', topic: 'Open day', clientId: 'cl', format: 'Post', status: 'Bozza',
    facebook: true, instagram: true, linkedin: false, tiktok: false, youtube: false, gbp: false, ...o,
});

describe('canRequestApproval', () => {
    it('bozza sì', () => expect(canRequestApproval(content()).ok).toBe(true));
    it('già pubblicato no', () => expect(canRequestApproval(content({ status: 'Pubblicato' })).ok).toBe(false));
    it('già in attesa no', () => expect(canRequestApproval(content({ approval: { status: 'requested', requestedAt: 'x' } })).ok).toBe(false));
    it('dopo una richiesta di modifiche si può richiedere di nuovo', () => expect(canRequestApproval(content({ approval: { status: 'changes', requestedAt: 'x' } })).ok).toBe(true));
});

describe('parseDecision', () => {
    it('approva', () => expect(parseDecision({ decision: 'approve', name: ' Mario ' })).toEqual({ ok: true, value: { decision: 'approve', name: 'Mario' } }));
    it('modifiche senza commento rifiutate', () => expect(parseDecision({ decision: 'changes', comment: '   ' }).ok).toBe(false));
    it('commento troppo lungo tagliato', () => {
        const r = parseDecision({ decision: 'changes', comment: 'x'.repeat(5000) }) as any;
        expect(r.value.comment.length).toBe(1000);
    });
    it('scelta sconosciuta rifiutata', () => expect(parseDecision({ decision: 'boh' }).ok).toBe(false));
    it('body vuoto non esplode', () => expect(parseDecision(undefined).ok).toBe(false));
});

describe('applyDecision', () => {
    const req = requestApproval('staff1', now);
    it('approvazione → Approvato', () => {
        const r = applyDecision({ approval: req.approval }, { decision: 'approve', name: 'Mario' }, now)!;
        expect(r.status).toBe('Approvato');
        expect(r.approval).toMatchObject({ status: 'approved', respondedBy: 'Mario', requestedBy: 'staff1' });
    });
    it('modifiche → torna in bozza con commento', () => {
        const r = applyDecision({ approval: req.approval }, { decision: 'changes', comment: 'Cambia la foto' }, now)!;
        expect(r.status).toBe('Bozza');
        expect(r.approval.comment).toBe('Cambia la foto');
    });
    it('senza richiesta in corso non si può rispondere (niente auto-approvazione)', () => {
        expect(applyDecision({}, { decision: 'approve' }, now)).toBeNull();
        expect(applyDecision({ approval: { status: 'approved', requestedAt: 'x' } }, { decision: 'approve' }, now)).toBeNull();
    });
    it('la richiesta porta lo stato in attesa', () => expect(req.status).toBe(STATUS_PENDING));
});

describe('toPublicContent', () => {
    it('espone solo i campi previsti', () => {
        const p = toPublicContent(content({ tags: '#interno', taskId: 't1', projectId: 'p1', customFields: { a: 'b' }, copy: 'Ciao', imageUrls: ['https://x/a.jpg', 'http://x/b.jpg'] }));
        expect(Object.keys(p).sort()).toEqual(['channels', 'copy', 'format', 'id', 'imageUrls', 'publicationDate', 'topic', 'videoUrl']);
        expect(p.imageUrls).toEqual(['https://x/a.jpg']);
        expect(p.channels).toEqual(['Facebook', 'Instagram']);
    });
});

import { bypassApproval, canBypassApproval } from '../content-approval';
describe('bypass', () => {
    it('solo admin o chi ha il permesso', () => {
        expect(canBypassApproval({ role: 'Amministratore' })).toBe(true);
        expect(canBypassApproval({ role: 'Collaboratore', canSkipClientApproval: true })).toBe(true);
        expect(canBypassApproval({ role: 'Project Manager' })).toBe(false);
        expect(canBypassApproval({ role: 'Cliente', canSkipClientApproval: true })).toBe(false); // un utente Cliente non salta mai l'approvazione, nemmeno col flag
        expect(canBypassApproval(null)).toBe(false);
    });
    it('lascia traccia di chi ha approvato', () => {
        const r = bypassApproval('Roberto', new Date('2026-10-22T10:00:00Z'), 'u1');
        expect(r.status).toBe('Approvato');
        expect(r.approval).toMatchObject({ status: 'approved', bypass: true, respondedBy: 'Roberto', requestedBy: 'u1' });
    });
});

describe('impronta e controllo prima di pubblicare', () => {
    const pending = (o: Partial<EditorialContent> = {}) => content({ copy: 'Ciao', status: STATUS_PENDING, approval: { status: 'requested', requestedAt: 'x' }, ...o });

    it('l\'impronta ignora la data e i campi vuoti, non il testo né i media', () => {
        const a = contentFingerprint(content({ copy: 'Ciao', imageUrls: ['https://x/a.jpg'] }));
        expect(contentFingerprint(content({ copy: 'Ciao', imageUrls: ['https://x/a.jpg'], publicationDate: '2026-12-01' }))).toBe(a);
        expect(contentFingerprint(content({ copy: 'Ciao', imageUrls: ['https://x/a.jpg'], hashtags: '' }))).toBe(a);
        expect(contentFingerprint(content({ copy: 'Ciao!', imageUrls: ['https://x/a.jpg'] }))).not.toBe(a);
        expect(contentFingerprint(content({ copy: 'Ciao', imageUrls: ['https://x/b.jpg'] }))).not.toBe(a);
        expect(contentFingerprint(content({ copy: 'Ciao', imageUrls: ['https://x/a.jpg'], linkedin: true }))).not.toBe(a);
    });
    it('l\'approvazione del cliente salva l\'impronta; le modifiche successive bloccano l\'uscita', () => {
        const c = pending({ imageUrls: ['https://x/a.jpg'] });
        const next = applyDecision(c, { decision: 'approve' }, now)!;
        const approved = { ...c, ...next };
        expect(next.approval.contentHash).toBeTruthy();
        expect(approvalGate(approved)).toEqual({ ok: true });
        const edited = approvalGate({ ...approved, copy: 'Testo diverso' });
        expect(edited.ok).toBe(false);
        expect(!edited.ok && edited.reason).toBe('changed-after-approval');
    });
    it('anche l\'approvazione interna (bypass) salva l\'impronta', () => {
        const c = content({ copy: 'Ciao' });
        const b = bypassApproval('Admin', now, 'u1', c);
        expect(b.approval.contentHash).toBe(contentFingerprint(c));
        expect(approvalGate({ ...c, ...b })).toEqual({ ok: true });
    });
    it('«Approvato» senza approvazione, in attesa o con richiesta di modifiche non esce', () => {
        for (const approval of [undefined, { status: 'requested' as const, requestedAt: 'x' }, { status: 'changes' as const, requestedAt: 'x' }]) {
            const g = approvalGate(content({ status: 'Approvato', approval }));
            expect(g.ok).toBe(false);
            expect(!g.ok && g.reason).toBe('no-approval');
        }
        expect(approvalGate(content({ status: 'Bozza' })).ok).toBe(false);
    });
    it('approvazioni senza impronta (fatte prima di questa regola) restano valide', () => {
        expect(approvalGate(content({ status: 'Approvato', approval: { status: 'approved', requestedAt: 'x' } }))).toEqual({ ok: true });
    });
});
