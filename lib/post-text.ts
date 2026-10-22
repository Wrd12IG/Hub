/**
 * lib/post-text.ts
 *
 * Testo finale di un post: la didascalia, le @menzioni e gli #hashtag, ciascuno nel formato giusto.
 * Pura (nessun I/O). Usata dalla pubblicazione (lib/publisher.ts).
 */

const SPLIT = /[\s,;]+/;

/** "estate  offerta,#Auto" → ["#estate", "#offerta", "#Auto"]. Senza duplicati (le maiuscole non contano), senza simboli spuri. */
export function normalizeTags(raw: string | undefined, prefix: '#' | '@'): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const piece of (raw || '').split(SPLIT)) {
        const word = piece.replace(/^[#@]+/, '').replace(/[^A-Za-z0-9_.\u00C0-\u024F]/g, '');
        if (!word) continue;
        const tag = `${prefix}${word}`;
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(tag);
    }
    return out;
}

/**
 * Didascalia + menzioni + hashtag, nei limiti del canale. Se non basta lo spazio si accorcia la didascalia, mai le
 * menzioni e gli hashtag. Quelli già scritti dentro la didascalia non si ripetono.
 */
export function composePostText(copy: string | undefined, hashtags: string | undefined, mentions: string | undefined, max: number): string {
    const base = (copy || '').trim();
    const lower = base.toLowerCase();
    const extra = [
        normalizeTags(mentions, '@').filter((t) => !lower.includes(t.toLowerCase())).join(' '),
        normalizeTags(hashtags, '#').filter((t) => !lower.includes(t.toLowerCase())).join(' '),
    ].filter(Boolean);
    const tail = extra.join('\n');
    if (!tail) return base.length > max ? base.slice(0, max - 1).trimEnd() + '…' : base;
    const room = max - tail.length - 2; // due a-capo tra didascalia e coda
    if (room <= 0) return tail.slice(0, max);
    const head = base.length > room ? base.slice(0, Math.max(0, room - 1)).trimEnd() + '…' : base;
    return head ? `${head}\n\n${tail}` : tail;
}
