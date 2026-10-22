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
    color?: string;
    /** Area di appartenenza: le voci della stessa area stanno vicine, tra le aree c'è un divisore. */
    group?: 'lavoro' | 'clienti' | 'team' | 'analisi' | 'admin';
    /** Altri percorsi che danno accesso alla stessa voce (es. il vecchio /assets per Documenti e Media). */
    altHrefs?: string[];
    /** Attiva solo sull'indirizzo esatto: serve quando altre voci stanno sotto lo stesso percorso (accesso Cliente). */
    exact?: boolean;
}

const allNavItems: DockNavItem[] = [
    { href: '/dashboard', icon: Gauge, label: 'Dashboard', color: 'text-blue-500', group: 'lavoro' },
    { href: '/tasks', icon: ClipboardList, label: 'Tasks', color: 'text-sky-500', group: 'lavoro' },
    { href: '/admin/recurring-tasks', icon: Repeat, label: 'Task Ricorrenti', permission: '_create-recurring-projects', color: 'text-amber-500', group: 'lavoro' },
    { href: '/projects', icon: LayoutGrid, label: 'Progetti', color: 'text-purple-500', group: 'lavoro' },
    { href: '/admin/recurring-projects', icon: Library, label: 'Progetti Ricorrenti', permission: '_create-recurring-projects', color: 'text-indigo-500', group: 'lavoro' },
    { href: '/clients', icon: Users, label: 'Clienti', color: 'text-cyan-500', group: 'clienti' },
    { href: '/briefs', icon: BookOpen, label: 'Brief', color: 'text-amber-600', group: 'clienti' },
    { href: '/social-strategies', icon: Bot, label: 'Strategie Social', color: 'text-rose-500', group: 'clienti' },
    { href: '/documents', icon: FileText, label: 'Documenti e Media', color: 'text-blue-400', altHrefs: ['/assets'], group: 'clienti' },
    { href: '/calendar', icon: Calendar, label: 'Calendario', color: 'text-emerald-500', group: 'team' },
    { href: '/absences', icon: CalendarX2, label: 'Assenze', color: 'text-teal-500', group: 'team' },
    { href: '/chat', icon: MessageSquare, label: 'Chat', color: 'text-indigo-400', group: 'team' },
    { href: '/reports', icon: BarChart3, label: 'Report', color: 'text-violet-500', group: 'analisi' },
];

const adminNavItems: DockNavItem[] = [
    { href: '/admin', icon: Settings, label: 'Pannello Admin', color: 'text-rose-600', group: 'admin' },
    { href: '/import-editorial', icon: Upload, label: 'Importa Piano', color: 'text-orange-500', group: 'admin' },
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
        href: '/calendar?action=new-activity',
        icon: Zap,
        color: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
        shadowColor: 'shadow-amber-500/25',
        requiredPage: '/calendar',
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

        // L'accesso «Cliente» ha una sola pagina: i risultati del proprio cliente (Overview e Audit)
        if (currentUser.role === 'Cliente') {
            if (!currentUser.clientId) return [];
            const home = `/clients/${currentUser.clientId}`;
            return [
                { href: home, icon: BarChart3, label: 'I miei risultati', color: 'text-amber-500', exact: true },
                { href: `${home}/editorial-plan`, icon: Calendar, label: 'Piano editoriale', color: 'text-pink-500' },
                { href: `${home}/briefs`, icon: BookOpen, label: 'Brief', color: 'text-indigo-500' },
            ] as DockNavItem[];
        }

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
            if (item.altHrefs?.some(h => userPermissions.includes(h))) return true;
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
            <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-2 max-w-[calc(100vw-1.5rem)] overflow-x-auto rounded-2xl bg-background/90 backdrop-blur-xl border border-border/60 shadow-2xl shadow-black/30 transition-all duration-300 hover:border-primary/30">

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
                <nav aria-label="Navigazione principale" className="flex items-center gap-0.5">
                    {visibleNavItems.map((item, index) => {
                        const Icon = item.icon;
                        const isActive = item.exact
                            ? pathname === item.href
                            : pathname === item.href ||
                              (item.href !== '/dashboard' && pathname.startsWith(item.href)) ||
                              !!item.altHrefs?.some(h => pathname.startsWith(h));
                        const startsNewGroup = index > 0 && item.group !== visibleNavItems[index - 1].group;

                        return (
                            <React.Fragment key={item.href}>
                                {startsNewGroup && <div className="h-6 w-px bg-border/50 mx-1.5" aria-hidden="true" />}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Link
                                            href={item.href}
                                            aria-label={item.label}
                                            aria-current={isActive ? 'page' : undefined}
                                            className={cn(
                                                'relative p-2 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-200 hover:scale-105',
                                                isActive
                                                    ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                            )}
                                        >
                                            <Icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-primary" : item.color || "text-muted-foreground")} />
                                            {/* La pagina corrente dice il suo nome: le altre icone restano compatte con tooltip */}
                                            {isActive && <span className="hidden md:inline text-xs font-semibold whitespace-nowrap pr-1">{item.label}</span>}
                                        </Link>
                                    </TooltipTrigger>
                                    {/* La voce attiva ha già il nome scritto accanto all'icona: il suggerimento lo ripeterebbe */}
                                    {!isActive && (
                                        <TooltipContent side="top" className="text-xs font-medium">
                                            {item.label}
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            </React.Fragment>
                        );
                    })}
                </nav>

                {/* La ricerca/comandi (⌘K) porta a pagine dello staff: non per l'utente Cliente */}
                {currentUser?.role !== 'Cliente' && (
                <>
                <div className="h-6 w-px bg-border/50 mx-1" />

                {/* ── Ricerca (⌘K) ── */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => setCommandOpen(true)}
                            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 hover:scale-110 flex items-center gap-1.5"
                        >
                            <Search className="h-4 w-4" />
                            <kbd className="hidden lg:inline-block text-xs bg-muted px-1.5 py-0.5 rounded border border-border font-mono">
                                ⌘K
                            </kbd>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs font-medium">
                        Cerca o esegui comandi (⌘K)
                    </TooltipContent>
                </Tooltip>
                </>
                )}
            </div>
        </TooltipProvider>
    );
}

export default FloatingCommandDock;
