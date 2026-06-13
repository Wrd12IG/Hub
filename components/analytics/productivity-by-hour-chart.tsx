'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useProductivityByHour } from '@/hooks/useAnalytics';
import { Task } from '@/lib/data';
import { Clock } from 'lucide-react';

interface ProductivityByHourChartProps {
    tasks: Task[];
}

export function ProductivityByHourChart({ tasks }: ProductivityByHourChartProps) {
    const { hourlyData, peakHour } = useProductivityByHour(tasks);

    // Filtra solo ore con attività
    const activeHours = hourlyData.filter(h => h.tasksCompleted > 0);

    if (activeHours.length === 0) {
        return (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                        Produttività per Ora del Giorno
                    </h3>
                </div>
                <p className="text-sm text-muted-foreground text-center py-8">
                    Nessun dato disponibile
                </p>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                    <p className="font-semibold text-sm mb-1">{data.label}</p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                        {data.tasksCompleted} task completati
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {(data.timeSpent / 60).toFixed(1)}h lavorate
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                        Produttività per Ora del Giorno
                    </h3>
                </div>
                <div className="text-sm text-muted-foreground">
                    Picco: <span className="font-semibold text-blue-600 dark:text-blue-400">{peakHour}:00</span>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={activeHours}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 12 }}
                        stroke="#9ca3af"
                    />
                    <YAxis
                        tick={{ fontSize: 12 }}
                        stroke="#9ca3af"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="tasksCompleted" radius={[8, 8, 0, 0]}>
                        {activeHours.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.hour === peakHour ? '#4285F4' : '#93C5FD'}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-[#4285F4]"></div>
                        <span>Ora di picco</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-[#93C5FD]"></div>
                        <span>Altre ore</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
