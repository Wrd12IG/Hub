'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface WeeklyTrendChartProps {
    data: Array<{
        date: string;
        fullDate: string;
        created: number;
        completed: number;
    }>;
}

export function WeeklyTrendChart({ data }: WeeklyTrendChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-6 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h3 className="font-semibold text-green-900 dark:text-green-100">
                        Trend Settimanale
                    </h3>
                </div>
                <p className="text-sm text-muted-foreground text-center py-8">
                    Nessun dato disponibile
                </p>
            </div>
        );
    }

    const totalCreated = data.reduce((sum, d) => sum + d.created, 0);
    const totalCompleted = data.reduce((sum, d) => sum + d.completed, 0);
    const completionRate = totalCreated > 0 ? (totalCompleted / totalCreated * 100) : 0;

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                    <p className="font-semibold text-sm mb-2">{data.date} ({data.fullDate})</p>
                    <div className="space-y-1">
                        <p className="text-sm text-green-600 dark:text-green-400">
                            ✓ {data.completed} completati
                        </p>
                        <p className="text-sm text-yellow-600 dark:text-yellow-400">
                            + {data.created} creati
                        </p>
                        {data.created > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                                {((data.completed / data.created) * 100).toFixed(0)}% completamento
                            </p>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-6 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h3 className="font-semibold text-green-900 dark:text-green-100">
                        Trend Settimanale
                    </h3>
                </div>
                <div className="text-sm">
                    <span className="text-muted-foreground">Completamento: </span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                        {completionRate.toFixed(0)}%
                    </span>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        stroke="#9ca3af"
                    />
                    <YAxis
                        tick={{ fontSize: 12 }}
                        stroke="#9ca3af"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        wrapperStyle={{ fontSize: '12px' }}
                        iconType="line"
                    />
                    <Line
                        type="monotone"
                        dataKey="completed"
                        stroke="#34A853"
                        strokeWidth={2}
                        dot={{ fill: '#34A853', r: 4 }}
                        activeDot={{ r: 6 }}
                        name="Completati"
                    />
                    <Line
                        type="monotone"
                        dataKey="created"
                        stroke="#FBBC05"
                        strokeWidth={2}
                        dot={{ fill: '#FBBC05', r: 4 }}
                        activeDot={{ r: 6 }}
                        name="Creati"
                    />
                </LineChart>
            </ResponsiveContainer>

            <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-muted-foreground mb-1">Task Creati</p>
                        <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                            {totalCreated}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground mb-1">Task Completati</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {totalCompleted}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
