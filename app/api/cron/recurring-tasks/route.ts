/**
 * GET /api/cron/recurring-tasks
 *
 * Chiamata ogni mattina da GitHub Actions (ore 7:00 UTC = 8/9 ora italiana).
 * Legge i template attivi, controlla se devono girare oggi,
 * crea i task evitando duplicati, aggiorna lastRun + nextRunDate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { format, addDays, addWeeks, addMonths } from 'date-fns';

// ─── Tipi ────────────────────────────────────────────────────────────────────

interface RecurrenceConfig {
    type: 'daily' | 'weekly' | 'monthly' | 'trimestrale';
    time?: string;
    dayOfWeek?: number;   // 0=Dom, 1=Lun … 6=Sab
    weekOfMonth?: number; // 1–4
    dayOfMonth?: number;  // 1–31 (Nuovo)
    rotationMonth?: number; // 1, 2, 3 (Nuovo)
}

interface RecurringTaskDoc {
    id: string;
    title: string;
    description?: string;
    priority: string;
    clientId: string;
    projectId?: string;
    activityType?: string;
    estimatedDuration: number;
    assignedUserId?: string;
    recurrence: RecurrenceConfig;
    isActive: boolean;
    lastRun?: string;
    nextRunDate?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isWeeklyDue(dayOfWeek: number | undefined, today: Date): boolean {
    if (dayOfWeek === undefined) return false;
    return today.getDay() === dayOfWeek;
}

function isMonthlyDue(dayOfWeek: number | undefined, weekOfMonth: number | undefined, today: Date): boolean {
    if (dayOfWeek === undefined || weekOfMonth === undefined) return false;
    if (today.getDay() !== dayOfWeek) return false;
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    let count = 0;
    for (let d = new Date(firstOfMonth); d <= today; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === dayOfWeek) count++;
    }
    return count === weekOfMonth;
}

function isTrimestralDue(rotationMonth: number | undefined, today: Date): boolean {
    if (rotationMonth === undefined) return false;
    const currentMonth = today.getMonth() + 1; // 1-12
    return (currentMonth - rotationMonth) % 3 === 0;
}

function isDayOfMonthDue(dayOfMonth: number | undefined, today: Date): boolean {
    if (dayOfMonth === undefined) return false;
    
    // Controlla se oggi è il giorno pianificato
    const targetDate = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
    const targetDayOfWeek = targetDate.getDay(); // 0=Domenica, 6=Sabato
    
    // Se cade in settimana lavorativa, deve girare esattamente in quel giorno
    if (targetDayOfWeek !== 0 && targetDayOfWeek !== 6) {
        return today.getDate() === dayOfMonth;
    }
    
    // Se cade di Sabato, deve girare il Lunedì successivo (+2 giorni)
    if (targetDayOfWeek === 6) {
        const nextMonday = new Date(targetDate);
        nextMonday.setDate(targetDate.getDate() + 2);
        return today.getDate() === nextMonday.getDate() && today.getMonth() === nextMonday.getMonth();
    }
    
    // Se cade di Domenica, deve girare il Lunedì successivo (+1 giorno)
    if (targetDayOfWeek === 0) {
        const nextMonday = new Date(targetDate);
        nextMonday.setDate(targetDate.getDate() + 1);
        return today.getDate() === nextMonday.getDate() && today.getMonth() === nextMonday.getMonth();
    }
    
    return false;
}

function computeNextRunDate(recurrence: RecurrenceConfig, afterDate: Date): string {
    const { type, dayOfWeek, weekOfMonth, dayOfMonth } = recurrence;
    if (type === 'daily') return format(addDays(afterDate, 1), 'yyyy-MM-dd');
    if (type === 'weekly') {
        let next = addDays(afterDate, 1);
        for (let i = 0; i < 7; i++) {
            if (next.getDay() === (dayOfWeek ?? 1)) return format(next, 'yyyy-MM-dd');
            next = addDays(next, 1);
        }
    }
    if (type === 'trimestrale' || type === 'monthly') {
        if (dayOfMonth !== undefined) {
            // Ritorna una stima del prossimo mese/giorno
            const nextMonth = addMonths(afterDate, type === 'trimestrale' ? 3 : 1);
            return format(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), dayOfMonth), 'yyyy-MM-dd');
        }
        const nextMonth = addMonths(new Date(afterDate.getFullYear(), afterDate.getMonth(), 1), 1);
        let count = 0;
        const loopEnd = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 1);
        for (let d = new Date(nextMonth); d < loopEnd; d.setDate(d.getDate() + 1)) {
            if (d.getDay() === (dayOfWeek ?? 1)) {
                count++;
                if (count === (weekOfMonth ?? 1)) return format(d, 'yyyy-MM-dd');
            }
        }
    }
    return format(addDays(afterDate, 1), 'yyyy-MM-dd');
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
    // Auth
    const cronSecret = process.env.CRON_SECRET;
    const requestSecret = request.headers.get('x-cron-secret');
    const host = request.headers.get('host') || '';
    const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');

    if (cronSecret && requestSecret !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!cronSecret && !isLocalhost) {
        return NextResponse.json({ error: 'Unauthorized. Configura CRON_SECRET.' }, { status: 401 });
    }

    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const isWeekend = today.getDay() === 0 || today.getDay() === 6;

    // Leggi template attivi
    let templates: RecurringTaskDoc[] = [];
    try {
        const snap = await adminDb
            .collection('recurringTasks')
            .where('isActive', '==', true)
            .get();
        templates = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RecurringTaskDoc));
    } catch (error) {
        console.error('[recurring-tasks-cron] Errore Firestore:', error);
        return NextResponse.json({ error: 'Firestore error', details: String(error) }, { status: 500 });
    }

    const results: Array<{
        templateId: string; title: string;
        action: 'created' | 'skipped_duplicate' | 'skipped_not_due' | 'skipped_weekend' | 'error';
        reason?: string; taskId?: string;
    }> = [];

    for (const template of templates) {
        const { recurrence } = template;

        // Salta weekend
        if (isWeekend) {
            results.push({ templateId: template.id, title: template.title, action: 'skipped_weekend' });
            continue;
        }

        // Controlla se è il giorno giusto
        let isDue = false;
        if (recurrence.type === 'daily') {
            isDue = true;
        } else if (recurrence.type === 'weekly') {
            isDue = isWeeklyDue(recurrence.dayOfWeek, today);
        } else if (recurrence.type === 'trimestrale') {
            const isMonthDue = isTrimestralDue(recurrence.rotationMonth, today);
            const isDayDue = isDayOfMonthDue(recurrence.dayOfMonth, today);
            isDue = isMonthDue && isDayDue;
        } else if (recurrence.type === 'monthly') {
            if (recurrence.dayOfMonth !== undefined) {
                isDue = isDayOfMonthDue(recurrence.dayOfMonth, today);
            } else {
                isDue = isMonthlyDue(recurrence.dayOfWeek, recurrence.weekOfMonth, today);
            }
        }

        if (!isDue) {
            results.push({ templateId: template.id, title: template.title, action: 'skipped_not_due', reason: `Non è il giorno per ${recurrence.type}` });
            continue;
        }

        // Deduplicazione: cerca task già creato oggi per questo template
        try {
            const dupSnap = await adminDb.collection('tasks')
                .where('recurringTaskId', '==', template.id)
                .where('dueDate', '>=', `${todayStr}T00:00:00.000Z`)
                .where('dueDate', '<=', `${todayStr}T23:59:59.999Z`)
                .limit(1).get();

            if (!dupSnap.empty) {
                results.push({ templateId: template.id, title: template.title, action: 'skipped_duplicate', reason: `Già creato: ${dupSnap.docs[0].id}` });
                continue;
            }
        } catch (err) {
            console.warn(`[recurring-tasks-cron] Check duplicato fallito per ${template.id}:`, err);
        }

        // Crea il task
        try {
            const dueDate = new Date(`${todayStr}T${recurrence.time || '09:00'}:00.000`);
            const newTask = {
                title: template.title,
                description: template.description || '',
                priority: template.priority,
                clientId: template.clientId,
                projectId: template.projectId || null,
                activityType: template.activityType || null,
                estimatedDuration: template.estimatedDuration,
                assignedUserId: template.assignedUserId || null,
                status: 'Da Fare',
                dueDate: dueDate.toISOString(),
                timeSpent: 0,
                actualDuration: 0,
                attachments: [],
                comments: [],
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                createdBy: 'cron',
                recurringTaskId: template.id,
            };

            const taskRef = await adminDb.collection('tasks').add(newTask);
            const nextRun = computeNextRunDate(recurrence, today);

            await adminDb.collection('recurringTasks').doc(template.id).update({
                lastRun: today.toISOString(),
                nextRunDate: nextRun,
                updatedAt: Timestamp.now(),
            });

            results.push({ templateId: template.id, title: template.title, action: 'created', taskId: taskRef.id });
        } catch (error) {
            console.error(`[recurring-tasks-cron] Errore creazione per ${template.id}:`, error);
            results.push({ templateId: template.id, title: template.title, action: 'error', reason: String(error) });
        }
    }

    const created = results.filter(r => r.action === 'created').length;
    const skipped = results.filter(r => r.action !== 'created' && r.action !== 'error').length;
    const errors  = results.filter(r => r.action === 'error').length;

    return NextResponse.json({
        success: true,
        executedAt: new Date().toISOString(),
        date: todayStr,
        summary: { total: templates.length, created, skipped, errors },
        results,
    });
}
