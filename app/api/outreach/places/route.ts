/**
 * GET /api/outreach/places                  → le regioni d'Italia
 * GET /api/outreach/places?region=Lombardia → province e comuni di quella regione, già nel formato «Comune, SIGLA»
 *
 * Per scegliere dove cercare aziende con Discover. Solo amministratori. Dati ISTAT: vedi lib/italy-places.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { forbiddenResponse, getAppUser, unauthorizedResponse, verifyAuth } from '@/lib/api-auth';
import { isAdminUser } from '@/lib/roles';
import { REGIONS, placeLabel, regionData } from '@/lib/italy-places';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const user = await verifyAuth(request);
    if (!user) return unauthorizedResponse();
    if (!isAdminUser(await getAppUser(user.uid))) return forbiddenResponse();

    const name = request.nextUrl.searchParams.get('region');
    if (!name) return NextResponse.json({ regions: REGIONS });

    const region = regionData(name);
    if (!region) return NextResponse.json({ error: 'Regione sconosciuta' }, { status: 404 });
    return NextResponse.json({
        region: region.nome,
        provinces: region.province.map((p) => ({
            nome: p.nome,
            sigla: p.sigla,
            capoluogo: p.capoluogo,
            comuni: p.comuni.map((c) => ({ nome: c, label: placeLabel(c, p.sigla) })),
        })),
    });
}
