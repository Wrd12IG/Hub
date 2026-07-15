/**
 * GET  /api/clients/[id]/youtube/token  → stato del token YouTube
 * POST /api/clients/[id]/youtube/token  → salva token OAuth YouTube
 * DELETE /api/clients/[id]/youtube/token → rimuovi integrazione
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, getClientToken, saveClientToken } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const YT_DATA_BASE = 'https://www.googleapis.com/youtube/v3';

// ─── GET: Stato token corrente ────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const { id: clientId } = params;

  try {
    const tokenData = await getClientToken(clientId, 'youtube');
    if (!tokenData?.accessToken) {
      return NextResponse.json({ configured: false, valid: false, message: 'YouTube non configurato' });
    }

    // Verifica token con YouTube
    try {
      const res = await fetch(`${YT_DATA_BASE}/channels?part=snippet,statistics&mine=true`, {
        headers: { Authorization: `Bearer ${tokenData.accessToken}` },
      });

      if (!res.ok) throw new Error(`YouTube API ${res.status}`);
      const data = await res.json();
      const channel = data.items?.[0];

      return NextResponse.json({
        configured: true,
        valid: true,
        channelName: channel?.snippet?.title || null,
        channelId: channel?.id || null,
        subscriberCount: channel?.statistics?.subscriberCount || 0,
        expiresAt: tokenData.expiresAt ? new Date(tokenData.expiresAt).toISOString() : null,
        accountId: tokenData.accountId,
      });
    } catch (apiErr: any) {
      return NextResponse.json({
        configured: true,
        valid: false,
        error: apiErr.message,
        message: 'Token non valido o scaduto',
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
  const { code, redirectUri, accessToken: directToken, refreshToken: directRefresh } = body;

  try {
    let accessToken: string;
    let refreshToken: string | undefined;
    let expiresIn = 3600;

    if (directToken) {
      // Token inserito manualmente (es. da Service Account o da OAuth già completato)
      accessToken = directToken;
      refreshToken = directRefresh;
    } else if (code) {
      // Exchange code → token
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return NextResponse.json({ error: `OAuth exchange failed: ${err}` }, { status: 400 });
      }

      const tokenData = await tokenRes.json();
      accessToken = tokenData.access_token;
      refreshToken = tokenData.refresh_token;
      expiresIn = tokenData.expires_in || 3600;
    } else {
      return NextResponse.json({ error: 'Fornisci code (OAuth) o accessToken' }, { status: 400 });
    }

    // Verifica token e ottieni info canale
    const channelRes = await fetch(`${YT_DATA_BASE}/channels?part=snippet,statistics&mine=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!channelRes.ok) {
      return NextResponse.json({ error: 'Token YouTube non valido' }, { status: 400 });
    }

    const channelData = await channelRes.json();
    const channel = channelData.items?.[0];

    await saveClientToken(clientId, 'youtube', {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
      accountId: channel?.id || '',
      extra: {
        channelName: channel?.snippet?.title || '',
        updatedAt: Date.now().toString(),
        updatedBy: user.uid,
      },
    });

    return NextResponse.json({
      success: true,
      channelName: channel?.snippet?.title || null,
      channelId: channel?.id || null,
      message: 'YouTube connesso con successo!',
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
    .collection('integrations').doc('youtube')
    .delete();

  return NextResponse.json({ success: true, message: 'Integrazione YouTube rimossa' });
}
