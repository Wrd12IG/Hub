'use client';

import React, { useState } from 'react';
import { Project, Task, Client, User, allTaskPriorities } from '@/lib/data';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
    Calendar,
    Target,
    ListCollapse,
    EllipsisVertical,
    CircleAlert,
    ChevronUp,
    Minus,
    ChevronDown
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface ProjectCardProps {
    project: Project;
    client?: Client;
    tasks: Task[];
    teamLeader?: User;
    onEdit: (project: Project) => void;
    onDelete?: (project: Project) => void;
}

export function ProjectCard({ project, client, tasks, teamLeader, onEdit, onDelete }: ProjectCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'Approvato').length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Determine project priority based on highest task priority
    const getProjectPriority = () => {
        if (tasks.some(t => t.priority === 'Critica' && t.status !== 'Approvato' && t.status !== 'Annullato')) return 'Critica';
        if (tasks.some(t => t.priority === 'Alta' && t.status !== 'Approvato' && t.status !== 'Annullato')) return 'Alta';
        if (tasks.some(t => t.priority === 'Media' && t.status !== 'Approvato' && t.status !== 'Annullato')) return 'Media';
        if (tasks.some(t => t.priority === 'Bassa' && t.status !== 'Approvato' && t.status !== 'Annullato')) return 'Bassa';
        return 'Media'; // Default
    };

    const priority = getProjectPriority();

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'Critica': return 'text-red-500 bg-red-500/10 border-red-500/50';
            case 'Alta': return 'text-orange-700 dark:text-orange-400 bg-orange-500/10 border-orange-500/50';
            case 'Media': return 'text-yellow-700 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/50';
            case 'Bassa': return 'text-green-700 dark:text-green-400 bg-green-500/10 border-green-500/50';
            default: return 'text-gray-500 bg-gray-500/10 border-gray-500/50';
        }
    };

    const getPriorityIcon = (p: string) => {
        switch (p) {
            case 'Critica': return <CircleAlert className="h-4 w-4 text-red-500" />;
            case 'Alta': return <ChevronUp className="h-4 w-4 text-orange-500" />;
            case 'Media': return <Minus className="h-4 w-4 text-yellow-500" />;
            case 'Bassa': return <ChevronDown className="h-4 w-4 text-green-500" />;
            default: return null;
        }
    }

    const isExpired = project.endDate ? new Date(project.endDate) < new Date() && project.status !== 'Completato' : false;

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }

    return (
        <Card className="flex flex-col rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-card text-card-foreground border">
            <div className="flex flex-col space-y-1.5 p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <Badge
                            variant="outline"
                            className={cn("mb-2 border-transparent text-white hover:bg-opacity-80",
                                project.status === 'In Corso' ? 'bg-green-500' :
                                    project.status === 'Pianificazione' ? 'bg-primary' : // Adatto Pianificazione a primary
                                        project.status === 'Completato' ? 'bg-gray-500' :
                                            'bg-primary'
                            )}
                        >
                            {project.status}
                        </Badge>
                        <h3 className="font-semibold tracking-tight font-headline text-lg">{project.name}</h3>
                        <p className="font-bold flex items-center gap-2" style={{ color: client?.color || '#333' }}>
                            {client?.name || 'Cliente Sconosciuto'}
                        </p>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 rounded-full">
                                <span className="sr-only">Apri menu</span>
                                <EllipsisVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(project)}>Modifica</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/projects/${project.id}`)}>Dettagli</DropdownMenuItem>
                            {onDelete && <DropdownMenuItem onClick={() => onDelete(project)} className="text-destructive">Elimina</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="p-6 pt-0 flex-grow">
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {project.description || "Nessuna descrizione."}
                </p>

                <div className="mb-4">
                    <div className="flex justify-between items-center mb-1 text-sm">
                        <span>Progresso</span>
                        <span className="font-semibold">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                </div>

                <div className="text-sm space-y-2 text-muted-foreground">
                    {project.endDate && (
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>
                                Scadenza: {format(new Date(project.endDate), 'dd/MM/yyyy')}
                                {isExpired && <span className="font-bold text-destructive animate-pulse ml-1">(Scaduto)</span>}
                            </span>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        <span>Priorità: </span>
                        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", getPriorityColor(priority))}>
                            {priority}
                        </span>
                    </div>
                </div>

                <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start p-2 h-auto text-muted-foreground hover:text-foreground">
                            <ListCollapse className="mr-2 h-4 w-4" />
                            Task del Progetto ({totalTasks})
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                        {tasks.slice(0, 5).map(task => ( // Mostra solo i primi 5 task
                            <div key={task.id} className="text-xs flex justify-between items-center p-2 rounded-md bg-muted/50">
                                <span className="truncate max-w-[70%]">{task.title}</span>
                                <Badge variant="outline" className="text-[10px] h-5 px-1">{task.status}</Badge>
                            </div>
                        ))}
                        {totalTasks > 5 && (
                            <div className="text-xs text-center text-muted-foreground pt-1">
                                +{totalTasks - 5} altri task...
                            </div>
                        )}
                        {totalTasks === 0 && <div className="text-xs text-muted-foreground pl-2">Nessun task.</div>}
                    </CollapsibleContent>
                </Collapsible>
            </div>

            <div className="flex items-center p-6 pt-0 mt-auto">
                <div className="flex items-center justify-between w-full">
                    {teamLeader ? (
                        <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                                <AvatarFallback style={{ backgroundColor: teamLeader.color || '#888', color: 'white' }}>
                                    {getInitials(teamLeader.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="text-xs text-muted-foreground">Team Leader</p>
                                <p className="text-sm font-medium">{teamLeader.name}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                                <AvatarFallback>?</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="text-xs text-muted-foreground">Team Leader</p>
                                <p className="text-sm font-medium">Non assegnato</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}
