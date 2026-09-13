/**
 * lib/seo-audit.ts
 *
 * Real SEO scoring for a client's site, replacing the "Audit Godmode SEO"
 * screen that was an entirely hardcoded mockup (Health Score 74/100, LCP 3.2s,
 * CLS 0.12 and a fixed list of "quick wins" — identical strings for every
 * client, regardless of their site).
 *
 * Two real sources, no invented numbers:
 *   - Google PageSpeed Insights (Lighthouse): its own SEO and performance
 *     scores plus measured Core Web Vitals for the actual URL.
 *   - Search Console via Windsor: how the site actually performs in results.
 *
 * Same transparency rule as lib/ads-health.ts: every factor is returned with
 * its value and weight so the UI can show why the score is what it is, and a
 * factor that can't be measured is excluded from the weighting rather than
 * scored zero.
 */

import { getData } from './windsor-client';

export interface SeoFactor {
    id: 'technical' | 'performance' | 'position' | 'ctr';
    label: string;
    detail: string;
    weight: number;
    ratio: number;
    applicable: boolean;
}

export interface SeoVital {
    id: string;
    label: string;
    value: string;
    /** Lighthouse's own verdict for this metric. */
    status: 'good' | 'warn' | 'bad';
}

export interface SeoAuditResult {
    url: string;
    score: number;
    factors: SeoFactor[];
    vitals: SeoVital[];
    /** Concrete things to fix, taken from Lighthouse's own failed audits. */
    issues: { title: string; detail: string }[];
    lighthouse: { seo: number; performance: number };
    searchConsole: { clicks: number; impressions: number; ctr: number; position: number } | null;
    ranAt: string;
}

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

/** Lighthouse scores audits 0..1; below 0.5 is failing, below 0.9 needs work. */
function statusFromScore(score: number | null | undefined): 'good' | 'warn' | 'bad' {
    if (score === null || score === undefined) return 'warn';
    if (score >= 0.9) return 'good';
    if (score >= 0.5) return 'warn';
    return 'bad';
}

export async function runSeoAudit(
    url: string,
    searchConsoleAccountId?: string
): Promise<SeoAuditResult> {
    const key = process.env.PAGESPEED_API_KEY;
    if (!key) throw new Error('PAGESPEED_API_KEY non configurata');
    if (!url) throw new Error('Il cliente non ha un sito web configurato');

    const psiUrl = new URL(PSI_ENDPOINT);
    psiUrl.searchParams.set('url', url);
    psiUrl.searchParams.set('strategy', 'mobile'); // mobile-first, like Google indexes
    psiUrl.searchParams.set('key', key);
    for (const c of ['performance', 'seo']) psiUrl.searchParams.append('category', c);

    const [psiRes, gscRows] = await Promise.all([
        fetch(psiUrl.toString()),
        searchConsoleAccountId
            ? getData({
                connector: 'searchconsole',
                accountId: searchConsoleAccountId,
                fields: ['clicks', 'impressions', 'ctr', 'position', 'account_id'],
                datePreset: 'last_30d',
            }).catch(() => [])
            : Promise.resolve([]),
    ]);

    if (!psiRes.ok) {
        const body = await psiRes.text().catch(() => '');
        throw new Error(`PageSpeed ha risposto ${psiRes.status}: ${body.slice(0, 200)}`);
    }
    const psi = await psiRes.json();
    const lr = psi.lighthouseResult;
    if (!lr) throw new Error('PageSpeed non ha restituito risultati Lighthouse per questo URL');

    const seoScore = Math.round((lr.categories?.seo?.score ?? 0) * 100);
    const perfScore = Math.round((lr.categories?.performance?.score ?? 0) * 100);

    const VITALS = [
        { id: 'largest-contentful-paint', label: 'LCP (caricamento)' },
        { id: 'cumulative-layout-shift', label: 'CLS (stabilità)' },
        { id: 'total-blocking-time', label: 'TBT (interattività)' },
        { id: 'server-response-time', label: 'Risposta server' },
    ];
    const vitals: SeoVital[] = VITALS.map((v) => {
        const a = lr.audits?.[v.id];
        return {
            id: v.id,
            label: v.label,
            value: a?.displayValue ?? 'n/d',
            status: statusFromScore(a?.score),
        };
    });

    // Lighthouse's own failing audits — real, per-site findings rather than a
    // canned checklist. Sorted worst first, capped so the card stays readable.
    const issues = Object.values(lr.audits ?? {})
        .filter((a: any) => typeof a?.score === 'number' && a.score < 0.9 && a.title && a.scoreDisplayMode !== 'informative')
        .sort((a: any, b: any) => a.score - b.score)
        .slice(0, 6)
        .map((a: any) => ({
            title: a.title as string,
            detail: (a.displayValue as string) || '',
        }));

    const gsc: { clicks: number; impressions: number; ctr: number; position: number } | null =
        gscRows.length > 0
            ? gscRows.reduce<{ clicks: number; impressions: number; ctr: number; position: number }>(
                (acc, r) => ({
                    clicks: acc.clicks + (typeof r.clicks === 'number' ? r.clicks : 0),
                    impressions: acc.impressions + (typeof r.impressions === 'number' ? r.impressions : 0),
                    // Rates aren't summable: keep the value Windsor reports.
                    ctr: typeof r.ctr === 'number' ? r.ctr : acc.ctr,
                    position: typeof r.position === 'number' ? r.position : acc.position,
                }),
                { clicks: 0, impressions: 0, ctr: 0, position: 0 }
            )
            : null;

    const factors: SeoFactor[] = [
        {
            id: 'technical',
            label: 'SEO tecnica (Lighthouse)',
            weight: 30,
            applicable: true,
            ratio: seoScore / 100,
            detail: `${seoScore}/100 secondo Google (tag, indicizzabilità, struttura)`,
        },
        {
            id: 'performance',
            label: 'Performance e Core Web Vitals',
            weight: 30,
            applicable: true,
            ratio: perfScore / 100,
            detail: `${perfScore}/100 su mobile — ${vitals[0].label}: ${vitals[0].value}`,
        },
        {
            id: 'position',
            label: 'Posizione media organica',
            weight: 25,
            applicable: !!gsc && gsc.impressions > 0,
            // Position 1 = full marks, 20+ = none. Linear in between.
            ratio: gsc && gsc.position > 0 ? Math.max(0, Math.min(1, (20 - gsc.position) / 19)) : 0,
            detail: gsc && gsc.impressions > 0
                ? `${gsc.position.toFixed(1)} su ${gsc.impressions.toLocaleString('it-IT')} impression (1 = massimo, 20+ = nullo)`
                : 'Search Console non collegata: non valutabile',
        },
        {
            id: 'ctr',
            label: 'CTR organico',
            weight: 15,
            applicable: !!gsc && gsc.impressions > 0,
            // 5%+ is a strong organic CTR; scale linearly up to that.
            ratio: gsc ? Math.max(0, Math.min(1, gsc.ctr / 0.05)) : 0,
            detail: gsc && gsc.impressions > 0
                ? `${(gsc.ctr * 100).toFixed(2)}% (5% o più = ottimo)`
                : 'Search Console non collegata: non valutabile',
        },
    ];

    const applicable = factors.filter((f) => f.applicable);
    const totalWeight = applicable.reduce((s, f) => s + f.weight, 0);
    const score = totalWeight === 0
        ? 0
        : Math.round((applicable.reduce((s, f) => s + f.ratio * f.weight, 0) / totalWeight) * 100);

    return {
        url,
        score,
        factors,
        vitals,
        issues,
        lighthouse: { seo: seoScore, performance: perfScore },
        searchConsole: gsc,
        ranAt: new Date().toISOString(),
    };
}
