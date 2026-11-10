import { describe, it, expect } from 'vitest';
import {
    KPI_CATALOG, KPI_PROFILES, MAX_KPIS, PROFILE_DEFS, SUGGESTED, defaultKpiIds, isKpiProfile, kpisForProfile,
    monthlyMailState, normalizeName, suggestionFor, validateKpiFields,
} from '../kpi-profiles';

describe('kpi-profiles: catalogo', () => {
    it('ogni profilo ha al massimo 5 KPI e tutti esistono nel catalogo', () => {
        for (const p of KPI_PROFILES) {
            const ids = defaultKpiIds(p);
            expect(ids.length).toBeGreaterThan(0);
            expect(ids.length).toBeLessThanOrEqual(MAX_KPIS);
            for (const id of ids) expect(KPI_CATALOG[id], `${p}: ${id}`).toBeDefined();
            expect(new Set(ids).size).toBe(ids.length);
        }
    });

    it("l'id di ogni voce coincide con la sua chiave e il ripiego esiste", () => {
        for (const [key, def] of Object.entries(KPI_CATALOG)) {
            expect(def.id).toBe(key);
            if (def.fallbackId) expect(KPI_CATALOG[def.fallbackId]).toBeDefined();
        }
    });

    it('i costi vanno «meglio se scendono», il resto «meglio se sale»', () => {
        expect(KPI_CATALOG.cost_per_lead.better).toBe('down');
        expect(KPI_CATALOG.cpa.better).toBe('down');
        expect(KPI_CATALOG.leads_real.better).toBe('up');
    });

    it('i dati manuali possono ripiegare sul proxy di piattaforma', () => {
        expect(KPI_CATALOG.leads_real.fallbackId).toBe('leads_meta');
    });

    it('kpisForProfile restituisce definizioni complete, nell\'ordine del profilo', () => {
        expect(kpisForProfile('auto').map((k) => k.id)).toEqual(PROFILE_DEFS.auto.defaultKpis);
    });
});

describe('kpi-profiles: validazione', () => {
    it('profili ammessi, null per toglierlo, il resto no', () => {
        expect(isKpiProfile('auto')).toBe(true);
        expect(isKpiProfile('Auto')).toBe(false);
        expect(validateKpiFields({ kpiProfile: 'b2b' })).toBeNull();
        expect(validateKpiFields({ kpiProfile: null })).toBeNull();
        expect(validateKpiFields({ kpiProfile: 'ristorante' })).toMatch(/non valido/);
        expect(validateKpiFields({ kpiProfile: '' })).toMatch(/non valido/);
    });

    it('il flag deve essere un vero booleano: la stringa "false" è truthy', () => {
        expect(validateKpiFields({ monthlyKpiMail: true })).toBeNull();
        expect(validateKpiFields({ monthlyKpiMail: false })).toBeNull();
        expect(validateKpiFields({ monthlyKpiMail: 'false' })).toMatch(/true o false/);
        expect(validateKpiFields({ monthlyKpiMail: 0 })).toMatch(/true o false/);
    });

    it('un PATCH che non tocca questi campi passa', () => {
        expect(validateKpiFields({ name: 'X', ga4PropertyId: '123456' })).toBeNull();
    });
});

describe('kpi-profiles: chi entra nella mail', () => {
    it('opt-in: senza flag fuori, anche con il profilo', () => {
        expect(monthlyMailState({})).toBe('excluded');
        expect(monthlyMailState({ kpiProfile: 'auto' })).toBe('excluded');
        expect(monthlyMailState({ kpiProfile: 'auto', monthlyKpiMail: false })).toBe('excluded');
    });
    it('flag acceso: dentro solo con un profilo valido', () => {
        expect(monthlyMailState({ monthlyKpiMail: true, kpiProfile: 'locale' })).toBe('included');
        expect(monthlyMailState({ monthlyKpiMail: true })).toBe('no_profile');
        expect(monthlyMailState({ monthlyKpiMail: true, kpiProfile: 'boh' })).toBe('no_profile');
    });
});

describe('kpi-profiles: proposta iniziale', () => {
    it('normalizeName ignora maiuscole, accenti, spazi e segni', () => {
        expect(normalizeName('BETTIN - BGF SRL')).toBe(normalizeName('Bettin – BGF S.r.l.'));
        expect(normalizeName('FURECO ')).toBe('fureco');
        expect(normalizeName("L'ALTRO LUCA E ANDREA")).toBe('laltrolucaeandrea');
        expect(normalizeName('Cà Bela')).toBe(normalizeName('CA BELA'));
    });

    it('60 clienti assegnati o esclusi, nessun nome ripetuto fra gruppi (Atlantis è l\'unico lasciato fuori)', () => {
        expect(SUGGESTED.size).toBe(60);
        const included = [...SUGGESTED.values()].filter((s) => s.include);
        const excluded = [...SUGGESTED.values()].filter((s) => !s.include);
        expect(included.length).toBe(47);
        expect(excluded.length).toBe(13);
        expect(included.every((s) => s.profile !== null)).toBe(true);
        expect(excluded.every((s) => s.profile === null)).toBe(true);
    });

    it('i casi decisi da Roberto: Winblu è B2B, Help Computer è e-commerce, gli esclusi restano fuori', () => {
        expect(suggestionFor('WINBLU')).toEqual({ profile: 'b2b', include: true });
        expect(suggestionFor('MIMMO DORMIO S.R.L. - HELP COMPUTER')).toEqual({ profile: 'ecommerce', include: true });
        expect(suggestionFor('Cyberwise')).toEqual({ profile: null, include: false });
        expect(suggestionFor('Bike House')).toEqual({ profile: null, include: false });
        expect(suggestionFor('ATLANTIS')).toBeUndefined();
    });
});
