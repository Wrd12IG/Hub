/**
 * lib/client-brief.ts
 *
 * Il brief di richiesta lavorazione inviato dal cliente: validazione dell'input e documento da salvare. Pura.
 * Il cliente compila poche cose; il team completa (servizi, budget, stato) quando lo prende in carico.
 */
import type { Brief } from './data';

export const TITLE_MAX = 120;
export const TEXT_MAX = 4000;

export interface ClientBriefInput { title: string; request: string; deadline?: string; references?: string }

export function parseClientBrief(body: any): { ok: true; value: ClientBriefInput } | { ok: false; error: string } {
    const title = typeof body?.title === 'string' ? body.title.trim().slice(0, TITLE_MAX) : '';
    const request = typeof body?.request === 'string' ? body.request.trim().slice(0, TEXT_MAX) : '';
    if (!title) return { ok: false, error: 'Dai un titolo alla richiesta' };
    if (!request) return { ok: false, error: 'Descrivi cosa ti serve' };
    const rawDeadline = typeof body?.deadline === 'string' ? body.deadline.trim() : '';
    const deadline = /^\d{4}-\d{2}-\d{2}$/.test(rawDeadline) ? rawDeadline : undefined;
    const references = typeof body?.references === 'string' ? body.references.trim().slice(0, TEXT_MAX) || undefined : undefined;
    return { ok: true, value: { title, request, deadline, references } };
}

export function buildClientBrief(input: ClientBriefInput, ctx: { clientId: string; clientName: string; userId: string; userName: string; now: Date }): Omit<Brief, 'id'> {
    return {
        clientId: ctx.clientId,
        projectName: ctx.clientName,
        title: input.title,
        contactPerson: ctx.userName,
        mainObjective: input.request,
        description: input.request,
        ...(input.deadline ? { deadline: input.deadline } : {}),
        ...(input.references ? { references: input.references } : {}),
        selectedServiceIds: [],
        status: 'Inviato',
        createdAt: ctx.now.toISOString(),
        createdBy: ctx.userId,
    };
}

/** Quello che il cliente vede di un suo brief. */
export function toClientBriefItem(b: Brief) {
    return { id: b.id, title: b.title, status: b.status, deadline: b.deadline || null, createdAt: b.createdAt || null, request: b.mainObjective || '' };
}
