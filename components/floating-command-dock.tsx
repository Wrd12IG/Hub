'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    Users,
    CheckSquare,
    Calendar,
    MessageSquare,
    Search,
    Zap,
} from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { useCommandMenu } from '@/components/command-menu';

interface DockItem {
    label: string;
    href: string;
    icon: React.ElementType;
}

const mainNavItems: DockItem[] = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Clienti', href: '/clients', icon: Users },
    { label: 'Task', href: '/tasks', icon: CheckSquare },
    { label: 'Calendario', href: '/calendar', icon: Calendar },
    { label: 'Chat', href: '/chat', icon: MessageSquare },
];

export function FloatingCommandDock() {
    const pathname = usePathname();
    const { setOpen: setCommandOpen } = useCommandMenu();

    return (
        <TooltipProvider delayDuration={150}>
            <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 p-2 rounded-2xl bg-background/85 backdrop-blur-xl border border-border/60 shadow-2xl shadow-black/40 transition-all duration-300 hover:border-primary/40">
                {/* Primary Quick Start Action Button */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            asChild
                            size="sm"
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all duration-200 hover:scale-105 active:scale-95"
                        >
                            <Link href="/tasks?action=new">
                                <Zap className="h-4 w-4 fill-slate-950" />
                                <span className="hidden md:inline text-xs tracking-tight">Nuova Attività</span>
                            </Link>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="font-semibold text-xs">
                        Avvia o registra una nuova attività
                    </TooltipContent>
                </Tooltip>

                <div className="h-5 w-px bg-border/60 mx-1" />

                {/* Main Navigation Items */}
                <nav className="flex items-center gap-1">
                    {mainNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));

                        return (
                            <Tooltip key={item.href}>
                                <TooltipTrigger asChild>
                                    <Link
                                        href={item.href}
                                        className={cn(
                                            'relative p-2 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110',
                                            isActive
                                                ? 'bg-primary/15 text-primary font-bold border border-primary/30 shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {isActive && (
                                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
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

                <div className="h-5 w-px bg-border/60 mx-1" />

                {/* Command Palette Trigger (⌘K) */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => setCommandOpen(true)}
                            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200 flex items-center gap-1 text-xs font-mono"
                        >
                            <Search className="h-4 w-4" />
                            <kbd className="hidden lg:inline-block text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">
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
