/**
 * lib/outreach-actions.ts
 *
 * Le azioni con parametri che la pagina Outreach può chiedere a Sellbird, controllate qui in un posto solo: la route
 * le valida con queste funzioni prima di scrivere il comando, e il ponte le ricontrolla da sé prima di lanciarle.
 *
 * Il principio: dalla hub non passa mai testo libero verso Sellbird. Ogni valore viene da una lista fissa o dal catalogo
 * che il ponte stesso ha dichiarato (città del profilo, segnali) o dall'elenco ISTAT dei luoghi d'Italia, e la spesa ha
 * un tetto che nessun parametro alza.
 */
import {
    DISCOVER_HARD_CAP,
    DISCOVER_PROVIDERS,
    ESTIMATE_VALID_MS,
    MAX_CITIES,
    MAX_SIGNAL_CODES,
    isFreeSignal,
    type DiscoverProvider,
    type OutreachDiscoverInfo,
    type OutreachSignalItem,
} from './outreach';
import { isKnownPlace } from './italy-places';

export type ActionContext = {
    discover: OutreachDiscoverInfo | null;
    signals: OutreachSignalItem[];
    /** Per discover_run: la stima su cui si basa (un comando discover_estimate già applicato), se esiste. */
    estimate?: { provider: string; cities: string[]; estimatedCost: number | null; ok: boolean; requestedAt: string; used: boolean } | null;
    now?: number;
};

export type ActionCommand =
    | { action: 'discover_estimate'; provider: DiscoverProvider; cities: string[] }
    | { action: 'discover_run'; provider: DiscoverProvider; cities: string[]; maxSpend: number; estimateId: string }
    | { action: 'signals_set'; codes: string[]; status: 'confirmed' | 'rejected' };

export type ActionResult = { ok: true; command: ActionCommand } | { ok: false; error: string; status: number };

const bad = (error: string, status = 400): ActionResult => ({ ok: false, error, status });

export function parseDiscoverParams(body: any, discover: OutreachDiscoverInfo | null): { provider: DiscoverProvider; cities: string[] } | string {
    if (!discover || !discover.cap) return 'Il ponte non ha ancora dichiarato cosa si può cercare: aggiornalo sul server di Sellbird.';
    const provider = DISCOVER_PROVIDERS.find((p) => p === body?.provider);
    if (!provider || !discover.providers.includes(provider)) return 'Provider non ammesso.';
    const cities: unknown = body?.cities ?? [];
    if (!Array.isArray(cities) || cities.length > MAX_CITIES) return `Al massimo ${MAX_CITIES} città.`;
    const unique = Array.from(new Set(cities.map(String)));
    // Le città del profilo del cliente ideale (dichiarate dal ponte) oppure una regione o un comune dell'elenco ISTAT.
    if (!unique.every((c) => discover.cities.includes(c) || isKnownPlace(c))) return 'Luogo sconosciuto: scegli una regione o un comune dall\'elenco.';
    return { provider, cities: unique };
}

export function buildActionCommand(body: any, ctx: ActionContext): ActionResult {
    const type = body?.action;

    if (type === 'discover_estimate') {
        const p = parseDiscoverParams(body, ctx.discover);
        return typeof p === 'string' ? bad(p) : { ok: true, command: { action: 'discover_estimate', ...p } };
    }

    if (type === 'discover_run') {
        const estimateId = typeof body?.estimateId === 'string' ? body.estimateId : '';
        const e = ctx.estimate;
        if (!estimateId || !e) return bad('Serve prima una stima del costo.');
        if (!e.ok || e.estimatedCost === null) return bad('La stima non è riuscita: rifalla.', 409);
        if (e.used) return bad('Questa stima è già stata usata: rifai la stima.', 409);
        if ((ctx.now ?? Date.now()) - new Date(e.requestedAt).getTime() > ESTIMATE_VALID_MS) return bad('La stima è scaduta: rifalla.', 409);
        const p = parseDiscoverParams({ provider: e.provider, cities: e.cities }, ctx.discover);
        if (typeof p === 'string') return bad(p);
        const cap = Math.min(ctx.discover!.cap, DISCOVER_HARD_CAP);
        if (e.estimatedCost > cap) return bad(`La stima (${e.estimatedCost.toFixed(2)} $) supera il tetto di ${cap.toFixed(2)} $: riduci le città.`, 409);
        // Il tetto della ricerca lo calcola il server: un quarto in più della stima, mai oltre il tetto. Il client non lo sceglie.
        const maxSpend = Math.min(cap, Math.max(0.05, Math.round(e.estimatedCost * 1.25 * 100) / 100));
        return { ok: true, command: { action: 'discover_run', ...p, maxSpend, estimateId } };
    }

    if (type === 'signals_set') {
        const status = body?.status === 'confirmed' || body?.status === 'rejected' ? body.status : null;
        const raw: unknown = body?.codes;
        if (!status) return bad('status deve essere confirmed o rejected.');
        if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SIGNAL_CODES) return bad('Indica da 1 a 40 segnali.');
        const codes = Array.from(new Set(raw.map(String)));
        for (const code of codes) {
            const s = ctx.signals.find((x) => x.code === code);
            if (!s) return bad(`Segnale sconosciuto: ${code}.`);
            if (!isFreeSignal(s.costNote)) return bad(`${code} costa crediti: si conferma da Sellbird, dove vedi il costo.`, 403);
        }
        return { ok: true, command: { action: 'signals_set', codes, status } };
    }

    return bad('Azione non ammessa.');
}
