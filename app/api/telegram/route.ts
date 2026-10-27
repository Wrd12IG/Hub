import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff, forbiddenResponse, getAppUser } from '@/lib/api-auth';
import { getMe, getWebhookInfo, isTelegramConfigured, sendMessage, setWebhook, telegramToken } from '@/lib/telegram';
import { APP_PUBLIC_URL, LINK_TTL_MS, deepLink, newLinkCode, webhookSecret } from '@/lib/telegram-link';

export const dynamic = 'force-dynamic';

const webhookUrl = () => `${APP_PUBLIC_URL}/api/telegram/webhook`;

/** GET /api/telegram — stato del collegamento di chi chiede (solo staff). */
export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessStaff(user.uid);
  if (denied) return denied;

  const me = await getAppUser(user.uid);
  const linked = !!(me as any)?.telegramChatId;
  const isAdmin = me?.role === 'Amministratore';
  const companyLinked = isAdmin ? !!(await adminDb.collection('config').doc('telegram').get()).data()?.companyChatId : undefined;
  if (!isTelegramConfigured()) return NextResponse.json({ configured: false, linked, isAdmin, companyLinked });

  let botUsername: string | null = null;
  let webhookReady: boolean | null = null;
  try {
    botUsername = (await getMe()).username;
    if (isAdmin) webhookReady = (await getWebhookInfo()).url === webhookUrl();
  } catch (e) {
    return NextResponse.json({ configured: true, linked, isAdmin, companyLinked, error: (e as Error).message });
  }
  return NextResponse.json({ configured: true, linked, isAdmin, companyLinked, botUsername, webhookReady });
}

/** POST /api/telegram { action: 'link' | 'test' | 'unlink' | 'setup' | 'link_company' | 'test_company' | 'unlink_company' } — le ultime tre e 'setup' solo per gli amministratori */
export async function POST(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessStaff(user.uid);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (!isTelegramConfigured()) return NextResponse.json({ error: 'Telegram non è ancora attivo: manca TELEGRAM_BOT_TOKEN su Vercel.' }, { status: 503 });

  const userRef = adminDb.collection('users').doc(user.uid);
  try {
    if (action === 'setup') {
      const me = await getAppUser(user.uid);
      if (me?.role !== 'Amministratore') return forbiddenResponse();
      await setWebhook(webhookUrl(), webhookSecret(telegramToken()!));
      return NextResponse.json({ ok: true, botUsername: (await getMe()).username });
    }
    if (action === 'link_company' || action === 'test_company' || action === 'unlink_company') {
      const me = await getAppUser(user.uid);
      if (me?.role !== 'Amministratore') return forbiddenResponse();
      const cfgRef = adminDb.collection('config').doc('telegram');
      if (action === 'link_company') {
        const code = newLinkCode();
        await cfgRef.set({ companyLink: { code, expiresAt: Date.now() + LINK_TTL_MS } }, { merge: true });
        return NextResponse.json({ url: deepLink((await getMe()).username, code), expiresInMinutes: Math.round(LINK_TTL_MS / 60000) });
      }
      if (action === 'unlink_company') {
        await cfgRef.set({ companyChatId: FieldValue.delete(), companyLink: FieldValue.delete() }, { merge: true });
        return NextResponse.json({ ok: true });
      }
      const companyChat = (await cfgRef.get()).data()?.companyChatId;
      if (!companyChat) return NextResponse.json({ error: 'Il telefono aziendale non è collegato.' }, { status: 409 });
      await sendMessage(companyChat, '✅ <b>Prova riuscita sul telefono aziendale.</b> Gli avvisi comuni del Hub arriveranno qui.');
      return NextResponse.json({ ok: true });
    }
    if (action === 'link') {
      const code = newLinkCode();
      await userRef.update({ telegramLink: { code, expiresAt: Date.now() + LINK_TTL_MS } });
      return NextResponse.json({ url: deepLink((await getMe()).username, code), expiresInMinutes: Math.round(LINK_TTL_MS / 60000) });
    }
    if (action === 'unlink') {
      await userRef.update({ telegramChatId: FieldValue.delete(), telegramLink: FieldValue.delete() });
      return NextResponse.json({ ok: true });
    }
    if (action === 'test') {
      const chatId = (await userRef.get()).data()?.telegramChatId;
      if (!chatId) return NextResponse.json({ error: 'Telegram non è collegato: premi prima «Collega Telegram».' }, { status: 409 });
      await sendMessage(chatId, '✅ <b>Prova riuscita.</b> Gli avvisi del Hub arriveranno qui.');
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 });
  } catch (e) {
    console.error('[telegram]', (e as Error)?.message);
    return NextResponse.json({ error: (e as Error)?.message || 'Errore Telegram' }, { status: 502 });
  }
}
