/**
 * GET /api/tasks/attachment?url=<firebase-storage-url>&token=<firebase-id-token>
 *
 * Proxy per allegati Firebase Storage.
 * Verifica che l'utente sia autenticato, poi fa redirect all'URL originale.
 *
 * Firebase Storage getDownloadURL() restituisce già un URL con download token
 * incorporato (?alt=media&token=...) che è accessibile pubblicamente.
 * Questo proxy aggiunge solo il gate di autenticazione Firebase.
 *
 * Auth: accetta token come query param (?token=) per supportare apertura
 * diretta da <a href> nel browser (che non può aggiungere header Authorization).
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

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
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;">
        <h2>⚠️ Accesso negato</h2>
        <p>Devi essere autenticato per visualizzare questo allegato.</p>
        <p><a href="/login">Vai al login</a></p>
      </body></html>`,
      { status: 401, headers: { 'Content-Type': 'text/html' } }
    );
  }

  const rawUrl = request.nextUrl.searchParams.get('url');
  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Redirect diretto all'URL originale.
  // - Per Firebase Storage: l'URL di getDownloadURL() contiene già un download token
  //   (?alt=media&token=...) che lo rende accessibile pubblicamente a chiunque abbia il link.
  // - Per link esterni (Google Drive, Figma, ecc.): redirect diretto.
  // In entrambi i casi il gate di autenticazione sopra garantisce che solo
  // utenti dell'app possano ottenere il link.
  return NextResponse.redirect(rawUrl);
}
