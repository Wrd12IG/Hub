/**
 * GET  /api/clients/[id]/meta/token  → stato del token (scadenza, validità)
 * POST /api/clients/[id]/meta/token  → salva/aggiorna il token Meta
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, getClientToken, saveClientToken } from '@/lib/api-auth';

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';

async function metaFetch<T>(path: string, accessToken: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${META_GRAPH_BASE}${path}`);
  url.searchParams.set('access_token', accessToken);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Meta API ${res.status}: ${JSON.stringify(err)}`);
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
    const tokenData = await getClientToken(clientId, 'meta');

    if (!tokenData?.accessToken) {
      return NextResponse.json({
        configured: false,
        valid: false,
        message: 'Token Meta non configurato',
      });
    }

    // Verifica validità token con Meta
    try {
      const meRes = await metaFetch<any>('/me', tokenData.accessToken, { fields: 'id,name' });
      
      // Ottieni info scadenza token
      const debugRes = await metaFetch<any>('/debug_token', tokenData.accessToken, {
        input_token: tokenData.accessToken,
        access_token: tokenData.accessToken,
      });

      const expiresAt = debugRes.data?.expires_at;
      const expiresDate = expiresAt ? new Date(expiresAt * 1000) : null;
      const daysLeft = expiresDate 
        ? Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;

      return NextResponse.json({
        configured: true,
        valid: true,
        userName: meRes.name,
        userId: meRes.id,
        accountId: tokenData.accountId,
        pageId: tokenData.extra?.pageId,
        expiresAt: expiresDate?.toISOString() || null,
        daysLeft,
        expiresNever: expiresAt === 0, // Long-lived system user tokens never expire
        updatedAt: tokenData.extra?.updatedAt || null,
      });
    } catch (apiErr: any) {
      const errMsg = apiErr.message || '';
      const isExpired = errMsg.includes('Session has expired') || errMsg.includes('error_subcode":463');
      return NextResponse.json({
        configured: true,
        valid: false,
        expired: isExpired,
        error: apiErr.message,
        accountId: tokenData.accountId,
        pageId: tokenData.extra?.pageId,
        message: isExpired ? 'Token scaduto — rinnova il token in Meta Business Manager' : 'Token non valido',
      });
    }
  } catch (err: any) {
    return NextResponse.json({ configured: false, valid: false, error: err.message }, { status: 500 });
  }
}

// ─── POST: Salva nuovo token ──────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id: clientId } = params;

  const body = await request.json();
  const { accessToken, accountId, pageId } = body;

  if (!accessToken) {
    return NextResponse.json({ error: 'accessToken è obbligatorio' }, { status: 400 });
  }

  // Valida token prima di salvare
  try {
    const meRes = await metaFetch<any>('/me', accessToken, { fields: 'id,name' });

    // Ottieni info scadenza
    let expiresAt: string | null = null;
    let daysLeft: number | null = null;
    let neverExpires = false;
    try {
      const debugRes = await metaFetch<any>('/debug_token', accessToken, {
        input_token: accessToken,
        access_token: accessToken,
      });
      const exp = debugRes.data?.expires_at;
      if (exp === 0) {
        neverExpires = true;
      } else if (exp) {
        const d = new Date(exp * 1000);
        expiresAt = d.toISOString();
        daysLeft = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      }
    } catch {}

    // Salva in Firestore (token viene cifrato automaticamente da saveClientToken)
    await saveClientToken(clientId, 'meta', {
      accessToken,
      accountId: accountId || '',
      extra: {
        pageId: pageId || '',
        updatedAt: Date.now().toString(),
        updatedBy: user.uid,
      },
    });

    return NextResponse.json({
      success: true,
      userName: meRes.name,
      userId: meRes.id,
      expiresAt,
      daysLeft,
      neverExpires,
      message: 'Token salvato e verificato con successo!',
    });
  } catch (err: any) {
    return NextResponse.json({
      error: 'Token non valido o scaduto',
      details: err.message,
    }, { status: 400 });
  }
}
