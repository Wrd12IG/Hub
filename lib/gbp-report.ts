// Aggregazione dei dati Google Business Profile (da Windsor) per la pagina e la scheda GBP del cliente.
// Funzione pura: nessun accesso a rete o a Firestore.

type Row = Record<string, string | number | null | undefined>;

export interface GbpSede {
    id: string;
    nome: string;
    /** Recensioni di sempre della sede (non solo del periodo). */
    totaleRecensioni: number;
    /** Voto medio di sempre; null se la sede non ha recensioni. */
    valutazione: number | null;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const sumBy = (rows: Row[], key: string) => rows.reduce((s, r) => s + num(r[key]), 0);
const day = (v: unknown) => String(v ?? '').slice(0, 10);

/** "FIVE" → 5. Windsor espone lo star rating come enum testuale. */
export function starToNumber(v: unknown): number {
    const map: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
    const s = String(v ?? '').toUpperCase();
    return map[s] ?? (Number(s) || 0);
}

/**
 * Sedi con i loro totali di sempre, da UNA riga per sede.
 * `review_total_count` e `review_average_rating_total` si ripetono identici su ogni riga di recensione della sede:
 * sommarli per riga (com'era prima) gonfiava il totale (4.528 invece di 366 su City Motors) e
 * escludeva le sedi senza recensioni nel periodo.
 */
export function sediFromRows(rows: Row[]): GbpSede[] {
    const byId = new Map<string, GbpSede>();
    for (const r of rows) {
        const id = String(r.account_id ?? '');
        if (!id) continue;
        const prev = byId.get(id);
        const totale = Math.max(num(r.review_total_count), prev?.totaleRecensioni ?? 0);
        const voto = num(r.review_average_rating_total);
        byId.set(id, {
            id,
            nome: String(r.account_name ?? prev?.nome ?? id),
            totaleRecensioni: totale,
            valutazione: voto > 0 ? voto : (prev?.valutazione ?? null),
        });
    }
    return Array.from(byId.values());
}

/** Totale recensioni e voto medio pesato sul numero di recensioni di ogni sede. */
export function summarizeReviews(sedi: GbpSede[]): { totale: number; valutazione: number } {
    const totale = sedi.reduce((s, x) => s + x.totaleRecensioni, 0);
    const pesati = sedi.filter(x => x.totaleRecensioni > 0 && x.valutazione);
    const peso = pesati.reduce((s, x) => s + x.totaleRecensioni, 0);
    const valutazione = peso > 0
        ? Math.round((pesati.reduce((s, x) => s + x.valutazione! * x.totaleRecensioni, 0) / peso) * 10) / 10
        : 0;
    return { totale, valutazione };
}

export function buildGbpReport(input: { daily: Row[]; reviewRows: Row[]; keywordRows: Row[]; sedi: GbpSede[]; days: number }) {
    const { daily, reviewRows, keywordRows, sedi, days } = input;

    // ── Copertura e click, per giorno ────────────────────────────────────
    const cover = new Map<string, { date: string; googleMaps: number; ricercaGoogle: number; totale: number }>();
    const clicks = new Map<string, { date: string; sitoWeb: number; telefono: number; indirizzo: number }>();
    for (const r of daily) {
        const date = day(r.date);
        if (!date) continue;
        const maps = num(r.impressions_desktop_maps) + num(r.impressions_mobile_maps);
        const search = num(r.impressions_desktop_search) + num(r.impressions_mobile_search);
        const c = cover.get(date) || { date, googleMaps: 0, ricercaGoogle: 0, totale: 0 };
        c.googleMaps += maps; c.ricercaGoogle += search; c.totale += maps + search;
        cover.set(date, c);
        const k = clicks.get(date) || { date, sitoWeb: 0, telefono: 0, indirizzo: 0 };
        k.sitoWeb += num(r.website_clicks); k.telefono += num(r.call_clicks); k.indirizzo += num(r.direction_requests);
        clicks.set(date, k);
    }
    const coperturaChart = Array.from(cover.values()).sort((a, b) => a.date.localeCompare(b.date));
    const clicChart = Array.from(clicks.values()).sort((a, b) => a.date.localeCompare(b.date));
    const googleMaps = coperturaChart.reduce((s, r) => s + r.googleMaps, 0);
    const ricercaGoogle = coperturaChart.reduce((s, r) => s + r.ricercaGoogle, 0);
    const sitoWeb = sumBy(daily, 'website_clicks');
    const telefono = sumBy(daily, 'call_clicks');
    const indirizzo = sumBy(daily, 'direction_requests');

    // ── Parole chiave: una riga per keyword per mese, vanno sommate. Se Google nasconde il valore esatto
    // restituisce una soglia ("meno di N"): si usa quella, altrimenti quelle ricerche sparirebbero.
    const kw = new Map<string, number>();
    for (const r of keywordRows) {
        const parola = String(r.search_keyword ?? '').trim();
        if (!parola) continue;
        kw.set(parola, (kw.get(parola) || 0) + (num(r.search_keyword_value) || num(r.search_keyword_threshold)));
    }
    const paroleChiave = Array.from(kw.entries())
        .map(([parola, impression]) => ({ parola, impression }))
        .sort((a, b) => b.impression - a.impression)
        .slice(0, 50);

    // ── Recensioni del periodo ───────────────────────────────────────────
    const COLORI = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4'];
    const nomeSede = new Map(sedi.map(s => [s.id, s.nome]));
    const recensioni = reviewRows
        .filter(r => r.review_reviewer || r.review_comment)
        .map((r, i) => {
            const nome = String(r.review_reviewer ?? 'Anonimo');
            return {
                id: `${r.account_id ?? ''}-${i}`,
                utenteNome: nome,
                utenteIniziale: nome.charAt(0).toUpperCase(),
                utenteColore: COLORI[i % COLORI.length],
                messaggio: String(r.review_comment ?? ''),
                data: day(r.review_create_time),
                valutazione: starToNumber(r.review_star_rating),
                risposta: Boolean(String(r.review_reply_comment ?? '').trim()),
                sede: nomeSede.get(String(r.account_id ?? '')) ?? '',
            };
        })
        .sort((a, b) => b.data.localeCompare(a.data));

    const { totale, valutazione } = summarizeReviews(sedi);

    return {
        configured: true,
        locations: sedi.length,
        sedi,
        coperturaSummary: { googleMaps, ricercaGoogle, totale: googleMaps + ricercaGoogle },
        coperturaChart,
        distribuzioneCopertura: [
            { name: 'Google Maps', value: googleMaps },
            { name: 'Ricerca Google', value: ricercaGoogle },
        ],
        clicSummary: { sitoWeb, telefono, indirizzo, totale: sitoWeb + telefono + indirizzo },
        clicChart,
        paroleChiave,
        recensioni,
        recensioniSummary: {
            totale,
            valutazione,
            nelPeriodo: recensioni.length,
            senzaRisposta: recensioni.filter(r => !r.risposta).length,
        },
        recensioniChart: recensioni.slice(0, 30).map(r => ({ date: r.data, valutazione: r.valutazione })),
        _meta: { source: 'windsor', days },
    };
}
