// Formattazione dei dati Search Console per le tabelle: nessuna dipendenza da React.

/** L'URL intero rende la tabella illeggibile: basta il percorso ("/" per la home). */
export function pagePath(url: string): string {
    try {
        const u = new URL(url);
        return (u.pathname || '/') + (u.search || '');
    } catch {
        return url;
    }
}

/** Il CTR di Google è una frazione (0,0105): in tabella si legge in percentuale. */
export function ctrPct(ctr: number): string {
    return `${(ctr * 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
