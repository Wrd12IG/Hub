/**
 * lib/ga4-client.ts
 * 
 * Interfaccia per la BetaAnalyticsDataClient ufficiale di Google.
 * Estrae traffico, sessioni e pagine viste da una Proprietà GA4.
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { getClientToken } from '@/lib/api-auth';

// ─── Strutture Dati Output ───────────────────────────────────────────────────

export interface GA4AnalyticsData {
  summary: {
    sessions: number;
    users: number;
    newUsers: number;
    pageviews: number;
    bounceRate: number;
    avgSessionDuration: number; // in secondi
    conversionRate: number;
  };
  chartData: { date: string; sessions: number; users: number; pageviews: number }[];
  topPages: { path: string; pageviews: number; avgTime: number }[];
  trafficSources: { source: string; sessions: number; percentage: number }[];
}

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

export async function getGA4Analytics(clientId: string, dateRangeDays: number = 30): Promise<GA4AnalyticsData> {
  // Cerchiamo la proprietà (Property ID) salvata per questo cliente su Firestore
  const tokenData = await getClientToken(clientId, 'google');
  const propertyId = tokenData?.extra?.ga4PropertyId;

  if (!propertyId) {
    throw new Error(`Nessuna Property GA4 configurata per il cliente ${clientId}`);
  }

  const analyticsDataClient = getGa4Client();
  const property = `properties/${propertyId}`;

  // 1. Report Riassuntivo (Summary)
  const [summaryResponse] = await analyticsDataClient.runReport({
    property,
    dateRanges: [{ startDate: `${dateRangeDays}daysAgo`, endDate: 'today' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'newUsers' },
      { name: 'screenPageViews' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
      { name: 'sessionConversionRate' }
    ],
  });

  // 2. Dati per il grafico temporale (per giorno)
  const [timelineResponse] = await analyticsDataClient.runReport({
    property,
    dateRanges: [{ startDate: `${dateRangeDays}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }],
    orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }]
  });

  // 3. Pagine più visitate
  const [pagesResponse] = await analyticsDataClient.runReport({
    property,
    dateRanges: [{ startDate: `${dateRangeDays}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'userEngagementDuration' }],
    limit: 10,
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }]
  });

  // 4. Sorgenti di traffico (Organic, Direct, ecc)
  const [sourcesResponse] = await analyticsDataClient.runReport({
    property,
    dateRanges: [{ startDate: `${dateRangeDays}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
  });

  // --- Parsing Risposte ---
  const sumRow = summaryResponse.rows?.[0];
  const summary = {
    sessions: parseInt(sumRow?.metricValues?.[0]?.value || '0'),
    users: parseInt(sumRow?.metricValues?.[1]?.value || '0'),
    newUsers: parseInt(sumRow?.metricValues?.[2]?.value || '0'),
    pageviews: parseInt(sumRow?.metricValues?.[3]?.value || '0'),
    bounceRate: parseFloat(sumRow?.metricValues?.[4]?.value || '0'),
    avgSessionDuration: Math.round(parseFloat(sumRow?.metricValues?.[5]?.value || '0')),
    conversionRate: parseFloat(sumRow?.metricValues?.[6]?.value || '0'),
  };

  const chartData = (timelineResponse.rows || []).map(row => {
    // Trasforma '20260504' in '2026-05-04'
    const d = row.dimensionValues?.[0]?.value || '';
    const dateFormatted = d.length === 8 ? `${d.substring(0,4)}-${d.substring(4,6)}-${d.substring(6,8)}` : d;
    return {
      date: dateFormatted,
      sessions: parseInt(row.metricValues?.[0]?.value || '0'),
      users: parseInt(row.metricValues?.[1]?.value || '0'),
      pageviews: parseInt(row.metricValues?.[2]?.value || '0'),
    };
  });

  const topPages = (pagesResponse.rows || []).map(row => {
    const views = parseInt(row.metricValues?.[0]?.value || '0');
    // userEngagementDuration in GA4 è il tempo totale. Diviso per le view dà una media grezza
    const totalTime = parseFloat(row.metricValues?.[1]?.value || '0');
    return {
      path: row.dimensionValues?.[0]?.value || '/',
      pageviews: views,
      avgTime: views > 0 ? Math.round(totalTime / views) : 0,
    };
  });

  const totalSourcesSessions = (sourcesResponse.rows || []).reduce(
    (sum, row) => sum + parseInt(row.metricValues?.[0]?.value || '0'), 0
  );

  const trafficSources = (sourcesResponse.rows || []).map(row => {
    const sess = parseInt(row.metricValues?.[0]?.value || '0');
    return {
      source: row.dimensionValues?.[0]?.value || 'Unknown',
      sessions: sess,
      percentage: totalSourcesSessions > 0 ? (sess / totalSourcesSessions) * 100 : 0,
    };
  });

  return { summary, chartData, topPages, trafficSources };
}
