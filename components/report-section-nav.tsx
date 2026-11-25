'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useLayoutData } from '@/app/(app)/layout-context';
import { activeReportTab, isAdminRole, reportTabs } from '@/lib/report-nav';

/**
 * La barra comune della sezione Report. Con una sola scheda disponibile non si mostra: una barra con un solo
 * elemento non serve a muoversi, solo a occupare spazio.
 */
export function ReportSectionNav({ className }: { className?: string }) {
    const pathname = usePathname();
    const { currentUser, canViewFinancials } = useLayoutData();
    const tabs = reportTabs({ isAdmin: isAdminRole(currentUser?.role), canViewFinancials });
    if (tabs.length < 2) return null;
    const active = activeReportTab(pathname);

    return (
        <nav aria-label="Sezioni dei Report" className={cn('flex flex-wrap gap-1 rounded-xl border bg-muted/40 p-1', className)}>
            {tabs.map((t) => (
                <Link
                    key={t.key}
                    href={t.href}
                    aria-current={active === t.key ? 'page' : undefined}
                    className={cn(
                        'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                        active === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                    )}
                >
                    {t.label}
                </Link>
            ))}
        </nav>
    );
}
