import { NextRequest, NextResponse } from 'next/server';
import { denyUnlessCron } from '@/lib/cron-auth';
import { adminDb } from '@/lib/firebase-admin';
import { executeAction } from '@/lib/windsor-client';
import {
  isDue, dueState, requestedChannels, planChannel, extractPostRef, allAutomatedPublished,
  MAX_ATTEMPTS, STALE_PUBLISHING_MS, UNSUPPORTED_CHANNELS,
} from '@/lib/publisher';
import type { ChannelPublishState, EditorialContent, PublishChannel } from '@/lib/data';

// Come le altre cron: legge gli header a ogni richiesta, quindi mai prerenderizzata.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Si smette di avviare nuovi contenuti con questo margine sul limite: quelli rimasti li prende la corsa successiva. */
const BUDGET_MS = 230_000;

/** Firestore rifiuta gli `undefined` (il progetto non ha ignoreUndefinedProperties): sempre il giro JSON in scrittura. */
const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

type Outcome = { contentId: string; topic?: string; clientId?: string; publicationDate?: string; channel: PublishChannel; result: string };

/**
 * Pubblica i contenuti "Approvato" la cui data è arrivata, canale per canale, tramite le azioni di scrittura di Windsor.
 *
 * ⚠️ Pubblica DAVVERO sui profili dei clienti, quindi è spenta finché non si imposta EDITORIAL_AUTOPUBLISH=1 su Vercel.
 * `?dryRun=1` mostra cosa uscirebbe senza scrivere né chiamare nulla (funziona anche a cron spenta).
 *
 * Regole contro il doppio post:
 *  - il canale viene "preso" (stato publishing) in transazione PRIMA della chiamata: due corse sovrapposte non
 *    pubblicano lo stesso canale due volte;
 *  - un canale rimasto "publishing" oltre 15 minuti ha perso la risposta: diventa failed e NON si riprova da soli,
 *    perché il post potrebbe essere già online;
 *  - un errore chiaro si riprova al massimo MAX_ATTEMPTS volte; un GBP multi-sede ricorda le sedi già servite.
 */
export async function GET(request: NextRequest) {
  const denied = denyUnlessCron(request, 'cron/publish-scheduled');
  if (denied) return denied;

  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1';
  if (!dryRun && process.env.EDITORIAL_AUTOPUBLISH !== '1') {
    return NextResponse.json({ ok: true, disabled: true, hint: 'Imposta EDITORIAL_AUTOPUBLISH=1 per attivare la pubblicazione.' });
  }

  const started = Date.now();
  const now = new Date();
  const outcomes: Outcome[] = [];

  try {
    const snap = await adminDb.collection('editorialContents').where('status', '==', 'Approvato').get();
    const approved = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EditorialContent, 'id'>) }) as EditorialContent);
    // Arretrato: approvati con data scaduta da troppo. Si elencano (così si vedono) ma non si pubblicano.
    const skippedLate = approved.filter((c) => dueState(c, now) === 'too-late').map((c) => ({ contentId: c.id, topic: c.topic, clientId: c.clientId, publicationDate: c.publicationDate }));
    const due = approved
      .filter((c) => isDue(c, now))
      .sort((a, b) => String(a.publicationDate).localeCompare(String(b.publicationDate)));

    const clientCache = new Map<string, Record<string, any> | null>();
    const getClient = async (clientId: string) => {
      if (!clientCache.has(clientId)) {
        const cs = await adminDb.collection('clients').doc(clientId).get();
        clientCache.set(clientId, cs.exists ? (cs.data() as Record<string, any>) : null);
      }
      return clientCache.get(clientId)!;
    };

    for (const content of due) {
      if (Date.now() - started > BUDGET_MS) break;
      const ref = adminDb.collection('editorialContents').doc(content.id);
      const client = await getClient(content.clientId);
      const channels = requestedChannels(content);

      for (const channel of channels) {
        const prev = content.publishResults?.[channel];
        if (prev?.status === 'published') continue;

        if (UNSUPPORTED_CHANNELS.includes(channel)) {
          if (prev?.status !== 'unsupported') {
            outcomes.push({ contentId: content.id, topic: content.topic, clientId: content.clientId, publicationDate: content.publicationDate, channel, result: 'non automatizzato' });
            if (!dryRun) await ref.update({ [`publishResults.${channel}`]: clean<ChannelPublishState>({ status: 'unsupported', error: 'Da pubblicare a mano: canale non ancora automatizzato' }) });
          }
          continue;
        }

        if (prev?.status === 'publishing') {
          const age = now.getTime() - new Date(prev.lastAttemptAt || 0).getTime();
          if (age > STALE_PUBLISHING_MS && !dryRun) {
            await ref.update({ [`publishResults.${channel}`]: clean<ChannelPublishState>({ ...prev, status: 'failed', attempts: MAX_ATTEMPTS, error: 'Risposta persa durante la pubblicazione: controlla sul profilo se il post è uscito, poi correggi a mano' }) });
            outcomes.push({ contentId: content.id, topic: content.topic, clientId: content.clientId, publicationDate: content.publicationDate, channel, result: 'bloccato: risposta persa' });
          }
          continue;
        }
        if (prev?.status === 'failed' && (prev.attempts || 0) >= MAX_ATTEMPTS) continue;

        if (!client) {
          outcomes.push({ contentId: content.id, topic: content.topic, clientId: content.clientId, publicationDate: content.publicationDate, channel, result: 'cliente non trovato' });
          continue;
        }
        const plan = planChannel(content, channel, client);
        if ('error' in plan) {
          outcomes.push({ contentId: content.id, topic: content.topic, clientId: content.clientId, publicationDate: content.publicationDate, channel, result: `errore: ${plan.error}` });
          // Un errore di configurazione non migliora ritentando: si segna una volta e si lascia al tentativo manuale.
          if (!dryRun && prev?.error !== plan.error) {
            await ref.update({ [`publishResults.${channel}`]: clean<ChannelPublishState>({ status: 'failed', error: plan.error, attempts: MAX_ATTEMPTS, lastAttemptAt: now.toISOString() }) });
          }
          continue;
        }
        if (dryRun) {
          outcomes.push({ contentId: content.id, topic: content.topic, clientId: content.clientId, publicationDate: content.publicationDate, channel, result: `uscirebbe: ${plan.actions.map((a) => `${a.connector}/${a.action}→${a.accountId}`).join(', ')}` });
          continue;
        }

        // Presa del canale in transazione: se un'altra corsa l'ha già presa, si salta.
        const claimed = await adminDb.runTransaction(async (tx) => {
          const fresh = (await tx.get(ref)).data() as EditorialContent | undefined;
          const cur = fresh?.publishResults?.[channel];
          if (!fresh || fresh.status !== 'Approvato' || cur?.status === 'published' || cur?.status === 'publishing') return null;
          const next: ChannelPublishState = clean({ ...cur, status: 'publishing', attempts: (cur?.attempts || 0) + 1, lastAttemptAt: now.toISOString(), error: undefined });
          tx.update(ref, { [`publishResults.${channel}`]: next });
          return next;
        });
        if (!claimed) continue;

        const done = new Set(claimed.doneAccounts || []);
        let postId = claimed.postId;
        let postUrl = claimed.postUrl;
        let failure: string | null = null;
        for (const action of plan.actions) {
          if (done.has(action.accountId)) continue;
          try {
            const res = await executeAction(action.connector, action.action, action.accountId, action.params);
            const refs = extractPostRef(res);
            postId = postId || refs.postId;
            postUrl = postUrl || refs.postUrl;
            done.add(action.accountId);
          } catch (err: any) {
            failure = err?.message || 'Errore sconosciuto';
            break;
          }
        }

        const finalState: ChannelPublishState = failure
          ? { ...claimed, status: 'failed', error: failure, doneAccounts: Array.from(done) }
          : { ...claimed, status: 'published', error: undefined, postId, postUrl, doneAccounts: Array.from(done), publishedAt: new Date().toISOString() };
        const updated = clean(finalState);
        await ref.update({ [`publishResults.${channel}`]: updated });
        content.publishResults = { ...content.publishResults, [channel]: updated };
        outcomes.push({ contentId: content.id, topic: content.topic, clientId: content.clientId, publicationDate: content.publicationDate, channel, result: failure ? `fallito: ${failure}` : 'pubblicato' });
      }

      if (!dryRun && allAutomatedPublished(content, channels)) {
        await ref.update({ status: 'Pubblicato', updatedAt: new Date() });
      }
    }

    return NextResponse.json({ ok: true, dryRun, due: due.length, skippedTooLate: skippedLate, outcomes, elapsedMs: Date.now() - started });
  } catch (error: any) {
    console.error('[cron/publish-scheduled]', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Errore', outcomes }, { status: 500 });
  }
}
