/**
 * lib/ga4-client.ts
 *
 * GA4 letto direttamente dall'API ufficiale di Google, autenticandosi con il
 * **service account dell'agenzia** — non con un OAuth per singolo cliente.
 * Per collegare un nuovo cliente basta autorizzare l'email del service account
 * come Visualizzatore sulla sua proprietà GA4: nessun consenso da raccogliere,
 * nessun refresh token da gestire, nessun costo.
 *
 * Sostituisce GA4 su Windsor: stessi numeri (verificati fianco a fianco sulla
 * proprietà pilota) senza occupare uno slot account del piano Windsor.
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { readPrivateKey } from './google-private-key';

// ─── Autenticazione Client GA4 ───────────────────────────────────────────────

function getGa4Client() {
  const clientEmail = process.env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_EMAIL;
  const privateKey = readPrivateKey('GOOGLE_ANALYTICS_PRIVATE_KEY');

  if (!clientEmail || !privateKey) {
    throw new Error('Mancano le credenziali del service account GA4 (GOOGLE_ANALYTICS_*).');
  }

  return new BetaAnalyticsDataClient({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  });
}

// ─── Funzione Principale ─────────────────────────────────────────────────────


// ─── Errori leggibili ────────────────────────────────────────────────────────

/**
 * L'errore che conta davvero qui è uno solo: la proprietà esiste ma il service
 * account non è ancora stato autorizzato su di essa. Google lo riporta come un
 * PERMISSION_DENIED generico che in UI non dice a nessuno cosa fare, mentre la
 * soluzione è sempre la stessa e richiede trenta secondi in GA4 → Accesso.
 * Meglio scriverlo per esteso, con l'email da autorizzare già dentro.
 */
function explainGa4Error(err: any, propertyId: string): string {
  const email = process.env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_EMAIL || 'il service account del Hub';
  const code = err?.code;
  const msg = String(err?.message || err);

  if (code === 7 || /permission|insufficient|does not have access/i.test(msg)) {
    return `Il service account non è autorizzato sulla proprietà GA4 ${propertyId}. `
      + `Vai su GA4 → Amministrazione → Gestione accessi alla proprietà e aggiungi `
      + `${email} come Visualizzatore.`;
  }
  if (code === 5 || /not found/i.test(msg)) {
    return `Proprietà GA4 ${propertyId} inesistente o non raggiungibile. `
      + `Controlla il Property ID in Setup API (è il numero, non "G-XXXX").`;
  }
  return msg;
}

// ─── Totali per il reporting (service account, nessun OAuth per cliente) ─────

/**
 * Metriche GA4 aggregate su un intervallo, lette direttamente dall'API Google
 * con il service account dell'agenzia — non serve alcun token per-cliente:
 * basta autorizzare l'email del service account come Visualizzatore sulla
 * proprietà.
 *
 * Le chiavi restituite sono volutamente quelle già usate dalla UI
 * (`active_users`, `purchase_revenue`, ...) e non i nomi camelCase dell'API
 * GA4, così le schede esistenti continuano a funzionare senza modifiche.
 *
 * Nomi delle metriche verificati contro l'API reale: `keyEvents` e
 * `sessionKeyEventRate` sono i nomi attuali (ex "conversions" /
 * "sessionConversionRate", che restano accettati per compatibilità).
 */
export async function getGA4Totals(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<Record<string, number>> {
  // Il Property ID è un numero. Un valore diverso — il "G-XXXXXXX" del tag, un
  // nome, un'email — arriverebbe a Google come property inesistente, con un
  // errore che sembra un problema di permessi. Su un cliente reale c'era
  // finito un indirizzo email, e il report restava vuoto senza spiegazioni.
  if (!/^\d+$/.test(String(propertyId).trim())) {
    throw new Error(
      `"${propertyId}" non è un GA4 Property ID valido: dev'essere il numero della proprietà `
      + `(es. 266597631), non il codice "G-XXXXXXX" del tag né un indirizzo email. `
      + `Lo trovi in GA4 → Amministrazione → Impostazioni proprietà.`
    );
  }

  const client = getGa4Client();
  const property = `properties/${propertyId}`;
  const dateRanges = [{ startDate, endDate }];

  // GA4 rejects more than 10 metrics per request ("Requests are limited to 10
  // metrics within a nested request"), so this goes out as two parallel calls.
  const run = async (names: string[]) => {
    try {
      const [res] = await client.runReport({ property, dateRanges, metrics: names.map((name) => ({ name })) });
      const values = res.rows?.[0]?.metricValues ?? [];
      return Object.fromEntries(names.map((n, i) => [n, Number(values[i]?.value ?? 0) || 0]));
    } catch (err: any) {
      throw new Error(explainGa4Error(err, propertyId));
    }
  };

  const [a, b] = await Promise.all([
    run(['sessions', 'activeUsers', 'newUsers', 'bounceRate', 'engagementRate', 'averageSessionDuration']),
    run(['screenPageViewsPerSession', 'keyEvents', 'sessionKeyEventRate', 'transactions', 'purchaseRevenue']),
  ]);

  return {
    sessions: a.sessions,
    active_users: a.activeUsers,
    newusers: a.newUsers,
    bounce_rate: a.bounceRate,
    engagement_rate: a.engagementRate,
    average_session_duration: a.averageSessionDuration,
    screen_page_views_per_session: b.screenPageViewsPerSession,
    conversions: b.keyEvents,
    session_conversion_rate: b.sessionKeyEventRate,
    transactions: b.transactions,
    purchase_revenue: b.purchaseRevenue,
  };
}
