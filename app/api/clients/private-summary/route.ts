import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser, isStaffUser } from '@/lib/api-auth';
import { readAllInternalFields } from '@/lib/client-private';

export const dynamic = 'force-dynamic';

/** Budget e note interne di tutti i clienti, per la lista clienti dello staff (non stanno più nel documento cliente). */
export async function GET(request: Request) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  if (!isStaffUser(await getAppUser(auth.uid))) return forbiddenResponse();
  try {
    return NextResponse.json(await readAllInternalFields(adminDb));
  } catch (error) {
    console.error('Error reading client internal fields:', error);
    return NextResponse.json({ error: 'Failed to read client internal fields' }, { status: 500 });
  }
}
