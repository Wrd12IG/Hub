import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser } from '@/lib/api-auth';
import { validateMailSettings } from '@/lib/monthly-mail-settings';
import { readMailSettings, writeMailSettings } from '@/lib/monthly-mail-store';

export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  if ((await getAppUser(auth.uid))?.role !== 'Amministratore') return forbiddenResponse();
  return null;
}

/** GET → { settings: { recipients, sendDay } }. Solo amministratori. */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ settings: await readMailSettings() });
  } catch (e: any) {
    console.error('[admin/monthly-kpi-mail-settings] GET:', e?.message);
    return NextResponse.json({ error: 'Impossibile leggere le impostazioni' }, { status: 500 });
  }
}

/** PUT { recipients: string[], sendDay: 1-28 } → salva. Solo amministratori. */
export async function PUT(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const v = validateMailSettings(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    return NextResponse.json({ settings: await writeMailSettings(body) });
  } catch (e: any) {
    console.error('[admin/monthly-kpi-mail-settings] PUT:', e?.message);
    return NextResponse.json({ error: 'Impossibile salvare' }, { status: 500 });
  }
}
