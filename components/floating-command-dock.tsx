'use client';

import React from 'react';
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
    Plus,
    Zap,
    FolderPlus,
    ListPlus,
    Users,
} from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCommandMenu } from '@/components/command-menu';

interface DockItem {
    label: string;
    href: string;
    icon: React.ElementType;
}

interface QuickAction {
    label: string;
    href: string;
    icon: React.ElementType;
    color: string;
    hoverColor: string;
    shadowColor: string;
}

// ── Menu Globale (tutti i link principali dalla sidebar) ──
const globalNavItems: DockItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: Gauge },
    { label: 'Tasks', href: '/tasks', icon: ClipboardList },
    { label: 'Progetti', href: '/projects', icon: LayoutGrid },
    { label: 'Briefs', href: '/briefs', icon: BookOpen },
    { label: 'Calendario', href: '/calendar', icon: Calendar },
    { label: 'Strategie Social', href: '/social-strategies', icon: Bot },
    { label: 'Chat', href: '/chat', icon: MessageSquare },
    { label: 'Clienti', href: '/clients', icon: Users },
    { label: 'Documenti', href: '/documents', icon: FileText },
    { label: 'Media & Assets', href: '/assets', icon: ImageIcon },
    { label: 'Report', href: '/reports', icon: BarChart3 },
    { label: 'Assenze', href: '/absences', icon: CalendarX2 },
];

// ── Azioni Rapide ──
const quickActions: QuickAction[] = [
    {
        label: 'Nuovo Task',
        href: '/tasks?action=new',
        icon: ListPlus,
        color: 'bg-emerald-500 hover:bg-emerald-400 text-white',
        hoverColor: 'hover:scale-110',
        shadowColor: 'shadow-emerald-500/25',
    },
    {
        label: 'Nuova Attività',
        href: '/tasks?action=new-activity',
        icon: Zap,
        color: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
        hoverColor: 'hover:scale-110',
        shadowColor: 'shadow-amber-500/25',
    },
    {
        label: 'Nuovo Progetto',
        href: '/projects?action=new',
        icon: FolderPlus,
        color: 'bg-blue-500 hover:bg-blue-400 text-white',
        hoverColor: 'hover:scale-110',
        shadowColor: 'shadow-blue-500/25',
    },
];

export function FloatingCommandDock() {
    const pathname = usePathname();
    const { setOpen: setCommandOpen } = useCommandMenu();

    return (
        <TooltipProvider delayDuration={100}>
            <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-background/90 backdrop-blur-xl border border-border/60 shadow-2xl shadow-black/30 transition-all duration-300 hover:border-primary/30">

                {/* ── Quick Actions ── */}
                <div className="flex items-center gap-1">
                    {quickActions.map((action) => {
                        const Icon = action.icon;
                        return (
                            <Tooltip key={action.href}>
                                <TooltipTrigger asChild>
                                    <Link
                                        href={action.href}
                                        className={cn(
                                            'p-2 rounded-xl flex items-center justify-center transition-all duration-200 shadow-md active:scale-95',
                                            action.color,
                                            action.hoverColor,
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

                {/* ── Menu Globale ── */}
                <nav className="flex items-center gap-0.5">
                    {globalNavItems.map((item) => {
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
