/**
 * lib/gbp-client.ts
 * 
 * Interfaccia per la Google Business Profile API.
 * Utilizza la libreria ufficiale "googleapis" per Node.js.
 */

import { google } from 'googleapis';
import { getClientToken } from '@/lib/api-auth';

// ─── Strutture Dati Output ───────────────────────────────────────────────────

export interface GBPLocation {
  name: string; // ID interno di Google (es. "locations/12345")
  title: string;
  phone: string | null;
  website: string | null;
  address: string | null;
}

// ─── Funzione Principale ─────────────────────────────────────────────────────

export async function getGBPLocations(clientId: string): Promise<GBPLocation[]> {
  const tokenData = await getClientToken(clientId, 'gbp');

  // Per GBP, usiamo un OAuth token del cliente (oppure lo passiamo come Service Account se hai i permessi)
  if (!tokenData?.accessToken) {
    throw new Error(`Google Business Profile non collegato per il cliente ${clientId}`);
  }

  // Costruiamo il client OAuth2
  const authClient = new google.auth.OAuth2();
  authClient.setCredentials({
    access_token: tokenData.accessToken,
    refresh_token: tokenData.refreshToken, // Se presente, googleapis proverà a fare il refresh automatico
  });

  // GBP usa la libreria 'mybusinessbusinessinformation' v1
  const mybusiness = google.mybusinessbusinessinformation({
    version: 'v1',
    auth: authClient,
  });

  // Nota: l'accountName (es. 'accounts/123456') deve essere stato salvato in fase di setup.
  // Lo cerchiamo nell'accountId o nel campo extra.
  const accountName = tokenData.accountId || tokenData.extra?.accountName;
  if (!accountName) {
    throw new Error('ID Account (accountName) mancante nella configurazione GBP.');
  }

  try {
    const res = await mybusiness.accounts.locations.list({
      parent: accountName,
      readMask: 'name,title,storefrontAddress,websiteUri,phoneNumbers',
    });

    const locations = res.data.locations || [];

    return locations.map(loc => {
      // Formatta l'indirizzo per il frontend
      const addr = loc.storefrontAddress;
      const addressString = addr
        ? `${addr.addressLines?.join(', ')}, ${addr.locality} (${addr.administrativeArea})`
        : null;

      return {
        name: loc.name || '',
        title: loc.title || 'Sede Sconosciuta',
        phone: loc.phoneNumbers?.primaryPhone || null,
        website: loc.websiteUri || null,
        address: addressString,
      };
    });
  } catch (error) {
    console.error('[gbp-client] Error fetching locations:', error);
    throw error;
  }
}

// ─── Mock Fallback ────────────────────────────────────────────────────────────

// ─── Mock Fallback ────────────────────────────────────────────────────────────

export function getMockGBPLocations(clientId: string): GBPLocation[] {
  return [
    {
      name: `accounts/mock/locations/${clientId}-1`,
      title: 'Sede Principale W[r]Digital',
      phone: '+39 039 123 4567',
      website: 'https://wrdigital.it',
      address: 'Via Roma 1, Monza (MB)',
    }
  ];
}

export interface GBPInsights {
  totalImpressions: number;
  totalActions: number;
  websiteClicks: number;
  phoneCalls: number;
  directionRequests: number;
  impressionChange?: number;
}

export interface GBPReview {
  author: string;
  rating: number;
  text: string;
  date: string;
  replied?: boolean;
}

export interface GBPReviews {
  totalReviews: number;
  unansweredCount: number;
  averageRating: number;
  recent: GBPReview[];
}

export interface GBPKeyword {
  keyword: string;
  impressions: number;
}

export interface GBPData {
  insights?: GBPInsights;
  reviews?: GBPReviews;
  keywords?: GBPKeyword[];
  healthScore?: number;
  healthChecks?: Array<{ label: string; ok: boolean }>;
}

export function getMockGBPData(clientId: string): GBPData {
  // Deterministic values based on clientId to keep them stable
  const hash = clientId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const baseImpressions = 5400 + (hash % 3000);
  const websiteClicks = 320 + (hash % 150);
  const phoneCalls = 90 + (hash % 60);
  const directionRequests = 180 + (hash % 100);
  const totalActions = websiteClicks + phoneCalls + directionRequests;
  
  return {
    insights: {
      totalImpressions: baseImpressions,
      totalActions,
      websiteClicks,
      phoneCalls,
      directionRequests,
      impressionChange: 12.4 + (hash % 5),
    },
    reviews: {
      totalReviews: 48 + (hash % 20),
      unansweredCount: hash % 3,
      averageRating: 4.8,
      recent: [
        {
          author: 'Andrea Rossi',
          rating: 5,
          text: 'Servizio eccellente! Ho collaborato con W[r]Digital per il lancio del mio ecommerce e i risultati sono stati superiori alle aspettative. Team molto professionale.',
          date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
          replied: true
        },
        {
          author: 'Marco Bianchi',
          rating: 5,
          text: 'Esperti SEO di altissimo livello. Consigliatissimi.',
          date: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
          replied: true
        },
        {
          author: 'Elena Verdi',
          rating: 4,
          text: 'Molto soddisfatta della gestione delle campagne social e Google Ads. Sempre disponibili e pronti a proporre nuove idee strategiche.',
          date: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
          replied: false
        }
      ]
    },
    keywords: [
      { keyword: 'agenzia marketing milano', impressions: 450 + (hash % 100) },
      { keyword: 'consulenza seo monza', impressions: 320 + (hash % 50) },
      { keyword: 'social media manager brianza', impressions: 210 + (hash % 40) },
      { keyword: 'creazione siti web monza', impressions: 180 + (hash % 30) },
      { keyword: 'gestione google ads', impressions: 150 + (hash % 20) }
    ],
    healthScore: 92,
    healthChecks: [
      { label: 'Orari di apertura aggiornati', ok: true },
      { label: 'Numero di telefono verificato', ok: true },
      { label: 'Link sito web attivo', ok: true },
      { label: 'Foto del profilo caricate di recente', ok: true },
      { label: 'Risposte alle recensioni rapide', ok: false }
    ]
  };
}
