/**
 * lib/client-area.ts
 *
 * Le pagine che l'accesso «Cliente» può aprire: tutte del proprio cliente. Pura (nessun I/O), così si prova con un test.
 * Il layout la usa sia per rimandare chi esce dall'area, sia per NON mostrare lo spinner di caricamento sulle pagine
 * consentite (prima lo spinner compariva ovunque tranne che sui risultati, e PED e Brief restavano bloccati).
 */

/** Sezioni del cliente oltre ai risultati: piano editoriale (PED) e brief. */
export const CLIENT_AREA_SECTIONS = ['/editorial-plan', '/briefs'] as const;

export function isClientAreaPath(pathname: string, clientId: string): boolean {
    const home = `/clients/${clientId}`;
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    return path === home || CLIENT_AREA_SECTIONS.some((p) => path === `${home}${p}` || path.startsWith(`${home}${p}/`));
}
