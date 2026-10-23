import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { buildMysticBody, checkPrompt, type Resolution } from '@/lib/magnific/core';
import { MagnificError, consumeDaily, createImageTask, isConfigured, persistImage, readImageTask } from '@/lib/magnific/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const fail = (e: unknown) => {
  if (e instanceof MagnificError) return NextResponse.json({ configured: true, error: e.message }, { status: e.status });
  console.error('[magnific generate]', e);
  return NextResponse.json({ configured: true, error: 'Errore imprevisto.' }, { status: 500 });
};

/**
 * POST /api/stories/magnific/generate  { prompt, resolution?: '1k' | '2k' }
 * Solo staff. Avvia la generazione di un'immagine 9:16 e restituisce il numero dell'operazione. Consuma crediti Magnific:
 * c'è un tetto giornaliero per utente (MAGNIFIC_DAILY_LIMIT).
 */
export async function POST(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessStaff(user.uid);
  if (denied) return denied;
  if (!isConfigured()) return NextResponse.json({ configured: false });

  const body = await request.json().catch(() => null);
  const check = checkPrompt(body?.prompt);
  if (!check.ok) return NextResponse.json({ configured: true, error: check.error }, { status: 400 });
  const resolution: Resolution = body?.resolution === '1k' ? '1k' : '2k';

  try {
    const quota = await consumeDaily(user.uid);
    const task = await createImageTask(buildMysticBody(check.prompt, resolution));
    return NextResponse.json({ configured: true, taskId: task.taskId, status: task.status, used: quota.used, limit: quota.limit });
  } catch (e) { return fail(e); }
}

/**
 * GET /api/stories/magnific/generate?taskId=…
 * Solo staff. Stato dell'operazione. Quando è completata salva le immagini nel nostro archivio (una volta sola: il nome
 * del file dipende dall'operazione) e restituisce i loro indirizzi.
 */
export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessStaff(user.uid);
  if (denied) return denied;
  if (!isConfigured()) return NextResponse.json({ configured: false });

  try {
    const task = await readImageTask(request.nextUrl.searchParams.get('taskId') || '');
    if (task.status === 'FAILED') return NextResponse.json({ configured: true, status: 'FAILED', error: 'Magnific non è riuscito a creare l\'immagine: prova con un\'altra descrizione.' });
    if (task.status !== 'COMPLETED') return NextResponse.json({ configured: true, status: task.status });
    const images = await Promise.all(task.generated.slice(0, 4).map((u, i) => persistImage(u, `${task.taskId}-${i + 1}`)));
    return NextResponse.json({ configured: true, status: 'COMPLETED', images });
  } catch (e) { return fail(e); }
}
