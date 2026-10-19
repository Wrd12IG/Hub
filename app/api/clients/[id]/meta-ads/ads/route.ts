import { NextRequest } from 'next/server';
import { metaBreakdownResponse } from '@/lib/meta-breakdown-server';
import { byAd } from '@/lib/meta-breakdown';

export const maxDuration = 60;

/** GET /api/clients/[id]/meta-ads/ads — risultati per annuncio. Si legge solo quando l'utente apre la vista. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return metaBreakdownResponse(request, params.id, { dimensionFields: ['ad_id', 'ad_name', 'campaign'], build: byAd });
}
