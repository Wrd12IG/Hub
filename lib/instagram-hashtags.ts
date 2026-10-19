// Hashtag e conteggi giornalieri ricavati dai contenuti Instagram (post e reel) già letti da Windsor.
// Windsor non ha un campo «hashtag», ma ogni contenuto porta la didascalia completa: gli hashtag sono lì dentro.

/** Una riga di contenuto come arriva da Windsor (campi: media_caption, media_views, media_like_count, media_comments_count, timestamp). */
export type MediaLike = Record<string, unknown>;

export interface HashtagRow { parola: string; viste: number; post: number; miPiace: number; commenti: number }

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Gli hashtag di una didascalia, minuscoli e senza doppioni. «#2026» (solo cifre) non è un hashtag. */
export function extractHashtags(caption: unknown): string[] {
    if (typeof caption !== 'string') return [];
    const found = caption.match(/#[A-Za-z0-9_\u00C0-\u024F]{2,50}/g) ?? [];
    return Array.from(new Set(found.map((t) => t.toLowerCase()).filter((t) => !/^#\d+$/.test(t))));
}

/**
 * Per ogni hashtag: in quanti contenuti compare e la somma di visualizzazioni, mi piace e commenti di quei contenuti.
 * Un contenuto con più hashtag conta per ciascuno: le righe non vanno sommate fra loro.
 */
export function aggregateHashtags(media: MediaLike[]): HashtagRow[] {
    const map = new Map<string, HashtagRow>();
    for (const m of media) {
        for (const tag of extractHashtags(m.media_caption)) {
            const row = map.get(tag) ?? { parola: tag, viste: 0, post: 0, miPiace: 0, commenti: 0 };
            row.post += 1;
            row.viste += num(m.media_views);
            row.miPiace += num(m.media_like_count);
            row.commenti += num(m.media_comments_count);
            map.set(tag, row);
        }
    }
    return Array.from(map.values()).sort((a, b) => b.viste - a.viste || b.post - a.post || a.parola.localeCompare(b.parola));
}

/** Contenuti pubblicati per giorno (yyyy-MM-dd, dal timestamp del contenuto). */
export function postsPerDay(media: MediaLike[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const m of media) {
        const day = typeof m.timestamp === 'string' ? m.timestamp.slice(0, 10) : '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(day)) out[day] = (out[day] ?? 0) + 1;
    }
    return out;
}
