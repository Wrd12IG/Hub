'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, getInitials } from '@/lib/utils';
import { useLayoutData } from '@/app/(app)/layout-context';
import { ChevronLeft, ChevronRight, GanttChart, Calendar, Filter } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, differenceInDays, isSameDay, isWithinInterval, addWeeks, subWeeks } from 'date-fns';
import { it } from 'date-fns/locale';
import Link from 'next/link';

const priorityColors: Record<string, string> = {
    'Critica': 'bg-red-500',
    'Alta': 'bg-orange-500',
    'Media': 'bg-primary',
    'Bassa': 'bg-gray-400',
};

const statusColors: Record<string, string> = {
    'Da Fare': 'opacity-60',
    'In Lavorazione': 'opacity-100',
    'In Approvazione': 'opacity-80 pattern-stripes',
    'In Approvazione Cliente': 'opacity-90 bg-purple-500',
    'Approvato': 'opacity-50 brightness-110',
    'Annullato': 'opacity-30 line-through',
};

interface TaskGanttChartProps {
    onTaskClick?: (taskId: string) => void;
}

export default function TaskGanttChart({ onTaskClick }: TaskGanttChartProps) {
    const { allTasks, allProjects, clients, users, usersById, currentUser } = useLayoutData();
    const [startDate, setStartDate] = useState(() => startOfWeek(new Date(), { locale: it }));
    const [selectedClient, setSelectedClient] = useState<string>('all');
    const [selectedProject, setSelectedProject] = useState<string>('all');
    const [selectedUser, setSelectedUser] = useState<string>('all');
    const [weeksToShow, setWeeksToShow] = useState<number>(2);

    const endDate = addDays(startDate, weeksToShow * 7 - 1);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    // Filter tasks
    const filteredTasks = useMemo(() => {
        return allTasks.filter(task => {
            // Must have due date to show on Gantt
            if (!task.dueDate) return false;

            // Filter by status - exclude completed/cancelled
            if (['Approvato', 'Annullato'].includes(task.status)) return false;

            // Filter by client
            if (selectedClient !== 'all' && task.clientId !== selectedClient) return false;

            // Filter by project
            if (selectedProject !== 'all' && task.projectId !== selectedProject) return false;

            // Filter by user
            if (selectedUser !== 'all' && task.assignedUserId !== selectedUser) return false;

            // Show all tasks with due date (no date range filter for better visibility)
            return true;
        }).sort((a, b) => {
            // Sort by due date, then by priority
            const priorityOrder: Record<string, number> = { 'Critica': 0, 'Alta': 1, 'Media': 2, 'Bassa': 3 };
            const dateCompare = new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime();
            if (dateCompare !== 0) return dateCompare;
            return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
        });
    }, [allTasks, selectedClient, selectedProject, selectedUser]);

    // Group tasks by project
    const tasksByProject = useMemo(() => {
        const grouped: Record<string, typeof filteredTasks> = { 'no-project': [] };

        filteredTasks.forEach(task => {
            const key = task.projectId || 'no-project';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(task);
        });

        return grouped;
    }, [filteredTasks]);

    const navigateWeeks = (direction: 'prev' | 'next') => {
        setStartDate(prev => direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1));
    };

    const getTaskBarStyle = (task: typeof allTasks[0]) => {
        if (!task.dueDate) return { display: 'none' };

        const taskDue = new Date(task.dueDate);
        const estimatedDays = Math.max(1, Math.ceil((task.estimatedDuration || 60) / 60 / 8));
        const taskStart = addDays(taskDue, -estimatedDays + 1);

        const startOffset = Math.max(0, differenceInDays(taskStart, startDate));
        const endOffset = Math.min(days.length - 1, differenceInDays(taskDue, startDate));
        const barWidth = Math.max(1, endOffset - startOffset + 1);

        return {
            left: `${(startOffset / days.length) * 100}%`,
            width: `${(barWidth / days.length) * 100}%`,
        };
    };

    const filteredProjects = useMemo(() => {
        if (selectedClient === 'all') return allProjects;
        return allProjects.filter(p => p.clientId === selectedClient);
    }, [allProjects, selectedClient]);

    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <GanttChart className="h-5 w-5" />
                            Timeline Task
                        </CardTitle>
                        <CardDescription>
                            Visualizza i tuoi task in formato Gantt - {filteredTasks.length} task attivi
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={weeksToShow.toString()} onValueChange={(v) => setWeeksToShow(Number(v))}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">1 settimana</SelectItem>
                                <SelectItem value="2">2 settimane</SelectItem>
                                <SelectItem value="4">4 settimane</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" onClick={() => navigateWeeks('prev')}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setStartDate(startOfWeek(new Date(), { locale: it }))}>
                            Oggi
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => navigateWeeks('next')}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 mt-4">
                    <Select value={selectedClient} onValueChange={setSelectedClient}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Tutti i clienti" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tutti i clienti</SelectItem>
                            {[...clients].sort((a, b) => a.name.localeCompare(b.name, 'it')).map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={selectedProject} onValueChange={setSelectedProject}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Tutti i progetti" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tutti i progetti</SelectItem>
                            {[...filteredProjects].sort((a, b) => a.name.localeCompare(b.name, 'it')).map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Tutti gli utenti" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tutti gli utenti</SelectItem>
                            {[...users].filter(u => u.role !== 'Cliente').sort((a, b) => a.name.localeCompare(b.name, 'it')).map(u => (
                                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>

            <CardContent className="overflow-x-auto">
                {filteredTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <GanttChart className="h-16 w-16 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                            Nessun task da visualizzare
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                            {allTasks.length === 0
                                ? "Non ci sono task nel sistema. Crea un nuovo task per iniziare."
                                : allTasks.filter(t => t.dueDate && !['Approvato', 'Annullato'].includes(t.status)).length === 0
                                    ? "Tutti i task sono completati o non hanno una data di scadenza impostata."
                                    : "Nessun task corrisponde ai filtri selezionati. Prova a modificare i filtri."
                            }
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-2">
                            Task totali: {allTasks.length} | Con scadenza: {allTasks.filter(t => t.dueDate).length} | Attivi: {allTasks.filter(t => t.dueDate && !['Approvato', 'Annullato'].includes(t.status)).length}
                        </p>
                    </div>
                ) : (
                    /* Header with days */
                    <div className="min-w-[800px]">
                        <div className="flex border-b">
                            <div className="w-64 flex-shrink-0 p-2 font-medium text-sm bg-muted/50">
                                Task
                            </div>
                            <div className="flex-1 flex">
                                {days.map((day, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "flex-1 text-center text-xs p-1 border-l",
                                            isSameDay(day, new Date()) && "bg-primary/10 font-bold",
                                            day.getDay() === 0 || day.getDay() === 6 ? "bg-muted/30" : ""
                                        )}
                                    >
                                        <div className="font-medium">{format(day, 'EEE', { locale: it })}</div>
                                        <div className={cn(
                                            "text-muted-foreground",
                                            isSameDay(day, new Date()) && "text-primary font-bold"
                                        )}>{format(day, 'd')}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Task rows grouped by project */}
                        {Object.entries(tasksByProject).map(([projectId, tasks]) => {
                            if (tasks.length === 0) return null;
                            const project = allProjects.find(p => p.id === projectId);

                            return (
                                <div key={projectId} className="border-b last:border-b-0">
                                    {/* Project header */}
                                    {projectId !== 'no-project' && project && (
                                        <div className="flex bg-muted/30 border-b">
                                            <div className="w-64 flex-shrink-0 p-2 font-medium text-sm flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                {project.name}
                                                <Badge variant="secondary" className="text-xs">
                                                    {tasks.length} task
                                                </Badge>
                                            </div>
                                            <div className="flex-1" />
                                        </div>
                                    )}

                                    {/* Task rows */}
                                    {tasks.map(task => {
                                        const assignedUser = task.assignedUserId ? usersById[task.assignedUserId] : null;
                                        const barStyle = getTaskBarStyle(task);

                                        return (
                                            <div key={task.id} className="flex hover:bg-muted/20 transition-colors">
                                                {/* Task info */}
                                                <div className="w-64 flex-shrink-0 p-2 border-r flex items-center gap-2">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className={cn(
                                                                    "w-2 h-2 rounded-full flex-shrink-0",
                                                                    priorityColors[task.priority]
                                                                )} />
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                Priorità: {task.priority}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>

                                                    <Link
                                                        href={`/tasks?taskId=${task.id}`}
                                                        className="flex-1 text-sm truncate hover:text-primary transition-colors"
                                                    >
                                                        {task.title}
                                                    </Link>

                                                    {assignedUser && (
                                                        <Avatar className="h-6 w-6 flex-shrink-0">
                                                            <AvatarFallback
                                                                style={{ backgroundColor: assignedUser.color }}
                                                                className="text-xs text-white"
                                                            >
                                                                {getInitials(assignedUser.name)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    )}
                                                </div>

                                                {/* Gantt bar */}
                                                <div className="flex-1 relative h-10 flex items-center">
                                                    {/* Grid lines */}
                                                    <div className="absolute inset-0 flex pointer-events-none">
                                                        {days.map((day, i) => (
                                                            <div
                                                                key={i}
                                                                className={cn(
                                                                    "flex-1 border-l",
                                                                    isSameDay(day, new Date()) && "bg-primary/5",
                                                                    day.getDay() === 0 || day.getDay() === 6 ? "bg-muted/20" : ""
                                                                )}
                                                            />
                                                        ))}
                                                    </div>

                                                    {/* Task bar */}
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div
                                                                    className={cn(
                                                                        "absolute h-6 rounded-md cursor-pointer transition-all hover:brightness-110 hover:shadow-md hover:scale-y-110",
                                                                        priorityColors[task.priority],
                                                                        statusColors[task.status]
                                                                    )}
                                                                    style={barStyle}
                                                                    onClick={() => onTaskClick?.(task.id)}
                                                                >
                                                                    <span className="text-xs text-white px-2 truncate block leading-6">
                                                                        {task.title}
                                                                    </span>
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="max-w-xs">
                                                                <div className="space-y-1">
                                                                    <p className="font-medium">{task.title}</p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        Scadenza: {format(new Date(task.dueDate!), 'PPP', { locale: it })}
                                                                    </p>
                                                                    <p className="text-xs">
                                                                        Stato: <Badge variant="secondary" className="text-xs">{task.status}</Badge>
                                                                    </p>
                                                                    <p className="text-xs">
                                                                        Durata stimata: {(task.estimatedDuration / 60).toFixed(1)}h
                                                                    </p>
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
