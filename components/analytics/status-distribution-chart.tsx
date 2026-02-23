'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';

interface StatusDistributionChartProps {
    data: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
    'Da Fare': '#9CA3AF',
    'In Lavorazione': '#FBBC05',
    'In Approvazione': '#4285F4',
    'In Approvazione Cliente': '#A855F7',
    'Approvato': '#34A853',
    'Annullato': '#EA4335',
};

export function StatusDistributionChart({ data }: StatusDistributionChartProps) {
    const chartData = Object.entries(data)
        .filter(([_, value]) => value > 0)
        .map(([name, value]) => ({
            name,
            value,
            color: STATUS_COLORS[name] || '#9CA3AF'
        }));

    const total = chartData.reduce((sum, item) => sum + item.value, 0);

    if (total === 0) {
        return (
            <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 p-6 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-4">
                    <PieChartIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                        Distribuzione per Status
                    </h3>
                </div>
                <p className="text-sm text-muted-foreground text-center py-8">
                    Nessun task disponibile
                </p>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0];
            const percentage = ((data.value / total) * 100).toFixed(1);
            return (
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                    <p className="font-semibold text-sm mb-1">{data.name}</p>
                    <p className="text-sm" style={{ color: data.payload.color }}>
                        {data.value} task ({percentage}%)
                    </p>
                </div>
            );
        }
        return null;
    };

    const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
        if (percent < 0.05) return null; // Nascondi label per fette < 5%

        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
        const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);

        return (
            <text
                x={x}
                y={y}
                fill="white"
                textAnchor={x > cx ? 'start' : 'end'}
                dominantBaseline="central"
                fontSize={12}
                fontWeight="bold"
            >
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    return (
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 p-6 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 mb-4">
                <PieChartIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                    Distribuzione per Status
                </h3>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderCustomLabel}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                </PieChart>
            </ResponsiveContainer>

            {/* Legenda custom */}
            <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-800">
                <div className="grid grid-cols-2 gap-2">
                    {chartData.map((item) => {
                        const percentage = ((item.value / total) * 100).toFixed(1);
                        return (
                            <div key={item.name} className="flex items-center gap-2">
                                <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: item.color }}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {item.value} ({percentage}%)
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Totale */}
            <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">Totale Task</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {total}
                </p>
            </div>
        </div>
    );
}
