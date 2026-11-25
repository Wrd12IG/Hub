import { describe, it, expect } from 'vitest';
import { clientQuickLinks } from '../client-quick-links';

describe('clientQuickLinks', () => {
    it('ogni collegamento porta al cliente giusto', () => {
        const links = clientQuickLinks('abc');
        for (const l of links) expect(l.href).toContain('abc');
    });
    it('i KPI ci sono per ogni cliente, qualunque profilo (o nessuno): non solo per le concessionarie', () => {
        for (const profile of ['auto', 'ecommerce', 'locale', 'b2b', 'social', null, undefined]) {
            expect(clientQuickLinks('a', profile).some((l) => l.key === 'kpi'), String(profile)).toBe(true);
        }
    });
    it('il pulsante dice «KPI concessionario» solo per «auto», «KPI» per gli altri; l\'indirizzo è lo stesso', () => {
        const label = (p?: string | null) => clientQuickLinks('a', p).find((l) => l.key === 'kpi')!;
        expect(label('auto').label).toBe('KPI concessionario');
        expect(label('ecommerce').label).toBe('KPI');
        expect(label(null).label).toBe('KPI');
        expect(label('locale').href).toBe('/clients/a/dealer-kpi');
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
