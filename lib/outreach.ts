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
}

export interface OutreachSnapshot {
    outbox: OutreachOutboxItem[];
    companies: OutreachCompanyItem[];
}

/** Un'istantanea che porta più righe di queste non è la nostra: si rifiuta invece di riempire Firestore. */
export const MAX_OUTBOX = 1000;
export const MAX_COMPANIES = 2000;

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
