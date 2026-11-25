/**
 * lib/client-quick-links.ts
 *
 * I collegamenti rapidi in cima alla scheda di un cliente (solo staff). Pura (nessun I/O).
 * Era un elenco scritto dentro la pagina cliente da 2300 righe; qui si prova con un test.
 *
 * «Piano PED» non c'è più: ora è la scheda «Genera con AI» del Piano editoriale (lib/editorial-nav.ts).
 */

export type QuickLinkKey = 'piano' | 'tasks' | 'progetti' | 'creative' | 'scheda' | 'kpi' | 'monitor' | 'board' | 'growth';

export interface QuickLink {
    key: QuickLinkKey;
    label: string;
    href: string;
    /** Classi del pallino colorato. */
    dot: string;
    /** I gruppi si leggono come blocchi separati da un divisore: lavoro sul cliente, creatività e sito, analisi. */
    group: 'lavoro' | 'cliente' | 'analisi';
}

export function clientQuickLinks(clientId: string, kpiProfile?: string | null): QuickLink[] {
    const id = clientId;
    return [
        { key: 'piano', label: 'Piano Editoriale', href: `/clients/${id}/editorial-plan`, dot: 'bg-pink-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]', group: 'lavoro' },
        { key: 'tasks', label: 'Tasks', href: `/clients/${id}/tasks`, dot: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]', group: 'lavoro' },
        { key: 'progetti', label: 'Progetti', href: `/clients/${id}/projects`, dot: 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]', group: 'lavoro' },
        { key: 'creative', label: 'Creative Lab', href: `/clients/${id}/creative`, dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]', group: 'cliente' },
        { key: 'scheda', label: 'Scheda', href: `/clients/${id}/scheda`, dot: 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]', group: 'cliente' },
        // Solo per le concessionarie (profilo KPI «Auto e moto»): lead, appuntamenti, preventivi e vendite dallo Sheet del cliente.
        ...(kpiProfile === 'auto'
            ? [{ key: 'kpi' as const, label: 'KPI concessionario', href: `/clients/${id}/dealer-kpi`, dot: 'bg-lime-500 shadow-[0_0_8px_rgba(132,204,22,0.5)]', group: 'cliente' as const }]
            : []),
        { key: 'monitor', label: 'Monitor sito', href: `/clients/${id}/site-monitor`, dot: 'bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.5)]', group: 'cliente' },
        // Pagina globale: il cliente viaggia nell'URL, così si apre già filtrata invece di partire da «tutti».
        { key: 'board', label: 'Creative Board', href: `/documents?tab=media&client=${id}`, dot: 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]', group: 'cliente' },
        { key: 'growth', label: 'Growth Report', href: `/reports?client=${id}`, dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]', group: 'analisi' },
    ];
}
