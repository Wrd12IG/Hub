import { describe, it, expect } from 'vitest';
import { clientQuickLinks } from '../client-quick-links';

describe('clientQuickLinks', () => {
    it('ogni collegamento porta al cliente giusto', () => {
        const links = clientQuickLinks('abc');
        for (const l of links) expect(l.href).toContain('abc');
    });
    it('i KPI concessionario compaiono solo per il profilo «auto»', () => {
        expect(clientQuickLinks('a', 'auto').some((l) => l.key === 'kpi')).toBe(true);
        expect(clientQuickLinks('a', 'locale').some((l) => l.key === 'kpi')).toBe(false);
        expect(clientQuickLinks('a').some((l) => l.key === 'kpi')).toBe(false);
    });
    it('«Piano PED» non c\'è più: è una scheda del Piano editoriale', () => {
        expect(clientQuickLinks('a', 'auto').some((l) => l.href.endsWith('/ped-plan'))).toBe(false);
    });
    it('i gruppi sono contigui, così i divisori cadono tra un blocco e l\'altro', () => {
        const groups = clientQuickLinks('a', 'auto').map((l) => l.group);
        expect(groups.join(',')).toBe([...groups].sort((x, y) => ['lavoro', 'cliente', 'analisi'].indexOf(x) - ['lavoro', 'cliente', 'analisi'].indexOf(y)).join(','));
    });
    it('senza duplicati', () => {
        const keys = clientQuickLinks('a', 'auto').map((l) => l.key);
        expect(new Set(keys).size).toBe(keys.length);
    });
});
