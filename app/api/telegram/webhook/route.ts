import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { escapeHtml, sendMessage, telegramToken } from '@/lib/telegram';
import { linkIsValid, parseCommand, safeEqual, webhookSecret } from '@/lib/telegram-link';

export const dynamic = 'force-dynamic';

/**
 * POST /api/telegram/webhook — messaggi ricevuti dal bot. Pubblico (lo chiama Telegram), ma accetta solo richieste con il
 * segreto del webhook (intestazione X-Telegram-Bot-Api-Secret-Token). Risponde sempre 200 dopo la verifica: Telegram
 * ritenta all'infinito ciò che non riceve 2xx.
 */
export async function POST(request: NextRequest) {
  const token = telegramToken();
  if (!token || !safeEqual(request.headers.get('x-telegram-bot-api-secret-token'), webhookSecret(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const update = await request.json();
    const msg = update?.message;
    const chatId = msg?.chat?.id;
    // Solo conversazioni private con il bot: mai gruppi o canali
    if (chatId === undefined || msg?.chat?.type !== 'private') return NextResponse.json({ ok: true });
    const cmd = parseCommand(msg.text);

    if (cmd.kind === 'start' && cmd.code) {
      const snap = await adminDb.collection('users').where('telegramLink.code', '==', cmd.code).limit(1).get();
      const doc = snap.docs[0];
      const cfgRef = adminDb.collection('config').doc('telegram');
      const cfg = (await cfgRef.get()).data();
      if (!doc && linkIsValid(cfg?.companyLink, cmd.code, Date.now())) {
        // Il codice è quello del «telefono aziendale»: la chat diventa il destinatario degli avvisi comuni
        await cfgRef.update({ companyChatId: String(chatId), companyLinkedAt: new Date().toISOString(), companyLink: FieldValue.delete() });
        await sendMessage(chatId, '✅ <b>Telefono aziendale collegato.</b> Qui arriveranno gli avvisi del Hub, per esempio le storie con sticker da completare a mano. Per scollegare scrivi /scollega.');
      } else if (!doc || !linkIsValid(doc.data().telegramLink, cmd.code, Date.now())) {
        await sendMessage(chatId, 'Questo link è scaduto o non valido. Torna nel Hub e premi di nuovo <b>Collega Telegram</b>.');
      } else {
        await doc.ref.update({ telegramChatId: String(chatId), telegramLinkedAt: new Date().toISOString(), telegramLink: FieldValue.delete() });
        await sendMessage(chatId, `✅ Collegato, <b>${escapeHtml(String(doc.data().name || 'ok'))}</b>. Da ora gli avvisi del Hub arrivano qui. Per scollegare scrivi /scollega.`);
      }
    } else if (cmd.kind === 'start') {
      await sendMessage(chatId, 'Ciao! Per collegare questa chat al Hub apri hub.wrdigital.it e premi <b>Collega Telegram</b> nell\'intestazione.');
    } else if (cmd.kind === 'stop') {
      const snap = await adminDb.collection('users').where('telegramChatId', '==', String(chatId)).get();
      await Promise.all(snap.docs.map((d) => d.ref.update({ telegramChatId: FieldValue.delete() })));
      const cfgRef = adminDb.collection('config').doc('telegram');
      const wasCompany = (await cfgRef.get()).data()?.companyChatId === String(chatId);
      if (wasCompany) await cfgRef.update({ companyChatId: FieldValue.delete() });
      await sendMessage(chatId, snap.empty && !wasCompany ? 'Questa chat non era collegata al Hub.' : 'Scollegato. Non riceverai più avvisi qui.');
    }
  } catch (e) {
    console.error('[telegram webhook]', (e as Error)?.message);
  }
  return NextResponse.json({ ok: true });
}
