/**
 * lib/client-scheda/whitelist.ts
 *
 * Quello che la scheda mostra del cliente, costruito CAMPO PER CAMPO: un campo nuovo sul documento cliente non esce finché qualcuno
 * non lo aggiunge qui. Mai: budget, KPI, id degli account pubblicitari/analytics, token, costi, publicToken.
 * Le note stanno in clients/{id}/private/internal (insieme al budget): arrivano solo se chi legge ha il permesso finanziario.
 */
export interface SchedaClient {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    websiteUrl: string | null;
    social: Array<{ platform: string; url: string }>;
    notes: string | null;
    managers: string[];
    backupManager: string | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const isHttp = (v: string) => /^https?:\/\//i.test(v);

export function buildSchedaClient(
    id: string,
    raw: Record<string, unknown>,
    opts: { userNames: Record<string, string>; notes?: unknown; canSeeNotes: boolean },
): SchedaClient {
    const links = raw.socialLinks && typeof raw.socialLinks === 'object' ? (raw.socialLinks as Record<string, unknown>) : {};
    const social = Object.entries(links)
        .map(([platform, url]) => ({ platform, url: str(url) }))
        .filter((s): s is { platform: string; url: string } => !!s.url && isHttp(s.url));
    const nameOf = (uid: unknown) => (typeof uid === 'string' ? opts.userNames[uid] ?? null : null);
    const managerIds = [
        ...(Array.isArray(raw.managedBy) ? raw.managedBy : []),
        ...(raw.socialManagerId ? [raw.socialManagerId] : []),
    ];
    return {
        id,
        name: str(raw.name) ?? id,
        email: str(raw.email),
        phone: str(raw.phone),
        address: str(raw.address),
        websiteUrl: str(raw.websiteUrl),
        social,
        notes: opts.canSeeNotes ? str(opts.notes) : null,
        managers: Array.from(new Set(managerIds.map(nameOf).filter((n): n is string => !!n))),
        backupManager: nameOf(raw.backupManagerId),
    };
}
