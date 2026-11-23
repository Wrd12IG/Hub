/**
 * lib/assignments/plan.ts
 *
 * Dal foglio e dalle scelte fatte in anteprima al piano di modifiche. Pura: non scrive niente; il piano si mostra prima e lo applica la route.
 */
import type { AssignClient, AssignUser, SheetRow } from './model';

export interface PlanInput {
    rows: SheetRow[];
    clients: AssignClient[];
    users: AssignUser[];
    /** Nome del foglio (es. «Valeria») → uid scelto. */
    userChoice: Record<string, string>;
    /** Riga del foglio → id cliente scelto; null = «salta questa riga». */
    clientChoice: Record<number, string | null>;
}

export interface ClientChange { clientId: string; clientName: string; referenteId: string; peso: number | null; direzionale: boolean | null; before: { referenteId: string | null; peso: number | null; direzionale: boolean | null } }
export interface UserChange { userId: string; userName: string; backupUserId: string; before: string | null }
export interface Plan { clientChanges: ClientChange[]; userChanges: UserChange[]; problems: string[]; skippedRows: number[] }

export function buildPlan(input: PlanInput): Plan {
    const { rows, clients, users, userChoice, clientChoice } = input;
    const clientById = new Map(clients.map((c) => [c.id, c]));
    const userById = new Map(users.map((u) => [u.id, u]));
    const problems: string[] = [];
    const skippedRows: number[] = [];
    const clientChanges: ClientChange[] = [];
    const seen = new Map<string, number>();

    const uidFor = (name: string): string | null => {
        const uid = userChoice[name];
        if (!uid) { problems.push(`Manca la scelta della persona per «${name}».`); return null; }
        const u = userById.get(uid);
        if (!u || u.role === 'Cliente' || u.status === 'Inattivo') { problems.push(`«${name}»: l'utente scelto non è uno staff attivo.`); return null; }
        return uid;
    };

    for (const r of rows) {
        const chosen = clientChoice[r.row];
        if (chosen === null || chosen === undefined) { skippedRows.push(r.row); continue; }
        const c = clientById.get(chosen);
        if (!c) { problems.push(`Riga ${r.row} («${r.clientName}»): il cliente scelto non esiste.`); continue; }
        const ref = uidFor(r.referente);
        if (!ref) continue;
        if (seen.has(c.id)) { problems.push(`Il cliente «${c.name}» compare due volte (righe ${seen.get(c.id)} e ${r.row}): un solo referente per cliente.`); continue; }
        seen.set(c.id, r.row);
        clientChanges.push({
            clientId: c.id, clientName: c.name, referenteId: ref, peso: r.peso, direzionale: r.direzionale,
            before: { referenteId: c.referenteId ?? null, peso: c.peso ?? null, direzionale: c.direzionale ?? null },
        });
    }

    // Backup per utente: ogni referente deve avere un solo backup, e non se stesso.
    const backupOf = new Map<string, Set<string>>();
    for (const r of rows) {
        if (!r.backup || skippedRows.includes(r.row)) continue;
        const set = backupOf.get(r.referente) || new Set<string>();
        set.add(r.backup);
        backupOf.set(r.referente, set);
    }
    const userChanges: UserChange[] = [];
    for (const [refName, set] of Array.from(backupOf)) {
        if (set.size > 1) { problems.push(`«${refName}» ha più di un backup nel foglio (${Array.from(set).join(', ')}): ne serve uno solo.`); continue; }
        const uid = userChoice[refName];
        const buid = userChoice[Array.from(set)[0]];
        if (!uid || !buid) { problems.push(`Backup di «${refName}»: manca la scelta della persona.`); continue; }
        if (uid === buid) { problems.push(`«${refName}» non può essere il backup di se stesso.`); continue; }
        const u = userById.get(uid);
        const b = userById.get(buid);
        if (!u || !b || b.role === 'Cliente' || b.status === 'Inattivo') { problems.push(`Backup di «${refName}»: l'utente scelto non è uno staff attivo.`); continue; }
        userChanges.push({ userId: uid, userName: u.name.trim(), backupUserId: buid, before: (u as AssignUser & { backupUserId?: string | null }).backupUserId ?? null });
    }
    return { clientChanges, userChanges, problems, skippedRows };
}
