/**
 * lib/creative/result.ts
 *
 * Normalizza la risposta dell'AI e la controlla con regole fisse (non dipendono dall'AI): lunghezza dell'aggancio,
 * hashtag, emoji, inviti artificiali all'interazione, frasi «da AI» e, soprattutto, numeri che non erano nei dati
 * forniti (un numero inventato in un post pubblicato è una smentita, non un dettaglio).
 */
import { BUSINESS_GOALS, type CreativeChannel, type CreativeItem, type CreativeRequest } from './spec';

const s = (v: unknown, max = 4000) => (typeof v === 'string' ? v.replace(/\r/g, '').trim().slice(0, max) : '');
const list = (v: unknown, maxItems: number, maxLen: number) =>
    Array.isArray(v) ? v.map((x) => s(x, maxLen)).filter(Boolean).slice(0, maxItems) : [];

export function normalizeHashtag(tag: string): string {
    const clean = tag.replace(/[^A-Za-z0-9_\u00C0-\u024F]/g, '');
    return clean ? `#${clean}` : '';
}

export function normalizeItem(raw: unknown): CreativeItem | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const slides = Array.isArray(r.slides)
        ? r.slides
              .map((x) => {
                  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
                  return { role: s(o.role, 80), text: s(o.text, 600) };
              })
              .filter((x) => x.text)
              .slice(0, 10)
        : [];
    const item: CreativeItem = {
        formula: s(r.formula, 12),
        formulaName: s(r.formulaName, 80),
        hook: s(r.hook, 400),
        caption: s(r.caption, 4000),
        slides,
        hashtags: Array.from(new Set(list(r.hashtags, 8, 60).map(normalizeHashtag).filter(Boolean))),
        spoken: s(r.spoken, 600),
        onScreen: s(r.onScreen, 200),
        visual: s(r.visual, 400),
        loopClose: s(r.loopClose, 400),
        cta: s(r.cta, 300),
        mapping: s(r.mapping, 500),
        missingData: list(r.missingData, 5, 200),
        warnings: [],
    };
    const hasContent = item.caption || item.spoken || item.slides.length > 0;
    return hasContent ? item : null;
}

// ─── Controlli ────────────────────────────────────────────────────────────────

const LIMIT_CAPTION: Record<CreativeChannel, number> = { instagram: 2200, facebook: 5000, linkedin: 3000, tiktok: 2200, youtube: 100 };
const FOLD: Partial<Record<CreativeChannel, number>> = { instagram: 125, linkedin: 140 };

const BAIT = /(commenta(te)?\s+(["“«]?s[iì]|con)|tagga(te)?\s|tag\s+\d|metti(ti)?\s+(un\s+)?(mi\s+piace|like)|doppio\s+(tap|clic)|condividi\s+(se|con\s+tutti)|segui\s+e\s+(metti|commenta))/i;
const AI_TELLS: [RegExp, string][] = [
    [/nel\s+mondo\s+(di\s+oggi|frenetico|digitale)|in\s+un\s+mondo\s+(in\s+continua|che)/i, "«nel mondo di oggi…» è un'apertura da AI"],
    [/game[\s-]?changer|rivoluzion|a\s+360\s*°|a\s+360\s+gradi|al\s+livello\s+successivo/i, 'espressione da brochure («game changer», «rivoluzionario», «al livello successivo»)'],
    [/siamo\s+(lieti|entusiasti|felici|orgogliosi)\s+di\s+(annunciare|presentare|comunicare)/i, '«siamo lieti/entusiasti di annunciare» è un\'apertura aziendale: dì la cosa'],
    [/(scopri|ti\s+sveliamo|ecco)\s+(il\s+segreto|cosa\s+nessuno)|quello\s+che\s+nessuno\s+ti\s+dice/i, 'rivelazione fabbricata («il segreto…», «quello che nessuno ti dice»)'],
    [/(^|\n)\s*il\s+risultato\?/i, '«Il risultato?» è un ponte retorico da AI'],
    [/non\s+è\s+(solo|soltanto)\s+[^.\n]{2,60},?\s+(è|ma)\s/i, 'parallelismo negativo «non è solo X, è Y»'],
    [/immergiti|sfrutta\s+al\s+massimo|porta\s+(il|la)\s+tu[oa]\s+\w+\s+(a|al)/i, 'verbo da brochure («immergiti», «sfrutta al massimo»)'],
    [/\b(vero|sinceramente|onestamente),?\s+(parliamoci\s+chiaro|ti\s+dico)|parliamoci\s+chiaro/i, 'sincerità annunciata («parliamoci chiaro»): serve un fatto datato'],
];
const ACTION = /\b(chiam\w+|scriv\w+|prenot\w+|richied\w+|contatt\w+|compil\w+|vieni|veni\w+|passa|passate|whatsapp|messaggio|dm|link|clicca|visita|preventiv\w+|test\s*drive|telefon\w+|iscriv\w+|registr\w+|ordina|acquist\w+)\b/i;
const EMOJI = /[\uD83C-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/g;

/** Numeri (≥ 11 o con decimali/separatori) che compaiono nel testo generato ma non in quello fornito dall'utente. */
export function inventedNumbers(generated: string, provided: string): string[] {
    const grab = (t: string) => (t.match(/\d[\d.,]*\d|\d/g) || []).map((n) => n.replace(/[.,]$/, ''));
    const known = new Set(grab(provided).flatMap((n) => [n, n.replace(/[.,]/g, '')]));
    const out = new Set<string>();
    for (const n of grab(generated)) {
        const plain = n.replace(/[.,]/g, '');
        if (!n.includes('.') && !n.includes(',') && Number(n) <= 10) continue; // conteggi strutturali: «5 errori», «3 passaggi»
        if (known.has(n) || known.has(plain)) continue;
        out.add(n);
    }
    return Array.from(out);
}

function allText(i: CreativeItem): string {
    return [i.hook, i.caption, i.spoken, i.onScreen, i.visual, i.loopClose, i.cta, ...i.slides.map((x) => x.text)].filter(Boolean).join('\n');
}

export function auditItem(item: CreativeItem, req: Pick<CreativeRequest, 'channel' | 'kind' | 'topic' | 'facts' | 'source'> & { goal?: CreativeRequest['goal'] }): string[] {
    const w: string[] = [];
    const text = allText(item);
    const provided = `${req.topic}\n${req.facts}\n${req.source}`;

    const fold = FOLD[req.channel];
    const lead = item.hook || item.caption.split('\n')[0] || '';
    if (fold && lead.length > fold) w.push(`L'aggancio è di ${lead.length} caratteri: ${req.channel === 'instagram' ? 'Instagram' : 'LinkedIn da telefono'} nasconde il resto dopo ~${fold}. Deve reggere da solo prima.`);
    if (item.caption.length > LIMIT_CAPTION[req.channel]) w.push(`Il testo supera i ${LIMIT_CAPTION[req.channel]} caratteri consentiti su ${req.channel}.`);

    const maxTags = req.channel === 'instagram' || req.channel === 'tiktok' ? 5 : req.channel === 'linkedin' ? 3 : 2;
    if (item.hashtags.length > maxTags) w.push(`Troppi hashtag (${item.hashtags.length}): su ${req.channel} ne bastano ${maxTags} ben scelti.`);
    if (item.hashtags.length > 0) w.push('Gli hashtag sono ipotesi sulla dimensione: controlla i volumi cercandoli nell\'app prima di usarli.');

    const emoji = (text.match(EMOJI) || []).length;
    if (emoji > 3) w.push(`Troppe emoji (${emoji}): meglio al massimo 3, messe con uno scopo.`);

    if (BAIT.test(text)) w.push('Contiene un invito artificiale all\'interazione («commenta SÌ», «tagga…»): le piattaforme lo penalizzano.');
    for (const [re, msg] of AI_TELLS) if (re.test(text)) w.push(`Suona da AI: ${msg}.`);

    const words = text.split(/\s+/).filter(Boolean).length || 1;
    const dashes = (text.match(/—/g) || []).length;
    if (dashes > Math.max(1, Math.round(words / 100))) w.push(`Troppi trattini lunghi (${dashes}): un buon segnale di testo scritto da AI.`);

    const fake = inventedNumbers(text, provided);
    if (fake.length > 0) w.push(`Numeri non presenti nei dati forniti: ${fake.join(', ')}. Verificali o toglili: un dato inventato, pubblicato, è una smentita.`);

    if (req.goal && BUSINESS_GOALS.includes(req.goal)) {
        const ctaText = req.kind === 'hooks' ? item.cta : [item.caption, ...item.slides.slice(-1).map((x) => x.text)].join('\n');
        if (!ACTION.test(ctaText)) w.push('Obiettivo di business ma manca un invito diretto (chiama, scrivi, prenota, richiedi…): senza un passo chiaro il contenuto non porta contatti.');
    }
    if (req.kind === 'carousel' && (item.slides.length < 4 || item.slides.length > 10)) w.push(`Il carosello ha ${item.slides.length} slide: servono da 4 a 10.`);
    if (req.kind === 'hooks' && item.spoken && item.onScreen && item.spoken.toLowerCase().includes(item.onScreen.toLowerCase())) w.push('Il testo a schermo ripete la frase parlata: devono dire cose diverse (molti guardano senza audio).');
    return w;
}

export function finalizeItems(rawItems: unknown, req: CreativeRequest): CreativeItem[] {
    const arr = Array.isArray(rawItems) ? rawItems : [];
    return arr
        .map(normalizeItem)
        .filter((x): x is CreativeItem => !!x)
        .map((x) => ({ ...x, warnings: auditItem(x, req) }));
}
