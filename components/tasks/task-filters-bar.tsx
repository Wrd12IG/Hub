'use client';

import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Filter, X, LayoutGrid, List, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Client, User, Project, ActivityType } from '@/lib/data';
import type { TaskFilters, TaskFilterStatus, TaskSortBy } from '@/hooks/use-task-filters';
import { cn } from '@/lib/utils';

export type ViewMode = 'board' | 'list';

interface TaskFiltersBarProps {
    filters: TaskFilters;
    onFilterChange: <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => void;
    onResetFilters: () => void;
    hasActiveFilters: boolean;
    sortBy: TaskSortBy;
    onSortChange: (sort: TaskSortBy) => void;
    view: ViewMode;
    onViewChange: (view: ViewMode) => void;
    // Data for selects
    clients: Client[];
    users: User[];
    projects: Project[];
    activityTypes: ActivityType[];
    // Permissions
    canCreate: boolean;
    onCreateTask: () => void;
    // Optional: Show compact version
    compact?: boolean;
}

export const TaskFiltersBar = memo(function TaskFiltersBar({
    filters,
    onFilterChange,
    onResetFilters,
    hasActiveFilters,
    sortBy,
    onSortChange,
    view,
    onViewChange,
    clients,
    users,
    projects,
    activityTypes,
    canCreate,
    onCreateTask,
    compact = false,
}: TaskFiltersBarProps) {
    const activeFilterCount = [
        filters.clientId !== 'all',
        filters.userId !== 'all',
        filters.activityType !== 'all',
        filters.projectId !== 'all',
        filters.status !== 'active',
        filters.searchQuery !== '',
    ].filter(Boolean).length;

    return (
        <Card className="mb-6">
            <CardContent className={cn("pt-4", compact && "py-3")}>
                {/* Main Controls Row */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <Input
                            type="search"
                            placeholder="Cerca task..."
                            className="pl-9"
                            value={filters.searchQuery}
                            onChange={(e) => onFilterChange('searchQuery', e.target.value)}
                            aria-label="Cerca task"
                        />
                    </div>

                    {/* Quick Filters */}
                    <div className="flex items-center gap-2">
                        <Select
                            value={filters.status}
                            onValueChange={(value) => onFilterChange('status', value as TaskFilterStatus)}
                        >
                            <SelectTrigger className="w-[140px]" aria-label="Filtra per stato">
                                <SelectValue placeholder="Stato" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tutti gli Stati</SelectItem>
                                <SelectItem value="active">Solo Attivi</SelectItem>
                                <SelectItem value="completed">Completati</SelectItem>
                                <SelectItem value="overdue">Scaduti</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={sortBy} onValueChange={(value) => onSortChange(value as TaskSortBy)}>
                            <SelectTrigger className="w-[140px]" aria-label="Ordina per">
                                <SelectValue placeholder="Ordina per" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="dueDate">Scadenza</SelectItem>
                                <SelectItem value="priority">Priorità</SelectItem>
                                <SelectItem value="createdAt">Data Creazione</SelectItem>
                                <SelectItem value="title">Titolo</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* View Toggle */}
                    <div className="flex items-center border rounded-lg p-1">
                        <Button
                            variant={view === 'board' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => onViewChange('board')}
                            aria-label="Vista Bacheca"
                            aria-pressed={view === 'board'}
                        >
                            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                            variant={view === 'list' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => onViewChange('list')}
                            aria-label="Vista Lista"
                            aria-pressed={view === 'list'}
                        >
                            <List className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    </div>

                    {/* Active Filters Badge & Reset */}
                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onResetFilters}
                            className="text-muted-foreground"
                            aria-label="Rimuovi tutti i filtri"
                        >
                            <X className="h-4 w-4 mr-1" aria-hidden="true" />
                            Reset
                            {activeFilterCount > 0 && (
                                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                                    {activeFilterCount}
                                </Badge>
                            )}
                        </Button>
                    )}

                    {/* Create Button */}
                    {canCreate && (
                        <Button onClick={onCreateTask} className="ml-auto">
                            + Nuovo Task
                        </Button>
                    )}
                </div>

                {/* Advanced Filters (Collapsible) */}
                {!compact && (
                    <Collapsible className="mt-4">
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-muted-foreground">
                                <Filter className="h-4 w-4 mr-2" aria-hidden="true" />
                                Filtri Avanzati
                                <ChevronDown className="h-4 w-4 ml-1" aria-hidden="true" />
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {/* Client Filter */}
                                <Select
                                    value={filters.clientId}
                                    onValueChange={(value) => onFilterChange('clientId', value)}
                                >
                                    <SelectTrigger aria-label="Filtra per cliente">
                                        <SelectValue placeholder="Cliente" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tutti i Clienti</SelectItem>
                                        {clients.map((client) => (
                                            <SelectItem key={client.id} value={client.id}>
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-3 h-3 rounded-full"
                                                        style={{ backgroundColor: client.color }}
                                                        aria-hidden="true"
                                                    />
                                                    {client.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* User Filter */}
                                <Select
                                    value={filters.userId}
                                    onValueChange={(value) => onFilterChange('userId', value)}
                                >
                                    <SelectTrigger aria-label="Filtra per assegnatario">
                                        <SelectValue placeholder="Assegnatario" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tutti gli Utenti</SelectItem>
                                        {users
                                            .filter(u => u.role !== 'Amministratore' && u.role !== 'Cliente')
                                            .map((user) => (
                                                <SelectItem key={user.id} value={user.id}>
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-3 h-3 rounded-full"
                                                            style={{ backgroundColor: user.color }}
                                                            aria-hidden="true"
                                                        />
                                                        {user.name}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>

                                {/* Project Filter */}
                                <Select
                                    value={filters.projectId}
                                    onValueChange={(value) => onFilterChange('projectId', value)}
                                >
                                    <SelectTrigger aria-label="Filtra per progetto">
                                        <SelectValue placeholder="Progetto" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tutti i Progetti</SelectItem>
                                        {projects.map((project) => (
                                            <SelectItem key={project.id} value={project.id}>
                                                {project.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Activity Type Filter */}
                                <Select
                                    value={filters.activityType}
                                    onValueChange={(value) => onFilterChange('activityType', value)}
                                >
                                    <SelectTrigger aria-label="Filtra per tipo attività">
                                        <SelectValue placeholder="Tipo Attività" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tutti i Tipi</SelectItem>
                                        {activityTypes.map((type) => (
                                            <SelectItem key={type.id} value={type.name}>
                                                {type.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}
            </CardContent>
        </Card>
    );
});

TaskFiltersBar.displayName = 'TaskFiltersBar';
