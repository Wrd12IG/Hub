/**
 * lib/creative/spec.ts
 *
 * Tipi, etichette e validazione della richiesta del Generatore Creativo (pagina /clients/[id]/creative).
 * Condiviso da server e pagina: qui NON c'è il testo dei prompt (lib/creative/playbooks.ts, solo server).
 */

export type CreativeKind = 'hooks' | 'caption' | 'carousel' | 'repurpose';
export type CreativeChannel = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube';
export type CreativeGoal = 'saves' | 'shares' | 'comments' | 'follows' | 'completion';

export const KIND_LABEL: Record<CreativeKind, string> = {
    hooks: 'Hook e script video',
    caption: 'Didascalie e post',
    carousel: 'Caroselli',
    repurpose: 'Riutilizza un contenuto',
};

export const CHANNEL_LABEL: Record<CreativeChannel, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    linkedin: 'LinkedIn',
    tiktok: 'TikTok',
    youtube: 'YouTube Shorts',
};

export const GOAL_LABEL: Record<CreativeGoal, string> = {
    saves: 'Salvataggi',
    shares: 'Condivisioni',
    comments: 'Commenti',
    follows: 'Nuovi follower',
    completion: 'Visualizzazione completa',
};

/** Canali ammessi per ogni tipo di lavoro. */
export const KIND_CHANNELS: Record<CreativeKind, CreativeChannel[]> = {
    hooks: ['instagram', 'tiktok', 'youtube'],
    caption: ['instagram', 'facebook', 'linkedin', 'tiktok'],
    carousel: ['instagram', 'linkedin'],
    repurpose: ['instagram', 'facebook', 'linkedin', 'tiktok'],
};

/** Obiettivi ammessi per ogni tipo di lavoro. */
export const KIND_GOALS: Record<CreativeKind, CreativeGoal[]> = {
    hooks: ['completion', 'saves', 'comments', 'shares'],
    caption: ['saves', 'shares', 'comments', 'follows'],
    carousel: ['saves', 'shares', 'follows'],
    repurpose: ['saves', 'shares', 'comments', 'follows'],
};

export const LIMITS = { topic: 300, facts: 1500, source: 6000 } as const;

export interface CreativeRequest {
    kind: CreativeKind;
    channel: CreativeChannel;
    goal: CreativeGoal;
    /** Di cosa parla il contenuto (idea, offerta, notizia). */
    topic: string;
    /** Dati veri che si possono usare: numeri, date, nomi, risultati. Nient'altro viene inventato. */
    facts: string;
    /** Solo per «riutilizza»: il testo di partenza (post, articolo, script). */
    source: string;
}

export type ParseResult = { ok: true; value: CreativeRequest } | { ok: false; error: string };

const str = (v: unknown) => (typeof v === 'string' ? v.replace(/\r/g, '').trim() : '');

export function parseCreativeRequest(body: unknown): ParseResult {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const kind = b.kind as CreativeKind;
    if (!(kind in KIND_LABEL)) return { ok: false, error: 'Tipo di lavoro non valido.' };
    const channel = b.channel as CreativeChannel;
    if (!KIND_CHANNELS[kind].includes(channel)) return { ok: false, error: `Per «${KIND_LABEL[kind]}» il canale ${CHANNEL_LABEL[channel] ?? ''} non è disponibile.` };
    const goal = b.goal as CreativeGoal;
    if (!KIND_GOALS[kind].includes(goal)) return { ok: false, error: 'Obiettivo non valido per questo tipo di lavoro.' };

    const topic = str(b.topic);
    const facts = str(b.facts);
    const source = str(b.source);
    if (kind === 'repurpose') {
        if (source.length < 40) return { ok: false, error: 'Incolla il testo da riutilizzare (almeno qualche riga).' };
    } else if (topic.length < 5) {
        return { ok: false, error: 'Descrivi di cosa parla il contenuto (almeno qualche parola).' };
    }
    if (topic.length > LIMITS.topic) return { ok: false, error: `L'argomento è troppo lungo (massimo ${LIMITS.topic} caratteri).` };
    if (facts.length > LIMITS.facts) return { ok: false, error: `I dati sono troppo lunghi (massimo ${LIMITS.facts} caratteri).` };
    if (source.length > LIMITS.source) return { ok: false, error: `Il testo di partenza è troppo lungo (massimo ${LIMITS.source} caratteri).` };
    return { ok: true, value: { kind, channel, goal, topic, facts, source } };
}

/** Un risultato pronto da mostrare. Non tutti i campi esistono per ogni tipo di lavoro. */
export interface CreativeItem {
    formula: string;
    formulaName: string;
    /** Prima riga visibile (didascalie, caroselli): è quella che deve reggere da sola. */
    hook: string;
    caption: string;
    slides: { role: string; text: string }[];
    hashtags: string[];
    /** Solo hook video. */
    spoken: string;
    onScreen: string;
    visual: string;
    loopClose: string;
    /** Solo «riutilizza»: cosa è diventato cosa. */
    mapping: string;
    /** Dati che renderebbero il contenuto più forte e che non sono stati forniti. */
    missingData: string[];
    /** Controlli automatici: cose da sistemare prima di usarlo. */
    warnings: string[];
}
