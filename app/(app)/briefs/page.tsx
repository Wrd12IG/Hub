'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useLayoutData } from '@/app/(app)/layout-context';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Filter, ChevronUp, ChevronDown, PlusCircle, BookOpen, Search, Eraser, Loader2, MoreHorizontal, FolderPlus, ListTodo, Eye, Trash2 } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

import { Brief, Project, Task } from '@/lib/data';
import { getBriefs, deleteBrief } from '@/lib/actions';
import BriefForm from '@/components/brief-form';
import BriefToProjectForm from '@/components/brief-to-project-form';
import TaskForm from '@/components/task-form';

export default function BriefsPage() {
    const { clients, currentUser, briefServices, briefServiceCategories, refetchData: refetchLayoutData } = useLayoutData();
    const [briefs, setBriefs] = useState<Brief[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isFiltersOpen, setIsFiltersOpen] = useState(true);

    // Modal States
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingBrief, setEditingBrief] = useState<Brief | undefined>(undefined);

    // Project Form Modal State (with brief context)
    const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
    const [selectedBriefForProject, setSelectedBriefForProject] = useState<Brief | null>(null);

    // Task Form Modal State (with pre-filled data)
    const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
    const [prefilledTask, setPrefilledTask] = useState<Task | null>(null);
    const [taskDefaultClientId, setTaskDefaultClientId] = useState<string | undefined>(undefined);

    // Service selection for task creation
    const [isServiceSelectorOpen, setIsServiceSelectorOpen] = useState(false);
    const [selectedBriefForTasks, setSelectedBriefForTasks] = useState<Brief | null>(null);

    // Filter State
    const [filters, setFilters] = useState({
        query: '',
        clientId: 'all',
        status: 'all',
    });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const data = await getBriefs();
            setBriefs(data);
        } catch (error) {
            console.error("Failed to fetch briefs", error);
            toast.error("Errore nel caricamento dei brief.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleFilterChange = (key: string, value: any) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const resetFilters = () => {
        setFilters({
            query: '',
            clientId: 'all',
            status: 'all',
        });
    };

    const filteredBriefs = useMemo(() => {
        return briefs.filter(brief => {
            const matchesQuery = (brief.projectName || brief.title).toLowerCase().includes(filters.query.toLowerCase());
            const matchesClient = filters.clientId === 'all' || brief.clientId === filters.clientId;
            const matchesStatus = filters.status === 'all' || brief.status === filters.status;
            return matchesQuery && matchesClient && matchesStatus;
        });
    }, [briefs, filters]);

    const handleEdit = (brief: Brief) => {
        setEditingBrief(brief);
        setIsCreateModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsCreateModalOpen(false);
        setEditingBrief(undefined);
    };

    // ----------------------
    // DELETE BRIEF
    // ----------------------
    const handleDeleteBrief = async (brief: Brief) => {
        if (!confirm(`Sei sicuro di voler eliminare il brief "${brief.projectName || brief.title}"? Questa azione non può essere annullata.`)) {
            return;
        }

        try {
            await deleteBrief(brief.id);
            toast.success('Brief eliminato con successo');
            fetchData();
        } catch (error) {
            console.error('Failed to delete brief:', error);
            toast.error('Errore durante l\'eliminazione del brief');
        }
    };

    // ----------------------
    // OPEN PROJECT FORM PRE-FILLED
    // ----------------------
    const openProjectFormFromBrief = (brief: Brief) => {
        setSelectedBriefForProject(brief);
        setIsProjectFormOpen(true);
    };

    // ----------------------
    // OPEN TASK FORM PRE-FILLED (from service selection)
    // ----------------------
    const openServiceSelector = (brief: Brief) => {
        setSelectedBriefForTasks(brief);
        setIsServiceSelectorOpen(true);
    };

    const openTaskFormFromService = (serviceId: string) => {
        if (!selectedBriefForTasks) return;

        const service = briefServices.find(s => s.id === serviceId);
        if (!service) return;

        // Create a "fake" task object with data from the brief + service
        const taskData: Task = {
            id: '', // Empty = new task
            title: service.name,
            description: `Attività per: ${selectedBriefForTasks.projectName}\n\n📋 Obiettivo: ${selectedBriefForTasks.mainObjective || 'N/A'}\n\n💬 Messaggi chiave: ${selectedBriefForTasks.keyMessages || 'N/A'}\n\n🎨 Stile: ${selectedBriefForTasks.stylePreferences || 'N/A'}\n\n📐 Formato: ${selectedBriefForTasks.formatDimensions || 'N/A'}`,
            status: 'Da Fare',
            priority: 'Media',
            clientId: selectedBriefForTasks.clientId,
            dueDate: selectedBriefForTasks.deadline,
            estimatedDuration: 60,
            timeSpent: 0,
        };

        setPrefilledTask(taskData);
        setTaskDefaultClientId(selectedBriefForTasks.clientId);
        setIsServiceSelectorOpen(false);
        setIsTaskFormOpen(true);
    };

    // Group services by category for selection modal
    const groupedServicesForModal = useMemo(() => {
        if (!selectedBriefForTasks) return [];
        return briefServiceCategories.map(cat => ({
            ...cat,
            services: briefServices.filter(s =>
                s.categoryId === cat.id &&
                (selectedBriefForTasks.selectedServiceIds || []).includes(s.id)
            )
        })).filter(group => group.services.length > 0);
    }, [selectedBriefForTasks, briefServices, briefServiceCategories]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
                        <BookOpen className="h-8 w-8 text-primary" />
                        Briefs
                    </h1>
                    <p className="text-muted-foreground">
                        Gestisci e monitora i brief di progetto.
                    </p>
                </div>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nuovo Brief
                </Button>
            </div>

            <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
                <Card>
                    <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <CardTitle className="flex items-center gap-2">
                                        <Filter className="h-5 w-5" /> Filtri
                                    </CardTitle>
                                    {isFiltersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </div>
                                {isFiltersOpen && <CardDescription>Affina la ricerca dei briefs.</CardDescription>}
                                {!isFiltersOpen && <CardDescription>{filteredBriefs.length} briefs visualizzati</CardDescription>}
                            </div>
                        </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end border-t pt-6">
                            <div>
                                <Label>Ricerca</Label>
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Cerca per progetto/titolo..."
                                        className="pl-8"
                                        value={filters.query}
                                        onChange={e => handleFilterChange('query', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Cliente</Label>
                                <Select value={filters.clientId} onValueChange={v => handleFilterChange('clientId', v)}>
                                    <SelectTrigger><SelectValue placeholder="Seleziona cliente" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tutti i clienti</SelectItem>
                                        {[...clients].sort((a, b) => a.name.localeCompare(b.name, 'it')).map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Stato</Label>
                                <Select value={filters.status} onValueChange={v => handleFilterChange('status', v)}>
                                    <SelectTrigger><SelectValue placeholder="Seleziona stato" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tutti gli stati</SelectItem>
                                        <SelectItem value="Bozza">Bozza</SelectItem>
                                        <SelectItem value="Inviato">Inviato</SelectItem>
                                        <SelectItem value="In Revisione">In Revisione</SelectItem>
                                        <SelectItem value="Approvato">Approvato</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end gap-2">
                                <Button variant="ghost" onClick={resetFilters} className="w-full text-red-500 font-bold justify-start px-2">
                                    <Eraser className="mr-2 h-4 w-4" />
                                    Reset
                                </Button>
                            </div>
                        </CardContent>
                    </CollapsibleContent>
                </Card>
            </Collapsible>

            <Card>
                <CardHeader>
                    <CardTitle>Elenco Briefs</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : filteredBriefs.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Progetto</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Servizi</TableHead>
                                    <TableHead>Stato</TableHead>
                                    <TableHead>Deadline</TableHead>
                                    <TableHead className="text-right">Azioni</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredBriefs.map(brief => (
                                    <TableRow key={brief.id} className="group">
                                        <TableCell className="font-medium">
                                            <div>{brief.projectName}</div>
                                            <div className="text-xs text-muted-foreground">{brief.contactPerson}</div>
                                        </TableCell>
                                        <TableCell>{clients.find(c => c.id === brief.clientId)?.name || 'Sconosciuto'}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">
                                                {(brief.selectedServiceIds || []).length} servizi
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                brief.status === 'Approvato' ? 'default' :
                                                    brief.status === 'Inviato' ? 'secondary' :
                                                        'outline'
                                            }>
                                                {brief.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{brief.deadline ? new Date(brief.deadline).toLocaleDateString() : '-'}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleEdit(brief)}>
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        Visualizza/Modifica
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => openProjectFormFromBrief(brief)}>
                                                        <FolderPlus className="mr-2 h-4 w-4" />
                                                        Crea Progetto
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => openServiceSelector(brief)}>
                                                        <ListTodo className="mr-2 h-4 w-4" />
                                                        Crea Task
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => handleDeleteBrief(brief)}
                                                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Elimina
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <BookOpen className="mx-auto h-12 w-12 opacity-20 mb-4" />
                            <p>Nessun brief trovato.</p>
                            <Button variant="link" onClick={() => setIsCreateModalOpen(true)}>Crea il primo brief</Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* BRIEF EDIT/CREATE MODAL */}
            <Dialog open={isCreateModalOpen} onOpenChange={handleCloseModal}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingBrief ? 'Modifica Brief' : 'Crea un Nuovo Brief'}</DialogTitle>
                        <DialogDescription>
                            {editingBrief ? 'Modifica i dettagli del brief esistente.' : 'Compila i campi per avviare un nuovo progetto per conto di un cliente.'}
                        </DialogDescription>
                    </DialogHeader>
                    <BriefForm
                        clients={clients}
                        currentUser={currentUser}
                        services={briefServices}
                        categories={briefServiceCategories}
                        onSuccess={() => {
                            handleCloseModal();
                            fetchData();
                        }}
                        onCancel={handleCloseModal}
                        initialData={editingBrief}
                    />
                </DialogContent>
            </Dialog>

            {/* PROJECT FORM WITH SUGGESTED TASKS (from Brief) */}
            <Dialog open={isProjectFormOpen} onOpenChange={setIsProjectFormOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FolderPlus className="h-5 w-5" />
                            Crea Progetto da Brief
                        </DialogTitle>
                        <DialogDescription>
                            Crea il progetto e seleziona i task da generare automaticamente.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedBriefForProject && (
                        <BriefToProjectForm
                            brief={selectedBriefForProject}
                            services={briefServices}
                            categories={briefServiceCategories}
                            onSuccess={() => {
                                setIsProjectFormOpen(false);
                                setSelectedBriefForProject(null);
                            }}
                            onCancel={() => {
                                setIsProjectFormOpen(false);
                                setSelectedBriefForProject(null);
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* SERVICE SELECTOR MODAL */}
            <Dialog open={isServiceSelectorOpen} onOpenChange={setIsServiceSelectorOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ListTodo className="h-5 w-5" />
                            Seleziona Servizio per Task
                        </DialogTitle>
                        <DialogDescription>
                            Scegli un servizio dal brief per creare il task corrispondente.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
                        {groupedServicesForModal.length > 0 ? (
                            groupedServicesForModal.map(category => (
                                <div key={category.id} className="space-y-2">
                                    <h4 className="font-medium text-sm text-muted-foreground">{category.name}</h4>
                                    <div className="grid gap-2 pl-2">
                                        {category.services.map(service => (
                                            <Button
                                                key={service.id}
                                                variant="outline"
                                                className="justify-start text-left h-auto py-3"
                                                onClick={() => openTaskFormFromService(service.id)}
                                            >
                                                <ListTodo className="mr-2 h-4 w-4 flex-shrink-0" />
                                                <span>{service.name}</span>
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-muted-foreground py-4">
                                Nessun servizio selezionato nel brief.
                            </p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* TASK FORM MODAL (Pre-filled from Brief + Service) */}
            <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ListTodo className="h-5 w-5" />
                            Crea Task da Brief
                        </DialogTitle>
                        <DialogDescription>
                            I campi sono pre-compilati dal brief. Completa e modifica come preferisci.
                        </DialogDescription>
                    </DialogHeader>
                    <TaskForm
                        task={prefilledTask}
                        defaultClientId={taskDefaultClientId}
                        onSuccess={() => {
                            setIsTaskFormOpen(false);
                            setPrefilledTask(null);
                            setTaskDefaultClientId(undefined);
                            refetchLayoutData('tasks');
                            toast.success("Task creato con successo!");
                        }}
                        onCancel={() => {
                            setIsTaskFormOpen(false);
                            setPrefilledTask(null);
                            setTaskDefaultClientId(undefined);
                        }}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
