'use client';

import { useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Task, User } from '@/lib/data';
import { parseISO, isBefore, startOfToday } from 'date-fns';

export type TaskFilterStatus = 'all' | 'active' | 'completed' | 'overdue';
export type TaskSortBy = 'dueDate' | 'priority' | 'createdAt' | 'title';
export type TaskSortOrder = 'asc' | 'desc';

export interface TaskFilters {
    clientId: string;
    userId: string;
    activityType: string;
    status: TaskFilterStatus;
    projectId: string;
    searchQuery: string;
}

export interface UseTaskFiltersOptions {
    currentUser: User | null;
    initialFilters?: Partial<TaskFilters>;
}

const PRIORITY_ORDER: Record<string, number> = {
    Critica: 0,
    Alta: 1,
    Media: 2,
    Bassa: 3,
};

const STATUS_ORDER: Record<string, number> = {
    'In Approvazione': 0,
    'In Lavorazione': 1,
    'Da Fare': 2,
    'Approvato': 3,
    'Annullato': 4,
};

export function useTaskFilters({ currentUser, initialFilters }: UseTaskFiltersOptions) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Get initial filter values from URL or defaults
    const getInitialFilters = useCallback((): TaskFilters => {
        const projectIdFromUrl = searchParams.get('projectId');
        const clientIdFromUrl = searchParams.get('clientId');

        // Default user filter based on role
        let initialUserId = 'all';
        if (currentUser && (currentUser.role === 'Collaboratore' || currentUser.role === 'Project Manager')) {
            initialUserId = currentUser.id;
        }

        return {
            clientId: clientIdFromUrl || initialFilters?.clientId || 'all',
            userId: initialFilters?.userId || initialUserId,
            activityType: initialFilters?.activityType || 'all',
            status: (initialFilters?.status as TaskFilterStatus) || 'active',
            projectId: projectIdFromUrl || initialFilters?.projectId || 'all',
            searchQuery: initialFilters?.searchQuery || '',
        };
    }, [currentUser, searchParams, initialFilters]);

    const [filters, setFilters] = useState<TaskFilters>(getInitialFilters);
    const [sortBy, setSortBy] = useState<TaskSortBy>('dueDate');
    const [sortOrder, setSortOrder] = useState<TaskSortOrder>('asc');

    // Update a single filter
    const setFilter = useCallback(<K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    }, []);

    // Reset all filters to initial state
    const resetFilters = useCallback(() => {
        const currentPath = window.location.pathname;
        router.replace(currentPath, { scroll: false });
        setFilters(getInitialFilters());
    }, [getInitialFilters, router]);

    // Check if any filters are active
    const hasActiveFilters = useMemo(() => {
        const defaults = getInitialFilters();
        return (
            filters.clientId !== defaults.clientId ||
            filters.userId !== defaults.userId ||
            filters.activityType !== defaults.activityType ||
            filters.status !== defaults.status ||
            filters.projectId !== defaults.projectId ||
            filters.searchQuery !== ''
        );
    }, [filters, getInitialFilters]);

    // Filter tasks based on current filters
    const filterTasks = useCallback((tasks: Task[]): Task[] => {
        return tasks.filter(task => {
            // Client filter
            if (filters.clientId !== 'all' && task.clientId !== filters.clientId) {
                return false;
            }

            // User filter
            if (filters.userId !== 'all' && task.assignedUserId !== filters.userId) {
                return false;
            }

            // Activity type filter
            if (filters.activityType !== 'all' && task.activityType !== filters.activityType) {
                return false;
            }

            // Project filter
            if (filters.projectId !== 'all' && task.projectId !== filters.projectId) {
                return false;
            }

            // Status filter
            if (filters.status === 'active') {
                if (task.status === 'Approvato' || task.status === 'Annullato') {
                    return false;
                }
            } else if (filters.status === 'completed') {
                if (task.status !== 'Approvato') {
                    return false;
                }
            } else if (filters.status === 'overdue') {
                const isOverdue = task.dueDate &&
                    isBefore(parseISO(task.dueDate), startOfToday()) &&
                    task.status !== 'Approvato' &&
                    task.status !== 'Annullato';
                if (!isOverdue) {
                    return false;
                }
            }

            // Search query filter
            if (filters.searchQuery) {
                const query = filters.searchQuery.toLowerCase();
                const matchesTitle = task.title.toLowerCase().includes(query);
                const matchesDescription = task.description?.toLowerCase().includes(query);
                if (!matchesTitle && !matchesDescription) {
                    return false;
                }
            }

            return true;
        });
    }, [filters]);

    // Sort tasks based on current sort settings
    const sortTasks = useCallback((tasks: Task[]): Task[] => {
        return [...tasks].sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case 'dueDate':
                    // Tasks without due date go to the end
                    if (!a.dueDate && !b.dueDate) comparison = 0;
                    else if (!a.dueDate) comparison = 1;
                    else if (!b.dueDate) comparison = -1;
                    else comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                    break;

                case 'priority':
                    comparison = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
                    break;

                case 'createdAt':
                    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    comparison = bCreated - aCreated; // Newest first by default
                    break;

                case 'title':
                    comparison = a.title.localeCompare(b.title, 'it');
                    break;
            }

            return sortOrder === 'desc' ? -comparison : comparison;
        });
    }, [sortBy, sortOrder]);

    // Group tasks by status for board view
    const groupTasksByStatus = useCallback((tasks: Task[]): Record<string, Task[]> => {
        const grouped: Record<string, Task[]> = {
            'Da Fare': [],
            'In Lavorazione': [],
            'In Approvazione': [],
            'Approvato': [],
            'Annullato': [],
        };

        tasks.forEach(task => {
            if (grouped[task.status]) {
                grouped[task.status].push(task);
            }
        });

        // Sort "In Approvazione" tasks by date (most recent first)
        grouped['In Approvazione'].sort((a, b) => {
            const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return bDate - aDate;
        });

        return grouped;
    }, []);

    // Apply both filter and sort
    const processedTasks = useCallback((tasks: Task[]): Task[] => {
        return sortTasks(filterTasks(tasks));
    }, [filterTasks, sortTasks]);

    return {
        filters,
        setFilter,
        setFilters,
        resetFilters,
        hasActiveFilters,
        sortBy,
        setSortBy,
        sortOrder,
        setSortOrder,
        filterTasks,
        sortTasks,
        groupTasksByStatus,
        processedTasks,
    };
}
