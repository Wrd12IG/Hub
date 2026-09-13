import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAuth, unauthorizedResponse, forbiddenResponse,
  getAppUser, isStaffUser, saveClientToken, getClientToken,
} from '@/lib/api-auth';
import { getKlaviyoAccount, findConversionMetricId } from '@/lib/klaviyo-client';

/**
 * Klaviyo per cliente, con una private API key invece di un OAuth.
 *
 * Solo staff: la chiave dà accesso in lettura all'intero account Klaviyo del
 * cliente (profili inclusi), quindi non è qualcosa che l'utente con ruolo
 * "Cliente" debba poter leggere o riscrivere dal proprio pannello.
 */

async function requireStaff(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return { error: unauthorizedResponse() };
  const user = await getAppUser(auth.uid);
  if (!isStaffUser(user)) return { error: forbiddenResponse() };
  return { error: null };
}

/** Stato della connessione — non restituisce mai la chiave. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireStaff(request);
  if (error) return error;

  const token = await getClientToken(params.id, 'klaviyo');
  if (!token) return NextResponse.json({ connected: false });

  return NextResponse.json({
    connected: true,
    accountName: token.extra?.accountName,
    currency: token.extra?.currency,
    // Nullo quando l'account non ha una metrica "Placed Order": il report
    // funziona comunque, ma senza conversioni né fatturato.
    conversionMetricId: token.extra?.conversionMetricId ?? null,
    updatedAt: (token as { updatedAt?: number }).updatedAt ?? null,
  });
}

/**
 * Salva la chiave — dopo averla provata davvero contro Klaviyo. Una chiave
 * sbagliata o con scope insufficienti viene rifiutata qui, invece di essere
 * accettata e poi produrre una scheda vuota nel report giorni dopo.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireStaff(request);
  if (error) return error;

  const { apiKey } = await request.json().catch(() => ({ apiKey: '' }));
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    return NextResponse.json({ error: 'Chiave API mancante.' }, { status: 400 });
  }

  let account;
  let conversionMetricId: string | null = null;
  try {
    account = await getKlaviyoAccount(apiKey.trim());
    conversionMetricId = await findConversionMetricId(apiKey.trim());
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  await saveClientToken(params.id, 'klaviyo', {
    accessToken: apiKey.trim(),
    extra: {
      accountId: account.id,
      accountName: account.name,
      ...(account.currency ? { currency: account.currency } : {}),
      ...(conversionMetricId ? { conversionMetricId } : {}),
    },
  });

  return NextResponse.json({
    connected: true,
    accountName: account.name,
    currency: account.currency ?? null,
    conversionMetricId,
    warning: conversionMetricId
      ? null
      : 'Nessuna metrica "Placed Order" trovata: il report mostrerà aperture e click ma non conversioni né fatturato.',
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireStaff(request);
  if (error) return error;

  const { adminDb } = await import('@/lib/firebase-admin');
  await adminDb.collection('clients').doc(params.id).collection('integrations').doc('klaviyo').delete();
  return NextResponse.json({ connected: false });
}
