/**
 * lib/outreach.ts
 *
 * Il ponte tra Sellbird (il programma di outreach, che gira su un computer sempre acceso) e la hub.
 *
 * Sellbird tiene i suoi dati in un database SQLite locale. La hub non lo legge mai direttamente: uno script sul
 * computer di Sellbird (scripts/sellbird-bridge) manda qui una fotografia ogni pochi minuti, e la hub la salva in
 * Firestore. Nell'altro senso, chi approva o rifiuta una bozza dalla hub non tocca Sellbird: scrive un *comando*,
 * che lo script ritira e applica con la riga di comando di Sellbird. L'invio resta quindi sempre una decisione
 * umana e passa dalla stessa strada di prima.
 *
 * Collezioni (tutte leggibili solo tramite le route /api/outreach, vedi firestore.rules):
 *   outreachMeta/current        contatori e ora dell'ultima sincronizzazione
 *   outreachOutbox/{id}         una email in coda, inviata o rifiutata
 *   outreachCompanies/{id}      un'azienda trovata, con lo stato dei contatti
 *   outreachCommands/{id}       una richiesta di approvare/rifiutare, in attesa che il ponte la applichi
 */
import crypto from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';

export const OUTBOX_STATUSES = ['pending_review', 'approved', 'sending', 'sent', 'rejected', 'cancelled', 'failed'] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export type OutreachAction = 'approve' | 'reject';
/** Comandi senza un'email di riferimento: fermano o riprendono tutti gli invii (`sellbird sending pause|resume`). */
export type SendingAction = 'pause_sending' | 'resume_sending';
/** Azioni con parametri, scelte da una lista fissa: stima e lancio di Discover, attivazione dei segnali gratuiti. */
export type ParamAction = 'discover_estimate' | 'discover_run' | 'signals_set';
export const PARAM_ACTIONS: readonly ParamAction[] = ['discover_estimate', 'discover_run', 'signals_set'];

/** Chi sa cercare aziende: `osm` (gratis, senza account) e `serper` (a pagamento, con la chiave nel server). Il resto non si lancia dalla hub. */
export const DISCOVER_PROVIDERS = ['osm', 'serper'] as const;
export type DiscoverProvider = (typeof DISCOVER_PROVIDERS)[number];
/** Tetto di spesa per ogni ricerca lanciata dalla hub, in dollari. Il ponte ha il suo (OUTREACH_MAX_DISCOVER_SPEND) e vale il più basso. */
export const DISCOVER_HARD_CAP = 2;
/** Una stima vale mezz'ora e per una sola ricerca: i prezzi e i risultati cambiano. */
export const ESTIMATE_VALID_MS = 30 * 60 * 1000;
export const MAX_CITIES = 10;
export const MAX_SIGNAL_CODES = 40;

/** Sellbird chiama «gratuito» un segnale la cui nota di costo comincia con free o included (non basta contenere la parola). */
export const isFreeSignal = (costNote: string): boolean => /^(free|included)/i.test(costNote.trim());
export const SENDING_ACTIONS: readonly SendingAction[] = ['pause_sending', 'resume_sending'];

export interface OutreachOutboxItem {
    id: string;
    status: OutboxStatus;
    to: string;
    subject: string;
    body: string;
    step: number;
    kind: string;
    company: string;
    contact: string;
    sendAt: string | null;
    sentAt: string | null;
    error: string | null;
    updatedAt: string | null;
}

export interface OutreachCompanyItem {
    id: string;
    name: string;
    domain: string;
    location: string;
    prospects: number;
    emailsSent: number;
    replied: boolean;
    /** Il dominio è in «mai contattare» di Sellbird (lo calcola il ponte dal file di configurazione). */
    excluded: boolean;
}

export type ReplyAuthor = 'them' | 'us';

export interface OutreachReplyMessage {
    from: ReplyAuthor;
    text: string;
    at: string | null;
}

/** Una conversazione in cui il destinatario ha risposto. Gli ultimi messaggi bastano per capire a che punto è. */
export interface OutreachReplyItem {
    id: string;
    company: string;
    contact: string;
    email: string;
    intent: string;
    stage: string;
    status: string;
    updatedAt: string | null;
    messages: OutreachReplyMessage[];
}

/** Solo numeri, con chiavi controllate: contatori della pipeline e uso della quota Claude. */
export interface OutreachStats {
    companies: number;
    prospects: Record<string, number>;
    emailsSent: number;
    emailsSentToday: number;
    conversations: number;
    intents: Record<string, number>;
    usage: { calls7d: number; errors7d: number; inputTokens7d: number; outputTokens7d: number; byAgent: Record<string, number> };
}

/** Un contatto (persona o casella) trovato da Sellbird. Solo quanto serve a capire chi è e a che punto è. */
export interface OutreachContactItem {
    id: string;
    company: string;
    name: string;
    title: string;
    email: string;
    /** verified / risky / guess: Sellbird invia solo agli indirizzi verificati. */
    emailStatus: string;
    status: string;
    score: number;
}

export interface OutreachCampaignItem {
    id: string;
    name: string;
    channel: string;
    status: string;
    steps: number;
    prospects: number;
    sent: number;
    queued: number;
    replies: number;
    createdAt: string | null;
}

/** Un segnale del catalogo di Sellbird. Si attiva e si disattiva solo da Sellbird: qui è in sola lettura. */
export interface OutreachSignalItem {
    code: string;
    label: string;
    description: string;
    category: string;
    status: string;
    costNote: string;
    companies: number;
}

/** Cosa si può chiedere a Discover dalla hub, come lo dichiara il ponte: provider ammessi, città del profilo cliente ideale, tetto. */
export interface OutreachDiscoverInfo {
    providers: DiscoverProvider[];
    cities: string[];
    cap: number;
    /** I settori del profilo di Sellbird: si possono scegliere come gli altri, e senza scelta valgono questi. */
    industries: string[];
    /** Sellbird sul server ha l'opzione `--industry` (modifica locale: vedi scripts/sellbird-bridge/README.md). */
    industryOption: boolean;
}

export interface OutreachSnapshot {
    outbox: OutreachOutboxItem[];
    companies: OutreachCompanyItem[];
    contacts: OutreachContactItem[];
    campaigns: OutreachCampaignItem[];
    signals: OutreachSignalItem[];
    replies: OutreachReplyItem[];
    stats: OutreachStats | null;
    /** Il motivo della pausa degli invii, oppure null se Sellbird sta inviando. */
    sendingPaused: string | null;
}

/** Un'istantanea che porta più righe di queste non è la nostra: si rifiuta invece di riempire Firestore. */
export const MAX_OUTBOX = 1000;
export const MAX_COMPANIES = 2000;
export const MAX_REPLIES = 500;
export const MAX_CONTACTS = 1500;
export const MAX_CAMPAIGNS = 100;
export const MAX_SIGNALS = 100;
const MAX_REPLY_MESSAGES = 8;

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const strOrNull = (v: unknown, max: number): string | null => (typeof v === 'string' && v ? v.slice(0, max) : null);
const int = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0);

/** Id di Sellbird: esadecimali brevi. Si accetta solo questo, perché finisce in un percorso Firestore e in una riga di comando. */
export function isValidOutreachId(id: unknown): id is string {
    return typeof id === 'string' && /^[A-Za-z0-9_-]{4,64}$/.test(id);
}

export function parseOutboxItem(raw: unknown): OutreachOutboxItem | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (!isValidOutreachId(r.id)) return null;
    const status = OUTBOX_STATUSES.find((s) => s === r.status);
    if (!status) return null;
    return {
        id: r.id,
        status,
        to: str(r.to, 254),
        subject: str(r.subject, 300),
        body: str(r.body, 8000),
        step: int(r.step),
        kind: str(r.kind, 40),
        company: str(r.company, 200),
        contact: str(r.contact, 200),
        sendAt: strOrNull(r.sendAt, 40),
        sentAt: strOrNull(r.sentAt, 40),
        error: strOrNull(r.error, 500),
        updatedAt: strOrNull(r.updatedAt, 40),
    };
}

export function parseCompanyItem(raw: unknown): OutreachCompanyItem | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (!isValidOutreachId(r.id)) return null;
    return {
        id: r.id,
        name: str(r.name, 200),
        domain: str(r.domain, 200),
        location: str(r.location, 200),
        prospects: int(r.prospects),
        emailsSent: int(r.emailsSent),
        replied: r.replied === true,
        excluded: r.excluded === true,
    };
}

/**
 * Segreto del ponte. È un'altra credenziale rispetto a CRON_SECRET apposta: chi controlla il computer di Sellbird
 * può mandare dati e ritirare comandi, ma non far girare le cron della hub.
 * Il confronto è a tempo costante: un `===` svela, byte dopo byte, quanti caratteri erano giusti.
 */
export function denyUnlessBridge(request: NextRequest): NextResponse | null {
    const secret = process.env.OUTREACH_BRIDGE_SECRET;
    if (!secret || secret.length < 32) {
        return NextResponse.json({ error: 'OUTREACH_BRIDGE_SECRET non configurato (almeno 32 caratteri).' }, { status: 503 });
    }
    const auth = request.headers.get('authorization');
    const given = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const a = crypto.createHash('sha256').update(given).digest();
    const b = crypto.createHash('sha256').update(secret).digest();
    if (!crypto.timingSafeEqual(a, b)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return null;
}

export function parseReplyItem(raw: unknown): OutreachReplyItem | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (!isValidOutreachId(r.id)) return null;
    const messages = (Array.isArray(r.messages) ? r.messages : [])
        .slice(-MAX_REPLY_MESSAGES)
        .map((m): OutreachReplyMessage | null => {
            if (!m || typeof m !== 'object') return null;
            const x = m as Record<string, unknown>;
            if (x.from !== 'them' && x.from !== 'us') return null;
            return { from: x.from, text: str(x.text, 4000), at: strOrNull(x.at, 40) };
        })
        .filter((m): m is OutreachReplyMessage => m !== null);
    return {
        id: r.id,
        company: str(r.company, 200),
        contact: str(r.contact, 200),
        email: str(r.email, 254),
        intent: str(r.intent, 40),
        stage: str(r.stage, 40),
        status: str(r.status, 40),
        updatedAt: strOrNull(r.updatedAt, 40),
        messages,
    };
}

/** Un contatore per chiave: le chiavi vengono da Sellbird (stati, intenti, agenti), qui si accettano solo parole brevi. */
export function parseCounts(v: unknown): Record<string, number> {
    const out: Record<string, number> = {};
    if (!v || typeof v !== 'object') return out;
    for (const [k, n] of Object.entries(v as Record<string, unknown>).slice(0, 40)) {
        if (/^[A-Za-z0-9_ -]{1,40}$/.test(k)) out[k] = int(n);
    }
    return out;
}

export function parseStats(raw: unknown): OutreachStats | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, any>;
    const u = (r.usage && typeof r.usage === 'object' ? r.usage : {}) as Record<string, unknown>;
    return {
        companies: int(r.companies),
        prospects: parseCounts(r.prospects),
        emailsSent: int(r.emailsSent),
        emailsSentToday: int(r.emailsSentToday),
        conversations: int(r.conversations),
        intents: parseCounts(r.intents),
        usage: {
            calls7d: int(u.calls7d),
            errors7d: int(u.errors7d),
            inputTokens7d: int(u.inputTokens7d),
            outputTokens7d: int(u.outputTokens7d),
            byAgent: parseCounts(u.byAgent),
        },
    };
}

/** `sendingPaused`: null = sta inviando; una stringa (anche breve) = in pausa, con il motivo che ha scritto Sellbird. */
export function parsePaused(v: unknown): string | null {
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null;
}

export function parseContactItem(raw: unknown): OutreachContactItem | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (!isValidOutreachId(r.id)) return null;
    return {
        id: r.id,
        company: str(r.company, 200),
        name: str(r.name, 200),
        title: str(r.title, 200),
        email: str(r.email, 254),
        emailStatus: str(r.emailStatus, 20),
        status: str(r.status, 40),
        score: int(r.score),
    };
}

export function parseCampaignItem(raw: unknown): OutreachCampaignItem | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (!isValidOutreachId(r.id)) return null;
    return {
        id: r.id,
        name: str(r.name, 200),
        channel: str(r.channel, 20),
        status: str(r.status, 40),
        steps: int(r.steps),
        prospects: int(r.prospects),
        sent: int(r.sent),
        queued: int(r.queued),
        replies: int(r.replies),
        createdAt: strOrNull(r.createdAt, 40),
    };
}

/** I codici dei segnali sono parole in maiuscolo (SERP_RANK, HIRING_ROLE…): non sono id di Firestore, ma non devono contenere altro. */
export function parseSignalItem(raw: unknown): OutreachSignalItem | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.code !== 'string' || !/^[A-Z0-9_]{2,60}$/.test(r.code)) return null;
    return {
        code: r.code,
        label: str(r.label, 120),
        description: str(r.description, 600),
        category: str(r.category, 60),
        status: str(r.status, 20),
        costNote: str(r.costNote, 200),
        companies: int(r.companies),
    };
}

export function parseDiscoverInfo(raw: unknown): OutreachDiscoverInfo | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const providers = (Array.isArray(r.providers) ? r.providers : []).filter((p): p is DiscoverProvider => DISCOVER_PROVIDERS.includes(p as DiscoverProvider));
    const cities = (Array.isArray(r.cities) ? r.cities : []).filter((c): c is string => typeof c === 'string' && /^[^;<>\n\r]{1,80}$/.test(c)).slice(0, 40);
    const industries = (Array.isArray(r.industries) ? r.industries : []).filter((c): c is string => typeof c === 'string' && /^[^;<>\n\r]{1,80}$/.test(c)).slice(0, 40);
    const cap = typeof r.cap === 'number' && Number.isFinite(r.cap) && r.cap > 0 ? Math.min(r.cap, DISCOVER_HARD_CAP) : 0;
    return { providers, cities, cap, industries, industryOption: r.industryOption === true };
}
