'use server';

// ─── MIGRAZIONE: usa Firebase Admin SDK invece del client SDK ─────────────────
// Il client SDK richiede un utente autenticato — non funziona nei cron job.
// L'Admin SDK bypassa le security rules e funziona in qualsiasi contesto server.
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { differenceInHours, differenceInDays, parseISO, format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { it } from 'date-fns/locale';
import type { Task, Project, Brief, User } from '@/lib/data';
import { sendEmailServerAction } from '@/lib/email-server';

// Helper to send automation emails
async function sendAutomationEmail(params: { to: string; toName?: string; subject: string; body: string }) {
    try {
        await sendEmailServerAction(
            params.to,
            params.toName || '',
            params.subject,
            `<div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #667eea;">W[r]Digital HUB</h2>
                <div style="white-space: pre-line;">${params.body}</div>
            </div>`,
            'W[r]Digital HUB',
            'noreply@wrdigital.it'
        );
    } catch (error) {
        console.error('Error sending automation email:', error);
    }
}

// Re-export types
export type { AutomationRule, AutomationLog } from './automation-types';

// ─── Helper: converti doc Firestore Admin in oggetto con id ──────────────────
function docToObj<T>(doc: FirebaseFirestore.DocumentSnapshot): T {
    const data = doc.data() || {};
    // Converti Timestamp → ISO string per compatibilità con i tipi esistenti
    const converted: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
        if (val && typeof val === 'object' && typeof (val as any).toDate === 'function') {
            converted[key] = (val as any).toDate().toISOString();
        } else {
            converted[key] = val;
        }
    }
    return { id: doc.id, ...converted } as T;
}

// ============================================
// AUTOMATION ENGINE
// ============================================

/**
 * Check tasks that are due soon (within 24 hours) and send notifications
 */
export async function checkDueSoonTasks(): Promise<{ processed: number; notifications: number }> {
    const now = new Date();
    let processed = 0;
    let notifications = 0;

    try {
        const [tasksSnap, usersSnap] = await Promise.all([
            adminDb.collection('tasks').get(),
            adminDb.collection('users').get(),
        ]);

        const users = usersSnap.docs.reduce((acc, doc) => {
            acc[doc.id] = docToObj<User>(doc);
            return acc;
        }, {} as Record<string, User>);

        const batch = adminDb.batch();

        for (const taskDoc of tasksSnap.docs) {
            const task = docToObj<Task>(taskDoc);

            if (task.status === 'Approvato' || task.status === 'Annullato' || task.status === 'In Approvazione Cliente') continue;
            if (!task.dueDate) continue;

            const dueDate = parseISO(task.dueDate);
            const hoursUntilDue = differenceInHours(dueDate, now);

            if (hoursUntilDue > 0 && hoursUntilDue <= 24) {
                const existingSnap = await adminDb.collection('notifications')
                    .where('taskId', '==', task.id)
                    .where('type', '==', 'task_due_soon')
                    .limit(1).get();

                if (existingSnap.empty && task.assignedUserId) {
                    const user = users[task.assignedUserId];
                    if (user) {
                        const notifRef = adminDb.collection('notifications').doc();
                        batch.set(notifRef, {
                            userId: task.assignedUserId,
                            title: '⏰ Task in scadenza!',
                            message: `Il task "${task.title}" scade tra ${hoursUntilDue} ore`,
                            type: 'task_due_soon',
                            taskId: task.id,
                            link: `/tasks?taskId=${task.id}`,
                            isRead: false,
                            createdAt: new Date().toISOString(),
                        });
                        notifications++;

                        if (user.email) {
                            await sendAutomationEmail({
                                to: user.email,
                                toName: user.name,
                                subject: `⏰ Task in scadenza: ${task.title}`,
                                body: `Il task "${task.title}" scade tra ${hoursUntilDue} ore. Accedi per completarlo.`,
                            });
                        }
                    }
                }
                processed++;
            }
        }

        await batch.commit();
        return { processed, notifications };
    } catch (error) {
        console.error('Error checking due soon tasks:', error);
        return { processed: 0, notifications: 0 };
    }
}

/**
 * Check overdue tasks and notify admins/team leaders
 */
export async function checkOverdueTasks(): Promise<{ processed: number; notifications: number }> {
    const now = new Date();
    let processed = 0;
    let notifications = 0;

    try {
        const [tasksSnap, usersSnap, projectsSnap] = await Promise.all([
            adminDb.collection('tasks').get(),
            adminDb.collection('users').get(),
            adminDb.collection('projects').get(),
        ]);

        const users = usersSnap.docs.reduce((acc, doc) => {
            acc[doc.id] = docToObj<User>(doc);
            return acc;
        }, {} as Record<string, User>);

        const projects = projectsSnap.docs.reduce((acc, doc) => {
            acc[doc.id] = docToObj<Project>(doc);
            return acc;
        }, {} as Record<string, Project>);

        const admins = Object.values(users).filter(u => u.role === 'Amministratore');
        const batch = adminDb.batch();

        for (const taskDoc of tasksSnap.docs) {
            const task = docToObj<Task>(taskDoc);

            if (task.status === 'Approvato' || task.status === 'Annullato' || task.status === 'In Approvazione Cliente') continue;
            if (!task.dueDate) continue;

            const dueDate = parseISO(task.dueDate);
            const daysOverdue = differenceInDays(now, dueDate);

            if (daysOverdue > 0 && daysOverdue <= 1) {
                const existingSnap = await adminDb.collection('notifications')
                    .where('taskId', '==', task.id)
                    .where('type', '==', 'task_overdue')
                    .limit(1).get();

                if (existingSnap.empty) {
                    for (const admin of admins) {
                        const notifRef = adminDb.collection('notifications').doc();
                        batch.set(notifRef, {
                            userId: admin.id,
                            title: '🚨 Task scaduto!',
                            message: `Il task "${task.title}" è scaduto da ${daysOverdue} giorno/i`,
                            type: 'task_overdue',
                            taskId: task.id,
                            link: `/tasks?taskId=${task.id}`,
                            isRead: false,
                            createdAt: new Date().toISOString(),
                        });
                        notifications++;
                    }

                    if (task.projectId) {
                        const project = projects[task.projectId];
                        if (project?.teamLeaderId && !admins.find(a => a.id === project.teamLeaderId)) {
                            const notifRef = adminDb.collection('notifications').doc();
                            batch.set(notifRef, {
                                userId: project.teamLeaderId,
                                title: '🚨 Task scaduto nel tuo progetto',
                                message: `Il task "${task.title}" è scaduto`,
                                type: 'task_overdue',
                                taskId: task.id,
                                link: `/tasks?taskId=${task.id}`,
                                isRead: false,
                                createdAt: new Date().toISOString(),
                            });
                            notifications++;
                        }
                    }
                }
                processed++;
            }
        }

        await batch.commit();
        return { processed, notifications };
    } catch (error) {
        console.error('Error checking overdue tasks:', error);
        return { processed: 0, notifications: 0 };
    }
}

/**
 * Check for stuck tasks (in approval for too long)
 */
export async function checkStuckTasks(): Promise<{ processed: number; notifications: number }> {
    let processed = 0;
    let notifications = 0;
    const now = new Date();

    try {
        const [tasksSnap, usersSnap] = await Promise.all([
            adminDb.collection('tasks')
                .where('status', 'in', ['In Approvazione', 'In Approvazione Cliente'])
                .get(),
            adminDb.collection('users').get(),
        ]);

        const admins = usersSnap.docs
            .map(doc => docToObj<User>(doc))
            .filter(u => u.role === 'Amministratore');

        const batch = adminDb.batch();

        for (const taskDoc of tasksSnap.docs) {
            const task = docToObj<Task>(taskDoc);

            const updatedAt = task.updatedAt
                ? (typeof task.updatedAt === 'string' ? parseISO(task.updatedAt) : (task.updatedAt as any).toDate?.() ?? null)
                : null;

            if (!updatedAt) continue;

            const daysSinceUpdate = differenceInDays(now, updatedAt);

            if (daysSinceUpdate >= 2) {
                const isClientApproval = task.status === 'In Approvazione Cliente';
                const notificationType = isClientApproval ? 'client_approval_reminder' : 'approval_reminder';

                const existingSnap = await adminDb.collection('notifications')
                    .where('taskId', '==', task.id)
                    .where('type', '==', notificationType)
                    .get();

                const recentNotif = existingSnap.docs.find(n => {
                    const notifDate = typeof n.data().createdAt === 'string'
                        ? parseISO(n.data().createdAt)
                        : n.data().createdAt?.toDate?.() || new Date();
                    return differenceInDays(now, notifDate) < 2;
                });

                if (!recentNotif) {
                    for (const admin of admins) {
                        const notifRef = adminDb.collection('notifications').doc();
                        batch.set(notifRef, {
                            userId: admin.id,
                            title: isClientApproval ? '⏳ Task in attesa di approvazione cliente' : '⏳ Task in attesa di approvazione',
                            message: `"${task.title}" è in approvazione ${isClientApproval ? 'cliente ' : ''}da ${daysSinceUpdate} giorni`,
                            type: notificationType,
                            taskId: task.id,
                            link: `/tasks?taskId=${task.id}`,
                            isRead: false,
                            createdAt: new Date().toISOString(),
                        });
                        notifications++;
                    }
                }
                processed++;
            }
        }

        await batch.commit();
        return { processed, notifications };
    } catch (error) {
        console.error('Error checking stuck tasks:', error);
        return { processed: 0, notifications: 0 };
    }
}

/**
 * Update project status based on task completion
 */
export async function updateProjectStatusAutomatically(projectId: string): Promise<boolean> {
    try {
        const projectDoc = await adminDb.collection('projects').doc(projectId).get();
        if (!projectDoc.exists) return false;

        const project = docToObj<Project>(projectDoc);

        if (project.status === 'Completato' || project.status === 'Annullato') return false;

        const tasksSnap = await adminDb.collection('tasks')
            .where('projectId', '==', projectId).get();

        if (tasksSnap.empty) return false;

        const tasks = tasksSnap.docs.map(d => docToObj<Task>(d));
        const activeTasks = tasks.filter(t => t.status !== 'Annullato');
        if (activeTasks.length === 0) return false;

        const completedTasks = activeTasks.filter(t => t.status === 'Approvato');
        const inProgressTasks = activeTasks.filter(t =>
            t.status === 'In Lavorazione' || t.status === 'In Approvazione' || t.status === 'In Approvazione Cliente'
        );

        let newStatus: Project['status'] = project.status;

        if (completedTasks.length === activeTasks.length) {
            newStatus = 'In Corso';
        } else if (inProgressTasks.length > 0 && project.status === 'Pianificazione') {
            newStatus = 'In Corso';
        }

        if (newStatus !== project.status) {
            await adminDb.collection('projects').doc(projectId).update({
                status: newStatus,
                updatedAt: new Date().toISOString(),
            });

            await adminDb.collection('automation_logs').add({
                ruleId: 'auto_project_status',
                ruleName: 'Aggiornamento Stato Progetto Automatico',
                triggerType: 'task_updated',
                entityType: 'project',
                entityId: projectId,
                actionsExecuted: [`Status cambiato da "${project.status}" a "${newStatus}"`],
                status: 'success',
                executedAt: new Date().toISOString(),
            });

            return true;
        }

        return false;
    } catch (error) {
        console.error('Error updating project status:', error);
        return false;
    }
}

/**
 * Create tasks from approved brief
 */
export async function createTasksFromBrief(briefId: string): Promise<{ created: number; taskIds: string[] }> {
    try {
        const briefDoc = await adminDb.collection('briefs').doc(briefId).get();
        if (!briefDoc.exists) return { created: 0, taskIds: [] };

        const brief = docToObj<Brief>(briefDoc);
        const taskIds: string[] = [];

        const tasksToCreate = [
            { title: `Produzione: ${brief.title}`, description: brief.description || '', status: 'Da Fare' as const, priority: 'Media' as const },
            { title: `Revisione: ${brief.title}`,  description: `Revisione del contenuto per: ${brief.title}`, status: 'Da Fare' as const, priority: 'Media' as const },
            { title: `Pubblicazione: ${brief.title}`, description: `Pubblicazione finale di: ${brief.title}`, status: 'Da Fare' as const, priority: 'Bassa' as const },
        ];

        for (const taskData of tasksToCreate) {
            const ref = await adminDb.collection('tasks').add({
                ...taskData,
                clientId: brief.clientId,
                projectId: '',
                briefId,
                assignedUserId: '',
                dueDate: '',
                estimatedDuration: 60,
                timeSpent: 0,
                attachments: [],
                dependencies: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            taskIds.push(ref.id);
        }

        await adminDb.collection('automation_logs').add({
            ruleId: 'brief_to_tasks',
            ruleName: 'Crea Task da Brief Approvato',
            triggerType: 'brief_approved',
            entityType: 'brief',
            entityId: briefId,
            actionsExecuted: taskIds.map(id => `Task creato: ${id}`),
            status: 'success',
            executedAt: new Date().toISOString(),
        });

        return { created: taskIds.length, taskIds };
    } catch (error) {
        console.error('Error creating tasks from brief:', error);
        return { created: 0, taskIds: [] };
    }
}

/**
 * Generate and send weekly report email
 */
export async function generateWeeklyReport(): Promise<{ sent: number; users: string[] }> {
    try {
        const now = new Date();
        const weekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

        const [tasksSnap, usersSnap] = await Promise.all([
            adminDb.collection('tasks').get(),
            adminDb.collection('users').get(),
        ]);

        const users = usersSnap.docs.map(d => docToObj<User>(d));
        const tasks = tasksSnap.docs.map(d => docToObj<Task>(d));
        const sentTo: string[] = [];

        for (const user of users) {
            if (user.role === 'Cliente' || !user.email) continue;

            const userTasks = tasks.filter(t => t.assignedUserId === user.id);
            const completedThisWeek = userTasks.filter(t => {
                if (t.status !== 'Approvato' || !t.updatedAt) return false;
                const updatedDate = typeof t.updatedAt === 'string' ? parseISO(t.updatedAt) : (t.updatedAt as any).toDate?.() ?? null;
                if (!updatedDate) return false;
                return updatedDate >= weekStart && updatedDate <= weekEnd;
            });

            const pendingTasks = userTasks.filter(t =>
                t.status !== 'Approvato' && t.status !== 'Annullato' && t.status !== 'In Approvazione Cliente'
            );
            const overdueTasks = pendingTasks.filter(t => t.dueDate && parseISO(t.dueDate) < now);
            const upcomingTasks = pendingTasks.filter(t => {
                if (!t.dueDate) return false;
                const due = parseISO(t.dueDate);
                return differenceInDays(due, now) <= 7 && differenceInDays(due, now) >= 0;
            });

            const totalHours = userTasks.reduce((sum, t) => sum + (t.timeSpent || 0), 0) / 3600;

            const emailBody = `
Ciao ${user.name.split(' ')[0]}!

Ecco il tuo riepilogo settimanale (${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM', { locale: it })}):

📊 RIEPILOGO
• Task completati: ${completedThisWeek.length}
• Task in corso: ${pendingTasks.length}
• Task in ritardo: ${overdueTasks.length}
• Ore registrate: ${totalHours.toFixed(1)}h

⏰ PROSSIME SCADENZE
${upcomingTasks.slice(0, 5).map(t => `• ${t.title} - ${format(parseISO(t.dueDate!), 'dd/MM')}`).join('\n') || 'Nessuna scadenza imminente!'}
${overdueTasks.length > 0 ? `\n🚨 ATTENZIONE - TASK IN RITARDO\n${overdueTasks.slice(0, 3).map(t => `• ${t.title}`).join('\n')}` : ''}

Buon lavoro! 💪

---
W[r]Digital Marketing HUB
            `.trim();

            try {
                await sendAutomationEmail({
                    to: user.email,
                    toName: user.name,
                    subject: `📊 Riepilogo Settimanale - ${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM')}`,
                    body: emailBody,
                });
                sentTo.push(user.email);
            } catch (e) {
                console.error(`Failed to send weekly report to ${user.email}:`, e);
            }
        }

        return { sent: sentTo.length, users: sentTo };
    } catch (error) {
        console.error('Error generating weekly report:', error);
        return { sent: 0, users: [] };
    }
}

/**
 * Run all scheduled automations
 */
export async function runScheduledAutomations(): Promise<{
    dueSoon: { processed: number; notifications: number };
    overdue: { processed: number; notifications: number };
    stuck: { processed: number; notifications: number };
}> {
    const [dueSoon, overdue, stuck] = await Promise.all([
        checkDueSoonTasks(),
        checkOverdueTasks(),
        checkStuckTasks(),
    ]);

    await adminDb.collection('automation_logs').add({
        ruleId: 'scheduled_run',
        ruleName: 'Esecuzione Automazioni Pianificate',
        triggerType: 'time_based',
        entityType: 'system',
        entityId: 'scheduler',
        actionsExecuted: [
            `Task in scadenza: ${dueSoon.notifications} notifiche`,
            `Task scaduti: ${overdue.notifications} notifiche`,
            `Task bloccati: ${stuck.notifications} notifiche`,
        ],
        status: 'success',
        executedAt: new Date().toISOString(),
    });

    return { dueSoon, overdue, stuck };
}
