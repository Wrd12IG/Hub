/** lib/client-scheda/types.ts — tipi della scheda cliente e del registro delle interazioni. */

export type Role = 'Amministratore' | 'Project Manager' | 'Collaboratore' | 'Cliente';

export const LOG_TYPES = ['telefonata', 'email', 'richiesta', 'riunione', 'altro'] as const;
export type LogType = (typeof LOG_TYPES)[number];
export const LOG_TYPE_LABEL: Record<LogType, string> = {
    telefonata: 'Telefonata', email: 'Email', richiesta: 'Richiesta', riunione: 'Riunione', altro: 'Altro',
};

export type ApprovalStatus = 'in_attesa' | 'approvata' | 'rifiutata';

export interface Approval {
    status: ApprovalStatus;
    requestedAt: string;
    decidedBy: string | null;
    decidedByName: string | null;
    decidedAt: string | null;
    comment: string | null;
}

export interface LogEntry {
    id: string;
    /** Messa dal server al momento del salvataggio: mai dal form. */
    createdAt: string;
    authorId: string;
    authorName: string;
    type: LogType;
    text: string;
    approval: Approval | null;
}

export interface StaffUser {
    id: string;
    name: string;
    email?: string;
    role?: Role;
    status?: 'Attivo' | 'Inattivo';
}

/** I campi del cliente che servono ai controlli d'accesso. */
export interface ClientAssignees {
    managedBy?: string[];
    socialManagerId?: string;
    backupManagerId?: string;
}

export interface AbsenceLike {
    userId: string;
    status: string;
    startDate: string;
    endDate: string;
}
