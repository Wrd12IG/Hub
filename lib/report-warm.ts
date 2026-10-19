// Regole pure per il giro notturno del report e per la barra di avanzamento.

/** Un cliente ha qualcosa da leggere solo se almeno una fonte del report è configurata (Klaviyo, che sta cifrato a parte, si prova comunque). */
export function hasReportSources(client: any): boolean {
    const w = client?.windsorAccounts ?? {};
    return !!(client?.metaAdAccountId || client?.googleAdAccountId || client?.ga4PropertyId || client?.awinAdvertiserId
        || w.instagram || w.searchconsole || w.linkedin_organic || (Array.isArray(w.gbp) && w.gbp.length > 0));
}

/** Da riscaldare se manca la copia, è vecchia oltre `maxAgeMs`, o era un report in errore (durata breve). */
export function needsWarming(hit: { computedAt?: string; ttlMs?: number } | null | undefined, now: number, maxAgeMs: number): boolean {
    if (!hit?.computedAt) return true;
    const age = now - Date.parse(hit.computedAt);
    if (!Number.isFinite(age)) return true;
    // Un report calcolato con una fonte in errore ha ttl breve: va rifatto anche se è di stanotte
    if (typeof hit.ttlMs === 'number' && hit.ttlMs < 10 * 60 * 1000) return true;
    return age >= maxAgeMs;
}

export interface ReportProgress {
    runId: string;
    total: number;
    done: number;
    /** Le fonti già terminate, nell'ordine in cui hanno finito. */
    steps: { label: string; ok: boolean }[];
    finished: boolean;
    updatedAt: number;
}

export const progressPercent = (p: { done: number; total: number } | null | undefined): number =>
    p && p.total > 0 ? Math.min(100, Math.round((p.done / p.total) * 100)) : 0;
