/**
 * lib/site-monitor/types.ts
 *
 * Monitor sito: tipi condivisi dai rilevatori. I rilevatori sono funzioni PURE: ricevono il contenuto di una pagina (già letto da
 * chi li chiama) e restituiscono problemi. Non leggono la rete, non scrivono nel database e non spendono crediti.
 */

export type FindingType =
    | 'http_error'        // la pagina risponde 4xx/5xx o non risponde
    | 'broken_link'       // un link della pagina porta a una pagina che non esiste
    | 'redirect_chain'    // un link passa da una catena di rimandi
    | 'empty_page'        // pagina quasi senza testo
    | 'expired_content'   // offerta, evento o promozione con una data già passata
    | 'stale_copyright'   // anno del copyright fermo a un anno fa o più
    | 'stale_sitemap'     // la sitemap non viene aggiornata da molto
    | 'image_broken'      // un'immagine non si carica
    | 'image_no_alt'      // immagine senza testo alternativo
    | 'image_heavy';      // immagine molto pesante

export type Severity = 'bassa' | 'media' | 'alta';
export const SEVERITY_ORDER: Record<Severity, number> = { bassa: 1, media: 2, alta: 3 };

export type Confidence = 'bassa' | 'media' | 'alta';

export interface Finding {
    type: FindingType;
    severity: Severity;
    /** La pagina (o, per i problemi di tutto il sito, la home) a cui il problema si riferisce. */
    url: string;
    /** Ciò che identifica il problema e non cambia da una scansione all'altra (la data scaduta, l'immagine, il link). Serve all'impronta. */
    key: string;
    /** Un brano della pagina che mostra il problema, al massimo 300 caratteri. Mai pagine intere. */
    evidence: string;
    confidence: Confidence;
}

/** Una pagina letta: l'indirizzo finale, il codice di risposta e il suo HTML. */
export interface PageData {
    url: string;
    status: number;
    html: string;
    /** Errore di rete (timeout, DNS…) quando la pagina non si è potuta leggere. */
    error?: string;
}

export interface ImageRef {
    src: string;
    /** null = l'attributo alt manca; '' = alt vuoto voluto (immagine decorativa, va bene). */
    alt: string | null;
}

/** L'esito di un controllo diretto su un indirizzo (link o immagine). */
export interface UrlCheck {
    url: string;
    status: number;
    /** Quante volte è stato rimandato prima della risposta. */
    hops?: number;
    bytes?: number;
    error?: string;
}
