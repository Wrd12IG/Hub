// Analisi AI del sito di un cliente: legge la home, la fa riassumere a Claude in uno schema fisso e il Hub
// la mostra nella scheda "AI Intelligence" (target, competitor, interessi Meta). Funzioni pure dove possibile.

export interface SiteIntelligence {
    productDescription: string;
    uniqueValueProp: string;
    priceRange: string | null;
    businessType: string;
    targetDescription: string;
    targetAgeMin: number;
    targetAgeMax: number;
    targetGender: string;
    targetPainPoints: string[];
    targetTriggers: string[];
    territoryType: string;
    territoryCities: string[];
    territoryRegions: string[];
    territoryNotes: string | null;
    competitors: { name: string; url?: string; estimatedBudget?: string; notes?: string }[];
    metaInterests: string[];
    metaBehaviors: string[];
    metaLookalike: string | null;
    analysisNotes: string | null;
    confidenceScore: number;
    websiteScraped: boolean;
}

// ── Sicurezza: l'URL arriva da un campo modificabile, il server non deve poter essere usato per leggere la rete interna ──

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i;

function isPrivateIPv4(host: string): boolean {
    const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return false;
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Accetta solo http(s) verso host pubblici. Non risolve il DNS: un dominio che punta a un IP interno non è coperto. */
export function assertPublicHttpUrl(raw: string): URL {
    const text = (raw || '').trim();
    if (!text) throw new Error('Il cliente non ha un sito web impostato');
    let url: URL;
    try { url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`); }
    catch { throw new Error('Indirizzo del sito non valido'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Indirizzo del sito non valido');
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (PRIVATE_HOST.test(host) || isPrivateIPv4(host) || host === '::1' || host.includes(':') || !host.includes('.')) {
        throw new Error('Indirizzo del sito non consentito');
    }
    return url;
}

// ── Testo del sito ──

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&egrave;': 'è', '&agrave;': 'à', '&ograve;': 'ò', '&ugrave;': 'ù', '&igrave;': 'ì', '&eacute;': 'é' };

export function htmlToText(html: string, maxChars = 12000): string {
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
    const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? '';
    const body = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return [title && `Titolo: ${title.trim()}`, description && `Descrizione: ${description.trim()}`, body]
        .filter(Boolean).join('\n').slice(0, maxChars);
}

// ── Prompt e normalizzazione ──

export function buildPrompt(input: { name: string; industry?: string; url: string; text: string }): string {
    return `Sei un esperto di marketing digitale per aziende italiane. Analizza il sito web di un cliente di un'agenzia.

Cliente: ${input.name}
Settore indicato: ${input.industry || 'non indicato'}
Sito: ${input.url}

Testo letto dalla home del sito:
"""
${input.text}
"""

Rispondi SOLO con un JSON con esattamente questi campi (in italiano; null o [] dove il sito non permette di capirlo, senza inventare):
{
  "productDescription": "cosa vende o offre, in 1-2 frasi",
  "uniqueValueProp": "il suo elemento distintivo",
  "priceRange": "fascia di prezzo se evidente, altrimenti null",
  "businessType": "tipo di attività (es. concessionaria auto, e-commerce, ristorante)",
  "targetDescription": "chi è il cliente ideale",
  "targetAgeMin": 0, "targetAgeMax": 0, "targetGender": "tutti | uomini | donne",
  "targetPainPoints": ["problemi del cliente ideale"],
  "targetTriggers": ["motivi che lo spingono ad acquistare"],
  "territoryType": "locale | regionale | nazionale",
  "territoryCities": [], "territoryRegions": [], "territoryNotes": null,
  "competitors": [{ "name": "", "url": "", "estimatedBudget": "", "notes": "" }],
  "metaInterests": ["interessi utili per il targeting su Meta"],
  "metaBehaviors": [], "metaLookalike": null,
  "analysisNotes": "avvertenze, limiti dell'analisi, cosa verificare con il cliente",
  "confidenceScore": 0
}
confidenceScore è da 0 a 100: quanto il testo del sito basta per queste conclusioni. I competitor indicali solo se plausibili per settore e zona, e segnala in analysisNotes che vanno verificati.`;
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v.trim() : fallback);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(x => String(x ?? '').trim()).filter(Boolean) : []);
const num = (v: unknown, min: number, max: number, fallback = 0): number => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

/** Porta qualunque JSON dell'AI nello schema della scheda: array sempre array (la scheda fa .map), numeri in range. */
export function normalizeIntelligence(raw: any): SiteIntelligence {
    const r = raw && typeof raw === 'object' ? raw : {};
    // Niente chiavi `undefined`: Firestore le rifiuta e questo progetto non ha ignoreUndefinedProperties
    const competitors = (Array.isArray(r.competitors) ? r.competitors : [])
        .map((c: any) => {
            const out: { name: string; url?: string; estimatedBudget?: string; notes?: string } = { name: str(c?.name) };
            const url = strOrNull(c?.url); if (url) out.url = url;
            const budget = strOrNull(c?.estimatedBudget); if (budget) out.estimatedBudget = budget;
            const notes = strOrNull(c?.notes); if (notes) out.notes = notes;
            return out;
        })
        .filter((c: { name: string }) => c.name);
    return {
        productDescription: str(r.productDescription),
        uniqueValueProp: str(r.uniqueValueProp),
        priceRange: strOrNull(r.priceRange),
        businessType: str(r.businessType),
        targetDescription: str(r.targetDescription),
        targetAgeMin: num(r.targetAgeMin, 0, 100),
        targetAgeMax: num(r.targetAgeMax, 0, 100),
        targetGender: str(r.targetGender, 'tutti') || 'tutti',
        targetPainPoints: arr(r.targetPainPoints),
        targetTriggers: arr(r.targetTriggers),
        territoryType: str(r.territoryType),
        territoryCities: arr(r.territoryCities),
        territoryRegions: arr(r.territoryRegions),
        territoryNotes: strOrNull(r.territoryNotes),
        competitors,
        metaInterests: arr(r.metaInterests),
        metaBehaviors: arr(r.metaBehaviors),
        metaLookalike: strOrNull(r.metaLookalike),
        analysisNotes: strOrNull(r.analysisNotes),
        confidenceScore: num(r.confidenceScore, 0, 100),
        websiteScraped: true,
    };
}

/** Estrae il JSON anche se il modello lo avvolge in ```json ... ``` o aggiunge testo intorno. */
export function parseModelJson(text: string): any {
    const cleaned = text.replace(/```json\s*|```/gi, '').trim();
    try { return JSON.parse(cleaned); } catch { /* prova a ritagliare il primo oggetto */ }
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('Risposta AI non leggibile');
}
