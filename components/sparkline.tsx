'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface SparklineProps {
    data: number[];
    width?: number;
    height?: number;
    color?: 'primary' | 'success' | 'warning' | 'danger';
    showArea?: boolean;
    strokeWidth?: number;
    className?: string;
}

const colorMap = {
    primary: {
        stroke: '#667eea',
        fill: 'rgba(102, 126, 234, 0.2)',
    },
    success: {
        stroke: '#22c55e',
        fill: 'rgba(34, 197, 94, 0.2)',
    },
    warning: {
        stroke: '#f59e0b',
        fill: 'rgba(245, 158, 11, 0.2)',
    },
    danger: {
        stroke: '#ef4444',
        fill: 'rgba(239, 68, 68, 0.2)',
    },
};

export function Sparkline({
    data,
    width = 100,
    height = 30,
    color = 'primary',
    showArea = true,
    strokeWidth = 2,
    className,
}: SparklineProps) {
    const path = useMemo(() => {
        if (!data || data.length < 2) return '';

        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;
        const padding = height * 0.1;
        const effectiveHeight = height - padding * 2;

        const points = data.map((value, index) => {
            const x = (index / (data.length - 1)) * width;
            const y = padding + effectiveHeight - ((value - min) / range) * effectiveHeight;
            return { x, y };
        });

        // Crea il path della linea
        const linePath = points
            .map((point, index) => {
                if (index === 0) return `M ${point.x} ${point.y}`;

                // Usa curve di Bezier per linee più smooth
                const prev = points[index - 1];
                const cpx = (prev.x + point.x) / 2;
                return `S ${cpx} ${prev.y} ${point.x} ${point.y}`;
            })
            .join(' ');

        return linePath;
    }, [data, width, height]);

    const areaPath = useMemo(() => {
        if (!data || data.length < 2 || !showArea) return '';

        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;
        const padding = height * 0.1;
        const effectiveHeight = height - padding * 2;

        const points = data.map((value, index) => {
            const x = (index / (data.length - 1)) * width;
            const y = padding + effectiveHeight - ((value - min) / range) * effectiveHeight;
            return { x, y };
        });

        // Crea il path dell'area
        const linePath = points
            .map((point, index) => {
                if (index === 0) return `M ${point.x} ${point.y}`;
                const prev = points[index - 1];
                const cpx = (prev.x + point.x) / 2;
                return `S ${cpx} ${prev.y} ${point.x} ${point.y}`;
            })
            .join(' ');

        // Chiudi l'area verso il basso
        const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
        return areaPath;
    }, [data, width, height, showArea]);

    if (!data || data.length < 2) {
        return null;
    }

    const colors = colorMap[color];

    return (
        <svg
            width={width}
            height={height}
            className={cn('sparkline-container', className)}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
        >
            {showArea && (
                <path
                    d={areaPath}
                    fill={colors.fill}
                    className="sparkline-area"
                />
            )}
            <path
                d={path}
                fill="none"
                stroke={colors.stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="sparkline"
            />
        </svg>
    );
}

// Variante per mostrare trend con indicatore
interface SparklineTrendProps extends SparklineProps {
    showTrend?: boolean;
    trendLabel?: string;
}

export function SparklineTrend({
    data,
    showTrend = true,
    trendLabel,
    ...props
}: SparklineTrendProps) {
    const trend = useMemo(() => {
        if (!data || data.length < 2) return 0;
        const first = data[0];
        const last = data[data.length - 1];
        if (first === 0) return last > 0 ? 100 : 0;
        return ((last - first) / first) * 100;
    }, [data]);

    const isPositive = trend >= 0;

    return (
        <div className="flex items-center gap-2">
            <Sparkline
                data={data}
                color={isPositive ? 'success' : 'danger'}
                {...props}
            />
            {showTrend && (
                <div className={cn(
                    'text-xs font-medium',
                    isPositive ? 'text-green-600' : 'text-red-600'
                )}>
                    {isPositive ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
                    {trendLabel && <span className="text-muted-foreground ml-1">{trendLabel}</span>}
                </div>
            )}
        </div>
    );
}

// Componente per KPI card con sparkline integrato
interface KpiSparklineProps {
    value: number;
    label: string;
    data: number[];
    format?: (value: number) => string;
    color?: 'primary' | 'success' | 'warning' | 'danger';
}

export function KpiSparkline({
    value,
    label,
    data,
    format = (v) => v.toString(),
    color = 'primary',
}: KpiSparklineProps) {
    const trend = useMemo(() => {
        if (!data || data.length < 2) return 0;
        const first = data[0];
        const last = data[data.length - 1];
        if (first === 0) return last > 0 ? 100 : 0;
        return ((last - first) / first) * 100;
    }, [data]);

    const isPositive = trend >= 0;

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold">{format(value)}</span>
                <span className={cn(
                    'text-xs font-medium flex items-center gap-0.5',
                    isPositive ? 'text-green-600' : 'text-red-600'
                )}>
                    {isPositive ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
                </span>
            </div>
            <span className="text-xs text-muted-foreground">{label}</span>
            <Sparkline
                data={data}
                width={120}
                height={24}
                color={color}
                strokeWidth={1.5}
            />
        </div>
    );
}
