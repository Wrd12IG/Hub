import { describe, it, expect } from 'vitest';
import { editorialTabs, activeEditorialTab } from '../editorial-nav';
import { approvalBoard } from '../approval-board';
import type { EditorialContent } from '../data';

describe('editorialTabs', () => {
    it('senza cliente «Genera con AI» non è disponibile e dice perché', () => {
        const genera = editorialTabs().find((t) => t.key === 'genera')!;
        expect(genera.href).toBeNull();
        expect(genera.hint).toBeTruthy();
    });
    it('con un cliente tutte le schede si aprono e restano sul cliente', () => {
        const tabs = editorialTabs('abc');
        expect(tabs.map((t) => t.key)).toEqual(['calendario', 'genera', 'importa', 'approvazioni']);
        expect(tabs.find((t) => t.key === 'calendario')!.href).toBe('/clients/abc/editorial-plan');
        expect(tabs.find((t) => t.key === 'genera')!.href).toBe('/clients/abc/ped-plan');
        expect(tabs.find((t) => t.key === 'approvazioni')!.href).toBe('/editorial-plan/approvazioni?cliente=abc');
        expect(tabs.every((t) => !!t.href)).toBe(true);
    });
    it('senza cliente il calendario è quello di tutti', () => {
        expect(editorialTabs().find((t) => t.key === 'calendario')!.href).toBe('/editorial-plan');
    });
});

describe('activeEditorialTab', () => {
    it('riconosce ogni pagina del piano', () => {
        expect(activeEditorialTab('/editorial-plan')).toBe('calendario');
        expect(activeEditorialTab('/editorial-plan/')).toBe('calendario');
        expect(activeEditorialTab('/clients/a/editorial-plan')).toBe('calendario');
        expect(activeEditorialTab('/clients/a/ped-plan')).toBe('genera');
        expect(activeEditorialTab('/import-editorial')).toBe('importa');
        expect(activeEditorialTab('/editorial-plan/approvazioni')).toBe('approvazioni');
    });
    it('le altre pagine non ne fanno parte', () => {
        expect(activeEditorialTab('/clients/a')).toBeNull();
        expect(activeEditorialTab('/clients/a/briefs')).toBeNull();
        expect(activeEditorialTab('/dashboard')).toBeNull();
    });
});

describe('approvalBoard', () => {
    const now = new Date('2026-11-25T10:00:00.000Z');
    const ago = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
    const c = (id: string, clientId: string, status: string, a: 'requested' | 'changes' | 'approved', requestedAt: string, respondedAt?: string) =>
        ({ id, clientId, status, approval: { status: a, requestedAt, ...(respondedAt ? { respondedAt } : {}) } }) as unknown as EditorialContent;

    it('divide tra chi deve rispondere e chi ha rimandato indietro, dal più fermo', () => {
        const b = approvalBoard([
            c('1', 'a', 'In Approvazione Cliente', 'requested', ago(1)),
            c('2', 'a', 'In Approvazione Cliente', 'requested', ago(6)),
            c('3', 'a', 'Bozza', 'changes', ago(9), ago(2)),
            c('4', 'a', 'Approvato', 'approved', ago(5)),
            c('5', 'a', 'Pubblicato', 'changes', ago(5)),
        ], now);
        expect(b.waiting.map((i) => i.content.id)).toEqual(['2', '1']);
        expect(b.waiting[0].daysWaiting).toBe(6);
        expect(b.changes.map((i) => i.content.id)).toEqual(['3']);
        expect(b.changes[0].daysWaiting).toBe(2); // da quando il cliente ha risposto, non da quando l'abbiamo mandato
    });
    it('si può restringere a un cliente', () => {
        const b = approvalBoard([c('1', 'a', 'x', 'requested', ago(1)), c('2', 'b', 'x', 'requested', ago(1))], now, 'b');
        expect(b.waiting.map((i) => i.content.id)).toEqual(['2']);
    });
});
