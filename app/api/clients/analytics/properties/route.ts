/**
 * GET /api/clients/analytics/properties
 * 
 * Lista tutte le proprietà GA4 accessibili tramite le credenziali Google dell'agenzia.
 * Usa il Google Service Account JSON (GOOGLE_SERVICE_ACCOUNT_JSON env var)
 * oppure il refresh token (GOOGLE_REFRESH_TOKEN + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET).
 * 
 * Risposta: { properties: [{ name, displayName, createTime }] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';

/** Ottieni un access token Google tramite Service Account JSON */
async function getGoogleAccessToken(): Promise<string> {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  // --- Opzione 1: Service Account JWT ---
  if (serviceAccountJson) {
    const sa = JSON.parse(serviceAccountJson);
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/adwords',
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
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('Service account token failed: ' + JSON.stringify(tokenData));
    return tokenData.access_token;
  }

  // --- Opzione 2: OAuth Refresh Token ---
  if (refreshToken && clientId && clientSecret) {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('Refresh token exchange failed: ' + JSON.stringify(tokenData));
    return tokenData.access_token;
  }

  throw new Error('Nessuna credenziale Google configurata (GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_REFRESH_TOKEN)');
}

export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  try {
    const accessToken = await getGoogleAccessToken();

    // Chiama Google Analytics Admin API
    const res = await fetch('https://analyticsadmin.googleapis.com/v1beta/properties?pageSize=200', {
      headers: { Authorization: `Bearer ${accessToken}` },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: 'Google Analytics Admin API error: ' + JSON.stringify(err?.error?.message || err) },
        { status: 502 }
      );
    }

    const data = await res.json();
    const properties = (data.properties || []).map((p: any) => ({
      name: p.name,           // es. properties/345678901
      propertyId: p.name.replace('properties/', ''),
      displayName: p.displayName,
      currencyCode: p.currencyCode,
      timeZone: p.timeZone,
    }));

    return NextResponse.json({
      properties,
      _meta: { source: 'live', count: properties.length },
    });
  } catch (error: any) {
    // Credenziali mancanti → restituisci messaggio utile invece di crash
    const isConfigError = error.message?.includes('Nessuna credenziale');
    return NextResponse.json(
      {
        properties: [],
        error: error.message,
        _meta: {
          source: 'empty',
          configMissing: isConfigError,
          hint: isConfigError
            ? 'Aggiungi GOOGLE_SERVICE_ACCOUNT_JSON oppure GOOGLE_REFRESH_TOKEN + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET nelle variabili Vercel.'
            : undefined,
        },
      },
      { status: isConfigError ? 503 : 502 }
    );
  }
}
