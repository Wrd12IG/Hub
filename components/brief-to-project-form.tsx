'use client';

import React, { useState, useMemo } from 'react';
import { Brief, Project, BriefService, BriefServiceCategory } from '@/lib/data';
import { addProject, addTask } from '@/lib/actions';
import { useLayoutData } from '@/app/(app)/layout-context';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarIcon, Loader2, FolderPlus, ListTodo, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

interface BriefToProjectFormProps {
    brief: Brief;
    services: BriefService[];
    categories: BriefServiceCategory[];
    onSuccess: () => void;
    onCancel: () => void;
}

export default function BriefToProjectForm({
    brief,
    services,
    categories,
    onSuccess,
    onCancel
}: BriefToProjectFormProps) {
    const { clients, users, currentUser, refetchData } = useLayoutData();

    // Project Form State
    const [projectName, setProjectName] = useState(brief.projectName || brief.title || '');
    const [projectDescription, setProjectDescription] = useState(brief.mainObjective || '');
    const [projectBudget, setProjectBudget] = useState<number | undefined>(brief.budget);
    const [projectEndDate, setProjectEndDate] = useState<string | undefined>(brief.deadline);
    const [projectPriority, setProjectPriority] = useState<string>('Media');

    // Task Selection State - initially all services are selected
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>(brief.selectedServiceIds || []);
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Group services by category
    const groupedServices = useMemo(() => {
        return categories.map(cat => ({
            ...cat,
            services: services.filter(s =>
                s.categoryId === cat.id &&
                (brief.selectedServiceIds || []).includes(s.id)
            )
        })).filter(group => group.services.length > 0);
    }, [categories, services, brief.selectedServiceIds]);

    const toggleTask = (serviceId: string) => {
        setSelectedTaskIds(prev =>
            prev.includes(serviceId)
                ? prev.filter(id => id !== serviceId)
                : [...prev, serviceId]
        );
    };

    const selectAllTasks = () => {
        setSelectedTaskIds(brief.selectedServiceIds || []);
    };

    const deselectAllTasks = () => {
        setSelectedTaskIds([]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!projectName || !brief.clientId) {
            toast.error("Nome progetto e Cliente sono obbligatori.");
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Create the Project
            const projectData = {
                name: projectName,
                description: projectDescription,
                clientId: brief.clientId,
                status: 'Pianificazione',
                budget: projectBudget,
                endDate: projectEndDate,
                priority: projectPriority,
                progress: 0,
                notes: `📋 Creato dal Brief: ${brief.projectName}\n\n🎯 Tono: ${brief.toneOfVoice || 'N/A'}\n🎨 Stile: ${brief.stylePreferences || 'N/A'}`,
                createdAt: new Date().toISOString(),
            };

            // Remove undefined values
            Object.keys(projectData).forEach(key => {
                if ((projectData as any)[key] === undefined) {
                    delete (projectData as any)[key];
                }
            });

            const projectId = await addProject(projectData as any);

            // 2. Create selected Tasks linked to the project
            let tasksCreated = 0;
            const creatorId = currentUser?.id || '';

            for (const serviceId of selectedTaskIds) {
                const service = services.find(s => s.id === serviceId);
                if (service) {
                    const taskData = {
                        title: service.name,
                        description: `🎯 Obiettivo: ${brief.mainObjective || 'N/A'}\n\n💬 Messaggi chiave: ${brief.keyMessages || 'N/A'}`,
                        status: 'Da Fare',
                        priority: projectPriority,
                        clientId: brief.clientId,
                        projectId: projectId,
                        dueDate: brief.deadline,
                        estimatedDuration: 60,
                        timeSpent: 0,
                    };
                    await addTask(taskData as any, creatorId);
                    tasksCreated++;
                }
            }

            // 3. Refresh data
            await refetchData('projects');
            await refetchData('tasks');

            toast.success(
                tasksCreated > 0
                    ? `Progetto creato con ${tasksCreated} task!`
                    : 'Progetto creato con successo!'
            );
            onSuccess();
        } catch (error) {
            console.error(error);
            toast.error("Errore nella creazione.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const clientName = clients.find(c => c.id === brief.clientId)?.name || 'Cliente sconosciuto';

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* PROJECT DETAILS */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <FolderPlus className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Dettagli Progetto</h3>
                </div>

                <div className="grid gap-4">
                    <div className="space-y-2">
                        <Label>Nome Progetto *</Label>
                        <Input
                            value={projectName}
                            onChange={e => setProjectName(e.target.value)}
                            placeholder="Nome del progetto"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Descrizione</Label>
                        <Textarea
                            value={projectDescription}
                            onChange={e => setProjectDescription(e.target.value)}
                            className="min-h-[80px]"
                            placeholder="Descrizione del progetto"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Cliente</Label>
                            <Input value={clientName} disabled className="bg-muted" />
                        </div>
                        <div className="space-y-2">
                            <Label>Priorità</Label>
                            <div className="flex gap-2">
                                {['Bassa', 'Media', 'Alta', 'Critica'].map(p => (
                                    <Button
                                        key={p}
                                        type="button"
                                        variant={projectPriority === p ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setProjectPriority(p)}
                                    >
                                        {p}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Budget (€)</Label>
                            <Input
                                type="number"
                                value={projectBudget || ''}
                                onChange={e => setProjectBudget(e.target.value ? parseFloat(e.target.value) : undefined)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Data Scadenza</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !projectEndDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {projectEndDate
                                            ? format(new Date(projectEndDate), "PPP", { locale: it })
                                            : <span>Seleziona data</span>
                                        }
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={projectEndDate ? new Date(projectEndDate) : undefined}
                                        onSelect={(d) => setProjectEndDate(d?.toISOString())}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </div>
            </div>

            <Separator />

            {/* SUGGESTED TASKS */}
            <Collapsible open={isSuggestionsOpen} onOpenChange={setIsSuggestionsOpen}>
                <div className="space-y-4">
                    <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-yellow-500" />
                                <h3 className="text-lg font-semibold">Task Suggeriti dal Brief</h3>
                                <Badge variant="secondary" className="ml-2">
                                    {selectedTaskIds.length}/{(brief.selectedServiceIds || []).length} selezionati
                                </Badge>
                            </div>
                            {isSuggestionsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                        <Card className="border-dashed border-yellow-400/50 bg-yellow-50/30 dark:bg-yellow-900/10">
                            <CardContent className="pt-4 space-y-4">
                                <CardDescription>
                                    Seleziona i servizi del brief da convertire in task.
                                </CardDescription>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={selectAllTasks}>
                                        Seleziona tutti
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" onClick={deselectAllTasks}>
                                        Deseleziona tutti
                                    </Button>
                                </div>

                                {groupedServices.map(category => (
                                    <div key={category.id} className="space-y-2">
                                        <h4 className="font-medium text-sm text-muted-foreground">{category.name}</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-2">
                                            {category.services.map(service => (
                                                <label
                                                    key={service.id}
                                                    className={cn(
                                                        "flex items-center space-x-3 p-2 rounded-lg border transition-colors cursor-pointer",
                                                        selectedTaskIds.includes(service.id)
                                                            ? "bg-primary/10 border-primary/30"
                                                            : "bg-background hover:bg-muted/50"
                                                    )}
                                                >
                                                    <Checkbox
                                                        checked={selectedTaskIds.includes(service.id)}
                                                        onCheckedChange={() => toggleTask(service.id)}
                                                    />
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <ListTodo className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm">{service.name}</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {groupedServices.length === 0 && (
                                    <p className="text-center text-muted-foreground py-4">
                                        Nessun servizio selezionato nel brief.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </CollapsibleContent>
                </div>
            </Collapsible>

            {/* SUBMIT BUTTONS */}
            <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-background py-4">
                <Button type="button" variant="outline" onClick={onCancel}>
                    Annulla
                </Button>
                <Button type="submit" disabled={isSubmitting} className="min-w-[160px]">
                    {isSubmitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <FolderPlus className="mr-2 h-4 w-4" />
                    )}
                    Crea Progetto {selectedTaskIds.length > 0 && `+ ${selectedTaskIds.length} Task`}
                </Button>
            </div>
        </form>
    );
}
