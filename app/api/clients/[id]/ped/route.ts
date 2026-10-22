import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed } from '@/lib/api-auth';
import { isVisibleToClient, toClientPedItem, sortForClient } from '@/lib/client-ped';
import type { EditorialContent } from '@/lib/data';

export const dynamic = 'force-dynamic';

/**
 * GET /api/clients/[id]/ped
 * Il PED del cliente: solo i contenuti di QUEL cliente che gli sono stati mandati, con i soli campi consentiti
 * (lib/client-ped.ts). Lo staff può chiamarla (per vedere ciò che vede il cliente); un altro cliente no.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessClientAllowed(user.uid, params.id);
  if (denied) return denied;

  try {
    const snap = await adminDb.collection('editorialContents').where('clientId', '==', params.id).get();
    const items = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<EditorialContent, 'id'>) }) as EditorialContent)
      .filter(isVisibleToClient)
      .map(toClientPedItem);
    return NextResponse.json({ items: sortForClient(items) });
  } catch (error) {
    console.error('[ped GET]', error);
    return NextResponse.json({ error: 'Errore nel caricamento' }, { status: 500 });
  }
}
