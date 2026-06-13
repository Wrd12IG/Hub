'use client';

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Target,
    Zap
} from 'lucide-react';

interface MetricCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: LucideIcon;
    trend?: {
        value: number;
        label: string;
    };
    color?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'gray';
    className?: string;
}

const colorClasses = {
    blue: {
        bg: 'from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20',
        border: 'border-blue-200 dark:border-blue-800',
        icon: 'text-blue-600 dark:text-blue-400',
        text: 'text-blue-900 dark:text-blue-100',
    },
    green: {
        bg: 'from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20',
        border: 'border-green-200 dark:border-green-800',
        icon: 'text-green-600 dark:text-green-400',
        text: 'text-green-900 dark:text-green-100',
    },
    orange: {
        bg: 'from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20',
        border: 'border-orange-200 dark:border-orange-800',
        icon: 'text-orange-600 dark:text-orange-400',
        text: 'text-orange-900 dark:text-orange-100',
    },
    red: {
        bg: 'from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20',
        border: 'border-red-200 dark:border-red-800',
        icon: 'text-red-600 dark:text-red-400',
        text: 'text-red-900 dark:text-red-100',
    },
    purple: {
        bg: 'from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20',
        border: 'border-purple-200 dark:border-purple-800',
        icon: 'text-purple-600 dark:text-purple-400',
        text: 'text-purple-900 dark:text-purple-100',
    },
    gray: {
        bg: 'from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20',
        border: 'border-gray-200 dark:border-gray-800',
        icon: 'text-gray-600 dark:text-gray-400',
        text: 'text-gray-900 dark:text-gray-100',
    },
};

export function MetricCard({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    color = 'blue',
    className
}: MetricCardProps) {
    const colors = colorClasses[color];

    const getTrendIcon = () => {
        if (!trend) return null;
        if (trend.value > 0) return <TrendingUp className="w-4 h-4" />;
        if (trend.value < 0) return <TrendingDown className="w-4 h-4" />;
        return <Minus className="w-4 h-4" />;
    };

    const getTrendColor = () => {
        if (!trend) return '';
        if (trend.value > 0) return 'text-green-600 dark:text-green-400';
        if (trend.value < 0) return 'text-red-600 dark:text-red-400';
        return 'text-gray-600 dark:text-gray-400';
    };

    return (
        <div className={cn(
            'bg-gradient-to-br p-6 rounded-lg border transition-all hover:shadow-md',
            colors.bg,
            colors.border,
            className
        )}>
            <div className="flex items-start justify-between mb-4">
                <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                        {title}
                    </p>
                    <h3 className={cn('text-3xl font-bold', colors.text)}>
                        {value}
                    </h3>
                </div>
                {Icon && (
                    <div className={cn('p-3 rounded-lg bg-white/50 dark:bg-black/20', colors.icon)}>
                        <Icon className="w-6 h-6" />
                    </div>
                )}
            </div>

            {(subtitle || trend) && (
                <div className="flex items-center justify-between text-sm">
                    {subtitle && (
                        <span className="text-muted-foreground">{subtitle}</span>
                    )}
                    {trend && (
                        <div className={cn('flex items-center gap-1 font-medium', getTrendColor())}>
                            {getTrendIcon()}
                            <span>{Math.abs(trend.value)}%</span>
                            <span className="text-xs text-muted-foreground ml-1">
                                {trend.label}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * Grid di metriche predefinite
 */
interface MetricsGridProps {
    completionRate: number;
    avgCompletionTime: number;
    overdueTasks: number;
    urgentTasks: number;
    efficiency: number;
    totalTasks: number;
}

export function MetricsGrid({
    completionRate,
    avgCompletionTime,
    overdueTasks,
    urgentTasks,
    efficiency,
    totalTasks
}: MetricsGridProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
                title="Tasso Completamento"
                value={`${completionRate.toFixed(1)}%`}
                subtitle={`${totalTasks} task totali`}
                icon={CheckCircle2}
                color={completionRate >= 80 ? 'green' : completionRate >= 60 ? 'orange' : 'red'}
                trend={{
                    value: completionRate >= 70 ? 5 : -3,
                    label: 'vs mese scorso'
                }}
            />

            <MetricCard
                title="Tempo Medio"
                value={`${avgCompletionTime.toFixed(1)}h`}
                subtitle="Per completare un task"
                icon={Clock}
                color="blue"
            />

            <MetricCard
                title="Task in Ritardo"
                value={overdueTasks}
                subtitle={overdueTasks === 0 ? 'Ottimo lavoro!' : 'Da completare'}
                icon={AlertTriangle}
                color={overdueTasks === 0 ? 'green' : overdueTasks <= 3 ? 'orange' : 'red'}
            />

            <MetricCard
                title="Task Urgenti"
                value={urgentTasks}
                subtitle="Scadenza < 24h"
                icon={Zap}
                color={urgentTasks === 0 ? 'green' : urgentTasks <= 5 ? 'orange' : 'red'}
            />

            <MetricCard
                title="Efficienza"
                value={`${efficiency.toFixed(0)}%`}
                subtitle="Tempo stimato vs effettivo"
                icon={Target}
                color={efficiency >= 90 ? 'green' : efficiency >= 70 ? 'blue' : 'orange'}
                trend={{
                    value: efficiency >= 90 ? 2 : -1,
                    label: 'vs settimana scorsa'
                }}
            />

            <MetricCard
                title="Produttività"
                value={completionRate >= 80 ? 'Alta' : completionRate >= 60 ? 'Media' : 'Bassa'}
                subtitle={`${completionRate.toFixed(0)}% task completati`}
                icon={TrendingUp}
                color={completionRate >= 80 ? 'green' : completionRate >= 60 ? 'blue' : 'orange'}
            />
        </div>
    );
}

/**
 * Mini metric card per dashboard compatta
 */
interface MiniMetricProps {
    label: string;
    value: string | number;
    icon?: LucideIcon;
    color?: 'green' | 'blue' | 'orange' | 'red';
}

export function MiniMetric({ label, value, icon: Icon, color = 'blue' }: MiniMetricProps) {
    const colorClass = {
        green: 'text-green-600 dark:text-green-400',
        blue: 'text-blue-600 dark:text-blue-400',
        orange: 'text-orange-600 dark:text-orange-400',
        red: 'text-red-600 dark:text-red-400',
    }[color];

    return (
        <div className="flex items-center gap-3 p-3 bg-white/50 dark:bg-black/20 rounded-lg">
            {Icon && <Icon className={cn('w-5 h-5', colorClass)} />}
            <div className="flex-1">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={cn('text-lg font-bold', colorClass)}>{value}</p>
            </div>
        </div>
    );
}
