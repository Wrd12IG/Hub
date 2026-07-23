'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    Gauge,
    ClipboardList,
    LayoutGrid,
    Calendar,
    MessageSquare,
    FileText,
    BarChart3,
    BookOpen,
    CalendarX2,
    Bot,
    Image as ImageIcon,
    Search,
    Zap,
    FolderPlus,
    ListPlus,
    Users,
    Settings,
    Upload,
    Library,
    Repeat,
} from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCommandMenu } from '@/components/command-menu';
import { useLayoutData } from '@/app/(app)/layout-context';
import { RolePermissions } from '@/lib/data';

// ── Stessa struttura di allNavItems dalla sidebar ──
interface DockNavItem {
    label: string;
    href: string;
    icon: React.ElementType;
    permission?: string;
}

const allNavItems: DockNavItem[] = [
    { href: '/dashboard', icon: Gauge, label: 'Dashboard' },
    { href: '/tasks', icon: ClipboardList, label: 'Tasks' },
    { href: '/admin/recurring-tasks', icon: Repeat, label: 'Task Ricorrenti', permission: '_create-recurring-projects' },
    { href: '/projects', icon: LayoutGrid, label: 'Progetti' },
    { href: '/admin/recurring-projects', icon: Library, label: 'Progetti Ricorrenti', permission: '_create-recurring-projects' },
    { href: '/briefs', icon: BookOpen, label: 'Briefs' },
    { href: '/calendar', icon: Calendar, label: 'Calendario' },
    { href: '/social-strategies', icon: Bot, label: 'Strategie Social' },
    { href: '/absences', icon: CalendarX2, label: 'Assenze' },
    { href: '/chat', icon: MessageSquare, label: 'Chat' },
    { href: '/clients', icon: Users, label: 'Clienti' },
    { href: '/documents', icon: FileText, label: 'Documenti' },
    { href: '/assets', icon: ImageIcon, label: 'Media & Assets' },
    { href: '/reports', icon: BarChart3, label: 'Report' },
];

const adminNavItems: DockNavItem[] = [
    { href: '/admin', icon: Settings, label: 'Pannello Admin' },
    { href: '/import-editorial', icon: Upload, label: 'Importa Piano' },
];

const clientNavItems: DockNavItem[] = [
    { href: '/briefs', icon: BookOpen, label: 'Briefs' },
    { href: '/documents', icon: FileText, label: 'Documenti' },
];

// ── Quick Actions ──
interface QuickAction {
    label: string;
    href: string;
    icon: React.ElementType;
    color: string;
    shadowColor: string;
    requiredPage: string; // la pagina deve essere visibile per mostrare l'azione
}

const allQuickActions: QuickAction[] = [
    {
        label: 'Nuovo Task',
        href: '/tasks?action=new',
        icon: ListPlus,
        color: 'bg-emerald-500 hover:bg-emerald-400 text-white',
        shadowColor: 'shadow-emerald-500/25',
        requiredPage: '/tasks',
    },
    {
        label: 'Nuova Attività',
        href: '/tasks?action=new-activity',
        icon: Zap,
        color: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
        shadowColor: 'shadow-amber-500/25',
        requiredPage: '/tasks',
    },
    {
        label: 'Nuovo Progetto',
        href: '/projects?action=new',
        icon: FolderPlus,
        color: 'bg-blue-500 hover:bg-blue-400 text-white',
        shadowColor: 'shadow-blue-500/25',
        requiredPage: '/projects',
    },
];

// ── Stessa logica della sidebar per i permessi ──
function getRolePermissions(role: string, perms: RolePermissions): string[] {
    const normalized = (role || '').trim().toLowerCase();
    if (!normalized) return [];

    const keys = Object.keys(perms);
    const exactMatchKey = keys.find(k => k.trim().toLowerCase() === normalized);
    if (exactMatchKey) return perms[exactMatchKey];

    const isPM = (normalized.includes('project') && normalized.includes('manager')) || normalized === 'pm';
    if (isPM) {
        const pmKey = keys.find(k => {
            const lk = k.toLowerCase().trim();
            return (lk.includes('project') && lk.includes('manager')) || lk === 'pm' || lk === 'project manager';
        });
        if (pmKey) return perms[pmKey];
    }

    return perms[role] || [];
}

export function FloatingCommandDock() {
    const pathname = usePathname();
    const { setOpen: setCommandOpen } = useCommandMenu();
    const { currentUser, permissions } = useLayoutData();

    // ── Filtra link navigazione in base ai permessi (identico alla sidebar) ──
    const visibleNavItems = useMemo(() => {
        if (!currentUser) return [];

        if (currentUser.role === 'Cliente') return clientNavItems;

        const roleName = (currentUser.role || '').trim();
        const normalizedRole = roleName.toLowerCase();

        if (normalizedRole === 'amministratore' || normalizedRole === 'admin') {
            return [...allNavItems, ...adminNavItems];
        }

        const userPermissions = getRolePermissions(roleName, permissions);

        const mainItems = allNavItems.filter(item => {
            const isRecurringItem = item.href.includes('recurring');
            if (item.permission && userPermissions.includes(item.permission)) return true;
            if (userPermissions.includes(item.href)) return true;
            const isPM = (normalizedRole.includes('project') && normalizedRole.includes('manager')) || normalizedRole === 'pm';
            if (isPM && isRecurringItem) {
                return userPermissions.includes('_create-recurring-projects') || userPermissions.includes(item.href);
            }
            return false;
        });

        const adminItems = adminNavItems.filter(item => {
            const isPM = (normalizedRole.includes('project') && normalizedRole.includes('manager')) || normalizedRole === 'pm';
            if (isPM && item.href.includes('recurring')) {
                return userPermissions.includes('_create-recurring-projects') || userPermissions.includes(item.href);
            }
            if (item.href === '/admin') return userPermissions.includes(item.href);
            const hasPermission = item.permission ? userPermissions.includes(item.permission) : false;
            return hasPermission || userPermissions.includes(item.href);
        });

        return [...mainItems, ...adminItems];
    }, [currentUser, permissions]);

    // ── Filtra azioni rapide: mostra solo se l'utente ha accesso alla pagina relativa ──
    const visibleQuickActions = useMemo(() => {
        const visibleHrefs = new Set(visibleNavItems.map(i => i.href));
        return allQuickActions.filter(action => visibleHrefs.has(action.requiredPage));
    }, [visibleNavItems]);

    if (!currentUser) return null;

    return (
        <TooltipProvider delayDuration={100}>
            <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-background/90 backdrop-blur-xl border border-border/60 shadow-2xl shadow-black/30 transition-all duration-300 hover:border-primary/30">

                {/* ── Quick Actions (solo se visibili) ── */}
                {visibleQuickActions.length > 0 && (
                    <>
                        <div className="flex items-center gap-1">
                            {visibleQuickActions.map((action) => {
                                const Icon = action.icon;
                                return (
                                    <Tooltip key={action.href}>
                                        <TooltipTrigger asChild>
                                            <Link
                                                href={action.href}
                                                className={cn(
                                                    'p-2 rounded-xl flex items-center justify-center transition-all duration-200 shadow-md hover:scale-110 active:scale-95',
                                                    action.color,
                                                    action.shadowColor,
                                                )}
                                            >
                                                <Icon className="h-4 w-4" />
                                            </Link>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="font-semibold text-xs">
                                            {action.label}
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            })}
                        </div>
                        <div className="h-6 w-px bg-border/50 mx-1" />
                    </>
                )}

                {/* ── Menu Globale (filtrato per permessi) ── */}
                <nav className="flex items-center gap-0.5">
                    {visibleNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive =
                            pathname === item.href ||
                            (item.href !== '/dashboard' && pathname.startsWith(item.href));

                        return (
                            <Tooltip key={item.href}>
                                <TooltipTrigger asChild>
                                    <Link
                                        href={item.href}
                                        className={cn(
                                            'relative p-2 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110',
                                            isActive
                                                ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {isActive && (
                                            <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                                        )}
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs font-medium">
                                    {item.label}
                                </TooltipContent>
                            </Tooltip>
                        );
                    })}
                </nav>

                <div className="h-6 w-px bg-border/50 mx-1" />

                {/* ── Ricerca (⌘K) ── */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => setCommandOpen(true)}
                            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 hover:scale-110 flex items-center gap-1.5"
                        >
                            <Search className="h-4 w-4" />
                            <kbd className="hidden lg:inline-block text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border font-mono">
                                ⌘K
                            </kbd>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs font-medium">
                        Cerca o esegui comandi (⌘K)
                    </TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    );
}

export default FloatingCommandDock;
