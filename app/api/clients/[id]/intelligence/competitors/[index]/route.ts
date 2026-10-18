/**
 * DELETE /api/clients/[id]/intelligence/competitors/[index] → toglie il competitor in quella posizione (solo staff)
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { loadClient, competitorsOf, saveCompetitors } from '@/lib/intelligence-store';

export async function DELETE(request: NextRequest, { params }: { params: { id: string; index: string } }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessStaff(user.uid);
  if (denied) return denied;

  const index = Number(params.index);
  const { ref, exists, data } = await loadClient(params.id);
  if (!exists) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 });

  const list = competitorsOf(data);
  if (!Number.isInteger(index) || index < 0 || index >= list.length) {
    return NextResponse.json({ error: 'Competitor non trovato (l\'elenco è cambiato: ricarica la pagina)' }, { status: 404 });
  }

  const removed = list[index];
  await saveCompetitors(ref, list.filter((_, i) => i !== index), user.uid);
  return NextResponse.json({ success: true, removed: removed?.name ?? null });
}
