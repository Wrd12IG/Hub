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

// ─── Autenticazione Client GA4 ───────────────────────────────────────────────

function getGa4Client() {
  const clientEmail = process.env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_EMAIL;
  // Gestiamo correttamente gli \n che potrebbero essere passati malamente dal .env
  const privateKey = process.env.GOOGLE_ANALYTICS_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Mancano credenziali Service Account GA4 in .env.local');
  }

  return new BetaAnalyticsDataClient({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  });
}

// ─── Funzione Principale ─────────────────────────────────────────────────────


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
  const client = getGa4Client();
  const property = `properties/${propertyId}`;
  const dateRanges = [{ startDate, endDate }];

  // GA4 rejects more than 10 metrics per request ("Requests are limited to 10
  // metrics within a nested request"), so this goes out as two parallel calls.
  const run = async (names: string[]) => {
    const [res] = await client.runReport({ property, dateRanges, metrics: names.map((name) => ({ name })) });
    const values = res.rows?.[0]?.metricValues ?? [];
    return Object.fromEntries(names.map((n, i) => [n, Number(values[i]?.value ?? 0) || 0]));
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
