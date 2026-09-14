import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { getData } from '@/lib/windsor-client';

export const maxDuration = 60;

/**
 * GET /api/clients/[id]/gbp
 *
 * Dati reali del profilo Google Business, da Windsor — gli stessi che
 * alimentano la scheda GBP nella Overview.
 *
 * La versione precedente restituiva `getMockGBPData()`: numeri inventati,
 * derivati da un hash dell'id cliente così da restare stabili nel tempo e
 * sembrare veri. E lo faceva **in due rami**: senza token li marcava
 * `isMock: true`, ma con un token restituiva *gli stessi identici numeri*
 * etichettandoli `isMock: false` e "Dati GBP attivi da account collegato".
 * Nessuno dei due era gated su NODE_ENV, quindi andavano in produzione.
 *
 * Qui non c'è nessun percorso che inventa: se manca la configurazione si
 * risponde 503 con cosa fare.
 */

interface Row { [k: string]: string | number | undefined }

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
const sumBy = (rows: Row[], key: string) => rows.reduce((s, r) => s + num(r[key]), 0);

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  const denied = await denyUnlessClientAllowed(auth.uid, params.id);
  if (denied) return denied;

  const snap = await adminDb.collection('clients').doc(params.id).get();
  const locations: string[] = (snap.exists ? (snap.data() as any)?.windsorAccounts?.gbp : null) || [];
  if (locations.length === 0) {
    return NextResponse.json(
      { error: 'Nessuna sede Google Business configurata per questo cliente: aggiungile in Setup API.' },
      { status: 503 }
    );
  }

  const raw = request.nextUrl.searchParams.get('days');
  const days = raw === '7' ? 7 : raw === '90' ? 90 : 30;

  try {
    // Le sedi passano da un pool: una risponde in 10-12s e in parallelo
    // Windsor chiude le connessioni (stesso motivo del report).
    const daily: Row[] = [];
    const reviewRows: Row[] = [];
    const keywordRows: Row[] = [];

    for (let i = 0; i < locations.length; i += 2) {
      const batch = locations.slice(i, i + 2);
      await Promise.all(batch.map(async (accountId) => {
        const [d, rev, kw] = await Promise.all([
          getData({
            connector: 'google_my_business', accountId,
            fields: ['date', 'impressions_desktop_maps', 'impressions_mobile_maps',
              'impressions_desktop_search', 'impressions_mobile_search',
              'website_clicks', 'call_clicks', 'direction_requests', 'account_id'],
            datePreset: `last_${days}d`,
          }).catch(() => []),
          getData({
            connector: 'google_my_business', accountId,
            fields: ['review_reviewer', 'review_comment', 'review_star_rating',
              'review_create_time', 'review_reply_comment', 'review_total_count',
              'review_average_rating_total', 'account_id'],
            datePreset: `last_${days}d`,
          }).catch(() => []),
          // ⚠️ Le parole chiave GBP sono aggregate **per mese**: con un preset
          // in giorni Windsor restituisce una lista vuota, non un errore.
          getData({
            connector: 'google_my_business', accountId,
            fields: ['search_keyword', 'search_keyword_value', 'search_keyword_threshold', 'account_id'],
            datePreset: 'last_3m',
          }).catch(() => []),
        ]);
        daily.push(...d); reviewRows.push(...rev); keywordRows.push(...kw);
      }));
    }

    // ── Copertura ────────────────────────────────────────────────────────
    const byDate = new Map<string, { date: string; googleMaps: number; ricercaGoogle: number; totale: number }>();
    for (const r of daily) {
      const date = String(r.date ?? '').slice(0, 10);
      if (!date) continue;
      const maps = num(r.impressions_desktop_maps) + num(r.impressions_mobile_maps);
      const search = num(r.impressions_desktop_search) + num(r.impressions_mobile_search);
      const e = byDate.get(date) || { date, googleMaps: 0, ricercaGoogle: 0, totale: 0 };
      e.googleMaps += maps; e.ricercaGoogle += search; e.totale += maps + search;
      byDate.set(date, e);
    }
    const coperturaChart = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    const googleMaps = coperturaChart.reduce((s, r) => s + r.googleMaps, 0);
    const ricercaGoogle = coperturaChart.reduce((s, r) => s + r.ricercaGoogle, 0);

    // ── Click ────────────────────────────────────────────────────────────
    const clicByDate = new Map<string, { date: string; sitoWeb: number; telefono: number; indirizzo: number }>();
    for (const r of daily) {
      const date = String(r.date ?? '').slice(0, 10);
      if (!date) continue;
      const e = clicByDate.get(date) || { date, sitoWeb: 0, telefono: 0, indirizzo: 0 };
      e.sitoWeb += num(r.website_clicks);
      e.telefono += num(r.call_clicks);
      e.indirizzo += num(r.direction_requests);
      clicByDate.set(date, e);
    }
    const clicChart = Array.from(clicByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    const sitoWeb = sumBy(daily, 'website_clicks');
    const telefono = sumBy(daily, 'call_clicks');
    const indirizzo = sumBy(daily, 'direction_requests');

    // ── Parole chiave ────────────────────────────────────────────────────
    // Una riga per keyword per mese: vanno sommate. Quando Google nasconde il
    // valore esatto restituisce una soglia ("meno di 15"): si usa quella,
    // altrimenti quelle ricerche sparirebbero come se non esistessero.
    const kwMap = new Map<string, number>();
    for (const r of keywordRows) {
      const parola = String(r.search_keyword ?? '').trim();
      if (!parola) continue;
      const value = num(r.search_keyword_value) || num(r.search_keyword_threshold);
      kwMap.set(parola, (kwMap.get(parola) || 0) + value);
    }
    const paroleChiave = Array.from(kwMap.entries())
      .map(([parola, impression]) => ({ parola, impression }))
      .sort((a, b) => b.impression - a.impression)
      .slice(0, 50);

    // ── Recensioni ───────────────────────────────────────────────────────
    const COLORI = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4'];
    const recensioni = reviewRows
      .filter((r) => r.review_reviewer || r.review_comment)
      .map((r, i) => {
        const nome = String(r.review_reviewer ?? 'Anonimo');
        return {
          id: `${r.account_id ?? ''}-${i}`,
          utenteNome: nome,
          utenteIniziale: nome.charAt(0).toUpperCase(),
          utenteColore: COLORI[i % COLORI.length],
          messaggio: String(r.review_comment ?? ''),
          data: String(r.review_create_time ?? '').slice(0, 10),
          // Windsor restituisce lo star rating come testo (FIVE, FOUR…).
          valutazione: starToNumber(r.review_star_rating),
          risposta: Boolean(String(r.review_reply_comment ?? '').trim()),
        };
      })
      .sort((a, b) => b.data.localeCompare(a.data));

    const totaleRecensioni = sumBy(reviewRows, 'review_total_count');
    const ratings = reviewRows.map((r) => num(r.review_average_rating_total)).filter((v) => v > 0);
    const valutazione = ratings.length > 0
      ? Math.round((ratings.reduce((s, v) => s + v, 0) / ratings.length) * 10) / 10
      : 0;

    return NextResponse.json({
      configured: true,
      locations: locations.length,
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
      recensioniSummary: { totale: totaleRecensioni, valutazione },
      recensioniChart: recensioni.slice(0, 30).map((r) => ({ date: r.data, valutazione: r.valutazione })),
      _meta: { source: 'windsor', days },
    });
  } catch (err: any) {
    console.error(`[gbp] fallita per ${params.id}:`, err.message);
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
}

/** "FIVE" → 5. Windsor espone lo star rating come enum testuale. */
function starToNumber(v: unknown): number {
  const map: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  const s = String(v ?? '').toUpperCase();
  return map[s] ?? (Number(s) || 0);
}
