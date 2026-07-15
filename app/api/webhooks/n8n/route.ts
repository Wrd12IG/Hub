import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// Expected payload format from n8n:
// {
//   "clientId": "string",
//   "platform": "facebook" | "google_ads" | "tiktok" | "youtube" | "gbp" | "instagram_organic",
//   "datePreset": "last_30d" | "last_7d" | "this_month",
//   "data": [ ... array of daily stats or aggregated stats ... ]
// }

export async function POST(req: Request) {
  try {
    // 1. Verify Authorization Header (Secret Token)
    // In production, add N8N_WEBHOOK_SECRET to Vercel env variables
    const authHeader = req.headers.get('authorization');
    const expectedToken = process.env.N8N_WEBHOOK_SECRET;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse payload
    const body = await req.json();
    const { clientId, platform, datePreset, data } = body;

    if (!clientId || !platform || !datePreset || !data) {
      return NextResponse.json({ error: 'Missing required fields (clientId, platform, datePreset, data)' }, { status: 400 });
    }

    // 3. Save to Firestore
    // We store this under clients/{clientId}/performance/{platform}_{datePreset}
    // This allows the dashboard to easily fetch the pre-aggregated data.
    const docRef = adminDb.collection('clients').doc(clientId).collection('performance').doc(`${platform}_${datePreset}`);

    await docRef.set({
      platform,
      datePreset,
      data,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return NextResponse.json({ success: true, message: `Data for ${platform} (${datePreset}) saved to client ${clientId}` });
  } catch (error: any) {
    console.error('[n8n Webhook Error]', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
