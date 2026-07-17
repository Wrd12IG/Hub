/**
 * lib/google-ads-client.ts
 * 
 * Interfaccia per comunicare con la Google Ads API.
 * Utilizza la libreria ufficiale "google-ads-api" per Node.js.
 */

import { GoogleAdsApi, enums } from 'google-ads-api';
import { getClientToken } from '@/lib/api-auth';

// ─── Tipi di dato in uscita per il frontend ───────────────────────────────────

export interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED' | 'UNKNOWN';
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

export interface GoogleAdsDailyMetric {
  date: string;          // YYYY-MM-DD
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

// ─── Configurazione Client API ───────────────────────────────────────────────

/**
 * Istanzia il client Google Ads utilizzando i token del cliente.
 */
function getAdsClient(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  if (!clientId || !clientSecret || !developerToken) {
    throw new Error('Google Ads API credentials missing in .env.local');
  }

  return new GoogleAdsApi({
    client_id: clientId,
    client_secret: clientSecret,
    developer_token: developerToken,
  });
}

// ─── Funzioni Principali ─────────────────────────────────────────────────────

/**
 * Scarica le campagne Google Ads per un determinato cliente.
 * Interroga la tabella 'campaign' e la unisce a 'metrics'.
 */
export async function getGoogleAdsCampaigns(clientId: string): Promise<{ campaigns: GoogleAdsCampaign[], summary: GoogleAdsSummary }> {
  const tokenData = await getClientToken(clientId, 'google');

  // Verifica che esista un token con il refreshToken (essenziale per Google Ads) e l'accountId (Customer ID)
  if (!tokenData?.refreshToken || !tokenData?.accountId) {
    throw new Error('Google Ads non configurato per questo cliente o refresh_token mancante.');
  }

  // Costruiamo il client e agganciamoci all'account del cliente
  const client = getAdsClient(tokenData.refreshToken);
  
  // Rimuove gli eventuali trattini dal Customer ID (es. 123-456-7890 -> 1234567890)
  const customerId = tokenData.accountId.replace(/-/g, '');
  const customer = client.Customer({
    customer_id: customerId,
    refresh_token: tokenData.refreshToken,
    // Se c'è un MCC (Account amministratore), lo usiamo
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  });

  // Query GAQL (Google Ads Query Language)
  // Selezioniamo le campagne NON eliminate, coi dati degli ultimi 30 giorni
  const query = `
    SELECT 
      campaign.id, 
      campaign.name, 
      campaign.status, 
      metrics.cost_micros, 
      metrics.impressions, 
      metrics.clicks, 
      metrics.average_cpc, 
      metrics.conversions, 
      metrics.cost_per_conversion,
      metrics.conversions_value
    FROM campaign 
    WHERE segments.date DURING LAST_30_DAYS
      AND campaign.status != 'REMOVED'
  `;

  try {
    const report = await customer.query(query);

    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;

    const campaigns: GoogleAdsCampaign[] = report.map((row: any) => {
      // I costi in Google Ads arrivano in "micros" (1 milione = 1 moneta)
      const spend = (row.metrics.cost_micros || 0) / 1000000;
      const cpc = (row.metrics.average_cpc || 0) / 1000000;
      const cpa = (row.metrics.cost_per_conversion || 0) / 1000000;
      const convValue = row.metrics.conversions_value || 0;
      const roas = spend > 0 ? convValue / spend : null;
      
      const statusMap: Record<number, string> = {
        [enums.CampaignStatus.ENABLED]: 'ENABLED',
        [enums.CampaignStatus.PAUSED]: 'PAUSED',
        [enums.CampaignStatus.REMOVED]: 'REMOVED',
      };

      totalSpend += spend;
      totalImpressions += row.metrics.impressions || 0;
      totalClicks += row.metrics.clicks || 0;
      totalConversions += row.metrics.conversions || 0;

      return {
        id: String(row.campaign.id),
        name: row.campaign.name,
        status: (statusMap[row.campaign.status] || 'UNKNOWN') as any,
        spend,
        impressions: row.metrics.impressions || 0,
        clicks: row.metrics.clicks || 0,
        cpc,
        conversions: row.metrics.conversions || 0,
        costPerConversion: cpa,
        roas,
      };
    });

    return {
      campaigns,
      summary: {
        accountId: tokenData.accountId,
        totalSpend,
        totalImpressions,
        totalClicks,
        totalConversions,
      }
    };
  } catch (error) {
    console.error('[google-ads-client] Query failed:', error);
    throw error;
  }
}

// ─── Daily Metrics (GAQL) ────────────────────────────────────────────────────

/**
 * Scarica il breakdown giornaliero (ultimi 30 giorni) per tutte le campagne
 * di un account Google Ads tramite GAQL.
 */
export async function getGoogleAdsDailyMetrics(
  clientId: string
): Promise<GoogleAdsDailyMetric[]> {
  const tokenData = await getClientToken(clientId, 'google');

  if (!tokenData?.refreshToken || !tokenData?.accountId) {
    throw new Error('Google Ads non configurato per questo cliente o refresh_token mancante.');
  }

  const client = getAdsClient(tokenData.refreshToken);
  const customerId = tokenData.accountId.replace(/-/g, '');
  const customer = client.Customer({
    customer_id: customerId,
    refresh_token: tokenData.refreshToken,
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  });

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      segments.date,
      metrics.cost_micros,
      metrics.conversions,
      metrics.clicks,
      metrics.impressions
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
      AND campaign.status != 'REMOVED'
    ORDER BY segments.date
  `;

  try {
    const report = await customer.query(query);

    return report.map((row: any): GoogleAdsDailyMetric => ({
      date: row.segments.date as string,           // formato YYYY-MM-DD
      campaignId: String(row.campaign.id),
      campaignName: row.campaign.name,
      spend: (row.metrics.cost_micros || 0) / 1_000_000,
      impressions: row.metrics.impressions || 0,
      clicks: row.metrics.clicks || 0,
      conversions: row.metrics.conversions || 0,
    }));
  } catch (error) {
    console.error('[google-ads-client] Daily query failed:', error);
    throw error;
  }
}

// ─── Mock Fallback ────────────────────────────────────────────────────────────

/**
 * Genera un breakdown giornaliero deterministico (NO Math.random / Math.sin).
 * Ogni giorno riceve la sua quota proporzionale agli indici giornalieri classici
 * (lun-ven più alto, sab-dom più basso).
 */
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
