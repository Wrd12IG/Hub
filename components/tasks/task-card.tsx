'use client';

import { memo, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
    Calendar,
    Play,
    Square,
    Paperclip,
    ThumbsUp,
    ThumbsDown,
    MessageSquare,
    AlertTriangle,
    Timer,
    Eye,
    Send,
    MoreVertical,
    Target,
    Link as LinkIcon,
    FolderKanban,
    Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn, getInitials } from '@/lib/utils';
import type { Task, Client, User, Project, Attachment, TaskApproval } from '@/lib/data';

// Status color mapping
const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    'Da Fare': { bg: '#6b7280', text: '#ffffff', border: 'border-gray-500' },
    'In Lavorazione': { bg: '#3b82f6', text: '#ffffff', border: 'border-blue-500' },
    'In Approvazione': { bg: '#f97316', text: '#ffffff', border: 'border-orange-500' },
    'Approvato': { bg: '#10b981', text: '#ffffff', border: 'border-emerald-500' },
    'Annullato': { bg: '#64748b', text: '#ffffff', border: 'border-slate-500' },
};

// Priority class mapping
const priorityClasses: Record<string, string> = {
    Bassa: 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400',
    Media: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    Alta: 'border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-400',
    Critica: 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400',
};

// Format time helper
const formatTime = (totalSeconds: number): string => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return [hours, minutes, seconds].map((v) => (v < 10 ? '0' + v : v)).join(':');
};

export interface TaskCardProps {
    task: Task;
    client?: Client;
    project?: Project;
    assignedUser?: User;
    creator?: User;
    usersById: Record<string, User>;
    allTasks: Task[];
    canApprove: boolean;
    isTimerActive: boolean;
    isHighlighted?: boolean;
    // Actions
    onPlay: () => void;
    onSendForApproval: () => void;
    onApprove: () => void;
    onReject: () => void;
    onViewDetails: () => void;
    onOpenChat: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onViewProject?: () => void;
}

export const TaskCard = memo(function TaskCard({
    task,
    client,
    project,
    assignedUser,
    creator,
    usersById,
    allTasks,
    canApprove,
    isTimerActive,
    isHighlighted = false,
    onPlay,
    onSendForApproval,
    onApprove,
    onReject,
    onViewDetails,
    onOpenChat,
    onEdit,
    onDelete,
    onViewProject,
}: TaskCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);

    // Calculated values
    const isTaskInApproval = task.status === 'In Approvazione';
    const timeSpentFormatted = formatTime(task.timeSpent || 0);
    const timeProgress = task.estimatedDuration > 0
        ? Math.min(100, ((task.timeSpent || 0) / (task.estimatedDuration * 60)) * 100)
        : 0;
    const canBeSentForApproval = ['Da Fare', 'In Lavorazione'].includes(task.status);

    const daysRemaining = useMemo(() => {
        if (!task.dueDate) return null;
        return Math.ceil(
            (new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
    }, [task.dueDate]);

    const approvalDaysPending = useMemo(() => {
        if (!isTaskInApproval || !task.updatedAt) return 0;
        const updateDate = typeof task.updatedAt === 'string'
            ? new Date(task.updatedAt)
            : (task.updatedAt as any).toDate
                ? (task.updatedAt as any).toDate()
                : new Date();
        const diffTime = Math.abs(new Date().getTime() - updateDate.getTime());
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }, [isTaskInApproval, task.updatedAt]);

    const isOverdue = daysRemaining !== null && daysRemaining < 0 &&
        task.status !== 'Approvato' && task.status !== 'Annullato';

    // Dependencies check
    const unapprovedDependencies = useMemo(() => {
        if (!task.dependencies || task.dependencies.length === 0) return [];
        return task.dependencies
            .map((depId: string) => allTasks.find((t: Task) => t.id === depId))
            .filter((t: Task | undefined) => t && t.status !== 'Approvato');
    }, [task.dependencies, allTasks]);

    const canApproveTask = canApprove && unapprovedDependencies.length === 0;

    // Scroll into view when highlighted
    useEffect(() => {
        if (isHighlighted && cardRef.current) {
            cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [isHighlighted]);

    // Render approval tooltip content
    const renderApprovalTooltip = () => {
        if (task.status === 'Approvato' && task.approvals && task.approvals.length > 0) {
            return (
                <div className="space-y-1 text-sm">
                    <p className="font-bold">Approvato da:</p>
                    <ul className="list-disc pl-4">
                        {task.approvals.map((app: TaskApproval) => (
                            <li key={app.userId}>
                                {usersById[app.userId]?.name || 'Utente Sconosciuto'}: {format(new Date(app.timestamp), 'dd/MM/yy HH:mm', { locale: it })}
                            </li>
                        ))}
                    </ul>
                </div>
            );
        }
        if (task.requiresTwoStepApproval && isTaskInApproval && task.approvals && task.approvals.length > 0) {
            return (
                <div className="space-y-1 text-sm">
                    <p className="font-bold">Approvato {task.approvals.length}/2. In attesa del secondo approvatore.</p>
                    <ul className="list-disc pl-4 pt-1">
                        {task.approvals.map((app: TaskApproval) => (
                            <li key={app.userId}>
                                {usersById[app.userId]?.name}: {format(new Date(app.timestamp), 'dd/MM/yy HH:mm', { locale: it })}
                            </li>
                        ))}
                    </ul>
                </div>
            );
        }
        return <p>{task.status}</p>;
    };

    return (
        <Card
            ref={cardRef}
            className={cn(
                'flex flex-col rounded-xl transition-all duration-300 relative overflow-hidden outline-none ring-0 focus:ring-0',
                // Timer active -> Green glow
                isTimerActive ? 'animate-green-glow border-green-500/50 bg-green-50/40 dark:bg-green-900/10' :
                    // Recent approval request (<24h) -> Purple animated glow
                    (isTaskInApproval && approvalDaysPending < 1) ? 'animate-glow-custom border-purple-500/50 bg-purple-50/40 dark:bg-purple-900/10' :
                        // Overdue -> Fixed red border
                        isOverdue ? 'border-2 border-red-500' :
                            // Highlighted -> Blue ring
                            isHighlighted ? 'ring-2 ring-primary shadow-lg' : ''
            )}
            role="article"
            aria-label={`Task: ${task.title}`}
        >
            {/* Project Badge */}
            {project && onViewProject && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onViewProject();
                                }}
                                className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors z-10"
                                aria-label={`Visualizza progetto: ${project.name}`}
                            >
                                <FolderKanban className="h-3 w-3" aria-hidden="true" />
                                <span className="max-w-[80px] truncate">{project.name}</span>
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Visualizza progetto: {project.name}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}

            <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        {/* Status Badge */}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Badge
                                        style={{
                                            backgroundColor: statusColors[task.status]?.bg || '#6b7280',
                                            color: 'white'
                                        }}
                                        className="mb-2"
                                    >
                                        {task.status}
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent>{renderApprovalTooltip()}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {/* Pending Approval Warning */}
                        {isTaskInApproval && approvalDaysPending >= 1 && (
                            <Badge
                                variant="destructive"
                                className="mb-2 ml-2 text-xs font-bold shadow-md flex items-center gap-1 animate-breathing-custom bg-red-600 hover:bg-red-700"
                            >
                                <Timer className="h-3 w-3" aria-hidden="true" />
                                ⚠️ In attesa da {approvalDaysPending} giorn{approvalDaysPending === 1 ? 'o' : 'i'}
                            </Badge>
                        )}

                        {/* Approval Request Date */}
                        {isTaskInApproval && (() => {
                            const dateSource = task.updatedAt || task.createdAt;
                            const dateLabel = task.updatedAt ? 'Richiesta' : 'Creato';
                            return (
                                <div className="text-xs text-purple-600 dark:text-purple-400 mb-1 flex items-center gap-1 font-medium">
                                    <Clock className="h-3 w-3" aria-hidden="true" />
                                    {dateSource ? (
                                        <>
                                            {dateLabel}: {format(
                                                typeof dateSource === 'string'
                                                    ? new Date(dateSource)
                                                    : (dateSource as any).toDate ? (dateSource as any).toDate() : new Date(),
                                                'dd MMM yyyy HH:mm',
                                                { locale: it }
                                            )}
                                        </>
                                    ) : (
                                        <>In attesa di approvazione</>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Client Name */}
                        <p className="font-bold text-sm" style={{ color: client?.color }}>
                            {client?.name}
                        </p>

                        {/* Task Title */}
                        <CardTitle className="font-headline text-lg -mt-1">{task.title}</CardTitle>
                    </div>

                    {/* Actions Menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Menu azioni task"
                            >
                                <MoreVertical aria-hidden="true" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem
                                onClick={onEdit}
                                disabled={task.status === 'Approvato' && !canApprove}
                            >
                                Modifica
                            </DropdownMenuItem>
                            {canApprove && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={onDelete}
                                    >
                                        Elimina
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>

            <CardContent className="flex-grow">
                {/* Attachment and Dependency Badges */}
                <div className="flex gap-2 mb-2">
                    {task.attachments && task.attachments.length > 0 && (
                        <Badge
                            variant="secondary"
                            className="text-xs px-1 py-0 h-5 gap-1"
                            title={`${task.attachments.length} Allegati`}
                        >
                            <Paperclip className="h-3 w-3" aria-hidden="true" />
                            {task.attachments.length}
                        </Badge>
                    )}
                    {task.dependencies && task.dependencies.length > 0 && (
                        <Badge
                            variant="secondary"
                            className="text-xs px-1 py-0 h-5 gap-1"
                            title={`${task.dependencies.length} Dipendenze`}
                        >
                            <LinkIcon className="h-3 w-3" aria-hidden="true" />
                            {task.dependencies.length}
                        </Badge>
                    )}
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {task.description}
                </p>

                {/* Progress or Time Spent */}
                {task.estimatedDuration > 0 ? (
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-1 text-sm">
                            <span>Progresso</span>
                            <span className="font-semibold">{timeProgress.toFixed(0)}% ({timeSpentFormatted})</span>
                        </div>
                        <Progress value={timeProgress} aria-label={`Progresso: ${timeProgress.toFixed(0)}%`} />
                    </div>
                ) : task.timeSpent && task.timeSpent > 0 ? (
                    <div className="mb-4">
                        <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            <span className="text-muted-foreground">Tempo registrato:</span>
                            <Badge variant="secondary" className="font-semibold">{timeSpentFormatted}</Badge>
                        </div>
                    </div>
                ) : null}

                {/* Due Date and Priority */}
                <div className="text-sm space-y-2 text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" aria-hidden="true" />
                        {task.dueDate ? (
                            <Badge
                                variant={
                                    daysRemaining !== null && daysRemaining < 0 && task.status !== 'Approvato'
                                        ? 'destructive'
                                        : daysRemaining !== null && daysRemaining <= 3 && task.status !== 'Approvato'
                                            ? 'default'
                                            : 'secondary'
                                }
                                className={cn(
                                    "text-xs",
                                    daysRemaining !== null && daysRemaining < 0 && task.status !== 'Approvato' && "animate-breathing-custom"
                                )}
                            >
                                {format(new Date(task.dueDate), 'EEE dd MMM', { locale: it })}
                                {daysRemaining !== null && task.status !== 'Approvato' && (
                                    <span className="ml-1">
                                        {daysRemaining < 0 ? '(Scaduto!)' :
                                            daysRemaining === 0 ? '(Oggi!)' :
                                                daysRemaining === 1 ? '(Domani)' :
                                                    daysRemaining <= 3 ? `(${daysRemaining}gg)` : ''}
                                    </span>
                                )}
                            </Badge>
                        ) : (
                            <span className="text-muted-foreground italic">Nessuna scadenza</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Target className="h-4 w-4" aria-hidden="true" />
                        <span>Priorità: </span>
                        <Badge variant="outline" className={cn(priorityClasses[task.priority])}>
                            {task.priority}
                        </Badge>
                    </div>
                </div>
            </CardContent>

            <CardFooter className="flex items-center justify-between">
                {/* Avatars */}
                <div className="flex -space-x-2">
                    {creator && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Avatar className="h-8 w-8 border-2 border-background">
                                        <AvatarFallback style={{ backgroundColor: creator.color, color: 'white' }}>
                                            {getInitials(creator.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                </TooltipTrigger>
                                <TooltipContent><p>Creato da {creator.name}</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    {assignedUser && creator?.id !== assignedUser.id && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary/50 hover:bg-secondary transition-colors">
                                        <Avatar className="h-6 w-6">
                                            <AvatarFallback style={{ backgroundColor: assignedUser.color, color: 'white' }} className="text-xs">
                                                {getInitials(assignedUser.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs font-medium max-w-[60px] truncate">
                                            {assignedUser.name.split(' ')[0]}
                                        </span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent><p>Assegnato a {assignedUser.name}</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1">
                    {/* Approval Actions */}
                    {isTaskInApproval && canApprove ? (
                        <>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="relative">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-green-600 hover:bg-green-100 hover:text-green-700"
                                                onClick={onApprove}
                                                disabled={!canApproveTask}
                                                aria-label="Approva task"
                                            >
                                                <ThumbsUp aria-hidden="true" />
                                            </Button>
                                            {unapprovedDependencies.length > 0 && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <AlertTriangle
                                                            className="absolute -top-1 -right-1 h-4 w-4 text-orange-500 bg-white rounded-full"
                                                            aria-hidden="true"
                                                        />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Impossibile approvare. Dipendenze non completate:</p>
                                                        <ul className="list-disc pl-4">
                                                            {unapprovedDependencies.map(t => t && <li key={t.id}>{t.title}</li>)}
                                                        </ul>
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Approva</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 text-red-600 hover:bg-red-100 hover:text-red-700"
                                            onClick={onReject}
                                            aria-label="Rifiuta task"
                                        >
                                            <ThumbsDown aria-hidden="true" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Rifiuta</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </>
                    ) : canBeSentForApproval ? (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9"
                                        onClick={onSendForApproval}
                                        aria-label="Invia in approvazione"
                                    >
                                        <Send aria-hidden="true" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Invia in Approvazione</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : null}

                    {/* Timer Button */}
                    {isTimerActive ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive hover:bg-destructive/10"
                            onClick={onPlay}
                            aria-label="Ferma timer"
                        >
                            <Square className="fill-current" aria-hidden="true" />
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-green-600 hover:bg-green-100"
                            onClick={onPlay}
                            disabled={['Annullato', 'In Approvazione', 'Approvato'].includes(task.status)}
                            aria-label="Avvia timer"
                        >
                            <Play className="fill-current" aria-hidden="true" />
                        </Button>
                    )}

                    {/* View Details */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-primary hover:bg-primary/10"
                        onClick={onViewDetails}
                        aria-label="Visualizza dettagli"
                    >
                        <Eye aria-hidden="true" />
                    </Button>

                    {/* Chat */}
                    <div className="relative">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-accent-foreground hover:bg-accent/20"
                            onClick={onOpenChat}
                            aria-label="Apri chat"
                        >
                            <MessageSquare aria-hidden="true" />
                        </Button>
                        {task.comments && task.comments.length > 0 && (
                            <span
                                className="absolute -top-1 -right-1 flex items-center justify-center h-5 min-w-5 px-1 text-xs font-bold text-primary-foreground bg-primary rounded-full shadow-sm"
                                aria-label={`${task.comments.length} commenti`}
                            >
                                {task.comments.length}
                            </span>
                        )}
                    </div>
                </div>
            </CardFooter>
        </Card>
    );
});

TaskCard.displayName = 'TaskCard';
