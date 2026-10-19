// Ciò che il cliente finale vede nella pagina pubblica dei risultati. Pura: nessun accesso a rete, Firestore o React.
//
// ⚠️ È una LISTA BIANCA, costruita campo per campo. Il report completo (PlatformReport) porta con sé etichette di
// account, errori tecnici, avvisi interni: niente di tutto questo deve poter uscire per distrazione, quindi qui non si
// filtra mai "togliendo" campi, si compone un oggetto nuovo con i soli campi previsti.

import type { PlatformReport } from './reporting';
import { summarizeReport } from './report-metrics';
import { computeClientHealth } from './client-health';
import { buildTrend, type DailyPoint, type TrendPoint } from './report-series';

export const PUBLIC_PERIODS = [7, 30, 90] as const;
export type PublicPeriod = (typeof PUBLIC_PERIODS)[number];

export function parsePeriod(raw: string | null | undefined): PublicPeriod {
    const n = parseInt(raw ?? '', 10);
    return (PUBLIC_PERIODS as readonly number[]).includes(n) ? (n as PublicPeriod) : 30;
}

export interface PublicReportComment {
    /** yyyy-MM */
    month: string;
    text: string;
    updatedAt: string | null;
}

export interface PublicClientReport {
    clientName: string;
    days: PublicPeriod;
    updatedAt: string | null;
    summary: {
        spend: { value: number; previous: number | null } | null;
        result: { label: string; value: number; previous: number | null; source: string } | null;
        costPerResult: number | null;
    };
    trend: { resultLabel: string; points: TrendPoint[] } | null;
    comment: PublicReportComment | null;
}

const spendOnly = (s: DailyPoint[] = []): DailyPoint[] => s.map((p) => ({ date: p.date, spend: p.spend }));

function selectTrend(platforms: PlatformReport[], days: number): PublicClientReport['trend'] {
    const meta = platforms.find((p) => p.platform === 'facebook' && p.connected)?.series;
    const google = platforms.find((p) => p.platform === 'google_ads' && p.connected)?.series;
    if (!meta?.length && !google?.length) return null;

    const health = computeClientHealth({ platforms, days });
    const source = health.sourcePlatform === 'facebook' ? meta : health.sourcePlatform === 'google_ads' ? google : undefined;
    const others = health.sourcePlatform === 'facebook' ? spendOnly(google)
        : health.sourcePlatform === 'google_ads' ? spendOnly(meta)
        : [...spendOnly(meta), ...spendOnly(google)];
    const withResults = !!source?.length;
    const points = buildTrend(source ?? [], others, withResults).map((p) => ({
        date: p.date, spend: p.spend, results: p.results, costPerResult: p.costPerResult, costPerResult7d: p.costPerResult7d,
    }));
    if (points.length === 0) return null;

    const label = withResults && health.metricLabel ? health.metricLabel.charAt(0).toUpperCase() + health.metricLabel.slice(1) : 'Risultato';
    return { resultLabel: label, points };
}

/**
 * Solo i canali che la pagina racconta (Meta Ads, Google Ads, contatti della scheda Google). Il report in cache dello
 * staff contiene anche GA4, Klaviyo, Awin… che con un report ristretto non ci sarebbero: filtrare qui rende identico il
 * risultato con cache dello staff o senza.
 */
const PUBLIC_PLATFORMS = new Set<PlatformReport['platform']>(['facebook', 'google_ads', 'gbp']);

export function buildPublicReport(input: {
    clientName: string;
    days: PublicPeriod;
    platforms: PlatformReport[];
    comment: PublicReportComment | null;
    updatedAt: string | null;
}): PublicClientReport {
    const platforms = input.platforms.filter((p) => PUBLIC_PLATFORMS.has(p.platform));
    const s = summarizeReport(platforms, input.days);
    return {
        clientName: String(input.clientName ?? ''),
        days: input.days,
        updatedAt: input.updatedAt,
        summary: {
            spend: s.spend ? { value: s.spend.value, previous: s.spend.previous } : null,
            result: s.result ? { label: s.result.label, value: s.result.value, previous: s.result.previous, source: s.result.source } : null,
            costPerResult: s.costPerResult,
        },
        trend: selectTrend(platforms, input.days),
        comment: input.comment
            ? { month: input.comment.month, text: input.comment.text, updatedAt: input.comment.updatedAt }
            : null,
    };
}
