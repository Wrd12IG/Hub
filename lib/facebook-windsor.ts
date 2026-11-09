/**
 * lib/facebook-windsor.ts
 *
 * Dashboard «Facebook pagina» dai dati di Windsor (connettore `facebook_organic`), nella forma che la pagina
 * /clients/[id]/facebook già usa. Prima passava solo dall'API Meta diretta con un token per cliente (`getFacebookPageData`):
 * senza token la scheda restava vuota anche con la pagina collegata a Windsor.
 *
 * Verificato il 09/11/2026 sulla pagina Quacquarelli (133375710160163):
 *  - le colonne `page_*` sono giornaliere; `page_impressions_unique` NON si somma fra i giorni (la stessa persona verrebbe contata
 *    più volte): nei totali si usa la copertura media giornaliera;
 *  - le colonne `post_*` si leggono per post e i post si selezionano per data di CREAZIONE;
 *  - non ci sono dati per demografia, storie e reel: quelle sezioni restano vuote (non si inventano).
 */

import { getData, type WindsorRow } from './windsor-client';

const PAGE_FIELDS = [
    'date', 'page_fans', 'page_daily_follows', 'page_daily_unfollows', 'page_views_total', 'page_impressions',
    'page_impressions_unique', 'page_post_engagements', 'page_video_views',
];
const POST_FIELDS = [
    'post_id', 'post_message', 'post_created_time', 'post_impressions', 'post_impressions_unique', 'post_reactions_total',
    'post_comments_total', 'post_activity_by_action_type_share', 'post_clicks', 'post_video_views', 'full_picture',
    'permalink_url', 'media_type', 'post_video_avg_time_watched',
];

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const day = (v: unknown) => String(v ?? '').slice(0, 10);
const it = (n: number) => n.toLocaleString('it-IT');

/** I giorni da `from` a `to` inclusi (yyyy-mm-dd, UTC). */
export function daysBetween(from: string, to: string): string[] {
    const out: string[] = [];
    const d = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || Number.isNaN(end.getTime())) return out;
    while (d <= end && out.length < 400) {
        out.push(d.toISOString().slice(0, 10));
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
}

export async function getFacebookWindsorDashboard(accountId: string, startIso: string, endIso: string) {
    const from = day(startIso);
    const to = day(endIso);
    const dates = daysBetween(from, to);
    const range = { dateFrom: from, dateTo: to };

    const [pageRows, postRows] = await Promise.all([
        getData({ connector: 'facebook_organic', accountId, fields: [...PAGE_FIELDS, 'account_id'], ...range }),
        getData({ connector: 'facebook_organic', accountId, fields: [...POST_FIELDS, 'account_id'], ...range }),
    ]);

    const byDate = new Map<string, WindsorRow>();
    for (const r of pageRows) if (day(r.date)) byDate.set(day(r.date), r);

    const posts = postRows
        .filter((r) => r.post_id)
        .sort((a, b) => String(b.post_created_time ?? '').localeCompare(String(a.post_created_time ?? '')));
    const postsByDate = new Map<string, number>();
    for (const p of posts) {
        const d = day(p.post_created_time);
        if (d) postsByDate.set(d, (postsByDate.get(d) ?? 0) + 1);
    }

    const sumPage = (f: string) => pageRows.reduce((s, r) => s + num(r[f]), 0);
    const perDay = (date: string, f: string) => num(byDate.get(date)?.[f]);
    const diffDays = Math.max(1, dates.length);

    const validFans = pageRows
        .filter((r) => day(r.date) && num(r.page_fans) > 0)
        .sort((a, b) => day(a.date).localeCompare(day(b.date)));
    const followers = validFans.length ? num(validFans[validFans.length - 1].page_fans) : 0;

    const impressions = sumPage('page_impressions');
    const pageViews = sumPage('page_views_total');
    const acquired = sumPage('page_daily_follows');
    const lost = sumPage('page_daily_unfollows');
    const engagement = sumPage('page_post_engagements');
    const videoViews = sumPage('page_video_views');
    // Copertura: media dei giorni con dati, non la somma (vedi nota in testa)
    const reachDays = pageRows.filter((r) => num(r.page_impressions_unique) > 0);
    const avgReach = reachDays.length ? Math.round(sumPage('page_impressions_unique') / reachDays.length) : 0;

    const reactions = posts.reduce((s, p) => s + num(p.post_reactions_total), 0);
    const comments = posts.reduce((s, p) => s + num(p.post_comments_total), 0);
    const shares = posts.reduce((s, p) => s + num(p.post_activity_by_action_type_share), 0);
    const clicks = posts.reduce((s, p) => s + num(p.post_clicks), 0);
    const totalPosts = posts.length;

    const chart = <T extends object>(fn: (date: string) => T) => dates.map((date) => ({ date, ...fn(date) }));

    return {
        crescitaSummary: { followers, visualizzazioni: it(impressions), visitePagina: it(pageViews), contenutiTotali: totalPosts },
        crescitaMedie: {
            followersGiornalieri: Math.round((acquired - lost) / diffDays * 100) / 100,
            visiteGiornaliere: Math.round(pageViews / diffDays * 100) / 100,
            postGiornalieri: (totalPosts / diffDays).toFixed(2),
            postSettimana: ((totalPosts / diffDays) * 7).toFixed(1),
        },
        crescitaChart: chart((date) => {
            const fans = perDay(date, 'page_fans');
            return { followers: fans > 0 ? fans : null, contenuti: postsByDate.get(date) ?? 0 };
        }),
        saldoFollowerSummary: { acquisiti: acquired, persi: lost, contenutiTotali: totalPosts },
        saldoFollower: chart((date) => ({ acquisiti: perDay(date, 'page_daily_follows'), persi: perDay(date, 'page_daily_unfollows') })),
        postVisualizzatiSummary: { visualizzazioni: it(impressions), reazioni: it(reactions) },
        postVisualizzatiChart: chart((date) => ({ visualizzazioni: perDay(date, 'page_impressions'), reazioni: 0 })),
        demographics: { genere: [], eta: [], paese: [], citta: [] },
        clicSummary: { clicTotali: clicks, visitePagina: it(pageViews), contenutiTotali: totalPosts },
        clicChart: chart((date) => ({ clic: 0, visite: perDay(date, 'page_views_total'), contenuti: postsByDate.get(date) ?? 0 })),
        organicoSummary: { engagement, interazioni: engagement, coperturaMedia: avgReach, visualizzazioni: it(impressions), post: totalPosts },
        organicoChart: chart((date) => ({
            engagement: perDay(date, 'page_post_engagements'),
            interazioni: perDay(date, 'page_post_engagements'),
            copertura: perDay(date, 'page_impressions_unique'),
            visualizzazioni: perDay(date, 'page_impressions'),
            post: postsByDate.get(date) ?? 0,
        })),
        interazioniOrganicheSummary: { reazioni: reactions, commenti: comments, condivisi: shares, clic: clicks, post: totalPosts },
        interazioniOrganicheChart: chart((date) => ({ reazioni: 0, commenti: 0, condivisi: 0, clic: 0, post: postsByDate.get(date) ?? 0 })),
        organicoMedie: {
            reazioniGiornaliere: Math.round(reactions / diffDays * 100) / 100,
            reazioniPerPost: totalPosts ? Math.round(reactions / totalPosts * 100) / 100 : 0,
            commentiGiornalieri: Math.round(comments / diffDays * 100) / 100,
            commentiPerPost: totalPosts ? Math.round(comments / totalPosts * 100) / 100 : 0,
            condivisioniGiornaliere: Math.round(shares / diffDays * 100) / 100,
            condivisioniPerPost: totalPosts ? Math.round(shares / totalPosts * 100) / 100 : 0,
        },
        tipiVisualizzazioni: { tipi: [], visualizzazioni: [] },
        // Windsor non dà l'andamento di reel e storie per questa pagina: restano a zero come prima, non si inventano
        reelsSummary: { engagement: 0, interazioni: 0, coperturaMedia: 0, visualizzazioniVideo: it(videoViews), reels: 0 },
        reelsChart: chart((date) => ({ engagement: 0, interazioni: 0, copertura: 0, visualizzazioni: perDay(date, 'page_video_views'), reels: 0 })),
        reelsInterazioniSummary: { miPiace: 0, azioni: 0, reels: 0 },
        reelsInterazioniChart: chart(() => ({ miPiace: 0, azioni: 0, reels: 0 })),
        storieSummary: { storie: 0 },
        storieChart: chart(() => ({ storie: 0 })),
        posts: posts.map((p) => {
            const r = num(p.post_reactions_total), c = num(p.post_comments_total), s = num(p.post_activity_by_action_type_share);
            const isVideo = String(p.media_type ?? '').includes('video');
            const watch = Math.round(num(p.post_video_avg_time_watched) / 1000); // millisecondi
            return {
                id: String(p.post_id),
                title: String(p.post_message ?? '') || 'Senza testo',
                tags: [isVideo ? 'Video' : 'Immagine'],
                image: p.full_picture ? String(p.full_picture) : null,
                date: String(p.post_created_time ?? ''),
                copertura: num(p.post_impressions_unique),
                visualizzazioni: num(p.post_impressions),
                reazioni: r,
                commenti: c,
                condivisi: s,
                clic: num(p.post_clicks),
                clicLink: 0,
                visVideo: num(p.post_video_views),
                tempoVideo: `${Math.floor(watch / 60)}:${String(watch % 60).padStart(2, '0')}`,
                engagement: r + c + s,
                spesa: '0',
            };
        }),
        reels: [],
        storieList: [],
        _meta: { source: 'windsor' },
    };
}
