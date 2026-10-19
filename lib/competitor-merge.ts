// Porta nel monitoraggio notturno (Setup API → Competitor) i concorrenti trovati dall'analisi AI.
// Regole: al massimo 5 in tutto, serve il sito (è quello che il Hub legge ogni notte), niente doppioni per dominio
// né per nome (la stessa azienda con un altro sito, es. "Autosilano" con autosilano.it e autosilanotoyota.it).

export const MAX_COMPETITORS = 5;

export interface MonitoredCompetitor {
    id: string;
    nome: string;
    sito: string;
    instagram?: string;
    facebook?: string;
    linkedin?: string;
}

export interface AiCompetitor { name?: string; url?: string }

export interface MergeResult {
    merged: MonitoredCompetitor[];
    added: { nome: string; sito: string }[];
    skippedNoUrl: string[];
    skippedDuplicate: string[];
    skippedFull: string[];
}

/** "https://www.Esempio.it/pagina" → "esempio.it": serve solo per riconoscere lo stesso sito scritto in modi diversi. */
export function domainOf(raw: string): string {
    const text = (raw || '').trim();
    if (!text) return '';
    try {
        return new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`).hostname.replace(/^www\./i, '').toLowerCase();
    } catch { return ''; }
}

const normName = (n: string) =>
    (n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Stesso nome, oppure uno che inizia con l'altro come parole intere ("autosilano" e "autosilano toyota"). Sotto 4 lettere non si confronta. */
export function sameBusinessName(a: string, b: string): boolean {
    const x = normName(a);
    const y = normName(b);
    if (x.length < 4 || y.length < 4) return false;
    return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
}

export function mergeCompetitors(existing: MonitoredCompetitor[], incoming: AiCompetitor[], max = MAX_COMPETITORS): MergeResult {
    const merged = [...existing];
    const known = new Set(existing.map(c => domainOf(c.sito)).filter(Boolean));
    const usedIds = new Set(existing.map(c => c.id));
    const result: MergeResult = { merged, added: [], skippedNoUrl: [], skippedDuplicate: [], skippedFull: [] };

    for (const c of incoming) {
        const nome = (c.name || '').trim().slice(0, 80);
        const domain = domainOf(c.url || '');
        const label = nome || c.url || '(senza nome)';
        if (!domain) { result.skippedNoUrl.push(label); continue; }
        if (known.has(domain) || (nome && merged.some(m => sameBusinessName(m.nome, nome)))) { result.skippedDuplicate.push(label); continue; }
        if (merged.length >= max) { result.skippedFull.push(label); continue; }

        let n = merged.length + 1;
        while (usedIds.has(`c${n}`)) n++;
        const id = `c${n}`;
        const sito = /^https?:\/\//i.test(c.url!.trim()) ? c.url!.trim() : `https://${c.url!.trim()}`;
        merged.push({ id, nome: nome || domain, sito });
        usedIds.add(id);
        known.add(domain);
        result.added.push({ nome: nome || domain, sito });
    }
    return result;
}
