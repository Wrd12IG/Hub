/**
 * lib/ga4-client.ts
 *
 * GA4 letto direttamente dall'API ufficiale di Google, con due modi di accedere (mai un OAuth per singolo cliente):
 *
 *  1. **account Google dell'agenzia** (OAuth, un consenso solo): vede tutte le proprietà GA4 a cui quella persona ha già
 *     accesso, quindi un cliente nuovo funziona subito, senza aggiungere nessuna email;
 *  2. **service account** del progetto: non scade e non dipende da una persona, ma va aggiunto come Visualizzatore su
 *     ogni proprietà.
 *
 * Si prova prima l'account Google (se configurato) e, se Google risponde «nessun permesso» o il token non vale più, si
 * ripiega sul service account: un token revocato non ferma i report. Vedi `makeGa4Runner`.
 *
 * Sostituisce GA4 su Windsor: stessi numeri (verificati fianco a fianco sulla
 * proprietà pilota) senza occupare uno slot account del piano Windsor.
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { OAuth2Client } from 'google-auth-library';
import { readPrivateKey } from './google-private-key';

// ─── Autenticazione Client GA4 ───────────────────────────────────────────────

type RunReport = (req: Record<string, any>) => Promise<[any, ...any[]]>;
export type Ga4Source = { name: 'account' | 'service'; run: RunReport };

/** Errori per cui ha senso provare l'altro modo di accedere: permessi, token revocato o senza l'ambito giusto. */
export function isAccessError(err: any): boolean {
  const code = err?.code;
  const msg = String(err?.message || err);
  return code === 7 || code === 16 || /permission|insufficient|does not have access|unauthenticated|invalid_grant|invalid_client|unauthorized_client|ACCESS_TOKEN_SCOPE/i.test(msg);
}

/**
 * Mette insieme i modi di accedere in un solo `runReport`. Il primo che funziona vince, e si ricorda per proprietà quale ha
 * funzionato (così non si fa ogni volta un tentativo inutile). Gli errori che non riguardano l'accesso (proprietà
 * inesistente, quota, rete) non fanno cambiare strada: ripeterli con l'altro account non servirebbe.
 */
export function makeGa4Runner(sources: Ga4Source[], remembered: Map<string, Ga4Source['name']> = new Map()) {
  return {
    async runReport(req: Record<string, any>): Promise<[any, ...any[]]> {
      const property = String(req.property || '');
      const first = remembered.get(property);
      const ordered = first ? [...sources].sort((a, b) => (a.name === first ? -1 : b.name === first ? 1 : 0)) : sources;
      let lastErr: any;
      const denied: string[] = [];
      for (const src of ordered) {
        try {
          const out = await src.run(req);
          remembered.set(property, src.name);
          return out;
        } catch (err: any) {
          lastErr = err;
          if (!isAccessError(err)) throw err;
          denied.push(src.name);
        }
      }
      if (denied.length > 1) {
        const e: any = new Error('Nessun accesso alla proprietà con né l\'account Google né il service account.');
        e.code = 7;
        e.both = true;
        throw e;
      }
      throw lastErr;
    },
  };
}

// ─── Service account ─────────────────────────────────────────────────────────

function serviceAccountSource(): Ga4Source | null {
  const clientEmail = process.env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_EMAIL;
  const privateKey = readPrivateKey('GOOGLE_ANALYTICS_PRIVATE_KEY');
  if (!clientEmail || !privateKey) return null;
  const client = new BetaAnalyticsDataClient({ credentials: { client_email: clientEmail, private_key: privateKey } });
  return { name: 'service', run: (req) => client.runReport(req as any) as Promise<[any, ...any[]]> };
}

// ─── Account Google dell'agenzia (OAuth) ─────────────────────────────────────

/**
 * Credenziali OAuth dedicate a GA4 (client + token di rinnovo con ambito analytics.readonly).
 * Nomi propri, separati da GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET che usano YouTube e il resto del Hub:
 * il token di rinnovo vale solo con il client con cui è stato creato.
 */
function ga4OAuthEnv() {
  const refreshToken = process.env.GA4_OAUTH_REFRESH_TOKEN;
  const clientId = process.env.GA4_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GA4_OAUTH_CLIENT_SECRET;
  if (!refreshToken || !clientId || !clientSecret) return null;
  return { refreshToken, clientId, clientSecret };
}

function accountSource(): Ga4Source | null {
  const creds = ga4OAuthEnv();
  if (!creds) return null;
  const { refreshToken, clientId, clientSecret } = creds;

  const oauth = new OAuth2Client(clientId, clientSecret);
  oauth.setCredentials({ refresh_token: refreshToken });

  return {
    name: 'account',
    run: async (req) => {
      let token: string | null | undefined;
      try {
        token = (await oauth.getAccessToken()).token;
      } catch (e: any) {
        // invalid_grant = token revocato o scaduto: è un problema d'accesso, si ripiega sul service account.
        const err: any = new Error(`account Google non utilizzabile: ${e?.response?.data?.error || e?.message || e}`);
        err.code = 16;
        throw err;
      }
      const { property, ...body } = req;
      const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/${property}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err: any = new Error(json?.error?.message || `GA4 ha risposto ${res.status}`);
        // Stessa numerazione dell'SDK, così explainGa4Error e isAccessError non distinguono i due modi.
        err.code = res.status === 403 ? 7 : res.status === 401 ? 16 : res.status === 404 ? 5 : res.status === 400 ? 3 : 13;
        throw err;
      }
      return [json];
    },
  };
}

const remembered = new Map<string, Ga4Source['name']>();

function getGa4Client() {
  // Prima l'account dell'agenzia (vede già tutte le proprietà), poi il service account.
  const sources = [accountSource(), serviceAccountSource()].filter((s): s is Ga4Source => !!s);
  if (sources.length === 0) {
    throw new Error('Mancano le credenziali per GA4: né l\'account Google (GA4_OAUTH_REFRESH_TOKEN, GA4_OAUTH_CLIENT_ID, GA4_OAUTH_CLIENT_SECRET) né il service account (GOOGLE_ANALYTICS_*).');
  }
  return makeGa4Runner(sources, remembered);
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
  const hasAccount = !!ga4OAuthEnv();
  const hasService = !!(process.env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_ANALYTICS_PRIVATE_KEY);

  if (code === 7 || code === 16 || /permission|insufficient|does not have access|unauthenticated|invalid_grant/i.test(msg)) {
    if (hasAccount && hasService) {
      return `Né l'account Google dell'agenzia né il service account vedono la proprietà GA4 ${propertyId}. `
        + `Controlla il Property ID; poi dai accesso all'account Google dell'agenzia sulla proprietà, `
        + `oppure aggiungi ${email} come Visualizzatore (GA4 → Amministrazione → Gestione accessi alla proprietà).`;
    }
    if (hasAccount) {
      return `L'account Google dell'agenzia non vede la proprietà GA4 ${propertyId} (o il suo consenso è scaduto: va rifatto). `
        + `Controlla il Property ID e che quell'account abbia accesso alla proprietà.`;
    }
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

/**
 * Sessioni, utenti attivi ed eventi chiave PER GIORNO (dimensione `date`). Serve al grafico di andamento: le chiavi sono
 * quelle già usate dalle schede (`sessions`, `active_users`, `conversions`) e la data è yyyy-MM-dd.
 */
export async function getGA4Daily(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<{ date: string; sessions: number; active_users: number; conversions: number }[]> {
  const client = getGa4Client();
  try {
    const [res] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: ['sessions', 'activeUsers', 'keyEvents'].map((name) => ({ name })),
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: 400,
    });
    return (res.rows || []).map((r: any) => {
      const d = String(r.dimensionValues?.[0]?.value ?? '');   // yyyymmdd
      const v = (i: number) => Number(r.metricValues?.[i]?.value ?? 0) || 0;
      return { date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, sessions: v(0), active_users: v(1), conversions: v(2) };
    });
  } catch (err: any) {
    throw new Error(explainGa4Error(err, propertyId));
  }
}

export interface GA4Row {
  key: string;
  sessions: number;
  users: number;
  conversions: number;
  revenue: number;
}

export interface GA4EventRow {
  event: string;
  count: number;
  /** Quanto incide sulle sessioni del periodo. */
  per_session: number;
}

type GA4Dimension = 'sessionSourceMedium' | 'sessionDefaultChannelGroup' | 'pagePath' | 'deviceCategory' | 'country';

/**
 * Ripartizione per dimensione: da dove arriva il traffico, quali pagine vede,
 * con che dispositivo, da quale paese.
 *
 * Sono i tagli che la scheda nella Overview non può mostrare — lì ci sono i
 * totali — e che nella vecchia dashboard esistevano solo per sorgente/mezzo.
 */
export async function getGA4Breakdown(
  propertyId: string,
  startDate: string,
  endDate: string,
  dimension: GA4Dimension,
  limit = 25
): Promise<GA4Row[]> {
  const client = getGa4Client();
  const metrics = ['sessions', 'totalUsers', 'keyEvents', 'purchaseRevenue'];

  try {
    const [res] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: dimension }],
      metrics: metrics.map((name) => ({ name })),
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit,
    });
    return (res.rows || []).map((r: any) => {
      const v = (i: number) => Number(r.metricValues?.[i]?.value ?? 0) || 0;
      return {
        key: String(r.dimensionValues?.[0]?.value ?? ''),
        sessions: v(0), users: v(1), conversions: v(2),
        revenue: Math.round(v(3) * 100) / 100,
      };
    });
  } catch (err: any) {
    throw new Error(explainGa4Error(err, propertyId));
  }
}

/**
 * Eventi e-commerce del periodo.
 *
 * ⚠️ Volutamente **non** presentati come imbuto sequenziale. Su un sito reale
 * i conteggi non rispettano l'ordine: misurato sull'account pilota,
 * `begin_checkout` (17.664) supera `add_to_cart` (10.537), perché si può
 * acquistare senza passare dal carrello. Calcolare un "calo fra step" su quei
 * numeri produrrebbe percentuali sopra il 100% e un grafico che mente.
 * Qui ogni evento sta per sé, con la sua incidenza sulle sessioni.
 */
export async function getGA4EcommerceEvents(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<GA4EventRow[]> {
  const client = getGa4Client();
  const WANTED = ['view_item', 'add_to_cart', 'begin_checkout', 'add_shipping_info', 'add_payment_info', 'purchase'];

  try {
    const [events, totals] = await Promise.all([
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        limit: 200,
      }),
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        metrics: [{ name: 'sessions' }],
      }),
    ]);

    const sessions = Number(totals[0].rows?.[0]?.metricValues?.[0]?.value ?? 0) || 0;
    const counts = new Map<string, number>();
    for (const r of events[0].rows || []) {
      counts.set(String(r.dimensionValues?.[0]?.value ?? ''), Number(r.metricValues?.[0]?.value ?? 0) || 0);
    }

    // Solo gli eventi che il sito manda davvero: elencare a zero quelli mai
    // inviati farebbe sembrare rotto un tracciamento che semplicemente non li usa.
    return WANTED
      .filter((e) => counts.has(e))
      .map((e) => ({
        event: e,
        count: counts.get(e)!,
        per_session: sessions > 0 ? Math.round((counts.get(e)! / sessions) * 10000) / 100 : 0,
      }));
  } catch (err: any) {
    throw new Error(explainGa4Error(err, propertyId));
  }
}
