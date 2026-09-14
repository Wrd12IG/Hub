import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { getData } from '@/lib/windsor-client';

export const maxDuration = 60;

/**
 * GET /api/clients/[id]/instagram
 *
 * Instagram organico da Windsor, la stessa fonte della scheda nella Overview.
 *
 * Prima passava da `getInstagramPageData`, che richiede un token Meta **per
 * singolo cliente**: nessun cliente ce l'ha, quindi la pagina mostrava zeri
 * ovunque. Non inventava nulla — meglio di GBP — ma non mostrava nemmeno
 * niente.
 */

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
const round = (n: number) => Math.round(n * 100) / 100;
const div = (a: number, b: number) => (b > 0 ? round(a / b) : 0);

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  const denied = await denyUnlessClientAllowed(auth.uid, params.id);
  if (denied) return denied;

  const snap = await adminDb.collection('clients').doc(params.id).get();
  const accountId = snap.exists ? (snap.data() as any)?.windsorAccounts?.instagram : null;
  if (!accountId) {
    return NextResponse.json(
      { error: 'Questo cliente non ha un account Instagram configurato: inseriscilo in Setup API.' },
      { status: 503 }
    );
  }

  const raw = request.nextUrl.searchParams.get('days');
  const days = raw === '7' ? 7 : raw === '90' ? 90 : 30;
  const preset = `last_${days}d`;

  try {
    const q = (fields: string[]) =>
      getData({ connector: 'instagram', accountId, fields: [...fields, 'account_id'], datePreset: preset })
        .catch(() => [] as any[]);

    const [account, daily, media, gender, age] = await Promise.all([
      q(['followers_count', 'follows_count', 'media_count', 'account_name']),
      q(['date', 'likes', 'comments', 'shares', 'saves', 'reach', 'total_interactions', 'views', 'follower_count_1d']),
      q(['media_id', 'media_caption', 'media_permalink', 'media_type', 'media_like_count',
        'media_comments_count', 'media_reach', 'media_views', 'media_saved', 'media_engagement',
        'media_reel_avg_watch_time', 'timestamp']),
      q(['audience_gender_name', 'audience_gender_size']),
      q(['audience_age_name', 'audience_age_size']),
    ]);

    const a = account[0] || {};
    const followers = num(a.followers_count);
    const seguiti = num(a.follows_count);
    const contenutiTotali = num(a.media_count);

    // ── Serie giornaliere ────────────────────────────────────────────────
    const byDate = new Map<string, any>();
    for (const r of daily) {
      const date = String(r.date ?? '').slice(0, 10);
      if (!date) continue;
      byDate.set(date, {
        date,
        miPiace: num(r.likes), commenti: num(r.comments),
        salvati: num(r.saves), condivisi: num(r.shares),
        copertura: num(r.reach), visualizzazioni: num(r.views),
        interazioni: num(r.total_interactions),
        nuoviFollower: num(r.follower_count_1d),
      });
    }
    const series = Array.from(byDate.values()).sort((x, y) => x.date.localeCompare(y.date));

    const sum = (k: string) => series.reduce((s, r) => s + num(r[k]), 0);
    const giorni = Math.max(1, series.length);

    // ── Post e reel ──────────────────────────────────────────────────────
    const toRow = (m: any) => {
      const miPiace = num(m.media_like_count);
      const commenti = num(m.media_comments_count);
      const copertura = num(m.media_reach);
      const interazioni = num(m.media_engagement) || miPiace + commenti + num(m.media_saved);
      return {
        title: String(m.media_caption ?? '').slice(0, 120) || '(senza didascalia)',
        permalink: String(m.media_permalink ?? ''),
        date: String(m.timestamp ?? '').slice(0, 10),
        copertura,
        viste: num(m.media_views),
        interazioni,
        miPiace,
        commenti,
        // L'engagement è sulla copertura, non sui follower: misura quanti di
        // quelli che hanno *visto* il contenuto hanno reagito.
        engagement: copertura > 0 ? round((interazioni / copertura) * 100) : 0,
        risposteSalvate: num(m.media_saved),
        azioni: interazioni,
        tempoMedio: num(m.media_reel_avg_watch_time) > 0
          ? round(num(m.media_reel_avg_watch_time) / 1000)   // Windsor lo dà in millisecondi
          : 0,
        tags: [] as string[],
      };
    };
    const isReel = (t: unknown) => ['REELS', 'REEL', 'VIDEO'].includes(String(t ?? '').toUpperCase());
    const posts = media.filter((m) => !isReel(m.media_type)).map(toRow)
      .sort((x, y) => y.date.localeCompare(x.date));
    const reels = media.filter((m) => isReel(m.media_type)).map(toRow)
      .sort((x, y) => y.date.localeCompare(x.date));

    const interazioniTotali = sum('interazioni');
    const coperturaTotale = sum('copertura');
    const nPost = posts.length + reels.length;

    return NextResponse.json({
      account: { nome: String(a.account_name ?? ''), followers, seguiti },

      crescitaSummary: { followers, seguiti, contenutiTotali },
      crescitaMedie: {
        followers, seguiti,
        followersGiornalieri: div(sum('nuoviFollower'), giorni),
        postGiornalieri: div(nPost, giorni),
        postSettimana: div(nPost * 7, giorni),
        followersPerPost: div(sum('nuoviFollower'), nPost),
      },
      // ⚠️ Nessuna linea "followers" nel tempo: Windsor dichiara che
      // followers_count **non ha storico**, dà il valore di oggi. Ricostruirlo
      // sommando i nuovi follower sarebbe sbagliato (sono lordi, non netti) e
      // una linea piatta sembrerebbe un dato. Resta il conteggio assoluto nel
      // riquadro e il saldo giornaliero nel grafico apposta.
      crescitaChart: series.map((r) => ({ date: r.date, contenuti: 0 })),
      saldoFollower: series.map((r) => ({ date: r.date, value: r.nuoviFollower })),

      organicoSummary: {
        interazioni: interazioniTotali,
        coperturaMedia: div(coperturaTotale, giorni),
        visualizzazioni: sum('visualizzazioni'),
        engagement: coperturaTotale > 0 ? round((interazioniTotali / coperturaTotale) * 100) : 0,
        reels: reels.length,
      },
      organicoMedie: {
        miPiaceGiornalieri: div(sum('miPiace'), giorni),
        commentiGiornalieri: div(sum('commenti'), giorni),
        miPiacePerPost: div(sum('miPiace'), nPost),
        commentiPerPost: div(sum('commenti'), nPost),
        miPiacePerCommento: div(sum('miPiace'), sum('commenti')),
      },
      organicoChart: series.map((r) => ({
        date: r.date, copertura: r.copertura, visualizzazioni: r.visualizzazioni,
        interazioni: r.interazioni,
        engagement: r.copertura > 0 ? round((r.interazioni / r.copertura) * 100) : 0,
      })),

      interazioniOrganicheSummary: {
        miPiace: sum('miPiace'), commenti: sum('commenti'),
        salvati: sum('salvati'), condivisi: sum('condivisi'), reels: reels.length,
      },
      interazioniOrganicheChart: series.map((r) => ({
        date: r.date, miPiace: r.miPiace, commenti: r.commenti,
        salvati: r.salvati, condivisi: r.condivisi,
      })),

      demographics: {
        genere: gender.map((g) => ({ name: String(g.audience_gender_name ?? ''), value: num(g.audience_gender_size) }))
          .filter((g) => g.name && g.value > 0),
        eta: age.map((g) => ({ name: String(g.audience_age_name ?? ''), value: num(g.audience_age_size) }))
          .filter((g) => g.name && g.value > 0)
          .sort((x, y) => x.name.localeCompare(y.name)),
      },

      posts,
      reels,
      // Windsor non espone gli hashtag: lista vuota, non inventata.
      hashtags: [],
      _meta: { source: 'windsor', days },
    });
  } catch (err: any) {
    console.error(`[instagram] fallita per ${params.id}:`, err.message);
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
}
