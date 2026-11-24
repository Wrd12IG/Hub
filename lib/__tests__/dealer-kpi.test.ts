// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { normalizeCount, normalizeMonth, normalizeSource, normalizeType, parseDealerSheet } from '@/lib/dealer-kpi/parse';
import { funnelRate, totalsByMonth } from '@/lib/dealer-kpi/totals';
import { extractSpreadsheetId, validTabName } from '@/lib/dealer-kpi/sheet-url';

const H = ['Mese', 'Tipo', 'Marca', 'Provenienza', 'Quantità'];

describe('normalizzazioni', () => {
    it('mese: ISO, data, mese/anno, nome del mese; altro → null', () => {
        expect(normalizeMonth('2026-11')).toBe('2026-11');
        expect(normalizeMonth('2026-11-20')).toBe('2026-11');
        expect(normalizeMonth('20/11/2026')).toBe('2026-11');
        expect(normalizeMonth('11/2026')).toBe('2026-11');
        expect(normalizeMonth('Novembre 2026')).toBe('2026-11');
        expect(normalizeMonth('nov 2026')).toBe('2026-11');
        for (const bad of ['', '2026-13', '13/2026', 'boh', '1999-05', '2026']) expect(normalizeMonth(bad)).toBeNull();
    });
    it('tipo e provenienza: maiuscole, accenti, sinonimi', () => {
        expect(normalizeType(' Appuntamenti ')).toBe('appuntamento');
        expect(normalizeType('VENDITE')).toBe('vendita');
        expect(normalizeType('boh')).toBeNull();
        expect(normalizeSource('google ads')).toBe('Google');
        expect(normalizeSource('Instagram')).toBe('Meta');
        expect(normalizeSource('Sito Web')).toBe('Sito');
        expect(normalizeSource('porta a porta')).toBeNull();
    });
    it('quantità: interi, migliaia, «12,0»; non numeri e negativi → null', () => {
        expect(normalizeCount('12')).toBe(12);
        expect(normalizeCount('1.200')).toBe(1200);
        expect(normalizeCount('12,0')).toBe(12);
        expect(normalizeCount('0')).toBe(0);
        for (const bad of ['', 'abc', '-3', '3,5', '12 auto']) expect(normalizeCount(bad)).toBeNull();
    });
});

describe('lettura dello Sheet', () => {
    it('righe valide: normalizza, somma i doppioni, unifica le marche scritte in modo diverso', () => {
        const r = parseDealerSheet([
            H,
            ['2026-11', 'Lead', 'Fiat', 'Google', '10'],
            ['11/2026', 'lead', 'FIAT ', 'google ads', '5'],
            ['2026-11', 'Vendita', 'Fiat', 'Showroom', '2'],
            ['', '', '', '', ''],
            ['2026-12', 'Lead', '', 'Meta', '7'],
        ]);
        expect(r.issues).toEqual([]);
        expect(r.rowsRead).toBe(4);
        expect(r.entries).toEqual([
            { month: '2026-11', type: 'lead', brand: 'Fiat', source: 'Google', count: 15 },
            { month: '2026-11', type: 'vendita', brand: 'Fiat', source: 'Showroom', count: 2 },
            { month: '2026-12', type: 'lead', brand: 'Non indicata', source: 'Meta', count: 7 },
        ]);
    });
    it('colonne in un altro ordine, con intestazioni alternative', () => {
        const r = parseDealerSheet([['Quantità', 'Origine', 'Tipologia', 'Periodo', 'Brand'], ['4', 'Telefono', 'Preventivi', '2026-10', 'Renault']]);
        expect(r.entries).toEqual([{ month: '2026-10', type: 'preventivo', brand: 'Renault', source: 'Telefono', count: 4 }]);
    });
    it('errori per riga (con il numero di riga del foglio) e righe sbagliate saltate', () => {
        const r = parseDealerSheet([
            H,
            ['boh', 'Lead', 'Fiat', 'Google', '1'],
            ['2026-11', 'Sconti', 'Fiat', 'Google', '1'],
            ['2026-11', 'Lead', 'Fiat', 'Google', 'molti'],
            ['2026-11', 'Lead', 'Fiat', 'Google', '3'],
        ]);
        expect(r.issues.map((i) => [i.row, i.level])).toEqual([[2, 'errore'], [3, 'errore'], [4, 'errore']]);
        expect(r.entries).toHaveLength(1);
        expect(r.entries[0].count).toBe(3);
    });
    it('provenienza non riconosciuta o vuota: avviso e contata come Altro (i totali non si perdono)', () => {
        const r = parseDealerSheet([H, ['2026-11', 'Lead', 'Fiat', 'Porta a porta', '2'], ['2026-11', 'Lead', 'Fiat', '', '1']]);
        expect(r.issues.map((i) => i.level)).toEqual(['avviso', 'avviso']);
        expect(r.entries).toEqual([{ month: '2026-11', type: 'lead', brand: 'Fiat', source: 'Altro', count: 3 }]);
    });
    it('manca una colonna o è vuoto: un solo errore chiaro, nessun dato', () => {
        const a = parseDealerSheet([['Mese', 'Tipo', 'Marca']]);
        expect(a.entries).toEqual([]);
        expect(a.issues[0].message).toMatch(/Provenienza.*Quantità|Quantità.*Provenienza/);
        expect(parseDealerSheet([]).issues[0].message).toMatch(/vuoto/);
    });
    it('un mese non compilato non compare (non è zero)', () => {
        const r = parseDealerSheet([H, ['2026-11', 'Lead', 'Fiat', 'Google', '1']]);
        expect(totalsByMonth(r.entries).map((m) => m.month)).toEqual(['2026-11']);
    });
});

describe('totali e imbuto', () => {
    it('totali per mese, per tipo, marca e provenienza', () => {
        const r = parseDealerSheet([
            H,
            ['2026-11', 'Lead', 'Fiat', 'Google', '10'], ['2026-11', 'Lead', 'Renault', 'Meta', '6'],
            ['2026-11', 'Appuntamento', 'Fiat', 'Google', '4'], ['2026-11', 'Vendita', 'Fiat', 'Google', '1'],
            ['2026-10', 'Lead', 'Fiat', 'Sito', '3'],
        ]);
        const t = totalsByMonth(r.entries);
        expect(t.map((m) => m.month)).toEqual(['2026-10', '2026-11']);
        expect(t[1].byType).toEqual({ lead: 16, appuntamento: 4, preventivo: 0, vendita: 1 });
        expect(t[1].byBrand.lead).toEqual({ Fiat: 10, Renault: 6 });
        expect(t[1].bySource.lead).toEqual({ Google: 10, Meta: 6 });
    });
    it('percentuale dell\'imbuto: una cifra decimale, null se il denominatore è zero', () => {
        expect(funnelRate(4, 16)).toBe(25);
        expect(funnelRate(1, 3)).toBe(33.3);
        expect(funnelRate(5, 0)).toBeNull();
    });
});

describe('indirizzo dello Sheet', () => {
    const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd';
    it('estrae l\'identificativo da un indirizzo o dal solo id', () => {
        expect(extractSpreadsheetId(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=0`)).toBe(ID);
        expect(extractSpreadsheetId(ID)).toBe(ID);
    });
    it('rifiuta altri siti, testo e id troppo corti o con caratteri strani', () => {
        for (const bad of ['', 'ciao', 'https://evil.example/spreadsheets/d/' + ID, 'https://docs.google.com/document/d/' + ID, `${ID}'; drop`]) expect(extractSpreadsheetId(bad)).toBeNull();
    });
    it('nome della scheda senza apici né virgolette', () => {
        expect(validTabName('Dati')).toBe(true);
        expect(validTabName('Dati 2026')).toBe(true);
        for (const bad of ["Dati'!A1", 'Dati"', '', 'x'.repeat(61), 'a;b']) expect(validTabName(bad)).toBe(false);
    });
});
