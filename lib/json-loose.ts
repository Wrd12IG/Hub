// Lettura tollerante del JSON che scrive un modello. Con la ricerca web le risposte arrivano con a capo veri dentro
// le stringhe ("Bad control character in string literal", visto in produzione il 19/10/2026) o con testo attorno.

/** Dentro le stringhe JSON i caratteri di controllo vanno scritti come escape: li convertiamo, il resto resta com'è. */
export function escapeControlCharsInStrings(text: string): string {
    let out = '';
    let inString = false;
    let escaped = false;
    for (const ch of text) {
        if (inString) {
            if (escaped) { out += ch; escaped = false; continue; }
            if (ch === '\\') { out += ch; escaped = true; continue; }
            if (ch === '"') { inString = false; out += ch; continue; }
            const code = ch.charCodeAt(0);
            if (code < 0x20) {
                out += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : ch === '\t' ? '\\t' : `\\u${code.toString(16).padStart(4, '0')}`;
                continue;
            }
            out += ch;
        } else {
            if (ch === '"') inString = true;
            out += ch;
        }
    }
    return out;
}

/** Il primo oggetto { ... } bilanciato che inizia a `from` (le graffe dentro le stringhe non contano), o null. */
function balancedObject(text: string, from: number): string | null {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = from; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') inString = true;
        else if (ch === '{') depth++;
        else if (ch === '}' && --depth === 0) return text.slice(from, i + 1);
    }
    return null;
}

const tryParse = (s: string): any | undefined => {
    try { return JSON.parse(s); } catch { return undefined; }
};

/**
 * Prova, nell'ordine: il testo intero, poi con i caratteri di controllo sistemati, poi ogni oggetto bilanciato che
 * compare nel testo (anche con testo prima e dopo, o più oggetti: vince il primo che si legge). Lancia se nessuno va.
 */
export function parseJsonLoose(text: string): any {
    const cleaned = text.replace(/```json\s*|```/gi, '').trim();
    for (const candidate of [cleaned, escapeControlCharsInStrings(cleaned)]) {
        const v = tryParse(candidate);
        if (v !== undefined) return v;
    }
    for (let at = cleaned.indexOf('{'); at >= 0; at = cleaned.indexOf('{', at + 1)) {
        const obj = balancedObject(cleaned, at);
        if (!obj) continue;
        const v = tryParse(obj) ?? tryParse(escapeControlCharsInStrings(obj));
        if (v !== undefined && v !== null && typeof v === 'object') return v;
    }
    throw new Error('Risposta AI non leggibile');
}
