import { NextRequest, NextResponse } from 'next/server';
import { denyUnlessCron } from '@/lib/cron-auth';
import { adminDb } from '@/lib/firebase-admin';
import { getReport, reportCacheKey, DEFAULT_VIEW } from '@/lib/report-service';
import { getHealth } from '@/lib/health-service';
import { hasReportSources, needsWarming, sourcesSignature } from '@/lib/report-warm';

// Come le altre cron: legge gli header a ogni richiesta, quindi mai prerenderizzata.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Una lettura completa di un cliente costa 10-45 s (Windsor impiega 8-12 s per lettura): si lavora in due alla volta. */
const CONCURRENCY = 2;
/** Si smette di avviare nuovi clienti con questo margine sul limite: quelli rimasti li prende la corsa successiva. */
const BUDGET_MS = 230_000;
/** Un report più giovane di così non si rifà: due corse la stessa notte non si pestano i piedi. */
const FRESH_MS = 20 * 60 * 60 * 1000;

/**
 * Giro notturno: prepara il report predefinito (30 giorni col confronto) e la faccina di ogni cliente, così la prima
 * apertura del giorno è immediata invece di aspettare 10-20 secondi.
 *
 * Parte dai clienti con la copia più vecchia e salta quelli già freschi: se una corsa non basta per tutti, la
 * successiva (vedi vercel.json) riprende da dove era rimasta. Una fonte in errore non ferma il giro: quel cliente
 * resta con la cache breve e verrà rifatto.
 */
export async function GET(request: NextRequest) {
  const denied = denyUnlessCron(request, 'cron/warm-reports');
  if (denied) return denied;

  const started = Date.now();
  const force = request.nextUrl.searchParams.get('force') === '1';
  const key = reportCacheKey(DEFAULT_VIEW.datePreset, DEFAULT_VIEW.days, DEFAULT_VIEW.compare);

  try {
    const snap = await adminDb.collection('clients').get();
    const candidates = snap.docs.filter((d) => hasReportSources(d.data()));

    // La copia attuale di ciascuno: serve per saltare i freschi e per partire dai più vecchi
    const withAge = await Promise.all(candidates.map(async (d) => {
      const hit = (await d.ref.collection('cache').doc(key).get().catch(() => null))?.data() as any;
      return { id: d.id, name: String(d.data().name ?? d.id), data: d.data() as any, hit };
    }));
    const todo = withAge
      .filter((c) => force || needsWarming(c.hit, started, FRESH_MS, sourcesSignature(c.data)))
      .sort((a, b) => Date.parse(a.hit?.computedAt ?? '1970-01-01') - Date.parse(b.hit?.computedAt ?? '1970-01-01'));

    const results: { client: string; ok: boolean; seconds: number; error?: string }[] = [];
    let next = 0;

    const worker = async () => {
      while (next < todo.length && Date.now() - started < BUDGET_MS) {
        const c = todo[next++];
        const t0 = Date.now();
        try {
          // refresh: letture nuove (non la cache condivisa di 5 minuti); poi il verdetto della faccina
          await getReport({ clientId: c.id, datePreset: DEFAULT_VIEW.datePreset, daysRaw: DEFAULT_VIEW.days, compare: DEFAULT_VIEW.compare, refresh: true, client: c.data });
          await getHealth(c.id, true);
          results.push({ client: c.name, ok: true, seconds: Math.round((Date.now() - t0) / 1000) });
        } catch (err: any) {
          console.error(`[cron/warm-reports] ${c.name}:`, err.message);
          results.push({ client: c.name, ok: false, seconds: Math.round((Date.now() - t0) / 1000), error: String(err.message).slice(0, 120) });
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    return NextResponse.json({
      candidates: candidates.length,
      toWarm: todo.length,
      warmed: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      remaining: Math.max(0, todo.length - results.length),
      seconds: Math.round((Date.now() - started) / 1000),
      results,
    });
  } catch (err: any) {
    console.error('[cron/warm-reports] fallito:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
