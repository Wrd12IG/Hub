'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Users } from 'lucide-react';

interface TeamWorkloadChartProps {
    data: Array<{
        userId: string;
        userName: string;
        activeTasks: number;
        percentage: number;
    }>;
    avgWorkload: number;
}

export function TeamWorkloadChart({ data, avgWorkload }: TeamWorkloadChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 p-6 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    <h3 className="font-semibold text-orange-900 dark:text-orange-100">
                        Carico di Lavoro Team
                    </h3>
                </div>
                <p className="text-sm text-muted-foreground text-center py-8">
                    Nessun dato disponibile
                </p>
            </div>
        );
    }

    // Ordina per numero di task (decrescente)
    const sortedData = [...data].sort((a, b) => b.activeTasks - a.activeTasks);

    const getBarColor = (percentage: number) => {
        if (percentage > 150) return '#EA4335'; // Rosso - sovraccarico
        if (percentage > 100) return '#FBBC05'; // Giallo - sopra media
        if (percentage >= 50) return '#34A853';  // Verde - normale
        return '#9CA3AF'; // Grigio - sottoutilizzato
    };

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                    <p className="font-semibold text-sm mb-2">{data.userName}</p>
                    <div className="space-y-1">
                        <p className="text-sm">
                            <span className="text-muted-foreground">Task attivi: </span>
                            <span className="font-semibold">{data.activeTasks}</span>
                        </p>
                        <p className="text-sm">
                            <span className="text-muted-foreground">vs Media: </span>
                            <span className="font-semibold" style={{ color: getBarColor(data.percentage) }}>
                                {data.percentage.toFixed(0)}%
                            </span>
                        </p>
                        {data.percentage > 150 && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                ⚠️ Sovraccarico
                            </p>
                        )}
                        {data.percentage < 50 && data.activeTasks > 0 && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                ℹ️ Sottoutilizzato
                            </p>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    // Trova utenti con problemi
    const overloaded = sortedData.filter(u => u.percentage > 150).length;
    const underutilized = sortedData.filter(u => u.percentage < 50 && u.activeTasks > 0).length;

    return (
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 p-6 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    <h3 className="font-semibold text-orange-900 dark:text-orange-100">
                        Carico di Lavoro Team
                    </h3>
                </div>
                <div className="text-sm">
                    <span className="text-muted-foreground">Media: </span>
                    <span className="font-semibold text-orange-600 dark:text-orange-400">
                        {avgWorkload.toFixed(1)} task
                    </span>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sortedData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        type="number"
                        tick={{ fontSize: 12 }}
                        stroke="#9ca3af"
                    />
                    <YAxis
                        type="category"
                        dataKey="userName"
                        tick={{ fontSize: 12 }}
                        stroke="#9ca3af"
                        width={100}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine
                        x={avgWorkload}
                        stroke="#F97316"
                        strokeDasharray="3 3"
                        label={{ value: 'Media', position: 'top', fontSize: 10 }}
                    />
                    <Bar dataKey="activeTasks" radius={[0, 4, 4, 0]}>
                        {sortedData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={getBarColor(entry.percentage)}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>

            {/* Statistiche e legenda */}
            <div className="mt-4 pt-4 border-t border-orange-200 dark:border-orange-800">
                {/* Alert se ci sono problemi */}
                {(overloaded > 0 || underutilized > 0) && (
                    <div className="mb-3 p-3 bg-white/50 dark:bg-black/20 rounded-md">
                        {overloaded > 0 && (
                            <p className="text-sm text-red-600 dark:text-red-400 mb-1">
                                ⚠️ {overloaded} {overloaded === 1 ? 'utente sovraccarico' : 'utenti sovraccarichi'}
                            </p>
                        )}
                        {underutilized > 0 && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                ℹ️ {underutilized} {underutilized === 1 ? 'utente sottoutilizzato' : 'utenti sottoutilizzati'}
                            </p>
                        )}
                    </div>
                )}

                {/* Legenda */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-[#EA4335]"></div>
                        <span>Sovraccarico (&gt;150%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-[#FBBC05]"></div>
                        <span>Sopra media (100-150%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-[#34A853]"></div>
                        <span>Normale (50-100%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-[#9CA3AF]"></div>
                        <span>Sottoutilizzato (&lt;50%)</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
