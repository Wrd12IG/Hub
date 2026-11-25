import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { legacyFromSites, sitesOf, validateSites } from '@/lib/client-sites';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/clients/[id]/sites  { sites: [{ id?, url, brand?, ga4PropertyId?, searchConsole? }, …] }
 *
 * Sostituisce l'elenco dei siti del cliente (aggiunge, modifica, toglie). Gli `id` già del cliente si conservano, i siti
 * nuovi li riceve qui. Il PRIMO sito si ricopia anche nei campi vecchi (`websiteUrl`, `ga4PropertyId`,
 * `windsorAccounts.searchconsole`), che servono al monitor del sito, all'audit SEO e a tutto ciò che lavora su un sito solo.
 * Solo staff.
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessStaff(user.uid);
  if (denied) return denied;

  const body = await request.json().catch(() => null);

  try {
    const ref = adminDb.collection('clients').doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 });

    const check = validateSites(body?.sites, sitesOf(snap.data() as Record<string, unknown>).map((s) => s.id));
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    const legacy = legacyFromSites(check.sites);
    await ref.update({
      sites: check.sites,
      websiteUrl: legacy.websiteUrl ?? FieldValue.delete(),
      ga4PropertyId: legacy.ga4PropertyId ?? FieldValue.delete(),
      'windsorAccounts.searchconsole': legacy.searchConsole ?? FieldValue.delete(),
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ sites: check.sites });
  } catch (error) {
    console.error(`[sites] salvataggio fallito per ${params.id}:`, error);
    return NextResponse.json({ error: 'Impossibile salvare i siti' }, { status: 500 });
  }
}
