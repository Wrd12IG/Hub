import { describe, it, expect } from 'vitest';
import { reportTabs, activeReportTab, isAdminRole, REPORT_SECTION_HREFS } from '../report-nav';

describe('reportTabs', () => {
    it('l\'amministratore le vede tutte', () => {
        expect(reportTabs({ isAdmin: true, canViewFinancials: true }).map((t) => t.key)).toEqual(['tempo', 'analisi', 'andamento', 'kpi', 'mail']);
    });
    it('chi non è amministratore e non vede i dati economici ha solo «Ore e team»', () => {
        expect(reportTabs({ isAdmin: false, canViewFinancials: false }).map((t) => t.key)).toEqual(['tempo']);
    });
    it('con i dati economici si aggiunge «Analisi», ma non le schede riservate agli amministratori', () => {
        expect(reportTabs({ isAdmin: false, canViewFinancials: true }).map((t) => t.key)).toEqual(['tempo', 'analisi']);
    });
});

describe('activeReportTab', () => {
    it('riconosce ogni pagina, comprese le sottopagine della mail mensile', () => {
        expect(activeReportTab('/reports')).toBe('tempo');
        expect(activeReportTab('/analytics')).toBe('analisi');
        expect(activeReportTab('/andamento-clienti/')).toBe('andamento');
        expect(activeReportTab('/kpi-concessionari')).toBe('kpi');
        expect(activeReportTab('/admin/report-mensile')).toBe('mail');
        expect(activeReportTab('/admin/report-mensile/anteprima')).toBe('mail');
        expect(activeReportTab('/admin/report-mensile/dati-reali')).toBe('mail');
    });
    it('le altre pagine non ne fanno parte', () => {
        expect(activeReportTab('/admin')).toBeNull();
        expect(activeReportTab('/reportsx')).toBeNull();
        expect(activeReportTab('/clients/a')).toBeNull();
    });
    it('gli indirizzi della sezione coincidono con le schede', () => {
        expect(REPORT_SECTION_HREFS).toContain('/analytics');
        expect(REPORT_SECTION_HREFS).toHaveLength(5);
    });
});

describe('isAdminRole', () => {
    it('accetta le due scritture usate dall\'app', () => {
        expect(isAdminRole('Amministratore')).toBe(true);
        expect(isAdminRole(' admin ')).toBe(true);
        expect(isAdminRole('Project Manager')).toBe(false);
        expect(isAdminRole(undefined)).toBe(false);
    });
});
