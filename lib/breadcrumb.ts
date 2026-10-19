// Etichetta di un segmento dell'indirizzo nella barra in alto (briciole di pane).

const FIRESTORE_ID = /^[A-Za-z0-9]{20}$/;

/**
 * Dopo /clients/ il segmento è l'ID del cliente: si mostra il suo NOME. Se l'elenco clienti non è ancora caricato si
 * mostra «Cliente», mai il codice. Gli altri segmenti usano l'etichetta nota o il testo con i trattini tolti.
 */
export function segmentLabel(
    segment: string,
    previous: string | undefined,
    clientsById: Record<string, { name: string } | undefined>,
    labels: Record<string, string>,
): string {
    if (previous === 'clients') {
        const name = clientsById[segment]?.name;
        if (name) return name;
        if (FIRESTORE_ID.test(segment)) return 'Cliente';
    }
    return labels[segment] || segment.replace(/-/g, ' ');
}
