import { NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser, isStaffUser, ownsClientResource } from '@/lib/api-auth';
import type { CompareMode } from '@/lib/reporting';
import { getReport } from '@/lib/report-service';
import { validateRange } from '@/lib/date-range';

// Il report interroga più piattaforme insieme e alcune sono lente (Windsor impiega 8-12 s a lettura, misurato). Senza
// un tetto esplicito Vercel usa il default e uccide la richiesta a metà: il client non riceve una risposta parziale,
// non ne riceve nessuna. Il limite per singola piattaforma sta in lib/reporting.ts; questo è il tetto complessivo.
export const maxDuration = 60;

/**
 * GET /api/clients/[id]/reporting?date_preset=&days=&compare=[&refresh=1][&run=<id>]
 *
 * Il calcolo e la cache stanno in lib/report-service.ts (li usa anche il giro notturno). `run` è un identificativo scelto
 * dalla pagina: durante il calcolo l'avanzamento si scrive sotto quell'id e si legge da /reporting/progress.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request as import('next/server').NextRequest);
  if (!auth) return unauthorizedResponse();

  const clientId = params.id;

  // Staff: qualunque cliente. Un utente «Cliente»: solo il proprio: il report espone spesa e risultati reali.
  const user = await getAppUser(auth.uid);
  if (!isStaffUser(user) && !ownsClientResource(user, clientId)) return forbiddenResponse();

  try {
    const { searchParams } = new URL(request.url);

    // Intervallo scelto a mano: ?from=yyyy-MM-dd&to=yyyy-MM-dd (validato qui: mai date inventate fino alle piattaforme)
    const hasRange = searchParams.has('from') || searchParams.has('to');
    const check = hasRange ? validateRange(searchParams.get('from'), searchParams.get('to')) : null;
    if (check && !check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    const report = await getReport({
      range: check?.ok ? check.range : undefined,
      clientId,
      datePreset: searchParams.get('date_preset') || 'last_30d',
      daysRaw: searchParams.get('days') || '',
      compare: (searchParams.get('compare') || 'none') as CompareMode,
      refresh: searchParams.get('refresh') === '1',
      runId: (searchParams.get('run') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || undefined,
    });
    if (!report) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    return NextResponse.json(report);
  } catch (error: any) {
    console.error(`[reporting] Error building report for client ${clientId}:`, error);
    return NextResponse.json({ error: 'Failed to build marketing report' }, { status: 500 });
  }
}
