// Ricerca dei competitor veri di un cliente: Claude propone (con ricerca web), il Hub VERIFICA che ogni sito esista
// e risponda prima di salvarlo. Un nome o un sito inventati dall'AI non arrivano mai nella scheda.
import { domainOf } from '@/lib/competitor-merge';
import { fetchPage } from '@/lib/safe-fetch';
import { stripCitations, trimToSentence } from '@/lib/clean-text';

export interface CompetitorCandidate { name: string; url: string; city?: string; kind?: string; why?: string; weak?: string }

export interface SavedCompetitor {
    name: string;
    url: string;
    city?: string;
    kind?: string;
    /** Perché è un concorrente diretto (la scheda lo mostra come "Punti di forza"). */
    strength?: string;
    weakness?: string;
    adStyle?: string;
    adAnalysis?: AdAnalysis;
    /** Fonti (URL) su cui poggia l'analisi di forza/debolezza e quando è stata fatta. */
    weaknessSources?: string[];
    analyzedAt?: number;
    analysisNote?: string;
    verified?: boolean;
    verifiedAt?: number;
    siteTitle?: string;
    source?: 'claude-web' | 'claude';
    [key: string]: unknown;
}

export interface AdAnalysis { angles: string[]; hooks: string[]; ctas: string[]; offers: string[]; analyzedAt: number }

// Portali, social e directory: non sono il sito del concorrente
const PORTALS = ['autoscout24', 'subito.it', 'facebook.com', 'instagram.com', 'linkedin.com', 'paginegialle', 'google.', 'youtube.com',
    'wikipedia.org', 'tiktok.com', 'automoto.it', 'concessionarie.info', 'tiendeo', 'doveconviene', 'motori', 'comprauto', 'nextdoor', 'mobility.it'];

const str = (v: unknown) => (typeof v === 'string' ? stripCitations(v) : '');

export function buildDiscoveryPrompt(input: { name: string; websiteUrl?: string; businessType?: string; territory?: string; product?: string }): string {
    return `Sei un analista di marketing per aziende italiane. Trova i concorrenti DIRETTI REALI di questo cliente.

Cliente: ${input.name}
Sito: ${input.websiteUrl || 'non indicato'}
Attività: ${input.businessType || 'non indicata'}
Territorio: ${input.territory || 'non indicato'}
Cosa vende: ${input.product || 'non indicato'}

Regole:
- Solo attività REALI, con nome e sito web ufficiale che hai trovato o di cui sei certo. Se non sei sicuro, escludila.
- L'URL deve essere il sito dell'azienda, NON un portale, un social o una directory (no AutoScout24, Facebook, Pagine Gialle...).
- Stessa categoria del cliente e area raggiungibile dai suoi clienti (entro circa 40 km dalle sedi indicate).
- Escludi il cliente stesso e le aziende dello stesso gruppo.
- Fino a 8 candidati, i più rilevanti per primi.
- "weak" è un punto debole REALE e verificabile di quel concorrente, emerso da ciò che hai trovato (recensioni negative ricorrenti, sito lento o senza prezzi, offerta poco visibile, presenza social trascurata, copertura limitata). Una frase, concreta. Se non hai trovato evidenze, lascia "weak" vuoto: NON inventare lacune generiche.

Rispondi SOLO con questo JSON:
{ "competitors": [ { "name": "", "url": "https://", "city": "", "kind": "es. concessionaria ufficiale, multimarca usato/km0", "why": "perché è un concorrente diretto, una frase", "weak": "punto debole verificato, oppure vuoto" } ] }`;
}

/** Porta l'output dell'AI nella forma dei candidati; scarta portali, voci senza nome/URL e doppioni. */
export function normalizeCandidates(raw: any): CompetitorCandidate[] {
    const list: any[] = Array.isArray(raw?.competitors) ? raw.competitors : Array.isArray(raw) ? raw : [];
    const seen = new Set<string>();
    const out: CompetitorCandidate[] = [];
    for (const c of list) {
        const name = str(c?.name).slice(0, 80);
        const url = str(c?.url);
        const domain = domainOf(url);
        if (!name || !domain) continue;
        if (PORTALS.some(p => domain.includes(p))) continue;
        if (seen.has(domain)) continue;
        seen.add(domain);
        const cand: CompetitorCandidate = { name, url: /^https?:\/\//i.test(url) ? url : `https://${url}` };
        if (str(c?.city)) cand.city = str(c.city).slice(0, 60);
        if (str(c?.kind)) cand.kind = str(c.kind).slice(0, 80);
        if (str(c?.why)) cand.why = str(c.why).slice(0, 300);
        if (str(c?.weak)) cand.weak = str(c.weak).slice(0, 300);
        out.push(cand);
    }
    return out;
}

const titleOf = (html: string) => html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim().slice(0, 120) ?? '';

export interface VerifyResult {
    verified: SavedCompetitor[];
    rejected: { name: string; url: string; reason: string }[];
}

/**
 * Controlla che ogni sito esista e risponda (con la lettura sicura: solo host pubblici, redirect controllati).
 * `fetcher` è iniettabile per i test.
 */
export async function verifyCandidates(
    candidates: CompetitorCandidate[],
    opts: { ownDomains?: string[]; max?: number; source?: SavedCompetitor['source']; fetcher?: typeof fetchPage } = {},
): Promise<VerifyResult> {
    const { ownDomains = [], max = 6, source = 'claude-web', fetcher = fetchPage } = opts;
    const own = new Set(ownDomains.map(d => domainOf(d)).filter(Boolean));
    const result: VerifyResult = { verified: [], rejected: [] };

    const eligible = candidates.filter(c => {
        if (own.has(domainOf(c.url))) { result.rejected.push({ name: c.name, url: c.url, reason: 'È il sito del cliente' }); return false; }
        return true;
    });

    // A gruppi di 4 in parallelo: velocità senza martellare i siti
    for (let i = 0; i < eligible.length && result.verified.length < max; i += 4) {
        const chunk = eligible.slice(i, i + 4);
        const settled = await Promise.allSettled(chunk.map(c => fetcher(c.url, 8_000)));
        settled.forEach((r, k) => {
            const c = chunk[k];
            if (r.status === 'rejected') {
                result.rejected.push({ name: c.name, url: c.url, reason: String(r.reason?.message || r.reason).slice(0, 120) });
                return;
            }
            if (result.verified.length >= max) return;
            const saved: SavedCompetitor = { name: c.name, url: r.value.url, verified: true, verifiedAt: Date.now(), source };
            if (c.city) saved.city = c.city;
            if (c.kind) saved.kind = c.kind;
            if (c.why) saved.strength = c.why;
            if (c.weak) saved.weakness = c.weak;
            const title = titleOf(r.value.html);
            if (title) saved.siteTitle = title;
            result.verified.push(saved);
        });
    }
    return result;
}

/**
 * Aggiorna l'elenco: tiene chi ha già un sito o è stato aggiunto a mano, toglie le voci senza sito (categorie generiche
 * dell'analisi: non si possono monitorare e non portano dati), aggiunge i nuovi verificati non già presenti per dominio.
 */
export function mergeDiscovered(existing: SavedCompetitor[], found: SavedCompetitor[]): { list: SavedCompetitor[]; added: number; removed: number; updated: number } {
    if (found.length === 0) return { list: existing, added: 0, removed: 0, updated: 0 };
    // Si tiene chi ha un sito e chi è stato aggiunto a mano (addedBy): una voce scritta da una persona non va cancellata
    const kept = existing.filter(c => c.addedBy || domainOf(String(c.url ?? c.website ?? c.sito ?? '')));
    const byDomain = new Map(found.map(c => [domainOf(c.url), c]));
    // Chi c'era già non viene riscritto, ma si completano i campi vuoti (punti di forza e deboli) con quelli appena trovati:
    // mai sovrascrivere ciò che è già scritto, a mano o da un'analisi precedente.
    let updated = 0;
    const keep = kept.map(c => {
        const f = byDomain.get(domainOf(String(c.url ?? c.website ?? c.sito ?? '')));
        if (!f) return c;
        const patch: Partial<SavedCompetitor> = {};
        if (!c.weakness && f.weakness) patch.weakness = f.weakness;
        if (!c.strength && f.strength) patch.strength = f.strength;
        if (Object.keys(patch).length === 0) return c;
        updated++;
        return { ...c, ...patch };
    });
    const known = new Set(keep.map(c => domainOf(String(c.url ?? c.website ?? c.sito ?? ''))));
    const fresh = found.filter(c => !known.has(domainOf(c.url)));
    return { list: [...keep, ...fresh], added: fresh.length, removed: existing.length - kept.length, updated };
}

// ── Analisi di uno screenshot della Ads Library ──

const list = (v: unknown, max = 8): string[] => (Array.isArray(v) ? v.map(x => str(x)).filter(Boolean).slice(0, max) : []);

export function buildVisionPrompt(input: { competitor: string; client: string; businessType?: string }): string {
    return `Questo è uno screenshot della Facebook/Instagram Ads Library con le inserzioni attive del concorrente "${input.competitor}" del nostro cliente ${input.client}${input.businessType ? ` (${input.businessType})` : ''}.
Analizza SOLO ciò che si vede nell'immagine, senza inventare. Se l'immagine non mostra inserzioni, dillo in "summary" e lascia vuote le liste.

Rispondi SOLO con questo JSON, in italiano:
{
  "summary": "stile creativo e messaggio delle inserzioni, 1-2 frasi",
  "angles": ["angoli di comunicazione usati (es. prezzo, finanziamento, urgenza, novità)"],
  "hooks": ["i ganci o titoli visibili, riportati come si leggono"],
  "ctas": ["le call to action visibili"],
  "offers": ["offerte, prezzi o promozioni visibili"],
  "weakness": "un punto debole o una lacuna che si nota, una frase, oppure stringa vuota"
}`;
}

export function normalizeAdAnalysis(raw: any): { summary: string; weakness: string; analysis: AdAnalysis } {
    const r = raw && typeof raw === 'object' ? raw : {};
    return {
        summary: str(r.summary).slice(0, 400),
        weakness: str(r.weakness).slice(0, 300),
        analysis: { angles: list(r.angles), hooks: list(r.hooks), ctas: list(r.ctas), offers: list(r.offers), analyzedAt: Date.now() },
    };
}


// ── Punti di forza e deboli di un competitor (ricerca web mirata) ──

export interface CompetitorAnalysis { strength: string; weakness: string; sources: string[]; note: string }

export function buildAnalysisPrompt(input: { competitor: string; url: string; city?: string; kind?: string; client: string; businessType?: string; territory?: string }): string {
    return `Sei un analista di marketing per aziende italiane. Valuta questo concorrente del nostro cliente cercando sul web.

Concorrente: ${input.competitor} (${input.url})${input.city ? `, ${input.city}` : ''}${input.kind ? ` — ${input.kind}` : ''}
Nostro cliente: ${input.client}${input.businessType ? ` (${input.businessType})` : ''}
Territorio: ${input.territory || 'non indicato'}

Cerca: il suo sito, le recensioni su Google e sui portali di settore, la presenza social, le offerte pubblicate.
Regole:
- Scrivi SOLO ciò che trovi, e per ogni affermazione una fonte (URL) fra quelle consultate. Niente luoghi comuni validi per chiunque.
- "weakness": le lacune concrete e verificabili (es. recensioni negative ricorrenti su un tema, sito lento o senza prezzi, nessuna offerta online, social fermi da mesi, orari o servizi limitati). Una o due frasi.
- Se non trovi evidenze di lacune, lascia "weakness" vuoto e spiegalo in "note": non inventare.
- "strength": ciò che fa bene, in una o due frasi.

Rispondi SOLO con questo JSON, in italiano:
{ "strength": "", "weakness": "", "sources": ["https://..."], "note": "" }`;
}

export function normalizeAnalysis(raw: any): CompetitorAnalysis {
    const r = raw && typeof raw === 'object' ? raw : {};
    const sources = (Array.isArray(r.sources) ? r.sources : [])
        .map((x: unknown) => str(x)).filter((u: string) => /^https?:\/\//i.test(u)).slice(0, 6);
    return { strength: trimToSentence(str(r.strength), 600), weakness: trimToSentence(str(r.weakness), 600), sources, note: trimToSentence(str(r.note), 300) };
}
