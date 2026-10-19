import { NextRequest, NextResponse } from 'next/server';
import { metaBreakdownResponse } from '@/lib/meta-breakdown-server';
import { byAgeGender, byRegion } from '@/lib/meta-breakdown';

export const maxDuration = 60;

// Con età, genere e regione Windsor risponde 400 se si chiede `actions_omni_purchase` (campi «omni» incompatibili con le scomposizioni, verificato).
// Gli acquisti si leggono dagli altri due campi.
const OMIT = ['actions_omni_purchase'];

/**
 * GET /api/clients/[id]/meta-ads/audience?view=age|region — risultati per fascia d'età e genere, oppure per regione.
 * Due scomposizioni diverse non si possono chiedere insieme (Windsor le incrocia), quindi una lettura per vista.
 * Il dettaglio per città non esiste: Windsor restituisce `city` sempre vuoto (verificato su City Motors).
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const view = request.nextUrl.searchParams.get('view');
  if (view === 'region') return metaBreakdownResponse(request, params.id, { dimensionFields: ['region'], omitFields: OMIT, build: byRegion });
  if (view === 'age') return metaBreakdownResponse(request, params.id, { dimensionFields: ['age', 'gender'], omitFields: OMIT, build: byAgeGender });
  return NextResponse.json({ rows: [], error: 'Vista non valida: usa view=age oppure view=region.' }, { status: 400 });
}
