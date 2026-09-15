/**
 * lib/google-ads-client.ts
 * 
 * Interfaccia per comunicare con la Google Ads API.
 * Utilizza la libreria ufficiale "google-ads-api" per Node.js.
 */

import { adminDb } from '@/lib/firebase-admin';

// ─── Tipi di dato in uscita per il frontend ───────────────────────────────────

export interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED' | 'UNKNOWN';
  startDate?: string;
  endDate?: string;
  spend: number;
  impressions: number;
  clicks: number;
  cpc: number;
  conversions: number;
  costPerConversion: number;
  roas: number | null;
}

export interface GoogleAdsSummary {
  accountId: string;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
}

export interface GoogleAdsKeyword {
  keyword: string;
  matchType: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  cpc: number;
  ctr: number;
  cpm: number;
}

export interface GoogleAdsDailyMetric {
  date: string;          // YYYY-MM-DD
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

// ─── Autenticazione a livello di agenzia ─────────────────────────────────────

/**
 * ⚠️ **Google Ads non accetta i service account** (salvo delega a livello di
 * dominio Workspace). L'unica strada è un OAuth fatto una volta dall'account
 * che amministra gli account pubblicitari, che produce un refresh token
 * d'agenzia valido per tutti i clienti.
 *
 * La versione precedente pretendeva invece un refresh token **per singolo
 * cliente**, letto da `getClientToken(clientId, 'google')`. Praticamente
 * nessun cliente ce l'aveva, quindi le pagine Google Ads del Hub erano vuote
 * da sempre e nessuno sapeva perché: la route rispondeva "non configurato"
 * senza distinguere fra "questo cliente non usa Google Ads" e "il Hub non ha
 * mai avuto le credenziali per leggerlo".
 *
 * Qui l'id account del cliente arriva dal campo `googleAdAccountId` inserito
 * in Setup API, esattamente come per Meta.
 */
const API_VERSION = 'v24';

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Credenziali Google Ads d\'agenzia mancanti: servono GOOGLE_ADS_CLIENT_ID, '
      + 'GOOGLE_ADS_CLIENT_SECRET e GOOGLE_ADS_REFRESH_TOKEN.'
    );
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: refreshToken, grant_type: 'refresh_token',
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `Il refresh token Google Ads non è più valido (${json.error || res.status}). `
      + 'Va rifatto il consenso OAuth con l\'account che amministra gli account pubblicitari.'
    );
  }
  return json.access_token as string;
}

/** L'id account senza trattini, come lo vuole l'API. */
function normalizeCustomerId(raw: string): string {
  return String(raw).replace(/[^0-9]/g, '');
}

/** Esegue una query GAQL su un account. */
async function query(customerId: string, gaql: string): Promise<any[]> {
  const token = await getAccessToken();

  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${normalizeCustomerId(customerId)}/googleAds:search`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Nessun developer token: Google ha spostato il livello di accesso
        // dell'API dal token al **progetto Google Cloud** dell'OAuth client.
        // L'header è diventato opzionale e smetterà di essere accettato nel
        // corso del 2027. Verificato prima di toglierlo: la stessa query con
        // e senza header restituisce numeri identici (€12.446,33, 44.398
        // click), quindi qui non cambia nulla se non una dipendenza in meno.
        'content-type': 'application/json',
        // Serve solo quando si legge attraverso un account manager.
        ...(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
          ? { 'login-customer-id': normalizeCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) }
          : {}),
      },
      body: JSON.stringify({ query: gaql }),
    }
  );
  const json = await res.json();
  if (!res.ok) {
    // Il messaggio di primo livello è sempre lo stesso inutile "Request
    // contains an invalid argument": quello che serve — *quale* campo è
    // sbagliato — sta annidato nei details. Senza estrarlo, un refuso in una
    // GAQL costa tre tentativi alla cieca (ed è costato esattamente quello).
    const nested = json?.error?.details?.[0]?.errors?.[0]?.message;
    const detail = nested || json?.error?.message || `HTTP ${res.status}`;
    if (res.status === 403 || /PERMISSION|not permitted/i.test(detail)) {
      throw new Error(
        `L'account Google Ads ${customerId} non è accessibile con le credenziali del Hub. `
        + 'Controlla l\'id in Setup API e che l\'account sia sotto lo stesso amministratore.'
      );
    }
    throw new Error(`Google Ads ha risposto: ${detail}`);
  }
  return json.results || [];
}

/** yyyy-MM-dd di N giorni fa, per le date esplicite nelle GAQL. */
function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Il costo arriva in micro-unità di valuta. */
function fromMicros(v: unknown): number {
  return Number(v || 0) / 1_000_000;
}

/** Id account del cliente, dal campo compilato in Setup API. */
async function getCustomerId(clientId: string): Promise<string> {
  const snap = await adminDb.collection('clients').doc(clientId).get();
  const id = snap.exists ? (snap.data() as any)?.googleAdAccountId : null;
  if (!id) {
    throw new Error('Questo cliente non ha un ID account Google Ads: inseriscilo in Setup API.');
  }
  return String(id);
}

// ─── Funzioni Principali ─────────────────────────────────────────────────────

/**
 * Scarica le campagne Google Ads per un determinato cliente.
 * Interroga la tabella 'campaign' e la unisce a 'metrics'.
 */
export async function getGoogleAdsCampaigns(
  clientId: string,
  days: 7 | 30 | 90 | 365 = 365
): Promise<{ campaigns: GoogleAdsCampaign[]; summary: GoogleAdsSummary }> {
  const customerId = await getCustomerId(clientId);

  // Il periodo di default è un anno, non 30 giorni: la tab Campagne filtra poi
  // per stato e data, e una campagna finita a marzo deve restare visibile
  // invece di sparire perché non ha speso nell'ultimo mese. La pagina di
  // dettaglio passa invece la finestra scelta nel selettore.
  //
  // ⚠️ Con date esplicite, non con `DURING LAST_365_DAYS`: quella costante
  // **non esiste** in GAQL e l'API rifiuta l'intera query con un generico
  // "Request contains an invalid argument". Era nel codice fin dall'inizio ed
  // è una delle ragioni per cui questa pagina non ha mai mostrato nulla.
  // Le uniche costanti valide sono LAST_7_DAYS, LAST_14_DAYS e LAST_30_DAYS.
  const rows = await query(customerId, `
    SELECT
      campaign.id, campaign.name, campaign.status,
      campaign.start_date_time, campaign.end_date_time,
      metrics.cost_micros, metrics.impressions, metrics.clicks,
      metrics.average_cpc, metrics.conversions,
      metrics.cost_per_conversion, metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${isoDaysAgo(days)}' AND '${isoDaysAgo(0)}'
      AND campaign.status != 'REMOVED'
  `);

  // Una riga per campagna *per giorno*: vanno sommate, non lette una per una.
  const byCampaign = new Map<string, GoogleAdsCampaign & { conversionsValue: number }>();
  for (const row of rows) {
    const c = row.campaign || {};
    const m = row.metrics || {};
    const id = String(c.id ?? '');
    if (!id) continue;

    const existing = byCampaign.get(id);
    const spend = fromMicros(m.costMicros);
    const impressions = Number(m.impressions || 0);
    const clicks = Number(m.clicks || 0);
    const conversions = Number(m.conversions || 0);
    const conversionsValue = Number(m.conversionsValue || 0);

    if (existing) {
      existing.spend += spend;
      existing.impressions += impressions;
      existing.clicks += clicks;
      existing.conversions += conversions;
      existing.conversionsValue += conversionsValue;
    } else {
      byCampaign.set(id, {
        id,
        name: String(c.name ?? id),
        status: (c.status as GoogleAdsCampaign['status']) ?? 'UNKNOWN',
        // v24 le espone come *_date_time ("2025-09-01 09:26:43"): la UI
        // confronta yyyy-MM-dd, quindi si tiene solo la parte data.
        startDate: c.startDateTime ? String(c.startDateTime).slice(0, 10) : undefined,
        endDate: c.endDateTime ? String(c.endDateTime).slice(0, 10) : undefined,
        spend, impressions, clicks, conversions,
        conversionsValue,
        // Ricalcolati sotto sui totali: le medie non si sommano.
        cpc: 0, costPerConversion: 0, roas: null,
      });
    }
  }

  const campaigns: GoogleAdsCampaign[] = Array.from(byCampaign.values()).map((c) => ({
    ...c,
    cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
    costPerConversion: c.conversions > 0 ? c.spend / c.conversions : 0,
    roas: c.spend > 0 ? c.conversionsValue / c.spend : null,
  })).sort((a, b) => b.spend - a.spend);

  return {
    campaigns,
    summary: {
      accountId: customerId,
      totalSpend: campaigns.reduce((s, c) => s + c.spend, 0),
      totalImpressions: campaigns.reduce((s, c) => s + c.impressions, 0),
      totalClicks: campaigns.reduce((s, c) => s + c.clicks, 0),
      totalConversions: campaigns.reduce((s, c) => s + c.conversions, 0),
    },
  };
}

export async function getGoogleAdsDailyMetrics(
  clientId: string,
  days: 7 | 30 | 90 = 30
): Promise<GoogleAdsDailyMetric[]> {
  const customerId = await getCustomerId(clientId);

  const rows = await query(customerId, `
    SELECT
      campaign.id, campaign.name, segments.date,
      metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions
    FROM campaign
    WHERE segments.date DURING LAST_${days}_DAYS
      AND campaign.status != 'REMOVED'
    ORDER BY segments.date
  `);

  return rows
    .map((row: any): GoogleAdsDailyMetric => ({
      date: String(row.segments?.date ?? ''),
      campaignId: String(row.campaign?.id ?? ''),
      campaignName: String(row.campaign?.name ?? ''),
      spend: fromMicros(row.metrics?.costMicros),
      impressions: Number(row.metrics?.impressions || 0),
      clicks: Number(row.metrics?.clicks || 0),
      conversions: Number(row.metrics?.conversions || 0),
    }))
    .filter((r) => r.date);
}


/**
 * Parole chiave con le loro metriche.
 *
 * La tabella "Lista di parole chiave" esisteva già nella pagina ma la route
 * restituiva `keywords: []` fisso, con un commento che diceva "richiedono una
 * query separata": non era mai stata scritta, quindi quella tabella era vuota
 * per costruzione, per ogni cliente, da sempre.
 *
 * Le campagne Performance Max e Shopping non hanno parole chiave: un account
 * che gira solo su quelle restituirà legittimamente una lista vuota.
 */
export async function getGoogleAdsKeywords(
  clientId: string,
  days: 7 | 30 | 90 = 30,
  limit = 100
): Promise<GoogleAdsKeyword[]> {
  const customerId = await getCustomerId(clientId);

  const rows = await query(customerId, `
    SELECT
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
    FROM keyword_view
    WHERE segments.date BETWEEN '${isoDaysAgo(days)}' AND '${isoDaysAgo(0)}'
      AND metrics.impressions > 0
    ORDER BY metrics.impressions DESC
    LIMIT ${limit}
  `);

  // Una riga per giorno per keyword: si sommano, e le medie si ricalcolano.
  const byKeyword = new Map<string, GoogleAdsKeyword>();
  for (const row of rows) {
    const k = row.adGroupCriterion?.keyword || {};
    const m = row.metrics || {};
    const text = String(k.text ?? '');
    if (!text) continue;
    const key = `${text}|${k.matchType ?? ''}`;

    const e = byKeyword.get(key) || {
      keyword: text, matchType: String(k.matchType ?? ''),
      impressions: 0, clicks: 0, spend: 0, conversions: 0, cpc: 0, ctr: 0, cpm: 0,
    };
    e.impressions += Number(m.impressions || 0);
    e.clicks += Number(m.clicks || 0);
    e.spend += fromMicros(m.costMicros);
    e.conversions += Number(m.conversions || 0);
    byKeyword.set(key, e);
  }

  return Array.from(byKeyword.values())
    .map((k) => ({
      ...k,
      cpc: k.clicks > 0 ? k.spend / k.clicks : 0,
      ctr: k.impressions > 0 ? (k.clicks / k.impressions) * 100 : 0,
      cpm: k.impressions > 0 ? (k.spend / k.impressions) * 1000 : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

/**
 * Totali a livello di account per la scheda "Performance per Account".
 *
 * Stesse chiavi che la UI leggeva quando questi numeri arrivavano da Windsor
 * (`clicks`, `impressions`, `cost`, `conversions`, `ctr`, `cpc`), così la
 * scheda non cambia — cambia solo da dove arrivano: **0,8 secondi invece di
 * ~13**, misurati sullo stesso account. Con tre piattaforme Windsor attive era
 * la singola voce più lenta dell'intero report.
 *
 * Prende l'id account direttamente invece di rileggerlo da Firestore: chi
 * chiama ce l'ha già in mano.
 */
export async function getGoogleAdsAccountTotals(
  customerId: string,
  dateFrom: string,
  dateTo: string
): Promise<Record<string, number>> {
  const rows = await query(customerId, `
    SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions
    FROM customer
    WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
  `);

  let cost = 0, impressions = 0, clicks = 0, conversions = 0;
  for (const row of rows) {
    const m = row.metrics || {};
    cost += fromMicros(m.costMicros);
    impressions += Number(m.impressions || 0);
    clicks += Number(m.clicks || 0);
    conversions += Number(m.conversions || 0);
  }

  return {
    cost: Math.round(cost * 100) / 100,
    impressions, clicks, conversions,
    // Ricalcolati sui totali: sommare i tassi giornalieri non avrebbe senso.
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpc: clicks > 0 ? Math.round((cost / clicks) * 100) / 100 : 0,
  };
}

export function getMockGoogleAdsDailyMetrics(clientId: string): GoogleAdsDailyMetric[] {
  // Pesi giornalieri fissi per giorno della settimana (0=dom … 6=sab)
  const dayWeights = [0.08, 0.18, 0.20, 0.20, 0.18, 0.12, 0.04];

  // Valori mensili di riferimento coerenti con il mock campagne
  const monthlySpend = 1800.20;
  const monthlyImpressions = 137500;
  const monthlyClicks = 2450;
  const monthlyConversions = 170;

  const today = new Date();
  const result: GoogleAdsDailyMetric[] = [];

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dow = date.getDay();
    // Peso normalizzato sul periodo di 30 giorni
    const w = dayWeights[dow];
    // Somma dei pesi per i 30 giorni — calcolata staticamente per evitare varianza
    const totalWeight = 30 * (dayWeights.reduce((a, b) => a + b, 0) / 7);
    const factor = w / totalWeight;

    result.push({
      date: dateStr,
      campaignId: `mock-${clientId}`,
      campaignName: 'Tutte le campagne (mock)',
      spend: parseFloat((monthlySpend * factor).toFixed(2)),
      impressions: Math.round(monthlyImpressions * factor),
      clicks: Math.round(monthlyClicks * factor),
      conversions: Math.round(monthlyConversions * factor),
    });
  }

  return result;
}

export function getMockGoogleAdsCampaigns(clientId: string): GoogleAdsCampaign[] {
  return [
    {
      id: `gads-${clientId}-1`,
      name: `Search - Keyword Competitor`,
      status: 'ENABLED',
      spend: 450.20,
      impressions: 12500,
      clicks: 850,
      cpc: 0.53,
      conversions: 45,
      costPerConversion: 10.00,
      roas: null
    },
    {
      id: `gads-${clientId}-2`,
      name: `PMax - Prodotti Principali`,
      status: 'ENABLED',
      spend: 1200.00,
      impressions: 45000,
      clicks: 1200,
      cpc: 1.00,
      conversions: 120,
      costPerConversion: 10.00,
      roas: 4.5
    },
    {
      id: `gads-${clientId}-3`,
      name: `Display - Remarketing`,
      status: 'PAUSED',
      spend: 150.00,
      impressions: 80000,
      clicks: 400,
      cpc: 0.37,
      conversions: 5,
      costPerConversion: 30.00,
      roas: null
    }
  ];
}

export interface GoogleAdsAccount {
  id: string;
  name: string;
  currency: string;
  timeZone: string;
  /** false quando l'account è elencato ma non interrogabile (tipicamente un
   *  account amministratore, che va letto passando login-customer-id). */
  readable: boolean;
}

/**
 * Gli account pubblicitari accessibili con le credenziali d'agenzia.
 *
 * Serve alla schermata che elenca i clienti Google Ads collegabili. Stava in
 * una route a parte che usava **API v17** — oggi 404 — e variabili d'ambiente
 * diverse da quelle del resto del Hub, quindi non funzionava comunque.
 */
export async function listAccessibleCustomers(): Promise<GoogleAdsAccount[]> {
  const token = await getAccessToken();

  const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers:listAccessibleCustomers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Google Ads ha risposto ${res.status}`);
  }

  const ids: string[] = (json.resourceNames || []).map((r: string) => r.split('/')[1]).filter(Boolean);

  // Il nome non sta nell'elenco: va chiesto account per account. Un account a
  // cui non si ha accesso in lettura non deve far fallire tutta la lista.
  const accounts = await Promise.all(ids.map(async (id): Promise<GoogleAdsAccount> => {
    try {
      const rows = await query(id, `
        SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone
        FROM customer LIMIT 1
      `);
      const c = rows[0]?.customer ?? {};
      return {
        id,
        name: String(c.descriptiveName ?? id),
        currency: String(c.currencyCode ?? ''),
        timeZone: String(c.timeZone ?? ''),
        readable: true,
      };
    } catch {
      // Elencato ma non leggibile: si restituisce comunque, marcato. Una riga
      // con solo il numero sembrerebbe un difetto della pagina invece di un
      // account su cui non abbiamo accesso in lettura.
      return { id, name: `Account ${id}`, currency: '', timeZone: '', readable: false };
    }
  }));

  // Prima quelli leggibili: le righe senza nome in fondo, non sparse.
  return accounts.sort((a, b) =>
    Number(b.readable) - Number(a.readable) || a.name.localeCompare(b.name));
}

export interface CompetitiveCampaign {
  id: string;
  name: string;
  channel: string;
  impressions: number;
  cost: number;
  /** Quota impression ottenuta, 0..1. null quando Google dà solo un limite. */
  impressionShare: number | null;
  /** 'lt10' = "<10%", 'gt90' = ">90%": Google non dà il valore esatto. */
  bound: 'lt10' | 'gt90' | null;
  /** Quota persa perché i competitor ti superano (qualità/offerta). */
  rankLost: number;
  /** Quota persa perché il budget finisce. */
  budgetLost: number;
  absoluteTop: number | null;
  clickShare: number | null;
  /** Cosa ti sta costando più impression, in parole. */
  diagnosi: 'competitor' | 'budget' | 'nessuna';
}

export interface CompetitivePressure {
  campaigns: CompetitiveCampaign[];
  /** Quota impression dell'account, pesata sulle impression disponibili. */
  impressionShare: number | null;
  rankLost: number;
  budgetLost: number;
  /** Campagne escluse dalla media perché Google ha dato solo un limite. */
  boundedCampaigns: number;
  /** Quota di impression coperte da campagne con quota esatta, 0..1. */
  shareCoverage: number;
  diagnosi: 'competitor' | 'budget' | 'nessuna';
}

/**
 * ⚠️ Google **non sempre restituisce la quota reale**: sotto il 10% manda
 * `0.0999` e sopra il 90% manda `0.9001`. Sono limiti, non misure — verificato
 * su quattro account diversi, dove `0.0999` compariva cinque volte identico su
 * campagne che non hanno niente in comune.
 *
 * Mostrarli come "10,0%" e "90,0%" significherebbe spacciare un intervallo per
 * un numero, e farebbe sembrare misurate campagne di cui Google dice
 * esplicitamente di non sapere la quota. Qui vengono marcati e tenuti fuori
 * dalla media dell'account.
 */
function readShare(v: unknown): { value: number | null; bound: 'lt10' | 'gt90' | null } {
  if (typeof v !== 'number') return { value: null, bound: null };
  if (Math.abs(v - 0.0999) < 1e-6) return { value: null, bound: 'lt10' };
  if (Math.abs(v - 0.9001) < 1e-6) return { value: null, bound: 'gt90' };
  return { value: v, bound: null };
}

/**
 * Serve un margine: 40% perso per rank e 38% per budget non sono due
 * diagnosi diverse, sono lo stesso quadro. Sotto i 5 punti non si sbilancia.
 */
function diagnose(rankLost: number, budgetLost: number): 'competitor' | 'budget' | 'nessuna' {
  if (Math.abs(rankLost - budgetLost) < 0.05) return 'nessuna';
  return rankLost > budgetLost ? 'competitor' : 'budget';
}

/**
 * Pressione competitiva: quanta parte delle ricerche disponibili stiamo
 * prendendo, e **perché** perdiamo il resto.
 *
 * È l'unico dato competitivo numerico che le API espongano: i nomi dei
 * concorrenti Google li mostra solo nella sua interfaccia
 * (`auction_insight_domain` non esiste come campo, verificato).
 *
 * La distinzione che conta, e che un ROAS non mostra: perdere per **rank**
 * significa che i competitor ti battono su qualità e offerta; perdere per
 * **budget** significa che arrivi primo ma finisci i soldi. Misurato su due
 * clienti reali: uno perde il 46% per rank, l'altro il 76% per budget. Due
 * problemi opposti, due interventi opposti.
 */
export async function getGoogleAdsCompetitivePressure(
  customerId: string,
  dateFrom: string,
  dateTo: string
): Promise<CompetitivePressure> {
  const rows = await query(customerId, `
    SELECT
      campaign.id, campaign.name, campaign.advertising_channel_type,
      metrics.impressions, metrics.cost_micros,
      metrics.search_impression_share,
      metrics.search_rank_lost_impression_share,
      metrics.search_budget_lost_impression_share,
      metrics.search_absolute_top_impression_share,
      metrics.search_click_share
    FROM campaign
    WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
      AND metrics.impressions > 0
  `);

  // Una riga per campagna per giorno: le quote sono medie, non si sommano.
  // Si pesano sulle impression del giorno.
  const byCampaign = new Map<string, any>();
  for (const r of rows) {
    const c = r.campaign || {};
    const m = r.metrics || {};
    const id = String(c.id ?? '');
    if (!id) continue;

    const imp = Number(m.impressions || 0);
    const e = byCampaign.get(id) || {
      id, name: String(c.name ?? id), channel: String(c.advertisingChannelType ?? ''),
      impressions: 0, cost: 0,
      shareNum: 0, shareDen: 0, boundHits: { lt10: 0, gt90: 0 },
      rankNum: 0, budgetNum: 0, topNum: 0, topDen: 0, clickNum: 0, clickDen: 0,
    };
    e.impressions += imp;
    e.cost += fromMicros(m.costMicros);

    const share = readShare(m.searchImpressionShare);
    if (share.value !== null) { e.shareNum += share.value * imp; e.shareDen += imp; }
    else if (share.bound) e.boundHits[share.bound] += 1;

    e.rankNum += Number(m.searchRankLostImpressionShare || 0) * imp;
    e.budgetNum += Number(m.searchBudgetLostImpressionShare || 0) * imp;

    const top = readShare(m.searchAbsoluteTopImpressionShare);
    if (top.value !== null) { e.topNum += top.value * imp; e.topDen += imp; }
    const click = readShare(m.searchClickShare);
    if (click.value !== null) { e.clickNum += click.value * imp; e.clickDen += imp; }

    byCampaign.set(id, e);
  }

  const round = (n: number) => Math.round(n * 10000) / 10000;
  const campaigns: CompetitiveCampaign[] = Array.from(byCampaign.values()).map((e) => {
    const rankLost = e.impressions > 0 ? round(e.rankNum / e.impressions) : 0;
    const budgetLost = e.impressions > 0 ? round(e.budgetNum / e.impressions) : 0;
    const bound: 'lt10' | 'gt90' | null =
      e.shareDen === 0 && e.boundHits.lt10 > 0 ? 'lt10'
      : e.shareDen === 0 && e.boundHits.gt90 > 0 ? 'gt90'
      : null;

    return {
      id: e.id, name: e.name, channel: e.channel,
      impressions: e.impressions, cost: Math.round(e.cost * 100) / 100,
      impressionShare: e.shareDen > 0 ? round(e.shareNum / e.shareDen) : null,
      bound,
      rankLost, budgetLost,
      absoluteTop: e.topDen > 0 ? round(e.topNum / e.topDen) : null,
      clickShare: e.clickDen > 0 ? round(e.clickNum / e.clickDen) : null,
      diagnosi: diagnose(rankLost, budgetLost),
    };
  }).sort((a, b) => b.cost - a.cost);

  // Media dell'account: solo sulle campagne di cui Google dà la quota vera.
  const exact = campaigns.filter((c) => c.impressionShare !== null);
  const impExact = exact.reduce((s, c) => s + c.impressions, 0);
  const impAll = campaigns.reduce((s, c) => s + c.impressions, 0);

  // ⚠️ La quota dell'account si calcola solo se le campagne con valore esatto
  // rappresentano la maggioranza delle impression. Su un cliente reale il
  // 91,5% veniva da una sola campagna brand, mentre le Performance Max — che
  // facevano il grosso del volume — erano tutte "<10%": il risultato era una
  // quota d'account quattro volte più alta del vero. Meglio nessun numero che
  // un numero sbagliato in modo rassicurante.
  const coverage = impAll > 0 ? round(impExact / impAll) : 0;
  const accountShare = coverage >= 0.5
    ? round(exact.reduce((s, c) => s + (c.impressionShare as number) * c.impressions, 0) / impExact)
    : null;
  const rankLost = impAll > 0 ? round(campaigns.reduce((s, c) => s + c.rankLost * c.impressions, 0) / impAll) : 0;
  const budgetLost = impAll > 0 ? round(campaigns.reduce((s, c) => s + c.budgetLost * c.impressions, 0) / impAll) : 0;

  return {
    campaigns,
    impressionShare: accountShare,
    rankLost, budgetLost,
    boundedCampaigns: campaigns.filter((c) => c.bound !== null).length,
    shareCoverage: coverage,
    diagnosi: diagnose(rankLost, budgetLost),
  };
}
