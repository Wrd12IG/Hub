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
    FolderOpen,
    BarChart3,
    BookOpen,
    UserRoundX,
    Compass,
    Search,
    Zap,
    FolderPlus,
    ListPlus,
    Users,
    Settings,
    CalendarDays,
    FolderSync,
    ScanSearch,
    UserCog,
    Repeat,
    Send,
} from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCommandMenu } from '@/components/command-menu';
import { useLayoutData } from '@/app/(app)/layout-context';
import { PAGES_ALWAYS_FOR_PM, isProjectManagerRole } from '@/lib/nav-permissions';
import { RolePermissions } from '@/lib/data';
import { useClientTodo } from '@/hooks/use-client-todo';
import { REPORT_SECTION_HREFS } from '@/lib/report-nav';

// ── Stessa struttura di allNavItems dalla sidebar ──
interface DockNavItem {
    label: string;
    /** Nome breve scritto sotto l'icona sugli schermi larghi (il tooltip mostra quello completo). */
    short?: string;
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
    /** Numero in un pallino sull'icona (es. contenuti da approvare). Assente o 0 = niente pallino. */
    badge?: number;
}

// Un colore per gruppo (si legge come un blocco) e un'icona diversa per ogni voce.
const allNavItems: DockNavItem[] = [
    // Lavoro quotidiano
    { href: '/dashboard', icon: Gauge, label: 'Dashboard', short: 'Home', color: 'text-blue-500', group: 'lavoro' },
    { href: '/tasks', icon: ClipboardList, label: 'Tasks', short: 'Task', color: 'text-blue-500', group: 'lavoro' },
    { href: '/projects', icon: LayoutGrid, label: 'Progetti', color: 'text-blue-500', group: 'lavoro' },
    { href: '/calendar', icon: Calendar, label: 'Calendario', color: 'text-blue-500', group: 'lavoro' },
    // Clienti
    { href: '/clients', icon: Users, label: 'Clienti', color: 'text-cyan-500', group: 'clienti' },
    { href: '/briefs', icon: BookOpen, label: 'Brief', color: 'text-cyan-500', group: 'clienti' },
    { href: '/editorial-plan', icon: CalendarDays, label: 'Piano Editoriale', short: 'Piano', color: 'text-cyan-500', altHrefs: ['/import-editorial'], group: 'clienti' },
    { href: '/social-strategies', icon: Compass, label: 'Strategie Social', short: 'Strategie', color: 'text-cyan-500', group: 'clienti' },
    { href: '/documents', icon: FolderOpen, label: 'Documenti e Media', short: 'Documenti', color: 'text-cyan-500', altHrefs: ['/assets'], group: 'clienti' },
    // Team
    { href: '/chat', icon: MessageSquare, label: 'Chat', color: 'text-emerald-500', group: 'team' },
    { href: '/absences', icon: UserRoundX, label: 'Assenze', color: 'text-emerald-500', group: 'team' },
    // Analisi
    // Una voce sola: le altre pagine (Analisi, Andamento clienti, KPI concessionari, Mail mensile) sono schede dei Report
    { href: '/reports', icon: BarChart3, label: 'Report', color: 'text-violet-500', altHrefs: REPORT_SECTION_HREFS.filter(h => h !== '/reports'), group: 'analisi' },
    // Configurazione: i ricorrenti sono modelli che si impostano una volta, non lavoro quotidiano
    { href: '/admin/recurring-tasks', icon: Repeat, label: 'Task Ricorrenti', short: 'Ricorrenti', permission: '_create-recurring-projects', color: 'text-orange-500', group: 'admin' },
    { href: '/admin/recurring-projects', icon: FolderSync, label: 'Progetti Ricorrenti', short: 'Prog. ricorr.', permission: '_create-recurring-projects', color: 'text-orange-500', group: 'admin' },
];

// Crescita e amministrazione
const adminNavItems: DockNavItem[] = [
    { href: '/site-monitor', icon: ScanSearch, label: 'Monitor siti', short: 'Monitor', color: 'text-violet-500', group: 'analisi' },
    { href: '/outreach', icon: Send, label: 'Outreach', color: 'text-violet-500', group: 'analisi' },
    { href: '/admin', icon: Settings, label: 'Pannello Admin', short: 'Admin', color: 'text-orange-500', group: 'admin' },
    { href: '/admin/assegnazioni', icon: UserCog, label: 'Assegnazioni', color: 'text-orange-500', group: 'admin' },
];

// Ordine finale delle aree: le voci della stessa area devono stare vicine anche se arrivano da elenchi diversi
const GROUP_ORDER: NonNullable<DockNavItem['group']>[] = ['lavoro', 'clienti', 'team', 'analisi', 'admin'];
const byGroup = (items: DockNavItem[]) =>
    [...items].sort((a, b) => GROUP_ORDER.indexOf(a.group ?? 'admin') - GROUP_ORDER.indexOf(b.group ?? 'admin'));

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
    // Solo per l'accesso Cliente: quanti contenuti aspettano la sua approvazione
    const { toApprove } = useClientTodo(currentUser?.role === 'Cliente' ? currentUser.clientId : null, pathname);

    // ── Filtra link navigazione in base ai permessi (identico alla sidebar) ──
    const visibleNavItems = useMemo(() => {
        if (!currentUser) return [];

        // L'accesso «Cliente» ha tre pagine, tutte del proprio cliente: risultati, piano editoriale (PED) e brief
        if (currentUser.role === 'Cliente') {
            if (!currentUser.clientId) return [];
            const home = `/clients/${currentUser.clientId}`;
            return [
                { href: home, icon: BarChart3, label: 'I miei risultati', color: 'text-amber-500', exact: true },
                { href: `${home}/editorial-plan`, icon: Calendar, label: 'Piano editoriale', color: 'text-pink-500', badge: toApprove ?? 0 },
                { href: `${home}/briefs`, icon: BookOpen, label: 'Brief', color: 'text-indigo-500' },
            ] as DockNavItem[];
        }

        const roleName = (currentUser.role || '').trim();
        const normalizedRole = roleName.toLowerCase();

        if (normalizedRole === 'amministratore' || normalizedRole === 'admin') {
            return byGroup([...allNavItems, ...adminNavItems]);
        }

        const userPermissions = getRolePermissions(roleName, permissions);

        const mainItems = allNavItems.filter(item => {
            const isRecurringItem = item.href.includes('recurring');
            if (item.permission && userPermissions.includes(item.permission)) return true;
            if (userPermissions.includes(item.href)) return true;
            if (item.altHrefs?.some(h => userPermissions.includes(h))) return true;
            const isPM = isProjectManagerRole(normalizedRole);
            if (isPM && PAGES_ALWAYS_FOR_PM.includes(item.href)) return true;
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

        return byGroup([...mainItems, ...adminItems]);
    }, [currentUser, permissions, toApprove]);

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
                                                'relative p-2 xl:px-1.5 xl:py-1 rounded-xl flex items-center xl:flex-col justify-center gap-1.5 xl:gap-0.5 transition-all duration-200',
                                                isActive
                                                    ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                            )}
                                        >
                                            {/* Icone monocromatiche: il colore resta solo alla voce attiva, così si vede dove sei */}
                                            <Icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground")} />
                                            {/* Su schermi larghi ogni voce ha il suo nome sotto l'icona; sotto i 1280px solo la voce attiva */}
                                            <span className={cn(
                                                'whitespace-nowrap',
                                                'xl:inline xl:text-[11px] xl:leading-tight xl:font-medium',
                                                isActive ? 'hidden md:inline text-xs font-semibold pr-1 xl:pr-0' : 'hidden'
                                            )}>
                                                <span className="xl:hidden">{item.label}</span>
                                                <span className="hidden xl:inline">{item.short ?? item.label}</span>
                                            </span>
                                            {!!item.badge && item.badge > 0 && (
                                                <span
                                                    aria-label={`${item.badge} da approvare`}
                                                    className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground"
                                                >
                                                    {item.badge > 9 ? '9+' : item.badge}
                                                </span>
                                            )}
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
