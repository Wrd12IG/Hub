'use client';

import { useState } from 'react';
import { useLayoutData } from '@/app/(app)/layout-context';
import { useTaskAnalytics, useTeamMetrics } from '@/hooks/useAnalytics';
import { MetricsGrid } from '@/components/analytics/metric-card';
import { ProductivityByHourChart } from '@/components/analytics/productivity-by-hour-chart';
import { WeeklyTrendChart } from '@/components/analytics/weekly-trend-chart';
import { StatusDistributionChart } from '@/components/analytics/status-distribution-chart';
import { TeamWorkloadChart } from '@/components/analytics/team-workload-chart';
import { Button } from '@/components/ui/button';
import { Calendar, Download, Filter } from 'lucide-react';
import { subDays } from 'date-fns';

export default function AnalyticsPage() {
    const { allTasks, users, currentUser } = useLayoutData();
    const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
        start: subDays(new Date(), 30),
        end: new Date()
    });

    // Calcola analytics
    const analytics = useTaskAnalytics(allTasks, users, dateRange);
    const teamMetrics = useTeamMetrics(allTasks, users);

    // Filtra task per utente se non admin
    const userTasks = currentUser?.role === 'Amministratore' || currentUser?.role === 'Project Manager'
        ? allTasks
        : allTasks.filter(t => t.assignedUserId === currentUser?.id);

    const handleExport = () => {
        // TODO: Implementare export PDF/Excel
        console.log('Export analytics...');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
                    <p className="text-muted-foreground mt-1">
                        Panoramica completa delle performance e metriche del team
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                        <Calendar className="w-4 h-4 mr-2" />
                        Ultimi 30 giorni
                    </Button>
                    <Button variant="outline" size="sm">
                        <Filter className="w-4 h-4 mr-2" />
                        Filtri
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <Download className="w-4 h-4 mr-2" />
                        Esporta
                    </Button>
                </div>
            </div>

            {/* Metriche Principali */}
            <section>
                <h2 className="text-xl font-semibold mb-4">Metriche Principali</h2>
                <MetricsGrid
                    completionRate={analytics.completionRate}
                    avgCompletionTime={analytics.avgCompletionTime}
                    overdueTasks={analytics.overdueTasks}
                    urgentTasks={analytics.urgentTasks}
                    efficiency={analytics.efficiency}
                    totalTasks={analytics.totalTasks}
                />
            </section>

            {/* Grafici Trend */}
            <section>
                <h2 className="text-xl font-semibold mb-4">Trend e Produttività</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <WeeklyTrendChart data={analytics.weeklyTrend} />
                    <ProductivityByHourChart tasks={userTasks} />
                </div>
            </section>

            {/* Distribuzioni */}
            <section>
                <h2 className="text-xl font-semibold mb-4">Distribuzioni</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <StatusDistributionChart data={analytics.tasksByStatus} />

                    {/* Priority Distribution */}
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 p-6 rounded-lg border border-indigo-200 dark:border-indigo-800">
                        <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 mb-4">
                            Distribuzione per Priorità
                        </h3>
                        <div className="space-y-3">
                            {Object.entries(analytics.tasksByPriority).map(([priority, count]) => {
                                const total = Object.values(analytics.tasksByPriority).reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? (count / total * 100) : 0;

                                const colors: Record<string, string> = {
                                    'Critica': 'bg-red-500',
                                    'Alta': 'bg-orange-500',
                                    'Media': 'bg-yellow-500',
                                    'Bassa': 'bg-blue-500',
                                };

                                return (
                                    <div key={priority}>
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <span className="font-medium">{priority}</span>
                                            <span className="text-muted-foreground">{count} ({percentage.toFixed(0)}%)</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div
                                                className={`${colors[priority]} h-2 rounded-full transition-all`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>

            {/* Team Performance */}
            {(currentUser?.role === 'Amministratore' || currentUser?.role === 'Project Manager') && (
                <section>
                    <h2 className="text-xl font-semibold mb-4">Performance Team</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Team Workload Chart */}
                        <div className="lg:col-span-2">
                            <TeamWorkloadChart
                                data={teamMetrics.workloadDistribution}
                                avgWorkload={teamMetrics.avgWorkload}
                            />
                        </div>

                        {/* Team Stats */}
                        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/20 dark:to-blue-950/20 p-6 rounded-lg border border-cyan-200 dark:border-cyan-800">
                            <h3 className="font-semibold text-cyan-900 dark:text-cyan-100 mb-4">
                                Statistiche Team
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Utenti Attivi</p>
                                    <p className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">
                                        {teamMetrics.totalActiveUsers}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Carico Medio</p>
                                    <p className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">
                                        {teamMetrics.avgWorkload.toFixed(1)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">task per utente</p>
                                </div>

                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Balance Score</p>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full transition-all ${teamMetrics.balanceScore >= 80 ? 'bg-green-500' :
                                                    teamMetrics.balanceScore >= 60 ? 'bg-yellow-500' :
                                                        'bg-red-500'
                                                    }`}
                                                style={{ width: `${teamMetrics.balanceScore}%` }}
                                            />
                                        </div>
                                        <span className="text-sm font-semibold">
                                            {teamMetrics.balanceScore}
                                        </span>
                                    </div>
                                </div>

                                {teamMetrics.overloadedUsers.length > 0 && (
                                    <div className="pt-4 border-t border-cyan-200 dark:border-cyan-800">
                                        <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                                            ⚠️ Utenti Sovraccarichi
                                        </p>
                                        <div className="space-y-1">
                                            {teamMetrics.overloadedUsers.map(user => (
                                                <p key={user.userId} className="text-xs text-muted-foreground">
                                                    • {user.userName} ({user.activeTasks} task)
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Top Performers */}
            {(currentUser?.role === 'Amministratore' || currentUser?.role === 'Project Manager') && (
                <section>
                    <h2 className="text-xl font-semibold mb-4">Top Performers</h2>
                    <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20 p-6 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {analytics.productivityByUser.slice(0, 3).map((user, index) => (
                                <div key={user.userId} className="text-center">
                                    <div className="text-4xl mb-2">
                                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                                    </div>
                                    <p className="font-semibold text-lg mb-1">{user.userName}</p>
                                    <p className="text-sm text-muted-foreground mb-2">
                                        {user.completedTasks} task completati
                                    </p>
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-[200px]">
                                            <div
                                                className="bg-yellow-500 h-2 rounded-full"
                                                style={{ width: `${user.completionRate}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-semibold">
                                            {user.completionRate.toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
