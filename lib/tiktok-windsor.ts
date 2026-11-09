/**
 * lib/tiktok-windsor.ts
 *
 * Dashboard TikTok dai dati di Windsor (connettore `tiktok_organic`), nella stessa forma che la pagina
 * /clients/[id]/tiktok già usa per l'API diretta: nessun token per cliente, basta l'account scelto in Setup API.
 *
 * Misurato il 09/11/2026 su 3 account reali:
 *  - `total_followers_count` torna 0 per l'ultimo giorno completo (dato non ancora pronto): un 0 NON è «zero follower»,
 *    va scartato, altrimenti il saldo mostrerebbe un crollo a 0 e una risalita.
 *  - `followers_count` (guadagnati) e `daily_lost_followers` tornano sempre 0 anche quando i follower salgono: il saldo si
 *    ricava dalle differenze fra i totali giornalieri validi.
 *  - `unique_video_views` è sempre 0: le visualizzazioni vengono dai video, non dall'account.
 *  - `videos_count` esiste solo nella riga di oggi (le altre sono null).
 *  - Le righe video si selezionano per data di CREAZIONE del video, non per data di visione.
 */

import { getData, type WindsorRow } from './windsor-client';

const DAYS = 56;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;
const day = (v: unknown) => String(v ?? '').slice(0, 10);

const ACCOUNT_FIELDS = [
    'date', 'total_followers_count', 'profile_views', 'likes', 'comments', 'shares', 'videos_count', 'username', 'account_name',
];
const VIDEO_FIELDS = [
    'video_id', 'video_caption', 'video_create_datetime', 'video_duration', 'video_views_count', 'video_likes',
    'video_comments', 'video_shares', 'video_average_time_watched', 'video_thumbnail_url', 'video_share_url',
];

export interface TikTokAccountSeries {
    followers: number;
    /** differenza fra totali validi consecutivi, per giorno */
    followerDelta: Map<string, { acquisito: number; perso: number }>;
}

/** Follower di oggi e variazione giornaliera, scartando i giorni a 0 (dato non ancora pronto). */
export function followerSeries(rows: WindsorRow[]): TikTokAccountSeries {
    const valid = rows
        .filter((r) => day(r.date) && num(r.total_followers_count) > 0)
        .map((r) => ({ date: day(r.date), total: num(r.total_followers_count) }))
        .sort((a, b) => a.date.localeCompare(b.date));
    const followerDelta = new Map<string, { acquisito: number; perso: number }>();
    for (let i = 1; i < valid.length; i++) {
        const d = valid[i].total - valid[i - 1].total;
        followerDelta.set(valid[i].date, { acquisito: d > 0 ? d : 0, perso: d < 0 ? -d : 0 });
    }
    return { followers: valid.length ? valid[valid.length - 1].total : 0, followerDelta };
}

function lastDays(days: number): string[] {
    return Array.from({ length: days }).map((_, i) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - (days - 1 - i));
        return d.toISOString().slice(0, 10);
    });
}

export async function getTikTokWindsorDashboard(accountId: string) {
    const preset = `last_${DAYS}d`;
    const [accountRows, videoRows] = await Promise.all([
        getData({ connector: 'tiktok_organic', accountId, fields: [...ACCOUNT_FIELDS, 'account_id'], datePreset: preset }),
        getData({ connector: 'tiktok_organic', accountId, fields: [...VIDEO_FIELDS, 'account_id'], datePreset: preset }),
    ]);

    const { followers, followerDelta } = followerSeries(accountRows);

    const accountByDate = new Map<string, WindsorRow>();
    for (const r of accountRows) if (day(r.date)) accountByDate.set(day(r.date), r);

    const videos = videoRows
        .filter((r) => r.video_id)
        .sort((a, b) => String(b.video_create_datetime ?? '').localeCompare(String(a.video_create_datetime ?? '')));

    const videosByDate = new Map<string, WindsorRow[]>();
    for (const v of videos) {
        const d = day(v.video_create_datetime);
        if (!d) continue;
        videosByDate.set(d, [...(videosByDate.get(d) ?? []), v]);
    }

    const sumV = (list: WindsorRow[], f: string) => list.reduce((s, v) => s + num(v[f]), 0);
    const views = sumV(videos, 'video_views_count');
    const likes = sumV(videos, 'video_likes');
    const comments = sumV(videos, 'video_comments');
    const shares = sumV(videos, 'video_shares');
    const interazioni = likes + comments + shares;

    let acquisito = 0, perso = 0;
    followerDelta.forEach((d) => { acquisito += d.acquisito; perso += d.perso; });
    const profileViews = accountRows.reduce((s, r) => s + num(r.profile_views), 0);
    const lifetimeVideos = accountRows.reduce((m, r) => Math.max(m, num(r.videos_count)), 0);

    const dates = lastDays(DAYS);
    const chart = (fn: (date: string, dayVideos: WindsorRow[]) => object) =>
        dates.map((date) => ({ date, ...fn(date, videosByDate.get(date) ?? []) }));

    return {
        summary: {
            followers,
            post: lifetimeVideos || videos.length,
            acquisito,
            perso,
            engagement: views > 0 ? round2((interazioni / views) * 100) : 0,
            interazioni,
            coperturaMedia: videos.length ? Math.round(views / videos.length) : 0,
            visualizzazioni: views,
            miPiace: likes,
            commenti: comments,
            condivisi: shares,
            visualizzazioniProfilo: profileViews,
        },
        // Totale follower di ogni giorno così come lo dà Windsor; i giorni a 0 (dato non pronto) restano vuoti
        crescitaChart: chart((date, dv) => ({ followers: accountTotal(accountByDate, date), post: dv.length })),
        saldoFollowersChart: chart((date) => ({
            acquisito: followerDelta.get(date)?.acquisito ?? 0,
            perso: followerDelta.get(date)?.perso ?? 0,
            post: 0,
        })),
        riepilogoChart: chart((_d, dv) => {
            const v = sumV(dv, 'video_views_count');
            const i = sumV(dv, 'video_likes') + sumV(dv, 'video_comments') + sumV(dv, 'video_shares');
            return { engagement: v > 0 ? round2((i / v) * 100) : 0, interazioni: i, coperturaMedia: v, visualizzazioni: v, post: dv.length };
        }),
        interazioniChart: chart((date, dv) => {
            const a = accountByDate.get(date);
            return { miPiace: num(a?.likes), commenti: num(a?.comments), condivisi: num(a?.shares), post: dv.length };
        }),
        profiloChart: chart((date, dv) => ({ visualizzazioni: num(accountByDate.get(date)?.profile_views), post: dv.length })),
        postVisualizzatiChart: chart((_d, dv) => ({
            visualizzazioni: sumV(dv, 'video_views_count'),
            miPiace: sumV(dv, 'video_likes'),
            commenti: sumV(dv, 'video_comments'),
            condivisi: sumV(dv, 'video_shares'),
        })),
        medieVisualizzazioniChart: chart((_d, dv) => ({
            tempoMedioGuardato: dv.length ? round2(sumV(dv, 'video_average_time_watched') / dv.length) : 0,
            durataMediaVideo: dv.length ? round2(sumV(dv, 'video_duration') / dv.length) : 0,
        })),
        posts: videos.map((v) => {
            const dur = Math.round(num(v.video_duration));
            return {
                id: String(v.video_id),
                title: String(v.video_caption ?? ''),
                tags: [],
                image: String(v.video_thumbnail_url ?? ''),
                date: v.video_create_datetime ? new Date(String(v.video_create_datetime)).toLocaleString('it-IT') : '',
                visualizzazioni: num(v.video_views_count),
                tempoVisualizzazione: num(v.video_average_time_watched) ? `${round2(num(v.video_average_time_watched))}s` : '-',
                durataMedia: dur ? `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}` : '-',
                miPiace: num(v.video_likes),
                nonMiPiace: 0,
                commenti: num(v.video_comments),
                condivisi: num(v.video_shares),
            };
        }),
    };
}

/** Totale follower di un giorno; 0 (dato non pronto) diventa null così la linea non crolla. */
function accountTotal(byDate: Map<string, WindsorRow>, date: string): number | null {
    const t = num(byDate.get(date)?.total_followers_count);
    return t > 0 ? t : null;
}
