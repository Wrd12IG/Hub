'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AnimatedCardProps {
    children: React.ReactNode;
    className?: string;
    delay?: number; // Delay in ms for staggered animation
    animationType?: 'fade-up' | 'fade-in' | 'scale' | 'slide-right';
    hoverEffect?: boolean;
}

export function AnimatedCard({
    children,
    className,
    delay = 0,
    animationType = 'fade-up',
    hoverEffect = true
}: AnimatedCardProps) {
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        // Apply delay for staggered effect
                        setTimeout(() => {
                            setIsVisible(true);
                        }, delay);
                    }
                });
            },
            { threshold: 0.1, rootMargin: '50px' }
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => observer.disconnect();
    }, [delay]);

    const animationClasses = {
        'fade-up': 'translate-y-4 opacity-0',
        'fade-in': 'opacity-0',
        'scale': 'scale-95 opacity-0',
        'slide-right': 'translate-x-4 opacity-0'
    };

    return (
        <Card
            ref={ref}
            className={cn(
                // Base styles
                "transition-all duration-500 ease-out",
                // Animation start state
                !isVisible && animationClasses[animationType],
                // Animation end state
                isVisible && "translate-y-0 translate-x-0 scale-100 opacity-100",
                // Hover effects
                hoverEffect && "hover:shadow-lg hover:-translate-y-1 hover:border-primary/30",
                className
            )}
            style={{
                transitionDelay: isVisible ? '0ms' : `${delay}ms`
            }}
        >
            {children}
        </Card>
    );
}

// KPI Card with animated counter built-in
interface AnimatedKPICardProps {
    title: string;
    value: number;
    icon?: React.ReactNode;
    suffix?: string;
    prefix?: string;
    formatValue?: (v: number) => string;
    description?: string;
    trend?: { value: number; isPositive: boolean };
    delay?: number;
    className?: string;
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'primary';
}

export function AnimatedKPICard({
    title,
    value,
    icon,
    suffix = '',
    prefix = '',
    formatValue,
    description,
    trend,
    delay = 0,
    className,
    variant = 'default'
}: AnimatedKPICardProps) {
    const [displayValue, setDisplayValue] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !isVisible) {
                        setTimeout(() => {
                            setIsVisible(true);

                            // Start counter animation
                            const duration = 1500;
                            const startTime = performance.now();

                            const animate = (currentTime: number) => {
                                const elapsed = currentTime - startTime;
                                const progress = Math.min(elapsed / duration, 1);
                                const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

                                setDisplayValue(value * easeProgress);

                                if (progress < 1) {
                                    requestAnimationFrame(animate);
                                }
                            };

                            requestAnimationFrame(animate);
                        }, delay);
                    }
                });
            },
            { threshold: 0.1 }
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => observer.disconnect();
    }, [value, delay, isVisible]);

    // Update for value changes after initial animation
    useEffect(() => {
        if (isVisible) {
            const duration = 800;
            const startValue = displayValue;
            const startTime = performance.now();

            const animate = (currentTime: number) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

                setDisplayValue(startValue + (value - startValue) * easeProgress);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            };

            if (Math.abs(displayValue - value) > 0.1) {
                requestAnimationFrame(animate);
            }
        }
    }, [value]);

    const variantStyles = {
        default: '',
        success: 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 border-green-200 dark:border-green-800',
        warning: 'bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/20 dark:to-amber-900/20 border-amber-200 dark:border-amber-800',
        danger: 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/20 dark:to-red-900/20 border-red-200 dark:border-red-800',
        primary: 'bg-gradient-to-br from-primary/10 to-primary/20 border-primary/30'
    };

    const textStyles = {
        default: 'text-foreground',
        success: 'text-green-700 dark:text-green-300',
        warning: 'text-amber-700 dark:text-amber-300',
        danger: 'text-red-700 dark:text-red-300',
        primary: 'text-primary'
    };

    const formattedValue = formatValue
        ? formatValue(displayValue)
        : Math.round(displayValue).toString();

    return (
        <Card
            ref={ref}
            className={cn(
                "transition-all duration-500 ease-out hover:shadow-lg hover:-translate-y-1",
                !isVisible && "translate-y-4 opacity-0",
                isVisible && "translate-y-0 opacity-100",
                variantStyles[variant],
                className
            )}
        >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={cn("text-sm font-medium", textStyles[variant])}>
                    {title}
                </CardTitle>
                {icon && (
                    <div className={cn("h-4 w-4", textStyles[variant])}>
                        {icon}
                    </div>
                )}
            </CardHeader>
            <CardContent>
                <div className={cn("text-2xl font-bold tabular-nums", textStyles[variant])}>
                    {prefix}{formattedValue}{suffix}
                </div>
                {description && (
                    <p className={cn("text-xs mt-1 opacity-70", textStyles[variant])}>
                        {description}
                    </p>
                )}
                {trend && (
                    <div className={cn(
                        "flex items-center text-xs mt-2",
                        trend.isPositive ? "text-green-600" : "text-red-600"
                    )}>
                        <span>{trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
                        <span className="text-muted-foreground ml-1">vs settimana scorsa</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
