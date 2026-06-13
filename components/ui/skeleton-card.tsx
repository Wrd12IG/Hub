'use client';

import { cn } from '@/lib/utils';
import React from 'react'; // Added React import for React.CSSProperties

interface SkeletonProps {
    className?: string;
    style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-md bg-gradient-to-r from-muted via-muted/80 to-muted",
                "relative overflow-hidden",
                "after:absolute after:inset-0 after:-translate-x-full",
                "after:animate-[shimmer_2s_infinite]",
                "after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent",
                className
            )}
            style={style}
        />
    );
}

// KPI Card Skeleton
export function SkeletonKPICard({ className }: SkeletonProps) {
    return (
        <div className={cn(
            "flex-1 min-w-[200px] rounded-lg border bg-card p-6",
            "animate-fade-in",
            className
        )}>
            <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-20" />
        </div>
    );
}

// Chart Card Skeleton
export function SkeletonChartCard({ className }: SkeletonProps) {
    return (
        <div className={cn(
            "rounded-lg border bg-card p-6",
            "animate-fade-in",
            className
        )}>
            <div className="mb-6">
                <Skeleton className="h-6 w-40 mb-2" />
                <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex items-end justify-between h-[250px] gap-4 px-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <Skeleton
                            className="w-full rounded-t-md"
                            style={{ height: `${Math.random() * 150 + 50}px` }}
                        />
                        <Skeleton className="h-3 w-12" />
                    </div>
                ))}
            </div>
            <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-3 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-3 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                </div>
            </div>
        </div>
    );
}

// Table Skeleton
export function SkeletonTableCard({ rows = 5, className }: SkeletonProps & { rows?: number }) {
    return (
        <div className={cn(
            "rounded-lg border bg-card p-6",
            "animate-fade-in",
            className
        )}>
            <div className="mb-4">
                <Skeleton className="h-6 w-48 mb-2" />
            </div>
            <div className="space-y-3">
                {[...Array(rows)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-md bg-muted/30">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1">
                            <Skeleton className="h-4 w-3/4 mb-2" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                        <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                ))}
            </div>
        </div>
    );
}

// Calendar Skeleton
export function SkeletonCalendarCard({ className }: SkeletonProps) {
    return (
        <div className={cn(
            "rounded-lg border bg-card p-6",
            "animate-fade-in",
            className
        )}>
            <div className="mb-4">
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex justify-center">
                <div className="w-full max-w-[300px]">
                    {/* Calendar header */}
                    <div className="flex justify-between items-center mb-4">
                        <Skeleton className="h-5 w-5 rounded" />
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-5 w-5 rounded" />
                    </div>
                    {/* Weekdays */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {[...Array(7)].map((_, i) => (
                            <Skeleton key={i} className="h-6 w-full rounded" />
                        ))}
                    </div>
                    {/* Days */}
                    {[...Array(5)].map((_, row) => (
                        <div key={row} className="grid grid-cols-7 gap-1 mb-1">
                            {[...Array(7)].map((_, col) => (
                                <Skeleton key={col} className="h-8 w-full rounded" />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Quick Actions Skeleton
export function SkeletonQuickActionsCard({ className }: SkeletonProps) {
    return (
        <div className={cn(
            "rounded-lg border bg-gradient-to-br from-accent/10 to-accent/20 border-accent/30 p-6",
            "animate-fade-in",
            className
        )}>
            <div className="mb-4">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-56" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
            </div>
        </div>
    );
}

// Dashboard Loading State - combines all skeletons
export function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Skeleton className="h-8 w-48 mb-2" />
                    <Skeleton className="h-4 w-80" />
                </div>
                <Skeleton className="h-9 w-28 rounded-md" />
            </div>

            {/* KPI Cards */}
            <div className="flex flex-wrap gap-4">
                {[...Array(6)].map((_, i) => (
                    <SkeletonKPICard key={i} />
                ))}
            </div>

            {/* Charts and Table Row */}
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                <SkeletonChartCard className="lg:col-span-2" />
                <SkeletonTableCard rows={5} />
            </div>

            {/* Calendar */}
            <SkeletonCalendarCard />

            {/* Quick Actions */}
            <SkeletonQuickActionsCard />
        </div>
    );
}

// Task Card Skeleton for Kanban Board
export function SkeletonTaskCard({ className }: SkeletonProps) {
    return (
        <div className={cn(
            "rounded-xl border bg-card p-4",
            "animate-fade-in",
            className
        )}>
            <div className="flex items-start justify-between mb-3">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-6 w-6 rounded" />
            </div>
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-5 w-full mb-2" />
            <Skeleton className="h-3 w-3/4 mb-4" />

            <div className="space-y-2 mb-4">
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="flex justify-between">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-8" />
                </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
                <div className="flex -space-x-1">
                    <Skeleton className="h-7 w-7 rounded-full" />
                    <Skeleton className="h-7 w-7 rounded-full" />
                </div>
                <div className="flex gap-1">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                </div>
            </div>
        </div>
    );
}

// Task Board (Kanban) Skeleton
export function SkeletonTaskBoard({ columns = 4, cardsPerColumn = 3 }: { columns?: number; cardsPerColumn?: number }) {
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Skeleton className="h-8 w-48 mb-2" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-24 rounded-md" />
                    <Skeleton className="h-9 w-32 rounded-md" />
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-3 p-4 rounded-lg border bg-muted/30">
                {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-9 w-40 rounded-md" />
                ))}
            </div>

            {/* Kanban Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(columns)].map((_, colIdx) => (
                    <div key={colIdx} className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <Skeleton className="h-5 w-24" />
                            <Skeleton className="h-5 w-8 rounded-full" />
                        </div>
                        {[...Array(cardsPerColumn)].map((_, cardIdx) => (
                            <SkeletonTaskCard key={cardIdx} />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

// Task List Skeleton
export function SkeletonTaskList({ rows = 8 }: { rows?: number }) {
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Skeleton className="h-8 w-48 mb-2" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-24 rounded-md" />
                    <Skeleton className="h-9 w-32 rounded-md" />
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-3 p-4 rounded-lg border bg-muted/30">
                {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-9 w-40 rounded-md" />
                ))}
            </div>

            {/* Table */}
            <div className="rounded-lg border bg-card">
                {/* Header */}
                <div className="flex items-center gap-4 p-4 border-b bg-muted/30">
                    {['Status', 'Cliente', 'Titolo', 'Assegnatario', 'Scadenza', 'Priorità', 'Azioni'].map((_, i) => (
                        <Skeleton key={i} className="h-4 flex-1" />
                    ))}
                </div>
                {/* Rows */}
                {[...Array(rows)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border-b last:border-b-0">
                        <Skeleton className="h-6 w-24 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 flex-1" />
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-6 w-20 rounded-full" />
                        <Skeleton className="h-6 w-16 rounded-full" />
                        <div className="flex gap-1">
                            <Skeleton className="h-8 w-8 rounded" />
                            <Skeleton className="h-8 w-8 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
