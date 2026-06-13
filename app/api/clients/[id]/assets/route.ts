/**
 * GET  /api/clients/[id]/assets   → Lista asset media del cliente
 * POST /api/clients/[id]/assets   → Upload metadata (file su Firebase Storage)
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import { adminDb, adminStorage } from '@/lib/firebase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id: clientId } = params;
  const type = request.nextUrl.searchParams.get('type'); // 'image' | 'video' | 'document' | null

  try {
    let query = adminDb
      .collection('clients')
      .doc(clientId)
      .collection('assets')
      .orderBy('uploadedAt', 'desc')
      .limit(50);

    const snap = await query.get();

    if (snap.empty) {
      // Return empty assets
      return NextResponse.json({
        assets: [],
        total: 0,
        _meta: { source: 'empty' },
      });
    }

    const assets = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ assets, total: assets.length, _meta: { source: 'firestore' } });
  } catch (error) {
    console.error(`[assets] GET error for client ${clientId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id: clientId } = params;

  try {
    const body = await request.json();
    const { name, type, url, size, tags = [] } = body as {
      name: string;
      type: string;
      url: string;
      size: number;
      tags?: string[];
    };

    if (!name || !url) {
      return NextResponse.json({ error: 'name and url are required' }, { status: 400 });
    }

    const assetRef = await adminDb
      .collection('clients')
      .doc(clientId)
      .collection('assets')
      .add({
        name, type, url, size,
        tags,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.uid,
      });

    return NextResponse.json({ id: assetRef.id, success: true }, { status: 201 });
  } catch (error) {
    console.error(`[assets] POST error for client ${clientId}:`, error);
    return NextResponse.json({ error: 'Failed to save asset' }, { status: 500 });
  }
}
