/**
 * GET  /api/clients/[id]/tiktok/token  → stato del token TikTok
 * POST /api/clients/[id]/tiktok/token  → salva token OAuth TikTok
 * DELETE /api/clients/[id]/tiktok/token → rimuovi integrazione
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, getClientToken, saveClientToken } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';

const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const TIKTOK_USER_URL = 'https://open.tiktokapis.com/v2/user/info/';

// ─── GET: Stato token corrente ────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const { id: clientId } = params;

  try {
    const tokenData = await getClientToken(clientId, 'tiktok');
    if (!tokenData?.accessToken) {
      return NextResponse.json({ configured: false, valid: false, message: 'TikTok non configurato' });
    }

    try {
      const res = await fetch(
        `${TIKTOK_USER_URL}?fields=display_name,follower_count,video_count,avatar_url`,
        { headers: { Authorization: `Bearer ${tokenData.accessToken}` } }
      );

      if (!res.ok) throw new Error(`TikTok API ${res.status}`);
      const data = await res.json();
      const userInfo = data.data?.user;

      return NextResponse.json({
        configured: true,
        valid: true,
        displayName: userInfo?.display_name || null,
        followerCount: userInfo?.follower_count || 0,
        expiresAt: tokenData.expiresAt ? new Date(tokenData.expiresAt).toISOString() : null,
      });
    } catch (apiErr: any) {
      return NextResponse.json({
        configured: true,
        valid: false,
        error: apiErr.message,
        message: 'Token TikTok non valido o scaduto',
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
    let expiresIn = 86400;

    if (directToken) {
      accessToken = directToken;
      refreshToken = directRefresh;
    } else if (code) {
      const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: process.env.TIKTOK_CLIENT_KEY!,
          client_secret: process.env.TIKTOK_CLIENT_SECRET!,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return NextResponse.json({ error: `OAuth exchange failed: ${err}` }, { status: 400 });
      }

      const tokenData = await tokenRes.json();
      if (tokenData.error?.code !== 'ok') {
        return NextResponse.json({ error: JSON.stringify(tokenData.error) }, { status: 400 });
      }

      accessToken = tokenData.data.access_token;
      refreshToken = tokenData.data.refresh_token;
      expiresIn = tokenData.data.expires_in || 86400;
    } else {
      return NextResponse.json({ error: 'Fornisci code (OAuth) o accessToken' }, { status: 400 });
    }

    // Verifica token
    const userRes = await fetch(
      `${TIKTOK_USER_URL}?fields=open_id,display_name,follower_count,video_count`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!userRes.ok) {
      return NextResponse.json({ error: 'Token TikTok non valido' }, { status: 400 });
    }

    const userData = await userRes.json();
    const userInfo = userData.data?.user;

    await saveClientToken(clientId, 'tiktok', {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
      accountId: userInfo?.open_id || '',
      extra: {
        displayName: userInfo?.display_name || '',
        updatedAt: Date.now().toString(),
        updatedBy: user.uid,
      },
    });

    return NextResponse.json({
      success: true,
      displayName: userInfo?.display_name || null,
      followerCount: userInfo?.follower_count || 0,
      message: 'TikTok connesso con successo!',
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
    .collection('integrations').doc('tiktok')
    .delete();

  return NextResponse.json({ success: true, message: 'Integrazione TikTok rimossa' });
}
