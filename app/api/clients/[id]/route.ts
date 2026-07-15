import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import { saveClientToken } from '@/lib/api-auth';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAuth(request as import('next/server').NextRequest);
  if (!auth) return unauthorizedResponse();

  try {
    const id = params.id;
    const docRef = adminDb.collection('clients').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Leggi le integrazioni social in parallelo (solo presence, nessun token in chiaro)
    const integrationsRef = docRef.collection('integrations');
    const [youtubeSnap, tiktokSnap, linkedinSnap] = await Promise.all([
      integrationsRef.doc('youtube').get(),
      integrationsRef.doc('tiktok').get(),
      integrationsRef.doc('linkedin').get(),
    ]);

    const youtubeData = youtubeSnap.exists ? youtubeSnap.data() : null;
    const tiktokData  = tiktokSnap.exists  ? tiktokSnap.data()  : null;
    const linkedinData = linkedinSnap.exists ? linkedinSnap.data() : null;

    return NextResponse.json({
      id: doc.id,
      ...doc.data(),
      // Social organico — solo flag di presenza e nome visibile, mai token cifrati
      hasYoutubeToken:    !!youtubeData?.accessToken,
      youtubeChannelName: youtubeData?.extra?.channelName ?? null,
      hasTiktokToken:     !!tiktokData?.accessToken,
      tiktokDisplayName:  tiktokData?.extra?.displayName ?? null,
      hasLinkedinToken:   !!linkedinData?.accessToken,
      linkedinOrgName:    linkedinData?.extra?.organizationName ?? linkedinData?.extra?.orgName ?? null,
    });
  } catch (error) {
    console.error(`Error fetching client ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 });
  }
}


export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAuth(request as import('next/server').NextRequest);
  if (!auth) return unauthorizedResponse();

  try {
    const id = params.id;
    const body = await request.json();
    const docRef = adminDb.collection('clients').doc(id);
    
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const updateData = {
      ...body,
      updatedAt: new Date().toISOString()
    };

    // Remove id from update payload if it exists
    if (updateData.id) delete updateData.id;

    await docRef.update(updateData);

    return NextResponse.json({
      id,
      ...doc.data(),
      ...updateData
    });
  } catch (error) {
    console.error(`Error updating client ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAuth(request as import('next/server').NextRequest);
  if (!auth) return unauthorizedResponse();

  try {
    const id = params.id;
    const docRef = adminDb.collection('clients').doc(id);
    
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    await docRef.delete();

    return NextResponse.json({ success: true, message: 'Client deleted successfully' });
  } catch (error) {
    console.error(`Error deleting client ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
  }
}



export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();

  try {
    const id = params.id;
    const body = await request.json();
    const docRef = adminDb.collection('clients').doc(id);
    
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // 1. Gestione sicura dei token
    if (body.metaAccessToken) {
      await saveClientToken(id, 'meta', {
        accessToken: body.metaAccessToken,
        accountId: body.metaAdAccountId,
        extra: { pageId: body.metaPageId }
      });
      body.hasMetaToken = true;
      delete body.metaAccessToken; // Non salvare mai il token in chiaro nel documento client!
    }

    if (body.googleRefreshToken) {
      await saveClientToken(id, 'google', {
        accessToken: '', // Per Google spesso basta il refresh
        refreshToken: body.googleRefreshToken,
        accountId: body.googleAdAccountId,
        extra: { ga4PropertyId: body.ga4PropertyId }
      });
      delete body.googleRefreshToken;
    }

    if (body.gbpAccessToken || body.gbpRefreshToken) {
      await saveClientToken(id, 'gbp', {
        accessToken: body.gbpAccessToken || '',
        refreshToken: body.gbpRefreshToken || '',
        accountId: body.gbpAccountId,
      });
      delete body.gbpAccessToken;
      delete body.gbpRefreshToken;
    }

    // 2. Aggiornamento dei restanti campi pubblici
    const updateData = {
      ...body,
      updatedAt: new Date().toISOString()
    };

    if (updateData.id) delete updateData.id;

    await docRef.update(updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Error patching client ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to patch client' }, { status: 500 });
  }
}

