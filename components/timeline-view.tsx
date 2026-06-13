'use client';

import React, { useState } from 'react';
import { addDays, format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isWithinInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import { Project, Task } from '@/lib/data';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TimelineViewProps {
    projects: Project[];
    tasks: Task[];
}

export function TimelineView({ projects, tasks }: TimelineViewProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
    const endDate = addDays(startDate, 13); // Show 2 weeks

    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const handlePrev = () => setCurrentDate(addDays(currentDate, -7));
    const handleNext = () => setCurrentDate(addDays(currentDate, 7));

    // Group tasks by project
    const projectTasks = projects.map(project => ({
        project,
        tasks: tasks.filter(t => t.projectId === project.id).sort((a, b) => (a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0))
    })).filter(g => g.tasks.length > 0 || g.project.status === 'In Corso');

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Da Fare': return 'bg-gray-400';
            case 'In Lavorazione': return 'bg-primary';
            case 'In Approvazione': return 'bg-yellow-500';
            case 'In Approvazione Cliente': return 'bg-purple-500';
            case 'Approvato': return 'bg-green-500';
            case 'Completato': return 'bg-green-600';
            default: return 'bg-gray-300';
        }
    };

    return (
        <Card className="w-full border-0 shadow-none">
            <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={handlePrev}><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="font-medium text-sm">
                        {format(startDate, 'd MMM', { locale: it })} - {format(endDate, 'd MMM yyyy', { locale: it })}
                    </span>
                    <Button variant="outline" size="icon" onClick={handleNext}><ChevronRight className="h-4 w-4" /></Button>
                </div>
                <div className="flex gap-2 text-xs">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-primary rounded-sm"></div> In Lavorazione</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-500 rounded-sm"></div> In Approvazione</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-purple-500 rounded-sm"></div> Appr. Cliente</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Completato</div>
                </div>
            </div>

            <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                <div className="min-w-[800px]">
                    {/* Header Giorni */}
                    <div className="flex border-b">
                        <div className="w-48 flex-shrink-0 p-3 font-semibold border-r bg-muted/20 sticky left-0 z-10">Progetto</div>
                        {days.map(day => (
                            <div key={day.toISOString()} className={`flex-1 min-w-[50px] text-center p-2 border-r text-xs ${isSameDay(day, new Date()) ? 'bg-primary/10 font-bold text-primary' : ''}`}>
                                <div className="uppercase opacity-50 mb-1">{format(day, 'EEE', { locale: it })}</div>
                                <div>{format(day, 'd')}</div>
                            </div>
                        ))}
                    </div>

                    {/* Righe Progetti */}
                    <div className="divide-y">
                        {projectTasks.map(({ project, tasks }) => (
                            <div key={project.id} className="flex">
                                <div className="w-48 flex-shrink-0 p-3 border-r bg-background sticky left-0 z-10 flex flex-col justify-center">
                                    <div className="font-medium truncate text-sm" title={project.name}>{project.name}</div>
                                    <div className="text-xs text-muted-foreground">{tasks.length} task</div>
                                </div>
                                <div className="flex-1 relative min-w-[50px] flex">
                                    {/* Background Columns */}
                                    {days.map(day => (
                                        <div key={day.toISOString()} className={`flex-1 min-w-[50px] border-r h-full min-h-[60px] ${[0, 6].includes(day.getDay()) ? 'bg-muted/5' : ''}`}></div>
                                    ))}

                                    {/* Task Bars */}
                                    <div className="absolute inset-0 py-2 flex flex-col gap-1 w-full">
                                        {tasks.map(task => {
                                            if (!task.createdAt && !task.dueDate) return null;
                                            // Simple logic: if createdAt missing, assume dueDate - 1 day. If dueDate missing, assume createdAt + 1 day
                                            let start = task.createdAt ? new Date(task.createdAt) : (task.dueDate ? addDays(new Date(task.dueDate), -1) : new Date());
                                            let end = task.dueDate ? new Date(task.dueDate) : addDays(start, 2);

                                            // Clip to view
                                            if (end < startDate || start > endDate) return null;

                                            // Calculate position
                                            const totalDuration = endDate.getTime() - startDate.getTime();
                                            const startOffset = Math.max(0, start.getTime() - startDate.getTime());
                                            const endOffset = Math.min(endDate.getTime(), end.getTime()) - startDate.getTime();

                                            const left = (startOffset / totalDuration) * 100;
                                            const width = ((endOffset - startOffset) / totalDuration) * 100;

                                            return (
                                                <TooltipProvider key={task.id}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div
                                                                className={`h-6 rounded-md px-2 text-[10px] text-white flex items-center shadow-sm absolute hover:brightness-110 cursor-pointer transition-all ${getStatusColor(task.status)}`}
                                                                style={{
                                                                    left: `${left}%`,
                                                                    width: `${Math.max(width, 7)}%`  // Min width 7% (about 1 day)
                                                                }}
                                                            >
                                                                <span className="truncate">{task.title}</span>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p className="font-bold">{task.title}</p>
                                                            <p className="text-xs">{task.status} - {format(start, 'd MMM')} / {format(end, 'd MMM')}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {projectTasks.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground w-full">Nessun progetto attivo nel periodo selezionato</div>
                        )}
                    </div>
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </Card>
    );
}
