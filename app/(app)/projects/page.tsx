'use client';

import React, { useState, useMemo } from 'react';
import { useLayoutData } from "@/app/(app)/layout-context";
import {
    Plus,
    LayoutGrid,
    List,
    Calendar as CalendarIcon,
    Search,
    Filter,
    CircleAlert,
    ChevronUp,
    Minus,
    ChevronDown,
    Eye,
    Pencil,
    ExternalLink,
    MoreVertical,
    Users,
    FolderKanban,
    Clock,
    Target,
    CheckCircle2,
    Loader2,
    Trash2,
    AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ProjectForm from '@/components/project-form';
import { ProjectCard } from '@/components/project-card';
import { Project, Client } from '@/lib/data';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { autoCompleteAllProjects, deleteProject, deleteTask } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';

import { TimelineView } from '@/components/timeline-view'; // Import aggiunto

export default function ProjectsPage() {
    const { allProjects: projects, clients, allTasks: tasks, usersById, currentUser } = useLayoutData();
    const router = useRouter();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [previewProject, setPreviewProject] = useState<Project | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [clientFilter, setClientFilter] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [showCompleted, setShowCompleted] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list' | 'timeline'>('grid');
    const [isAutoCompleting, setIsAutoCompleting] = useState(false);
    // Ripristino stati eliminati per errore
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [deleteRelatedTasks, setDeleteRelatedTasks] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);

    const { toast } = useToast();

    // Count tasks for a project
    const getProjectTaskCount = (projectId: string) => {
        return tasks.filter(t => t.projectId === projectId).length;
    };

    const handleDelete = (project: Project) => {
        setProjectToDelete(project);
        setDeleteRelatedTasks(true);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!projectToDelete) return;

        setIsDeleting(true);
        try {
            const userId = currentUser?.id || '';

            // If delete related tasks is checked, delete all tasks first
            if (deleteRelatedTasks) {
                const relatedTasks = tasks.filter(t => t.projectId === projectToDelete.id);
                for (const task of relatedTasks) {
                    await deleteTask(task.id, userId);
                }
            }

            // Delete the project
            await deleteProject(projectToDelete.id);

            toast({
                title: '🗑️ Progetto eliminato',
                description: deleteRelatedTasks
                    ? `Progetto "${projectToDelete.name}" e ${getProjectTaskCount(projectToDelete.id)} task eliminati.`
                    : `Progetto "${projectToDelete.name}" eliminato.`,
            });

            setIsDeleteDialogOpen(false);
            setProjectToDelete(null);
            window.location.reload();
        } catch (error) {
            console.error(error);
            toast({
                title: 'Errore',
                description: 'Impossibile eliminare il progetto.',
                variant: 'destructive',
            });
        } finally {
            setIsDeleting(false);
        }
    };
    const handleEdit = (project: Project) => {
        setEditingProject(project);
        setIsDialogOpen(true);
    };

    const handleCreate = () => {
        setEditingProject(null);
        setIsDialogOpen(true);
    };

    const handleAutoComplete = async () => {
        setIsAutoCompleting(true);
        try {
            const result = await autoCompleteAllProjects();
            if (result.count > 0) {
                toast({
                    title: '✅ Progetti completati',
                    description: `${result.count} progetti sono stati impostati come Completati: ${result.updated.join(', ')}`,
                });
                // Refresh the page to get updated data
                window.location.reload();
            } else {
                toast({
                    title: 'Nessun progetto da completare',
                    description: 'Tutti i progetti con 100% task completati sono già marcati come Completati.',
                });
            }
        } catch (error) {
            toast({
                title: 'Errore',
                description: 'Si è verificato un errore durante il completamento automatico.',
                variant: 'destructive',
            });
        } finally {
            setIsAutoCompleting(false);
        }
    };

    // Helper per calcolare priorità progetto (duplicato da card ma utile per sorting/stats)
    // Qui per efficienza calcoliamo stats globali
    const projectPriorities = useMemo(() => {
        const map = new Map<string, string>();
        projects.forEach(p => {
            const pTasks = tasks.filter(t => t.projectId === p.id && t.status !== 'Approvato' && t.status !== 'Annullato');
            if (pTasks.some(t => t.priority === 'Critica')) map.set(p.id, 'Critica');
            else if (pTasks.some(t => t.priority === 'Alta')) map.set(p.id, 'Alta');
            else if (pTasks.some(t => t.priority === 'Media')) map.set(p.id, 'Media');
            else if (pTasks.some(t => t.priority === 'Bassa')) map.set(p.id, 'Bassa');
            else map.set(p.id, 'Media');
        });
        return map;
    }, [projects, tasks]);


    const filteredProjects = useMemo(() => {
        let filtered = projects;

        // Filter by user role - same logic as tasks
        if (currentUser) {
            if (currentUser.role === 'Collaboratore') {
                // Collaboratore vede i progetti che:
                // 1. Hanno almeno un task assegnato a lui, OPPURE
                // 2. Sono stati creati da lui
                const userTaskProjectIds = new Set(
                    tasks
                        .filter(t => t.assignedUserId === currentUser.id)
                        .map(t => t.projectId)
                        .filter(Boolean)
                );
                filtered = filtered.filter(p =>
                    userTaskProjectIds.has(p.id) || p.createdBy === currentUser.id
                );
            }
            // Amministratore e Project Manager vedono tutti i progetti
        }

        // Filter by completed/cancelled
        if (!showCompleted) {
            filtered = filtered.filter(p => p.status !== 'Completato' && p.status !== 'Annullato');
        }

        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(q) ||
                clients.find(c => c.id === p.clientId)?.name.toLowerCase().includes(q)
            );
        }

        // Status Filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter((p: Project) => p.status === statusFilter);
        }

        // Client Filter
        if (clientFilter !== 'all') {
            filtered = filtered.filter((p: Project) => p.clientId === clientFilter);
        }

        // Sort
        return filtered.sort((a, b) => {
            if (sortBy === 'newest') {
                return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            }
            if (sortBy === 'oldest') {
                return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
            }
            // Priority sort is tricky because it's derived
            if (sortBy === 'priority') {
                const pA = projectPriorities.get(a.id) || 'Media';
                const pB = projectPriorities.get(b.id) || 'Media';
                const weight = { 'Critica': 4, 'Alta': 3, 'Media': 2, 'Bassa': 1 };
                return (weight[pB as keyof typeof weight] || 0) - (weight[pA as keyof typeof weight] || 0);
            }
            return 0;
        });

    }, [projects, showCompleted, searchQuery, statusFilter, sortBy, projectPriorities, clients, clientFilter, currentUser, tasks]);


    // Stats
    const stats = useMemo(() => {
        // Calcola stats BASATE SU TUTTI I PROGETTI (o filtrati? Di solito tutti quelli attivi)
        // I numeri nello screenshot sono alti, quindi presumo siano task o progetti.
        // "Priorità Critica 1", "Priorità Alta 23"... sembra riferirsi ai PROGETTI con quella priorità massima.

        // Filtriamo progetti non completati per le statistiche di rischio?
        const activeProjects = projects.filter(p => p.status !== 'Completato' && p.status !== 'Annullato');

        const counts = {
            Critica: 0,
            Alta: 0,
            Media: 0,
            Bassa: 0
        };

        activeProjects.forEach(p => {
            const prio = projectPriorities.get(p.id);
            if (prio && prio in counts) {
                counts[prio as keyof typeof counts]++;
            }
        });
        return counts;

    }, [projects, projectPriorities]);


    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Progetti</h1>
                    <p className="text-muted-foreground">Una vista d'insieme di tutti i tuoi progetti di marketing.</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                            Totale: {filteredProjects.length}
                        </Badge>
                        {stats.Critica > 0 && (
                            <Badge className="text-xs bg-red-500 hover:bg-red-600">
                                <CircleAlert className="h-3 w-3 mr-1" /> Critica: {stats.Critica}
                            </Badge>
                        )}
                        {stats.Alta > 0 && (
                            <Badge className="text-xs bg-orange-500 hover:bg-orange-600">
                                <ChevronUp className="h-3 w-3 mr-1" /> Alta: {stats.Alta}
                            </Badge>
                        )}
                        {stats.Media > 0 && (
                            <Badge className="text-xs bg-yellow-500 hover:bg-yellow-600 text-black">
                                <Minus className="h-3 w-3 mr-1" /> Media: {stats.Media}
                            </Badge>
                        )}
                        {stats.Bassa > 0 && (
                            <Badge className="text-xs bg-green-500 hover:bg-green-600">
                                <ChevronDown className="h-3 w-3 mr-1" /> Bassa: {stats.Bassa}
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Cerca..."
                            className="pl-8 w-full md:w-[200px] lg:w-[320px] rounded-full"
                            value={searchQuery}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button
                        variant="outline"
                        className="rounded-full"
                        onClick={handleAutoComplete}
                        disabled={isAutoCompleting}
                    >
                        {isAutoCompleting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                        )}
                        Completa Automatici
                    </Button>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={handleCreate} className="rounded-full">
                                <Plus className="mr-2 h-4 w-4" /> Nuovo Progetto
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>{editingProject ? 'Modifica Progetto' : 'Nuovo Progetto'}</DialogTitle>
                                <DialogDescription>
                                    Inserisci i dettagli del progetto qui sotto.
                                </DialogDescription>
                            </DialogHeader>
                            <ProjectForm
                                key={editingProject ? editingProject.id : 'new'}
                                project={editingProject}
                                onSuccess={() => setIsDialogOpen(false)}
                                onCancel={() => setIsDialogOpen(false)}
                            />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Filter Bar - Collapsible */}
            <Collapsible defaultOpen={false}>
                <Card className="rounded-xl shadow-sm glass-card bg-transparent">
                    <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-xl">
                            <CardTitle className="flex items-center gap-2 text-lg justify-between">
                                <span className="flex items-center gap-2"><Filter className="h-5 w-5" /> Filtri e Ordinamento</span>
                                <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                            </CardTitle>
                        </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="status-filter">Filtra per Stato</Label>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger id="status-filter">
                                        <SelectValue placeholder="Tutti gli stati" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tutti gli stati</SelectItem>
                                        <SelectItem value="Pianificazione">Pianificazione</SelectItem>
                                        <SelectItem value="In Corso">In Corso</SelectItem>
                                        <SelectItem value="In Pausa">In Pausa</SelectItem>
                                        <SelectItem value="In Revisione">In Revisione</SelectItem>
                                        <SelectItem value="Completato">Completato</SelectItem>
                                        <SelectItem value="Annullato">Annullato</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="client-filter">Filtra per Cliente</Label>
                                <Select value={clientFilter} onValueChange={setClientFilter}>
                                    <SelectTrigger id="client-filter">
                                        <SelectValue placeholder="Tutti i clienti" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tutti i clienti</SelectItem>
                                        {[...clients].sort((a, b) => a.name.localeCompare(b.name, 'it')).map((c: Client) => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="sort-by">Ordina per</Label>
                                <Select value={sortBy} onValueChange={setSortBy}>
                                    <SelectTrigger id="sort-by">
                                        <SelectValue placeholder="Ordina per" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="newest">Data creazione (recenti)</SelectItem>
                                        <SelectItem value="oldest">Data creazione (vecchi)</SelectItem>
                                        <SelectItem value="priority">Priorità</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-end">
                                <div className="flex items-center space-x-2">
                                    <Switch id="show-completed" checked={showCompleted} onCheckedChange={setShowCompleted} />
                                    <Label htmlFor="show-completed">Mostra completati</Label>
                                </div>
                            </div>
                        </CardContent>
                    </CollapsibleContent>
                </Card>
            </Collapsible>

            {/* Contatore Riepilogativo + View Toggle */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-sm">
                        Totale: {filteredProjects.length} progetti
                    </Badge>
                    {Object.entries(
                        filteredProjects.reduce((acc: Record<string, number>, p: Project) => {
                            acc[p.status] = (acc[p.status] || 0) + 1;
                            return acc;
                        }, {} as Record<string, number>)
                    ).map(([status, count]) => (
                        <Badge key={status} variant="secondary" className="text-xs">
                            {status}: {count}
                        </Badge>
                    ))}
                </div>
                <div className="flex gap-2">
                    <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('grid')} className="rounded-full" title="Griglia">
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('list')} className="rounded-full" title="Lista">
                        <List className="h-4 w-4" />
                    </Button>
                    <Button variant={viewMode === 'timeline' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('timeline')} className="rounded-full" title="Timeline">
                        <Clock className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Vista Timeline */}
            {viewMode === 'timeline' && (
                <TimelineView projects={filteredProjects} tasks={tasks} />
            )}

            {/* Vista Grid */}
            {viewMode === 'grid' && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredProjects.map((project: Project) => {
                        const projectTasks = tasks.filter((t: { projectId?: string }) => t.projectId === project.id);
                        const completedTasks = projectTasks.filter((t: { status: string }) => t.status === 'Approvato').length;
                        const progress = projectTasks.length > 0 ? Math.round((completedTasks / projectTasks.length) * 100) : 0;

                        return (
                            <Card
                                key={project.id}
                                className="rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer glass-card bg-transparent"
                                onClick={() => setPreviewProject(project)}
                            >
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <CardTitle className="text-lg line-clamp-1">{project.name}</CardTitle>
                                            <p className="text-sm text-muted-foreground">
                                                {clients.find((c: Client) => c.id === project.clientId)?.name || 'N/D'}
                                            </p>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); setPreviewProject(project); }}>
                                                    <Eye className="h-4 w-4 mr-2" /> Visualizza
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleEdit(project); }}>
                                                    <Pencil className="h-4 w-4 mr-2" /> Modifica
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); router.push(`/tasks?projectId=${project.id}`); }}>
                                                    <ExternalLink className="h-4 w-4 mr-2" /> Vai ai Task
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDelete(project); }}
                                                    className="text-destructive focus:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" /> Elimina
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        <Badge variant={
                                            project.status === 'Completato' ? 'default' :
                                                project.status === 'In Corso' ? 'secondary' :
                                                    project.status === 'In Pausa' ? 'outline' :
                                                        project.status === 'Annullato' ? 'destructive' : 'secondary'
                                        }>
                                            {project.status}
                                        </Badge>

                                        <div className="space-y-1">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Progresso Task</span>
                                                <span className="font-medium">{progress}% ({completedTasks}/{projectTasks.length})</span>
                                            </div>
                                            <Progress value={progress} className="h-2" />
                                        </div>

                                        {project.teamLeaderId && usersById[project.teamLeaderId] && (
                                            <div className="flex items-center gap-2 pt-2">
                                                <Avatar className="h-6 w-6">
                                                    <AvatarFallback style={{ backgroundColor: usersById[project.teamLeaderId].color }} className="text-xs text-white">
                                                        {usersById[project.teamLeaderId].name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm text-muted-foreground">{usersById[project.teamLeaderId].name}</span>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                    {filteredProjects.length === 0 && (
                        <div className="col-span-full text-center py-10 text-muted-foreground">
                            Nessun progetto trovato.
                        </div>
                    )}
                </div>
            )}

            {/* Vista Lista */}
            {viewMode === 'list' && (
                <Card className="rounded-xl glass-card bg-transparent">
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Stato</TableHead>
                                    <TableHead>Progresso</TableHead>
                                    <TableHead>Team Leader</TableHead>
                                    <TableHead>Data Inizio</TableHead>
                                    <TableHead>Data Fine</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProjects.map((project: Project) => {
                                    const projectTasks = tasks.filter((t: { projectId?: string }) => t.projectId === project.id);
                                    const completedTasks = projectTasks.filter((t: { status: string }) => t.status === 'Approvato').length;
                                    const progress = projectTasks.length > 0 ? Math.round((completedTasks / projectTasks.length) * 100) : 0;
                                    const client = clients.find((c: Client) => c.id === project.clientId);
                                    const teamLeader = project.teamLeaderId ? usersById[project.teamLeaderId] : null;

                                    return (
                                        <TableRow
                                            key={project.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => setPreviewProject(project)}
                                        >
                                            <TableCell className="font-medium">{project.name}</TableCell>
                                            <TableCell>{client?.name || 'N/D'}</TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    project.status === 'Completato' ? 'default' :
                                                        project.status === 'In Corso' ? 'secondary' :
                                                            project.status === 'In Pausa' ? 'outline' :
                                                                project.status === 'Annullato' ? 'destructive' : 'secondary'
                                                }>
                                                    {project.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Progress value={progress} className="h-2 w-16" />
                                                    <span className="text-sm text-muted-foreground">{progress}%</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {teamLeader ? (
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-6 w-6">
                                                            <AvatarFallback style={{ backgroundColor: teamLeader.color }} className="text-xs text-white">
                                                                {teamLeader.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-sm">{teamLeader.name.split(' ')[0]}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {project.startDate ? format(new Date(project.startDate), 'dd MMM yyyy', { locale: it }) : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {project.endDate ? format(new Date(project.endDate), 'dd MMM yyyy', { locale: it }) : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); setPreviewProject(project); }}>
                                                            <Eye className="h-4 w-4 mr-2" /> Visualizza
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleEdit(project); }}>
                                                            <Pencil className="h-4 w-4 mr-2" /> Modifica
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); router.push(`/tasks?projectId=${project.id}`); }}>
                                                            <ExternalLink className="h-4 w-4 mr-2" /> Vai ai Task
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDelete(project); }}
                                                            className="text-destructive focus:text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" /> Elimina
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {filteredProjects.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                                            Nessun progetto trovato.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Dialog Preview Progetto */}
            <Dialog open={!!previewProject} onOpenChange={(isOpen: boolean) => !isOpen && setPreviewProject(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                    <DialogHeader className="flex-shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <FolderKanban className="h-6 w-6 text-primary" />
                            {previewProject?.name}
                        </DialogTitle>
                        <DialogDescription>
                            Dettagli del progetto
                        </DialogDescription>
                    </DialogHeader>

                    {previewProject && (
                        <div className="flex-1 overflow-y-auto mt-4 pr-2 min-h-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                                {/* Colonna Sinistra - Info Principali */}
                                <div className="space-y-4">
                                    {/* Stato e Cliente */}
                                    <Card className="glass-card bg-transparent">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm">Informazioni Generali</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
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
                                            <Separator />
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Cliente</span>
                                                <span className="font-medium">{clients.find((c: Client) => c.id === previewProject.clientId)?.name || 'N/D'}</span>
                                            </div>
                                            <Separator />
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Data Inizio</span>
                                                <span className="font-medium">
                                                    {previewProject.startDate ? format(new Date(previewProject.startDate), 'dd MMM yyyy', { locale: it }) : 'N/D'}
                                                </span>
                                            </div>
                                            <Separator />
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Data Fine</span>
                                                <span className="font-medium">
                                                    {previewProject.endDate ? format(new Date(previewProject.endDate), 'dd MMM yyyy', { locale: it }) : 'N/D'}
                                                </span>
                                            </div>
                                            {previewProject.budget !== undefined && previewProject.budget > 0 && (
                                                <>
                                                    <Separator />
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm text-muted-foreground">Budget</span>
                                                        <span className="font-medium">€{previewProject.budget.toLocaleString('it-IT')}</span>
                                                    </div>
                                                </>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Team Leader */}
                                    {previewProject.teamLeaderId && usersById[previewProject.teamLeaderId] && (
                                        <Card className="glass-card bg-transparent">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm">Team Leader</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10">
                                                        <AvatarFallback style={{ backgroundColor: usersById[previewProject.teamLeaderId].color }} className="text-sm text-white">
                                                            {usersById[previewProject.teamLeaderId].name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-medium">{usersById[previewProject.teamLeaderId].name}</p>
                                                        <p className="text-sm text-muted-foreground">{usersById[previewProject.teamLeaderId].role || 'Team Leader'}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* Descrizione e Note */}
                                    {(previewProject.description || previewProject.notes) && (
                                        <Card className="glass-card bg-transparent">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm">Descrizione e Note</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                {previewProject.description && (
                                                    <div>
                                                        <span className="text-xs text-muted-foreground block mb-1">Descrizione</span>
                                                        <p className="text-sm whitespace-pre-wrap max-h-[120px] overflow-y-auto">{previewProject.description}</p>
                                                    </div>
                                                )}
                                                {previewProject.description && previewProject.notes && <Separator />}
                                                {previewProject.notes && (
                                                    <div>
                                                        <span className="text-xs text-muted-foreground block mb-1">Note</span>
                                                        <p className="text-sm whitespace-pre-wrap bg-secondary/50 p-2 rounded-md max-h-[100px] overflow-y-auto">{previewProject.notes}</p>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>

                                {/* Colonna Destra - Progresso e Task */}
                                <div className="space-y-4">
                                    {/* Health Indicator + Timeline */}
                                    <Card className="glass-card bg-transparent">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm flex items-center justify-between">
                                                <span>Stato del Progetto</span>
                                                {(() => {
                                                    const projectTasks = tasks.filter((t: { projectId?: string }) => t.projectId === previewProject.id);
                                                    const completedTasks = projectTasks.filter((t: { status: string }) => t.status === 'Approvato').length;
                                                    const progress = projectTasks.length > 0 ? Math.round((completedTasks / projectTasks.length) * 100) : 0;

                                                    // Calculate time progress
                                                    const now = new Date();
                                                    const start = previewProject.startDate ? new Date(previewProject.startDate) : now;
                                                    const end = previewProject.endDate ? new Date(previewProject.endDate) : now;
                                                    const totalDays = Math.max((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24), 1);
                                                    const elapsedDays = Math.max((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24), 0);
                                                    const timeProgress = Math.min(Math.round((elapsedDays / totalDays) * 100), 100);
                                                    const daysLeft = Math.max(Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)), 0);

                                                    // Health: Green if progress >= time, Yellow if behind by <20%, Red if behind by >20%
                                                    let health: 'green' | 'yellow' | 'red' = 'green';
                                                    if (previewProject.status === 'Completato') health = 'green';
                                                    else if (previewProject.status === 'Annullato') health = 'red';
                                                    else if (progress < timeProgress - 20) health = 'red';
                                                    else if (progress < timeProgress) health = 'yellow';

                                                    return (
                                                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${health === 'green' ? 'bg-emerald-500/20 text-emerald-600' :
                                                            health === 'yellow' ? 'bg-amber-500/20 text-amber-600' :
                                                                'bg-red-500/20 text-red-600'
                                                            }`}>
                                                            <div className={`w-2 h-2 rounded-full ${health === 'green' ? 'bg-emerald-500' :
                                                                health === 'yellow' ? 'bg-amber-500' :
                                                                    'bg-red-500'
                                                                }`} />
                                                            {health === 'green' ? 'In linea' : health === 'yellow' ? 'A rischio' : 'In ritardo'}
                                                        </div>
                                                    );
                                                })()}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {/* Task Progress */}
                                            {(() => {
                                                const projectTasks = tasks.filter((t: { projectId?: string }) => t.projectId === previewProject.id);
                                                const completedTasks = projectTasks.filter((t: { status: string }) => t.status === 'Approvato').length;
                                                const inProgressTasks = projectTasks.filter((t: { status: string }) => t.status === 'In Lavorazione').length;
                                                const todoTasks = projectTasks.filter((t: { status: string }) => t.status === 'Da Fare').length;
                                                const progress = projectTasks.length > 0 ? Math.round((completedTasks / projectTasks.length) * 100) : 0;

                                                return (
                                                    <div>
                                                        <div className="flex justify-between text-sm mb-2">
                                                            <span className="text-muted-foreground">Completamento Task</span>
                                                            <span className="font-bold text-lg">{progress}%</span>
                                                        </div>
                                                        <Progress value={progress} className="h-3" />
                                                        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                                                            <span>✓ {completedTasks} completati</span>
                                                            <span>⏳ {inProgressTasks} in corso</span>
                                                            <span>📋 {todoTasks} da fare</span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Timeline Visual */}
                                            {previewProject.startDate && previewProject.endDate && (
                                                <div className="pt-2 border-t">
                                                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                                        <span>{format(new Date(previewProject.startDate), 'dd MMM', { locale: it })}</span>
                                                        <span className="font-medium text-foreground">
                                                            {(() => {
                                                                const now = new Date();
                                                                const end = new Date(previewProject.endDate);
                                                                const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                                                if (daysLeft < 0) return `Scaduto da ${Math.abs(daysLeft)} giorni`;
                                                                if (daysLeft === 0) return 'Scade oggi!';
                                                                if (daysLeft === 1) return '1 giorno rimasto';
                                                                return `${daysLeft} giorni rimasti`;
                                                            })()}
                                                        </span>
                                                        <span>{format(new Date(previewProject.endDate), 'dd MMM', { locale: it })}</span>
                                                    </div>
                                                    <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                                                        {(() => {
                                                            const now = new Date();
                                                            const start = new Date(previewProject.startDate);
                                                            const end = new Date(previewProject.endDate);
                                                            const totalDays = Math.max((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24), 1);
                                                            const elapsedDays = Math.max((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24), 0);
                                                            const timeProgress = Math.min(Math.round((elapsedDays / totalDays) * 100), 100);
                                                            return (
                                                                <>
                                                                    <div
                                                                        className="absolute h-full bg-primary/30 rounded-full"
                                                                        style={{ width: `${timeProgress}%` }}
                                                                    />
                                                                    <div
                                                                        className="absolute w-1 h-full bg-primary rounded-full"
                                                                        style={{ left: `${Math.min(timeProgress, 99)}%` }}
                                                                    />
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground text-center mt-1">Timeline temporale</p>
                                                </div>
                                            )}

                                            {/* Team Members */}
                                            {(() => {
                                                const projectTasks = tasks.filter((t: { projectId?: string }) => t.projectId === previewProject.id);
                                                const teamMemberIds = new Set<string>();
                                                if (previewProject.teamLeaderId) teamMemberIds.add(previewProject.teamLeaderId);
                                                projectTasks.forEach((t: { assignedUserId?: string }) => {
                                                    if (t.assignedUserId) teamMemberIds.add(t.assignedUserId);
                                                });
                                                const teamMembers = Array.from(teamMemberIds).map(id => usersById[id]).filter(Boolean);

                                                if (teamMembers.length === 0) return null;

                                                return (
                                                    <div className="pt-2 border-t">
                                                        <p className="text-xs text-muted-foreground mb-2">Team ({teamMembers.length} persone)</p>
                                                        <div className="flex -space-x-2">
                                                            {teamMembers.slice(0, 6).map((user: any) => (
                                                                <TooltipProvider key={user.id}>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Avatar className="h-8 w-8 border-2 border-background cursor-pointer">
                                                                                <AvatarFallback style={{ backgroundColor: user.color }} className="text-xs text-white">
                                                                                    {user.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                                                                </AvatarFallback>
                                                                            </Avatar>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>{user.name}</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            ))}
                                                            {teamMembers.length > 6 && (
                                                                <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                                                                    +{teamMembers.length - 6}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </CardContent>
                                    </Card>

                                    {/* Lista Task */}
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm flex items-center justify-between">
                                                <span>Task del Progetto</span>
                                                <Badge variant="outline" className="text-xs">
                                                    {tasks.filter((t: { projectId?: string }) => t.projectId === previewProject.id).length}
                                                </Badge>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {(() => {
                                                const projectTasks = tasks.filter((t: { projectId?: string }) => t.projectId === previewProject.id);
                                                if (projectTasks.length === 0) {
                                                    return <p className="text-sm text-muted-foreground text-center py-4">Nessun task</p>;
                                                }

                                                const statusColorMap: Record<string, string> = {
                                                    'Da Fare': 'bg-gray-500',
                                                    'In Lavorazione': 'bg-primary',
                                                    'In Approvazione': 'bg-orange-500',
                                                    'In Approvazione Cliente': 'bg-purple-500',
                                                    'Approvato': 'bg-emerald-500',
                                                    'Annullato': 'bg-slate-500',
                                                };
                                                const priorityColorMap: Record<string, string> = {
                                                    'Critica': 'text-red-500',
                                                    'Alta': 'text-orange-500',
                                                    'Media': 'text-yellow-500',
                                                    'Bassa': 'text-green-500',
                                                };

                                                return (
                                                    <div className="space-y-2 max-h-[250px] overflow-y-auto">
                                                        {projectTasks.map((task: { id: string; title: string; status: string; priority: string; assignedUserId?: string }) => {
                                                            const assignee = task.assignedUserId ? usersById[task.assignedUserId] : null;
                                                            return (
                                                                <div
                                                                    key={task.id}
                                                                    className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                                                                    onClick={() => {
                                                                        router.push(`/tasks?taskId=${task.id}`);
                                                                        setPreviewProject(null);
                                                                    }}
                                                                >
                                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColorMap[task.status] || 'bg-gray-400'}`} />
                                                                        <span className="text-sm truncate">{task.title}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                                                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityColorMap[task.priority] || ''}`}>
                                                                            {task.priority}
                                                                        </Badge>
                                                                        {assignee && (
                                                                            <Avatar className="h-5 w-5">
                                                                                <AvatarFallback style={{ backgroundColor: assignee.color }} className="text-[10px] text-white">
                                                                                    {assignee.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                                                                </AvatarFallback>
                                                                            </Avatar>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
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
                                        handleEdit(previewProject);
                                        setPreviewProject(null);
                                    }}
                                >
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Modifica Progetto
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={() => {
                                        router.push(`/tasks?projectId=${previewProject.id}`);
                                        setPreviewProject(null);
                                    }}
                                >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Vai ai Task
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* DELETE CONFIRMATION DIALOG */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Elimina Progetto
                        </DialogTitle>
                        <DialogDescription>
                            Stai per eliminare il progetto "{projectToDelete?.name}". Questa azione non può essere annullata.
                        </DialogDescription>
                    </DialogHeader>

                    {projectToDelete && getProjectTaskCount(projectToDelete.id) > 0 && (
                        <div className="py-4">
                            <div className="flex items-center space-x-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                                <Checkbox
                                    id="deleteRelatedTasks"
                                    checked={deleteRelatedTasks}
                                    onCheckedChange={(checked) => setDeleteRelatedTasks(checked as boolean)}
                                />
                                <label
                                    htmlFor="deleteRelatedTasks"
                                    className="text-sm cursor-pointer"
                                >
                                    Elimina anche i <strong>{getProjectTaskCount(projectToDelete.id)} task</strong> collegati a questo progetto
                                </label>
                            </div>
                            {!deleteRelatedTasks && (
                                <p className="text-xs text-muted-foreground mt-2 pl-1">
                                    ⚠️ I task rimarranno orfani (senza progetto associato)
                                </p>
                            )}
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setIsDeleteDialogOpen(false)}
                            disabled={isDeleting}
                        >
                            Annulla
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Eliminando...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Elimina
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
