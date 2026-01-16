'use client';

import { useEffect, useState } from 'react';
import { Task } from '@/lib/data';
import { Clock, AlertTriangle, Calendar } from 'lucide-react';
import { formatDistanceToNow, parseISO, differenceInHours, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DeadlineCountdownWidgetProps {
    tasks: Task[];
    onTaskClick?: (taskId: string) => void;
}

export function DeadlineCountdownWidget({ tasks, onTaskClick }: DeadlineCountdownWidgetProps) {
    const [urgentTasks, setUrgentTasks] = useState<Array<Task & { hoursUntil: number; daysUntil: number }>>([]);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Aggiorna ogni minuto per countdown in tempo reale
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // 1 minuto

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const now = currentTime;

        const tasksWithDeadline = tasks
            .filter(task =>
                task.dueDate &&
                task.status !== 'Approvato' &&
                task.status !== 'Annullato'
            )
            .map(task => {
                const deadline = parseISO(task.dueDate!);
                const hoursUntil = differenceInHours(deadline, now);
                const daysUntil = differenceInDays(deadline, now);

                return {
                    ...task,
                    hoursUntil,
                    daysUntil
                };
            })
            .filter(task => task.hoursUntil >= -24 && task.hoursUntil <= 72) // Da 24h scadute a 72h future
            .sort((a, b) => a.hoursUntil - b.hoursUntil)
            .slice(0, 5); // Massimo 5

        setUrgentTasks(tasksWithDeadline);
    }, [tasks, currentTime]);

    if (urgentTasks.length === 0) {
        return null;
    }

    const getUrgencyColor = (hoursUntil: number) => {
        if (hoursUntil < 0) return 'text-red-600 dark:text-red-400';
        if (hoursUntil <= 3) return 'text-red-500 dark:text-red-400';
        if (hoursUntil <= 24) return 'text-orange-500 dark:text-orange-400';
        if (hoursUntil <= 48) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-blue-600 dark:text-blue-400';
    };

    const getUrgencyBg = (hoursUntil: number) => {
        if (hoursUntil < 0) return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800';
        if (hoursUntil <= 3) return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800';
        if (hoursUntil <= 24) return 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800';
        if (hoursUntil <= 48) return 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800';
        return 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800';
    };

    const getUrgencyIcon = (hoursUntil: number) => {
        if (hoursUntil < 0 || hoursUntil <= 3) {
            return <AlertTriangle className="w-5 h-5" />;
        }
        return <Clock className="w-5 h-5" />;
    };

    const formatTimeUntil = (hoursUntil: number, daysUntil: number) => {
        if (hoursUntil < 0) {
            const hoursOverdue = Math.abs(hoursUntil);
            if (hoursOverdue < 24) {
                return `${hoursOverdue}h in ritardo`;
            }
            return `${Math.abs(daysUntil)}gg in ritardo`;
        }

        if (hoursUntil < 1) {
            return 'Meno di 1h';
        }

        if (hoursUntil < 24) {
            return `${hoursUntil}h`;
        }

        if (daysUntil === 1) {
            return 'Domani';
        }

        return `${daysUntil} giorni`;
    };

    return (
        <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <h3 className="font-semibold text-orange-900 dark:text-orange-100">
                    Scadenze Imminenti
                </h3>
                {urgentTasks.filter(t => t.hoursUntil < 0).length > 0 && (
                    <span className="ml-auto text-xs font-semibold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-full">
                        {urgentTasks.filter(t => t.hoursUntil < 0).length} in ritardo
                    </span>
                )}
            </div>

            <div className="space-y-2">
                {urgentTasks.map((task) => (
                    <div
                        key={task.id}
                        onClick={() => onTaskClick?.(task.id)}
                        className={cn(
                            "p-3 rounded-md border transition-all cursor-pointer hover:shadow-md",
                            getUrgencyBg(task.hoursUntil)
                        )}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={cn("flex-shrink-0", getUrgencyColor(task.hoursUntil))}>
                                        {getUrgencyIcon(task.hoursUntil)}
                                    </div>
                                    <h4 className="font-medium text-sm truncate">
                                        {task.title}
                                    </h4>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="truncate">
                                        {task.assignedUserId ? 'Assegnato' : 'Non assegnato'}
                                    </span>
                                    <span>•</span>
                                    <span className={cn(
                                        "font-medium",
                                        task.priority === 'Critica' && 'text-red-600 dark:text-red-400',
                                        task.priority === 'Alta' && 'text-orange-600 dark:text-orange-400',
                                        task.priority === 'Media' && 'text-yellow-600 dark:text-yellow-400',
                                        task.priority === 'Bassa' && 'text-blue-600 dark:text-blue-400'
                                    )}>
                                        {task.priority}
                                    </span>
                                </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                                <div className={cn(
                                    "text-sm font-bold",
                                    getUrgencyColor(task.hoursUntil)
                                )}>
                                    {formatTimeUntil(task.hoursUntil, task.daysUntil)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {task.dueDate && formatDistanceToNow(parseISO(task.dueDate), {
                                        addSuffix: true,
                                        locale: it
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Legenda */}
            <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-800">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span>Critico (&lt;3h)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                        <span>Urgente (&lt;24h)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        <span>Prossimo (&lt;48h)</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Versione compatta per sidebar
 */
export function DeadlineCountdownCompact({ tasks, onTaskClick }: DeadlineCountdownWidgetProps) {
    const [urgentCount, setUrgentCount] = useState(0);
    const [overdueCount, setOverdueCount] = useState(0);

    useEffect(() => {
        const now = new Date();

        const urgent = tasks.filter(task => {
            if (!task.dueDate || task.status === 'Approvato' || task.status === 'Annullato') {
                return false;
            }
            const hoursUntil = differenceInHours(parseISO(task.dueDate), now);
            return hoursUntil >= 0 && hoursUntil <= 24;
        }).length;

        const overdue = tasks.filter(task => {
            if (!task.dueDate || task.status === 'Approvato' || task.status === 'Annullato') {
                return false;
            }
            const hoursUntil = differenceInHours(parseISO(task.dueDate), now);
            return hoursUntil < 0;
        }).length;

        setUrgentCount(urgent);
        setOverdueCount(overdue);
    }, [tasks]);

    if (urgentCount === 0 && overdueCount === 0) {
        return null;
    }

    return (
        <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-950/20 rounded-md border border-orange-200 dark:border-orange-800">
            <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <div className="flex-1 text-sm">
                {overdueCount > 0 && (
                    <span className="font-semibold text-red-600 dark:text-red-400">
                        {overdueCount} in ritardo
                    </span>
                )}
                {overdueCount > 0 && urgentCount > 0 && <span className="mx-1">•</span>}
                {urgentCount > 0 && (
                    <span className="font-medium text-orange-600 dark:text-orange-400">
                        {urgentCount} urgenti
                    </span>
                )}
            </div>
        </div>
    );
}
