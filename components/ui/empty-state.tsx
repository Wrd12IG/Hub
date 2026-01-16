'use client';

import { cn } from '@/lib/utils';
import { LucideIcon, Inbox, FileText, FolderOpen, Calendar, MessageSquare, Users, ClipboardList, Search } from 'lucide-react';
import { Button } from './button';

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
    variant?: 'default' | 'compact' | 'card';
}

const defaultIcons: Record<string, LucideIcon> = {
    tasks: ClipboardList,
    documents: FileText,
    projects: FolderOpen,
    calendar: Calendar,
    chat: MessageSquare,
    users: Users,
    search: Search,
    default: Inbox,
};

export function EmptyState({
    icon: Icon = Inbox,
    title,
    description,
    action,
    className,
    variant = 'default',
}: EmptyStateProps) {
    const variants = {
        default: 'py-16',
        compact: 'py-8',
        card: 'py-12 bg-card border rounded-xl',
    };

    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center text-center px-4',
                variants[variant],
                className
            )}
            role="status"
            aria-label={title}
        >
            <div className="relative mb-4">
                {/* Animated background circles */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-20 w-20 rounded-full bg-primary/5 animate-pulse" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-16 w-16 rounded-full bg-primary/10 animate-pulse delay-75" />
                </div>
                {/* Icon */}
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                </div>
            </div>

            <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>

            {description && (
                <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
            )}

            {action && (
                <Button onClick={action.onClick} className="mt-2">
                    {action.label}
                </Button>
            )}
        </div>
    );
}

// Preset empty states for common use cases
export function EmptyTasksState({ onCreateTask }: { onCreateTask?: () => void }) {
    return (
        <EmptyState
            icon={ClipboardList}
            title="Nessun task trovato"
            description="Non ci sono task che corrispondono ai filtri selezionati. Prova a modificare i criteri di ricerca o crea un nuovo task."
            action={onCreateTask ? { label: 'Crea Nuovo Task', onClick: onCreateTask } : undefined}
        />
    );
}

export function EmptyProjectsState({ onCreateProject }: { onCreateProject?: () => void }) {
    return (
        <EmptyState
            icon={FolderOpen}
            title="Nessun progetto"
            description="Non hai ancora nessun progetto. Inizia creandone uno nuovo per organizzare i tuoi task."
            action={onCreateProject ? { label: 'Crea Nuovo Progetto', onClick: onCreateProject } : undefined}
        />
    );
}

export function EmptySearchState({ query }: { query?: string }) {
    return (
        <EmptyState
            icon={Search}
            title="Nessun risultato"
            description={query ? `Nessun risultato trovato per "${query}". Prova con termini diversi.` : 'Nessun risultato trovato per la tua ricerca.'}
            variant="compact"
        />
    );
}

export function EmptyNotificationsState() {
    return (
        <EmptyState
            icon={Inbox}
            title="Tutto in ordine!"
            description="Non hai notifiche non lette. Ottimo lavoro!"
            variant="compact"
        />
    );
}

export function EmptyChatState() {
    return (
        <EmptyState
            icon={MessageSquare}
            title="Nessun messaggio"
            description="Inizia una conversazione per collaborare con il tuo team."
        />
    );
}

export function EmptyCalendarState() {
    return (
        <EmptyState
            icon={Calendar}
            title="Calendario vuoto"
            description="Non ci sono eventi programmati per questo periodo."
            variant="compact"
        />
    );
}

export function EmptyDocumentsState({ onUpload }: { onUpload?: () => void }) {
    return (
        <EmptyState
            icon={FileText}
            title="Nessun documento"
            description="Non ci sono documenti caricati. Carica il primo documento per iniziare."
            action={onUpload ? { label: 'Carica Documento', onClick: onUpload } : undefined}
        />
    );
}
