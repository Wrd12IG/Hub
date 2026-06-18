/**
 * GET /api/tasks/attachment?url=<firebase-storage-url>&token=<firebase-id-token>
 *
 * Genera un signed URL temporaneo (15 min) per un allegato Firebase Storage.
 * Qualsiasi utente autenticato nell'app può accedere a qualsiasi allegato.
 *
 * Auth: accetta token come query param (?token=) per supportare apertura
 * diretta da <a href> nel browser (che non può aggiungere header Authorization).
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminStorage } from '@/lib/firebase-admin';

async function verifyToken(request: NextRequest): Promise<{ uid: string } | null> {
  // 1. Bearer header (chiamate fetch API)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      return { uid: decoded.uid };
    } catch { return null; }
  }
  // 2. Query param (browser <a href> direct navigation)
  const tokenParam = request.nextUrl.searchParams.get('token');
  if (tokenParam) {
    try {
      const decoded = await adminAuth.verifyIdToken(tokenParam);
      return { uid: decoded.uid };
    } catch { return null; }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const user = await verifyToken(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rawUrl = request.nextUrl.searchParams.get('url');
  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    // URL esterno (link manuali) — redirect diretto senza proxy
    if (!rawUrl.includes('firebasestorage.googleapis.com') && !rawUrl.startsWith('gs://')) {
      return NextResponse.redirect(rawUrl);
    }

    // Estrai il path Firebase Storage
    let storagePath: string;
    if (rawUrl.startsWith('gs://')) {
      storagePath = rawUrl.replace(/^gs:\/\/[^/]+\//, '');
    } else {
      const urlObj = new URL(rawUrl);
      const pathMatch = urlObj.pathname.match(/\/v0\/b\/[^/]+\/o\/(.+)/);
      if (!pathMatch) {
        return NextResponse.json({ error: 'Invalid Firebase Storage URL' }, { status: 400 });
      }
      storagePath = decodeURIComponent(pathMatch[1]);
    }

    const bucket = adminStorage.bucket();
    const file = bucket.file(storagePath);

    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Signed URL valido 15 minuti — accessibile dal browser senza auth Firebase
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000,
    });

    return NextResponse.redirect(signedUrl);
  } catch (error: any) {
    console.error('[api/tasks/attachment] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate attachment URL' },
      { status: 500 }
    );
  }
}
