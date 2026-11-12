/**
 * Pagine che un Project Manager vede sempre, senza bisogno della spunta in Admin → Permessi.
 * Le API dei report cliente e le regole Firestore sono già aperte a tutto lo staff: qui si decide solo
 * la voce di menu. Il menu e la tabella Permessi leggono entrambi da qui, così non si contraddicono.
 */
export const PAGES_ALWAYS_FOR_PM: readonly string[] = ['/clients'];

export function isProjectManagerRole(role: string | undefined | null): boolean {
    const r = (role || '').trim().toLowerCase();
    return (r.includes('project') && r.includes('manager')) || r === 'pm';
}
