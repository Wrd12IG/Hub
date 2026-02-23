/**
 * Server-side validation schemas using Zod
 * These should be used in server actions to validate incoming data
 */

import { z } from 'zod';

// Task validation schema
export const taskSchema = z.object({
    title: z.string().min(2, 'Il titolo deve essere di almeno 2 caratteri').max(200, 'Il titolo non può superare 200 caratteri'),
    description: z.string().max(5000, 'La descrizione non può superare 5000 caratteri').optional().nullable(),
    clientId: z.string().min(1, 'Il cliente è obbligatorio'),
    projectId: z.string().optional().nullable(),
    assignedUserId: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    priority: z.enum(['Bassa', 'Media', 'Alta', 'Critica']),
    status: z.enum(['Da Fare', 'In Lavorazione', 'In Approvazione', 'In Approvazione Cliente', 'Approvato', 'Annullato']),
    estimatedDuration: z.number().min(0, 'La durata stimata non può essere negativa').optional(),
    activityType: z.string().optional().nullable(),
    attachments: z.array(z.object({
        url: z.string().url('URL allegato non valido'),
        filename: z.string(),
        date: z.string().optional(),
        userId: z.string().optional(),
        version: z.number().optional(),
        documentType: z.string().optional(),
    })).optional(),
    dependencies: z.array(z.string()).optional(),
    requiresTwoStepApproval: z.boolean().optional(),
    skipAttachmentOnApproval: z.boolean().optional(),
});

export type TaskInput = z.infer<typeof taskSchema>;

// Project validation schema
export const projectSchema = z.object({
    name: z.string().min(2, 'Il nome deve essere di almeno 2 caratteri').max(200, 'Il nome non può superare 200 caratteri'),
    description: z.string().max(5000, 'La descrizione non può superare 5000 caratteri').optional().nullable(),
    clientId: z.string().min(1, 'Il cliente è obbligatorio'),
    teamLeaderId: z.string().optional().nullable(),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    status: z.enum(['Da Iniziare', 'In Corso', 'In Pausa', 'Completato', 'Annullato']),
    budget: z.number().min(0, 'Il budget non può essere negativo').optional(),
    priority: z.enum(['Bassa', 'Media', 'Alta', 'Critica']).optional(),
});

export type ProjectInput = z.infer<typeof projectSchema>;

// User validation schema
export const userSchema = z.object({
    name: z.string().min(2, 'Il nome deve essere di almeno 2 caratteri').max(100, 'Il nome non può superare 100 caratteri'),
    email: z.string().email('Email non valida'),
    role: z.enum(['Amministratore', 'Project Manager', 'Collaboratore', 'Cliente']),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Colore non valido (usa formato #RRGGBB)').optional(),
    hourlyRate: z.number().min(0, 'La tariffa oraria non può essere negativa').optional(),
    skills: z.array(z.string()).optional(),
});

export type UserInput = z.infer<typeof userSchema>;

// Client validation schema
export const clientSchema = z.object({
    name: z.string().min(2, 'Il nome deve essere di almeno 2 caratteri').max(100, 'Il nome non può superare 100 caratteri'),
    email: z.string().email('Email non valida').optional().nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Colore non valido').optional(),
    industry: z.string().optional().nullable(),
    notes: z.string().max(2000, 'Le note non possono superare 2000 caratteri').optional().nullable(),
});

export type ClientInput = z.infer<typeof clientSchema>;

// Brief validation schema
export const briefSchema = z.object({
    title: z.string().min(2, 'Il titolo deve essere di almeno 2 caratteri'),
    clientId: z.string().min(1, 'Il cliente è obbligatorio'),
    description: z.string().optional().nullable(),
    objectives: z.string().optional().nullable(),
    targetAudience: z.string().optional().nullable(),
    deadline: z.string().optional().nullable(),
    status: z.enum(['Bozza', 'In Revisione', 'Approvato', 'Completato', 'Annullato']),
    attachments: z.array(z.object({
        url: z.string().url(),
        filename: z.string(),
    })).optional(),
});

export type BriefInput = z.infer<typeof briefSchema>;

// Absence validation schema
export const absenceSchema = z.object({
    userId: z.string().min(1, 'L\'utente è obbligatorio'),
    startDate: z.string().min(1, 'La data di inizio è obbligatoria'),
    endDate: z.string().min(1, 'La data di fine è obbligatoria'),
    type: z.enum(['Ferie', 'Malattia', 'Permesso', 'Smart Working', 'Altro']),
    reason: z.string().max(500, 'Il motivo non può superare 500 caratteri').optional().nullable(),
    status: z.enum(['In Attesa', 'Approvata', 'Rifiutata']),
}).refine(data => {
    if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
}, {
    message: 'La data di inizio deve essere precedente alla data di fine',
    path: ['endDate'],
});

export type AbsenceInput = z.infer<typeof absenceSchema>;

// Activity Type validation schema
export const activityTypeSchema = z.object({
    name: z.string().min(2, 'Il nome deve essere di almeno 2 caratteri'),
    hourlyRate: z.number().min(0, 'La tariffa oraria non può essere negativa'),
    description: z.string().optional().nullable(),
    color: z.string().optional(),
    hasDeadlineTask: z.boolean().optional(),
});

export type ActivityTypeInput = z.infer<typeof activityTypeSchema>;

// File upload validation
export const fileUploadSchema = z.object({
    filename: z.string().min(1, 'Nome file obbligatorio'),
    size: z.number().max(50 * 1024 * 1024, 'Il file non può superare 50MB'), // 50MB max
    type: z.string(),
}).refine(data => {
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'application/pdf',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv',
        'application/zip', 'application/x-rar-compressed',
        'video/mp4', 'video/quicktime',
        'audio/mpeg', 'audio/wav',
    ];
    return allowedTypes.includes(data.type);
}, {
    message: 'Tipo di file non supportato',
    path: ['type'],
});

// Validation helper function
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: z.ZodError } {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
}

// Format Zod errors for display
export function formatZodErrors(errors: z.ZodError<unknown>): Record<string, string> {
    const formatted: Record<string, string> = {};
    errors.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!formatted[path]) {
            formatted[path] = issue.message;
        }
    });
    return formatted;
}

// Get first error message
export function getFirstZodError(errors: z.ZodError<unknown>): string {
    return errors.issues[0]?.message || 'Errore di validazione';
}
