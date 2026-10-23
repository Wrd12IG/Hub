import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { isSafeRemoteUrl } from '@/lib/magnific/core';
import { MagnificError, consumeDaily, isConfigured, persistImage, removeBackground } from '@/lib/magnific/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/stories/magnific/remove-bg  { imageUrl }
 * Solo staff. Toglie lo sfondo a un'immagine con indirizzo pubblico https (non vale un file ancora solo nel browser) e
 * restituisce un PNG con trasparenza salvato nel nostro archivio. Consuma crediti Magnific (stesso tetto giornaliero).
 */
export async function POST(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessStaff(user.uid);
  if (denied) return denied;
  if (!isConfigured()) return NextResponse.json({ configured: false });

  const body = await request.json().catch(() => null);
  const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl : '';
  if (!isSafeRemoteUrl(imageUrl)) return NextResponse.json({ configured: true, error: 'L\'immagine deve avere un indirizzo pubblico: salva o carica prima il file.' }, { status: 400 });

  try {
    const quota = await consumeDaily(user.uid);
    const cut = await removeBackground(imageUrl);
    const url = await persistImage(cut, `nobg-${user.uid.slice(0, 8)}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`);
    return NextResponse.json({ configured: true, url, used: quota.used, limit: quota.limit });
  } catch (e) {
    if (e instanceof MagnificError) return NextResponse.json({ configured: true, error: e.message }, { status: e.status });
    console.error('[magnific remove-bg]', e);
    return NextResponse.json({ configured: true, error: 'Errore imprevisto.' }, { status: 500 });
  }
}
