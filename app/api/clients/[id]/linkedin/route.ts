import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { getData } from '@/lib/windsor-client';

export const maxDuration = 60;

/**
 * GET /api/clients/[id]/linkedin
 *
 * LinkedIn organico da Windsor, la stessa fonte della scheda nella Overview.
 *
 * Prima passava da `getLinkedinPageData`, che richiede un token OAuth per
 * singolo cliente ottenuto da un'app LinkedIn developer: nessun cliente ce
 * l'ha, e la pagina restituiva una struttura vuota.
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
  const accountId = snap.exists ? (snap.data() as any)?.windsorAccounts?.linkedin_organic : null;
  if (!accountId) {
    return NextResponse.json(
      { notConfigured: true, error: 'Questo cliente non ha una pagina LinkedIn configurata: inserisci l\'Organization ID nella card "LinkedIn (Report)" in Setup API.' },
      { status: 503 }
    );
  }

  const raw = request.nextUrl.searchParams.get('days');
  const days = raw === '7' ? 7 : raw === '90' ? 90 : 30;
  const preset = `last_${days}d`;

  try {
    const q = (fields: string[]) =>
      getData({ connector: 'linkedin_organic', accountId, fields: [...fields, 'account_id'], datePreset: preset })
        .catch(() => [] as any[]);

    const [org, daily, pages, shares] = await Promise.all([
      q(['organization_follower_count', 'organization_name']),
      q(['date', 'account_analytics_impression_count', 'account_analytics_like_count',
        'account_analytics_comment_count', 'account_analytics_share_count',
        'account_analytics_click_count', 'account_analytics_total_engagements',
        'followers_gain_organic']),
      q(['date', 'all_page_views', 'all_unique_page_views', 'desktop_custom_button_click_counts',
        'mobile_custom_button_click_counts']),
      q(['share_id', 'share_title', 'share_text', 'share_post_type', 'share_published_time',
        'share_impression_count', 'share_unique_impressions_count', 'share_like_count',
        'share_comment_count', 'share_clicks_count', 'share_count',
        'share_engagement_rate', 'share_total_engagements', 'share_video_views']),
    ]);

    const followers = num(org[0]?.organization_follower_count);

    // ── Serie giornaliera ────────────────────────────────────────────────
    const byDate = new Map<string, any>();
    const put = (date: string, patch: Record<string, number>) => {
      if (!date) return;
      const e = byDate.get(date) || {
        date, impression: 0, reazioni: 0, commenti: 0, condivisi: 0, clic: 0,
        interazioni: 0, nuoviFollower: 0, visualizzazioniPagina: 0,
        visitatoriUnici: 0, clicPulsanti: 0,
      };
      for (const [k, v] of Object.entries(patch)) e[k] += v;
      byDate.set(date, e);
    };

    for (const r of daily) {
      put(String(r.date ?? '').slice(0, 10), {
        impression: num(r.account_analytics_impression_count),
        reazioni: num(r.account_analytics_like_count),
        commenti: num(r.account_analytics_comment_count),
        condivisi: num(r.account_analytics_share_count),
        clic: num(r.account_analytics_click_count),
        interazioni: num(r.account_analytics_total_engagements),
        nuoviFollower: num(r.followers_gain_organic),
      });
    }
    for (const r of pages) {
      put(String(r.date ?? '').slice(0, 10), {
        visualizzazioniPagina: num(r.all_page_views),
        visitatoriUnici: num(r.all_unique_page_views),
        clicPulsanti: num(r.desktop_custom_button_click_counts) + num(r.mobile_custom_button_click_counts),
      });
    }
    const series = Array.from(byDate.values()).sort((x, y) => x.date.localeCompare(y.date));
    const sum = (k: string) => series.reduce((s, r) => s + num(r[k]), 0);
    const giorni = Math.max(1, series.length);

    // ── Post ─────────────────────────────────────────────────────────────
    const posts = shares
      .filter((s) => s.share_id)
      .map((s) => {
        const impression = num(s.share_impression_count);
        const interazioni = num(s.share_total_engagements);
        return {
          title: String(s.share_title || s.share_text || '').slice(0, 140) || '(senza testo)',
          tipo: String(s.share_post_type ?? ''),
          date: String(s.share_published_time ?? '').slice(0, 10),
          impression,
          reazioni: num(s.share_like_count),
          commenti: num(s.share_comment_count),
          clic: num(s.share_clicks_count),
          condivisi: num(s.share_count),
          // Windsor espone già il tasso calcolato da LinkedIn; se manca lo si
          // ricava dalle impression, non dai follower.
          engagement: num(s.share_engagement_rate) > 0
            ? round(num(s.share_engagement_rate) * 100)
            : (impression > 0 ? round((interazioni / impression) * 100) : 0),
          visualizzazioniVideo: num(s.share_video_views),
          visitatori: num(s.share_unique_impressions_count),
        };
      })
      .sort((x, y) => y.date.localeCompare(x.date));

    const impressionTotali = sum('impression');
    const interazioniTotali = sum('interazioni');
    const nPost = posts.length;

    return NextResponse.json({
      account: { nome: String(org[0]?.organization_name ?? ''), followers },

      riepilogoSummary: {
        impression: impressionTotali,
        interazioni: interazioniTotali,
        post: nPost,
        engagement: impressionTotali > 0 ? round((interazioniTotali / impressionTotali) * 100) : 0,
      },
      riepilogoChart: series.map((r) => ({
        date: r.date, impression: r.impression, interazioni: r.interazioni,
        engagement: r.impression > 0 ? round((r.interazioni / r.impression) * 100) : 0,
        post: 0,
      })),

      crescitaSummary: {
        followers,
        contenutoTotale: nPost,
        visualizzazioniPagina: sum('visualizzazioniPagina'),
        mediaVisitatoriUnici: div(sum('visitatoriUnici'), giorni),
        clicPulsanti: sum('clicPulsanti'),
      },
      // Come per Instagram: nessuna linea "follower nel tempo" ricostruita.
      // Windsor dà il totale di oggi e la crescita giornaliera, non la serie
      // storica; sommare la crescita all'indietro produrrebbe una curva
      // plausibile e sbagliata.
      crescitaChart: series.map((r) => ({ date: r.date, followers: r.nuoviFollower, contenuto: 0 })),

      interazioniSummary: {
        reazioni: sum('reazioni'), commenti: sum('commenti'),
        condivisi: sum('condivisi'), clic: sum('clic'), post: nPost,
      },
      interazioniChart: series.map((r) => ({
        date: r.date, reazioni: r.reazioni, commenti: r.commenti,
        condivisi: r.condivisi, clic: r.clic,
      })),

      averagesSummary: {
        reazioniGiornaliere: div(sum('reazioni'), giorni),
        commentiGiornalieri: div(sum('commenti'), giorni),
        clicGiornalieri: div(sum('clic'), giorni),
        postGiornalieri: div(nPost, giorni),
        followersGiornalieri: div(sum('nuoviFollower'), giorni),
        reazioniPerContenuto: div(sum('reazioni'), nPost),
        commentiPerContenuto: div(sum('commenti'), nPost),
        clicksPerContent: div(sum('clic'), nPost),
        followersPerPost: div(sum('nuoviFollower'), nPost),
      },

      posts,
      // LinkedIn espone le newsletter solo con permessi che non abbiamo.
      newsletters: [],
      _meta: { source: 'windsor', days },
    });
  } catch (err: any) {
    console.error(`[linkedin] fallita per ${params.id}:`, err.message);
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
}
