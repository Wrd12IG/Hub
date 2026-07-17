/**
 * GET /api/meta/ad-accounts
 * 
 * Lista tutti gli Ad Account Meta accessibili dal System User Token dell'agenzia.
 * Usa META_SYSTEM_USER_TOKEN (env var) — NON il token del singolo cliente.
 * 
 * Risposta: { accounts: [{ id, name, currency, account_status }] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';

export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  // Accetta sia META_SYSTEM_USER_TOKEN (ideale) sia META_ACCESS_TOKEN come fallback
  const systemToken = process.env.META_SYSTEM_USER_TOKEN || process.env.META_ACCESS_TOKEN;

  if (!systemToken) {
    return NextResponse.json(
      { error: 'Configura META_SYSTEM_USER_TOKEN (o META_ACCESS_TOKEN) nelle variabili d\'ambiente Vercel.' },
      { status: 503 }
    );
  }


  try {
    // Chiama /me/adaccounts con il System User Token dell'agenzia
    const url = new URL(`${META_GRAPH_BASE}/me/adaccounts`);
    url.searchParams.set('access_token', systemToken);
    url.searchParams.set('fields', 'id,name,currency,account_status,amount_spent');
    url.searchParams.set('limit', '100');

    const res = await fetch(url.toString(), {
      next: { revalidate: 300 }, // cache 5 minuti
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[meta/ad-accounts] API error:', err);
      return NextResponse.json(
        { error: 'Errore Meta API: ' + JSON.stringify(err?.error?.message || err) },
        { status: 502 }
      );
    }

    const data = await res.json();
    const accounts = (data.data || []).map((a: any) => ({
      id: a.id,        // include il prefisso act_
      name: a.name,
      currency: a.currency,
      account_status: a.account_status, // 1=ACTIVE, 2=DISABLED, ecc.
      amount_spent: a.amount_spent,
    }));

    return NextResponse.json({ accounts, _meta: { source: 'live', count: accounts.length } });
  } catch (error: any) {
    console.error('[meta/ad-accounts] Unexpected error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
