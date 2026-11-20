/**
 * lib/site-monitor/budget.ts
 *
 * Quante pagine si possono leggere in una scansione senza sforare i crediti. Funzione pura.
 * Regole: tetto mensile del monitor (default 500), riserva sempre intatta per il resto del team (default 1500), massimo pagine per sito (25).
 */
export interface BudgetConfig { monthlyCap: number; reserve: number; maxPages: number }

export const DEFAULT_BUDGET: BudgetConfig = { monthlyCap: 500, reserve: 1500, maxPages: 25 };

const int = (v: string | undefined, d: number) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && v !== undefined && v !== '' ? Math.floor(n) : d; };

export function budgetFromEnv(env: Record<string, string | undefined> = process.env): BudgetConfig {
    return {
        monthlyCap: int(env.SITE_MONITOR_MONTHLY_CREDITS, DEFAULT_BUDGET.monthlyCap),
        reserve: int(env.SITE_MONITOR_RESERVE_CREDITS, DEFAULT_BUDGET.reserve),
        maxPages: int(env.SITE_MONITOR_MAX_PAGES, DEFAULT_BUDGET.maxPages),
    };
}

export interface PagesAllowed { pages: number; reason: 'ok' | 'tetto_mensile' | 'riserva' | 'crediti_non_leggibili' }

/**
 * @param spentThisMonth crediti già spesi dal monitor nel mese
 * @param remaining crediti rimasti nel piano Firecrawl (`null` = non leggibili: per prudenza non si scansiona)
 */
export function pagesAllowed(cfg: BudgetConfig, spentThisMonth: number, remaining: number | null): PagesAllowed {
    if (remaining === null) return { pages: 0, reason: 'crediti_non_leggibili' };
    const monthly = Math.max(0, cfg.monthlyCap - spentThisMonth);
    const aboveReserve = Math.max(0, remaining - cfg.reserve);
    const pages = Math.min(cfg.maxPages, monthly, aboveReserve);
    if (pages > 0) return { pages, reason: 'ok' };
    return { pages: 0, reason: monthly === 0 ? 'tetto_mensile' : 'riserva' };
}

export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
