// Le voci dell'audit SEO vengono da Lighthouse in inglese: qui le più comuni diventano italiane. Quelle che non si
// conoscono restano com'erano (meglio l'inglese corretto di una traduzione inventata).

const TITLES: [RegExp, string][] = [
    [/^render-blocking requests$/i, 'Richieste che rallentano la comparsa della pagina'],
    [/^eliminate render-blocking resources$/i, 'Risorse che rallentano la comparsa della pagina'],
    [/^network dependency tree$/i, 'Catena di richieste di rete troppo lunga'],
    [/^reduce unused css$/i, 'CSS inutilizzato da ridurre'],
    [/^reduce unused javascript$/i, 'JavaScript inutilizzato da ridurre'],
    [/^minify css$/i, 'CSS da comprimere'],
    [/^minify javascript$/i, 'JavaScript da comprimere'],
    [/^improve image delivery$/i, 'Immagini da ottimizzare'],
    [/^properly size images$/i, 'Immagini troppo grandi per lo spazio che occupano'],
    [/^serve images in next-gen formats$/i, 'Immagini in formati moderni (WebP/AVIF)'],
    [/^efficiently encode images$/i, 'Immagini da comprimere meglio'],
    [/^defer offscreen images$/i, 'Immagini fuori schermo da caricare dopo'],
    [/^avoid enormous network payloads$/i, 'Pagina troppo pesante da scaricare'],
    [/^use efficient cache lifetimes$/i, 'Memorizzazione in cache da migliorare'],
    [/^reduce initial server response time$/i, 'Risposta del server da velocizzare'],
    [/^document request latency$/i, 'Tempo di risposta della pagina principale'],
    [/^lcp request discovery$/i, 'Immagine principale scoperta troppo tardi'],
    [/^largest contentful paint element$/i, 'Elemento principale della pagina'],
    [/^layout shift culprits$/i, 'Elementi che spostano il contenuto durante il caricamento'],
    [/^forced reflow$/i, 'Ricalcoli forzati del layout'],
    [/^legacy javascript$/i, 'JavaScript datato'],
    [/^avoid serving legacy javascript to modern browsers$/i, 'JavaScript datato inviato ai browser moderni'],
    [/^reduce the impact of third-party code$/i, 'Codice di terze parti che pesa sulla pagina'],
    [/^avoid an excessive dom size$/i, 'Struttura della pagina troppo grande'],
    [/^dom size$/i, 'Dimensione della struttura della pagina'],
    [/^image elements do not have explicit width and height$/i, 'Immagini senza larghezza e altezza dichiarate'],
    [/^document does not have a meta description$/i, 'Manca la meta description'],
    [/^links do not have descriptive text$/i, 'Link senza testo descrittivo'],
    [/^page has successful http status code$/i, 'Codice di risposta della pagina'],
];

export function lighthouseTitleIt(title: string): string {
    const t = title.trim();
    return TITLES.find(([re]) => re.test(t))?.[1] ?? t;
}

/** «Est savings of 900 ms» → «Risparmio stimato: 900 ms»; il resto non si tocca. */
export function lighthouseDetailIt(detail?: string): string | undefined {
    if (!detail) return detail;
    return detail
        .replace(/Est(?:imated)? savings of ([\d.,]+\s?(?:ms|s|KiB|MiB|kB|MB))/gi, 'Risparmio stimato: $1')
        .replace(/^Root document took ([\d.,]+\s?(?:ms|s))$/i, '$1');
}

/** Il valore di una misura come lo scrive Lighthouse («Root document took 320 ms») ridotto al numero con l'unità. */
export function lighthouseValueIt(value: string): string {
    return lighthouseDetailIt(value) ?? value;
}
