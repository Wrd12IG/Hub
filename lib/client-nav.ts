/**
 * lib/client-nav.ts
 *
 * Navigazione tra clienti: cambiando cliente dal selettore si resta nella stessa sezione (KPI, Scheda, Monitor sito…)
 * invece di tornare sempre alla panoramica. Le sezioni sono elencate una per una: una pagina con id annidati
 * (es. /meta-ads/[cid]) non ha senso su un altro cliente e riporta alla panoramica.
 */

/** Sezioni per-cliente che si aprono allo stesso modo su qualsiasi cliente. */
export const KEEPABLE_SECTIONS = [
    'editorial-plan', 'tasks', 'projects', 'creative', 'scheda', 'site-monitor', 'ped-plan',
    'dealer-kpi', 'ga4', 'google-ads', 'search-console', 'gbp',
] as const;


/**
 * Dove andare scegliendo `targetId` mentre si è su `pathname`. Resta nella sezione se è una di quelle
 * riportabili (e vale per il cliente di arrivo), altrimenti apre la panoramica del cliente.
 */
export function clientHref(
    pathname: string,
    target: { id: string; kpiProfile?: string | null },
): string {
    const base = `/clients/${target.id}`;
    const m = /^\/clients\/[^/]+\/([^/]+)\/?$/.exec(pathname);
    const section = m?.[1];
    if (!section || !(KEEPABLE_SECTIONS as readonly string[]).includes(section)) return base;
    return `${base}/${section}`;
}
