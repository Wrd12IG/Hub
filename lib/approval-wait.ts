// Attesa di un task in approvazione: quanti giorni, quanto è grave, chi deve muoversi.
// Pura: usata dalla card del kanban e testabile senza interfaccia.

export type WaitTone = 'fresh' | 'warning' | 'late';

/** 0–1 giorni normale, 2 giorni attenzione, da 3 in su in ritardo. */
export function approvalWaitTone(days: number): WaitTone {
    if (days >= 3) return 'late';
    if (days >= 2) return 'warning';
    return 'fresh';
}

/** Etichetta breve: «oggi», «1 g», «25 gg». */
export function approvalWaitLabel(days: number): string {
    if (days < 1) return 'oggi';
    return days === 1 ? '1 g' : `${days} gg`;
}

/**
 * Chi deve approvare un task «In Approvazione»: il primo responsabile del cliente,
 * se c'è, altrimenti il PM di backup. Per «In Approvazione Cliente» tocca al cliente.
 */
export function approverName(
    status: string,
    client: { name?: string; managedBy?: string[]; backupManagerId?: string | null } | undefined,
    usersById: Record<string, { name?: string } | undefined>,
): string | null {
    if (status === 'In Approvazione Cliente') return client?.name ? `cliente ${client.name}` : 'il cliente';
    if (status !== 'In Approvazione' || !client) return null;
    const id = client.managedBy?.find(u => usersById[u]) ?? (client.backupManagerId && usersById[client.backupManagerId] ? client.backupManagerId : undefined);
    const full = id ? usersById[id]?.name : undefined;
    return full ? full.split(' ')[0] : null;
}
