// Unico punto da cui il Hub parla con l'AI: Claude (API Anthropic). Tutto ciò che fa l'AI passa da qui.
// Chiave: ANTHROPIC_API_KEY. Mai nel codice né nei log.

// Sonnet 5.5; se non risponde si ripiega sul modello più piccolo (Haiku 5.5)
export const CLAUDE_MODELS = ['claude-sonnet-5-5', 'claude-haiku-5-5'];

export function isClaudeConfigured(): boolean {
    const key = process.env.ANTHROPIC_API_KEY;
    return !!key && !/^your_|placeholder/i.test(key);
}

export interface AskClaudeOptions {
    prompt: string;
    system?: string;
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
}

/** Restituisce il testo della risposta. Lancia con un messaggio chiaro se manca la chiave o nessun modello risponde. */
export async function askClaude({ prompt, system, maxTokens = 4096, temperature = 0.7, timeoutMs = 45_000 }: AskClaudeOptions): Promise<string> {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key || /^your_|placeholder/i.test(key)) throw new Error('ANTHROPIC_API_KEY non configurata');

    let lastError = 'nessun modello disponibile';
    for (const model of CLAUDE_MODELS) {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({
                model, max_tokens: maxTokens, temperature,
                ...(system ? { system } : {}),
                messages: [{ role: 'user', content: prompt }],
            }),
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            lastError = `${model}: ${body?.error?.message || res.statusText}`;
            console.warn('[claude] modello non disponibile:', lastError);
            continue; // prova il successivo
        }
        const json = await res.json();
        const text = json?.content?.find((c: any) => c.type === 'text')?.text;
        if (text) return text;
        lastError = `${model}: risposta vuota`;
    }
    throw new Error(`Claude non ha risposto (${lastError})`);
}

/** Come askClaude, ma per risposte che devono essere un oggetto JSON (anche avvolto in ```json o con testo intorno). */
export async function askClaudeJson<T = any>(options: AskClaudeOptions): Promise<T> {
    const text = await askClaude({
        ...options,
        system: `${options.system ? options.system + '\n\n' : ''}Rispondi sempre e solo con un oggetto JSON valido, senza testo prima o dopo e senza recinti markdown.`,
    });
    const cleaned = text.replace(/```json\s*|```/gi, '').trim();
    try { return JSON.parse(cleaned); } catch { /* prova a ritagliare il primo oggetto */ }
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('Risposta AI non leggibile');
}
