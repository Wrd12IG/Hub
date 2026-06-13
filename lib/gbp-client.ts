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
