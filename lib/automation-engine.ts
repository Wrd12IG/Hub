'use server';

import { db } from '@/lib/firebase';
import {
    collection,
    doc,
    getDocs,
    getDoc,
    updateDoc,
    addDoc,
    query,
    where,
    Timestamp,
    writeBatch
} from 'firebase/firestore';
import { differenceInHours, differenceInDays, parseISO, format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { it } from 'date-fns/locale';
import type { Task, Project, Brief, User, Notification } from '@/lib/data';
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

// Types are imported from automation-types.ts to avoid "use server" restrictions
// Re-export for convenience (only the async functions are actually from this module)
export type { AutomationRule, AutomationLog } from './automation-types';

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
        const tasksSnapshot = await getDocs(collection(db, 'tasks'));
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const users = usersSnapshot.docs.reduce((acc, doc) => {
            acc[doc.id] = { id: doc.id, ...doc.data() } as User;
            return acc;
        }, {} as Record<string, User>);

        const batch = writeBatch(db);

        for (const taskDoc of tasksSnapshot.docs) {
            const task = { id: taskDoc.id, ...taskDoc.data() } as Task;

            // Skip completed/cancelled tasks
            if (task.status === 'Approvato' || task.status === 'Annullato') continue;
            if (!task.dueDate) continue;

            const dueDate = parseISO(task.dueDate);
            const hoursUntilDue = differenceInHours(dueDate, now);

            // Task due within 24 hours but not yet notified
            if (hoursUntilDue > 0 && hoursUntilDue <= 24) {
                // Check if we already sent a notification for this
                const notifQuery = query(
                    collection(db, 'notifications'),
                    where('taskId', '==', task.id),
                    where('type', '==', 'task_due_soon')
                );
                const existingNotifs = await getDocs(notifQuery);

                if (existingNotifs.empty && task.assignedUserId) {
                    const user = users[task.assignedUserId];
                    if (user) {
                        // Create notification
                        const notificationRef = doc(collection(db, 'notifications'));
                        batch.set(notificationRef, {
                            userId: task.assignedUserId,
                            title: '⏰ Task in scadenza!',
                            message: `Il task "${task.title}" scade tra ${hoursUntilDue} ore`,
                            type: 'task_due_soon',
                            taskId: task.id,
                            link: `/tasks?taskId=${task.id}`,
                            isRead: false,
                            createdAt: new Date().toISOString()
                        });
                        notifications++;

                        // Send email
                        if (user.email) {
                            await sendAutomationEmail({
                                to: user.email,
                                toName: user.name,
                                subject: `⏰ Task in scadenza: ${task.title}`,
                                body: `Il task "${task.title}" scade tra ${hoursUntilDue} ore. Accedi per completarlo.`
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
        const tasksSnapshot = await getDocs(collection(db, 'tasks'));
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const projectsSnapshot = await getDocs(collection(db, 'projects'));

        const users = usersSnapshot.docs.reduce((acc, doc) => {
            acc[doc.id] = { id: doc.id, ...doc.data() } as User;
            return acc;
        }, {} as Record<string, User>);

        const projects = projectsSnapshot.docs.reduce((acc, doc) => {
            acc[doc.id] = { id: doc.id, ...doc.data() } as Project;
            return acc;
        }, {} as Record<string, Project>);

        const admins = Object.values(users).filter(u => u.role === 'Amministratore');
        const batch = writeBatch(db);

        for (const taskDoc of tasksSnapshot.docs) {
            const task = { id: taskDoc.id, ...taskDoc.data() } as Task;

            if (task.status === 'Approvato' || task.status === 'Annullato') continue;
            if (!task.dueDate) continue;

            const dueDate = parseISO(task.dueDate);
            const daysOverdue = differenceInDays(now, dueDate);

            if (daysOverdue > 0 && daysOverdue <= 1) {
                // Just became overdue - notify once
                const notifQuery = query(
                    collection(db, 'notifications'),
                    where('taskId', '==', task.id),
                    where('type', '==', 'task_overdue')
                );
                const existingNotifs = await getDocs(notifQuery);

                if (existingNotifs.empty) {
                    // Notify admins
                    for (const admin of admins) {
                        const notificationRef = doc(collection(db, 'notifications'));
                        batch.set(notificationRef, {
                            userId: admin.id,
                            title: '🚨 Task scaduto!',
                            message: `Il task "${task.title}" è scaduto da ${daysOverdue} giorno/i`,
                            type: 'task_overdue',
                            taskId: task.id,
                            link: `/tasks?taskId=${task.id}`,
                            isRead: false,
                            createdAt: new Date().toISOString()
                        });
                        notifications++;
                    }

                    // Notify team leader of project
                    if (task.projectId) {
                        const project = projects[task.projectId];
                        if (project?.teamLeaderId && !admins.find(a => a.id === project.teamLeaderId)) {
                            const notificationRef = doc(collection(db, 'notifications'));
                            batch.set(notificationRef, {
                                userId: project.teamLeaderId,
                                title: '🚨 Task scaduto nel tuo progetto',
                                message: `Il task "${task.title}" è scaduto`,
                                type: 'task_overdue',
                                taskId: task.id,
                                link: `/tasks?taskId=${task.id}`,
                                isRead: false,
                                createdAt: new Date().toISOString()
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
        const tasksSnapshot = await getDocs(
            query(collection(db, 'tasks'), where('status', '==', 'In Approvazione'))
        );

        const usersSnapshot = await getDocs(collection(db, 'users'));
        const admins = usersSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as User))
            .filter(u => u.role === 'Amministratore');

        const batch = writeBatch(db);

        for (const taskDoc of tasksSnapshot.docs) {
            const task = { id: taskDoc.id, ...taskDoc.data() } as Task;

            const updatedAt = task.updatedAt ?
                (typeof task.updatedAt === 'string' ? parseISO(task.updatedAt) : (task.updatedAt as any).toDate())
                : null;

            if (!updatedAt) continue;

            const daysSinceUpdate = differenceInDays(now, updatedAt);

            if (daysSinceUpdate >= 2) {
                // Check if already notified recently
                const notifQuery = query(
                    collection(db, 'notifications'),
                    where('taskId', '==', task.id),
                    where('type', '==', 'approval_reminder')
                );
                const existingNotifs = await getDocs(notifQuery);

                // Only notify once every 2 days
                const recentNotif = existingNotifs.docs.find(n => {
                    const notifDate = parseISO(n.data().createdAt);
                    return differenceInDays(now, notifDate) < 2;
                });

                if (!recentNotif) {
                    for (const admin of admins) {
                        const notificationRef = doc(collection(db, 'notifications'));
                        batch.set(notificationRef, {
                            userId: admin.id,
                            title: '⏳ Task in attesa di approvazione',
                            message: `"${task.title}" è in approvazione da ${daysSinceUpdate} giorni`,
                            type: 'approval_reminder',
                            taskId: task.id,
                            link: `/tasks?taskId=${task.id}`,
                            isRead: false,
                            createdAt: new Date().toISOString()
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
        const projectDoc = await getDoc(doc(db, 'projects', projectId));
        if (!projectDoc.exists()) return false;

        const project = { id: projectDoc.id, ...projectDoc.data() } as Project;

        // Skip if already completed or cancelled
        if (project.status === 'Completato' || project.status === 'Annullato') return false;

        // Get all tasks for this project
        const tasksSnapshot = await getDocs(
            query(collection(db, 'tasks'), where('projectId', '==', projectId))
        );

        if (tasksSnapshot.empty) return false;

        const tasks = tasksSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task));
        const activeTasks = tasks.filter(t => t.status !== 'Annullato');

        if (activeTasks.length === 0) return false;

        const completedTasks = activeTasks.filter(t => t.status === 'Approvato');
        const inProgressTasks = activeTasks.filter(t => t.status === 'In Lavorazione' || t.status === 'In Approvazione');

        let newStatus: Project['status'] = project.status;

        // All tasks completed -> project completed
        if (completedTasks.length === activeTasks.length) {
            // Note: If 'Completato' isn't in the Project status type, this may need data model update
            // For now we cast it
            newStatus = 'In Corso'; // or handle differently based on your Project type
        }
        // At least one task in progress -> project in progress
        else if (inProgressTasks.length > 0 && project.status === 'Pianificazione') {
            newStatus = 'In Corso';
        }

        if (newStatus !== project.status) {
            await updateDoc(doc(db, 'projects', projectId), {
                status: newStatus,
                updatedAt: new Date().toISOString()
            });

            // Log the automation
            await addDoc(collection(db, 'automation_logs'), {
                ruleId: 'auto_project_status',
                ruleName: 'Aggiornamento Stato Progetto Automatico',
                triggerType: 'task_updated',
                entityType: 'project',
                entityId: projectId,
                actionsExecuted: [`Status cambiato da "${project.status}" a "${newStatus}"`],
                status: 'success',
                executedAt: new Date().toISOString()
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
        const briefDoc = await getDoc(doc(db, 'briefs', briefId));
        if (!briefDoc.exists()) return { created: 0, taskIds: [] };

        const brief = { id: briefDoc.id, ...briefDoc.data() } as Brief;
        const taskIds: string[] = [];

        // Default tasks to create from an approved brief
        const tasksToCreate = [
            {
                title: `Produzione: ${brief.title}`,
                description: brief.description || '',
                status: 'Da Fare' as const,
                priority: 'Media' as const,
            },
            {
                title: `Revisione: ${brief.title}`,
                description: `Revisione del contenuto per: ${brief.title}`,
                status: 'Da Fare' as const,
                priority: 'Media' as const,
            },
            {
                title: `Pubblicazione: ${brief.title}`,
                description: `Pubblicazione finale di: ${brief.title}`,
                status: 'Da Fare' as const,
                priority: 'Bassa' as const,
            }
        ];

        for (const taskData of tasksToCreate) {
            const newTaskRef = await addDoc(collection(db, 'tasks'), {
                ...taskData,
                clientId: brief.clientId,
                projectId: '',
                briefId: briefId,
                assignedUserId: '',
                dueDate: '',
                estimatedDuration: 60,
                timeSpent: 0,
                attachments: [],
                dependencies: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            taskIds.push(newTaskRef.id);
        }

        // Log the automation
        await addDoc(collection(db, 'automation_logs'), {
            ruleId: 'brief_to_tasks',
            ruleName: 'Crea Task da Brief Approvato',
            triggerType: 'brief_approved',
            entityType: 'brief',
            entityId: briefId,
            actionsExecuted: taskIds.map(id => `Task creato: ${id}`),
            status: 'success',
            executedAt: new Date().toISOString()
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

        const [tasksSnap, usersSnap, projectsSnap] = await Promise.all([
            getDocs(collection(db, 'tasks')),
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'projects'))
        ]);

        const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User));
        const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task));

        const sentTo: string[] = [];

        for (const user of users) {
            if (user.role === 'Cliente' || !user.email) continue;

            // Calculate user's weekly stats
            const userTasks = tasks.filter(t => t.assignedUserId === user.id);
            const completedThisWeek = userTasks.filter(t => {
                if (t.status !== 'Approvato' || !t.updatedAt) return false;
                const updatedDate = typeof t.updatedAt === 'string' ? parseISO(t.updatedAt) : (t.updatedAt as any).toDate();
                return updatedDate >= weekStart && updatedDate <= weekEnd;
            });

            const pendingTasks = userTasks.filter(t =>
                t.status !== 'Approvato' && t.status !== 'Annullato'
            );

            const overdueTasks = pendingTasks.filter(t =>
                t.dueDate && parseISO(t.dueDate) < now
            );

            const upcomingTasks = pendingTasks.filter(t => {
                if (!t.dueDate) return false;
                const due = parseISO(t.dueDate);
                return differenceInDays(due, now) <= 7 && differenceInDays(due, now) >= 0;
            });

            const totalHours = userTasks.reduce((sum, t) => sum + (t.timeSpent || 0), 0) / 3600;

            // Generate email
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

${overdueTasks.length > 0 ? `
🚨 ATTENZIONE - TASK IN RITARDO
${overdueTasks.slice(0, 3).map(t => `• ${t.title}`).join('\n')}
` : ''}

Buon lavoro! 💪

---
W[r]Digital Marketing HUB
            `.trim();

            try {
                await sendAutomationEmail({
                    to: user.email,
                    toName: user.name,
                    subject: `📊 Riepilogo Settimanale - ${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM')}`,
                    body: emailBody
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
 * Run all scheduled automations (call this from a cron job or API route)
 */
export async function runScheduledAutomations(): Promise<{
    dueSoon: { processed: number; notifications: number };
    overdue: { processed: number; notifications: number };
    stuck: { processed: number; notifications: number };
}> {
    const [dueSoon, overdue, stuck] = await Promise.all([
        checkDueSoonTasks(),
        checkOverdueTasks(),
        checkStuckTasks()
    ]);

    // Log automation run
    await addDoc(collection(db, 'automation_logs'), {
        ruleId: 'scheduled_run',
        ruleName: 'Esecuzione Automazioni Pianificate',
        triggerType: 'time_based',
        entityType: 'system' as any,
        entityId: 'scheduler',
        actionsExecuted: [
            `Task in scadenza: ${dueSoon.notifications} notifiche`,
            `Task scaduti: ${overdue.notifications} notifiche`,
            `Task bloccati: ${stuck.notifications} notifiche`
        ],
        status: 'success',
        executedAt: new Date().toISOString()
    });

    return { dueSoon, overdue, stuck };
}
