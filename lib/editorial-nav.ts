/**
 * lib/editorial-nav.ts
 *
 * Le schede del Piano editoriale. Prima erano quattro pagine senza legame tra loro («Piano Editoriale», «Piano PED»,
 * «Importa Piano», le approvazioni) con nomi diversi; ora hanno una barra comune. Pura (nessun I/O).
 *
 *   Calendario   → il piano: tabella, kanban, calendario, gantt
 *   Genera con AI → propone settimana o mese (serve un cliente)
 *   Importa      → carica un file CSV
 *   Approvazioni → cosa aspetta il cliente e cosa ha rimandato indietro
 */

export type EditorialTabKey = 'calendario' | 'genera' | 'importa' | 'approvazioni';

export interface EditorialTab {
    key: EditorialTabKey;
    label: string;
    /** `null` = non disponibile senza un cliente scelto. */
    href: string | null;
    /** Perché non si può aprire, da mostrare come suggerimento. */
    hint?: string;
}

export function editorialTabs(clientId?: string | null): EditorialTab[] {
    const approvals = clientId ? `/editorial-plan/approvazioni?cliente=${encodeURIComponent(clientId)}` : '/editorial-plan/approvazioni';
    return [
        { key: 'calendario', label: 'Calendario', href: clientId ? `/clients/${clientId}/editorial-plan` : '/editorial-plan' },
        clientId
            ? { key: 'genera', label: 'Genera con AI', href: `/clients/${clientId}/ped-plan` }
            : { key: 'genera', label: 'Genera con AI', href: null, hint: 'Apri il piano di un cliente per generare i suoi contenuti' },
        { key: 'importa', label: 'Importa', href: '/import-editorial' },
        { key: 'approvazioni', label: 'Approvazioni', href: approvals },
    ];
}

/** Quale scheda è aperta, dall'indirizzo. `null` se la pagina non fa parte del Piano editoriale. */
export function activeEditorialTab(pathname: string): EditorialTabKey | null {
    const path = pathname.replace(/\/+$/, '');
    if (path === '/editorial-plan/approvazioni') return 'approvazioni';
    if (path === '/editorial-plan' || /^\/clients\/[^/]+\/editorial-plan$/.test(path)) return 'calendario';
    if (/^\/clients\/[^/]+\/ped-plan$/.test(path)) return 'genera';
    if (path === '/import-editorial') return 'importa';
    return null;
}
