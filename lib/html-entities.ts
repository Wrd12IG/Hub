// Decodifica le entità HTML che finiscono nei testi letti dai siti ("L&#039;OFFERTA" → "L'OFFERTA").
// Pura e senza dipendenze: usata sia dal server (lettura competitor) sia dall'interfaccia.

const NAMED: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    egrave: 'è', eacute: 'é', agrave: 'à', ograve: 'ò', ugrave: 'ù', igrave: 'ì',
    Egrave: 'È', Eacute: 'É', euro: '€', laquo: '«', raquo: '»',
    ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
};

export function decodeEntities(text: string): string {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
        if (body[0] === '#') {
            const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
            return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
        }
        return NAMED[body] ?? NAMED[body.toLowerCase()] ?? match;
    });
}
