import { NextRequest, NextResponse } from 'next/server';
import {
    runScheduledAutomations,
    generateWeeklyReport,
    checkDueSoonTasks,
    checkOverdueTasks,
    checkStuckTasks
} from '@/lib/automation-engine';
import { isCronRequest } from '@/lib/cron-auth';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';

// Tre controlli in parallelo, ognuno legge tutti i task e tutti gli utenti e
// manda le email in sequenza. Senza un tetto esplicito Vercel usa il default e
// uccide la richiesta a metà.
export const maxDuration = 60;

/**
 * Esegue le automazioni pianificate: promemoria sui task in scadenza, sui task
 * scaduti, rilevamento dei task fermi, report settimanale.
 *
 * ⚠️ Questo endpoint non è mai girato in produzione. Richiedeva un
 * `AUTOMATION_SECRET` che non era configurato, quindi la condizione
 * `!AUTOMATION_SECRET || secret !== AUTOMATION_SECRET` era sempre vera e ogni
 * chiamata tornava 401 — pulsante nell'admin compreso. E nessuna cron lo
 * chiamava. Un lavoro che non parte non produce errori: produce silenzio.
 *
 * Il segreto condiviso era anche la strada sbagliata: il pulsante nell'admin
 * lo leggeva da `NEXT_PUBLIC_AUTOMATION_SECRET`, che finisce nel bundle del
 * browser, con fallback su una stringa scritta nel codice. Farlo funzionare in
 * quel modo avrebbe reso l'endpoint chiamabile da chiunque legga il JS.
 *
 * Ora i due chiamanti legittimi si autenticano ognuno come ciò che è:
 * - la cron di Vercel, col CRON_SECRET già usato dalle altre quattro cron;
 * - il pulsante nell'admin, col token Firebase dell'utente, che deve essere
 *   staff.
 *
 * `AUTOMATION_SECRET` e `NEXT_PUBLIC_AUTOMATION_SECRET` non servono più e si
 * possono cancellare da Vercel.
 */

type AutomationType = 'all' | 'due_soon' | 'overdue' | 'stuck' | 'weekly_report';

async function run(type: string) {
    switch (type as AutomationType) {
        case 'all': return runScheduledAutomations();
        case 'due_soon': return checkDueSoonTasks();
        case 'overdue': return checkOverdueTasks();
        case 'stuck': return checkStuckTasks();
        case 'weekly_report': return generateWeeklyReport();
        default: return null;
    }
}

function ok(type: string, result: unknown) {
    return NextResponse.json({ success: true, type, result, executedAt: new Date().toISOString() });
}

function failed(error: unknown) {
    console.error('[automations] esecuzione fallita:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
}

export async function POST(request: NextRequest) {
    // Non è la cron → allora è una persona, e deve essere staff. Le
    // automazioni scrivono notifiche e mandano email a tutta la squadra.
    if (!isCronRequest(request)) {
        const auth = await verifyAuth(request);
        if (!auth) return unauthorizedResponse();
        const denied = await denyUnlessStaff(auth.uid);
        if (denied) return denied;
    }

    const type = request.nextUrl.searchParams.get('type') || 'all';
    try {
        const result = await run(type);
        if (result === null) {
            return NextResponse.json({ error: `Unknown automation type: ${type}` }, { status: 400 });
        }
        return ok(type, result);
    } catch (error) {
        return failed(error);
    }
}

/**
 * GET serve a due cose diverse, a seconda di chi chiama.
 *
 * Con le credenziali di cron esegue le automazioni: **Vercel Cron manda GET,
 * non POST**, quindi senza questo ramo la voce in vercel.json non farebbe
 * nulla. Senza credenziali resta l'health check di prima, che non espone dati.
 */
export async function GET(request: NextRequest) {
    if (!isCronRequest(request)) {
        return NextResponse.json({
            status: 'ok',
            message: 'Automation endpoint is active. Use POST to run automations.',
            availableTypes: ['all', 'due_soon', 'overdue', 'stuck', 'weekly_report'],
        });
    }

    const type = request.nextUrl.searchParams.get('type') || 'all';
    try {
        const result = await run(type);
        if (result === null) {
            return NextResponse.json({ error: `Unknown automation type: ${type}` }, { status: 400 });
        }
        console.log(`[automations] cron "${type}" completata:`, JSON.stringify(result));
        return ok(type, result);
    } catch (error) {
        return failed(error);
    }
}
