"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { CalendarIcon, Pencil, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { useLayoutData } from "@/app/(app)/layout-context"
import { Project, Task } from "@/lib/data"
import { addProject, updateProject, updateTask } from "@/lib/actions"
import { useToast } from "@/hooks/use-toast"
import TaskForm from "@/components/task-form"
import DatePickerDialog from "@/components/ui/date-picker-dialog"

const formSchema = z.object({
    name: z.string().min(2, {
        message: "Il nome deve essere di almeno 2 caratteri.",
    }),
    description: z.string().optional(),
    status: z.enum(['Pianificazione', 'In Corso', 'In Pausa', 'In Revisione', 'Completato', 'Annullato']),
    clientId: z.string().min(1, "Seleziona un cliente"),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    budget: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
        message: "Inserisci un budget valido.",
    }),
    priority: z.enum(['Bassa', 'Media', 'Alta', 'Critica']).optional(),
    teamLeaderId: z.string().optional(),
    notes: z.string().optional(),
})

interface ProjectFormProps {
    project?: Project | null
    onSuccess?: () => void
    onCancel?: () => void
}

export default function ProjectForm({ project, onSuccess, onCancel }: ProjectFormProps) {
    const { clients, users, allTasks, currentUser } = useLayoutData()
    const { toast } = useToast()
    const [isLoading, setIsLoading] = React.useState(false)
    const [taskSearch, setTaskSearch] = React.useState("")
    const [selectedTaskIds, setSelectedTaskIds] = React.useState<string[]>([])
    const [isTaskDialogOpen, setIsTaskDialogOpen] = React.useState(false)

    // Initialize selected tasks if editing
    React.useEffect(() => {
        if (project) {
            const projectTasks = allTasks
                .filter((t: any) => t.projectId === project.id)
                .map((t: any) => t.id)
            setSelectedTaskIds(projectTasks)
        }
    }, [project, allTasks])

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: project?.name || "",
            description: project?.description || "",
            status: project ? project.status : "Pianificazione",
            clientId: project?.clientId || "",
            startDate: project?.startDate ? new Date(project.startDate) : undefined,
            endDate: project?.endDate ? new Date(project.endDate) : undefined,
            budget: project?.budget?.toString() || "0",
            priority: project?.priority || "Media",
            teamLeaderId: project?.teamLeaderId || "",
            notes: project?.notes || "",
        },
    })

    const selectedClientId = form.watch("clientId")

    const filteredTasks = React.useMemo(() => {
        let tasks = allTasks;

        if (selectedClientId) {
            tasks = tasks.filter((t: any) => t.clientId === selectedClientId);
        }

        if (taskSearch) {
            tasks = tasks.filter((task: any) =>
                task.title.toLowerCase().includes(taskSearch.toLowerCase()) ||
                task.description?.toLowerCase().includes(taskSearch.toLowerCase())
            )
        }

        // Show tasks not assigned to other projects, OR assigned to this project
        // If a task is assigned to another project, it shouldn't show up here unless we want to steal it.
        // Usually, we only show unassigned tasks or tasks of CURRENT project.
        tasks = tasks.filter((t: any) => !t.projectId || (project && t.projectId === project.id));

        // Sort alphabetically by title
        return [...tasks].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'it', { sensitivity: 'base' }));
    }, [allTasks, taskSearch, project, selectedClientId])

    const toggleTaskSelection = (taskId: string) => {
        setSelectedTaskIds(prev =>
            prev.includes(taskId)
                ? prev.filter((id: string) => id !== taskId)
                : [...prev, taskId]
        )
    }

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true)

        try {
            const projectData = {
                name: values.name,
                description: values.description,
                status: values.status as any,
                clientId: values.clientId,
                startDate: values.startDate ? values.startDate.toISOString() : undefined,
                endDate: values.endDate ? values.endDate.toISOString() : undefined,
                budget: Number(values.budget),
                priority: values.priority,
                teamLeaderId: values.teamLeaderId === "nessuno" ? undefined : values.teamLeaderId,
                notes: values.notes,
                progress: 0,
                createdBy: project ? project.createdBy : currentUser?.id, // Mantieni createdBy originale in edit, altrimenti usa utente corrente
            }

            let projectId = project?.id

            if (project) {
                await updateProject(project.id, projectData)
                toast({ title: "Progetto aggiornato", description: "Le modifiche sono state salvate." })
            } else {
                projectId = await addProject(projectData)
                toast({ title: "Progetto creato", description: "Il nuovo progetto è stato aggiunto." })
            }

            // Handle Task Assignment
            if (projectId && currentUser) {
                const originalProjectTasks = project ? allTasks.filter((t: any) => t.projectId === project.id).map((t: any) => t.id) : []

                const tasksToAdd = selectedTaskIds.filter((id: string) => !originalProjectTasks.includes(id))
                const tasksToRemove = originalProjectTasks.filter((id: string) => !selectedTaskIds.includes(id))

                await Promise.all([
                    ...tasksToAdd.map((taskId: string) => updateTask(taskId, { projectId }, currentUser.id)),
                    ...tasksToRemove.map((taskId: string) => updateTask(taskId, { projectId: undefined }, currentUser.id))
                ])
            }

            form.reset()
            onSuccess?.()
        } catch (error) {
            console.error(error)
            toast({
                title: "Errore",
                description: "Si è verificato un errore durante il salvataggio.",
                variant: "destructive"
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4 max-h-[80vh] overflow-y-auto pr-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-sm font-medium leading-none">Nome Progetto</FormLabel>
                            <FormControl>
                                <Input placeholder="Nome del progetto" className="rounded-full" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <div className="flex justify-between items-center">
                                <FormLabel className="text-sm font-medium leading-none">Descrizione</FormLabel>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                    onClick={() => {
                                        const current = form.getValues('description') || '';
                                        form.setValue('description', current + (current ? '\n\n' : '') + '✨ Suggerimento AI (Progetto):\n- Scopo:\n- Deliverables:\n- Timeline:');
                                        toast({ title: "AI Assist", description: "Suggerimento generato!" });
                                    }}
                                >
                                    ✨ AI Assist
                                </Button>
                            </div>
                            <FormControl>
                                <Textarea placeholder="Descrizione..." className="rounded-md min-h-[80px]" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="clientId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-medium leading-none">Cliente</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="rounded-full">
                                            <SelectValue placeholder="Seleziona un cliente" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {[...clients].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' })).map((client) => (
                                            <SelectItem key={client.id} value={client.id}>
                                                {client.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-medium leading-none">Stato</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="rounded-full">
                                            <SelectValue placeholder="Seleziona stato" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="Pianificazione">Pianificazione</SelectItem>
                                        <SelectItem value="In Corso">In Corso</SelectItem>
                                        <SelectItem value="In Pausa">In Pausa</SelectItem>
                                        <SelectItem value="In Revisione">In Revisione</SelectItem>
                                        <SelectItem value="Completato">Completato</SelectItem>
                                        <SelectItem value="Annullato">Annullato</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel className="text-sm font-medium leading-none">Data Inizio</FormLabel>
                                <FormControl>
                                    <DatePickerDialog
                                        value={field.value}
                                        onChange={field.onChange}
                                        label="Seleziona Data Inizio"
                                        minDate={new Date("1900-01-01")}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel className="text-sm font-medium leading-none">Data Fine</FormLabel>
                                <FormControl>
                                    <DatePickerDialog
                                        value={field.value}
                                        onChange={field.onChange}
                                        label="Seleziona Data Fine"
                                        minDate={new Date("1900-01-01")}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-medium leading-none">Priorità</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="rounded-full">
                                            <SelectValue placeholder="Seleziona priorità" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="Bassa">Bassa</SelectItem>
                                        <SelectItem value="Media">Media</SelectItem>
                                        <SelectItem value="Alta">Alta</SelectItem>
                                        <SelectItem value="Critica">Critica</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="budget"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-medium leading-none">Budget (€)</FormLabel>
                                <FormControl>
                                    <Input type="number" min="0" step="100" className="rounded-full" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="teamLeaderId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-sm font-medium leading-none">Team Leader</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger className="rounded-full">
                                        <SelectValue placeholder="Seleziona un leader" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="nessuno">Nessuno</SelectItem>
                                    {[...users].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' })).map((user) => (
                                        <SelectItem key={user.id} value={user.id}>
                                            {user.name} ({user.role})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />



                <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-sm font-medium leading-none">Note</FormLabel>
                            <FormControl>
                                <Textarea className="rounded-md min-h-[80px]" placeholder="Note aggiuntive..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                        <FormLabel className="text-lg font-semibold">Assegna Task Esistenti</FormLabel>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setIsTaskDialogOpen(true)}
                            className="rounded-full"
                        >
                            <Plus className="h-4 w-4 mr-1" /> Crea Task
                        </Button>
                    </div>
                    <div className="relative">
                        <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            className="pl-8 rounded-full"
                            placeholder="Cerca task..."
                            value={taskSearch}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTaskSearch(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto border p-2 rounded-md">
                        {filteredTasks.length === 0 && <p className="text-sm text-muted-foreground p-2">Nessun task disponibile.</p>}
                        {filteredTasks.map((task: Task) => {
                            const client = clients.find(c => c.id === task.clientId);
                            const assignee = users.find(u => u.id === task.assignedUserId);

                            return (
                                <div key={task.id} className="flex items-center gap-x-2 p-1 rounded-md hover:bg-muted/50">
                                    <input
                                        type="checkbox"
                                        checked={selectedTaskIds.includes(task.id)}
                                        onChange={() => toggleTaskSelection(task.id)}
                                        className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
                                    />
                                    <div className="flex-grow min-w-0 flex flex-col sm:flex-row sm:items-center gap-1">
                                        <span className="text-sm font-normal truncate">{task.title}</span>
                                        <div className="flex gap-1">
                                            {client && (
                                                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">{client.name}</span>
                                            )}
                                            {assignee && (
                                                <span
                                                    className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-white truncate max-w-[100px]"
                                                    style={{ backgroundColor: assignee.color || '#000' }}
                                                >
                                                    {assignee.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            toast({ description: "Modifica task disponibile presto" });
                                        }}
                                    >
                                        <Pencil className="h-3 w-3" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    {onCancel && (
                        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading} className="rounded-full">
                            Annulla
                        </Button>
                    )}
                    <Button type="submit" disabled={isLoading} className="rounded-full">
                        {isLoading ? "Salvataggio..." : (project ? "Aggiorna Progetto" : "Crea Progetto")}
                    </Button>
                </div>
            </form>

            <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nuovo Task</DialogTitle>
                    </DialogHeader>
                    <TaskForm
                        onSuccess={() => setIsTaskDialogOpen(false)}
                        onCancel={() => setIsTaskDialogOpen(false)}
                        defaultClientId={selectedClientId}
                    />
                </DialogContent>
            </Dialog>
        </Form>
    )
}
