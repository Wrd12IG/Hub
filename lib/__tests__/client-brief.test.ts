import { describe, it, expect } from 'vitest';
import { parseClientBrief, buildClientBrief } from '../client-brief';

describe('parseClientBrief', () => {
    it('titolo e richiesta obbligatori', () => {
        expect(parseClientBrief({ title: ' ', request: 'x' }).ok).toBe(false);
        expect(parseClientBrief({ title: 'x', request: '' }).ok).toBe(false);
        expect(parseClientBrief(undefined).ok).toBe(false);
    });
    it('valido, con scadenza solo se yyyy-MM-dd', () => {
        const r = parseClientBrief({ title: ' Video ', request: ' Serve un reel ', deadline: '2026-11-30' }) as any;
        expect(r.value).toEqual({ title: 'Video', request: 'Serve un reel', deadline: '2026-11-30', references: undefined });
        expect((parseClientBrief({ title: 'a', request: 'b', deadline: '30/11/2026' }) as any).value.deadline).toBeUndefined();
    });
    it('testi troppo lunghi tagliati', () => expect((parseClientBrief({ title: 'a'.repeat(500), request: 'b'.repeat(9000) }) as any).value.request.length).toBe(4000));
});

describe('buildClientBrief', () => {
    it('nasce Inviato, per il cliente giusto, firmato da chi lo invia', () => {
        const b = buildClientBrief({ title: 'T', request: 'R', deadline: '2026-11-30' }, { clientId: 'c1', clientName: 'ACME', userId: 'u1', userName: 'Mario', now: new Date('2026-10-22T10:00:00Z') });
        expect(b).toMatchObject({ clientId: 'c1', projectName: 'ACME', title: 'T', contactPerson: 'Mario', status: 'Inviato', createdBy: 'u1', deadline: '2026-11-30', selectedServiceIds: [] });
    });
});
