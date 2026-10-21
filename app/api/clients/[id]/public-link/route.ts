import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser, isStaffUser } from '@/lib/api-auth';
import { createPublicLink, revokePublicLink } from '@/lib/client-public-link';

export const dynamic = 'force-dynamic';

async function staffOnly(request: Request) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  if (!isStaffUser(await getAppUser(auth.uid))) return forbiddenResponse();
  return null;
}

/** Genera (o rigenera) il link pubblico del cliente: il vecchio token smette di funzionare. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const denied = await staffOnly(request);
  if (denied) return denied;
  try {
    if (!(await adminDb.collection('clients').doc(params.id).get()).exists) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    return NextResponse.json(await createPublicLink(adminDb, params.id));
  } catch (error) {
    console.error(`Error creating public link for ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to create public link' }, { status: 500 });
  }
}

/** Revoca il link pubblico del cliente. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const denied = await staffOnly(request);
  if (denied) return denied;
  try {
    await revokePublicLink(adminDb, params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Error revoking public link for ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to revoke public link' }, { status: 500 });
  }
}
