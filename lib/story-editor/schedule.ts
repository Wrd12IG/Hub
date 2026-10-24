/**
 * lib/story-editor/schedule.ts
 *
 * Programmazione delle storie dall'editor: data e ora, e cosa fare dopo il salvataggio (solo bozza, chiedere
 * l'approvazione al cliente, approvare subito). Il Hub pubblica da solo solo i contenuti APPROVATI e con una DATA
 * (lib/publisher.ts: dueState): qui si spiega a chi salva cosa succederà, senza sorprese. Funzioni pure.
 */
import { combineDateAndTime } from '@/lib/publication-time';
import { dueState, scheduledInstant } from '@/lib/publisher';

export type AfterSave = 'draft' | 'request' | 'approve';

/** "yyyy-MM-dd" + "HH:mm" (anche vuoti) → valore da salvare nel contenuto ('' = nessuna data). */
export function publicationValue(day: string, time: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((day || '').trim());
    if (!m) return '';
    return combineDateAndTime(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), time);
}

/** Il valore salvato → campi del modulo ("yyyy-MM-dd" e "HH:mm"). */
export function splitPublicationValue(value?: string): { day: string; time: string } {
    if (!value) return { day: '', time: '' };
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { day: value, time: '' };
    const d = new Date(value);
    if (isNaN(d.getTime())) return { day: '', time: '' };
    const pad = (n: number) => String(n).padStart(2, '0');
    return { day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: value.includes('T') ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '' };
}

const fmt = (at: Date) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(at);

export interface ScheduleHint { text: string; tone: 'ok' | 'warn' }

/** Cosa succederà alla storia dopo il salvataggio, in una frase. */
export function describeSchedule(args: { publicationDate: string; afterSave: AfterSave; now?: Date }): ScheduleHint {
    const { publicationDate, afterSave } = args;
    const now = args.now ?? new Date();
    const at = scheduledInstant(publicationDate);
    const when = at ? fmt(at) : '';

    if (afterSave === 'draft') {
        return { tone: 'ok', text: at ? `Resta in bozza con la data ${when}. Non esce finché non viene approvata.` : 'Resta in bozza. Non esce finché non viene approvata e ha una data.' };
    }
    if (afterSave === 'request') {
        return at
            ? { tone: 'ok', text: `Va al cliente per l'approvazione. Se la approva, esce da sola ${when}.` }
            : { tone: 'warn', text: 'Va al cliente, ma senza una data non esce da sola dopo l\'approvazione: scegli giorno e ora, oppure usa «Pubblica ora» dal PED.' };
    }
    // approve
    if (!at) return { tone: 'warn', text: 'Approvata ma senza data: non esce da sola. Scegli giorno e ora, oppure usa «Pubblica ora» dal PED.' };
    const state = dueState({ status: 'Approvato', publicationDate }, now);
    if (state === 'not-yet') return { tone: 'ok', text: `Approvata: esce da sola ${when}.` };
    if (state === 'due') return { tone: 'warn', text: `La data (${when}) è già arrivata: esce entro pochi minuti, appena parte il controllo automatico.` };
    return { tone: 'warn', text: `La data (${when}) è passata da più di 3 giorni: non esce da sola. Scegli una data futura.` };
}
