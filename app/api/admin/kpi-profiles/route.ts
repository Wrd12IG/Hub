import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser } from '@/lib/api-auth';
import { isKpiProfile, validateKpiSelection } from '@/lib/kpi-profiles';
import { readKpiOverrides, writeKpiOverride } from '@/lib/kpi-profiles-store';

export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return { res: unauthorizedResponse() };
  const me = await getAppUser(auth.uid);
  if (me?.role !== 'Amministratore') return { res: forbiddenResponse() };
  return { res: null };
}

/** GET /api/admin/kpi-profiles → { overrides }: i KPI scelti per ogni profilo (assente = predefiniti). Solo amministratori. */
export async function GET(request: NextRequest) {
  const { res } = await requireAdmin(request);
  if (res) return res;
  try {
    return NextResponse.json({ overrides: await readKpiOverrides() });
  } catch (e: any) {
    console.error('[admin/kpi-profiles] GET:', e?.message);
    return NextResponse.json({ error: 'Impossibile leggere i profili' }, { status: 500 });
  }
}

/** PUT { profile, kpis } salva i KPI di un profilo; { profile, kpis: null } torna ai predefiniti. Solo amministratori. */
export async function PUT(request: NextRequest) {
  const { res } = await requireAdmin(request);
  if (res) return res;

  const body = await request.json().catch(() => null);
  if (!body || !isKpiProfile(body.profile)) return NextResponse.json({ error: 'Profilo non valido.' }, { status: 400 });
  if (body.kpis !== null) {
    const v = validateKpiSelection(body.kpis);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  }
  try {
    return NextResponse.json({ overrides: await writeKpiOverride(body.profile, body.kpis) });
  } catch (e: any) {
    console.error('[admin/kpi-profiles] PUT:', e?.message);
    return NextResponse.json({ error: 'Impossibile salvare' }, { status: 500 });
  }
}
