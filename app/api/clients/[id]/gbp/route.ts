import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { getData } from '@/lib/windsor-client';
import { buildGbpReport, sediFromRows } from '@/lib/gbp-report';

export const maxDuration = 60;

/**
 * GET /api/clients/[id]/gbp?days=7|30|90&locationId=locations/123
 *
 * Dati reali del profilo Google Business, da Windsor — gli stessi che alimentano la scheda GBP nella Overview.
 * Nessun percorso inventa numeri: senza sedi configurate risponde 503 con cosa fare.
 *
 * - `days` (anche `daysBack`): 7, 30 o 90. Altri valori diventano 30.
 * - `locationId`: una sola sede; se manca o non è tra quelle del cliente, tutte.
 *
 * Quattro richieste in parallelo, ognuna con UNA chiamata per tutte le sedi (filtro `account_id in [...]` lato Windsor):
 * il filtro semplice `account_id` viene ignorato dal server e ogni chiamata restituiva le 75 sedi collegate (~20 s).
 * Il calcolo è in lib/gbp-report.ts, con test.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  const denied = await denyUnlessClientAllowed(auth.uid, params.id);
  if (denied) return denied;

  const snap = await adminDb.collection('clients').doc(params.id).get();
  const configured: string[] = (snap.exists ? (snap.data() as any)?.windsorAccounts?.gbp : null) || [];
  if (configured.length === 0) {
    return NextResponse.json(
      { error: 'Nessuna sede Google Business configurata per questo cliente: aggiungile in Setup API.' },
      { status: 503 }
    );
  }

  const sp = request.nextUrl.searchParams;
  const raw = sp.get('days') ?? sp.get('daysBack');
  const days = raw === '7' ? 7 : raw === '90' ? 90 : 30;
  const wanted = sp.get('locationId');
  const ids = wanted && configured.includes(wanted) ? [wanted] : configured;

  // Un errore non deve sembrare "nessun dato": si raccoglie e si restituisce insieme ai dati che sono arrivati.
  const errori: string[] = [];
  const read = (label: string, fields: string[], datePreset: string) =>
    getData({ connector: 'google_my_business', accountIds: ids, fields: [...fields, 'account_id'], datePreset })
      .catch((e: Error) => { errori.push(`${label}: ${e.message}`); return [] as any[]; });

  try {
    const [daily, reviewRows, keywordRows, sediRows] = await Promise.all([
      read('andamento', ['date', 'impressions_desktop_maps', 'impressions_mobile_maps',
        'impressions_desktop_search', 'impressions_mobile_search',
        'website_clicks', 'call_clicks', 'direction_requests'], `last_${days}d`),
      read('recensioni', ['review_reviewer', 'review_comment', 'review_star_rating',
        'review_create_time', 'review_reply_comment'], `last_${days}d`),
      // ⚠️ Le parole chiave GBP sono aggregate **per mese**: con un preset in giorni Windsor
      // restituisce una lista vuota, non un errore.
      read('parole chiave', ['search_keyword', 'search_keyword_value', 'search_keyword_threshold'], 'last_3m'),
      // Una riga per sede con i totali di sempre e il nome: restano visibili anche le sedi senza recensioni nel periodo
      read('sedi', ['account_name', 'review_total_count', 'review_average_rating_total'], `last_${days}d`),
    ]);

    // Se non è arrivato niente di niente, è un guasto, non un cliente senza dati
    if (errori.length === 4) {
      return NextResponse.json({ error: errori[0] }, { status: 503 });
    }

    const report = buildGbpReport({ daily, reviewRows, keywordRows, sedi: sediFromRows(sediRows), days });
    return NextResponse.json({
      ...report,
      // Sedi configurate ma sconosciute a Windsor (id sbagliato o non collegata): compaiono comunque, a zero
      sedi: ids.map((id) => report.sedi.find((s) => s.id === id) ?? { id, nome: id, totaleRecensioni: 0, valutazione: null }),
      _meta: { ...report._meta, ...(errori.length ? { errori } : {}) },
    });
  } catch (err: any) {
    console.error(`[gbp] fallita per ${params.id}:`, err.message);
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
}
