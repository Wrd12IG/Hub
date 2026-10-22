/**
 * lib/publish-runner.ts
 *
 * Pubblica un elenco di contenuti, canale per canale, tramite le azioni di scrittura di Windsor. Usato dalla cron
 * (contenuti con data scaduta) e da "Pubblica ora" (un contenuto scelto da una persona).
 *
 * ⚠️ Pubblica DAVVERO sui profili dei clienti. Regole contro il doppio post:
 *  - il canale viene "preso" (stato publishing) in transazione PRIMA della chiamata: due corse sovrapposte non
 *    pubblicano lo stesso canale due volte;
 *  - un canale rimasto "publishing" oltre 15 minuti ha perso la risposta: diventa failed e NON si riprova da soli,
 *    perché il post potrebbe essere già online;
 *  - un errore chiaro si riprova al massimo MAX_ATTEMPTS volte (la cron), o a richiesta (resetFailed);
 *    un GBP multi-sede ricorda le sedi già servite.
 */
import { adminDb } from '@/lib/firebase-admin';
import { executeAction } from '@/lib/windsor-client';
import {
  requestedChannels, planChannel, extractPostRef, allAutomatedPublished,
  MAX_ATTEMPTS, STALE_PUBLISHING_MS, UNSUPPORTED_CHANNELS,
} from '@/lib/publisher';
import type { ChannelPublishState, EditorialContent, PublishChannel } from '@/lib/data';

/** Si smette di avviare nuovi contenuti con questo margine sul limite della funzione. */
export const BUDGET_MS = 230_000;

/** Firestore rifiuta gli `undefined` (il progetto non ha ignoreUndefinedProperties): sempre il giro JSON in scrittura. */
const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export type Outcome = { contentId: string; topic?: string; clientId?: string; clientName?: string; publicationDate?: string; channel: PublishChannel; result: string };

export interface RunOptions {
  dryRun: boolean;
  /** Un canale fallito riparte dal primo tentativo (azione manuale di una persona). */
  resetFailed?: boolean;
}

export async function runPublish(due: EditorialContent[], opts: RunOptions, started: number): Promise<Outcome[]> {
  const { dryRun } = opts;
  const now = new Date();
  const outcomes: Outcome[] = [];
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
          outcomes.push({ contentId: content.id, topic: content.topic, clientId: content.clientId, clientName: client?.name, publicationDate: content.publicationDate, channel, result: 'non automatizzato' });
          if (!dryRun) await ref.update({ [`publishResults.${channel}`]: clean<ChannelPublishState>({ status: 'unsupported', error: 'Da pubblicare a mano: canale non ancora automatizzato' }) });
        }
        continue;
      }

      if (prev?.status === 'publishing') {
        const age = now.getTime() - new Date(prev.lastAttemptAt || 0).getTime();
        if (age > STALE_PUBLISHING_MS && !dryRun) {
          await ref.update({ [`publishResults.${channel}`]: clean<ChannelPublishState>({ ...prev, status: 'failed', attempts: MAX_ATTEMPTS, error: 'Risposta persa durante la pubblicazione: controlla sul profilo se il post è uscito, poi correggi a mano' }) });
          outcomes.push({ contentId: content.id, topic: content.topic, clientId: content.clientId, clientName: client?.name, publicationDate: content.publicationDate, channel, result: 'bloccato: risposta persa' });
        }
        continue;
      }
      // Tentativo manuale (Pubblica ora): un canale fallito riparte da zero, ma mai uno rimasto "in pubblicazione".
      const retryable = opts.resetFailed && prev?.status === 'failed';
      if (prev?.status === 'failed' && (prev.attempts || 0) >= MAX_ATTEMPTS && !retryable) continue;

      if (!client) {
        outcomes.push({ contentId: content.id, topic: content.topic, clientId: content.clientId, publicationDate: content.publicationDate, channel, result: 'cliente non trovato' });
        continue;
      }
      const plan = planChannel(content, channel, client);
      if ('error' in plan) {
        outcomes.push({ contentId: content.id, topic: content.topic, clientId: content.clientId, clientName: client?.name, publicationDate: content.publicationDate, channel, result: `errore: ${plan.error}` });
        // Un errore di configurazione non migliora ritentando: si segna una volta e si lascia al tentativo manuale.
        if (!dryRun && prev?.error !== plan.error) {
          await ref.update({ [`publishResults.${channel}`]: clean<ChannelPublishState>({ status: 'failed', error: plan.error, attempts: MAX_ATTEMPTS, lastAttemptAt: now.toISOString() }) });
        }
        continue;
      }
      if (dryRun) {
        outcomes.push({ contentId: content.id, topic: content.topic, clientId: content.clientId, clientName: client?.name, publicationDate: content.publicationDate, channel, result: `uscirebbe su ${client?.name}: ${plan.actions.map((a) => `${a.connector}/${a.action}→${a.accountId}`).join(', ')}` });
        continue;
      }

      // Presa del canale in transazione: se un'altra corsa l'ha già presa, si salta.
      const claimed = await adminDb.runTransaction(async (tx) => {
        const fresh = (await tx.get(ref)).data() as EditorialContent | undefined;
        const cur = fresh?.publishResults?.[channel];
        if (!fresh || fresh.status !== 'Approvato' || cur?.status === 'published' || cur?.status === 'publishing') return null;
        const next: ChannelPublishState = clean({ ...cur, status: 'publishing', attempts: (retryable ? 0 : (cur?.attempts || 0)) + 1, lastAttemptAt: now.toISOString(), error: undefined });
        tx.update(ref, { [`publishResults.${channel}`]: next });
        return next;
      });
      if (!claimed) continue;

      const done = new Set(claimed.doneAccounts || []);
      let postId = claimed.postId;
      let postUrl = claimed.postUrl;
      let failure: string | null = null;
      for (const action of plan.actions) {
        // Più azioni sullo stesso account (più storie): si ricorda quali sono già uscite, per non rifarle in un nuovo tentativo
      const doneKey = action.key ?? action.accountId;
      if (done.has(doneKey)) continue;
        try {
          const res = await executeAction(action.connector, action.action, action.accountId, action.params);
          const refs = extractPostRef(res);
          postId = postId || refs.postId;
          postUrl = postUrl || refs.postUrl;
          done.add(doneKey);
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
      outcomes.push({ contentId: content.id, topic: content.topic, clientId: content.clientId, clientName: client?.name, publicationDate: content.publicationDate, channel, result: failure ? `fallito: ${failure}` : 'pubblicato' });
    }

    if (!dryRun && allAutomatedPublished(content, channels)) {
      await ref.update({ status: 'Pubblicato', updatedAt: new Date() });
    }
  }

  return outcomes;
}
