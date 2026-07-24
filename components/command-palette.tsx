'use client';

import React, { useState, useEffect } from 'react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from '@/components/ui/command';
import { useLayoutData } from '@/app/(app)/layout-context';
import { useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    CheckSquare,
    FolderKanban,
    Calendar as CalendarIcon,
    Users,
    Sparkles,
    Settings,
    UserCheck,
    Plus,
    Building2,
    Search,
    Shield
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getUserAvatar, getInitials } from '@/lib/utils';

export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const { clients, users, currentUser } = useLayoutData();
    const router = useRouter();

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    const runCommand = (command: () => void) => {
        setOpen(false);
        command();
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/60 bg-muted/30 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-all duration-200 shadow-sm"
            >
                <Search className="h-3.5 w-3.5" />
                <span>Cerca nell'Hub...</span>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 ml-2">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </button>

            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Cerca pagine, clienti, task o colleghi (Cmd + K)..." />
                <CommandList className="max-h-[380px] overflow-y-auto p-2">
                    <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
                        Nessun risultato trovato.
                    </CommandEmpty>

                    {/* Navigazione Principale */}
                    <CommandGroup heading="Navigazione">
                        <CommandItem onSelect={() => runCommand(() => router.push('/dashboard'))}>
                            <LayoutDashboard className="mr-2 h-4 w-4 text-primary" />
                            <span>Dashboard Generale</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push('/tasks'))}>
                            <CheckSquare className="mr-2 h-4 w-4 text-blue-500" />
                            <span>Attività & Task</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push('/projects'))}>
                            <FolderKanban className="mr-2 h-4 w-4 text-purple-500" />
                            <span>Progetti</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push('/calendar'))}>
                            <CalendarIcon className="mr-2 h-4 w-4 text-amber-500" />
                            <span>Calendario Editoriale</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push('/social-strategies'))}>
                            <Sparkles className="mr-2 h-4 w-4 text-emerald-500" />
                            <span>Strategie Social AI</span>
                        </CommandItem>
                        {currentUser?.role === 'Amministratore' && (
                            <CommandItem onSelect={() => runCommand(() => router.push('/admin'))}>
                                <Shield className="mr-2 h-4 w-4 text-rose-500" />
                                <span>Pannello Admin & Gestione</span>
                            </CommandItem>
                        )}
                    </CommandGroup>

                    <CommandSeparator />

                    {/* Azioni Rapide */}
                    <CommandGroup heading="Azioni Rapide">
                        <CommandItem onSelect={() => runCommand(() => router.push('/tasks?action=new'))}>
                            <Plus className="mr-2 h-4 w-4 text-primary" />
                            <span>Crea Nuova Task</span>
                            <CommandShortcut>N</CommandShortcut>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push('/calendar?action=new-activity'))}>
                            <CalendarIcon className="mr-2 h-4 w-4 text-amber-500" />
                            <span>Nuovo Evento in Calendario</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => router.push('/social-strategies/new'))}>
                            <Sparkles className="mr-2 h-4 w-4 text-emerald-500" />
                            <span>Genera Strategia Social AI</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandSeparator />

                    {/* Clienti */}
                    {clients.length > 0 && (
                        <CommandGroup heading="Clienti">
                            {clients.map(client => (
                                <CommandItem key={client.id} onSelect={() => runCommand(() => router.push(`/social-strategies/new?clientId=${client.id}`))}>
                                    <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                                    <span>{client.name}</span>
                                    {client.color && (
                                        <div className="ml-auto w-2.5 h-2.5 rounded-full" style={{ backgroundColor: client.color }} />
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    <CommandSeparator />

                    {/* Team & Colleghi */}
                    {users.length > 0 && (
                        <CommandGroup heading="Team & Colleghi">
                            {users.map(u => (
                                <CommandItem key={u.id} onSelect={() => runCommand(() => router.push('/admin'))}>
                                    <Avatar className="mr-2 h-5 w-5 border">
                                        <AvatarImage src={getUserAvatar(u)} alt={u.name} />
                                        <AvatarFallback className="text-[9px]">{getInitials(u.name)}</AvatarFallback>
                                    </Avatar>
                                    <span>{u.name}</span>
                                    <span className="ml-auto text-[10px] text-muted-foreground">{u.role}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}
                </CommandList>
            </CommandDialog>
        </>
    );
}
