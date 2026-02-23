
'use client';
import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { getTask, addTask, updateTask, deleteTask, uploadFilesAndGetAttachments, getAbsences, getClients, getProjects, getUsers, getActivityTypes, stopTaskTimer } from '@/lib/actions';
import type { Task, Client, User, Project, ActivityType, Attachment, Absence, TaskApproval, TaskComment } from '@/lib/data';
import { allTaskStatuses } from '@/lib/data';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Calendar, X, Play, Square, Pencil, LayoutGrid, List, Paperclip, FileText, Download, Trash2, Filter, Check, ThumbsUp, ThumbsDown, MessageSquare, AlertTriangle, ListTodo, Timer, CheckSquare, AlertOctagon, Eye, Loader2, Send, UserSquare, ListChecks, MoreVertical, Target, Link as LinkIcon, User as UserIcon, Search, ChevronDown, FolderKanban, CheckCircle, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { TaskChat } from '@/components/task-chat';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, isWithinInterval, parseISO, isBefore, startOfToday, formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import dynamic from 'next/dynamic';
import { useLayoutData } from '@/app/(app)/layout-context';
import { cn, getInitials } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import PomodoroWidget from '@/components/pomodoro-timer';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import Image from 'next/image';
import { Checkbox } from '@/components/ui/checkbox';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { playSound } from '@/lib/sounds';
import { EmptyTasksState, EmptySearchState } from '@/components/ui/empty-state';
import { SkeletonTaskBoard, SkeletonTaskList } from '@/components/ui/skeleton-card';
import TaskGanttChart from '@/components/task-gantt-chart';
import { GanttChart } from 'lucide-react';



const TaskForm = dynamic(() => import('@/components/task-form'), {
    loading: () => <div className="p-8 text-center">Caricamento...</div>,
});


const statusColors: { [key: string]: { bg: string, text: string, border: string } } = {
    'Da Fare': { bg: '#6b7280', text: '#ffffff', border: 'border-gray-500' },           // gray-500
    'In Lavorazione': { bg: '#3b82f6', text: '#ffffff', border: 'border-blue-500' },    // blue-500
    'In Approvazione': { bg: '#f97316', text: '#ffffff', border: 'border-orange-500' }, // orange-500
    'In Approvazione Cliente': { bg: '#a855f7', text: '#ffffff', border: 'border-purple-500' }, // purple-500
    'Approvato': { bg: '#10b981', text: '#ffffff', border: 'border-emerald-500' },      // emerald-500
    'Annullato': { bg: '#64748b', text: '#ffffff', border: 'border-slate-500' },        // slate-500
};


const priorityColors: { [key: string]: string } = {
    Bassa: '#22c55e',      // green-500
    Media: '#f59e0b',      // yellow-500
    Alta: '#f97316',       // orange-500
    Critica: '#ef4444',    // red-500
};

const priorityClasses: { [key: string]: string } = {
    Bassa: 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400',
    Media: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    Alta: 'border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-400',
    Critica: 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400',
};

const formatTime = (totalSeconds: number) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return [hours, minutes, seconds].map((v) => (v < 10 ? '0' + v : v)).join(':');
};

type ModalState = {
    mode: 'create' | 'edit';
    task?: Task;
    isOpen: boolean;
}

type ApprovalActionState = {
    isOpen: boolean;
    task?: Task;
    sendEmail: boolean;
}

type DisapprovalModalState = {
    isOpen: boolean;
    task?: Task;
    reason: string;
    sendEmail: boolean;
}

type FileAttachmentModalState = {
    isOpen: boolean;
    task?: Task;
    attachmentUrl: string;
    attachmentFilename: string;
    attachmentFile?: File; // File selezionato per upload su Firebase Storage
};

type View = 'board' | 'list' | 'gantt';

const STATUS_REQUIRING_ATTACHMENT: Task['status'][] = [];


const TaskCard = ({
    task,
    clients,
    allProjects,
    allTasks,
    usersById,
    canApprove,
    handlePlay,
    handleSendForApproval,
    setApprovalState,
    setDisapprovalModalState,
    setRejectionReasonToShow,
    setPreviewTask,
    setPreviewProject,
    handleChatOpen,
    handleOpenModal,
    setTaskToDelete,
    isHighlighted,
}: {
    task: Task;
    clients: Client[];
    allProjects: Project[];
    allTasks: Task[];
    usersById: Record<string, User>;
    canApprove: boolean;
    handlePlay: (task: Task) => void;
    handleSendForApproval: (task: Task) => void;
    setApprovalState: React.Dispatch<React.SetStateAction<ApprovalActionState>>;
    setDisapprovalModalState: React.Dispatch<React.SetStateAction<DisapprovalModalState>>;
    setRejectionReasonToShow: (reason: string) => void;
    setPreviewTask: React.Dispatch<React.SetStateAction<Task | null>>;
    setPreviewProject: React.Dispatch<React.SetStateAction<Project | null>>;
    handleChatOpen: (task: Task) => void;
    handleOpenModal: (mode: 'create' | 'edit', task?: Task) => void;
    setTaskToDelete: React.Dispatch<React.SetStateAction<Task | null>>;
    isHighlighted: boolean;
}) => {
    const { pomodoroTask } = useLayoutData();
    const cardRef = useRef<HTMLDivElement>(null);
    const client = clients.find(c => c.id === task.clientId);
    const project = allProjects.find(p => p.id === task.projectId);
    const assignedUser = task.assignedUserId ? usersById[task.assignedUserId] : null;
    const creator = task.createdBy ? usersById[task.createdBy] : null;
    const isTimerActiveForThisTask = pomodoroTask?.id === task.id;
    const timeSpentFormatted = formatTime(task.timeSpent || 0);
    const isTaskInApproval = task.status === 'In Approvazione' || task.status === 'In Approvazione Cliente';
    const timeProgress = task.estimatedDuration > 0 ? Math.min(100, ((task.timeSpent || 0) / (task.estimatedDuration * 60)) * 100) : 0;
    const timeExceeded = task.estimatedDuration > 0 && (task.timeSpent || 0) > (task.estimatedDuration * 60);
    const timeWarning = task.estimatedDuration > 0 && timeProgress >= 80 && timeProgress < 100;
    const canBeSentForApproval = ['Da Fare', 'In Lavorazione'].includes(task.status);
    const daysRemaining = task.dueDate ? Math.ceil(
        (new Date(task.dueDate).getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24)
    ) : null;

    const approvalDaysPending = useMemo(() => {
        if (!isTaskInApproval || !task.updatedAt) return 0;
        const updateDate = typeof task.updatedAt === 'string' ? new Date(task.updatedAt) :
            (task.updatedAt as any).toDate ? (task.updatedAt as any).toDate() : new Date();
        const diffTime = Math.abs(new Date().getTime() - updateDate.getTime());
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }, [isTaskInApproval, task.updatedAt]);

    const isNewApprovalRequest = isTaskInApproval && approvalDaysPending < 1;
    const isOverdue = daysRemaining !== null && daysRemaining < 0 && task.status !== 'Approvato' && task.status !== 'Annullato' && task.status !== 'In Approvazione Cliente';

    useEffect(() => {
        if (isHighlighted && cardRef.current) {
            cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [isHighlighted]);

    const unapprovedDependencies = useMemo(() => {
        if (!task.dependencies || task.dependencies.length === 0) {
            return [];
        }
        return task.dependencies.map((depId: string) =>
            allTasks.find((t: Task) => t.id === depId)
        ).filter((t: Task | undefined) => t && t.status !== 'Approvato');
    }, [task.dependencies, allTasks]);


    const approvalAttachment = useMemo(() => {
        if (!isTaskInApproval || !task.attachments || task.attachments.length === 0) {
            return null;
        }

        const approvalAtt = task.attachments.find((att: Attachment) => att.documentType === 'Approvazione');

        if (approvalAtt && approvalAtt.url && approvalAtt.url.startsWith('http') && /\.(jpg|jpeg|png|gif|webp)$/i.test(approvalAtt.url)) {
            return approvalAtt;
        }

        const imageAttachments = task.attachments
            .filter((att: Attachment) => att.url && att.url.startsWith('http') && /\.(jpg|jpeg|png|gif|webp)$/i.test(att.url))
            .sort((a: Attachment, b: Attachment) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());

        return imageAttachments[0] || null;
    }, [isTaskInApproval, task.attachments]);

    const renderTooltipContent = () => {
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
        if (task.requiresTwoStepApproval && task.status === 'In Approvazione' && task.approvals && task.approvals.length > 0) {
            return (
                <div className="space-y-1 text-sm">
                    <p className="font-bold">Approvato {task.approvals.length}/2. In attesa del secondo approvatore.</p>
                    <ul className="list-disc pl-4 pt-1">
                        {task.approvals?.map((app: TaskApproval) => (
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
                // Always toggle glass-card unless specifically overridden by a SOLID background, but here we use transparent backgrounds for states too
                'glass-card',
                // 1. Timer Attivo -> Glow Verde + Sfondo Verde Molto Trasparente
                isTimerActiveForThisTask && '!bg-green-500/10 dark:!bg-green-900/20 border-green-500/50 animate-pulse',
                // 2. In Approvazione RECENTE (<24h) -> Glow Viola ANIMATO + Sfondo Viola Trasparente
                (isTaskInApproval && approvalDaysPending < 1) && '!bg-purple-500/10 dark:!bg-purple-900/20 border-purple-500/50 animate-glow-custom',
                // 3. Scaduto (e non in approvazione) -> Bordo Rosso FISSO
                isOverdue && 'border-red-500 border-2',
                // 4. Highlighted (Selezione URL) -> Ring Blu statico
                isHighlighted && 'ring-2 ring-primary shadow-lg',
                // Ensure no conflicting bg overwrites the glass effect
                !isTimerActiveForThisTask && !isTaskInApproval && !isTaskInApproval && 'bg-transparent'
            )}
        >
            {project && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewProject(project);
                                }}
                                className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors z-10"
                            >
                                <FolderKanban className="h-3 w-3" />
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
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Badge
                                        style={{ backgroundColor: statusColors[task.status as keyof typeof statusColors].bg.replace('100', '500'), color: 'white' }}
                                        className="mb-2"
                                    >
                                        {task.status}
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {renderTooltipContent()}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {isTaskInApproval && approvalDaysPending >= 1 && (
                            <Badge
                                variant="destructive"
                                className="mb-2 ml-2 text-xs font-bold shadow-md flex items-center gap-1 animate-breathing-custom bg-red-600 hover:bg-red-700"
                            >
                                <Timer className="h-3 w-3" />
                                ⚠️ In attesa da {approvalDaysPending} giorn{approvalDaysPending === 1 ? 'o' : 'i'}
                            </Badge>
                        )}

                        {isTaskInApproval && (() => {
                            const dateSource = task.updatedAt || task.createdAt;
                            const dateLabel = task.updatedAt ? 'Richiesta' : 'Creato';
                            return (
                                <div className="text-xs text-purple-600 dark:text-purple-400 mb-1 flex items-center gap-1 font-medium">
                                    <Clock className="h-3 w-3" />
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

                        <p className="font-bold text-sm" style={{ color: client?.color }}>{client?.name}</p>
                        <CardTitle className="font-headline text-lg -mt-1">
                            {task.title}
                        </CardTitle>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreVertical />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleOpenModal('edit', task)} disabled={task.status === 'Approvato' && !canApprove}>Modifica</DropdownMenuItem>
                            {canApprove && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive" onClick={() => setTaskToDelete(task)}>Elimina</DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>
            <CardContent className="flex-grow">
                <div className="flex gap-2 mb-2">
                    {task.attachments && task.attachments.length > 0 && (
                        <Badge variant="secondary" className="text-xs px-1 py-0 h-5 gap-1" title={`${task.attachments.length} Allegati`}>
                            <Paperclip className="h-3 w-3" /> {task.attachments.length}
                        </Badge>
                    )}
                    {task.dependencies && task.dependencies.length > 0 && (
                        <Badge variant="secondary" className="text-xs px-1 py-0 h-5 gap-1" title={`${task.dependencies.length} Dipendenze`}>
                            <LinkIcon className="h-3 w-3" /> {task.dependencies.length}
                        </Badge>
                    )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">{task.description}</p>
                {task.estimatedDuration > 0 ? (
                    <div className="mb-4">
                        <div className="flex flex-col gap-1.5 mb-2">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Progresso</span>
                                <span className={cn(
                                    "font-semibold text-xs",
                                    timeExceeded && "text-red-600",
                                    timeWarning && "text-amber-600"
                                )}>{timeProgress.toFixed(0)}%</span>
                            </div>
                            {(timeExceeded || timeWarning) && (
                                <div className="flex items-center justify-between">
                                    {timeExceeded && (
                                        <Badge variant="destructive" className="text-xs px-2 py-0.5 gap-1">
                                            ⚠️ Tempo superato
                                        </Badge>
                                    )}
                                    {timeWarning && !timeExceeded && (
                                        <Badge variant="outline" className="text-xs px-2 py-0.5 border-amber-400 text-amber-600 gap-1">
                                            ⏰ Quasi al limite
                                        </Badge>
                                    )}
                                    <span className={cn(
                                        "text-xs font-mono",
                                        timeExceeded ? "text-red-600" : "text-amber-600"
                                    )}>{timeSpentFormatted}</span>
                                </div>
                            )}
                            {!timeExceeded && !timeWarning && task.timeSpent && task.timeSpent > 0 && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>{timeSpentFormatted}</span>
                                </div>
                            )}
                        </div>
                        <Progress
                            value={Math.min(timeProgress, 100)}
                            className={cn(
                                "h-2",
                                timeExceeded && "[&>div]:bg-red-500",
                                timeWarning && "[&>div]:bg-amber-500"
                            )}
                        />
                    </div>
                ) : task.timeSpent && task.timeSpent > 0 ? (
                    <div className="mb-4">
                        <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Tempo registrato:</span>
                            <Badge variant="secondary" className="font-semibold">{timeSpentFormatted}</Badge>
                        </div>
                    </div>
                ) : null}
                <div className="text-sm space-y-2 text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {task.dueDate ? (
                            <Badge
                                variant={daysRemaining !== null && daysRemaining < 0 && task.status !== 'Approvato' ? 'destructive' :
                                    daysRemaining !== null && daysRemaining <= 3 && task.status !== 'Approvato' ? 'default' : 'secondary'}
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
                        <Target className="h-4 w-4" />
                        <span>Priorità: </span>
                        <Badge
                            variant="outline"
                            className={cn(priorityClasses[task.priority])}
                        >
                            {task.priority}
                        </Badge>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between gap-2 pt-3 border-t overflow-hidden">
                <div className="flex items-center -space-x-1.5 flex-shrink-0">
                    {creator && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Avatar className="h-7 w-7 border-2 border-background">
                                        <AvatarFallback style={{ backgroundColor: creator.color, color: 'white' }} className="text-xs">
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
                                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-secondary/50 hover:bg-secondary transition-colors">
                                        <Avatar className="h-5 w-5">
                                            <AvatarFallback style={{ backgroundColor: assignedUser.color, color: 'white' }} className="text-[10px]">
                                                {getInitials(assignedUser.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-[10px] font-medium max-w-[40px] truncate">{assignedUser.name.split(' ')[0]}</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent><p>Assegnato a {assignedUser.name}</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                    {isTaskInApproval && canApprove ? (
                        <>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="relative">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-100 hover:text-green-700" onClick={() => unapprovedDependencies.length === 0 && setApprovalState({ isOpen: true, task, sendEmail: true })} disabled={unapprovedDependencies.length > 0}>
                                                <ThumbsUp className="h-4 w-4" />
                                            </Button>
                                            {unapprovedDependencies.length > 0 && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <AlertTriangle className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 text-orange-500 bg-white rounded-full" />
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
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-100 hover:text-red-700" onClick={() => setDisapprovalModalState({ isOpen: true, task: task, reason: '', sendEmail: true })}>
                                            <ThumbsDown className="h-4 w-4" />
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
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSendForApproval(task)}>
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Invia in Approvazione</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : null}

                    {isTimerActiveForThisTask ? (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handlePlay(task)}>
                            <Square className="h-4 w-4 fill-current" />
                        </Button>
                    ) : (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-100" onClick={() => handlePlay(task)} disabled={['Annullato', 'In Approvazione', 'In Approvazione Cliente', 'Approvato'].includes(task.status)}>
                            <Play className="h-4 w-4 fill-current" />
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => setPreviewTask(task)}>
                        <Eye className="h-4 w-4" />
                    </Button>
                    <div className="relative">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-600 hover:bg-purple-100" onClick={() => handleChatOpen(task)}>
                            <MessageSquare className="h-4 w-4" />
                        </Button>
                        {task.comments && task.comments.length > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 min-w-4 px-0.5 text-[10px] font-bold text-white bg-purple-600 rounded-full shadow-sm">
                                {task.comments.length}
                            </span>
                        )}
                    </div>
                </div>
            </CardFooter>
        </Card>
    );
};

function TasksPageContent() {
    const {
        currentUser,
        users,
        clients,
        permissions,
        isLoadingLayout,
        pomodoroTask,
        setPomodoroTask,
    } = useLayoutData();

    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [allProjects, setAllProjects] = useState<Project[]>([]);
    const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);

    const [modalState, setModalState] = useState<ModalState>({ mode: 'create', isOpen: false });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deadlineModalState, setDeadlineModalState] = useState<{ isOpen: boolean; savedTaskData: any; }>({ isOpen: false, savedTaskData: null });
    const [disapprovalModalState, setDisapprovalModalState] = useState<DisapprovalModalState>({ isOpen: false, task: undefined, reason: '', sendEmail: true });
    const [approvalState, setApprovalState] = useState<ApprovalActionState>({ isOpen: false, task: undefined, sendEmail: true });
    const [fileAttachmentModalState, setFileAttachmentModalState] = useState<FileAttachmentModalState>({ isOpen: false, task: undefined, attachmentUrl: '', attachmentFilename: '', attachmentFile: undefined });
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
    const [previewTask, setPreviewTask] = useState<Task | null>(null);
    const [previewProject, setPreviewProject] = useState<Project | null>(null);
    const [dependencyError, setDependencyError] = useState<string[] | null>(null);
    const [rejectionReasonToShow, setRejectionReasonToShow] = useState<string | null>(null);
    const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);


    const [view, setView] = useState<View>('board');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'createdAt'>('dueDate');

    const [chattingTask, setChattingTask] = useState<Task | null>(null);

    const router = useRouter();
    const searchParams = useSearchParams();
    const [isClient, setIsClient] = useState(false);

    const usersById = useMemo(() => users.reduce((acc, user) => ({ ...acc, [user.id]: user }), {} as Record<string, User>), [users]);


    const canApprove = useMemo(() => {
        if (!currentUser) return false;
        if (currentUser.role === 'Amministratore') return true;
        return permissions[currentUser.role]?.includes('_approve-tasks') || false;
    }, [currentUser, permissions]);

    const canCreate = useMemo(() => {
        if (!currentUser) return false;
        if (currentUser.role === 'Amministratore') return true;
        return permissions[currentUser.role]?.includes('_create-task') || false;
    }, [currentUser, permissions]);

    const getInitialFilters = useCallback(() => {
        const projectIdFromUrl = searchParams.get('projectId');
        const clientIdFromUrl = searchParams.get('clientId');

        let initialUserId = 'all';
        if (currentUser && (currentUser.role === 'Collaboratore' || currentUser.role === 'Project Manager')) {
            initialUserId = currentUser.id;
        }

        return {
            clientId: clientIdFromUrl || 'all',
            userId: initialUserId,
            activityType: 'all',
            status: 'active',
            projectId: projectIdFromUrl || 'all',
        }
    }, [currentUser, searchParams]);

    const [filters, setFilters] = useState(getInitialFilters);

    const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        const unsubs = [
            onSnapshot(collection(db, "tasks"), (snapshot) => {
                const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Task);
                setAllTasks(data);
            }),
            onSnapshot(collection(db, "projects"), (snapshot) => {
                const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Project);
                setAllProjects(data);
            }),
            onSnapshot(collection(db, "activityTypes"), (snapshot) => {
                const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as ActivityType);
                setActivityTypes(data);
            }),
        ];
        return () => unsubs.forEach(unsub => unsub());
    }, []);

    const resetFilters = useCallback(() => {
        const currentPath = window.location.pathname;
        router.replace(currentPath, { scroll: false });
        setFilters(getInitialFilters());
    }, [getInitialFilters, router]);

    useEffect(() => {
        const taskIdFromUrl = searchParams.get('taskId');
        const projectIdFromUrl = searchParams.get('projectId');
        const clientIdFromUrl = searchParams.get('clientId');

        if (projectIdFromUrl) handleFilterChange('projectId', projectIdFromUrl);
        if (clientIdFromUrl) handleFilterChange('clientId', clientIdFromUrl);

        if (taskIdFromUrl) {
            setHighlightedTaskId(taskIdFromUrl);
            // Remove highlight after a delay
            const timer = setTimeout(() => {
                setHighlightedTaskId(null);
                // Clean the URL
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.delete('taskId');
                router.replace(newUrl.toString(), { scroll: false });
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [searchParams, router]);


    const handleOpenModal = (mode: 'create' | 'edit', task?: Task | Partial<Task>) => {
        setModalState({ mode, task: task as Task, isOpen: true });
    }

    const handleCloseModal = () => {
        setModalState({ mode: 'create', isOpen: false, task: undefined });
    }


    const handleFormSubmit = useCallback(async (data: Partial<Task>, attachments: Attachment[]) => {
        if (!currentUser) {
            toast.error("Utente non autenticato.");
            return;
        }

        setIsSubmitting(true);
        let taskId: string | undefined;

        try {
            if (data.projectId) {
                const project = allProjects.find(p => p.id === data.projectId);
                if (project && project.clientId !== data.clientId) {
                    toast.error("Il cliente del task non corrisponde a quello del progetto selezionato.");
                    setIsSubmitting(false);
                    return;
                }
            }

            const taskPayload: Partial<Task> = { ...data, attachments };
            const sendEmail = (data as any).sendEmailNotification ?? true;

            if (modalState.mode === 'create') {
                const payloadWithStatus = { status: 'Da Fare' as const, timeSpent: 0, ...taskPayload };
                const result = await addTask(payloadWithStatus as Omit<Task, 'id'>, currentUser.id);
                taskId = result.taskId;
                toast.success("Task creato con successo.");
            } else if (modalState.mode === 'edit' && modalState.task?.id) {
                taskId = modalState.task.id;
                await updateTask(taskId, taskPayload, currentUser.id, canApprove, sendEmail);
                toast.success("Task aggiornato con successo.");
            }

            handleCloseModal();
            if (modalState.mode === 'create') {
                // Do not reset filters to let user see their newly created task
            }

            if (taskId && taskPayload.activityType) {
                const activityType = activityTypes.find(at => at.name === taskPayload.activityType);
                if (modalState.mode === 'create' && activityType?.hasDeadlineTask) {
                    setDeadlineModalState({ isOpen: true, savedTaskData: { ...taskPayload, title: `[SCADENZA] - ${taskPayload.title}` } });
                }
            }

            return taskId;
        } catch (error: any) {
            console.error(`Failed to ${modalState.mode} task:`, error);
            if (error.message.startsWith('Impossibile completare.')) {
                const taskNames = error.message.replace('Impossibile completare. I seguenti task devono essere prima approvati: ', '').split(', ');
                setDependencyError(taskNames);
            } else {
                toast.error(error.message || `Impossibile ${modalState.mode === 'create' ? 'creare' : 'aggiornare'} il task.`);
            }
            return undefined;
        } finally {
            setIsSubmitting(false);
        }
    }, [modalState, activityTypes, allProjects, currentUser, canApprove]);


    const handleFileAttachmentSubmit = async () => {
        if (!fileAttachmentModalState.task || !currentUser) return;

        const { task, attachmentUrl, attachmentFilename, attachmentFile } = fileAttachmentModalState;

        try {
            setIsSubmitting(true);

            // Se il timer è attivo per questo task, fermalo e salva il tempo
            const isTimerActiveForThisTask = pomodoroTask?.id === task.id;
            if (isTimerActiveForThisTask && task.timerStartedAt) {
                try {
                    const timerStart = new Date(task.timerStartedAt).getTime();
                    const now = Date.now();
                    const elapsedSeconds = Math.floor((now - timerStart) / 1000);

                    if (elapsedSeconds > 0) {
                        await stopTaskTimer(task.id, elapsedSeconds);
                        toast.info(`Timer fermato automaticamente. Salvati ${Math.floor(elapsedSeconds / 60)} minuti.`);
                    }

                    // Resetta il pomodoro widget
                    setPomodoroTask(null);
                } catch (error) {
                    console.error("Errore nel fermare il timer:", error);
                }
            }

            let newAttachment: Attachment;

            // Se c'è un file da caricare, usa Firebase Storage
            if (attachmentFile) {
                const uploadedAttachments = await uploadFilesAndGetAttachments(
                    [attachmentFile],
                    `tasks/${task.id}/approvals`,
                    currentUser.id
                );

                if (uploadedAttachments.length === 0) {
                    throw new Error('Errore durante il caricamento del file.');
                }

                newAttachment = {
                    ...uploadedAttachments[0],
                    documentType: 'Approvazione'
                };
            } else {
                // È un link, crea l'allegato direttamente
                newAttachment = {
                    url: attachmentUrl,
                    filename: attachmentFilename || 'Link allegato',
                    date: new Date().toISOString(),
                    userId: currentUser.id,
                    version: 1,
                    documentType: 'Approvazione'
                };
            }

            // Aggiorna il task con il nuovo allegato e cambia stato a "In Approvazione"
            const updatedAttachments = [...(task.attachments || []), newAttachment];
            await updateTask(
                task.id,
                {
                    attachments: updatedAttachments,
                    status: 'In Approvazione'
                },
                currentUser.id,
                canApprove,
                true
            );

            setFileAttachmentModalState({ isOpen: false, task: undefined, attachmentUrl: '', attachmentFilename: '', attachmentFile: undefined });
            toast.success("Task inviato in approvazione con allegato.");
        } catch (error: any) {
            console.error("Failed to submit for approval:", error);
            toast.error(error.message || "Impossibile inviare il task in approvazione.");
        } finally {
            setIsSubmitting(false);
        }
    };


    const handleCreateDeadlineTask = () => {
        const { savedTaskData } = deadlineModalState;
        if (!savedTaskData) return;

        const deadlineTaskData: Partial<Task> = {
            ...savedTaskData,
            dueDate: undefined,
        };

        handleOpenModal('create', deadlineTaskData);
        setDeadlineModalState({ isOpen: false, savedTaskData: null });
    };

    const handlePlay = async (task: Task) => {
        if (!currentUser) return;

        const isTimerActiveForThisTask = pomodoroTask?.id === task.id;

        if (isTimerActiveForThisTask) {
            // If we click stop, the pomodoro widget will handle saving time.
            setPomodoroTask(null);
        } else {
            // If another timer is running, stop it first.
            // The PomodoroWidget's useEffect will handle saving its time.
            if (pomodoroTask) {
                setPomodoroTask(null);
            }

            if (task.status !== 'In Lavorazione') {
                try {
                    await updateTask(task.id, { status: 'In Lavorazione' }, currentUser.id, canApprove, false);
                    toast.info(`Task "${task.title}" spostato in "In Lavorazione".`);
                } catch (error: any) {
                    toast.error("Errore", { description: `Impossibile aggiornare lo stato del task: ${error.message}` });
                    return;
                }
            }
            // Use a timeout to ensure the old task's cleanup runs before starting the new one
            setTimeout(() => setPomodoroTask(task), 150);
        }
    };



    const handleApprove = async () => {
        if (!approvalState.task || !currentUser) return;
        const { task, sendEmail } = approvalState;

        try {
            await updateTask(task.id, { status: 'Approvato', rejectionReason: '' }, currentUser.id, canApprove, sendEmail);
            playSound('task_approval');
            window.dispatchEvent(new Event('taskCompleted'));
            toast.success("Task Approvato", { description: `"${task.title}" è stato approvato.` });
        } catch (error: any) {
            console.error("Failed to approve task:", error);
            if (error.message.startsWith('Impossibile completare.')) {
                const taskNames = error.message.replace('Impossibile completare. I seguenti task devono essere prima approvati: ', '').split(', ');
                setDependencyError(taskNames);
            } else {
                toast.error("Impossibile approvare il task.");
            }
        } finally {
            setApprovalState({ isOpen: false, task: undefined, sendEmail: true });
        }
    }

    const handleSendForApproval = async (task: Task) => {
        if (!currentUser) return;

        // Se il timer è attivo per questo task, fermalo e salva il tempo
        const isTimerActiveForThisTask = pomodoroTask?.id === task.id;
        if (isTimerActiveForThisTask && task.timerStartedAt) {
            try {
                const timerStart = new Date(task.timerStartedAt).getTime();
                const now = Date.now();
                const elapsedSeconds = Math.floor((now - timerStart) / 1000);

                if (elapsedSeconds > 0) {
                    await stopTaskTimer(task.id, elapsedSeconds);
                    toast.info(`Timer fermato automaticamente. Salvati ${Math.floor(elapsedSeconds / 60)} minuti.`);
                }

                // Resetta il pomodoro widget
                setPomodoroTask(null);
            } catch (error) {
                console.error("Errore nel fermare il timer:", error);
            }
        }

        // Se skipAttachmentOnApproval è true, invia direttamente
        if (task.skipAttachmentOnApproval) {
            try {
                await updateTask(task.id, { status: 'In Approvazione' }, currentUser.id, canApprove, true);
                toast.info("Task inviato in approvazione.");
            } catch (error: any) {
                console.error("Failed to send task for approval:", error);
                toast.error("Impossibile inviare il task in approvazione.");
            }
            return;
        }

        // Verifica presenza di allegati
        const hasAttachments = task.attachments && task.attachments.length > 0;

        if (!hasAttachments) {
            // Apri il modal per aggiungere allegati
            setFileAttachmentModalState({
                isOpen: true,
                task: task,
                attachmentUrl: '',
                attachmentFilename: '',
                attachmentFile: undefined
            });
        } else {
            // Se ci sono già allegati, invia direttamente
            try {
                await updateTask(task.id, { status: 'In Approvazione' }, currentUser.id, canApprove, true);
                toast.info("Task inviato in approvazione.");
            } catch (error: any) {
                console.error("Failed to send task for approval:", error);
                toast.error("Impossibile inviare il task in approvazione.");
            }
        }
    };

    const handleDisapprove = async () => {
        if (!disapprovalModalState.task || !currentUser) return;
        const { task, reason, sendEmail } = disapprovalModalState;

        try {
            // Rimuovi gli allegati di approvazione quando si respinge
            const remainingAttachments = task.attachments?.filter(att => att.documentType !== 'Approvazione') || [];

            const updateData: Partial<Task> = {
                status: 'Da Fare' as const,
                rejectionReason: reason,
                attachments: remainingAttachments
            };
            await updateTask(task.id, updateData, currentUser.id, canApprove, sendEmail);
            playSound('task_rejected');

            setDisapprovalModalState({ isOpen: false, task: undefined, reason: '', sendEmail: true });
            toast.warning("Task non approvato", { description: `"${task.title}" è stato riportato in "Da Fare" e gli allegati di approvazione sono stati rimossi.` });
        } catch (error: any) {
            console.error("Failed to disapprove task:", error);
            toast.error(error.message || "Impossibile respingere il task.");
        }
    };

    const handleChatOpen = (task: Task) => {
        setChattingTask(task);
    };

    const handleChatClose = async () => {
        const taskId = chattingTask?.id;
        setChattingTask(null);
    };

    const handleDeleteTask = async () => {
        if (!taskToDelete) return;
        try {
            if (currentUser?.role === 'Amministratore') {
                await deleteTask(taskToDelete.id, currentUser.id);
                setTaskToDelete(null);
                toast.success("Task eliminato.");
            } else {
                toast.error("Azione non permessa", { description: "Non hai i permessi per eliminare un task." });
            }
        } catch (error: any) {
            toast.error(error.message || "Impossibile eliminare il task.");
        }
    };


    const filteredTasks = useMemo(() => {
        if (!currentUser) return [];
        let tasks = [...allTasks];

        // Apply search query first
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            tasks = tasks.filter(t =>
                t.title.toLowerCase().includes(query) ||
                (t.description && t.description.toLowerCase().includes(query))
            );
        }

        // Filter based on user role and selected user filter
        if (currentUser.role === 'Amministratore') {
            if (filters.userId !== 'all') {
                tasks = tasks.filter(t => t.assignedUserId === filters.userId);
            }
        } else if (currentUser.role === 'Project Manager') {
            if (filters.userId === 'all') {
                // PMs see all tasks when filter is 'all'
            } else if (filters.userId === currentUser.id) {
                // "I Miei Task" for PMs: assigned to them OR created by them
                tasks = tasks.filter(t => t.assignedUserId === currentUser.id || t.createdBy === currentUser.id);
            } else {
                // PM is viewing another user's tasks
                tasks = tasks.filter(t => t.assignedUserId === filters.userId);
            }
        } else { // Collaboratore - vede SOLO i task assegnati a lui
            tasks = tasks.filter(t => t.assignedUserId === currentUser.id);
        }

        // Apply other filters
        if (filters.clientId !== 'all') {
            tasks = tasks.filter(t => t.clientId === filters.clientId);
        }
        if (filters.activityType !== 'all') {
            tasks = tasks.filter(t => t.activityType === filters.activityType);
        }
        if (filters.projectId !== 'all') {
            tasks = tasks.filter(t => t.projectId === filters.projectId);
        }
        if (filters.status === 'active') {
            tasks = tasks.filter(task => task.status !== 'Annullato' && task.status !== 'Approvato');
        } else if (filters.status === 'completed') {
            tasks = tasks.filter(task => task.status === 'Approvato');
        }

        return tasks;

    }, [allTasks, currentUser, filters]);



    const { tasksByStatus, overdueTasks } = useMemo(() => {
        const overdue: Task[] = [];
        const byStatus: Record<Task['status'], Task[]> = {
            'Da Fare': [],
            'In Lavorazione': [],
            'In Approvazione': [],
            'In Approvazione Cliente': [],
            'Approvato': [],
            'Annullato': [],
        };

        filteredTasks.forEach(task => {
            if (!task.dueDate) {
                if (byStatus[task.status]) {
                    byStatus[task.status].push(task);
                }
                return;
            };

            const isTaskOverdue = isBefore(parseISO(task.dueDate), startOfToday()) && !['Approvato', 'Annullato', 'In Approvazione', 'In Approvazione Cliente'].includes(task.status);

            if (isTaskOverdue) {
                overdue.push(task);
            } else if (byStatus[task.status]) {
                byStatus[task.status].push(task);
            }
        });

        const priorityOrder: Record<string, number> = { 'Critica': 0, 'Alta': 1, 'Media': 2, 'Bassa': 3 };

        const sortFn = (a: Task, b: Task) => {
            switch (sortBy) {
                case 'dueDate':
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                case 'priority':
                    return (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
                case 'createdAt':
                    if (!a.createdAt && !b.createdAt) return 0;
                    if (!a.createdAt) return 1;
                    if (!b.createdAt) return -1;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                default:
                    return 0;
            }
        };

        Object.values(byStatus).forEach(arr => arr.sort(sortFn));
        // Sort 'In Approvazione' by updatedAt descending (most recent requests first)
        byStatus['In Approvazione'].sort((a, b) => {
            const getUpdateDate = (task: typeof a) => {
                if (!task.updatedAt) return new Date(0);
                return typeof task.updatedAt === 'string'
                    ? new Date(task.updatedAt)
                    : (task.updatedAt as any).toDate ? (task.updatedAt as any).toDate() : new Date(0);
            };
            return getUpdateDate(b).getTime() - getUpdateDate(a).getTime();
        });
        overdue.sort(sortFn);

        return {
            tasksByStatus: byStatus,
            overdueTasks: overdue,
        };
    }, [filteredTasks, sortBy]);

    const sortedListTasks = useMemo(() => {
        const priorityOrder: Record<string, number> = { 'Critica': 0, 'Alta': 1, 'Media': 2, 'Bassa': 3 };

        return [...filteredTasks].sort((a, b) => {
            switch (sortBy) {
                case 'dueDate':
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                case 'priority':
                    return (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
                case 'createdAt':
                    if (!a.createdAt && !b.createdAt) return 0;
                    if (!a.createdAt) return 1;
                    if (!b.createdAt) return -1;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                default:
                    return 0;
            }
        });
    }, [filteredTasks, sortBy]);


    const visibleStatuses = useMemo(() => {
        if (filters.status === 'all') {
            return allTaskStatuses;
        }
        if (filters.status === 'completed') {
            return ['Approvato'];
        }
        // active
        return allTaskStatuses.filter(s => s !== 'Annullato' && s !== 'Approvato');
    }, [filters.status]);

    const activeFiltersForDisplay = useMemo(() => {
        const active: { label: string, value: string }[] = [];
        const initialFilters = getInitialFilters();

        if (filters.status !== initialFilters.status) {
            let statusLabel = 'Tutti';
            if (filters.status === 'active') statusLabel = 'Attivi';
            if (filters.status === 'completed') statusLabel = 'Completati';
            active.push({ label: 'Stato', value: statusLabel });
        }
        if (filters.clientId !== 'all') {
            active.push({ label: 'Cliente', value: clients.find(c => c.id === filters.clientId)?.name || '' });
        }
        if (filters.projectId !== 'all') {
            active.push({ label: 'Progetto', value: allProjects.find(p => p.id === filters.projectId)?.name || '' });
        }
        if (filters.userId !== initialFilters.userId) {
            active.push({ label: 'Utente', value: users.find(u => u.id === filters.userId)?.name || '' });
        }
        if (filters.activityType !== 'all') {
            active.push({ label: 'Attività', value: filters.activityType });
        }

        return active.filter(f => f.value);
    }, [filters, getInitialFilters, clients, allProjects, users]);

    const renderCommentText = (text: string) => {
        const mentionRegex = /@\[([^\]]+)\]\(user:([a-zA-Z0-9]+)\)/g;
        let result: (string | JSX.Element)[] = [];
        let lastIndex = 0;
        let match;

        while ((match = mentionRegex.exec(text)) !== null) {
            const [fullMatch, name, userId] = match;
            const textBefore = text.substring(lastIndex, match.index);
            if (textBefore) {
                result.push(textBefore);
            }
            result.push(<strong key={match.index} className="text-primary">@{name}</strong>);
            lastIndex = mentionRegex.lastIndex;
        }

        const textAfter = text.substring(lastIndex);
        if (textAfter) {
            result.push(textAfter);
        }

        return <>{result}</>;
    };

    if (isLoadingLayout) {
        return (
            <div className="flex flex-col gap-6 p-6">
                <div className="flex items-center justify-between">
                    <div className="h-10 w-48 bg-muted animate-pulse rounded" />
                    <div className="h-10 w-32 bg-muted animate-pulse rounded" />
                </div>
                {view === 'board' ? <SkeletonTaskBoard columns={4} /> : <SkeletonTaskList rows={8} />}
            </div>
        );
    }

    const renderBoardView = () => {
        const boardColumns = [...visibleStatuses];
        if (filters.status === 'active') {
            boardColumns.unshift('Scaduti');
        }

        return (
            <div className="flex flex-col md:flex-row gap-6 md:overflow-x-auto pb-4">
                {boardColumns.map(status => {
                    const tasksForColumn = status === 'Scaduti' ? overdueTasks : tasksByStatus[status as Task['status']];
                    const isOverdueColumn = status === 'Scaduti';

                    if (!tasksForColumn) return null;

                    return (
                        <div key={status} className="w-full md:w-80 md:flex-shrink-0">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2">
                                    {isOverdueColumn ? (
                                        <AlertTriangle className="w-4 h-4 text-destructive" />
                                    ) : (
                                        <span className={`w-3 h-3 rounded-full ${statusColors[status as Task['status']].bg.replace('100', '500')}`}></span>
                                    )}
                                    <h2 className={cn("font-semibold text-lg", isOverdueColumn && "text-destructive")}>{status}</h2>
                                </div>
                                <Badge variant={isOverdueColumn ? 'destructive' : 'secondary'} className="px-3 py-1 text-sm">{tasksForColumn.length}</Badge>
                            </div>
                            <div className="p-2 rounded-lg min-h-[500px] space-y-4 bg-secondary/50">
                                {tasksForColumn.map(task => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        clients={clients}
                                        allProjects={allProjects}
                                        allTasks={allTasks}
                                        usersById={usersById}
                                        canApprove={canApprove}
                                        handlePlay={handlePlay}
                                        handleSendForApproval={handleSendForApproval}
                                        setApprovalState={setApprovalState}
                                        setDisapprovalModalState={setDisapprovalModalState}
                                        setRejectionReasonToShow={setRejectionReasonToShow}
                                        setPreviewTask={setPreviewTask}
                                        setPreviewProject={setPreviewProject}
                                        handleChatOpen={handleChatOpen}
                                        handleOpenModal={handleOpenModal}
                                        setTaskToDelete={setTaskToDelete}
                                        isHighlighted={task.id === highlightedTaskId}
                                    />
                                ))}
                                {tasksForColumn.length === 0 && (
                                    <EmptyTasksState onCreateTask={canCreate ? () => handleOpenModal('create') : undefined} />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    const renderListView = () => {
        if (sortedListTasks.length === 0) {
            return (
                <Card>
                    <CardContent className="p-8">
                        {searchQuery ? (
                            <EmptySearchState query={searchQuery} />
                        ) : (
                            <EmptyTasksState onCreateTask={canCreate ? () => handleOpenModal('create') : undefined} />
                        )}
                    </CardContent>
                </Card>
            );
        }

        return (
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Task</TableHead>
                                <TableHead className="hidden sm:table-cell">Progetto</TableHead>
                                <TableHead className="hidden md:table-cell">Assegnato a</TableHead>
                                <TableHead className="hidden lg:table-cell">Creato da</TableHead>
                                <TableHead>Scadenza</TableHead>
                                <TableHead>Priorità</TableHead>
                                <TableHead>Stato</TableHead>
                                <TableHead className="text-right">Azioni</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedListTasks.map(task => {
                                const client = clients.find(c => c.id === task.clientId);
                                const project = allProjects.find(p => p.id === task.projectId);
                                const assignedUser = task.assignedUserId ? usersById[task.assignedUserId] : null;
                                const creator = task.createdBy ? usersById[task.createdBy] : null;
                                const isTimerActiveForThisTask = pomodoroTask?.id === task.id;
                                const isTaskInApproval = task.status === 'In Approvazione';

                                return (
                                    <TableRow key={task.id} className={cn(task.id === highlightedTaskId ? 'bg-primary/10' : '')}>
                                        <TableCell>
                                            <div className="font-medium">{task.title}</div>
                                            <div className="text-sm text-muted-foreground">{client?.name}</div>
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell">{project?.name || '-'}</TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            {assignedUser ? (
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarFallback className="text-xs" style={{ backgroundColor: assignedUser.color, color: 'white' }}>
                                                            {getInitials(assignedUser.name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span>{assignedUser.name.split(' ')[0]}</span>
                                                </div>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell">{creator?.name || '-'}</TableCell>
                                        <TableCell>{isClient && task.dueDate ? format(new Date(task.dueDate), 'PPP p', { locale: it }) : '...'}</TableCell>
                                        <TableCell>
                                            <Badge className={`${priorityColors[task.priority]} text-white`}>{task.priority}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`${statusColors[task.status].bg} ${statusColors[task.status].text}`}>{task.status}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex gap-1 justify-end items-center">
                                                {isTaskInApproval && canApprove ? (
                                                    <>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:bg-green-100 hover:text-green-700" onClick={() => setApprovalState({ isOpen: true, task, sendEmail: true })}>
                                                            <ThumbsUp />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-100 hover:text-red-700" onClick={() => setDisapprovalModalState({ isOpen: true, task: task, reason: '', sendEmail: true })}>
                                                            <ThumbsDown />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handlePlay(task)} disabled={['Annullato', 'In Approvazione', 'Approvato'].includes(task.status)}>
                                                        <Play />
                                                    </Button>
                                                )}
                                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPreviewTask(task)}>
                                                    <Eye />
                                                </Button>
                                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChatOpen(task)}><MessageSquare /></Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7">
                                                            <MoreVertical />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem onClick={() => handleOpenModal('edit', task)} disabled={task.status === 'Approvato' && !canApprove}>
                                                            <Pencil className="mr-2 h-4 w-4" />
                                                            Modifica
                                                        </DropdownMenuItem>
                                                        {canApprove && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem className="text-destructive" onClick={() => setTaskToDelete(task)}>
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Elimina
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="p-4 sm:p-6 h-full flex flex-col">
            <div className="flex-shrink-0">
                <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center mb-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline">Tasks</h1>
                        <p className="text-muted-foreground">Visualizza, gestisci e crea nuovi task.</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                                Totale: {filteredTasks.length}
                            </Badge>
                            {Object.entries(
                                filteredTasks.reduce((acc: Record<string, number>, t: Task) => {
                                    acc[t.status] = (acc[t.status] || 0) + 1;
                                    return acc;
                                }, {} as Record<string, number>)
                            ).map(([status, count]) => (
                                <Badge
                                    key={status}
                                    variant="secondary"
                                    className="text-xs"
                                    style={{
                                        backgroundColor: statusColors[status as keyof typeof statusColors]?.bg || 'gray',
                                        color: statusColors[status as keyof typeof statusColors]?.text || 'black'
                                    }}
                                >
                                    {status}: {count}
                                </Badge>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={sortBy} onValueChange={(v: 'dueDate' | 'priority' | 'createdAt') => setSortBy(v)}>
                            <SelectTrigger className="w-[180px] h-9">
                                <SelectValue placeholder="Ordina per" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="dueDate">Scadenza più vicina</SelectItem>
                                <SelectItem value="priority">Priorità più alta</SelectItem>
                                <SelectItem value="createdAt">Creato di recente</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant={view === 'board' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('board')} title="Vista Board">
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('list')} title="Vista Lista">
                            <List className="h-4 w-4" />
                        </Button>
                        <Button variant={view === 'gantt' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('gantt')} title="Vista Gantt">
                            <GanttChart className="h-4 w-4" />
                        </Button>
                        {canCreate && (
                            <Button onClick={() => handleOpenModal('create')} disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '+ Nuovo Task'}
                            </Button>
                        )}
                    </div>
                </div>

                <Collapsible defaultOpen={false}>
                    <Card className="mb-6 rounded-xl">
                        <CollapsibleTrigger asChild>
                            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-xl">
                                <CardTitle className="flex items-center gap-2 text-lg justify-between">
                                    <span className="flex items-center gap-2"><Filter /> Filtri</span>
                                    <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CardTitle>
                            </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                <div className="flex flex-col gap-1.5 col-span-1 sm:col-span-2 md:col-span-1 lg:col-span-1">
                                    <Label htmlFor="search-task">Cerca</Label>
                                    <div className="relative">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="search-task"
                                            placeholder="Titolo o descrizione..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-8"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="status-filter">Visualizza</Label>
                                    <Select value={filters.status} onValueChange={(v) => handleFilterChange('status', v)} >
                                        <SelectTrigger id="status-filter"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Attivi</SelectItem>
                                            <SelectItem value="completed">Completati</SelectItem>
                                            <SelectItem value="all">Tutti</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="client-filter">Cliente</Label>
                                    <Select value={filters.clientId} onValueChange={(v) => handleFilterChange('clientId', v)} >
                                        <SelectTrigger id="client-filter"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tutti i Clienti</SelectItem>
                                            {[...clients].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' })).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="project-filter">Progetto</Label>
                                    <Select value={filters.projectId} onValueChange={(v) => handleFilterChange('projectId', v)} >
                                        <SelectTrigger id="project-filter"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tutti i Progetti</SelectItem>
                                            {[...allProjects].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' })).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="user-filter">Utente</Label>
                                    <Select value={filters.userId} onValueChange={(v) => handleFilterChange('userId', v)}>
                                        <SelectTrigger id="user-filter"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tutti gli Utenti</SelectItem>
                                            {[...users].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' })).map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="activity-filter">Attività</Label>
                                    <Select value={filters.activityType} onValueChange={(v) => handleFilterChange('activityType', v)} >
                                        <SelectTrigger id="activity-filter"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tutte le Attività</SelectItem>
                                            {[...activityTypes].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' })).map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                            <CardFooter className="gap-2">
                                {(currentUser?.role === 'Amministratore' || currentUser?.role === 'Project Manager') && (
                                    <Button variant="outline" size="sm" onClick={() => handleFilterChange('userId', currentUser?.id || 'all')}>
                                        <UserIcon className="mr-2 h-4 w-4" />
                                        I Miei Task
                                    </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={resetFilters}>
                                    Pulisci Filtri
                                </Button>
                            </CardFooter>
                        </CollapsibleContent>
                    </Card>
                </Collapsible>
            </div>

            <div className="flex-grow overflow-auto">
                {view === 'gantt' ? (
                    <TaskGanttChart
                        onTaskClick={(taskId) => {
                            const task = allTasks.find(t => t.id === taskId);
                            if (task) setPreviewTask(task);
                        }}
                    />
                ) : view === 'board' ? (
                    renderBoardView()
                ) : (
                    renderListView()
                )}
            </div>

            <Dialog open={modalState.isOpen} onOpenChange={(isOpen) => !isOpen && handleCloseModal()}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {modalState.mode === 'create' ? 'Crea Nuovo Task' : `Modifica Task: ${modalState.task?.title}`}
                        </DialogTitle>
                        <DialogDescription>
                            Compila i campi sottostanti per creare o modificare il task.
                        </DialogDescription>
                    </DialogHeader>
                    <Suspense fallback={<div>Caricamento...</div>}>
                        {modalState.isOpen && (
                            <TaskForm
                                key={`${modalState.mode}-${modalState.task?.id || 'new'}`}
                                task={modalState.task}
                                onSuccess={handleCloseModal}
                                onCancel={handleCloseModal}
                            />
                        )}
                    </Suspense>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deadlineModalState.isOpen} onOpenChange={() => setDeadlineModalState({ isOpen: false, savedTaskData: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Crea Task Scadenza</AlertDialogTitle>
                        <AlertDialogDescription>
                            Vuoi creare un task 'Scadenza' collegato a questa attività?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeadlineModalState({ isOpen: false, savedTaskData: null })}>No</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCreateDeadlineTask}>
                            Sì
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={disapprovalModalState.isOpen} onOpenChange={(isOpen) => !isOpen && setDisapprovalModalState({ isOpen: false, task: undefined, reason: '', sendEmail: true })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Rifiuta Task</AlertDialogTitle>
                        <AlertDialogDescription>
                            Per favore, fornisci una motivazione per il rifiuto. Questa verrà aggiunta come nota al task e lo riporterà in "Da Fare".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4 space-y-4">
                        {disapprovalModalState.task?.attachments?.filter(att => att.documentType === 'Approvazione').slice(-1).map((att, i) => (
                            <div key={i}>
                                <Label>Link da revisionare</Label>
                                <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-md bg-secondary text-sm hover:bg-secondary/80 break-all">
                                    <FileText className="h-4 w-4 flex-shrink-0" />
                                    <span className="truncate">{att.filename || 'Link allegato'}</span>
                                </a>
                            </div>
                        ))}
                        <div>
                            <Label htmlFor="disapproval_reason">Motivazione</Label>
                            <Textarea
                                id="disapproval_reason"
                                placeholder="Es: mancano dettagli, il file è nel formato sbagliato..."
                                value={disapprovalModalState.reason}
                                onChange={(e) => setDisapprovalModalState(prev => ({ ...prev, reason: e.target.value }))}
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="send-disapproval-email"
                                checked={disapprovalModalState.sendEmail}
                                onCheckedChange={(checked) => setDisapprovalModalState(prev => ({ ...prev, sendEmail: !!checked }))}
                            />
                            <Label htmlFor="send-disapproval-email">Invia notifica email all'utente</Label>
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDisapprove} disabled={!disapprovalModalState.reason.trim()}>
                            Conferma Rifiuto
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={approvalState.isOpen} onOpenChange={(isOpen) => !isOpen && setApprovalState({ isOpen: false, task: undefined, sendEmail: true })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confermi l'approvazione?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Stai per approvare il task <span className="font-bold">"{approvalState.task?.title}"</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4 space-y-4">
                        {approvalState.task?.attachments?.filter(att => att.documentType === 'Approvazione').slice(-1).map((att, i) => (
                            <div key={i}>
                                <Label>Link da approvare</Label>
                                <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-md bg-secondary text-sm hover:bg-secondary/80 break-all">
                                    <FileText className="h-4 w-4 flex-shrink-0" />
                                    <span className="truncate">{att.filename || 'Link allegato'}</span>
                                </a>
                            </div>
                        ))}
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="send-approval-email"
                                checked={approvalState.sendEmail}
                                onCheckedChange={(checked) => setApprovalState(prev => ({ ...prev, sendEmail: !!checked }))}
                            />
                            <Label htmlFor="send-approval-email">Invia notifica email all'utente</Label>
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleApprove}>Approva</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={fileAttachmentModalState.isOpen} onOpenChange={(isOpen) => !isOpen && setFileAttachmentModalState({ isOpen: false, task: undefined, attachmentUrl: '', attachmentFilename: '', attachmentFile: undefined })}>
                <AlertDialogContent className="max-w-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Aggiungi Allegato per Approvazione</AlertDialogTitle>
                        <AlertDialogDescription>
                            Per inviare questo task in approvazione, aggiungi un link al manufatto oppure carica un file.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="approval_url">📎 Incolla un Link</Label>
                            <Input
                                id="approval_url"
                                placeholder="https://drive.google.com/... oppure https://figma.com/..."
                                value={fileAttachmentModalState.attachmentUrl}
                                onChange={(e) => setFileAttachmentModalState(prev => ({ ...prev, attachmentUrl: e.target.value }))}
                                className="rounded-full"
                            />
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">Oppure</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="approval_file">📁 Carica un File</Label>
                            <Input
                                id="approval_file"
                                type="file"
                                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        // Salvo il file per caricarlo su Firebase Storage
                                        setFileAttachmentModalState(prev => ({
                                            ...prev,
                                            attachmentUrl: file.name, // Uso il nome come placeholder per validazione
                                            attachmentFilename: file.name,
                                            attachmentFile: file
                                        }));
                                    }
                                }}
                                className="cursor-pointer"
                            />
                            <p className="text-xs text-muted-foreground">
                                Formati supportati: immagini, PDF, documenti Office
                            </p>
                        </div>

                        {fileAttachmentModalState.attachmentFile && (
                            <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    <p className="text-sm font-medium text-green-700 dark:text-green-300">File pronto per il caricamento</p>
                                </div>
                                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                                    📁 {fileAttachmentModalState.attachmentFilename}
                                    <span className="ml-2 text-xs opacity-70">
                                        ({(fileAttachmentModalState.attachmentFile.size / 1024).toFixed(1)} KB)
                                    </span>
                                </p>
                            </div>
                        )}
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Annulla</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleFileAttachmentSubmit}
                            disabled={isSubmitting || (!fileAttachmentModalState.attachmentUrl.trim() && !fileAttachmentModalState.attachmentFile)}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {fileAttachmentModalState.attachmentFile ? 'Caricamento...' : 'Invio...'}
                                </>
                            ) : (
                                'Invia in Approvazione'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>


            <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Questa azione non può essere annullata. Questo eliminerà permanentemente il task
                            <span className="font-bold"> "{taskToDelete?.title}"</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setTaskToDelete(null)}>Annulla</AlertDialogCancel>
                        {currentUser?.role === 'Amministratore' && (
                            <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive hover:bg-destructive/90">
                                Elimina
                            </AlertDialogAction>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!dependencyError} onOpenChange={() => setDependencyError(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Attenzione</AlertDialogTitle>
                        <AlertDialogDescription>
                            Per completare questo task, è necessario prima chiudere le seguenti dipendenze:
                            <ul className="list-disc pl-5 mt-2 font-medium text-foreground">
                                {dependencyError?.map(taskName => <li key={taskName}>{taskName}</li>)}
                            </ul>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setDependencyError(null)}>Chiudi</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!rejectionReasonToShow} onOpenChange={() => setRejectionReasonToShow(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Motivo del Rifiuto</AlertDialogTitle>
                        <AlertDialogDescription>
                            Il task è stato precedentemente rifiutato per la seguente ragione.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="my-4 p-4 bg-secondary rounded-md text-sm whitespace-pre-wrap">
                        {rejectionReasonToShow}
                    </div>
                    <AlertDialogFooter>
                        <Button variant="secondary" onClick={() => {
                            if (rejectionReasonToShow) {
                                navigator.clipboard.writeText(rejectionReasonToShow);
                                toast.success("Testo copiato negli appunti.");
                            }
                        }}>
                            Copia Testo
                        </Button>
                        <AlertDialogAction onClick={() => setRejectionReasonToShow(null)}>Chiudi</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {chattingTask && (
                <TaskChat
                    task={chattingTask}
                    users={usersById}
                    isOpen={!!chattingTask}
                    onClose={handleChatClose}
                    onMessageSent={handleChatClose}
                />
            )}

            {previewTask && (
                <Dialog open={!!previewTask} onOpenChange={() => setPreviewTask(null)}>
                    <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
                        <DialogHeader className="p-6 pb-0">
                            <DialogTitle className="flex items-center gap-2 text-xl">
                                <CheckCircle className="h-6 w-6 text-primary" />
                                {previewTask.title}
                            </DialogTitle>
                            <DialogDescription>
                                Anteprima dettagliata del task
                            </DialogDescription>
                        </DialogHeader>

                        <div className="overflow-y-auto max-h-[calc(90vh-120px)] px-6 pb-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                {/* Colonna Sinistra - Info Principali */}
                                <div className="space-y-4">
                                    {/* Stato e Priorità */}
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm">Stato e Priorità</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Stato</span>
                                                <Badge
                                                    style={{
                                                        backgroundColor: statusColors[previewTask.status]?.bg || '#6b7280',
                                                        color: statusColors[previewTask.status]?.text || '#ffffff'
                                                    }}
                                                >
                                                    {previewTask.status}
                                                </Badge>
                                            </div>
                                            <Separator />
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Priorità</span>
                                                <Badge style={{ backgroundColor: priorityColors[previewTask.priority] || '#6b7280' }} className="text-white">
                                                    {previewTask.priority}
                                                </Badge>
                                            </div>
                                            <Separator />
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Tipo Attività</span>
                                                <span className="font-medium">{previewTask.activityType || 'N/D'}</span>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Cliente e Progetto */}
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm">Cliente e Progetto</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Cliente</span>
                                                <span className="font-medium">{clients.find((c: Client) => c.id === previewTask.clientId)?.name || 'N/D'}</span>
                                            </div>
                                            <Separator />
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Progetto</span>
                                                <span className="font-medium">{allProjects.find((p: Project) => p.id === previewTask.projectId)?.name || 'N/D'}</span>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Assegnatario e Creato da */}
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm">Persone</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Assegnato a</span>
                                                {previewTask.assignedUserId && usersById[previewTask.assignedUserId] ? (
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-6 w-6">
                                                            <AvatarFallback style={{ backgroundColor: usersById[previewTask.assignedUserId].color }} className="text-xs text-white">
                                                                {usersById[previewTask.assignedUserId].name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="font-medium">{usersById[previewTask.assignedUserId].name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">Non assegnato</span>
                                                )}
                                            </div>
                                            <Separator />
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Creato da</span>
                                                {previewTask.createdBy && usersById[previewTask.createdBy] ? (
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-6 w-6">
                                                            <AvatarFallback style={{ backgroundColor: usersById[previewTask.createdBy].color }} className="text-xs text-white">
                                                                {usersById[previewTask.createdBy].name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="font-medium">{usersById[previewTask.createdBy].name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">N/D</span>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Scadenza e Tempo */}
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm">Tempi</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Scadenza</span>
                                                <span className="font-medium">
                                                    {isClient && previewTask.dueDate ? format(new Date(previewTask.dueDate), 'dd MMM yyyy HH:mm', { locale: it }) : 'N/D'}
                                                </span>
                                            </div>
                                            <Separator />
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Tempo Registrato</span>
                                                <span className="font-medium">{formatTime(previewTask.timeSpent || 0)}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Colonna Destra - Descrizione, Allegati, Commenti */}
                                <div className="space-y-4">
                                    {/* Descrizione */}
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm">Descrizione</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm whitespace-pre-wrap">
                                                {previewTask.description || 'Nessuna descrizione.'}
                                            </p>
                                        </CardContent>
                                    </Card>

                                    {/* Motivo Rifiuto - mostrato solo se presente */}
                                    {previewTask.rejectionReason && (
                                        <Card className="border-destructive bg-destructive/5">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                                                    <AlertTriangle className="h-4 w-4" />
                                                    Motivo Rifiuto
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-sm whitespace-pre-wrap text-destructive">
                                                    {previewTask.rejectionReason}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* Allegati */}
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm flex items-center justify-between">
                                                <span>Allegati</span>
                                                <Badge variant="outline" className="text-xs">
                                                    {(previewTask.attachments || []).length}
                                                </Badge>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2 max-h-[120px] overflow-y-auto">
                                                {(previewTask.attachments || []).map((att: { url: string; filename?: string }, index: number) => (
                                                    <a
                                                        href={att.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        key={index}
                                                        className="flex items-center gap-2 p-2 rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
                                                    >
                                                        <FileText className="h-4 w-4 flex-shrink-0" />
                                                        <span className="text-sm truncate">{att.filename || 'File allegato'}</span>
                                                    </a>
                                                ))}
                                                {(!previewTask.attachments || previewTask.attachments.length === 0) && (
                                                    <p className="text-sm text-muted-foreground text-center py-2">Nessun allegato</p>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Commenti */}
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm flex items-center justify-between">
                                                <span>Commenti</span>
                                                <Badge variant="outline" className="text-xs">
                                                    {(previewTask.comments || []).length}
                                                </Badge>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-3 max-h-[200px] overflow-y-auto">
                                                {(previewTask.comments || []).map((comment: { userId: string; text: string; timestamp: string }, index: number) => {
                                                    const user = usersById[comment.userId];
                                                    return (
                                                        <div key={index} className="flex items-start gap-2">
                                                            <Avatar className="h-7 w-7 flex-shrink-0">
                                                                <AvatarFallback style={{ backgroundColor: user?.color }} className="text-[10px] text-white">
                                                                    {user?.name?.split(' ')[0]?.charAt(0) || '?'}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-baseline gap-2">
                                                                    <p className="font-semibold text-xs">{user?.name || 'Utente'}</p>
                                                                    <p className="text-[10px] text-muted-foreground">
                                                                        {isClient ? formatDistanceToNow(new Date(comment.timestamp), { addSuffix: true, locale: it }) : '...'}
                                                                    </p>
                                                                </div>
                                                                <div className="p-2 bg-secondary rounded-md mt-1">
                                                                    <p className="text-xs whitespace-pre-wrap">{renderCommentText(comment.text)}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {(!previewTask.comments || previewTask.comments.length === 0) && (
                                                    <p className="text-sm text-muted-foreground text-center py-2">Nessun commento</p>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>

                            {/* Azioni */}
                            <div className="flex gap-3 mt-6 pt-4 border-t">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        handleOpenModal('edit', previewTask);
                                        setPreviewTask(null);
                                    }}
                                >
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Modifica Task
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={() => {
                                        handleChatOpen(previewTask);
                                        setPreviewTask(null);
                                    }}
                                >
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    Apri Chat
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
            {/* Sheet Anteprima Progetto */}
            {previewProject && (
                <Sheet open={!!previewProject} onOpenChange={(isOpen: boolean) => !isOpen && setPreviewProject(null)}>
                    <SheetContent className="sm:max-w-lg overflow-hidden flex flex-col">
                        <SheetHeader>
                            <SheetTitle className="flex items-center gap-2">
                                <FolderKanban className="h-5 w-5 text-primary" />
                                {previewProject.name}
                            </SheetTitle>
                            <SheetDescription>
                                Dettagli del progetto
                            </SheetDescription>
                        </SheetHeader>
                        <ScrollArea className="flex-grow mt-4">
                            <div className="space-y-4 pr-4">
                                {/* Stato */}
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Stato</span>
                                    <Badge variant={
                                        previewProject.status === 'Completato' ? 'default' :
                                            previewProject.status === 'In Corso' ? 'secondary' :
                                                previewProject.status === 'In Pausa' ? 'outline' :
                                                    previewProject.status === 'Annullato' ? 'destructive' : 'secondary'
                                    }>
                                        {previewProject.status}
                                    </Badge>
                                </div>

                                {/* Cliente */}
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Cliente</span>
                                    <span className="font-medium">{clients.find((c: Client) => c.id === previewProject.clientId)?.name || 'N/D'}</span>
                                </div>

                                {/* Priorità */}
                                {previewProject.priority && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Priorità</span>
                                        <Badge variant={
                                            previewProject.priority === 'Critica' ? 'destructive' :
                                                previewProject.priority === 'Alta' ? 'default' :
                                                    previewProject.priority === 'Media' ? 'secondary' : 'outline'
                                        }>
                                            {previewProject.priority}
                                        </Badge>
                                    </div>
                                )}

                                <Separator />

                                {/* Date */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-sm text-muted-foreground">Data Inizio</span>
                                        <p className="font-medium">
                                            {previewProject.startDate ? format(new Date(previewProject.startDate), 'dd MMM yyyy', { locale: it }) : 'N/D'}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-sm text-muted-foreground">Data Fine</span>
                                        <p className="font-medium">
                                            {previewProject.endDate ? format(new Date(previewProject.endDate), 'dd MMM yyyy', { locale: it }) : 'N/D'}
                                        </p>
                                    </div>
                                </div>

                                {/* Budget */}
                                {previewProject.budget !== undefined && previewProject.budget > 0 && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Budget</span>
                                        <span className="font-medium">€{previewProject.budget.toLocaleString('it-IT')}</span>
                                    </div>
                                )}

                                {/* Team Leader */}
                                {previewProject.teamLeaderId && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Team Leader</span>
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6">
                                                <AvatarFallback style={{ backgroundColor: usersById[previewProject.teamLeaderId]?.color }}>
                                                    {getInitials(usersById[previewProject.teamLeaderId]?.name || '')}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="font-medium">{usersById[previewProject.teamLeaderId]?.name || 'N/D'}</span>
                                        </div>
                                    </div>
                                )}

                                <Separator />

                                {/* Descrizione */}
                                {previewProject.description && (
                                    <div>
                                        <span className="text-sm text-muted-foreground block mb-1">Descrizione</span>
                                        <p className="text-sm whitespace-pre-wrap">{previewProject.description}</p>
                                    </div>
                                )}

                                {/* Note */}
                                {previewProject.notes && (
                                    <div>
                                        <span className="text-sm text-muted-foreground block mb-1">Note</span>
                                        <p className="text-sm whitespace-pre-wrap bg-secondary/50 p-3 rounded-md">{previewProject.notes}</p>
                                    </div>
                                )}

                                {/* Tags */}
                                {previewProject.tags && (
                                    <div>
                                        <span className="text-sm text-muted-foreground block mb-1">Tags</span>
                                        <div className="flex flex-wrap gap-1">
                                            {(Array.isArray(previewProject.tags)
                                                ? previewProject.tags
                                                : typeof previewProject.tags === 'string'
                                                    ? previewProject.tags.split(',')
                                                    : []
                                            ).map((tag: string, i: number) => (
                                                <Badge key={i} variant="outline" className="text-xs">{typeof tag === 'string' ? tag.trim() : String(tag)}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <Separator />

                                {/* Azioni */}
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => {
                                            router.push(`/projects?projectId=${previewProject.id}`);
                                            setPreviewProject(null);
                                        }}
                                    >
                                        <Eye className="h-4 w-4 mr-2" />
                                        Vai ai Progetti
                                    </Button>
                                </div>
                            </div>
                        </ScrollArea>
                    </SheetContent>
                </Sheet>
            )}
        </div>
    );
}

export default function TasksPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <TasksPageContent />
        </Suspense>
    )
}








