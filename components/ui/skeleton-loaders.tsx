'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function SkeletonBlock({ className = '' }: { className?: string }) {
    return (
        <div className={`animate-pulse rounded-xl bg-muted/60 dark:bg-muted/40 ${className}`} />
    );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <div className="w-full space-y-3 p-2">
            <div className="flex gap-4 border-b border-border/40 pb-3">
                {Array.from({ length: cols }).map((_, i) => (
                    <SkeletonBlock key={i} className="h-4 flex-1" />
                ))}
            </div>
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="flex gap-4 items-center py-2.5">
                    {Array.from({ length: cols }).map((_, c) => (
                        <SkeletonBlock key={c} className="h-5 flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <Card key={i} className="glass-card border-border/50">
                    <CardHeader className="pb-2">
                        <SkeletonBlock className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <SkeletonBlock className="h-8 w-3/4" />
                        <SkeletonBlock className="h-3 w-1/3" />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export function DashboardSkeleton() {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <CardGridSkeleton count={4} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 glass-card border-border/50">
                    <CardHeader>
                        <SkeletonBlock className="h-6 w-1/3" />
                    </CardHeader>
                    <CardContent className="h-64">
                        <SkeletonBlock className="h-full w-full rounded-2xl" />
                    </CardContent>
                </Card>
                <Card className="glass-card border-border/50">
                    <CardHeader>
                        <SkeletonBlock className="h-6 w-1/2" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <SkeletonBlock key={i} className="h-12 w-full rounded-xl" />
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
