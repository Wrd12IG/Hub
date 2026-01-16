'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart, BarChart, Bar } from 'recharts';
import { useLayoutData } from '@/app/(app)/layout-context';
import { parseISO, differenceInDays, format, startOfWeek, endOfWeek, eachDayOfInterval, eachWeekOfInterval, subWeeks, isWithinInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import type { Task, Project } from '@/lib/data';
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp, Target, Zap } from 'lucide-react';

// Utility to calculate ideal burndown line
function calculateIdealBurndown(totalTasks: number, startDate: Date, endDate: Date) {
    const days = differenceInDays(endDate, startDate);
    const dailyBurn = totalTasks / Math.max(days, 1);

    const idealData = [];
    let remaining = totalTasks;

    for (let i = 0; i <= days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        idealData.push({
            date: format(date, 'dd/MM', { locale: it }),
            fullDate: date.toISOString(),
            ideal: Math.max(0, Math.round(remaining * 10) / 10),
        });
        remaining -= dailyBurn;
    }

    return idealData;
}

// Calculate actual burndown based on task completion dates
function calculateActualBurndown(tasks: Task[], startDate: Date, endDate: Date) {
    const totalTasks = tasks.length;
    const days = differenceInDays(endDate, startDate);

    const actualData = [];

    for (let i = 0; i <= days; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + i);

        // Count tasks completed by this date
        const completedByDate = tasks.filter(t => {
            if (t.status !== 'Approvato') return false;
            const completedDate = t.updatedAt ? new Date(t.updatedAt) : null;
            return completedDate && completedDate <= currentDate;
        }).length;

        actualData.push({
            date: format(currentDate, 'dd/MM', { locale: it }),
            fullDate: currentDate.toISOString(),
            actual: totalTasks - completedByDate,
        });
    }

    return actualData;
}

interface BurndownChartProps {
    projectId?: string;
    title?: string;
    description?: string;
    className?: string;
}

export function BurndownChart({ projectId, title = "Burndown Chart", description, className }: BurndownChartProps) {
    const { allTasks, allProjects } = useLayoutData();

    const { data, project, stats } = useMemo(() => {
        let tasks: Task[];
        let project: Project | undefined;

        if (projectId) {
            project = allProjects.find(p => p.id === projectId);
            tasks = allTasks.filter(t => t.projectId === projectId && t.status !== 'Annullato');
        } else {
            // Use all active tasks
            tasks = allTasks.filter(t => t.status !== 'Annullato');
        }

        if (tasks.length === 0) {
            return { data: [], project: undefined, stats: null };
        }

        // Determine date range
        const startDate = project?.startDate
            ? new Date(project.startDate)
            : new Date(Math.min(...tasks.map(t => t.createdAt ? new Date(t.createdAt).getTime() : Date.now())));

        const endDate = project?.endDate
            ? new Date(project.endDate)
            : new Date(Math.max(...tasks.filter(t => t.dueDate).map(t => new Date(t.dueDate!).getTime())));

        // Calculate ideal and actual burndown
        const idealData = calculateIdealBurndown(tasks.length, startDate, endDate);
        const actualData = calculateActualBurndown(tasks, startDate, endDate);

        // Merge data
        const mergedData = idealData.map((ideal, i) => ({
            ...ideal,
            actual: actualData[i]?.actual ?? null,
        }));

        // Calculate stats
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'Approvato').length;
        const remainingTasks = totalTasks - completedTasks;
        const daysRemaining = Math.max(0, differenceInDays(endDate, new Date()));

        // Current ideal remaining (where we should be)
        const totalDays = differenceInDays(endDate, startDate);
        const daysPassed = totalDays - daysRemaining;
        const idealRemaining = Math.max(0, totalTasks - (totalTasks / totalDays) * daysPassed);

        // Calculate if ahead or behind
        const variance = idealRemaining - remainingTasks; // Positive = ahead, Negative = behind

        return {
            data: mergedData,
            project,
            stats: {
                totalTasks,
                completedTasks,
                remainingTasks,
                daysRemaining,
                variance: Math.round(variance * 10) / 10,
                isAhead: variance >= 0
            }
        };
    }, [allTasks, allProjects, projectId]);

    if (data.length === 0) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>Nessun dato disponibile</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card className={className}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="h-5 w-5 text-primary" />
                            {project ? `Burndown: ${project.name}` : title}
                        </CardTitle>
                        <CardDescription>
                            {description || 'Confronto tra andamento ideale e reale dei task'}
                        </CardDescription>
                    </div>
                    {stats && (
                        <div className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
                            stats.isAhead
                                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                        )}>
                            {stats.isAhead ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                            {stats.isAhead ? 'In anticipo' : 'In ritardo'} ({Math.abs(stats.variance)} task)
                        </div>
                    )}
                </div>

                {/* Stats row */}
                {stats && (
                    <div className="grid grid-cols-4 gap-4 mt-4">
                        <div className="text-center p-2 rounded-lg bg-muted/50">
                            <p className="text-2xl font-bold">{stats.totalTasks}</p>
                            <p className="text-xs text-muted-foreground">Totale</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                            <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.completedTasks}</p>
                            <p className="text-xs text-muted-foreground">Completati</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{stats.remainingTasks}</p>
                            <p className="text-xs text-muted-foreground">Rimanenti</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.daysRemaining}</p>
                            <p className="text-xs text-muted-foreground">Giorni</p>
                        </div>
                    </div>
                )}
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorIdeal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis
                            tick={{ fontSize: 11 }}
                            domain={[0, 'dataMax + 5']}
                            label={{ value: 'Task rimanenti', angle: -90, position: 'insideLeft', fontSize: 11 }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}
                        />
                        <Legend />
                        <Area
                            type="monotone"
                            dataKey="ideal"
                            stroke="hsl(var(--muted-foreground))"
                            strokeDasharray="5 5"
                            fillOpacity={1}
                            fill="url(#colorIdeal)"
                            name="Andamento Ideale"
                            dot={false}
                        />
                        <Area
                            type="monotone"
                            dataKey="actual"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorActual)"
                            name="Andamento Reale"
                            dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                            connectNulls
                        />
                        <ReferenceLine
                            y={0}
                            stroke="hsl(var(--success))"
                            strokeWidth={2}
                            label={{ value: "Target", position: "right", fontSize: 11 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

interface VelocityChartProps {
    weeks?: number;
    title?: string;
    className?: string;
}

export function VelocityChart({ weeks = 8, title = "Velocity del Team", className }: VelocityChartProps) {
    const { allTasks, users } = useLayoutData();

    const { data, averageVelocity, trend } = useMemo(() => {
        const now = new Date();
        const weeksAgo = subWeeks(now, weeks);

        // Get all weeks in the range
        const weekIntervals = eachWeekOfInterval(
            { start: weeksAgo, end: now },
            { weekStartsOn: 1 } // Monday start
        );

        const weeklyData = weekIntervals.map(weekStart => {
            const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

            // Count tasks completed in this week
            const completedInWeek = allTasks.filter(t => {
                if (t.status !== 'Approvato') return false;
                const completedDate = t.updatedAt ? new Date(t.updatedAt) : null;
                return completedDate && isWithinInterval(completedDate, { start: weekStart, end: weekEnd });
            });

            // Calculate story points (using estimated duration as proxy)
            const storyPoints = completedInWeek.reduce((sum, t) => {
                // Convert minutes to story points (roughly)
                const points = Math.ceil((t.estimatedDuration || 30) / 60);
                return sum + Math.min(points, 8); // Cap at 8 points per task
            }, 0);

            return {
                week: format(weekStart, 'dd MMM', { locale: it }),
                fullDate: weekStart.toISOString(),
                tasksCompleted: completedInWeek.length,
                storyPoints,
            };
        });

        // Calculate average velocity
        const totalCompleted = weeklyData.reduce((sum, w) => sum + w.tasksCompleted, 0);
        const averageVelocity = Math.round((totalCompleted / weeklyData.length) * 10) / 10;

        // Calculate trend (comparing last 4 weeks to previous 4 weeks)
        const recentWeeks = weeklyData.slice(-4);
        const previousWeeks = weeklyData.slice(-8, -4);

        const recentAvg = recentWeeks.reduce((sum, w) => sum + w.tasksCompleted, 0) / recentWeeks.length;
        const previousAvg = previousWeeks.length > 0
            ? previousWeeks.reduce((sum, w) => sum + w.tasksCompleted, 0) / previousWeeks.length
            : recentAvg;

        const trendPercent = previousAvg > 0
            ? Math.round(((recentAvg - previousAvg) / previousAvg) * 100)
            : 0;

        return {
            data: weeklyData,
            averageVelocity,
            trend: trendPercent
        };
    }, [allTasks, weeks]);

    return (
        <Card className={className}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-amber-500" />
                            {title}
                        </CardTitle>
                        <CardDescription>
                            Task completati per settimana (ultime {weeks} settimane)
                        </CardDescription>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold">{averageVelocity}</p>
                        <p className="text-xs text-muted-foreground">task/settimana media</p>
                        {trend !== 0 && (
                            <p className={cn(
                                "text-xs flex items-center justify-end gap-1 mt-1",
                                trend > 0 ? "text-green-600" : "text-red-600"
                            )}>
                                {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {trend > 0 ? '+' : ''}{trend}% vs precedente
                            </p>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}
                            formatter={(value: number, name: string) => [
                                value,
                                name === 'tasksCompleted' ? 'Task completati' : 'Story Points'
                            ]}
                        />
                        <Legend
                            formatter={(value) => value === 'tasksCompleted' ? 'Task completati' : 'Story Points'}
                        />
                        <Bar
                            dataKey="tasksCompleted"
                            fill="hsl(var(--primary))"
                            radius={[4, 4, 0, 0]}
                            name="tasksCompleted"
                        />
                        <ReferenceLine
                            y={averageVelocity}
                            stroke="hsl(var(--destructive))"
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            label={{
                                value: `Media: ${averageVelocity}`,
                                position: "right",
                                fontSize: 11,
                                fill: 'hsl(var(--destructive))'
                            }}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

export default { BurndownChart, VelocityChart };
