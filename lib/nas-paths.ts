// Percorsi del NAS scritti a mano nelle descrizioni dei task
// ("smb://WRD-NAS._smb._tcp.local/Archivio/BRIXIA/FOTO &amp; VIDEO/2026/11_Novembre/…").
// Li riconosce per poterli mostrare a parte con un pulsante «Copia», invece che come testo grezzo.
// Pura e senza dipendenze.

import { decodeEntities } from './html-entities';

/** Trasforma l'HTML della descrizione in testo, una riga per paragrafo, con le entità decodificate. */
export function descriptionToText(html: string): string {
    if (!html) return '';
    const withBreaks = html
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\/\s*(p|div|li|h[1-6]|blockquote)\s*>/gi, '\n')
        .replace(/<[^>]*>/g, ' ');
    return decodeEntities(withBreaks)
        .split('\n')
        .map(line => line.replace(/[ \t ]+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
}

// Inizio di un percorso: smb://host/… oppure il nome Bonjour del NAS scritto senza smb://
const START = /(smb:\/\/[^\s/]+\/|[\w-]*NAS\._smb\._tcp\.local\/)/i;

/**
 * Estrae i percorsi NAS da una riga di testo.
 * Un percorso finisce alla prima parola dopo l'ultima «/» della riga
 * (i nomi delle cartelle possono contenere spazi, il testo che segue no),
 * oppure prima di un link http o di una freccia «-->».
 */
function pathsInLine(line: string): string[] {
    const out: string[] = [];
    let rest = line;
    while (true) {
        const m = START.exec(rest);
        if (!m || m.index === undefined) break;
        let tail = rest.slice(m.index);
        const stop = tail.slice(m[0].length).search(/\s(https?:\/\/|-->|—>)|\s(?=smb:\/\/)|\s(?=[\w-]*NAS\._smb\._tcp\.local\/)/i);
        let next = '';
        if (stop >= 0) {
            next = tail.slice(m[0].length + stop);
            tail = tail.slice(0, m[0].length + stop);
        }
        const lastSlash = tail.lastIndexOf('/');
        const afterSlash = tail.slice(lastSlash + 1);
        const firstWord = afterSlash.match(/^\S*/)?.[0] ?? '';
        const path = (tail.slice(0, lastSlash + 1) + firstWord).replace(/[.,;:)\]]+$/, '');
        if (path.length > m[0].length) out.push(path);
        rest = tail.slice(lastSlash + 1 + firstWord.length) + next;
    }
    return out;
}

/** Tutti i percorsi NAS distinti presenti nella descrizione (HTML o testo). */
export function extractNasPaths(description: string): string[] {
    const text = descriptionToText(description);
    const seen = new Set<string>();
    for (const line of text.split('\n')) {
        for (const p of pathsInLine(line)) seen.add(p);
    }
    return Array.from(seen);
}

/** Nome dell'ultima cartella, per un'etichetta compatta («NAS › NISSAN_JUKE»). */
export function nasFolderName(path: string): string {
    const parts = path.replace(/\/+$/, '').split('/');
    return parts[parts.length - 1] || path;
}

/** Testo breve per la card: entità decodificate e percorsi NAS sostituiti da «NAS › cartella». */
export function cardSnippet(description: string): string {
    const text = descriptionToText(description);
    const lines = text.split('\n').map(line => {
        let out = line;
        for (const p of pathsInLine(line)) out = out.replace(p, `NAS › ${nasFolderName(p)}`);
        return out;
    });
    return lines.join(' ').replace(/\s+/g, ' ').trim();
}
