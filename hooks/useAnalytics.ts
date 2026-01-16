'use client';

import { useMemo } from 'react';
import { Task, User } from '@/lib/data';
import {
    differenceInHours,
    parseISO,
    startOfDay,
    endOfDay,
    isWithinInterval,
    format,
    subDays,
    eachDayOfInterval
} from 'date-fns';
import { it } from 'date-fns/locale';

/**
 * Hook per calcolare analytics sui task
 */
export function useTaskAnalytics(tasks: Task[], users: User[], dateRange?: { start: Date; end: Date }) {

    const analytics = useMemo(() => {
        const now = new Date();
        const range = dateRange || {
            start: subDays(now, 30),
            end: now
        };

        // Filtra task nel range
        const tasksInRange = tasks.filter(task => {
            if (!task.createdAt) return false;
            const createdDate = parseISO(task.createdAt);
            return isWithinInterval(createdDate, { start: range.start, end: range.end });
        });

        // 1. TASK PER STATUS
        const tasksByStatus = {
            'Da Fare': tasks.filter(t => t.status === 'Da Fare').length,
            'In Lavorazione': tasks.filter(t => t.status === 'In Lavorazione').length,
            'In Approvazione': tasks.filter(t => t.status === 'In Approvazione').length,
            'Approvato': tasks.filter(t => t.status === 'Approvato').length,
            'Annullato': tasks.filter(t => t.status === 'Annullato').length,
        };

        // 2. TASK PER PRIORITÀ
        const tasksByPriority = {
            'Bassa': tasks.filter(t => t.priority === 'Bassa').length,
            'Media': tasks.filter(t => t.priority === 'Media').length,
            'Alta': tasks.filter(t => t.priority === 'Alta').length,
            'Critica': tasks.filter(t => t.priority === 'Critica').length,
        };

        // 3. COMPLETION RATE
        const completedTasks = tasksInRange.filter(t => t.status === 'Approvato').length;
        const totalTasks = tasksInRange.length;
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        // 4. TEMPO MEDIO COMPLETAMENTO
        const completedTasksWithTime = tasksInRange.filter(t =>
            t.status === 'Approvato' && t.createdAt && t.updatedAt
        );

        const avgCompletionTime = completedTasksWithTime.length > 0
            ? completedTasksWithTime.reduce((acc, task) => {
                const created = parseISO(task.createdAt!);
                const completed = parseISO(task.updatedAt!);
                return acc + differenceInHours(completed, created);
            }, 0) / completedTasksWithTime.length
            : 0;

        // 5. TASK IN RITARDO
        const overdueTasks = tasks.filter(task => {
            if (!task.dueDate || task.status === 'Approvato' || task.status === 'Annullato') {
                return false;
            }
            return differenceInHours(parseISO(task.dueDate), now) < 0;
        }).length;

        // 6. PRODUTTIVITÀ PER UTENTE
        const productivityByUser = users.map(user => {
            const userTasks = tasksInRange.filter(t => t.assignedUserId === user.id);
            const userCompleted = userTasks.filter(t => t.status === 'Approvato').length;
            const userTotal = userTasks.length;
            const userCompletionRate = userTotal > 0 ? (userCompleted / userTotal) * 100 : 0;

            return {
                userId: user.id,
                userName: user.name,
                totalTasks: userTotal,
                completedTasks: userCompleted,
                completionRate: userCompletionRate,
                timeSpent: userTasks.reduce((acc, t) => acc + (t.timeSpent || 0), 0),
            };
        }).filter(u => u.totalTasks > 0)
            .sort((a, b) => b.completedTasks - a.completedTasks);

        // 7. TREND SETTIMANALE (ultimi 7 giorni)
        const last7Days = eachDayOfInterval({
            start: subDays(now, 6),
            end: now
        });

        const weeklyTrend = last7Days.map(day => {
            const dayStart = startOfDay(day);
            const dayEnd = endOfDay(day);

            const created = tasks.filter(t => {
                if (!t.createdAt) return false;
                const date = parseISO(t.createdAt);
                return isWithinInterval(date, { start: dayStart, end: dayEnd });
            }).length;

            const completed = tasks.filter(t => {
                if (!t.updatedAt || t.status !== 'Approvato') return false;
                const date = parseISO(t.updatedAt);
                return isWithinInterval(date, { start: dayStart, end: dayEnd });
            }).length;

            return {
                date: format(day, 'EEE', { locale: it }),
                fullDate: format(day, 'dd/MM', { locale: it }),
                created,
                completed,
            };
        });

        // 8. TEMPO SPESO PER ATTIVITÀ
        const timeByActivity = tasks.reduce((acc, task) => {
            if (!task.activityType) return acc;

            if (!acc[task.activityType]) {
                acc[task.activityType] = {
                    totalTime: 0,
                    taskCount: 0,
                };
            }

            acc[task.activityType].totalTime += task.timeSpent || 0;
            acc[task.activityType].taskCount += 1;

            return acc;
        }, {} as Record<string, { totalTime: number; taskCount: number }>);

        // 9. EFFICIENZA (tempo stimato vs effettivo)
        const tasksWithEstimate = tasks.filter(t =>
            t.estimatedDuration > 0 && (t.timeSpent || 0) > 0
        );

        const efficiency = tasksWithEstimate.length > 0
            ? tasksWithEstimate.reduce((acc, task) => {
                const estimated = task.estimatedDuration;
                const actual = task.timeSpent || 0;
                const taskEfficiency = (estimated / actual) * 100;
                return acc + taskEfficiency;
            }, 0) / tasksWithEstimate.length
            : 100;

        // 10. TASK URGENTI (deadline < 24h)
        const urgentTasks = tasks.filter(task => {
            if (!task.dueDate || task.status === 'Approvato' || task.status === 'Annullato') {
                return false;
            }
            const hoursUntil = differenceInHours(parseISO(task.dueDate), now);
            return hoursUntil >= 0 && hoursUntil <= 24;
        }).length;

        return {
            // Metriche base
            totalTasks,
            completedTasks,
            completionRate,
            avgCompletionTime,
            overdueTasks,
            urgentTasks,
            efficiency,

            // Distribuzioni
            tasksByStatus,
            tasksByPriority,
            timeByActivity,

            // Trend e performance
            weeklyTrend,
            productivityByUser,

            // Metadata
            dateRange: range,
        };
    }, [tasks, users, dateRange]);

    return analytics;
}

/**
 * Hook per analytics produttività per ora del giorno
 */
export function useProductivityByHour(tasks: Task[]) {

    const hourlyData = useMemo(() => {
        const hours = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            label: `${i}:00`,
            tasksCompleted: 0,
            timeSpent: 0,
        }));

        tasks.forEach(task => {
            if (!task.updatedAt || task.status !== 'Approvato') return;

            try {
                const completedDate = parseISO(task.updatedAt);
                const hour = completedDate.getHours();

                hours[hour].tasksCompleted += 1;
                hours[hour].timeSpent += task.timeSpent || 0;
            } catch (e) {
                // Ignora date invalide
            }
        });

        // Trova ore di picco
        const peakHour = hours.reduce((max, hour) =>
            hour.tasksCompleted > max.tasksCompleted ? hour : max
            , hours[0]);

        return {
            hourlyData: hours,
            peakHour: peakHour.hour,
            peakProductivity: peakHour.tasksCompleted,
        };
    }, [tasks]);

    return hourlyData;
}

/**
 * Hook per calcolare metriche di team
 */
export function useTeamMetrics(tasks: Task[], users: User[]) {

    const metrics = useMemo(() => {
        const activeUsers = users.filter(u => u.status === 'Attivo' && u.role !== 'Cliente');

        // Carico di lavoro medio
        const avgWorkload = activeUsers.length > 0
            ? tasks.filter(t => t.status !== 'Approvato' && t.status !== 'Annullato').length / activeUsers.length
            : 0;

        // Distribuzione carico
        const workloadDistribution = activeUsers.map(user => {
            const userActiveTasks = tasks.filter(t =>
                t.assignedUserId === user.id &&
                t.status !== 'Approvato' &&
                t.status !== 'Annullato'
            ).length;

            return {
                userId: user.id,
                userName: user.name,
                activeTasks: userActiveTasks,
                percentage: avgWorkload > 0 ? (userActiveTasks / (avgWorkload * activeUsers.length)) * 100 : 0,
            };
        }).sort((a, b) => b.activeTasks - a.activeTasks);

        // Utenti sovraccarichi (>150% della media)
        const overloadedUsers = workloadDistribution.filter(u => u.percentage > 150);

        // Utenti sottoutilizzati (<50% della media)
        const underutilizedUsers = workloadDistribution.filter(u => u.percentage < 50 && u.activeTasks > 0);

        return {
            totalActiveUsers: activeUsers.length,
            avgWorkload,
            workloadDistribution,
            overloadedUsers,
            underutilizedUsers,
            balanceScore: 100 - (overloadedUsers.length + underutilizedUsers.length) * 10, // 0-100
        };
    }, [tasks, users]);

    return metrics;
}
