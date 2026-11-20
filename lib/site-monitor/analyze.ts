/**
 * lib/site-monitor/analyze.ts
 *
 * Analisi di una pagina già letta: mette insieme i rilevatori. Funzione pura: niente rete, niente database, niente crediti.
 * I controlli che richiedono la rete (link e immagini raggiunti davvero) li fa chi chiama, e ne classifica l'esito con checks.ts.
 */
import { findStaleCopyright } from './copyright';
import { classifyPageCheck } from './checks';
import { findExpiredContent } from './dates';
import { extractImages, extractLinks, imageAltFindings } from './images';
import { pageText, wordCount } from './text';
import type { Finding, ImageRef, PageData } from './types';

/** Sotto questa soglia una pagina è considerata quasi vuota (compreso il titolo e la descrizione). */
export const EMPTY_PAGE_WORDS = 40;

export interface PageAnalysis {
    findings: Finding[];
    /** Per i controlli diretti fatti da chi chiama (peso, esistenza). */
    images: ImageRef[];
    links: string[];
    words: number;
}

export function analyzePage(page: PageData, now: Date): PageAnalysis {
    const broken = classifyPageCheck(page);
    if (broken) return { findings: [broken], images: [], links: [], words: 0 };

    const text = pageText(page.html);
    const words = wordCount(text);
    const images = extractImages(page.html, page.url);
    const findings: Finding[] = [];

    if (words < EMPTY_PAGE_WORDS) {
        findings.push({ type: 'empty_page', severity: 'media', url: page.url, key: 'empty', evidence: `La pagina ha solo ${words} parole di testo`, confidence: 'media' });
    }
    findings.push(...findExpiredContent(text, now, page.url));
    const copyright = findStaleCopyright(text, now, page.url);
    if (copyright) findings.push(copyright);
    findings.push(...imageAltFindings(images, page.url));

    return { findings, images, links: extractLinks(page.html, page.url), words };
}

/** Il piè di pagina è su ogni pagina: il copyright vecchio si segnala una volta per sito, non una per pagina. */
export function dedupeSiteWide(findings: Finding[]): Finding[] {
    const seen = new Set<string>();
    return findings.filter((f) => {
        if (f.type !== 'stale_copyright') return true;
        if (seen.has(f.type)) return false;
        seen.add(f.type);
        return true;
    });
}
