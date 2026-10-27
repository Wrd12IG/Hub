/**
 * lib/ped-plan/checks.ts
 *
 * Controlli fissi sul piano (non dipendono dall'AI), portati in italiano dagli strumenti delle skill: hookscore.py,
 * beats.py e le regole di ig-carousel, ig-story, ig-caption e ig-plan. Segnalano gli errori evidenti; non prevedono quanto
 * un contenuto andrà bene (lo decidono volto, montaggio, audio e a chi Instagram lo mostra).
 */
import { auditItem, normalizeItem } from '@/lib/creative/result';
import type { CarouselPlan, PlanPost, ReelPlan, SkeletonPost, StoryPlan } from './spec';

const WORD_RE = /[A-Za-zÀ-ÿ0-9%€$'’-]+/g;
export const words = (t: string): string[] => (t.replace(/(\d)[.,](?=\d)/g, '$1').match(WORD_RE) || []);

/** ≈ 155 parole al minuto: una voce italiana naturale (la skill originale, in inglese, usa 165). */
export const WORDS_PER_SECOND = 155 / 60;
export const spokenSeconds = (t: string) => words(t).length / WORDS_PER_SECOND;

const NUMBER = /\d|\b(zero|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|venti|trenta|cento|mille|milione|metà|doppio)\b/i;
/** Un nome proprio non a inizio frase (la maiuscola iniziale non conta come concretezza). */
function hasProperNoun(text: string): boolean {
    const tokens = text.split(/\s+/).filter(Boolean);
    return tokens.some((tok, i) => i > 0 && !/[.!?:]$/.test(tokens[i - 1]) && /^[A-ZÀ-Ý][a-zà-ÿ]{2,}/.test(tok));
}
const STAKES = new Set(['smetti', 'smettila', 'mai', 'sbagliato', 'sbagliata', 'errore', 'errori', 'perso', 'perdi', 'perdere', 'costato', 'costa', 'nessuno', 'non', 'senza', 'prima', 'fino', 'invece', 'ma', 'tranne', 'problema', 'rischio', 'attenzione', 'rimpiangi', 'gratis', 'pagato', 'risparmiato', 'segreto', 'verità', 'bugia', 'peggiore', 'sprecato', 'truffa', 'ancora', 'già', 'solo', 'contro', 'vs', 'davvero', 'finalmente', 'basta', 'stop', 'fallito', 'rovinato', 'vietato', 'colpa', 'rifiuto', 'rimborso']);
const WEAK_OPENERS = ['ciao', 'salve', 'buongiorno', 'buonasera', 'ehi', 'allora', 'ok', 'okay', 'oggi', 'benvenuti', 'guarda', 'guardate', 'sapete', 'vi mostro', 'ti mostro', 'in questo video', 'in questo reel', 'oggi vi', 'vi voglio', 'volevo', 'ti sei mai', 'vi siete mai', 'sai che', 'parliamo di'];
const DEALBREAKERS: [RegExp, string][] = [
    [/^\s*(?:fermati|non scorrere|ferma lo scroll)/i, 'Apre con «fermati»: chiedere attenzione dimostra di non averla guadagnata.'],
    [/\b(?:in questo (?:video|reel)|oggi (?:ti|vi) (?:mostro|spiego|racconto)|ora (?:ti|vi) (?:mostro|spiego))\b/i, 'Premessa da video: togli tutto e apri sul risultato.'],
    [/^\s*(?:ciao|salve|buongiorno|buonasera|ehi)\b/i, 'Saluto: nessuno è venuto nel feed per essere salutato.'],
    [/(?:^|\s)#\w+/, 'Hashtag nell\'aggancio: gli hashtag stanno in fondo alla didascalia.'],
    [/[\uD83C-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/, 'Emoji nell\'aggancio: a quella dimensione c\'è posto per le parole o per un\'emoji, non per tutte e due.'],
];

export interface HookScore { score: number; notes: string[] }

/** Indicatore 0-100 della frase detta nei primi 2 secondi. */
export function hookScore(text: string): HookScore {
    const t = text.trim();
    const w = words(t);
    const n = w.length;
    const notes: string[] = [];
    if (n === 0) return { score: 0, notes: ['Aggancio vuoto.'] };

    // 1. Lunghezza: si deve poter dire in ~2 secondi (5-12 parole, meno di ~70 caratteri)
    let length = n >= 5 && n <= 12 ? 100 : n < 5 ? Math.max(0, 100 - (5 - n) * 20) : Math.max(0, 100 - (n - 12) * 11);
    if (t.length > 70) length -= 12;
    length = Math.max(0, length);
    if (n > 12) notes.push(`Aggancio lungo (${n} parole, ~${spokenSeconds(t).toFixed(1)} s): si perde la decisione del pollice.`);
    if (n < 5) notes.push('Aggancio troppo corto: manca qualcosa di preciso.');

    // 2. Concretezza: un numero o un nome vale più di tre astrazioni
    const concrete = NUMBER.test(t) || hasProperNoun(t) || /[€%]/.test(t);
    const specificity = concrete ? 100 : 30;
    if (!concrete) notes.push('Nessun numero né nome: gli agganci senza qualcosa di verificabile vengono scrollati.');

    // 3. Posta in gioco: parole che mettono qualcosa sul tavolo
    const stakes = w.some((x) => STAKES.has(x.toLowerCase())) ? 100 : 40;
    if (stakes < 100) notes.push('Manca la posta in gioco (un costo, un errore, un «non»): è una constatazione, non un motivo per restare.');

    // 4. Apertura debole
    const lower = t.toLowerCase();
    const weak = WEAK_OPENERS.find((o) => lower === o || lower.startsWith(`${o} `) || lower.startsWith(`${o},`));
    if (weak) notes.push(`Apre con «${weak}»: spreca il primo secondo.`);

    let score = 0.3 * length + 0.3 * specificity + 0.25 * stakes + 0.15 * (weak ? 0 : 100);
    for (const [re, msg] of DEALBREAKERS) if (re.test(t)) { notes.push(msg); score = Math.min(score, 40); }
    return { score: Math.round(score), notes };
}

// ─── Reel ─────────────────────────────────────────────────────────────────────

export const HOOK_WINDOW = 3;
export const MAX_BEAT = 4;

export function auditReel(reel: ReelPlan, hookSpoken: string): string[] {
    const w: string[] = [];
    let clock = 0;
    const starts: number[] = [];
    reel.script.forEach((line, i) => {
        const dur = spokenSeconds(line);
        starts.push(clock);
        if (i === 0 && dur > HOOK_WINDOW) w.push(`La prima battuta dura ${dur.toFixed(1)} s: l'aggancio deve stare in ${HOOK_WINDOW} s (circa ${Math.floor(HOOK_WINDOW * WORDS_PER_SECOND)} parole).`);
        else if (dur > MAX_BEAT) w.push(`La battuta ${i + 1} dura ${dur.toFixed(1)} s: oltre ${MAX_BEAT} s sulla stessa inquadratura la gente se ne va. Spezzala o cambia cosa si vede.`);
        clock += dur;
    });
    const total = clock;
    if (total < 7) w.push(`Il Reel dura circa ${total.toFixed(0)} s: sotto i 7 s i contatori si gonfiano e il resto no.`);
    if (total > 60) w.push(`Il Reel dura circa ${total.toFixed(0)} s: l'intervallo di lavoro è 15-45 s.`);
    if (Math.abs(total - reel.durationSec) > Math.max(6, reel.durationSec * 0.3)) w.push(`Il copione dura ~${total.toFixed(0)} s ma la durata dichiarata è ${reel.durationSec} s.`);

    // L'ultima battuta deve richiamare una parola dell'aggancio (il ciclo del replay)
    const STOP = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'di', 'a', 'da', 'in', 'con', 'su', 'per', 'e', 'o', 'ma', 'che', 'è', 'non', 'ho', 'hai', 'ha', 'mi', 'ti', 'si', 'ci', 'del', 'della', 'dei', 'delle', 'al', 'alla']);
    const key = (t: string) => new Set(words(t).map((x) => x.toLowerCase()).filter((x) => x.length > 2 && !STOP.has(x)));
    const first = key(hookSpoken || reel.script[0]);
    const last = key(reel.script[reel.script.length - 1]);
    if (first.size && last.size && !Array.from(first).some((x) => last.has(x))) w.push('L\'ultima battuta non richiama una parola dell\'aggancio: il replay non si chiude.');

    // Testi a schermo: massimo sei parole, la prima scheda subito
    reel.cards.forEach((c, i) => { if (words(c.text).length > 6) w.push(`La scheda a schermo ${i + 1} ha più di 6 parole: si legge da lontano, prima di ascoltare.`); });
    if (reel.cards.length > 0 && reel.cards[0].from > 0.5) w.push('La prima scheda a schermo parte dopo il primo fotogramma: l\'aggancio scritto deve esserci subito.');
    if (reel.cards.length === 0) w.push('Mancano i testi a schermo: molti guardano senza audio.');
    return w;
}

// ─── Carosello ────────────────────────────────────────────────────────────────

export function auditCarousel(c: CarouselPlan): string[] {
    const w: string[] = [];
    const n = c.slides.length;
    if (n < 6 || n > 10) w.push(`Il carosello ha ${n} slide: ne servono da 6 a 10 (sotto 5 lo scorrimento non parte, sopra 10 nessuno arriva in fondo).`);
    const cover = c.slides[0];
    if (cover) {
        if (cover.role !== 'copertina') w.push('La prima slide deve essere la copertina.');
        if (words(cover.headline).length > 6) w.push(`La copertina ha ${words(cover.headline).length} parole: massimo 6, si legge nella miniatura della griglia.`);
    }
    if (!c.slides.some((s) => s.role === 'riassunto')) w.push('Manca la slide di riassunto (quella che si salva e si manda).');
    const last = c.slides[n - 1];
    if (last && last.role !== 'invito') w.push('L\'ultima slide deve essere l\'invito (un\'azione sola).');
    if (c.slides.filter((s) => s.role === 'invito').length > 1) w.push('Più di un invito: ne basta uno.');
    c.slides.forEach((s, i) => {
        if (s.role === 'idea' && (words(s.headline).length < 3 || words(s.headline).length > 7)) w.push(`Slide ${i + 1}: il titolo dovrebbe avere da 3 a 7 parole (ne ha ${words(s.headline).length}).`);
        if (words(s.body).length > 25) w.push(`Slide ${i + 1}: ${words(s.body).length} parole di testo, massimo 25: se serve un paragrafo sono due slide.`);
    });
    return w;
}

// ─── Storie ───────────────────────────────────────────────────────────────────

export function auditStory(st: StoryPlan): string[] {
    const w: string[] = [];
    const n = st.frames.length;
    if (n < 3 || n > 7) w.push(`La sequenza ha ${n} fotogrammi: da 3 a 7 (oltre, gli ultimi li vede nessuno).`);
    const stickerAt = st.frames.findIndex((f) => f.sticker);
    if (stickerAt < 0) w.push('Nessuno sticker: la richiesta (sondaggio, domanda, quiz) è ciò che sposta la gente nei messaggi.');
    else if (stickerAt > 4) w.push(`Lo sticker è al fotogramma ${stickerAt + 1}: mettilo al quarto, quando guardano ancora in tanti.`);
    st.frames.forEach((f, i) => { if (words(f.text).length > 22) w.push(`Fotogramma ${i + 1}: troppo testo per una storia (${words(f.text).length} parole).`); });
    if (st.frames.some((f) => f.sticker && f.sticker !== 'domanda' && f.sticker !== 'link' && f.sticker !== 'countdown' && f.options.length < 2 && f.sticker !== 'slider')) w.push('Sondaggio o quiz senza almeno due opzioni.');
    return w;
}

// ─── Post e piano ─────────────────────────────────────────────────────────────

export function auditPost(post: PlanPost, provided: string): string[] {
    const w: string[] = [];
    if (post.format === 'Reel' && post.reel) w.push(...auditReel(post.reel, post.hook.spoken));
    if (post.format === 'Carosello' && post.carousel) w.push(...auditCarousel(post.carousel));
    if (post.format === 'Storia' && post.story) w.push(...auditStory(post.story));
    if (post.format !== 'Storia' && !post.caption) w.push('Manca la didascalia.');

    // Didascalia: le stesse regole del Creative Lab (aggancio entro 125 caratteri, hashtag, emoji, frasi da AI, numeri inventati)
    const item = normalizeItem({ caption: post.caption || post.hook.spoken, hook: post.caption.split('\n')[0], hashtags: post.hashtags, spoken: post.format === 'Reel' ? post.hook.spoken : '', onScreen: post.format === 'Reel' ? post.hook.onScreen : '' });
    if (item) {
        const text = [post.reel?.script.join('\n'), post.carousel?.slides.map((s) => `${s.headline} ${s.body}`).join('\n'), post.story?.frames.map((f) => f.text).join('\n')].filter(Boolean).join('\n');
        const extra = normalizeItem({ caption: text || post.caption });
        const warn = new Set<string>();
        for (const x of auditItem(item, { channel: 'instagram', kind: 'caption', topic: '', facts: provided, source: '' })) warn.add(x);
        if (extra && text) for (const x of auditItem(extra, { channel: 'instagram', kind: 'caption', topic: '', facts: provided, source: '' })) if (/Numeri non presenti|Suona da AI|invito artificiale/.test(x)) warn.add(x);
        // «Gli hashtag sono ipotesi» è un promemoria, non un difetto del post: si dice una volta sola nel piano
        w.push(...Array.from(warn).filter((x) => !x.startsWith('Gli hashtag sono ipotesi')));
    }
    return w;
}

/** Il piano nel suo insieme (ig-plan): mix di formati, nessun tipo uguale di fila, almeno 3 Reel su 5. */
export function auditPlan(posts: Pick<SkeletonPost, 'date' | 'format' | 'postType'>[]): string[] {
    const w: string[] = [];
    const n = posts.length;
    if (n === 0) return ['Il piano è vuoto.'];
    const reels = posts.filter((p) => p.format === 'Reel').length;
    if (reels / n < 0.5) w.push(`Solo ${reels} Reel su ${n}: sono l'unico formato che raggiunge in modo affidabile chi non ti segue (ne servono almeno la metà).`);
    for (let i = 1; i < n; i++) if (posts[i].postType === posts[i - 1].postType) { w.push(`Due contenuti di tipo «${posts[i].postType}» di fila (${posts[i - 1].date} e ${posts[i].date}): alterna.`); break; }
    const perDay: Record<string, number> = {};
    posts.filter((p) => p.format !== 'Storia').forEach((p) => { perDay[p.date] = (perDay[p.date] || 0) + 1; });
    const double = Object.entries(perDay).find(([, c]) => c > 1);
    if (double) w.push(`Due contenuti nello stesso giorno (${double[0]}): uno al giorno basta.`);
    return w;
}
