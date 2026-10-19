import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed } from '@/lib/api-auth';
import { readProgress } from '@/lib/report-service';

export const dynamic = 'force-dynamic';

/** GET /api/clients/[id]/reporting/progress?run=<id>: a che punto è il calcolo avviato con quell'id (null se non c'è). */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  const denied = await denyUnlessClientAllowed(auth.uid, params.id);
  if (denied) return denied;

  const run = (request.nextUrl.searchParams.get('run') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  if (!run) return NextResponse.json({ progress: null });
  return NextResponse.json({ progress: await readProgress(params.id, run) });
}
