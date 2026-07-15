/**
 * GET  /api/clients/[id]/linkedin/token  → stato del token LinkedIn
 * POST /api/clients/[id]/linkedin/token  → salva token OAuth LinkedIn
 * DELETE /api/clients/[id]/linkedin/token → rimuovi integrazione
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, getClientToken, saveClientToken } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';

const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';

async function linkedinFetch<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${LINKEDIN_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202401',
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`LinkedIn API ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json() as Promise<T>;
}

// ─── GET: Stato token corrente ────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const { id: clientId } = params;

  try {
    const tokenData = await getClientToken(clientId, 'linkedin');
    if (!tokenData?.accessToken) {
      return NextResponse.json({ configured: false, valid: false, message: 'LinkedIn non configurato' });
    }

    try {
      const me = await linkedinFetch<any>('/me', tokenData.accessToken);
      const orgId = tokenData.extra?.organizationId || tokenData.accountId;

      let orgName = null;
      if (orgId) {
        try {
          const org = await linkedinFetch<any>(`/organizations/${orgId}?fields=id,name`, tokenData.accessToken);
          orgName = org?.name?.localized
            ? Object.values(org.name.localized)[0]
            : null;
        } catch {}
      }

      return NextResponse.json({
        configured: true,
        valid: true,
        userName: `${me.localizedFirstName} ${me.localizedLastName}`,
        organizationId: orgId || null,
        organizationName: orgName,
        expiresAt: tokenData.expiresAt ? new Date(tokenData.expiresAt).toISOString() : null,
      });
    } catch (apiErr: any) {
      return NextResponse.json({
        configured: true,
        valid: false,
        error: apiErr.message,
        message: 'Token LinkedIn non valido o scaduto',
      });
    }
  } catch (err: any) {
    return NextResponse.json({ configured: false, valid: false, error: err.message }, { status: 500 });
  }
}

// ─── POST: Salva token via OAuth code exchange ────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const { id: clientId } = params;

  const body = await request.json();
  const { code, redirectUri, organizationId, accessToken: directToken, refreshToken: directRefresh } = body;

  try {
    let accessToken: string;
    let refreshToken: string | undefined;
    let expiresIn = 5183944; // ~60 giorni

    if (directToken) {
      accessToken = directToken;
      refreshToken = directRefresh;
    } else if (code) {
      const tokenRes = await fetch(LINKEDIN_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: process.env.LINKEDIN_CLIENT_ID!,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return NextResponse.json({ error: `OAuth exchange failed: ${err}` }, { status: 400 });
      }

      const tokenData = await tokenRes.json();
      accessToken = tokenData.access_token;
      refreshToken = tokenData.refresh_token;
      expiresIn = tokenData.expires_in || 5183944;
    } else {
      return NextResponse.json({ error: 'Fornisci code (OAuth) o accessToken' }, { status: 400 });
    }

    // Verifica token e recupera nome utente
    const me = await linkedinFetch<any>('/me', accessToken);

    await saveClientToken(clientId, 'linkedin', {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
      accountId: organizationId || '',
      extra: {
        organizationId: organizationId || '',
        userName: `${me.localizedFirstName} ${me.localizedLastName}`,
        updatedAt: Date.now().toString(),
        updatedBy: user.uid,
      },
    });

    return NextResponse.json({
      success: true,
      userName: `${me.localizedFirstName} ${me.localizedLastName}`,
      organizationId: organizationId || null,
      message: 'LinkedIn connesso con successo!',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── DELETE: Rimuovi integrazione ─────────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const { id: clientId } = params;

  await adminDb
    .collection('clients').doc(clientId)
    .collection('integrations').doc('linkedin')
    .delete();

  return NextResponse.json({ success: true, message: 'Integrazione LinkedIn rimossa' });
}
