/**
 * lib/assignments/match.ts
 *
 * Abbina i nomi del foglio ai clienti e agli utenti della hub. Mai in silenzio: ogni abbinamento dice quanto è sicuro, e i casi dubbi
 * (nessuna corrispondenza, più candidati) vanno scelti da una persona.
 */
import type { AssignClient, AssignUser } from './model';

const STOP = new Set(['srl', 'spa', 'snc', 'sas', 's', 'r', 'l', 'p', 'a', 'di', 'e', 'del', 'della', 'the', 'and']);

/** Minuscolo, senza accenti né punteggiatura, a parole; toglie le sigle societarie (S.R.L., S.P.A. …). */
export function tokens(s: string): string[] {
    return (s || '')
        .normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
        .filter((t) => t && !STOP.has(t));
}

export type MatchStatus = 'esatto' | 'probabile' | 'ambiguo' | 'nessuno';
export interface Match<T> { status: MatchStatus; candidates: T[] }

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((t) => b.includes(t));
const subset = (a: string[], b: string[]) => a.length > 0 && a.every((t) => b.includes(t));

export function matchClient(sheetName: string, clients: AssignClient[]): Match<AssignClient> {
    const t = tokens(sheetName);
    if (t.length === 0) return { status: 'nessuno', candidates: [] };
    const exact = clients.filter((c) => sameSet(tokens(c.name), t));
    if (exact.length === 1) return { status: 'esatto', candidates: exact };
    if (exact.length > 1) return { status: 'ambiguo', candidates: exact };
    // Il nome del foglio è abbreviato («Help» → «MIMMO DORMIO … HELP COMPUTER») o più lungo («Atlantis / Oregon» → «ATLANTIS»)
    const loose = clients.filter((c) => { const ct = tokens(c.name); return subset(t, ct) || subset(ct, t); });
    if (loose.length === 1) return { status: 'probabile', candidates: loose };
    return { status: loose.length > 1 ? 'ambiguo' : 'nessuno', candidates: loose };
}

/** Per nome di battesimo (o nome e cognome): uno solo = abbinato; più persone con lo stesso nome = ambiguo, lo sceglie una persona. */
export function matchUser(sheetName: string, users: AssignUser[]): Match<AssignUser> {
    const t = tokens(sheetName);
    const active = users.filter((u) => u.role !== 'Cliente' && u.status !== 'Inattivo');
    if (t.length === 0) return { status: 'nessuno', candidates: [] };
    const hits = active.filter((u) => subset(t, tokens(u.name)));
    if (hits.length === 1) return { status: t.length > 1 ? 'esatto' : 'probabile', candidates: hits };
    return { status: hits.length > 1 ? 'ambiguo' : 'nessuno', candidates: hits };
}
