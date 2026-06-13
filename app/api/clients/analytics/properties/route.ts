/**
 * GET  /api/clients/analytics/properties
 * Lista GA4 properties disponibili per la selezione nel client settings
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const clientId = request.nextUrl.searchParams.get('clientId');

  // TODO: Replace with real Google Analytics Admin API call
  // GET https://analyticsadmin.googleapis.com/v1beta/properties?filter=...
  const mockProperties: any[] = [];

  return NextResponse.json({
    properties: mockProperties,
    _meta: { source: 'empty', uid: user.uid },
  });
}
