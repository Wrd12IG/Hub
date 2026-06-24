

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
import { PlusCircle, MoreVertical, Edit, Trash2, Instagram, Youtube, Clapperboard, Store, Briefcase, MessageSquare, Filter, Calendar as CalendarIcon, LayoutGrid, Kanban, List, Loader2, Pencil, GanttChartSquare, ClipboardList, Eraser, Facebook, Linkedin, Upload, AlertTriangle, Download, TrendingUp, Clock, FileText, BarChart3, Eye, CheckCircle, Timer, ImageIcon, X, Send, Wand2 } from 'lucide-react';
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
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LivePreview } from '@/components/editorial-plan/live-preview';
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
const KanbanView = ({ contents, clientsById, statuses, onStatusChange, onEdit, onDelete, onAddContent, tasksById, projectsById, editorialColumns, onPublishToZapier, isPublishing }: {
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
    onPublishToZapier: (content: EditorialContent) => void,
    isPublishing: Record<string, boolean>,
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
                                                        <DropdownMenuItem 
                                                            disabled={content.status !== 'Approvato' || isPublishing[content.id]}
                                                            onClick={() => onPublishToZapier(content)}
                                                        >
                                                            <Send className="mr-2 h-4 w-4" /> 
                                                            {isPublishing[content.id] ? 'Invio in corso...' : 'Invia a Zapier'}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
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


export function EditorialPlanPageContent({ forcedClientId }: { forcedClientId?: string }) {


    // UI State
    const [isFiltersOpen, setIsFiltersOpen] = useState(true);

    const { clients, users, currentUser, permissions, allTasks, allProjects, activityTypes, clientsById, usersById, tasksById, projectsById, isLoadingLayout } = useLayoutData();
    const [contents, setContents] = useState<EditorialContent[]>([]);
    const [editorialFormats, setEditorialFormats] = useState<EditorialFormat[]>([]);
    const [editorialStatuses, setEditorialStatuses] = useState<EditorialStatus[]>([]);
    const [editorialColumns, setEditorialColumns] = useState<EditorialColumn[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isPublishing, setIsPublishing] = useState<Record<string, boolean>>({});

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
        clientId: forcedClientId || 'all',
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

    const handlePublishToZapier = async (content: EditorialContent) => {
        if (content.status !== 'Approvato') {
            toast.error('Il post deve essere nello stato "Approvato" per essere inviato a Zapier.');
            return;
        }

        setIsPublishing(prev => ({ ...prev, [content.id]: true }));
        try {
            const res = await fetch('/api/publish-zapier', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contentId: content.id })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Errore durante la pubblicazione.');
            }

            toast.success('Contenuto inviato a Zapier con successo!');
            await fetchData();
        } catch (error: any) {
            console.error('Publish error:', error);
            toast.error(error.message || "Errore durante l'invio a Zapier.");
        } finally {
            setIsPublishing(prev => ({ ...prev, [content.id]: false }));
        }
    };

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
        setFilters({ clientId: forcedClientId || 'all', status: 'all', format: 'all', query: '', startDate: '', endDate: '' });
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
                {!forcedClientId && (
                    <div>
                        <h1 className="text-3xl font-bold font-headline">Piano Editoriale</h1>
                        <p className="text-muted-foreground">
                            Pianifica, organizza e monitora tutti i tuoi contenuti di marketing.
                        </p>
                    </div>
                )}
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
                                    <Icon className="h-3.5 w-3.5" />
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
                        {!forcedClientId && (
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
                        )}
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
                                                    <TableCell className="font-medium hover:bg-muted/50 cursor-pointer" style={{ backgroundColor: `${client?.color}20` }} onClick={() => handleOpenFieldEditor(content.id, 'clientId', 'Cliente', content.clientId, 'select', [...clients].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(c => ({ value: c.id, label: c.name })))}>{client?.name || 'N/D'}</TableCell>
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
                                                                <DropdownMenuItem 
                                                                    disabled={content.status !== 'Approvato' || isPublishing[content.id]}
                                                                    onClick={() => handlePublishToZapier(content)}
                                                                >
                                                                    <Send className="mr-2 h-4 w-4" /> 
                                                                    {isPublishing[content.id] ? 'Invio in corso...' : 'Invia a Zapier'}
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
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

            {view === 'kanban' && <KanbanView contents={filteredContents} clientsById={clientsById} statuses={editorialStatuses} onStatusChange={handleStatusChange} onEdit={handleOpenEditModal} onDelete={(content) => setContentToDelete(content)} onAddContent={handleOpenCreateModal} tasksById={tasksById} projectsById={projectsById} editorialColumns={editorialColumns} onPublishToZapier={handlePublishToZapier} isPublishing={isPublishing} />}

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
function FormWrapper({ modalState, handleCloseModal, editingContent, initialStatusForCreate, clients, editorialFormats, editorialStatuses, editorialColumns, forcedClientId, onOpenNestedModal, onSuccess }: {
    modalState: ModalState,
    handleCloseModal: () => void,
    editingContent: EditorialContent | null,
    initialStatusForCreate?: string;
    clients: Client[],
    editorialFormats: EditorialFormat[],
    editorialStatuses: EditorialStatus[],
    editorialColumns: EditorialColumn[],
    forcedClientId?: string,
    onOpenNestedModal: (type: NestedModalState, formData: ContentFormData) => void;
    onSuccess?: () => void;
}) {

    const [selectedClientId, setSelectedClientId] = useState<string | undefined>(editingContent?.clientId || forcedClientId);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentImageUrls, setCurrentImageUrls] = useState<string[]>([]);
    const [currentVideoUrl, setCurrentVideoUrl] = useState<string>('');
    const [isUploadingFiles, setIsUploadingFiles] = useState(false);
    
    // Controlled states for Live Preview
    const [topic, setTopic] = useState(editingContent?.topic || '');
    const [formatValue, setFormatValue] = useState(editingContent?.format || '');
    const [copy, setCopy] = useState(editingContent?.copy || '');
    const [platforms, setPlatforms] = useState({
        facebook: editingContent?.facebook || false,
        linkedin: editingContent?.linkedin || false,
        instagram: editingContent?.instagram || false,
        igStories: editingContent?.igStories || false,
        tiktok: editingContent?.tiktok || false,
        gbp: editingContent?.gbp || false,
        youtube: editingContent?.youtube || false,
    });

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
            setTopic(editingContent.topic || '');
            setFormatValue(editingContent.format || '');
            setCopy(editingContent.copy || '');
            setPlatforms({
                facebook: editingContent.facebook || false,
                linkedin: editingContent.linkedin || false,
                instagram: editingContent.instagram || false,
                igStories: editingContent.igStories || false,
                tiktok: editingContent.tiktok || false,
                gbp: editingContent.gbp || false,
                youtube: editingContent.youtube || false,
            });
        } else if (modalState === 'create') {
            setSelectedClientId(undefined);
            setCurrentImageUrls([]);
            setCurrentVideoUrl('');
            setPublicationDate(undefined);
            setTopic('');
            setFormatValue('');
            setCopy('');
            setPlatforms({
                facebook: false,
                linkedin: false,
                instagram: false,
                igStories: false,
                tiktok: false,
                gbp: false,
                youtube: false,
            });
        }
    }, [modalState, editingContent]);

    const handlePlatformChange = (platform: keyof typeof platforms) => (checked: boolean) => {
        setPlatforms(prev => ({ ...prev, [platform]: checked }));
    };

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
            facebook: platforms.facebook,
            linkedin: platforms.linkedin,
            instagram: platforms.instagram,
            igStories: platforms.igStories,
            tiktok: platforms.tiktok,
            gbp: platforms.gbp,
            youtube: platforms.youtube,
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


    const activeClient = clients.find(c => c.id === selectedClientId);
    const clientName = activeClient?.name || 'Seleziona Cliente';
    
    const mapFormatToPostType = (format: string) => {
        const f = format?.toLowerCase() || '';
        if (f.includes('reel') || f.includes('short') || f.includes('tiktok')) return 'REEL';
        if (f.includes('video')) return 'VIDEO';
        if (f.includes('storia') || f.includes('story')) return 'STORY';
        if (f.includes('carosello') || f.includes('carousel')) return 'CAROUSEL';
        if (f.includes('link')) return 'LINK';
        if (f.includes('testo') || f.includes('text')) return 'TEXT';
        return 'PHOTO';
    };
    
    const postType = mapFormatToPostType(formatValue) as any;

    return (
        <form ref={formRef} onSubmit={handleFormSubmit} className="pt-2 h-full flex flex-col">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 items-start max-h-[80vh] overflow-hidden">
                
                {/* SINISTRA: FORM DI INPUT */}
                <div className="flex flex-col h-full bg-white rounded-xl border shadow-sm overflow-y-auto overflow-x-hidden">
                    {/* Header: Canali e Strumenti */}
                    <div className="flex items-center justify-between p-3 border-b bg-muted/10">
                        <div className="flex items-center gap-2">
                            {/* Platform Toggles */}
                            <TooltipProvider>
                                {Object.entries(socialIcons).map(([key, { icon: Icon, color }]) => {
                                    const isActive = platforms[key as keyof typeof platforms];
                                    return (
                                        <Tooltip key={key}>
                                            <TooltipTrigger asChild>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePlatformChange(key as keyof typeof platforms)(!isActive)}
                                                    className={cn(
                                                        "w-7 h-7 rounded-full flex items-center justify-center transition-all",
                                                        isActive ? "text-white" : "text-muted-foreground bg-muted hover:bg-muted/80"
                                                    )}
                                                    style={{ backgroundColor: isActive ? color : undefined }}
                                                >
                                                    <Icon className="h-3.5 w-3.5" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent>{key.charAt(0).toUpperCase() + key.slice(1)}</TooltipContent>
                                        </Tooltip>
                                    )
                                })}
                            </TooltipProvider>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedClientId ? (
                                <Link href={`/clients/${selectedClientId}/stories/new`}>
                                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1 border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100 hover:text-pink-800">
                                        <Wand2 className="h-3.5 w-3.5" />
                                        <span className="text-xs">Editor Stories</span>
                                    </Button>
                                </Link>
                            ) : (
                                <Button type="button" variant="outline" size="sm" className="h-8 gap-1 border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100 hover:text-pink-800" onClick={() => toast.error("Seleziona prima un cliente nelle preimpostazioni globali per accedere all'editor.")}>
                                    <Wand2 className="h-3.5 w-3.5" />
                                    <span className="text-xs">Editor Stories</span>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Textarea Principale */}
                    <div className="flex-1 flex flex-col p-4">
                        <textarea
                            name="copy"
                            value={copy}
                            onChange={e => setCopy(e.target.value)}
                            placeholder="A cosa stai pensando?"
                            className="flex-1 w-full resize-none border-none focus:ring-0 text-base placeholder:text-muted-foreground p-0 min-h-[200px]"
                        />
                        
                        {/* Immagini Caricate (Thumbnails) */}
                        <div className="flex flex-wrap gap-2 mt-4">
                            {currentImageUrls.filter(url => url.trim() !== '').map((url, index) => (
                                <div key={index} className="relative group w-16 h-16 rounded-md overflow-hidden border bg-muted">
                                    <img src={url} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                                    <button type="button" onClick={() => setCurrentImageUrls(prev => prev.filter((_, i) => i !== index))} className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                            {currentVideoUrl && currentVideoUrl.trim() !== '' && (
                                <div className="relative group w-16 h-16 rounded-md overflow-hidden border bg-muted flex items-center justify-center">
                                    <Clapperboard className="h-6 w-6 text-muted-foreground" />
                                    <button type="button" onClick={() => setCurrentVideoUrl('')} className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Toolbar Inferiore Textarea */}
                        <div className="flex items-center justify-between pt-3 mt-3 border-t">
                            <div className="flex items-center gap-3">
                                {/* Upload Icon */}
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <label className="cursor-pointer text-muted-foreground hover:text-primary transition-colors">
                                                {isUploadingFiles ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
                                                <input
                                                    type="file"
                                                    accept="image/*,video/*"
                                                    multiple
                                                    className="hidden"
                                                    disabled={isUploadingFiles}
                                                    onChange={async (e) => {
                                                        const allFiles = Array.from(e.target.files || []);
                                                        if (allFiles.length === 0) return;
                                                        const imageFiles = allFiles.filter(f => f.type.startsWith('image/'));
                                                        const videoFiles = allFiles.filter(f => f.type.startsWith('video/'));
                                                        setIsUploadingFiles(true);
                                                        try {
                                                            if (imageFiles.length > 0) {
                                                                const attachments = await uploadFilesAndGetAttachments(imageFiles, 'editorial-plan/images', 'anonymous');
                                                                setCurrentImageUrls(prev => [...prev, ...attachments.map(a => a.url)]);
                                                            }
                                                            if (videoFiles.length > 0) {
                                                                const attachments = await uploadFilesAndGetAttachments([videoFiles[0]], 'editorial-plan/videos', 'anonymous');
                                                                setCurrentVideoUrl(attachments[0].url);
                                                            }
                                                        } catch (error) {
                                                            toast.error('Errore durante il caricamento');
                                                        } finally {
                                                            setIsUploadingFiles(false);
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </TooltipTrigger>
                                        <TooltipContent>Aggiungi foto/video</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                {/* Altre icone decorative / mockup (Smile, Map, Link, ecc.) */}
                            </div>
                            <span className="text-xs text-muted-foreground">
                                {copy.length} / 2200 <Facebook className="inline h-3 w-3 text-blue-500 ml-1" />
                            </span>
                        </div>
                    </div>

                    {/* Preimpostazioni Globali (Collapsible) */}
                    <div className="border-t bg-muted/5 p-3">
                        <Collapsible defaultOpen={true}>
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" className="w-full justify-between p-2 h-auto text-sm font-semibold">
                                    <div className="flex items-center gap-2">
                                        <span>⚙️ Preimpostazioni globali</span>
                                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">Nuovo</Badge>
                                    </div>
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-3 space-y-4 px-2 pb-2">
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Client (if not forced) */}
                                    {!forcedClientId && (
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground">Cliente</Label>
                                            <Select name="clientId" required value={selectedClientId} onValueChange={setSelectedClientId}>
                                                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                                                <SelectContent>
                                                    {[...clients].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                    {forcedClientId && <input type="hidden" name="clientId" value={forcedClientId} />}
                                    
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Topic *</Label>
                                        <Input id="topic" name="topic" value={topic} onChange={e => setTopic(e.target.value)} required className="h-8 text-sm" />
                                    </div>
                                    
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Formato *</Label>
                                        <Select name="format" value={formatValue} onValueChange={setFormatValue} required>
                                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                                            <SelectContent>
                                                {[...editorialFormats].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(format => (
                                                    <SelectItem key={format.id} value={format.name}>{format.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Focus</Label>
                                        <Input id="focus" name="focus" defaultValue={editingContent?.focus} className="h-8 text-sm" />
                                    </div>
                                    
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Tag</Label>
                                        <Input id="tags" name="tags" defaultValue={editingContent?.tags} placeholder="#tag..." className="h-8 text-sm" />
                                    </div>
                                    
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Stato</Label>
                                        <Select name="status" defaultValue={editingContent?.status || initialStatusForCreate}>
                                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Stato..." /></SelectTrigger>
                                            <SelectContent>
                                                {[...editorialStatuses].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <DynamicFormFields clientId={selectedClientId} content={editingContent} editorialColumns={editorialColumns} />
                            </CollapsibleContent>
                        </Collapsible>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-3 border-t bg-muted/10 flex items-center justify-between mt-auto">
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleCloseModal()}>Annulla</Button>
                        <div className="flex items-center gap-2">
                            <DatePickerDialog
                                value={publicationDate}
                                onChange={setPublicationDate}
                                placeholder="Data pubbl."
                                label=""
                            />
                            <Button type="submit" size="sm" className="bg-[#2D2A3B] hover:bg-[#2D2A3B]/90 text-white" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Programma
                            </Button>
                        </div>
                    </div>
                </div>

                {/* DESTRA: ANTEPRIMA LIVE */}
                <div className="h-full bg-muted/20 rounded-xl border p-4 overflow-y-auto">
                    {Object.values(platforms).every(v => !v) && (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center">
                            <Eye className="h-10 w-10 mb-3 opacity-30" />
                            <p className="text-sm font-medium">Seleziona un canale per vedere l'anteprima</p>
                        </div>
                    )}
                    <div className="flex flex-col gap-8">
                        {platforms.facebook && (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground self-start uppercase tracking-wider">Facebook</span>
                                <LivePreview platform="FACEBOOK" caption={copy} postType={postType} mediaUrls={[...currentImageUrls, currentVideoUrl]} clientName={clientName} />
                            </div>
                        )}
                        {platforms.instagram && (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground self-start uppercase tracking-wider">Instagram</span>
                                <LivePreview platform="INSTAGRAM" caption={copy} postType={postType} mediaUrls={[...currentImageUrls, currentVideoUrl]} clientName={clientName} />
                            </div>
                        )}
                        {platforms.linkedin && (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground self-start uppercase tracking-wider">LinkedIn</span>
                                <LivePreview platform="LINKEDIN" caption={copy} postType={postType} mediaUrls={[...currentImageUrls, currentVideoUrl]} clientName={clientName} />
                            </div>
                        )}
                        {platforms.igStories && (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground self-start uppercase tracking-wider">IG Stories</span>
                                <LivePreview platform="INSTAGRAM" caption={copy} postType="STORY" mediaUrls={[...currentImageUrls, currentVideoUrl]} clientName={clientName} />
                            </div>
                        )}
                        {platforms.tiktok && (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground self-start uppercase tracking-wider">TikTok</span>
                                <LivePreview platform="TIKTOK" caption={copy} postType="REEL" mediaUrls={[...currentImageUrls, currentVideoUrl]} clientName={clientName} />
                            </div>
                        )}
                        {platforms.youtube && (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground self-start uppercase tracking-wider">YouTube</span>
                                <LivePreview platform="YOUTUBE" caption={copy} postType={postType === 'REEL' ? 'REEL' : 'VIDEO'} mediaUrls={[...currentImageUrls, currentVideoUrl]} clientName={clientName} />
                            </div>
                        )}
                        {platforms.gbp && (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground self-start uppercase tracking-wider">Google Business</span>
                                <LivePreview platform="GOOGLE_BUSINESS" caption={copy} postType={postType} mediaUrls={[...currentImageUrls, currentVideoUrl]} clientName={clientName} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
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

