/**
 * lib/report-nav.ts
 *
 * Le schede della sezione Report. Prima erano cinque voci separate del menu (Report, Andamento clienti, KPI concessionari)
 * o pagine senza voce (Analisi, Mail mensile KPI) con titoli diversi; ora c'è una voce sola e una barra comune.
 * Pura (nessun I/O).
 *
 *   Ore e team          → /reports: ore lavorate e costi (tutto lo staff)
 *   Analisi             → /analytics: produttività, margini, previsioni (chi vede i dati economici)
 *   Andamento clienti   → /andamento-clienti: come va ogni cliente sui suoi KPI (amministratori)
 *   KPI per profilo     → /kpi-profili: i clienti dello stesso profilo affiancati, con tutti i loro KPI (amministratori)
 *   KPI concessionari   → /kpi-concessionari: lead e vendite dei concessionari (amministratori)
 *   Mail mensile KPI    → /admin/report-mensile: profili, dati reali e anteprima della mail (amministratori)
 *
 * Le schede nascoste non sono una protezione: le pagine e le API fanno il loro controllo. Qui si decide solo cosa mostrare.
 */

export type ReportTabKey = 'tempo' | 'analisi' | 'andamento' | 'profili' | 'kpi' | 'mail';

export interface ReportTab { key: ReportTabKey; label: string; href: string }

const ALL_TABS: (ReportTab & { adminOnly?: boolean; needsFinancials?: boolean })[] = [
    { key: 'tempo', label: 'Ore e team', href: '/reports' },
    { key: 'analisi', label: 'Analisi', href: '/analytics', needsFinancials: true },
    { key: 'andamento', label: 'Andamento clienti', href: '/andamento-clienti', adminOnly: true },
    { key: 'profili', label: 'KPI per profilo', href: '/kpi-profili', adminOnly: true },
    { key: 'kpi', label: 'KPI concessionari', href: '/kpi-concessionari', adminOnly: true },
    { key: 'mail', label: 'Mail mensile KPI', href: '/admin/report-mensile', adminOnly: true },
];

/** Le schede che l'utente può aprire. `canViewFinancials`: amministratore sempre, gli altri con la spunta in Permessi. */
export function reportTabs(who: { isAdmin: boolean; canViewFinancials: boolean }): ReportTab[] {
    return ALL_TABS
        .filter((t) => (!t.adminOnly || who.isAdmin) && (!t.needsFinancials || who.isAdmin || who.canViewFinancials))
        .map(({ key, label, href }) => ({ key, label, href }));
}

/** Quale scheda è aperta, dall'indirizzo. `null` se la pagina non fa parte dei Report. */
export function activeReportTab(pathname: string): ReportTabKey | null {
    const path = pathname.replace(/\/+$/, '');
    const hit = ALL_TABS.find((t) => path === t.href || path.startsWith(`${t.href}/`));
    return hit ? hit.key : null;
}

/** Tutti gli indirizzi della sezione: la voce del menu si accende su ognuno. */
export const REPORT_SECTION_HREFS: readonly string[] = ALL_TABS.map((t) => t.href);

/** `role` come lo scrive l'app («Amministratore», talvolta «admin»). */
export function isAdminRole(role: string | null | undefined): boolean {
    const r = (role || '').trim().toLowerCase();
    return r === 'amministratore' || r === 'admin';
}
