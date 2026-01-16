

'use client';

import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import Image from 'next/image';
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { getEditorialContents, addEditorialContent, updateEditorialContent, deleteEditorialContent, getEditorialFormats, getEditorialColumns, getEditorialStatuses, addTask, addProject, uploadFilesAndGetAttachments } from '@/lib/actions';
import type { EditorialContent, Client, EditorialFormat, EditorialColumn, EditorialStatus, User, Task, Project, ActivityType } from '@/lib/data';
import { PlusCircle, MoreVertical, Edit, Trash2, Instagram, Youtube, Clapperboard, Store, Briefcase, MessageSquare, Filter, Calendar as CalendarIcon, LayoutGrid, Kanban, List, Loader2, Pencil, GanttChartSquare, ClipboardList, Eraser, Facebook, Linkedin, Upload, AlertTriangle, Download, TrendingUp, Clock, FileText, BarChart3, Eye, CheckCircle, Timer, ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday, addMonths, isSameDay, differenceInDays, addDays, isWithinInterval, isBefore, isAfter } from 'date-fns';
import { it } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { FileUploader } from '@/components/file-uploader';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useLayoutData } from '@/app/(app)/layout-context';

const ProjectForm = dynamic(() => import('@/components/project-form'), { ssr: false });
const TaskForm = dynamic(() => import('@/components/task-form'), { ssr: false });


type ModalState = 'create' | 'edit' | null;
type NestedModalState = 'task' | 'project' | null;
type ViewType = 'table' | 'kanban' | 'calendar' | 'gantt';
type NewTask = Omit<Task, 'id' | 'clientId' | 'projectId' | 'status' | 'dueDate'> & { tempId: number };
type ContentFormData = {
    topic: string;
    clientId: string;
    contentId: string;
}

type EditingFieldState = {
    contentId: string;
    field: keyof EditorialContent | `customFields.${string}`;
    label: string;
    currentValue: any;
    type: 'text' | 'textarea' | 'select';
    options?: { value: string; label: string }[];
} | null;


// Custom TikTok icon (lucide-react doesn't have it)
const TikTokIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
);

// Custom Instagram Stories icon
const IGStoriesIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2a10 10 0 0 1 0 20" strokeDasharray="4 2" />
    </svg>
);

// Custom Google Business Profile icon
const GBPIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
);

const socialIcons: { [key: string]: { icon: React.ElementType, color: string } } = {
    facebook: { icon: Facebook, color: 'text-[#1877F2]' },
    linkedin: { icon: Linkedin, color: 'text-[#0A66C2]' },
    instagram: { icon: Instagram, color: 'text-[#E4405F]' },
    igStories: { icon: IGStoriesIcon, color: 'text-[#C13584]' },
    tiktok: { icon: TikTokIcon, color: 'text-black dark:text-white' },
    gbp: { icon: GBPIcon, color: 'text-[#4285F4]' },
    youtube: { icon: Youtube, color: 'text-[#FF0000]' },
};

const SocialIcon = ({ active, channel }: { active: boolean, channel: keyof typeof socialIcons }) => {
    const iconConfig = socialIcons[channel];
    if (!iconConfig) return null;
    const { icon: Icon, color } = iconConfig;
    return (
        <div className={cn('h-5 w-5', active ? color : 'text-muted-foreground/30')}>
            <Icon />
        </div>
    );
};

// Media Gallery Component for Kanban cards
const MediaGallery = ({ imageUrls, videoUrl, alt }: { imageUrls?: string[], videoUrl?: string, alt: string }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    // Filter out empty URLs
    const validImages = (imageUrls || []).filter(url => url && url.trim() !== '');
    const hasVideo = videoUrl && videoUrl.trim() !== '';
    const totalMedia = validImages.length + (hasVideo ? 1 : 0);
    const hasMedia = totalMedia > 0;

    const goToPrevious = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex(prev => (prev === 0 ? totalMedia - 1 : prev - 1));
    };

    const goToNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex(prev => (prev === totalMedia - 1 ? 0 : prev + 1));
    };

    // Determine if current index is an image or video
    const isShowingVideo = hasVideo && currentIndex === validImages.length;
    const currentImageUrl = !isShowingVideo && validImages[currentIndex];

    // Check if URL is a video
    const isVideoUrl = (url: string) => {
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
        return videoExtensions.some(ext => url.toLowerCase().includes(ext));
    };

    return (
        <div className="aspect-square relative rounded-t-lg overflow-hidden group/gallery">
            {hasMedia ? (
                <>
                    {isShowingVideo ? (
                        <video
                            src={videoUrl}
                            className="object-cover w-full h-full"
                            controls
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : currentImageUrl && isVideoUrl(currentImageUrl) ? (
                        <video
                            src={currentImageUrl}
                            className="object-cover w-full h-full"
                            controls
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : currentImageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                            src={currentImageUrl}
                            alt={`${alt} - ${currentIndex + 1}`}
                            className="object-cover w-full h-full"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                    ) : null}

                    {/* Navigation arrows - only show if more than 1 media */}
                    {totalMedia > 1 && (
                        <>
                            <button
                                onClick={goToPrevious}
                                className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 opacity-0 group-hover/gallery:opacity-100 transition-opacity z-10"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                onClick={goToNext}
                                className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 opacity-0 group-hover/gallery:opacity-100 transition-opacity z-10"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>

                            {/* Indicators */}
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                                {Array.from({ length: totalMedia }).map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }}
                                        className={cn(
                                            "w-2 h-2 rounded-full transition-colors",
                                            i === currentIndex ? "bg-white" : "bg-white/50 hover:bg-white/75"
                                        )}
                                    />
                                ))}
                            </div>
                        </>
                    )}

                    {/* Media count badge */}
                    {totalMedia > 1 && (
                        <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full z-10">
                            {currentIndex + 1}/{totalMedia}
                        </div>
                    )}
                </>
            ) : (
                /* Placeholder when no media */
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/15 to-pink-500/20 flex flex-col items-center justify-center">
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-4 left-4 w-8 h-8 border-2 border-current rounded-lg rotate-12" />
                        <div className="absolute bottom-8 right-6 w-6 h-6 border-2 border-current rounded-full" />
                        <div className="absolute top-1/3 right-8 w-4 h-4 bg-current rounded-sm rotate-45" />
                    </div>
                    <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                        <ImageIcon className="h-10 w-10 text-blue-500/60 mx-auto" />
                    </div>
                    <span className="text-xs mt-3 text-muted-foreground/60 font-medium">Nessuna anteprima</span>
                </div>
            )}
        </div>
    );
};

// Kanban Board View Component
const KanbanView = ({ contents, clientsById, statuses, onStatusChange, onEdit, onDelete, onAddContent, tasksById, projectsById, editorialColumns }: {
    contents: EditorialContent[],
    clientsById: Record<string, Client>,
    statuses: EditorialStatus[],
    onStatusChange: (contentId: string, newStatus: string) => void,
    onEdit: (content: EditorialContent) => void,
    onDelete: (content: EditorialContent) => void,
    onAddContent: (initialStatus: string) => void,
    tasksById: Record<string, Task>,
    projectsById: Record<string, Project>,
    editorialColumns: EditorialColumn[],
}) => {
    const contentsByStatus = useMemo(() => {
        const grouped: Record<string, EditorialContent[]> = {};
        const statusNames = new Set(statuses.map(s => s.name));

        // Initialize all known statuses
        statuses.forEach(status => grouped[status.name] = []);
        // Add fallback for unrecognized statuses (orphans)
        grouped['__orphan__'] = [];

        contents.forEach(content => {
            if (statusNames.has(content.status)) {
                grouped[content.status].push(content);
            } else {
                // Content has an unrecognized status, add to orphan
                grouped['__orphan__'].push(content);
            }
        });
        return grouped;
    }, [contents, statuses]);

    // Include "Bozza" fallback column only if there are orphan contents
    const displayStatuses = useMemo(() => {
        const result = [...statuses];
        const hasBozzaStatus = statuses.some(s => s.name === 'Bozza');

        if (contentsByStatus['__orphan__']?.length > 0) {
            if (!hasBozzaStatus) {
                // Add Bozza column for orphans if it doesn't exist
                result.push({ id: 'bozza-fallback', name: 'Bozza', color: '#9CA3AF' });
            }
        }
        return result;
    }, [statuses, contentsByStatus]);

    // Map orphan contents to Bozza status for display
    const displayContentsByStatus = useMemo(() => {
        const result = { ...contentsByStatus };
        if (contentsByStatus['__orphan__']?.length > 0) {
            // Add orphan contents to Bozza (existing or fallback)
            result['Bozza'] = [...(result['Bozza'] || []), ...contentsByStatus['__orphan__']];
        }
        delete result['__orphan__'];
        return result;
    }, [contentsByStatus]);

    return (
        <div className="bg-muted p-4 rounded-xl">
            <div className="flex gap-4 overflow-x-auto pb-2">
                {displayStatuses.map(status => (
                    <div key={status.id} className="w-80 flex-shrink-0 bg-secondary p-2 rounded-lg">
                        <div className="flex items-center justify-between px-2 mb-3">
                            <h2 className="font-semibold text-lg">{status.name}</h2>
                            <span className="text-sm font-medium text-muted-foreground">{displayContentsByStatus[status.name]?.length || 0}</span>
                        </div>
                        <div className="space-y-3 min-h-[500px]">
                            {displayContentsByStatus[status.name]?.map(content => {
                                const linkedTask = content.taskId ? tasksById[content.taskId] : null;
                                const linkedProject = content.projectId ? projectsById[content.projectId] : null;
                                const currentStatus = statuses.find(s => s.name === content.status)

                                return (
                                    <Card key={content.id} className="bg-card group/card overflow-hidden">
                                        <div className="relative">
                                            <MediaGallery
                                                imageUrls={content.imageUrls}
                                                videoUrl={content.videoUrl}
                                                alt={content.topic}
                                            />
                                            <div className="absolute top-2 right-2 z-20 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="secondary" size="icon" className="h-7 w-7">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem onClick={() => onEdit(content)}>
                                                            <Edit className="mr-2 h-4 w-4" /> Modifica
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-destructive" onClick={() => onDelete(content)}>
                                                            <Trash2 className="mr-2 h-4 w-4" /> Elimina
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                        <CardContent className="p-3 space-y-2 text-sm">
                                            <div className="space-y-1">
                                                <p><span className="font-semibold">Cliente:</span> {clientsById[content.clientId]?.name}</p>
                                                <div className="flex gap-1">
                                                    <span className="font-semibold shrink-0">Topic:</span>
                                                    <p className="truncate">{content.topic}</p>
                                                </div>
                                                <p><span className="font-semibold">Formato:</span> {content.format}</p>
                                                <p><span className="font-semibold">Focus:</span> {content.focus}</p>
                                            </div>

                                            {content.copy && (
                                                <div className="pt-2 border-t mt-2">
                                                    <p className="font-semibold mb-1">Copy:</p>
                                                    <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{content.copy}</p>
                                                </div>
                                            )}

                                            {content.customFields && Object.keys(content.customFields).length > 0 && (
                                                <div className="pt-2 border-t mt-2 space-y-1">
                                                    <p className="font-semibold mb-1">Campi Personalizzati:</p>
                                                    {Object.entries(content.customFields).map(([key, value]) => {
                                                        const columnDef = editorialColumns.find(c => c.slug === key);
                                                        return (
                                                            <p key={key} className="text-xs">
                                                                <span className="font-medium text-muted-foreground">{columnDef?.name || key}: </span>
                                                                <span className="truncate">{String(value)}</span>
                                                            </p>
                                                        )
                                                    })}
                                                </div>
                                            )}

                                            {(linkedTask || linkedProject) && (
                                                <div className="pt-2 border-t mt-2 space-y-1">
                                                    {linkedTask && (
                                                        <Link href={`/tasks?taskId=${linkedTask.id}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary">
                                                            <ClipboardList className="h-4 w-4" />
                                                            <span className="truncate">Task: {linkedTask.title}</span>
                                                        </Link>
                                                    )}
                                                    {linkedProject && (
                                                        <Link href={`/projects`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary">
                                                            <Briefcase className="h-4 w-4" />
                                                            <span className="truncate">Progetto: {linkedProject.name}</span>
                                                        </Link>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2 pt-2 border-t mt-2">
                                                <SocialIcon active={content.facebook} channel="facebook" />
                                                <SocialIcon active={content.linkedin} channel="linkedin" />
                                                <SocialIcon active={content.instagram} channel="instagram" />
                                                <SocialIcon active={!!content.igStories} channel="igStories" />
                                                <SocialIcon active={content.tiktok} channel="tiktok" />
                                                <SocialIcon active={content.gbp} channel="gbp" />
                                                <SocialIcon active={content.youtube} channel="youtube" />
                                            </div>

                                            <div className="flex items-center justify-between text-xs pt-2">
                                                <span className="text-muted-foreground">
                                                    {content.publicationDate && !isNaN(new Date(content.publicationDate).getTime()) ? format(new Date(content.publicationDate), 'd MMM', { locale: it }) : '-'}
                                                </span>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" className="px-1.5 py-0.5 h-auto text-xs" style={{ borderColor: currentStatus?.color, color: currentStatus?.color }}>
                                                            {content.status}
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuRadioGroup value={content.status} onValueChange={(newStatus) => onStatusChange(content.id, newStatus)}>
                                                            {statuses.map(s => (
                                                                <DropdownMenuRadioItem key={s.id} value={s.name}>{s.name}</DropdownMenuRadioItem>
                                                            ))}
                                                        </DropdownMenuRadioGroup>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                            <Button variant="ghost" className="w-full justify-start" onClick={() => onAddContent(status.name)}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Aggiungi Contenuto
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


// Calendar View Component
const CalendarView = ({ contents, clientsById, onEdit }: { contents: EditorialContent[], clientsById: Record<string, Client>, onEdit: (content: EditorialContent) => void }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const firstDay = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const lastDay = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: firstDay, end: lastDay });

    const contentsByDate = useMemo(() => {
        const grouped: Record<string, EditorialContent[]> = {};
        contents.forEach(content => {
            if (content.publicationDate && !isNaN(new Date(content.publicationDate).getTime())) {
                const dateKey = format(new Date(content.publicationDate), 'yyyy-MM-dd');
                if (!grouped[dateKey]) {
                    grouped[dateKey] = [];
                }
                grouped[dateKey].push(content);
            }
        });
        return grouped;
    }, [contents]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="capitalize">{format(currentMonth, 'MMMM yyyy', { locale: it })}</CardTitle>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" onClick={() => setCurrentMonth(new Date())}>Oggi</Button>
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-7 border-t border-l">
                    {['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'].map(day => (
                        <div key={day} className="p-2 text-center text-sm font-semibold border-b border-r bg-muted/50">{day}</div>
                    ))}
                    {days.map(day => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const dayContents = contentsByDate[dateKey] || [];
                        return (
                            <div key={day.toString()} className={cn("h-40 p-2 border-b border-r flex flex-col", !isSameMonth(day, currentMonth) && "bg-muted/30")}>
                                <time dateTime={format(day, 'yyyy-MM-dd')} className={cn("font-semibold", isToday(day) && "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center")}>
                                    {format(day, 'd')}
                                </time>
                                <div className="flex-grow overflow-y-auto mt-1 space-y-1">
                                    {dayContents.map(content => (
                                        <div key={content.id} onClick={() => onEdit(content)} className="p-1 rounded-md text-xs bg-card border cursor-pointer hover:bg-muted">
                                            {content.imageUrls?.[0] && content.imageUrls[0].trim() !== '' && (
                                                <div className="aspect-video relative mb-1">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={content.imageUrls[0]} alt={content.topic} className="rounded-sm object-cover w-full h-full" />
                                                </div>
                                            )}
                                            <p className="font-bold truncate">{content.topic}</p>
                                            <p className="text-xs truncate text-muted-foreground">{clientsById[content.clientId]?.name}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

const GANTT_BAR_COLORS = [
    'bg-blue-400', 'bg-green-400', 'bg-yellow-400', 'bg-purple-400', 'bg-pink-400', 'bg-indigo-400'
];

const GanttView = ({ contents, clients, users, onEdit }: { contents: EditorialContent[], clients: Client[], users: User[], onEdit: (content: EditorialContent) => void }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const startDate = startOfMonth(currentMonth);
    const endDate = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

    const contentsByClient = useMemo(() => {
        const grouped: Record<string, EditorialContent[]> = {};
        clients.forEach(client => {
            grouped[client.id] = contents.filter(c => c.clientId === client.id);
        });
        return grouped;
    }, [contents, clients]);

    // Only show clients that have content after filtering
    const filteredClients = useMemo(() => {
        return clients.filter(client => contentsByClient[client.id]?.length > 0);
    }, [clients, contentsByClient]);

    const usersById = useMemo(() => users.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
    }, {} as Record<string, User>), [users]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="capitalize">{format(currentMonth, 'MMMM yyyy', { locale: it })}</CardTitle>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" onClick={() => setCurrentMonth(new Date())}>Oggi</Button>
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
                </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                <div className="relative" style={{ minWidth: `${daysInMonth.length * 50 + 200}px` }}>
                    {/* Header */}
                    <div className="flex sticky top-0 z-10 bg-background border-b">
                        <div className="w-52 flex-shrink-0 p-2 font-semibold border-r">Cliente</div>
                        <div className="flex-grow grid" style={{ gridTemplateColumns: `repeat(${daysInMonth.length}, 50px)` }}>
                            {daysInMonth.map(day => (
                                <div key={day.toString()} className={cn("p-2 text-center border-r", isToday(day) && "bg-primary/10")}>
                                    <div className="text-xs text-muted-foreground">{format(day, 'EEE', { locale: it })}</div>
                                    <div className="font-semibold">{format(day, 'd')}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Rows */}
                    <div className="relative">
                        {/* Grid Lines */}
                        <div className="absolute inset-0 flex">
                            <div className="w-52 flex-shrink-0 border-r"></div>
                            <div className="flex-grow grid" style={{ gridTemplateColumns: `repeat(${daysInMonth.length}, 50px)` }}>
                                {daysInMonth.map((day, i) => <div key={i} className="h-full border-r"></div>)}
                            </div>
                        </div>

                        {/* Data Rows */}
                        <div className="relative">
                            {filteredClients.map(client => {
                                const clientContents = contentsByClient[client.id] || [];
                                // Calculate dynamic row height based on number of contents
                                const rowHeight = Math.max(48, 8 + (clientContents.length * 36));
                                return (
                                    <div key={client.id} className="flex border-b" style={{ minHeight: `${rowHeight}px` }}>
                                        <div className="w-52 flex-shrink-0 p-2 font-medium flex items-center">{client.name}</div>
                                        <div className="flex-grow relative h-auto">
                                            {clientContents.map((content, index) => {
                                                if (!content.publicationDate || isNaN(new Date(content.publicationDate).getTime())) return null;
                                                const contentDate = new Date(content.publicationDate);
                                                if (!isSameMonth(contentDate, currentMonth)) return null;

                                                const dayIndex = differenceInDays(contentDate, startDate);
                                                const manager = client.managedBy && client.managedBy.length > 0 ? usersById[client.managedBy[0]] : null;
                                                // Stack bars vertically if there are multiple for the same client
                                                const topOffset = 4 + (index * 36); // Each bar is 32px + 4px gap

                                                return (
                                                    <TooltipProvider key={content.id}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div
                                                                    className={cn("absolute h-8 rounded-md flex items-center px-2 text-white text-sm truncate cursor-pointer", GANTT_BAR_COLORS[index % GANTT_BAR_COLORS.length])}
                                                                    style={{ left: `${dayIndex * 50 + 2}px`, top: `${topOffset}px` }}
                                                                    onClick={() => onEdit(content)}
                                                                >
                                                                    <span className="truncate flex-grow">{content.topic}</span>
                                                                    {manager && (
                                                                        <Avatar className="h-6 w-6 ml-2 flex-shrink-0">
                                                                            <AvatarFallback className="text-xs" style={{ backgroundColor: manager.color, color: 'white' }}>
                                                                                {manager.name.charAt(0)}
                                                                            </AvatarFallback>
                                                                        </Avatar>
                                                                    )}
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p className="font-bold">{content.topic}</p>
                                                                <p>Stato: {content.status}</p>
                                                                <p>Responsabile: {manager?.name || 'N/D'}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};


export default function EditorialPlanPage() {


    // UI State
    const [isFiltersOpen, setIsFiltersOpen] = useState(true);

    const { clients, users, currentUser, permissions, allTasks, allProjects, activityTypes, clientsById, usersById, tasksById, projectsById, isLoadingLayout } = useLayoutData();
    const [contents, setContents] = useState<EditorialContent[]>([]);
    const [editorialFormats, setEditorialFormats] = useState<EditorialFormat[]>([]);
    const [editorialStatuses, setEditorialStatuses] = useState<EditorialStatus[]>([]);
    const [editorialColumns, setEditorialColumns] = useState<EditorialColumn[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const [modalState, setModalState] = useState<ModalState>(null);
    const [editingContent, setEditingContent] = useState<EditorialContent | null>(null);
    const [initialStatusForCreate, setInitialStatusForCreate] = useState<string | undefined>(undefined);
    const [contentToDelete, setContentToDelete] = useState<EditorialContent | null>(null);
    const [view, setView] = useState<ViewType>('table');

    // State for quick field editing
    const [editingField, setEditingField] = useState<EditingFieldState>(null);
    const [fieldValue, setFieldValue] = useState('');

    // State for nested modals
    const [nestedModal, setNestedModal] = useState<NestedModalState>(null);
    const [formDataForNested, setFormDataForNested] = useState<ContentFormData | null>(null);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const [filters, setFilters] = useState({
        clientId: 'all',
        status: 'all',
        format: 'all',
        query: '',
        startDate: '',
        endDate: '',
    });

    const fetchData = useCallback(async () => {
        setIsLoadingData(true);
        try {
            const [data, formatData, statusesData, columnsData] = await Promise.all([
                getEditorialContents(),
                getEditorialFormats(),
                getEditorialStatuses(),
                getEditorialColumns(),
            ]);
            setContents(data);
            setEditorialFormats(formatData);
            setEditorialStatuses(statusesData.sort((a, b) => a.name.localeCompare(b.name)));
            setEditorialColumns(columnsData);
        } catch (error) {
            console.error('Failed to fetch editorial plan:', error);
            toast.error('Impossibile caricare il piano editoriale.');
        } finally {
            setIsLoadingData(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const handleDateFilterChange = (filterName: 'startDate' | 'endDate', date: Date | undefined) => {
        const value = date ? format(date, 'yyyy-MM-dd') : '';
        handleFilterChange(filterName, value);
    };

    const setDateShortcut = (type: 'week' | 'month') => {
        const now = new Date();
        let start, end;
        if (type === 'week') {
            start = startOfWeek(now, { weekStartsOn: 1 });
            end = endOfWeek(now, { weekStartsOn: 1 });
        } else { // month
            start = startOfMonth(now);
            end = endOfMonth(now);
        }
        setFilters(prev => ({
            ...prev,
            startDate: format(start, 'yyyy-MM-dd'),
            endDate: format(end, 'yyyy-MM-dd')
        }));
    };


    const resetFilters = () => {
        setFilters({ clientId: 'all', status: 'all', format: 'all', query: '', startDate: '', endDate: '' });
    };

    const filteredContents = useMemo(() => {
        return contents.filter(content => {
            const clientMatch = filters.clientId === 'all' || content.clientId === filters.clientId;
            const statusMatch = filters.status === 'all' || content.status === filters.status;
            const formatMatch = filters.format === 'all' || content.format === filters.format;
            const queryMatch = !filters.query || content.topic.toLowerCase().includes(filters.query.toLowerCase());

            const pubDate = content.publicationDate && !isNaN(new Date(content.publicationDate).getTime()) ? new Date(content.publicationDate) : null;
            const startDate = filters.startDate && !isNaN(new Date(filters.startDate).getTime()) ? new Date(filters.startDate) : null;
            const endDate = filters.endDate && !isNaN(new Date(filters.endDate).getTime()) ? new Date(filters.endDate) : null;

            const startDateMatch = !startDate || (pubDate && pubDate >= startDate);
            const endDateMatch = !endDate || (pubDate && pubDate <= endDate);

            return clientMatch && statusMatch && formatMatch && queryMatch && startDateMatch && endDateMatch;
        }).sort((a, b) => {
            const dateA = a.publicationDate && !isNaN(new Date(a.publicationDate).getTime()) ? new Date(a.publicationDate).getTime() : 0;
            const dateB = b.publicationDate && !isNaN(new Date(b.publicationDate).getTime()) ? new Date(b.publicationDate).getTime() : 0;
            return dateA - dateB; // Sort by publication date ascending (oldest first)
        });
    }, [contents, filters]);

    // KPI Statistics
    const contentStats = useMemo(() => {
        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

        // This week's content
        const thisWeekContents = contents.filter(c => {
            if (!c.publicationDate) return false;
            const pubDate = new Date(c.publicationDate);
            return isWithinInterval(pubDate, { start: weekStart, end: weekEnd });
        });

        // Overdue content (past publication date, not published)
        const overdueContents = contents.filter(c => {
            if (!c.publicationDate) return false;
            const pubDate = new Date(c.publicationDate);
            return isBefore(pubDate, now) && c.status !== 'Pubblicato' && c.status !== 'Completato';
        });

        // By platform
        const byPlatform = {
            facebook: contents.filter(c => c.facebook).length,
            instagram: contents.filter(c => c.instagram).length,
            linkedin: contents.filter(c => c.linkedin).length,
            tiktok: contents.filter(c => c.tiktok).length,
            youtube: contents.filter(c => c.youtube).length,
            gbp: contents.filter(c => c.gbp).length,
        };

        // By status
        const byStatus: Record<string, number> = {};
        editorialStatuses.forEach(s => {
            byStatus[s.name] = contents.filter(c => c.status === s.name).length;
        });

        // By format
        const byFormat: Record<string, number> = {};
        editorialFormats.forEach(f => {
            byFormat[f.name] = contents.filter(c => c.format === f.name).length;
        });

        // Upcoming (next 7 days)
        const upcoming = contents.filter(c => {
            if (!c.publicationDate) return false;
            const pubDate = new Date(c.publicationDate);
            return isAfter(pubDate, now) && isBefore(pubDate, addDays(now, 7));
        });

        return {
            total: contents.length,
            filtered: filteredContents.length,
            thisWeek: thisWeekContents.length,
            overdue: overdueContents.length,
            upcoming: upcoming.length,
            byPlatform,
            byStatus,
            byFormat,
        };
    }, [contents, filteredContents, editorialStatuses, editorialFormats]);

    // Export to CSV
    const exportToCSV = () => {
        const headers = ['Topic', 'Cliente', 'Formato', 'Stato', 'Data Pubblicazione', 'Focus', 'Copy', 'Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'YouTube', 'GBP'];
        const rows = filteredContents.map(c => [
            c.topic,
            clientsById[c.clientId]?.name || '',
            c.format,
            c.status,
            c.publicationDate ? format(new Date(c.publicationDate), 'dd/MM/yyyy', { locale: it }) : '',
            c.focus || '',
            (c.copy || '').replace(/"/g, '""'),
            c.facebook ? 'Sì' : 'No',
            c.instagram ? 'Sì' : 'No',
            c.linkedin ? 'Sì' : 'No',
            c.tiktok ? 'Sì' : 'No',
            c.youtube ? 'Sì' : 'No',
            c.gbp ? 'Sì' : 'No',
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `piano_editoriale_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
        toast.success('Export completato', { description: `${filteredContents.length} contenuti esportati.` });
    };


    const handleCloseModal = () => {
        setModalState(null);
        setEditingContent(null);
        setInitialStatusForCreate(undefined);
    };


    const handleDeleteFilteredContents = async () => {
        setIsBulkDeleting(true);
        const idsToDelete = filteredContents.map(c => c.id);
        try {
            await deleteEditorialContent(idsToDelete);
            toast.success(`${idsToDelete.length} contenuti sono stati eliminati.`);
            setShowDeleteConfirm(false);
            fetchData();
        } catch (error) {
            console.error('Failed to bulk delete content:', error);
            toast.error("Errore during l'eliminazione di massa dei contenuti.");
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const handleStatusChange = async (contentId: string, newStatus: string) => {
        try {
            await updateEditorialContent(contentId, { status: newStatus });
            fetchData();
            toast.success("Stato aggiornato", { description: "Il nuovo stato è stato salvato." });
        } catch (error) {
            console.error('Failed to update status:', error);
            toast.error('Impossibile aggiornare lo stato.');
        }
    };

    const handleOpenCreateModal = (initialStatus?: string) => {
        if (initialStatus) setInitialStatusForCreate(initialStatus);
        setModalState('create');
    };

    const handleOpenEditModal = (content: EditorialContent) => {
        setEditingContent(content);
        setModalState('edit');
    };

    const handleOpenFieldEditor = (
        contentId: string,
        field: keyof EditorialContent | `customFields.${string}`,
        label: string,
        currentValue: any,
        type: 'text' | 'textarea' | 'select' = 'textarea',
        options?: { value: string; label: string }[]
    ) => {
        setEditingField({ contentId, field, label, currentValue, type, options });
        setFieldValue(currentValue || '');
    };

    const handleSaveField = async () => {
        if (!editingField) return;

        let payload: Partial<Omit<EditorialContent, 'id'>>;

        if (editingField.field.startsWith('customFields.')) {
            const slug = editingField.field.split('.')[1];
            payload = {
                customFields: {
                    ...(editingContent?.customFields || {}),
                    [slug]: fieldValue
                }
            }
        } else {
            payload = { [editingField.field]: fieldValue };
        }


        try {
            await updateEditorialContent(editingField.contentId, payload);
            fetchData();
            toast.success(`${editingField.label} aggiornato.`);
            setEditingField(null);
        } catch (error) {
            console.error(`Failed to update ${editingField.field}:`, error);
            toast.error(`Impossibile aggiornare ${editingField.label}.`);
        }
    };


    // Handlers for nested modals
    const handleOpenNestedModal = (type: NestedModalState, formData: ContentFormData) => {
        setFormDataForNested(formData);
        setNestedModal(type);
    };

    const handleCloseNestedModal = () => {
        setNestedModal(null);
        setFormDataForNested(null);
    };

    const handleProjectSubmit = async (formData: FormData, newTasks: NewTask[]) => {
        if (!formDataForNested) return;

        try {
            const newProject: Omit<Project, 'id'> = {
                name: formData.get('name') as string,
                description: formData.get('description') as string,
                clientId: formData.get('clientId') as string,
                status: formData.get('status') as Project['status'],
                startDate: new Date(formData.get('startDate') as string).toISOString(),
                endDate: new Date(formData.get('endDate') as string).toISOString(),
                budget: 0,
                teamLeaderId: formData.get('teamLeaderId') as string,
                tags: (formData.get('tags') as string) || '',
                notes: '',
                priority: formData.get('priority') as Project['priority'],
                progress: 0,
            };
            const projectId = await addProject(newProject);
            await updateEditorialContent(formDataForNested.contentId, { projectId });
            fetchData();
            toast.success('Progetto creato e collegato.');
            handleCloseNestedModal();
        } catch (e) {
            toast.error('Impossibile creare il progetto.');
        }
    };

    const handleTaskSubmit = async (data: Partial<Task>) => {
        if (!formDataForNested) return;
        try {
            const newTask: Omit<Task, 'id'> = {
                title: data.title!,
                description: data.description!,
                priority: data.priority!,
                status: 'Da Fare',
                dueDate: data.dueDate!,
                clientId: data.clientId!,
                projectId: data.projectId || undefined,
                activityType: data.activityType!,
                estimatedDuration: data.estimatedDuration!,
                attachments: [],
                assignedUserId: data.assignedUserId || undefined,
                timeSpent: 0,
                comments: [],
                dependencies: [],
            };
            const { taskId } = await addTask(newTask, 'system_auto');
            await updateEditorialContent(formDataForNested.contentId, { taskId });
            fetchData();
            toast.success("Task creato e collegato.");
            handleCloseNestedModal();
        } catch (error: any) {
            toast.error(error.message || `Impossibile creare il task.`);
        }
    };

    const tableTitle = useMemo(() => {
        let title = "Contenuti Pianificati";
        if (filters.clientId !== 'all') {
            const clientName = clientsById[filters.clientId]?.name;
            if (clientName) {
                title += ` per ${clientName}`;
            }
        }
        if (filters.startDate && !isNaN(new Date(filters.startDate).getTime()) && filters.endDate && !isNaN(new Date(filters.endDate).getTime())) {
            title += ` dal ${format(new Date(filters.startDate), 'dd/MM/yy', { locale: it })} al ${format(new Date(filters.endDate), 'dd/MM/yy', { locale: it })}`;
        } else if (filters.startDate && !isNaN(new Date(filters.startDate).getTime())) {
            title += ` dal ${format(new Date(filters.startDate), 'dd/MM/yy', { locale: it })}`;
        } else if (filters.endDate && !isNaN(new Date(filters.endDate).getTime())) {
            title += ` fino al ${format(new Date(filters.endDate), 'dd/MM/yy', { locale: it })}`;
        }
        return title;
    }, [filters, clientsById]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Piano Editoriale</h1>
                    <p className="text-muted-foreground">
                        Pianifica, organizza e monitora tutti i tuoi contenuti di marketing.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button variant={view === 'table' ? 'secondary' : 'outline'} size="icon" onClick={() => setView('table')}><List className="h-4 w-4" /></Button>
                    <Button variant={view === 'kanban' ? 'secondary' : 'outline'} size="icon" onClick={() => setView('kanban')}><Kanban className="h-4 w-4" /></Button>
                    <Button variant={view === 'calendar' ? 'secondary' : 'outline'} size="icon" onClick={() => setView('calendar')}><CalendarIcon className="h-4 w-4" /></Button>
                    <Button variant={view === 'gantt' ? 'secondary' : 'outline'} size="icon" onClick={() => setView('gantt')}><GanttChartSquare className="h-4 w-4" /></Button>
                    <Button variant="outline" onClick={exportToCSV} disabled={filteredContents.length === 0}>
                        <Download className="mr-2 h-4 w-4" />
                        Esporta CSV
                    </Button>
                    <Link href="/import-editorial">
                        <Button variant="outline">
                            <Upload className="mr-2 h-4 w-4" />
                            Importa
                        </Button>
                    </Link>
                    <Button onClick={() => handleOpenCreateModal()}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Nuovo Contenuto
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Totale Contenuti</p>
                                <p className="text-3xl font-bold">{contentStats.total}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {contentStats.filtered !== contentStats.total && `${contentStats.filtered} filtrati`}
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                                <FileText className="h-6 w-6 text-primary" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Questa Settimana</p>
                                <p className="text-3xl font-bold">{contentStats.thisWeek}</p>
                                <p className="text-xs text-muted-foreground mt-1">da pubblicare</p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <CalendarIcon className="h-6 w-6 text-emerald-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Prossimi 7 Giorni</p>
                                <p className="text-3xl font-bold">{contentStats.upcoming}</p>
                                <p className="text-xs text-muted-foreground mt-1">in arrivo</p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                                <Timer className="h-6 w-6 text-amber-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className={cn(
                    "bg-gradient-to-br border",
                    contentStats.overdue > 0
                        ? "from-red-500/10 to-red-600/5 border-red-500/20"
                        : "from-green-500/10 to-green-600/5 border-green-500/20"
                )}>
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">In Ritardo</p>
                                <p className="text-3xl font-bold">{contentStats.overdue}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {contentStats.overdue > 0 ? 'da gestire' : 'tutto ok!'}
                                </p>
                            </div>
                            <div className={cn(
                                "h-12 w-12 rounded-full flex items-center justify-center",
                                contentStats.overdue > 0 ? "bg-red-500/20" : "bg-green-500/20"
                            )}>
                                {contentStats.overdue > 0 ? (
                                    <AlertTriangle className="h-6 w-6 text-red-500" />
                                ) : (
                                    <CheckCircle className="h-6 w-6 text-green-500" />
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Platform Stats Mini Cards */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {Object.entries(contentStats.byPlatform).map(([platform, count]) => {
                    const iconData = socialIcons[platform];
                    if (!iconData) return null;
                    const Icon = iconData.icon;
                    return (
                        <Card key={platform} className="p-3">
                            <div className="flex items-center gap-2">
                                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center bg-muted", iconData.color)}>
                                    <Icon className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-lg font-bold">{count}</p>
                                    <p className="text-xs text-muted-foreground capitalize">{platform}</p>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Filtri</CardTitle>
                            {isFiltersOpen && <CardDescription>Affina la ricerca dei contenuti nel piano editoriale.</CardDescription>}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setIsFiltersOpen(!isFiltersOpen)}>
                            {isFiltersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    </div>
                </CardHeader>
                {isFiltersOpen && (
                    <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-end">
                        <div>
                            <Label>Cliente</Label>
                            <Select value={filters.clientId} onValueChange={v => handleFilterChange('clientId', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tutti i clienti</SelectItem>
                                    {[...clients].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' })).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Stato</Label>
                            <Select value={filters.status} onValueChange={v => handleFilterChange('status', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tutti</SelectItem>
                                    {[...editorialStatuses].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' })).map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Formato</Label>
                            <Select value={filters.format} onValueChange={v => handleFilterChange('format', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tutti i formati</SelectItem>
                                    {[...editorialFormats].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' })).map(f => <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Topic</Label>
                            <Input placeholder="Cerca per topic..." value={filters.query} onChange={e => handleFilterChange('query', e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 xl:col-span-3">
                            <div>
                                <Label>Dal</Label>
                                <DatePickerDialog
                                    value={filters.startDate ? new Date(filters.startDate) : undefined}
                                    onChange={(date) => handleDateFilterChange('startDate', date)}
                                    placeholder="Seleziona data"
                                    label="Data Inizio"
                                />
                            </div>
                            <div>
                                <Label>Al</Label>
                                <DatePickerDialog
                                    value={filters.endDate ? new Date(filters.endDate) : undefined}
                                    onChange={(date) => handleDateFilterChange('endDate', date)}
                                    placeholder="Seleziona data"
                                    label="Data Fine"
                                />
                            </div>
                            <div className="col-span-2 flex items-end gap-2">
                                <Button variant="outline" size="sm" className="w-full" onClick={() => setDateShortcut('week')}>Questa Settimana</Button>
                                <Button variant="outline" size="sm" className="w-full" onClick={() => setDateShortcut('month')}>Questo Mese</Button>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <Button variant="ghost" onClick={resetFilters} className="w-full text-red-500 font-bold">
                                <Eraser className="mr-2 h-4 w-4" />
                                Pulisci Filtri
                            </Button>
                        </div>
                    </CardContent>
                )}
            </Card>


            {view === 'table' && (
                <Card>
                    <CardHeader>
                        <CardTitle>{tableTitle}</CardTitle>
                        <CardDescription>
                            Visualizza tutti i contenuti programmati e il loro stato di avanzamento. Clicca su un campo per modificarlo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">GG</TableHead>
                                        <TableHead>Pubblicazione</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Topic</TableHead>
                                        <TableHead>Formato</TableHead>
                                        <TableHead>Focus</TableHead>
                                        <TableHead>FB</TableHead>
                                        <TableHead>IG</TableHead>
                                        <TableHead>LI</TableHead>
                                        <TableHead>TT</TableHead>
                                        <TableHead>IGS</TableHead>
                                        <TableHead>GBP</TableHead>
                                        <TableHead>YT</TableHead>
                                        <TableHead>Copy Post</TableHead>
                                        <TableHead>Tag</TableHead>
                                        <TableHead>Stato</TableHead>
                                        <TableHead className="text-right">Azioni</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingLayout || isLoadingData ? (
                                        [...Array(5)].map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell colSpan={17}><Skeleton className="h-8 w-full" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : filteredContents.length > 0 ? (
                                        filteredContents.map(content => {
                                            const client = clientsById[content.clientId];
                                            const status = editorialStatuses.find(s => s.name === content.status);
                                            const pubDate = content.publicationDate && !isNaN(new Date(content.publicationDate).getTime()) ? new Date(content.publicationDate) : null;

                                            return (
                                                <TableRow key={content.id}>
                                                    <TableCell className="font-bold text-muted-foreground">{pubDate ? format(pubDate, 'EEE', { locale: it }).toUpperCase() : '-'}</TableCell>
                                                    <TableCell className="whitespace-nowrap">{pubDate ? format(pubDate, 'dd/MM/yyyy', { locale: it }) : '-'}</TableCell>
                                                    <TableCell className="font-medium hover:bg-muted/50 cursor-pointer" style={{ backgroundColor: `${client?.color}20` }} onClick={() => handleOpenFieldEditor(content.id, 'clientId', 'Cliente', content.clientId, 'select', clients.map(c => ({ value: c.id, label: c.name })))}>{client?.name || 'N/D'}</TableCell>
                                                    <TableCell className="font-medium max-w-[200px] truncate hover:bg-muted/50 cursor-pointer" onClick={() => handleOpenFieldEditor(content.id, 'topic', 'Topic', content.topic)}>{content.topic}</TableCell>
                                                    <TableCell className="hover:bg-muted/50 cursor-pointer" onClick={() => handleOpenFieldEditor(content.id, 'format', 'Formato', content.format, 'select', editorialFormats.map(f => ({ value: f.name, label: f.name })))}>{content.format}</TableCell>
                                                    <TableCell className="max-w-[150px] truncate hover:bg-muted/50 cursor-pointer" onClick={() => handleOpenFieldEditor(content.id, 'focus', 'Focus', content.focus)}>{content.focus}</TableCell>

                                                    {(['facebook', 'instagram', 'linkedin', 'tiktok', 'igStories', 'gbp', 'youtube'] as const).map(channel => (
                                                        <TableCell key={channel} className="text-center">
                                                            <Checkbox
                                                                checked={content[channel]}
                                                                className="cursor-pointer"
                                                                onCheckedChange={async (checked) => {
                                                                    // Optimistic update - update local state immediately
                                                                    setContents(prev => prev.map(c =>
                                                                        c.id === content.id ? { ...c, [channel]: !!checked } : c
                                                                    ));
                                                                    try {
                                                                        await updateEditorialContent(content.id, { [channel]: !!checked });
                                                                    } catch (error) {
                                                                        // Revert on error
                                                                        setContents(prev => prev.map(c =>
                                                                            c.id === content.id ? { ...c, [channel]: !checked } : c
                                                                        ));
                                                                        toast.error('Errore nel salvataggio');
                                                                    }
                                                                }}
                                                            />
                                                        </TableCell>
                                                    ))}

                                                    <TableCell className="max-w-[250px] truncate hover:bg-muted/50 cursor-pointer" onClick={() => handleOpenFieldEditor(content.id, 'copy', 'Testo', content.copy || '')}>{content.copy}</TableCell>
                                                    <TableCell className="max-w-[150px] truncate hover:bg-muted/50 cursor-pointer" onClick={() => handleOpenFieldEditor(content.id, 'tags', 'Tags', content.tags || '')}>{content.tags}</TableCell>
                                                    <TableCell>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="flex items-center gap-2 px-2 py-1 h-auto text-left w-full justify-start" style={{ borderColor: status?.color, borderWidth: 1, color: status?.color }}>
                                                                    {status ? (
                                                                        <>
                                                                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }}></span>
                                                                            <span className="truncate">{status.name}</span>
                                                                        </>
                                                                    ) : <span className="truncate">{content.status}</span>}
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent>
                                                                <DropdownMenuRadioGroup value={content.status} onValueChange={(newStatus) => handleStatusChange(content.id, newStatus)}>
                                                                    <DropdownMenuLabel>Cambia Stato</DropdownMenuLabel>
                                                                    <DropdownMenuSeparator />
                                                                    {editorialStatuses.map(s => (
                                                                        <DropdownMenuRadioItem key={s.id} value={s.name}>
                                                                            {s.name}
                                                                        </DropdownMenuRadioItem>
                                                                    ))}
                                                                </DropdownMenuRadioGroup>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent>
                                                                <DropdownMenuItem onClick={() => handleOpenEditModal(content)}>
                                                                    <Edit className="mr-2 h-4 w-4" /> Modifica
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem className="text-destructive" onClick={() => setContentToDelete(content)}>
                                                                    <Trash2 className="mr-2 h-4 w-4" /> Elimina
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={17} className="h-24 text-center">Nessun contenuto trovato per i filtri selezionati.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {view === 'kanban' && <KanbanView contents={filteredContents} clientsById={clientsById} statuses={editorialStatuses} onStatusChange={handleStatusChange} onEdit={handleOpenEditModal} onDelete={(content) => setContentToDelete(content)} onAddContent={handleOpenCreateModal} tasksById={tasksById} projectsById={projectsById} editorialColumns={editorialColumns} />}

            {view === 'calendar' && <CalendarView contents={filteredContents} clientsById={clientsById} onEdit={handleOpenEditModal} />}

            {view === 'gantt' && <GanttView contents={filteredContents} clients={clients} users={users} onEdit={handleOpenEditModal} />}

            <Dialog open={!!modalState} onOpenChange={(isOpen) => !isOpen && handleCloseModal()}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{modalState === 'create' ? 'Nuovo Contenuto' : 'Modifica Contenuto'}</DialogTitle>
                        <DialogDescription>Compila i campi per pianificare il tuo contenuto.</DialogDescription>
                    </DialogHeader>
                    <FormWrapper
                        modalState={modalState}
                        handleCloseModal={handleCloseModal}
                        editingContent={editingContent}
                        initialStatusForCreate={initialStatusForCreate}
                        clients={clients}
                        editorialFormats={editorialFormats}
                        editorialStatuses={editorialStatuses}
                        editorialColumns={editorialColumns}
                        onOpenNestedModal={handleOpenNestedModal}
                        onSuccess={fetchData}
                    />
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!contentToDelete} onOpenChange={() => setContentToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                        <AlertDialogDescription>Questa azione non può essere annullata. Questo eliminerà permanentemente il contenuto dal piano editoriale.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setContentToDelete(null)}>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => {
                            if (contentToDelete) {
                                await deleteEditorialContent(contentToDelete.id);
                                fetchData();
                                toast.success('Contenuto eliminato.');
                                setContentToDelete(null);
                            }
                        }} className="bg-destructive hover:bg-destructive/90">Elimina</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Sei assolutamente sicuro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Questa azione è irreversibile. Stai per eliminare permanentemente <span className="font-bold">{filteredContents.length}</span> contenuti.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteFilteredContents} className="bg-destructive hover:bg-destructive/90" disabled={isBulkDeleting}>
                            {isBulkDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Sì, elimina tutto
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>


            <Dialog open={!!editingField} onOpenChange={() => setEditingField(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Modifica {editingField?.label}</DialogTitle>
                        <DialogDescription>Modifica il valore e salva.</DialogDescription>
                    </DialogHeader>
                    {editingField?.type === 'select' && editingField.options ? (
                        <Select value={fieldValue} onValueChange={setFieldValue}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {editingField.options.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <Textarea
                            value={fieldValue}
                            onChange={(e) => setFieldValue(e.target.value)}
                            className="min-h-[200px] mt-4"
                            autoFocus
                        />
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditingField(null)}>Annulla</Button>
                        <Button onClick={handleSaveField}>Salva</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Nested Modals */}
            <Dialog open={nestedModal === 'task'} onOpenChange={handleCloseNestedModal}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Crea Nuovo Task Collegato</DialogTitle>
                    </DialogHeader>
                    <Suspense fallback={<div>Caricamento...</div>}>
                        <TaskForm
                            defaultClientId={formDataForNested?.clientId}
                            onSuccess={async () => {
                                // Since TaskForm handles its own submission, we just close and refresh
                                fetchData();
                                handleCloseNestedModal();
                            }}
                            onCancel={handleCloseNestedModal}
                        />
                    </Suspense>
                </DialogContent>
            </Dialog>

            <Dialog open={nestedModal === 'project'} onOpenChange={handleCloseNestedModal}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Crea Nuovo Progetto Collegato</DialogTitle>
                    </DialogHeader>
                    <Suspense fallback={<div>Caricamento...</div>}>
                        <ProjectForm
                            onSuccess={async () => {
                                fetchData();
                                handleCloseNestedModal();
                            }}
                            onCancel={handleCloseNestedModal}
                        />
                    </Suspense>
                </DialogContent>
            </Dialog>

        </div>
    );
}

// Wrapper component to manage form state and pass it down
function FormWrapper({ modalState, handleCloseModal, editingContent, initialStatusForCreate, clients, editorialFormats, editorialStatuses, editorialColumns, onOpenNestedModal, onSuccess }: {
    modalState: ModalState,
    handleCloseModal: () => void,
    editingContent: EditorialContent | null,
    initialStatusForCreate?: string;
    clients: Client[],
    editorialFormats: EditorialFormat[],
    editorialStatuses: EditorialStatus[],
    editorialColumns: EditorialColumn[],
    onOpenNestedModal: (type: NestedModalState, formData: ContentFormData) => void;
    onSuccess?: () => void;
}) {

    const [selectedClientId, setSelectedClientId] = useState<string | undefined>(editingContent?.clientId);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentImageUrls, setCurrentImageUrls] = useState<string[]>([]);
    const [currentVideoUrl, setCurrentVideoUrl] = useState<string>('');
    const [isUploadingFiles, setIsUploadingFiles] = useState(false);
    const [publicationDate, setPublicationDate] = useState<Date | undefined>(
        editingContent?.publicationDate && !isNaN(new Date(editingContent.publicationDate).getTime())
            ? new Date(editingContent.publicationDate)
            : undefined
    );

    const formRef = React.useRef<HTMLFormElement>(null);
    const { refetchData } = useLayoutData();

    useEffect(() => {
        if (modalState === 'edit' && editingContent) {
            setSelectedClientId(editingContent.clientId);
            setCurrentImageUrls(editingContent.imageUrls || []);
            setCurrentVideoUrl(editingContent.videoUrl || '');
            setPublicationDate(
                editingContent.publicationDate && !isNaN(new Date(editingContent.publicationDate).getTime())
                    ? new Date(editingContent.publicationDate)
                    : undefined
            );
        } else if (modalState === 'create') {
            setSelectedClientId(undefined);
            setCurrentImageUrls([]);
            setCurrentVideoUrl('');
            setPublicationDate(undefined);
        }
    }, [modalState, editingContent]);

    const getFormData = () => {
        if (!formRef.current) return null;
        const mainFormData = new FormData(formRef.current);
        const customFields: { [key: string]: string } = {};
        editorialColumns.forEach(col => {
            const clientId = mainFormData.get('clientId') as string;
            if (!clientId || !col.clientIds?.length || col.clientIds?.includes(clientId)) {
                const value = mainFormData.get(col.slug) as string;
                if (value) {
                    customFields[col.slug] = value;
                }
            }
        });

        return {
            publicationDate: publicationDate ? format(publicationDate, 'yyyy-MM-dd') : '',
            clientId: mainFormData.get('clientId') as string,
            topic: mainFormData.get('topic') as string,
            format: mainFormData.get('format') as string,
            focus: mainFormData.get('focus') as string,
            copy: mainFormData.get('copy') as string,
            tags: mainFormData.get('tags') as string,
            facebook: mainFormData.get('facebook') === 'on',
            linkedin: mainFormData.get('linkedin') === 'on',
            instagram: mainFormData.get('instagram') === 'on',
            igStories: mainFormData.get('igStories') === 'on',
            tiktok: mainFormData.get('tiktok') === 'on',
            gbp: mainFormData.get('gbp') === 'on',
            youtube: mainFormData.get('youtube') === 'on',
            customFields: customFields,
            imageUrls: currentImageUrls.filter(url => url.trim() !== ''),
            videoUrl: currentVideoUrl,
            status: mainFormData.get('status') as string || initialStatusForCreate || 'Bozza',
        };
    };

    const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<string | undefined> => {
        e.preventDefault();
        setIsSubmitting(true);
        const data = getFormData();
        if (!data) {
            setIsSubmitting(false);
            return;
        }

        try {
            if (modalState === 'create') {
                const newContentId = await addEditorialContent(data);

                toast.success('Contenuto aggiunto.');
                handleCloseModal();
                onSuccess?.();
                return newContentId;

            } else if (modalState === 'edit' && editingContent) {
                await updateEditorialContent(editingContent.id, data);
                toast.success('Contenuto aggiornato.');
                handleCloseModal();
                onSuccess?.();
                return editingContent.id;
            }
        } catch (error) {
            console.error('Failed to save content:', error);
            toast.error('Impossibile salvare il contenuto.');
        } finally {
            setIsSubmitting(false);
        }
        return undefined;
    }

    const handleCreateLinked = async (type: NestedModalState) => {
        if (!formRef.current) return;
        const mainFormData = new FormData(formRef.current);
        const topic = mainFormData.get('topic') as string;
        const clientId = mainFormData.get('clientId') as string;

        if (!topic || !clientId) {
            toast.error("Dati Mancanti", {
                description: "Compila almeno 'Cliente' e 'Topic' prima di creare un'attività collegata.",
            });
            return;
        }

        let contentId = editingContent?.id;
        if (modalState === 'create' && !contentId) {
            setIsSubmitting(true);
            const data = getFormData();
            if (!data) {
                setIsSubmitting(false);
                return;
            }
            try {
                const newContent = { ...data, status: 'Bozza' };
                contentId = await addEditorialContent(newContent);
                toast.success('Bozza Salvata', { description: 'Contenuto salvato come bozza.' });
                handleCloseModal(); // No refetch yet
                onOpenNestedModal(type, { topic, clientId, contentId });
            } catch (error) {
                toast.error('Errore', { description: 'Impossibile salvare la bozza.' });
            } finally {
                setIsSubmitting(false);
            }
        } else if (contentId) {
            onOpenNestedModal(type, { topic, clientId, contentId });
        }
    };


    return (
        <form ref={formRef} onSubmit={handleFormSubmit} className="space-y-4 pt-4 max-h-[80vh] overflow-y-auto pr-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="publicationDate">Data di Pubblicazione</Label>
                    <DatePickerDialog
                        value={publicationDate}
                        onChange={setPublicationDate}
                        placeholder="Seleziona data"
                        label="Data di Pubblicazione"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="clientId">Cliente</Label>
                    <Select name="clientId" required defaultValue={editingContent?.clientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger><SelectValue placeholder="Seleziona un cliente..." /></SelectTrigger>
                        <SelectContent>
                            {[...clients].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' })).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="topic">Topic</Label>
                    <Input id="topic" name="topic" defaultValue={editingContent?.topic} required />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="format">Formato</Label>
                    <Select name="format" defaultValue={editingContent?.format} required>
                        <SelectTrigger id="format">
                            <SelectValue placeholder="Seleziona un formato..." />
                        </SelectTrigger>
                        <SelectContent>
                            {[...editorialFormats].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' })).map(format => (
                                <SelectItem key={format.id} value={format.name}>{format.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="focus">Focus</Label>
                    <Input id="focus" name="focus" defaultValue={editingContent?.focus} />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Canali</Label>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 border rounded-xl">
                    <div className="flex items-center gap-2"><Checkbox id="facebook" name="facebook" defaultChecked={editingContent?.facebook} /><Label htmlFor="facebook" className="font-normal">Facebook</Label></div>
                    <div className="flex items-center gap-2"><Checkbox id="linkedin" name="linkedin" defaultChecked={editingContent?.linkedin} /><Label htmlFor="linkedin" className="font-normal">LinkedIn</Label></div>
                    <div className="flex items-center gap-2"><Checkbox id="instagram" name="instagram" defaultChecked={editingContent?.instagram} /><Label htmlFor="instagram" className="font-normal">Instagram</Label></div>
                    <div className="flex items-center gap-2"><Checkbox id="igStories" name="igStories" defaultChecked={editingContent?.igStories} /><Label htmlFor="igStories" className="font-normal">IG Stories</Label></div>
                    <div className="flex items-center gap-2"><Checkbox id="tiktok" name="tiktok" defaultChecked={editingContent?.tiktok} /><Label htmlFor="tiktok" className="font-normal">TikTok</Label></div>
                    <div className="flex items-center gap-2"><Checkbox id="gbp" name="gbp" defaultChecked={editingContent?.gbp} /><Label htmlFor="gbp" className="font-normal">GBP</Label></div>
                    <div className="flex items-center gap-2"><Checkbox id="youtube" name="youtube" defaultChecked={editingContent?.youtube} /><Label htmlFor="youtube" className="font-normal">YouTube</Label></div>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="copy">Copy / Testo del post</Label>
                <Textarea id="copy" name="copy" defaultValue={editingContent?.copy} rows={6} />
            </div>

            <div className="space-y-2">
                <Label htmlFor="tags">Tag</Label>
                <Input id="tags" name="tags" defaultValue={editingContent?.tags} placeholder="#marketing, #content, ..." />
            </div>

            <DynamicFormFields clientId={selectedClientId} content={editingContent} editorialColumns={editorialColumns} />

            <div className="space-y-4 pt-4 border-t">
                <Label className="text-base font-semibold">Immagini</Label>

                {/* File Upload Section */}
                <div className="space-y-2">
                    <Label htmlFor="fileUpload" className="text-sm text-muted-foreground">Carica file immagine</Label>
                    <div
                        className={cn(
                            "relative border-2 border-dashed rounded-lg p-6 transition-colors",
                            "hover:border-primary hover:bg-primary/5",
                            isUploadingFiles && "opacity-50 pointer-events-none"
                        )}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.add('border-primary', 'bg-primary/5');
                        }}
                        onDragLeave={(e) => {
                            e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                        }}
                        onDrop={async (e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('border-primary', 'bg-primary/5');

                            const allFiles = Array.from(e.dataTransfer.files);
                            const imageFiles = allFiles.filter(f => f.type.startsWith('image/'));
                            const videoFiles = allFiles.filter(f => f.type.startsWith('video/'));

                            if (imageFiles.length === 0 && videoFiles.length === 0) {
                                toast.error('Solo immagini e video sono supportati');
                                return;
                            }

                            setIsUploadingFiles(true);
                            try {
                                if (imageFiles.length > 0) {
                                    const attachments = await uploadFilesAndGetAttachments(
                                        imageFiles,
                                        'editorial-plan/images',
                                        'anonymous'
                                    );
                                    const newUrls = attachments.map(a => a.url);
                                    setCurrentImageUrls(prev => [...prev, ...newUrls]);
                                }

                                if (videoFiles.length > 0) {
                                    // Upload video
                                    const videoFile = videoFiles[0];
                                    const attachments = await uploadFilesAndGetAttachments(
                                        [videoFile],
                                        'editorial-plan/videos',
                                        'anonymous'
                                    );
                                    if (attachments.length > 0) {
                                        setCurrentVideoUrl(attachments[0].url);
                                    }
                                }

                                toast.success('Media caricati con successo');
                            } catch (error) {
                                console.error('Upload failed:', error);
                                toast.error('Errore durante il caricamento');
                            } finally {
                                setIsUploadingFiles(false);
                            }
                        }}
                    >
                        <div className="flex flex-col items-center justify-center gap-2 text-center">
                            {isUploadingFiles ? (
                                <>
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <p className="text-sm text-muted-foreground">Caricamento in corso...</p>
                                </>
                            ) : (
                                <>
                                    <Upload className="h-8 w-8 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">
                                        Trascina qui immagini o video, o clicca per selezionarli
                                    </p>
                                    <p className="text-xs text-muted-foreground/70">
                                        Supportati: JPG, PNG, GIF, MP4, WEBM
                                    </p>
                                </>
                            )}
                        </div>
                        <input
                            id="fileUpload"
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={isUploadingFiles}
                            onChange={async (e) => {
                                const allFiles = Array.from(e.target.files || []);
                                if (allFiles.length === 0) return;

                                const imageFiles = allFiles.filter(f => f.type.startsWith('image/'));
                                const videoFiles = allFiles.filter(f => f.type.startsWith('video/'));

                                setIsUploadingFiles(true);
                                try {
                                    if (imageFiles.length > 0) {
                                        const attachments = await uploadFilesAndGetAttachments(
                                            imageFiles,
                                            'editorial-plan/images',
                                            'anonymous'
                                        );
                                        const newUrls = attachments.map(a => a.url);
                                        setCurrentImageUrls(prev => [...prev, ...newUrls]);
                                    }

                                    if (videoFiles.length > 0) {
                                        const videoFile = videoFiles[0];
                                        const attachments = await uploadFilesAndGetAttachments(
                                            [videoFile],
                                            'editorial-plan/videos',
                                            'anonymous'
                                        );
                                        if (attachments.length > 0) {
                                            setCurrentVideoUrl(attachments[0].url);
                                        }
                                    }

                                    toast.success('Media caricati con successo');
                                } catch (error) {
                                    console.error('Upload failed:', error);
                                    toast.error('Errore durante il caricamento');
                                } finally {
                                    setIsUploadingFiles(false);
                                    e.target.value = '';
                                }
                            }}
                        />
                    </div>
                </div>

                {/* Image Previews */}
                {currentImageUrls.filter(url => url.trim() !== '').length > 0 && (
                    <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Immagini caricate ({currentImageUrls.filter(url => url.trim() !== '').length})</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {currentImageUrls.filter(url => url.trim() !== '').map((url, index) => (
                                <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={url}
                                        alt={`Immagine ${index + 1}`}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f0f0f0" width="100" height="100"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23999" font-size="12">Errore</text></svg>';
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => {
                                            setCurrentImageUrls(prev => prev.filter((_, i) => i !== index));
                                        }}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Video Preview */}
                {currentVideoUrl && currentVideoUrl.trim() !== '' && (
                    <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Video caricato</Label>
                        <div className="relative group rounded-lg overflow-hidden border bg-muted aspect-video">
                            <video
                                src={currentVideoUrl}
                                controls
                                className="w-full h-full object-cover"
                            />
                            <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                onClick={() => {
                                    setCurrentVideoUrl('');
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* URL Input Section */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="imageUrls" className="text-sm text-muted-foreground">Link immagini (uno per riga)</Label>
                        <Textarea
                            id="imageUrls"
                            name="imageUrls"
                            placeholder={"https://example.com/image1.jpg\nhttps://example.com/image2.png"}
                            rows={3}
                            value={currentImageUrls.join('\n')}
                            onChange={(e) => setCurrentImageUrls(e.target.value.split('\n'))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="videoUrl" className="text-sm text-muted-foreground">Link video</Label>
                        <Input
                            id="videoUrl"
                            name="videoUrl"
                            placeholder="https://example.com/video.mp4"
                            value={currentVideoUrl}
                            onChange={(e) => setCurrentVideoUrl(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t">
                <h3 className="text-md font-semibold mb-2">Azioni Aggiuntive</h3>
                <div className="flex gap-4">
                    <Button type="button" variant="outline" onClick={() => handleCreateLinked('task')}>
                        <ClipboardList className="mr-2 h-4 w-4" />
                        Crea Task Collegato
                    </Button>
                    <Button type="button" variant="outline" onClick={() => handleCreateLinked('project')}>
                        <Briefcase className="mr-2 h-4 w-4" />
                        Crea Progetto Collegato
                    </Button>
                </div>
            </div>

            <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="status">Stato</Label>
                <Select name="status" defaultValue={editingContent?.status || initialStatusForCreate}>
                    <SelectTrigger><SelectValue placeholder="Seleziona uno stato..." /></SelectTrigger>
                    <SelectContent>
                        {[...editorialStatuses].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' })).map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => handleCloseModal()}>Annulla</Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvataggio...
                        </>
                    ) : editingContent ? 'Salva Modifiche' : 'Crea Contenuto'}
                </Button>
            </DialogFooter>
        </form>
    );
}

const DynamicFormFields = ({ clientId, content, editorialColumns }: { clientId: string | undefined, content: EditorialContent | null, editorialColumns: EditorialColumn[] }) => {

    const clientColumns = useMemo(() => {
        if (!clientId) return [];
        return editorialColumns.filter(col =>
            !col.clientIds?.length || col.clientIds?.includes(clientId)
        );
    }, [clientId, editorialColumns]);


    if (clientColumns.length === 0) return null;

    return (
        <div className="pt-4 border-t">
            <h3 className="text-md font-semibold mb-2">Campi Personalizzati</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clientColumns.map(col => (
                    <div key={col.id} className="space-y-2">
                        <Label htmlFor={col.slug}>{col.name}</Label>
                        {col.type === 'select' && col.options ? (
                            <Select name={col.slug} defaultValue={content?.customFields?.[col.slug]}>
                                <SelectTrigger><SelectValue placeholder={`Seleziona ${col.name}...`} /></SelectTrigger>
                                <SelectContent>
                                    {col.options.map(option => (
                                        <SelectItem key={option} value={option}>{option}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                id={col.slug}
                                name={col.slug}
                                defaultValue={content?.customFields?.[col.slug] || ''}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
