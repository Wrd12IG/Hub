/**
 * GET /api/google-ads/customers
 * 
 * Lista tutti i Customer ID Google Ads accessibili dalle credenziali dell'agenzia.
 * Usa Google Ads API v17 con Developer Token + OAuth.
 * 
 * Env vars necessarie:
 * - GOOGLE_ADS_DEVELOPER_TOKEN (obbligatorio)
 * - GOOGLE_ADS_MANAGER_ACCOUNT_ID (opzionale, es. "123-456-7890")
 * - GOOGLE_SERVICE_ACCOUNT_JSON oppure GOOGLE_REFRESH_TOKEN + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
 * 
 * Risposta: { customers: [{ id, name, currency, timeZone, descriptiveName }] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';

async function getGoogleAccessToken(): Promise<string> {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (serviceAccountJson) {
    const sa = JSON.parse(serviceAccountJson);
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/adwords',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })).toString('base64url');
    const { createSign } = await import('crypto');
    const sign = createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const sig = sign.sign(sa.private_key, 'base64url');
    const jwt = `${header}.${payload}.${sig}`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    });
    const td = await tokenRes.json();
    if (!td.access_token) throw new Error('SA token failed: ' + JSON.stringify(td));
    return td.access_token;
  }

  if (refreshToken && clientId && clientSecret) {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    });
    const td = await tokenRes.json();
    if (!td.access_token) throw new Error('Refresh token failed: ' + JSON.stringify(td));
    return td.access_token;
  }

  throw new Error('Nessuna credenziale Google configurata');
}

export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const managerAccountId = process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID?.replace(/-/g, '');

  if (!developerToken) {
    return NextResponse.json(
      { error: 'GOOGLE_ADS_DEVELOPER_TOKEN non configurato nelle variabili Vercel.', customers: [] },
      { status: 503 }
    );
  }

  try {
    const accessToken = await getGoogleAccessToken();

    // Google Ads API: lista clienti accessibili
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    };
    if (managerAccountId) headers['login-customer-id'] = managerAccountId;

    const body = {
      query: `SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.status FROM customer WHERE customer.status = 'ENABLED' LIMIT 100`,
    };

    // Usa listAccessibleCustomers per scoprire gli account accessibili
    const listRes = await fetch('https://googleads.googleapis.com/v17/customers:listAccessibleCustomers', {
      headers,
    });

    if (!listRes.ok) {
      const err = await listRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: 'Google Ads API error: ' + JSON.stringify(err?.error?.message || err), customers: [] },
        { status: 502 }
      );
    }

    const listData = await listRes.json();
    const resourceNames: string[] = listData.resourceNames || [];

    // Per ogni customer, recupera i dettagli
    const customers = await Promise.all(
      resourceNames.slice(0, 50).map(async (resourceName: string) => {
        const customerId = resourceName.replace('customers/', '');
        try {
          const searchRes = await fetch(
            `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`,
            {
              method: 'POST',
              headers: { ...headers, 'login-customer-id': managerAccountId || customerId },
              body: JSON.stringify({ query: 'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1' }),
            }
          );
          if (!searchRes.ok) return null;
          const searchData = await searchRes.json();
          const c = searchData.results?.[0]?.customer;
          if (!c) return null;
          return {
            id: c.id,
            name: c.descriptiveName || `Account ${c.id}`,
            currency: c.currencyCode,
            timeZone: c.timeZone,
            formattedId: String(c.id).replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'),
          };
        } catch {
          return null;
        }
      })
    );

    const validCustomers = customers.filter(Boolean);

    return NextResponse.json({
      customers: validCustomers,
      _meta: { source: 'live', count: validCustomers.length },
    });
  } catch (error: any) {
    const isConfigError = error.message?.includes('Nessuna credenziale');
    return NextResponse.json(
      {
        customers: [],
        error: error.message,
        _meta: {
          source: 'empty',
          configMissing: isConfigError,
          hint: isConfigError ? 'Aggiungi GOOGLE_REFRESH_TOKEN + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET nelle variabili Vercel.' : undefined,
        },
      },
      { status: isConfigError ? 503 : 502 }
    );
  }
}
