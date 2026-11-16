import { NextRequest, NextResponse } from 'next/server';
import { denyUnlessCron } from '@/lib/cron-auth';
import { adminDb } from '@/lib/firebase-admin';
import { isKpiProfile } from '@/lib/kpi-profiles';
import { computeClientMonth } from '@/lib/kpi-monthly';
import { buildMonthlyMail } from '@/lib/monthly-mail-html';
import { bumpAttempt, claimSend, patchMailRun, readMailRun, readMailSettings, readSnapshots, resetMailRun } from '@/lib/monthly-mail-store';
import { sendMonthlyMail } from '@/lib/monthly-mail-send';
import { planRun, splitWork } from '@/lib/monthly-mail-run';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Un cliente costa 10-45 s di lettura: si lavora in due alla volta. */
const CONCURRENCY = 2;
/** Non si avvia un nuovo cliente oltre questo tempo (limite 300 s, un cliente può metterci fino a ~45 s). */
const START_BUDGET_MS = 220_000;

/**
 * GET /api/cron/monthly-kpi-mail — il giro automatico della mail mensile dei KPI, pensato per essere chiamato a intervalli
 * da un servizio esterno (cron-job.org) con l'header `x-cron-secret` (o `Authorization: Bearer`).
 *
 * Ogni chiamata fa UNA cosa, in questo ordine, e risponde con lo stato:
 *  - `wait`         non è ancora il giorno di invio (impostazioni) → non fa niente;
 *  - `already_sent` la mail del mese è già partita → non fa niente (è il motivo per cui si può chiamare spesso);
 *  - `computing`    ci sono clienti da (ri)calcolare: ne calcola qualcuno e dice quanti restano; la chiamata dopo riprende;
 *  - `sent`         tutti i KPI sono pronti: manda UNA mail a tutti i destinatari delle impostazioni e la registra.
 * Un cliente che fallisce 3 volte viene lasciato fuori dalla mail e segnato nel registro (`skipped`), per non bloccare tutto.
 *
 * Parametri (a mano): `dryRun=1` non calcola e non manda, dice solo cosa farebbe; `force=1` ignora il giorno di invio, ricalcola
 * da oggi e rimanda anche se già partita; `month=AAAA-MM` (solo con force) un mese diverso dall'ultimo chiuso.
 * Destinatari e giorno: impostazioni di «Mail mensile KPI» nel Hub. La mail non va mai ai clienti.
 */
export async function GET(request: NextRequest) {
  const denied = denyUnlessCron(request, 'cron/monthly-kpi-mail');
  if (denied) return denied;

  const started = Date.now();
  const q = request.nextUrl.searchParams;
  const force = q.get('force') === '1';
  const dryRun = q.get('dryRun') === '1';

  try {
    const settings = await readMailSettings();
    const plan = planRun({ now: new Date(), sendDay: settings.sendDay, force, month: q.get('month') });
    if (plan.action === 'wait') return NextResponse.json({ status: 'wait', reason: plan.reason });
    const { month, cutoff } = plan;

    const run = await readMailRun(month);
    if (run.sentAt && !force) return NextResponse.json({ status: 'already_sent', month, sentAt: run.sentAt });

    const snap = await adminDb.collection('clients').where('monthlyKpiMail', '==', true).select('name', 'kpiProfile').get();
    const clients = snap.docs.filter((d) => isKpiProfile(d.get('kpiProfile'))).map((d) => ({ id: d.id, name: String(d.get('name') ?? d.id) }));
    if (clients.length === 0) return NextResponse.json({ status: 'no_clients', month, hint: 'Nessun cliente con «Nella mail» acceso e un profilo KPI.' });
    const nameOf = new Map(clients.map((c) => [c.id, c.name]));

    // Con force i tentativi falliti si azzerano: si riparte pulito
    const attempts = force ? {} : run.attempts ?? {};
    const shots = await readSnapshots(month, clients.map((c) => c.id));
    const { todo, gaveUp } = splitWork(
      clients.map((c) => ({ id: c.id, computedAt: shots[c.id]?.computedAt, attempts: Number(attempts[c.id] ?? 0) })),
      cutoff,
    );

    if (dryRun) {
      return NextResponse.json({ status: 'dry_run', month, cutoff, clients: clients.length, toCompute: todo.length, gaveUp: gaveUp.length, recipients: settings.recipients, wouldSend: todo.length === 0 });
    }
    if (force) await resetMailRun(month);

    // ── 1. KPI da (ri)calcolare ──
    if (todo.length > 0) {
      let next = 0, ok = 0, failed = 0;
      const worker = async () => {
        while (Date.now() - started < START_BUDGET_MS) {
          const id = todo[next++];
          if (!id) return;
          try {
            const out = await computeClientMonth(id, month);
            if (out.ok) ok++; else { failed++; await bumpAttempt(month, id, `${nameOf.get(id)}: ${out.message}`); }
          } catch (e: any) {
            failed++;
            await bumpAttempt(month, id, `${nameOf.get(id)}: ${String(e?.message ?? e)}`);
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      // Se ne restano, la prossima chiamata riprende. Se sono finiti ma qualcuno è fallito si ricontrolla subito alla prossima.
      return NextResponse.json({ status: 'computing', month, computed: ok, failed, remaining: todo.length - ok, total: clients.length, ms: Date.now() - started });
    }

    // ── 2. Tutto pronto: una sola mail ──
    if (!(await claimSend(month, force))) return NextResponse.json({ status: 'busy', month, hint: 'Un\'altra chiamata sta già spedendo.' });

    const results = clients.map((c) => shots[c.id]?.result).filter((r): r is NonNullable<typeof r> => !!r);
    // Chi non ha numeri, o ha solo numeri vecchi perché il ricalcolo è fallito più volte, si segna: la mail parte lo stesso
    const skipped = Object.fromEntries(clients
      .filter((c) => !shots[c.id] || gaveUp.includes(c.id))
      .map((c) => [c.name, shots[c.id] ? 'ricalcolo fallito più volte: nella mail ci sono i numeri di un calcolo precedente' : 'calcolo fallito più volte: assente dalla mail']));
    if (results.length === 0) {
      await patchMailRun(month, { sendingSince: null, lastError: 'Nessun cliente calcolato: mail non inviata.' });
      return NextResponse.json({ status: 'error', error: 'Nessun cliente calcolato: mail non inviata.' }, { status: 500 });
    }

    const mail = buildMonthlyMail({ month, clients: results, baseUrl: request.nextUrl.origin });
    const sent = await sendMonthlyMail({ to: settings.recipients, subject: mail.subject, html: mail.html, text: mail.text });
    if (!sent.success) {
      await patchMailRun(month, { sendingSince: null, lastError: `Invio non riuscito: ${sent.error}` });
      console.error('[cron/monthly-kpi-mail] invio non riuscito:', sent.error);
      return NextResponse.json({ status: 'error', error: `Invio non riuscito: ${sent.error}` }, { status: 502 });
    }
    await patchMailRun(month, { sentAt: new Date().toISOString(), sentTo: settings.recipients, clients: results.length, skipped, sendingSince: null, lastError: null });
    console.log(`[cron/monthly-kpi-mail] ${month}: inviata a ${settings.recipients.length} destinatari, ${results.length} clienti, ${Object.keys(skipped).length} lasciati fuori`);
    return NextResponse.json({ status: 'sent', month, sentTo: settings.recipients, clients: results.length, skipped, from: sent.from, ms: Date.now() - started });
  } catch (e: any) {
    console.error('[cron/monthly-kpi-mail]', e?.message);
    return NextResponse.json({ status: 'error', error: 'Giro non riuscito' }, { status: 500 });
  }
}
