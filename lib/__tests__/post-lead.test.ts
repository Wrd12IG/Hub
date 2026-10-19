import { describe, it, expect } from 'vitest';
import { parseStage, parseMonth, parsePostLeadRows, mergeEntries, funnelByMonth, rate, byChannel } from '../post-lead';

describe('fasi e date', () => {
    it('riconosce i nomi usati nei CRM', () => {
        expect(parseStage('Test drive')).toBe('prova');
        expect(parseStage('Appuntamento fissato')).toBe('appuntamento');
        expect(parseStage('Contratto firmato')).toBe('vendita');
        expect(parseStage('Nuovo contatto')).toBe('lead');
        expect(parseStage('boh')).toBeNull();
    });
    it('date in vari formati', () => {
        expect(parseMonth('15/10/2026')).toBe('2026-10');
        expect(parseMonth('2026-11-03')).toBe('2026-11');
        expect(parseMonth('3-12-26')).toBe('2026-12');
        expect(parseMonth(46310)).toBe('2026-10'); // seriale Excel (15/10/2026)
        expect(parseMonth(new Date(Date.UTC(2026, 11, 5)))).toBe('2026-12');
        expect(parseMonth('31/13/2026')).toBeNull();
        expect(parseMonth('ottobre')).toBeNull();
    });
});

describe('lettura del file', () => {
    const rows: unknown[][] = [
        ['Esportazione CRM'],
        ['Cliente', 'Data', 'Fase', 'Canale'],
        ['Mario Rossi', '15/10/2026', 'Lead', 'Meta'],
        ['Anna Bianchi', '16/10/2026', 'Lead', 'Meta'],
        ['Anna Bianchi', '18/10/2026', 'Appuntamento', 'Meta'],
        ['Luca Verdi', '20/10/2026', 'Vendita', 'Google'],
        ['Senza data', '', 'Lead', 'Meta'],
        [],
    ];
    it('conta per mese, fase e canale e scarta le righe incomplete', () => {
        const r = parsePostLeadRows(rows);
        expect(r.read).toBe(4);
        expect(r.skipped).toBe(1);
        expect(r.entries).toContainEqual({ month: '2026-10', stage: 'lead', channel: 'Meta', count: 2 });
        expect(r.entries).toContainEqual({ month: '2026-10', stage: 'vendita', channel: 'Google', count: 1 });
    });
    it('non conserva i nomi dei clienti', () => {
        expect(JSON.stringify(parsePostLeadRows(rows).entries)).not.toMatch(/Rossi|Bianchi|Verdi/);
    });
    it('usa la colonna quantità e il canale mancante', () => {
        const r = parsePostLeadRows([['Data', 'Tipo', 'Quantità'], ['01/11/2026', 'Prova', 5]]);
        expect(r.entries).toEqual([{ month: '2026-11', stage: 'prova', channel: 'Non indicato', count: 5 }]);
    });
    it('senza intestazioni riconoscibili non importa niente', () => {
        expect(parsePostLeadRows([['a', 'b'], [1, 2]]).entries).toEqual([]);
    });
});

describe('unione e imbuto', () => {
    it('ricaricare un mese lo sostituisce', () => {
        const old = [{ month: '2026-10', stage: 'lead' as const, channel: 'Meta', count: 10 }, { month: '2026-09', stage: 'lead' as const, channel: 'Meta', count: 4 }];
        const m = mergeEntries(old, [{ month: '2026-10', stage: 'lead', channel: 'Meta', count: 12 }]);
        expect(m.map((e) => `${e.month}:${e.count}`)).toEqual(['2026-09:4', '2026-10:12']);
    });
    it('imbuto per mese e percentuali', () => {
        const f = funnelByMonth([
            { month: '2026-10', stage: 'lead', channel: 'Meta', count: 40 }, { month: '2026-10', stage: 'lead', channel: 'Google', count: 10 },
            { month: '2026-10', stage: 'appuntamento', channel: 'Meta', count: 10 }, { month: '2026-10', stage: 'vendita', channel: 'Meta', count: 2 },
        ]);
        expect(f[0].counts).toEqual({ lead: 50, appuntamento: 10, prova: 0, vendita: 2 });
        expect(rate(10, 50)).toBe(20);
        expect(rate(1, 0)).toBeNull();
    });
    it('per canale, ordinati per vendite', () => {
        const c = byChannel([{ month: '2026-10', stage: 'vendita', channel: 'Google', count: 3 }, { month: '2026-10', stage: 'lead', channel: 'Meta', count: 50 }]);
        expect(c[0].channel).toBe('Google');
    });
});
