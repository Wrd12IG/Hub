/**
 * lib/site-monitor/group.ts
 *
 * Dai problemi trovati ai task: si raggruppano per pagina e tipo (un task per gruppo, non per riga), si scelgono i più importanti entro un
 * tetto, e per ognuno si scrive la bozza del task con la proposta di cosa fare. Le proposte sono modelli fissi in italiano: dicono cosa
 * correggere sulla base di ciò che è stato trovato, senza inventare cifre, prezzi o promozioni.
 */
import { canonicalUrl } from './fingerprint';
import { SEVERITY_ORDER, type Finding, type FindingType, type Severity } from './types';

export const TYPE_LABEL: Record<FindingType, string> = {
    http_error: 'pagina non raggiungibile',
    broken_link: 'link rotti',
    redirect_chain: 'link con troppi rimandi',
    empty_page: 'pagina quasi vuota',
    expired_content: 'contenuti scaduti',
    stale_copyright: 'anno del copyright fermo',
    stale_sitemap: 'sitemap non aggiornata',
    image_broken: 'immagini che non si caricano',
    image_no_alt: 'immagini senza testo alternativo',
    image_heavy: 'immagini troppo pesanti',
};

const SITE_WIDE = new Set<FindingType>(['stale_copyright', 'stale_sitemap']);

export interface FindingGroup {
    key: string;
    url: string;
    type: FindingType;
    severity: Severity;
    findings: Finding[];
}

const maxSeverity = (a: Severity, b: Severity): Severity => (SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b);

export function groupFindings(findings: Finding[]): FindingGroup[] {
    const groups = new Map<string, FindingGroup>();
    for (const f of findings) {
        const where = SITE_WIDE.has(f.type) ? new URL(canonicalUrl(f.url)).host : canonicalUrl(f.url);
        const key = `${f.type}|${where}`;
        const g = groups.get(key);
        if (g) {
            g.findings.push(f);
            g.severity = maxSeverity(g.severity, f.severity);
        } else groups.set(key, { key, url: f.url, type: f.type, severity: f.severity, findings: [f] });
    }
    return Array.from(groups.values());
}

export interface SelectOptions {
    max?: number;
    minSeverity?: Severity;
}

/** I gruppi che meritano un task: gravità almeno `minSeverity` (media), i più gravi e i più numerosi per primi, entro `max` (10). */
export function selectForTasks(groups: FindingGroup[], { max = 10, minSeverity = 'media' }: SelectOptions = {}): FindingGroup[] {
    return groups
        .filter((g) => SEVERITY_ORDER[g.severity] >= SEVERITY_ORDER[minSeverity])
        .sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity] || b.findings.length - a.findings.length || a.url.localeCompare(b.url))
        .slice(0, Math.max(0, max));
}

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const italianDate = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

/** Cosa fare, in una riga, per un singolo problema. Modelli fissi: nessuna invenzione. */
export function proposalFor(f: Finding, now: Date): string {
    switch (f.type) {
        case 'expired_content': return 'Aggiornare o togliere il contenuto: la data indicata è già passata.';
        case 'stale_copyright': return `Aggiornare l'anno nel piè di pagina (oggi è il ${now.getUTCFullYear()}) o farlo aggiornare in automatico.`;
        case 'stale_sitemap': return 'Rigenerare la sitemap e farla aggiornare a ogni modifica del sito.';
        case 'image_no_alt': return 'Aggiungere un testo alternativo che descriva l\'immagine (o alt vuoto se è solo decorativa).';
        case 'image_broken': return 'Sostituire o togliere l\'immagine: non si carica.';
        case 'image_heavy': return 'Ridurre il peso dell\'immagine (compressione, formato WebP).';
        case 'http_error': return 'Ripristinare la pagina o rimandare l\'indirizzo a una pagina valida (rimando 301).';
        case 'broken_link': return 'Correggere o togliere il link.';
        case 'redirect_chain': return 'Far puntare il link direttamente alla destinazione finale.';
        case 'empty_page': return 'Aggiungere i contenuti alla pagina oppure toglierla dal sito e dalla sitemap.';
    }
}

const PRIORITY: Record<Severity, 'Bassa' | 'Media' | 'Alta'> = { bassa: 'Bassa', media: 'Media', alta: 'Alta' };
const BASE_MINUTES: Record<FindingType, number> = {
    http_error: 30, broken_link: 20, redirect_chain: 15, empty_page: 30, expired_content: 20,
    stale_copyright: 10, stale_sitemap: 30, image_broken: 15, image_no_alt: 10, image_heavy: 15,
};
const MAX_LISTED = 8;
const MAX_TITLE = 120;

export interface TaskDraft {
    title: string;
    description: string;
    priority: 'Bassa' | 'Media' | 'Alta';
    /** Minuti stimati. */
    estimatedDuration: number;
}

export function buildTaskDraft(group: FindingGroup, opts: { clientName: string; now: Date }): TaskDraft {
    const { clientName, now } = opts;
    let path = 'tutto il sito';
    if (!SITE_WIDE.has(group.type)) {
        try { path = new URL(group.url).pathname || '/'; } catch { path = group.url; }
    }
    const title = `Sito ${clientName}: ${TYPE_LABEL[group.type]} su ${path}`.slice(0, MAX_TITLE);

    const listed = group.findings.slice(0, MAX_LISTED).map((f) => `- ${f.evidence}\n  Proposta: ${proposalFor(f, now)}`);
    const more = group.findings.length - listed.length;
    const description = [
        `Problema: ${TYPE_LABEL[group.type]} (${group.findings.length}).`,
        SITE_WIDE.has(group.type) ? `Sito: ${group.url}` : `Pagina: ${group.url}`,
        '',
        ...listed,
        more > 0 ? `- … e altri ${more}.` : '',
        '',
        `Rilevato dal Monitor sito il ${italianDate(now)}. Le proposte sono da verificare prima di modificare il sito.`,
    ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').trim();

    return {
        title,
        description,
        priority: PRIORITY[group.severity],
        estimatedDuration: Math.min(120, BASE_MINUTES[group.type] + 5 * (group.findings.length - 1)),
    };
}
