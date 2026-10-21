import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { splitPrivateFields, savePrivateFields, readPrivateFields } from '@/lib/client-private';
import { hasLegacyPrivateFields, migrateClientDoc } from '@/lib/client-private-migrate';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser, isStaffUser, ownsClientResource, saveClientToken } from '@/lib/api-auth';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAuth(request as import('next/server').NextRequest);
  if (!auth) return unauthorizedResponse();

  // A client can view their own profile; anyone else needs to be staff. Before
  // this check, any authenticated user — any role, any client — could read any
  // other client's full record here.
  const user = await getAppUser(auth.uid);
  if (!isStaffUser(user) && !ownsClientResource(user, params.id)) return forbiddenResponse();

  try {
    const id = params.id;
    const docRef = adminDb.collection('clients').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Migrazione automatica dei dati interni (piano media, post-lead) nell'area solo-staff: al primo accesso a questo
    // cliente, chiunque sia a chiederlo, i vecchi campi del documento vengono copiati, verificati e tolti. Se fallisce,
    // niente di grave: la lettura ripiega sul vecchio campo e ci riprova la volta dopo (e il giro notturno).
    if (hasLegacyPrivateFields(doc.data() as Record<string, unknown>)) {
      await migrateClientDoc(doc as any, { apply: true, deleteLegacy: true })
        .catch((e) => console.error(`[clients/${id}] migrazione dati interni fallita:`, e?.message));
    }

    // Leggi le integrazioni social in parallelo (solo presence, nessun token in chiaro)
    const integrationsRef = docRef.collection('integrations');
    const [youtubeSnap, tiktokSnap, linkedinSnap, klaviyoSnap, youtubePublicSnap] = await Promise.all([
      integrationsRef.doc('youtube').get(),
      integrationsRef.doc('tiktok').get(),
      integrationsRef.doc('linkedin').get(),
      integrationsRef.doc('klaviyo').get(),
      integrationsRef.doc('youtube_public').get(),
    ]);

    const youtubeData = youtubeSnap.exists ? youtubeSnap.data() : null;
    const tiktokData  = tiktokSnap.exists  ? tiktokSnap.data()  : null;
    const linkedinData = linkedinSnap.exists ? linkedinSnap.data() : null;
    const klaviyoData = klaviyoSnap.exists ? klaviyoSnap.data() : null;
    const youtubePublicData = youtubePublicSnap.exists ? youtubePublicSnap.data() : null;

    // L'utente «Cliente» riceve solo ciò che serve a Overview e Audit: niente budget, piano media, note interne, token
    // pubblico, referenti o dati di lavoro. (Lo staff riceve il documento intero.)
    if (!isStaffUser(user)) {
      const d = doc.data() as any;
      return NextResponse.json({
        id: doc.id,
        name: d.name,
        websiteUrl: d.websiteUrl,
        industry: d.industry,
        ga4PropertyId: d.ga4PropertyId,
        metaAdAccountId: d.metaAdAccountId,
        googleAdAccountId: d.googleAdAccountId,
        windsorAccounts: d.windsorAccounts,
        lastSeoScore: d.lastSeoScore,
      });
    }

    // Piano media, post-lead, budget, note e token stanno in clients/{id}/private (solo staff): qui tornano nel documento.
    const privateFields = await readPrivateFields(adminDb, id, doc.data() as Record<string, unknown>);

    return NextResponse.json({
      id: doc.id,
      ...doc.data(),
      ...privateFields,
      // Social organico — solo flag di presenza e nome visibile, mai token cifrati
      hasYoutubeToken:    !!youtubeData?.accessToken,
      youtubeChannelName: youtubeData?.extra?.channelName ?? null,
      // Modalità "solo ID canale" (dati pubblici): nessun token, solo ID e nome visibile
      youtubePublicChannelId:   youtubePublicData?.channelId ?? null,
      youtubePublicChannelName: youtubePublicData?.channelName ?? null,
      hasTiktokToken:     !!tiktokData?.accessToken,
      tiktokDisplayName:  tiktokData?.extra?.displayName ?? null,
      hasLinkedinToken:   !!linkedinData?.accessToken,
      linkedinOrgName:    linkedinData?.extra?.organizationName ?? linkedinData?.extra?.orgName ?? null,
      hasKlaviyoToken:    !!klaviyoData?.accessToken,
      klaviyoAccountName: klaviyoData?.extra?.accountName ?? null,
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
  if (!isStaffUser(await getAppUser(auth.uid))) return forbiddenResponse();

  try {
    const id = params.id;
    const body = await request.json();
    const docRef = adminDb.collection('clients').doc(id);
    
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Il token del link pubblico si cambia solo da /api/clients/[id]/public-link (tiene allineato l'indice).
    delete body.publicToken; delete body.publicTokenCreatedAt;
    const { rest, privateFields } = splitPrivateFields(body);
    const updateData: Record<string, unknown> = {
      ...rest,
      updatedAt: new Date().toISOString()
    };

    // Remove id from update payload if it exists
    if (updateData.id) delete updateData.id;

    await savePrivateFields(adminDb, id, privateFields, updateData);

    return NextResponse.json({
      id,
      ...doc.data(),
      ...updateData,
      ...privateFields
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
  if (!isStaffUser(await getAppUser(auth.uid))) return forbiddenResponse();

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
  if (!isStaffUser(await getAppUser(auth.uid))) return forbiddenResponse();

  try {
    const id = params.id;
    const body = await request.json();
    const docRef = adminDb.collection('clients').doc(id);
    
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Il Property ID di GA4 è solo un numero: un'email (autocompilata dal browser) o «G-…» non arriverebbe mai a Google
    if (typeof body.ga4PropertyId === 'string' && body.ga4PropertyId.trim() !== '' && !/^\d{6,}$/.test(body.ga4PropertyId.trim())) {
      return NextResponse.json({ error: 'Il Property ID di GA4 deve essere un numero (es. 345678901), non un\'email né il codice G-…' }, { status: 400 });
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

    // 2. Aggiornamento dei restanti campi pubblici (il token del link pubblico passa solo da /public-link)
    delete body.publicToken; delete body.publicTokenCreatedAt;
    const { rest, privateFields } = splitPrivateFields(body);
    const updateData: Record<string, unknown> = {
      ...rest,
      updatedAt: new Date().toISOString()
    };

    if (updateData.id) delete updateData.id;

    // mediaPlan, postLead, budget e note vanno in clients/{id}/private, non nel documento leggibile dal Cliente.
    await savePrivateFields(adminDb, id, privateFields, updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Error patching client ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to patch client' }, { status: 500 });
  }
}

