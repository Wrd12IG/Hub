/**
 * lib/ped-plan/spec.ts
 *
 * Tipi e validazione del «Piano PED»: la proposta di settimana o mese per Instagram, costruita col metodo delle skill
 * ig-plan, ig-reel, ig-carousel, ig-story e ig-caption. Il piano nasce in due tempi: lo scheletro (cosa, quando, che formato,
 * che angolo) e il dettaglio di ogni post (copione, slide, fotogrammi, didascalia).
 */
import type { CreativeGoal } from '@/lib/creative/spec';

export type PlanFormat = 'Reel' | 'Carosello' | 'Post Singolo' | 'Storia';
export type PostType = 'prova' | 'insegna' | 'opinione' | 'storia' | 'offerta';
export type StickerKind = '' | 'sondaggio' | 'domanda' | 'quiz' | 'slider' | 'link' | 'countdown';

export const FORMATS: PlanFormat[] = ['Reel', 'Carosello', 'Post Singolo', 'Storia'];
export const POST_TYPES: PostType[] = ['prova', 'insegna', 'opinione', 'storia', 'offerta'];
export const POST_TYPE_LABEL: Record<PostType, string> = { prova: 'Prova', insegna: 'Insegna', opinione: 'Opinione', storia: 'Storia', offerta: 'Offerta' };
export const STICKERS: StickerKind[] = ['', 'sondaggio', 'domanda', 'quiz', 'slider', 'link', 'countdown'];

/** Quanti contenuti per periodo (ig-plan: 4-5 post a settimana, almeno 3 Reel; le storie si pianificano a parte). */
export const POSTS_PER_PERIOD = { week: 5, month: 14 } as const;
export const LIMITS = { events: 600, facts: 1500 } as const;

export interface PlanRequest {
    period: 'week' | 'month';
    /** yyyy-MM-dd: primo giorno del periodo. */
    startDate: string;
    goal: CreativeGoal;
    events: string;
    facts: string;
}

export type PlanParse = { ok: true; value: PlanRequest } | { ok: false; error: string };

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r/g, '').trim().slice(0, max) : '');
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T12:00:00Z`).getTime());

export function parsePlanRequest(body: unknown): PlanParse {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const period = b.period === 'week' || b.period === 'month' ? b.period : null;
    if (!period) return { ok: false, error: 'Scegli se il piano è di una settimana o di un mese.' };
    const startDate = str(b.startDate, 10);
    if (!isDay(startDate)) return { ok: false, error: 'La data di inizio non è valida.' };
    const goals: CreativeGoal[] = ['leads', 'bookings', 'traffic', 'awareness', 'saves', 'shares', 'comments', 'follows'];
    const goal = goals.includes(b.goal as CreativeGoal) ? (b.goal as CreativeGoal) : 'awareness';
    const events = str(b.events, LIMITS.events), facts = str(b.facts, LIMITS.facts);
    if (typeof b.events === 'string' && b.events.length > LIMITS.events) return { ok: false, error: `Gli eventi sono troppo lunghi (massimo ${LIMITS.events} caratteri).` };
    if (typeof b.facts === 'string' && b.facts.length > LIMITS.facts) return { ok: false, error: `I dati sono troppo lunghi (massimo ${LIMITS.facts} caratteri).` };
    return { ok: true, value: { period, startDate, goal, events, facts } };
}

export interface SkeletonPost {
    id: string;
    /** yyyy-MM-dd */
    date: string;
    /** HH:mm */
    time: string;
    format: PlanFormat;
    postType: PostType;
    theme: string;
    /** L'angolo preciso: non «l'AI» ma «il preventivo perso per una virgola». */
    angle: string;
    /** Numero della formula di aggancio (hooks.ts), solo per i Reel. */
    hookFormula: number | null;
    /** Che foto servirebbe (per sceglierla dalla galleria del cliente). */
    photoBrief: string;
}

export interface ReelCard { text: string; from: number; to: number }
export interface ReelPlan { durationSec: number; script: string[]; cards: ReelCard[]; shots: string[] }
export interface CarouselSlide { role: 'copertina' | 'posta' | 'idea' | 'riassunto' | 'invito'; headline: string; body: string }
export interface CarouselPlan { slides: CarouselSlide[] }
export interface StoryFrame { text: string; sticker: StickerKind; stickerText: string; options: string[] }
export interface StoryPlan { frames: StoryFrame[] }

export interface PlanPost extends SkeletonPost {
    hook: { formulaId: number | null; spoken: string; onScreen: string; alternatives: { spoken: string; onScreen: string; score?: number }[] };
    caption: string;
    hashtags: string[];
    cta: string;
    /** Descrizione dell'immagine per chi non vede (carosello e foto). */
    altText: string;
    reel?: ReelPlan;
    carousel?: CarouselPlan;
    story?: StoryPlan;
    missingData: string[];
    warnings: string[];
    /** Indicatore (0-100) della frase di apertura: non prevede le visualizzazioni, scova gli errori evidenti. */
    hookScore?: number;
}

// ─── Normalizzazione delle risposte dell'AI ──────────────────────────────────

const s = (v: unknown, max = 400) => (typeof v === 'string' ? v.replace(/\r/g, '').trim().slice(0, max) : '');
const list = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.map((x) => s(x, max)).filter(Boolean).slice(0, n) : []);
const num = (v: unknown, lo: number, hi: number, d: number) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };

export function normalizeSkeleton(raw: unknown, req: PlanRequest): SkeletonPost[] {
    const arr = Array.isArray(raw) ? raw : [];
    const start = new Date(`${req.startDate}T12:00:00Z`).getTime();
    const days = req.period === 'week' ? 7 : 31;
    const out: SkeletonPost[] = [];
    arr.forEach((r, i) => {
        if (!r || typeof r !== 'object') return;
        const o = r as Record<string, unknown>;
        const format = FORMATS.includes(o.format as PlanFormat) ? (o.format as PlanFormat) : null;
        const postType = POST_TYPES.includes(o.postType as PostType) ? (o.postType as PostType) : 'insegna';
        const date = s(o.date, 10);
        if (!format || !isDay(date)) return;
        const t = new Date(`${date}T12:00:00Z`).getTime();
        if (t < start || t > start + days * 86_400_000) return; // fuori dal periodo richiesto
        const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(s(o.time, 5)) ? s(o.time, 5) : '19:00';
        const hf = Number(o.hookFormula);
        out.push({
            id: `p${i + 1}`, date, time, format, postType, theme: s(o.theme, 120), angle: s(o.angle, 300),
            hookFormula: format === 'Reel' && Number.isInteger(hf) && hf >= 1 && hf <= 26 ? hf : null,
            photoBrief: s(o.photoBrief, 200),
        });
    });
    return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map((p, i) => ({ ...p, id: `p${i + 1}` }));
}

const ROLES: CarouselSlide['role'][] = ['copertina', 'posta', 'idea', 'riassunto', 'invito'];

export function normalizeDetail(raw: unknown, base: SkeletonPost): PlanPost | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, any>;
    const hook = (o.hook && typeof o.hook === 'object' ? o.hook : {}) as Record<string, any>;
    const hf = Number(hook.formulaId);
    const post: PlanPost = {
        ...base,
        hook: {
            formulaId: Number.isInteger(hf) && hf >= 1 && hf <= 26 ? hf : base.hookFormula,
            spoken: s(hook.spoken, 220),
            onScreen: s(hook.onScreen, 80),
            alternatives: Array.isArray(hook.alternatives) ? hook.alternatives.map((a: any) => ({ spoken: s(a?.spoken, 220), onScreen: s(a?.onScreen, 80) })).filter((a: any) => a.spoken).slice(0, 2) : [],
        },
        caption: s(o.caption, 2200),
        hashtags: Array.from(new Set(list(o.hashtags, 5, 60).map((t) => t.replace(/[^A-Za-z0-9_À-ɏ]/g, '')).filter(Boolean).map((t) => `#${t}`))),
        cta: s(o.cta, 200),
        altText: s(o.altText, 300),
        missingData: list(o.missingData, 5, 200),
        warnings: [],
    };
    if (base.format === 'Reel') {
        const r = (o.reel || {}) as Record<string, any>;
        const script = list(r.script, 14, 220);
        const cards: ReelCard[] = Array.isArray(r.cards) ? r.cards.map((c: any) => ({ text: s(c?.text, 60), from: num(c?.from, 0, 120, 0), to: num(c?.to, 0, 120, 0) })).filter((c: ReelCard) => c.text && c.to > c.from).slice(0, 14) : [];
        if (script.length === 0) return null;
        post.reel = { durationSec: num(r.durationSec, 7, 90, 30), script, cards, shots: list(r.shots, 12, 200) };
        if (!post.hook.spoken) post.hook.spoken = script[0];
    } else if (base.format === 'Carosello') {
        const c = (o.carousel || {}) as Record<string, any>;
        const slides: CarouselSlide[] = Array.isArray(c.slides)
            ? c.slides.map((x: any) => ({ role: ROLES.includes(x?.role) ? x.role : 'idea', headline: s(x?.headline, 80), body: s(x?.body, 240) })).filter((x: CarouselSlide) => x.headline).slice(0, 12)
            : [];
        if (slides.length === 0) return null;
        post.carousel = { slides };
    } else if (base.format === 'Storia') {
        const st = (o.story || {}) as Record<string, any>;
        const frames: StoryFrame[] = Array.isArray(st.frames)
            ? st.frames.map((f: any) => ({ text: s(f?.text, 200), sticker: STICKERS.includes(f?.sticker) ? f.sticker : '', stickerText: s(f?.stickerText, 120), options: list(f?.options, 4, 40) })).filter((f: StoryFrame) => f.text).slice(0, 8)
            : [];
        if (frames.length === 0) return null;
        post.story = { frames };
    }
    return post.caption || post.reel || post.carousel || post.story ? post : null;
}
