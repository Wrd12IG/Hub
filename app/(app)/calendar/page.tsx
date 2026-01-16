'use client';

import React, { useState, useMemo } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    CirclePlus,
    ChevronsUpDown,
    SlidersVertical,
    Eraser,
    Calendar as CalendarIcon,
    List,
    Activity,
    SquareCheck,
    Folder,
    Clock,
    UserX,
    LayoutGrid,
    CalendarDays,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isToday,
    differenceInCalendarDays,
    isBefore,
    isAfter,
    addDays,
    addWeeks,
    subWeeks
} from 'date-fns';
import { it } from 'date-fns/locale';
import { useLayoutData } from '../layout-context';
import { Task, Project, CalendarActivity } from "@/lib/data"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import TaskForm from "@/components/task-form"
import ProjectForm from "@/components/project-form"
import { CalendarActivityForm } from "@/components/calendar-activity-form"
import { updateTask, updateProject, updateCalendarActivity } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';

export default function CalendarPage() {
    const { users, clients, allProjects, allTasks, absences, calendarActivities, currentUser, refetchData } = useLayoutData();
    const { toast } = useToast();
    const [date, setDate] = useState<Date>(new Date());
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda'>('month');

    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [editingActivity, setEditingActivity] = useState<CalendarActivity | null>(null);

    const [isSelectionOpen, setIsSelectionOpen] = useState(false);
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    const [isCreatingActivity, setIsCreatingActivity] = useState(false);
    const [creationDate, setCreationDate] = useState<Date | null>(null);
    const [expandedDayItems, setExpandedDayItems] = useState<{ day: Date; items: any[] } | null>(null);

    const MAX_ITEMS_PER_DAY = 3;

    // ... (Filter states remain same)
    const [selectedUser, setSelectedUser] = useState<string>('all');
    const [selectedClient, setSelectedClient] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [selectedAbsenceType, setSelectedAbsenceType] = useState<string>('all');

    // Calendar generation logic
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { locale: it }); // Monday start
    const endDate = endOfWeek(monthEnd, { locale: it });

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const weekDaysFull = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
    const weekDaysShort = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

    // Statistics for the current month
    const monthStats = useMemo(() => {
        const monthTasks = allTasks.filter((t: Task) => {
            if (!t.dueDate) return false;
            const dueDate = new Date(t.dueDate);
            return isSameMonth(dueDate, date);
        });
        const monthProjects = allProjects.filter((p: Project) => {
            const start = p.startDate ? new Date(p.startDate) : null;
            const end = p.endDate ? new Date(p.endDate) : null;
            return (start && isSameMonth(start, date)) || (end && isSameMonth(end, date));
        });
        const monthAbsences = absences.filter((a: any) => {
            const start = new Date(a.startDate);
            const end = new Date(a.endDate);
            return isSameMonth(start, date) || isSameMonth(end, date);
        });
        const monthActivities = calendarActivities.filter((a: any) => {
            const start = new Date(a.startTime);
            return isSameMonth(start, date);
        });
        const urgentTasks = monthTasks.filter((t: Task) => {
            if (!t.dueDate) return false;
            const dueDate = new Date(t.dueDate);
            const today = new Date();
            return isBefore(dueDate, addDays(today, 3)) && t.status !== 'Approvato';
        });

        return {
            totalTasks: monthTasks.length,
            totalProjects: monthProjects.length,
            totalAbsences: monthAbsences.length,
            totalActivities: monthActivities.length,
            urgentTasks: urgentTasks.length,
            totalEvents: monthTasks.length + monthProjects.length + monthAbsences.length + monthActivities.length
        };
    }, [allTasks, allProjects, absences, calendarActivities, date]);

    // Helper to filter and get items for a specific day
    const getDayItems = (day: Date) => {
        const dayStr = format(day, "yyyy-MM-dd");

        const filteredProjects = allProjects.filter(p => {
            if (selectedClient !== 'all' && p.clientId !== selectedClient) return false;
            if (selectedStatus !== 'all' && p.status !== selectedStatus) return false;
            if (selectedUser !== 'all' && p.teamLeaderId !== selectedUser) return false;
            return true;
        });

        const filteredTasks = allTasks.filter(t => {
            // Prima applica il filtro basato sul ruolo
            if (currentUser) {
                if (currentUser.role === 'Collaboratore') {
                    // Collaboratore vede solo i suoi task
                    if (t.assignedUserId !== currentUser.id) return false;
                } else if (currentUser.role === 'Project Manager') {
                    // PM vede i suoi task + quelli creati da lui assegnati ad altri
                    if (t.assignedUserId !== currentUser.id && t.createdBy !== currentUser.id) return false;
                }
                // Amministratore vede tutto
            }

            if (selectedClient !== 'all' && t.clientId !== selectedClient) return false;
            if (selectedStatus !== 'all' && t.status !== selectedStatus) return false;
            if (selectedUser !== 'all' && t.assignedUserId !== selectedUser) return false;
            return true;
        });

        const filteredAbsences = absences.filter(a => {
            if (selectedUser !== 'all' && a.userId !== selectedUser) return false;
            if (selectedAbsenceType !== 'all' && a.type !== selectedAbsenceType) return false;
            return true;
        });

        const filteredActivities = calendarActivities.filter(a => {
            // Prima applica il filtro basato sul ruolo
            if (currentUser) {
                if (currentUser.role === 'Collaboratore') {
                    // Collaboratore vede solo le sue attività
                    if (a.userId !== currentUser.id) return false;
                } else if (currentUser.role === 'Project Manager') {
                    // PM vede le sue attività + quelle create da lui (userId è chi ha creato l'attività)
                    if (a.userId !== currentUser.id) return false;
                }
                // Amministratore vede tutto
            }

            if (selectedClient !== 'all' && a.clientId !== selectedClient) return false;
            if (selectedUser !== 'all' && a.userId !== selectedUser) return false;
            return true;
        });

        const projectsOnDay = filteredProjects.filter(p => {
            const start = p.startDate ? format(new Date(p.startDate), "yyyy-MM-dd") : null;
            const end = p.endDate ? format(new Date(p.endDate), "yyyy-MM-dd") : null;
            return start === dayStr || end === dayStr;
        }).map(p => {
            const isStart = p.startDate && format(new Date(p.startDate), "yyyy-MM-dd") === dayStr;
            return {
                type: 'project',
                id: p.id,
                title: p.name,
                isStart,
                color: 'bg-primary',
                clientName: clients.find(c => c.id === p.clientId)?.name,
                original: p
            }
        });

        const tasksOnDay = filteredTasks.filter(t => {
            if (!t.dueDate) return false;
            return format(new Date(t.dueDate), "yyyy-MM-dd") === dayStr;
        }).map(t => ({
            type: 'task',
            id: t.id,
            title: t.title,
            priority: t.priority,
            color: 'bg-green-500',
            clientName: clients.find(c => c.id === t.clientId)?.name,
            original: t
        }));

        const absencesOnDay = filteredAbsences.filter(a => {
            const start = new Date(a.startDate);
            const end = new Date(a.endDate);
            const check = new Date(day);
            check.setHours(0, 0, 0, 0);
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);
            return check >= start && check <= end;
        }).map(a => ({
            type: 'absence',
            id: a.id,
            title: `${a.type} - ${users.find(u => u.id === a.userId)?.name}`,
            reason: a.type,
            color: 'bg-red-200 text-red-800',
            original: a
        }));

        const activitiesOnDay = filteredActivities.filter((a: any) => {
            const start = new Date(a.startTime);
            const end = new Date(a.endTime);



            if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;

            const check = new Date(day);

            // If multi-day, show on all days
            // If single day, show on that day
            check.setHours(0, 0, 0, 0);
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);

            return check >= start && check <= end;
        }).map((a: any) => {
            const start = new Date(a.startTime);
            const end = new Date(a.endTime);
            const check = new Date(day);
            check.setHours(0, 0, 0, 0);
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);

            const isStart = check.getTime() === start.getTime();
            const isEnd = check.getTime() === end.getTime();

            // Get client names from clientIds or fallback to clientId
            const getClientNames = () => {
                if (a.clientIds && a.clientIds.length > 0) {
                    return a.clientIds
                        .map((cId: string) => clients.find((c: any) => c.id === cId)?.name)
                        .filter(Boolean)
                        .join(', ');
                }
                // Fallback to legacy clientId
                if (a.clientId) {
                    return clients.find((c: any) => c.id === a.clientId)?.name;
                }
                return undefined;
            };

            return {
                type: 'activity',
                id: a.id,
                title: a.title,
                color: a.color || 'bg-yellow-200 text-yellow-800',
                style: a.color ? { backgroundColor: a.color, color: '#fff' } : undefined,
                clientName: getClientNames(),
                clientIds: a.clientIds || (a.clientId ? [a.clientId] : []),
                isStart,
                isEnd,
                original: a
            };
        });

        // Add isStart/isEnd to absences for consistency if needed, though they are usually full day
        const absencesWithFlags = absencesOnDay.map(a => ({
            ...a,
            isStart: true, // Simplified for now
            isEnd: true
        }));

        // Projects are often single day milestones in this view (start or end date), 
        // but if they were ranges we would calculate flags. 
        // Current logic displays them only on start OR end date, so they are effectively single points.
        const projectsWithFlags = projectsOnDay.map(p => ({
            ...p,
            isStart: true,
            isEnd: true
        }));

        const tasksWithFlags = tasksOnDay.map(t => ({
            ...t,
            isStart: true,
            isEnd: true
        }));

        const allItems = [...projectsWithFlags, ...tasksWithFlags, ...absencesWithFlags, ...activitiesOnDay];

        return allItems.sort((a, b) => {
            const getTime = (item: any) => {
                if (item.type === 'activity') return new Date(item.original.startTime).getTime();
                if (item.type === 'task') return new Date(item.original.dueDate).getTime();
                if (item.type === 'project') return new Date(item.original.startDate).getTime();
                if (item.type === 'absence') return new Date(item.original.startDate).getTime();
                return 0;
            };
            return getTime(a) - getTime(b);
        });
    };

    const handleDragStart = (e: React.DragEvent, item: any) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({
            type: item.type,
            id: item.id,
            originalDate: format(date, 'yyyy-MM-dd') // Current view date isn't exact item date, but we use diff from target
        }));
        // Store the actual item data to calculate offsets correctly
        e.dataTransfer.setData('application/json', JSON.stringify(item.original));
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
        e.preventDefault();
        try {
            const typeHeader = JSON.parse(e.dataTransfer.getData('text/plain'));
            const originalData = JSON.parse(e.dataTransfer.getData('application/json'));

            if (!currentUser) return;

            if (typeHeader.type === 'task') {
                await updateTask(typeHeader.id, {
                    dueDate: targetDate.toISOString()
                }, currentUser.id);
                toast({ title: "Task spostato", description: `Nuova data: ${format(targetDate, 'dd/MM/yyyy')}` });
            } else if (typeHeader.type === 'project') {
                const currentStart = new Date(originalData.startDate);
                const currentEnd = new Date(originalData.endDate);
                const diff = differenceInCalendarDays(targetDate, currentStart); // Shift relative to start

                const newStart = new Date(currentStart);
                newStart.setDate(newStart.getDate() + diff);

                const newEnd = new Date(currentEnd);
                newEnd.setDate(newEnd.getDate() + diff);

                await updateProject(typeHeader.id, {
                    startDate: newStart.toISOString(),
                    endDate: newEnd.toISOString()
                });
                toast({ title: "Progetto spostato" });
            } else if (typeHeader.type === 'activity') {
                const currentStart = new Date(originalData.startTime);
                const currentEnd = new Date(originalData.endTime);

                // Calculate difference in days between the day column we are dropping on and the day column it started on
                // Note: originalData doesn't tell us WHICH day box was dragged if it spans multiple. 
                // But typically users drag the visible block. 
                // Simplification: We treat the drop target as the new Start Date's day component.

                // Actually, let's keep the time but change the date to targetDate, preserving duration
                const duration = currentEnd.getTime() - currentStart.getTime();

                const newStart = new Date(targetDate);
                newStart.setHours(currentStart.getHours(), currentStart.getMinutes(), 0, 0);

                const newEnd = new Date(newStart.getTime() + duration);

                await updateCalendarActivity(typeHeader.id, {
                    startTime: newStart.toISOString(),
                    endTime: newEnd.toISOString()
                });
                toast({ title: "Attività spostata" });
            }

            refetchData('tasks'); // Refetch everything to be sure
            refetchData('projects');
            refetchData('calendarActivities');

        } catch (error) {
            console.error("Drop error:", error);
            toast({ title: "Errore durante lo spostamento", variant: "destructive" });
        }
    };

    return (
        <div className="flex flex-col md:flex-row h-full">
            {/* Sidebar */}
            <aside className="w-full md:w-72 md:pr-6 md:border-r flex-shrink-0 mb-6 md:mb-0">
                <Collapsible open={isSidebarOpen} onOpenChange={setIsSidebarOpen} className="space-y-6">
                    <div className="flex justify-between items-center">
                        <Button className="w-full md:w-auto rounded-full px-8" size="lg" onClick={() => setIsSelectionOpen(true)}>
                            <CirclePlus className="mr-2 h-4 w-4" />
                            Crea Evento
                        </Button>
                        <CollapsibleTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="md:hidden rounded-full"
                            >
                                Filtri
                                <ChevronsUpDown className="ml-2 h-4 w-4" />
                            </Button>
                        </CollapsibleTrigger>
                    </div>

                    <div className="hidden md:block p-3">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={(d) => d && setDate(d)}
                            className="w-full"
                            locale={it}
                        />
                    </div>

                    <CollapsibleContent className="space-y-4">
                        <div className="h-[1px] w-full bg-border md:hidden" />
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <SlidersVertical className="h-5 w-5" />
                                Filtri
                            </h3>
                            <Button variant="ghost" size="sm" className="rounded-full text-destructive hover:text-destructive" onClick={() => {
                                setSelectedUser('all');
                                setSelectedClient('all');
                                setSelectedStatus('all');
                                setSelectedAbsenceType('all');
                            }}>
                                <Eraser className="mr-2 h-4 w-4" />
                                Pulisci
                            </Button>
                        </div>
                        {/* Filters Content */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Utente</label>
                                <Select value={selectedUser} onValueChange={setSelectedUser}>
                                    <SelectTrigger className="rounded-full">
                                        <SelectValue placeholder="Tutti gli utenti" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tutti gli utenti</SelectItem>
                                        {[...users].sort((a, b) => a.name.localeCompare(b.name, 'it')).map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Cliente</label>
                                <Select value={selectedClient} onValueChange={setSelectedClient}>
                                    <SelectTrigger className="rounded-full">
                                        <SelectValue placeholder="Tutti i clienti" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tutti i clienti</SelectItem>
                                        {[...clients].sort((a, b) => a.name.localeCompare(b.name, 'it')).map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Stato Progetto</label>
                                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                    <SelectTrigger className="rounded-full">
                                        <SelectValue placeholder="Tutti gli stati" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tutti gli stati</SelectItem>
                                        <SelectItem value="Da fare">Da fare</SelectItem>
                                        <SelectItem value="In corso">In corso</SelectItem>
                                        <SelectItem value="Completato">Completato</SelectItem>
                                        <SelectItem value="Pianificazione">Pianificazione</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Tipo Assenza</label>
                                <Select value={selectedAbsenceType} onValueChange={setSelectedAbsenceType}>
                                    <SelectTrigger className="rounded-full">
                                        <SelectValue placeholder="Tutti i tipi" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tutti i tipi</SelectItem>
                                        <SelectItem value="Ferie">Ferie</SelectItem>
                                        <SelectItem value="Malattia">Malattia</SelectItem>
                                        <SelectItem value="Permesso">Permesso</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Legenda Colori */}
                        <div className="mt-4 pt-4 border-t">
                            <h3 className="font-semibold text-sm mb-3">Legenda</h3>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded bg-primary/20 border border-primary/50" />
                                    <Folder className="h-3 w-3 text-primary" />
                                    <span className="text-xs text-muted-foreground">Progetti</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded bg-secondary border border-border" />
                                    <SquareCheck className="h-3 w-3 text-green-600" />
                                    <span className="text-xs text-muted-foreground">Task</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded bg-yellow-200 dark:bg-yellow-900/30 border border-yellow-300" />
                                    <Clock className="h-3 w-3 text-yellow-600" />
                                    <span className="text-xs text-muted-foreground">Attività</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded bg-red-200 dark:bg-red-900/30 border border-red-300" />
                                    <UserX className="h-3 w-3 text-red-600" />
                                    <span className="text-xs text-muted-foreground">Assenze</span>
                                </div>
                            </div>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </aside>

            {/* Main Calendar */}
            <main className="flex-1 md:pl-6 flex flex-col">
                {/* Stats Bar */}
                <div className="flex flex-wrap items-center gap-2 pb-3 mb-3 border-b">
                    <Badge variant="outline" className="gap-1.5">
                        <CalendarDays className="h-3 w-3" />
                        {monthStats.totalEvents} eventi
                    </Badge>
                    <Badge variant="outline" className="gap-1.5 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400">
                        <SquareCheck className="h-3 w-3" />
                        {monthStats.totalTasks} task
                    </Badge>
                    <Badge variant="outline" className="gap-1.5 bg-primary/10 text-primary border-primary/30">
                        <Folder className="h-3 w-3" />
                        {monthStats.totalProjects} progetti
                    </Badge>
                    {monthStats.urgentTasks > 0 && (
                        <Badge variant="destructive" className="gap-1.5">
                            <AlertCircle className="h-3 w-3" />
                            {monthStats.urgentTasks} urgenti
                        </Badge>
                    )}
                    {monthStats.totalAbsences > 0 && (
                        <Badge variant="outline" className="gap-1.5 bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400">
                            <UserX className="h-3 w-3" />
                            {monthStats.totalAbsences} assenze
                        </Badge>
                    )}
                </div>

                <header className="flex items-center justify-between pb-4 border-b">
                    <div className="flex items-center gap-2">
                        <Select value={date.getFullYear().toString()} onValueChange={(v) => setDate(new Date(date.setFullYear(parseInt(v))))}>
                            <SelectTrigger className="w-24 rounded-full">
                                <SelectValue>{date.getFullYear()}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {[2024, 2025, 2026].map(year => (
                                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={date.getMonth().toString()} onValueChange={(v) => {
                            const newDate = new Date(date);
                            newDate.setMonth(parseInt(v));
                            setDate(newDate);
                        }}>
                            <SelectTrigger className="w-32 rounded-full capitalize">
                                <SelectValue>{format(date, 'MMMM', { locale: it })}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <SelectItem key={i} value={i.toString()} className="capitalize">
                                        {format(new Date(2025, i, 1), 'MMMM', { locale: it })}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* View Mode Toggle */}
                        <div className="flex items-center border rounded-full p-1 gap-0.5">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant={viewMode === 'month' ? 'secondary' : 'ghost'}
                                            size="icon"
                                            className="rounded-full h-8 w-8"
                                            onClick={() => setViewMode('month')}
                                        >
                                            <LayoutGrid className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Vista Mensile</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant={viewMode === 'week' ? 'secondary' : 'ghost'}
                                            size="icon"
                                            className="rounded-full h-8 w-8"
                                            onClick={() => setViewMode('week')}
                                        >
                                            <CalendarDays className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Vista Settimanale</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant={viewMode === 'agenda' ? 'secondary' : 'ghost'}
                                            size="icon"
                                            className="rounded-full h-8 w-8"
                                            onClick={() => setViewMode('agenda')}
                                        >
                                            <List className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Vista Lista</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <Button variant="outline" size="icon" className="rounded-full" onClick={() => viewMode === 'week' ? setDate(subWeeks(date, 1)) : setDate(subMonths(date, 1))}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" className="rounded-full px-4" onClick={() => setDate(new Date())}>
                            Oggi
                        </Button>
                        <Button variant="outline" size="icon" className="rounded-full" onClick={() => viewMode === 'week' ? setDate(addWeeks(date, 1)) : setDate(addMonths(date, 1))}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </header>

                {/* Month View */}
                {viewMode === 'month' && (
                    <div className="flex-grow grid grid-cols-7 border-r border-b mt-4">
                        {weekDaysFull.map((day, i) => (
                            <div key={i} className="py-2 text-center text-xs md:text-sm font-medium text-muted-foreground border-l border-t bg-muted/30">
                                <span className="hidden md:inline">{day}</span>
                                <span className="md:hidden">{weekDaysShort[i]}</span>
                            </div>
                        ))}

                        {calendarDays.map((day, i) => {
                            const isCurrentMonth = isSameMonth(day, date);
                            const isTodayDate = isToday(day);
                            const items = getDayItems(day);

                            return (
                                <div
                                    key={i}
                                    onClick={() => {
                                        setCreationDate(day);
                                        setIsSelectionOpen(true);
                                    }}
                                    className={cn(
                                        "p-1 border-t border-l min-h-24 md:min-h-[140px] flex flex-col transition-colors cursor-pointer hover:bg-accent/50 bg-card relative group",
                                        !isCurrentMonth && "text-muted-foreground bg-muted/10",
                                        isTodayDate && "bg-accent/30"
                                    )}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, day)}
                                >
                                    <div className={cn(
                                        "font-semibold text-xs p-1 mb-1 w-6 h-6 flex items-center justify-center rounded-full ml-auto",
                                        isTodayDate && "bg-primary text-primary-foreground"
                                    )}>
                                        {format(day, 'd')}
                                    </div>
                                    <div className="flex-grow space-y-1">
                                        <TooltipProvider>
                                            {items.slice(0, MAX_ITEMS_PER_DAY).map((item: any, idx) => (
                                                <Tooltip key={`${item.type}-${item.id}-${idx}`}>
                                                    <TooltipTrigger asChild>
                                                        <div
                                                            draggable={item.type !== 'absence'}
                                                            onDragStart={(e) => handleDragStart(e, item)}
                                                            className={cn(
                                                                "text-xs p-1 px-2 truncate cursor-pointer hover:opacity-80 flex items-center gap-1 shadow-sm",
                                                                // Base rounding
                                                                "rounded-md",
                                                                // Continuous event styling (remove corners if continues)
                                                                !item.isStart && "rounded-l-none border-l-0 ml-[-5px]", // Pull left if continuous
                                                                !item.isEnd && "rounded-r-none border-r-0 mr-[-5px]",   // Push right if continuous

                                                                item.type === 'absence' ? item.color :
                                                                    item.type === 'project' ? "bg-primary/20 text-primary" :
                                                                        item.type === 'activity' ? (!item.style ? item.color : '') :
                                                                            "bg-secondary text-secondary-foreground"
                                                            )}
                                                            style={item.type === 'activity' && item.style ? item.style : undefined}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (item.type === 'task') {
                                                                    setEditingTask(item.original);
                                                                } else if (item.type === 'project') {
                                                                    setEditingProject(item.original);
                                                                } else if (item.type === 'activity') {
                                                                    setEditingActivity(item.original);
                                                                }
                                                            }}
                                                        >
                                                            {/* Icons */}
                                                            {item.type === 'task' && <SquareCheck className="h-3 w-3 flex-shrink-0" />}
                                                            {item.type === 'project' && <Folder className="h-3 w-3 flex-shrink-0" />}
                                                            {item.type === 'activity' && <Clock className="h-3 w-3 flex-shrink-0" />}
                                                            {item.type === 'absence' && <UserX className="h-3 w-3 flex-shrink-0" />}

                                                            {item.type === 'task' && (
                                                                <span className={cn(
                                                                    "w-1.5 h-1.5 rounded-full flex-shrink-0",
                                                                    item.priority === 'Alta' || item.priority === 'Critica' ? "bg-destructive" :
                                                                        item.priority === 'Media' ? "bg-orange-400" : "bg-green-400"
                                                                )} />
                                                            )}

                                                            <span className="truncate font-medium">
                                                                {item.clientName ? `[${item.clientName}] ` : ''}
                                                                {item.title}
                                                            </span>
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right" className="max-w-xs">
                                                        <div className="space-y-1">
                                                            <p className="font-semibold">{item.title}</p>
                                                            <div className="text-xs space-y-0.5 text-muted-foreground">
                                                                <p className="capitalize">
                                                                    <span className="font-medium">Tipo:</span>{' '}
                                                                    {item.type === 'task' ? 'Task' :
                                                                        item.type === 'project' ? 'Progetto' :
                                                                            item.type === 'activity' ? 'Attività' : 'Assenza'}
                                                                </p>
                                                                {item.clientName && (
                                                                    <p><span className="font-medium">Cliente:</span> {item.clientName}</p>
                                                                )}
                                                                {item.type === 'task' && item.priority && (
                                                                    <p><span className="font-medium">Priorità:</span> {item.priority}</p>
                                                                )}
                                                                {item.type === 'task' && item.original?.status && (
                                                                    <p><span className="font-medium">Stato:</span> {item.original.status}</p>
                                                                )}
                                                                {item.type === 'project' && item.original?.status && (
                                                                    <p><span className="font-medium">Stato:</span> {item.original.status}</p>
                                                                )}
                                                                {item.isStart && <p className="text-green-600">📍 Inizio progetto</p>}
                                                                {!item.isStart && item.type === 'project' && <p className="text-red-600">🏁 Fine progetto</p>}
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground/70 pt-1 border-t">
                                                                Clicca per modificare • Trascina per spostare
                                                            </p>
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            ))}
                                        </TooltipProvider>
                                        {items.length > MAX_ITEMS_PER_DAY && (
                                            <Badge
                                                variant="secondary"
                                                className="text-[10px] ml-1 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedDayItems({ day, items });
                                                }}
                                            >
                                                +{items.length - MAX_ITEMS_PER_DAY} altri
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Week View */}
                {viewMode === 'week' && (
                    <div className="flex-grow grid grid-cols-7 border-r border-b mt-4">
                        {weekDaysFull.map((day, i) => (
                            <div key={i} className="py-2 text-center text-xs md:text-sm font-medium text-muted-foreground border-l border-t bg-muted/30">
                                <span className="hidden md:inline">{day}</span>
                                <span className="md:hidden">{weekDaysShort[i]}</span>
                            </div>
                        ))}

                        {eachDayOfInterval({
                            start: startOfWeek(date, { locale: it }),
                            end: endOfWeek(date, { locale: it })
                        }).map((day, i) => {
                            const isTodayDate = isToday(day);
                            const items = getDayItems(day);

                            return (
                                <div
                                    key={i}
                                    onClick={() => {
                                        setCreationDate(day);
                                        setIsSelectionOpen(true);
                                    }}
                                    className={cn(
                                        "p-2 border-t border-l min-h-[500px] flex flex-col transition-colors cursor-pointer hover:bg-accent/50 bg-card relative group",
                                        isTodayDate && "bg-accent/30"
                                    )}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, day)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className={cn(
                                            "font-semibold text-sm p-1.5 w-8 h-8 flex items-center justify-center rounded-full ml-auto",
                                            isTodayDate && "bg-primary text-primary-foreground"
                                        )}>
                                            {format(day, 'd')}
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 flex-grow">
                                        <TooltipProvider>
                                            {items.map((item: any, idx) => (
                                                <Tooltip key={`${item.type}-${item.id}-${idx}`}>
                                                    <TooltipTrigger asChild>
                                                        <div
                                                            draggable={item.type !== 'absence'}
                                                            onDragStart={(e) => handleDragStart(e, item)}
                                                            className={cn(
                                                                "text-xs p-2 truncate cursor-pointer hover:opacity-80 flex items-center gap-2 shadow-sm rounded-md border",
                                                                item.type === 'absence' ? item.color :
                                                                    item.type === 'project' ? "bg-primary/20 text-primary border-primary/20" :
                                                                        item.type === 'activity' ? (!item.style ? item.color : '') :
                                                                            "bg-secondary text-secondary-foreground border-border"
                                                            )}
                                                            style={item.type === 'activity' && item.style ? item.style : undefined}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (item.type === 'task') setEditingTask(item.original);
                                                                else if (item.type === 'project') setEditingProject(item.original);
                                                                else if (item.type === 'activity') setEditingActivity(item.original);
                                                            }}
                                                        >
                                                            {item.type === 'task' && <SquareCheck className="h-3 w-3 flex-shrink-0" />}
                                                            {item.type === 'project' && <Folder className="h-3 w-3 flex-shrink-0" />}
                                                            {item.type === 'activity' && <Clock className="h-3 w-3 flex-shrink-0" />}
                                                            {item.type === 'absence' && <UserX className="h-3 w-3 flex-shrink-0" />}

                                                            {item.type === 'task' && (
                                                                <span className={cn(
                                                                    "w-1.5 h-1.5 rounded-full flex-shrink-0 mx-1",
                                                                    item.priority === 'Alta' || item.priority === 'Critica' ? "bg-destructive" :
                                                                        item.priority === 'Media' ? "bg-orange-400" : "bg-green-400"
                                                                )} />
                                                            )}

                                                            <span className="truncate font-medium">
                                                                {item.clientName ? `[${item.clientName}] ` : ''}
                                                                {item.title}
                                                            </span>
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right" className="max-w-xs">
                                                        <div className="space-y-1">
                                                            <p className="font-semibold">{item.title}</p>
                                                            <div className="text-xs space-y-0.5 text-muted-foreground">
                                                                <p><span className="font-medium capitalize">{item.type}</span></p>
                                                                {item.clientName && <p>Cliente: {item.clientName}</p>}
                                                            </div>
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            ))}
                                        </TooltipProvider>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Agenda View */}
                {viewMode === 'agenda' && (
                    <div className="flex-grow mt-4 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
                        {calendarDays.filter(day => isSameMonth(day, date)).map((day, i) => {
                            const items = getDayItems(day);
                            if (items.length === 0) return null;

                            return (
                                <Card key={i} className={cn(
                                    "overflow-hidden",
                                    isToday(day) && "ring-2 ring-primary"
                                )}>
                                    <div className="flex">
                                        {/* Date Column */}
                                        <div className={cn(
                                            "w-20 flex-shrink-0 p-3 flex flex-col items-center justify-center border-r",
                                            isToday(day) ? "bg-primary text-primary-foreground" : "bg-muted/50"
                                        )}>
                                            <span className="text-2xl font-bold">{format(day, 'd')}</span>
                                            <span className="text-xs uppercase">{format(day, 'EEE', { locale: it })}</span>
                                        </div>

                                        {/* Events Column */}
                                        <CardContent className="flex-1 p-3 space-y-2">
                                            {items.map((item: any, idx: number) => (
                                                <div
                                                    key={`${item.type}-${item.id}-${idx}`}
                                                    className={cn(
                                                        "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors hover:bg-muted/50",
                                                    )}
                                                    onClick={() => {
                                                        if (item.type === 'task') setEditingTask(item.original);
                                                        else if (item.type === 'project') setEditingProject(item.original);
                                                        else if (item.type === 'activity') setEditingActivity(item.original);
                                                    }}
                                                >
                                                    {/* Type Icon */}
                                                    <div className={cn(
                                                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                                                        item.type === 'project' && "bg-primary/20 text-primary",
                                                        item.type === 'task' && "bg-green-100 text-green-600 dark:bg-green-900/30",
                                                        item.type === 'activity' && "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30",
                                                        item.type === 'absence' && "bg-red-100 text-red-600 dark:bg-red-900/30"
                                                    )}>
                                                        {item.type === 'task' && <SquareCheck className="h-4 w-4" />}
                                                        {item.type === 'project' && <Folder className="h-4 w-4" />}
                                                        {item.type === 'activity' && <Clock className="h-4 w-4" />}
                                                        {item.type === 'absence' && <UserX className="h-4 w-4" />}
                                                    </div>

                                                    {/* Event Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm truncate">{item.title}</p>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            {item.clientName && (
                                                                <span>{item.clientName}</span>
                                                            )}
                                                            {item.type === 'task' && item.priority && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className={cn(
                                                                        "text-[10px] px-1.5 py-0",
                                                                        item.priority === 'Critica' && "text-red-500 border-red-300",
                                                                        item.priority === 'Alta' && "text-orange-500 border-orange-300",
                                                                        item.priority === 'Media' && "text-yellow-500 border-yellow-300",
                                                                        item.priority === 'Bassa' && "text-green-500 border-green-300"
                                                                    )}
                                                                >
                                                                    {item.priority}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Type Badge */}
                                                    <Badge variant="outline" className="text-[10px] capitalize flex-shrink-0">
                                                        {item.type === 'task' ? 'Task' :
                                                            item.type === 'project' ? 'Progetto' :
                                                                item.type === 'activity' ? 'Attività' : 'Assenza'}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </div>
                                </Card>
                            );
                        })}

                        {/* Empty State */}
                        {calendarDays.filter(day => isSameMonth(day, date) && getDayItems(day).length > 0).length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <CalendarDays className="h-12 w-12 mb-4 opacity-20" />
                                <p className="text-lg font-medium">Nessun evento questo mese</p>
                                <p className="text-sm">Clicca "Crea Evento" per aggiungere il primo</p>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Selection Dialog */}
            <Dialog open={isSelectionOpen} onOpenChange={setIsSelectionOpen}>
                <DialogContent className="max-w-xs sm:rounded-2xl p-6">
                    <div className="flex flex-col space-y-1.5 text-center sm:text-left">
                        <h2 className="text-lg font-semibold leading-none tracking-tight">
                            {creationDate ? `Crea per il ${format(creationDate, "d MMMM", { locale: it })}` : "Cosa vuoi creare?"}
                        </h2>
                    </div>
                    <div className="flex flex-col gap-4 py-4">
                        <button
                            className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-full px-8"
                            onClick={() => {
                                setIsSelectionOpen(false);
                                setIsCreatingTask(true);
                            }}
                        >
                            <List className="mr-2 h-5 w-5" />
                            Nuovo Task
                        </button>
                        <button
                            className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-11 rounded-full px-8"
                            onClick={() => {
                                setIsSelectionOpen(false);
                                setIsCreatingActivity(true);
                            }}
                        >
                            <Activity className="mr-2 h-5 w-5" />
                            Nuova Attività
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Expanded Day Items Dialog */}
            <Dialog open={!!expandedDayItems} onOpenChange={() => setExpandedDayItems(null)}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
                    {expandedDayItems && (
                        <>
                            <div className="flex items-center gap-3 pb-4 border-b">
                                <div className="w-14 h-14 rounded-lg bg-primary text-primary-foreground flex flex-col items-center justify-center">
                                    <span className="text-xl font-bold">{format(expandedDayItems.day, 'd')}</span>
                                    <span className="text-[10px] uppercase">{format(expandedDayItems.day, 'EEE', { locale: it })}</span>
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold">
                                        {format(expandedDayItems.day, 'd MMMM yyyy', { locale: it })}
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        {expandedDayItems.items.length} eventi in questo giorno
                                    </p>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2 py-4">
                                {expandedDayItems.items.map((item: any, idx: number) => (
                                    <div
                                        key={`${item.type}-${item.id}-${idx}`}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 border",
                                        )}
                                        onClick={() => {
                                            setExpandedDayItems(null);
                                            if (item.type === 'task') setEditingTask(item.original);
                                            else if (item.type === 'project') setEditingProject(item.original);
                                            else if (item.type === 'activity') setEditingActivity(item.original);
                                        }}
                                    >
                                        {/* Type Icon */}
                                        <div className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                                            item.type === 'project' && "bg-blue-100 text-blue-600 dark:bg-blue-900/30",
                                            item.type === 'task' && "bg-green-100 text-green-600 dark:bg-green-900/30",
                                            item.type === 'activity' && "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30",
                                            item.type === 'absence' && "bg-red-100 text-red-600 dark:bg-red-900/30"
                                        )}>
                                            {item.type === 'task' && <SquareCheck className="h-5 w-5" />}
                                            {item.type === 'project' && <Folder className="h-5 w-5" />}
                                            {item.type === 'activity' && <Clock className="h-5 w-5" />}
                                            {item.type === 'absence' && <UserX className="h-5 w-5" />}
                                        </div>

                                        {/* Event Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{item.title}</p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                {item.clientName && (
                                                    <span>{item.clientName}</span>
                                                )}
                                                {item.type === 'task' && item.priority && (
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            "text-[10px] px-1.5 py-0",
                                                            item.priority === 'Critica' && "text-red-500 border-red-300",
                                                            item.priority === 'Alta' && "text-orange-500 border-orange-300",
                                                            item.priority === 'Media' && "text-yellow-500 border-yellow-300",
                                                            item.priority === 'Bassa' && "text-green-500 border-green-300"
                                                        )}
                                                    >
                                                        {item.priority}
                                                    </Badge>
                                                )}
                                                {item.original?.status && (
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                        {item.original.status}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        {/* Type Badge */}
                                        <Badge variant="secondary" className="text-xs capitalize flex-shrink-0">
                                            {item.type === 'task' ? 'Task' :
                                                item.type === 'project' ? 'Progetto' :
                                                    item.type === 'activity' ? 'Attività' : 'Assenza'}
                                        </Badge>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4 border-t flex gap-2">
                                <Button
                                    className="flex-1"
                                    onClick={() => {
                                        setCreationDate(expandedDayItems.day);
                                        setExpandedDayItems(null);
                                        setIsSelectionOpen(true);
                                    }}
                                >
                                    <CirclePlus className="h-4 w-4 mr-2" />
                                    Aggiungi evento
                                </Button>
                                <Button variant="outline" onClick={() => setExpandedDayItems(null)}>
                                    Chiudi
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Editing Dialogs */}
            <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    {editingTask && (
                        <TaskForm
                            key={editingTask.id}
                            task={editingTask}
                            onSuccess={() => setEditingTask(null)}
                            onCancel={() => setEditingTask(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    {editingProject && (
                        <ProjectForm
                            key={editingProject.id}
                            project={editingProject}
                            onSuccess={() => setEditingProject(null)}
                            onCancel={() => setEditingProject(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingActivity} onOpenChange={(open) => !open && setEditingActivity(null)}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:rounded-2xl p-6">
                    {editingActivity && (
                        <CalendarActivityForm
                            key={editingActivity.id}
                            activity={editingActivity}
                            onSuccess={() => setEditingActivity(null)}
                            onCancel={() => setEditingActivity(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Creation Dialogs */}
            <Dialog open={isCreatingTask} onOpenChange={setIsCreatingTask}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="sr-only">Modifica o Crea Task</DialogTitle>
                        <DialogDescription className="sr-only">Modulo per creare o modificare un task</DialogDescription>
                    </DialogHeader>
                    <TaskForm
                        initialDate={creationDate || new Date()}
                        onSuccess={() => setIsCreatingTask(false)}
                        onCancel={() => setIsCreatingTask(false)}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={isCreatingActivity} onOpenChange={setIsCreatingActivity}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="sr-only">Modifica o Crea Attività</DialogTitle>
                        <DialogDescription className="sr-only">Modulo per creare o modificare un'attività del calendario</DialogDescription>
                    </DialogHeader>
                    <CalendarActivityForm
                        initialDate={creationDate || new Date()}
                        onSuccess={() => setIsCreatingActivity(false)}
                        onCancel={() => setIsCreatingActivity(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}

