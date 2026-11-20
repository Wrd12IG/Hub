/**
 * lib/site-monitor/dates.ts
 *
 * Contenuti scaduti: date passate accanto a parole da offerta, promozione o evento («valido fino al 31/10/2025», «Black Friday 2024»).
 *
 * Regole per non segnalare a vuoto:
 * - una data vale solo se vicino (80 caratteri) c'è una parola di offerta/scadenza: «Pubblicato il 12/03/2021» non è un contenuto scaduto
 * - un intervallo («dal 01/10/2025 al 31/10/2025») conta per la sua data finale
 * - una data senza anno («entro il 31 ottobre») non si giudica: non si sa di quale anno parli
 * - il giorno stesso della scadenza non è ancora scaduto
 * Il confronto è su giorni interi in UTC: per un controllo mensile un giorno di scarto non conta.
 */
import type { Confidence, Finding, Severity } from './types';
import { cleanSnippet } from './text';

const MONTHS: Record<string, number> = {
    gennaio: 1, gen: 1, febbraio: 2, feb: 2, marzo: 3, mar: 3, aprile: 4, apr: 4, maggio: 5, mag: 5, giugno: 6, giu: 6,
    luglio: 7, lug: 7, agosto: 8, ago: 8, settembre: 9, set: 9, sett: 9, ottobre: 10, ott: 10, novembre: 11, nov: 11, dicembre: 12, dic: 12,
};
const MONTH_FULL = 'gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre';
const MONTH_ANY = `${MONTH_FULL}|gen|feb|mar|apr|mag|giu|lug|ago|sett|set|ott|nov|dic`;

const PROMO = /(?:offert[ae]|promo(?:zion[ei])?|valid[oai]|scad(?:e|enza)|entro il|fino al|fino a|sconti?|saldi|black\s*friday|cyber\s*monday|open\s*day|evento|iscrizion[ei]|concorso|campagna|prezz[oi]|listino|rottamazione|incentiv[oi]|bonus|ultimi giorni)/i;
const STRONG = /(?:valid[oai]|scad(?:e|enza)|entro il|fino al|offert[ae]|promo|sconto|sconti|saldi|black\s*friday|iscrizion|open\s*day)/i;

const NUMERIC = /(?<![\d.,/])(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}|\d{2})(?!\d)/g;
const TEXTUAL = new RegExp(`(?<!\\d)(\\d{1,2})\\s*[º°]?\\s+(?:di\\s+)?(${MONTH_ANY})\\.?\\s*,?\\s*(\\d{4})(?!\\d)`, 'gi');
const MONTH_YEAR = new RegExp(`\\b(${MONTH_FULL})\\s+(\\d{4})(?!\\d)`, 'gi');
const YEAR_KEYWORD = /\b(black\s*friday|cyber\s*monday|natale|pasqua|capodanno|ferragosto|saldi(?:\s+(?:invernali|estivi|di\s+fine\s+stagione))?|offert[ae]|promo(?:zion[ei])?|open\s*day|prezzi|listino)\s+(20\d{2})(?!\d)/gi;

type Kind = 'full' | 'month' | 'year';
interface Hit { start: number; end: number; date: Date; kind: Kind }

function validDate(y: number, m: number, d: number): Date | null {
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCMonth() === m - 1 ? date : null;   // scarta il 31/02
}
const endOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0));
const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function twoDigitYear(yy: number): number {
    return yy <= 69 ? 2000 + yy : 1900 + yy;
}

function collect(text: string): Hit[] {
    const hits: Hit[] = [];
    const overlaps = (s: number, e: number) => hits.some((h) => s < h.end && e > h.start);

    for (const m of Array.from(text.matchAll(TEXTUAL))) {
        const month = MONTHS[m[2].toLowerCase().replace('.', '')];
        const date = month ? validDate(Number(m[3]), month, Number(m[1])) : null;
        if (date) hits.push({ start: m.index!, end: m.index! + m[0].length, date, kind: 'full' });
    }
    for (const m of Array.from(text.matchAll(NUMERIC))) {
        const y = m[3].length === 2 ? twoDigitYear(Number(m[3])) : Number(m[3]);
        const date = validDate(y, Number(m[2]), Number(m[1]));
        if (date && !overlaps(m.index!, m.index! + m[0].length)) hits.push({ start: m.index!, end: m.index! + m[0].length, date, kind: 'full' });
    }
    for (const m of Array.from(text.matchAll(MONTH_YEAR))) {
        const s = m.index!, e = s + m[0].length;
        const y = Number(m[2]);
        if (!overlaps(s, e) && y >= 1990 && y <= 2100) hits.push({ start: s, end: e, date: endOfMonth(y, MONTHS[m[1].toLowerCase()]), kind: 'month' });
    }
    for (const m of Array.from(text.matchAll(YEAR_KEYWORD))) {
        const s = m.index!, e = s + m[0].length;
        if (!overlaps(s, e)) hits.push({ start: s, end: e, date: new Date(Date.UTC(Number(m[2]), 11, 31)), kind: 'year' });
    }
    return hits.sort((a, b) => a.start - b.start);
}

/** Più date vicine («dal … al …») sono un solo intervallo: conta la più lontana. */
function cluster(hits: Hit[]): Hit[] {
    const out: Hit[] = [];
    for (const h of hits) {
        const last = out[out.length - 1];
        if (last && h.start - last.end <= 30) {
            last.end = Math.max(last.end, h.end);
            if (h.date > last.date) last.date = h.date;
            if (h.kind === 'full') last.kind = 'full';
        } else out.push({ ...h });
    }
    return out;
}

const MAX_PER_PAGE = 5;

export function findExpiredContent(text: string, now: Date, url: string): Finding[] {
    const today = startOfDay(now);
    const currentYear = now.getUTCFullYear();
    const found: Array<Finding & { when: number }> = [];

    for (const hit of cluster(collect(text))) {
        const window = text.slice(Math.max(0, hit.start - 80), Math.min(text.length, hit.end + 80));
        if (hit.kind !== 'year' && !PROMO.test(window)) continue;      // una data senza parole da offerta non è un contenuto scaduto
        if (hit.date.getTime() >= today) continue;                       // oggi o in futuro: non scaduto

        let severity: Severity, confidence: Confidence;
        if (hit.kind === 'full') {
            severity = STRONG.test(window) ? 'alta' : 'media';
            confidence = STRONG.test(window) ? 'alta' : 'media';
        } else if (hit.kind === 'month') {
            severity = 'media';
            confidence = 'media';
        } else {
            severity = currentYear - hit.date.getUTCFullYear() >= 2 ? 'media' : 'bassa';
            confidence = 'bassa';
        }
        const around = cleanSnippet(text.slice(Math.max(0, hit.start - 60), Math.min(text.length, hit.end + 60)));
        const stable = around.toLowerCase().replace(/[^a-z0-9àèéìòù]+/g, ' ').trim().slice(0, 40);
        found.push({ type: 'expired_content', severity, url, key: `${isoDay(hit.date)}|${stable}`, evidence: around, confidence, when: hit.date.getTime() });
    }
    // Prima i più gravi, a parità i più vecchi: il rumore su una pagina piena di date resta limitato.
    found.sort((a, b) => (b.severity === a.severity ? a.when - b.when : severityRank(b.severity) - severityRank(a.severity)));
    return found.slice(0, MAX_PER_PAGE).map(({ when: _when, ...f }) => f);
}

const severityRank = (s: Severity) => ({ bassa: 1, media: 2, alta: 3 })[s];
