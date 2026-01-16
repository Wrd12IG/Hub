"use client"

import * as React from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { CalendarIcon, PlusCircle, Link as LinkIcon, FileText, Check, X, Upload, File as FileIcon, Zap, Trash2, AlertCircle, Plus } from "lucide-react"
import { useRouter } from 'next/navigation';

import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
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
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useLayoutData } from "@/app/(app)/layout-context"
import DatePickerDialog from "@/components/ui/date-picker-dialog"
import { Task, User, allTaskStatuses, allTaskPriorities } from "@/lib/data"
import { addTask, updateTask, uploadFilesAndGetAttachments } from "@/lib/actions"
import { useToast } from "@/hooks/use-toast"

const formSchema = z.object({
    title: z.string().min(2, {
        message: "Il titolo deve essere di almeno 2 caratteri.",
    }),
    description: z.string().optional(),
    status: z.enum(['Da Fare', 'In Lavorazione', 'In Approvazione', 'Approvato', 'Annullato']),
    priority: z.enum(['Bassa', 'Media', 'Alta', 'Critica']),
    dueDate: z.date().optional(),
    estimatedDuration: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
        message: "Inserisci un numero valido di ore.",
    }),
    clientId: z.string().min(1, "Seleziona un cliente"),
    projectId: z.string().optional(),
    assignedUserId: z.string().optional(),
    activityType: z.string().min(1, "Seleziona un'attività"),
    attachments: z.array(z.object({
        url: z.string(), // Removed .url() validation to allow placeholders or local paths
        filename: z.string().optional(),
        documentType: z.string().optional(),
    })).optional(),
    dependencies: z.array(z.string()).optional(),
    requiresTwoStepApproval: z.boolean().optional(),
    skipAttachmentOnApproval: z.boolean().optional(),
    sendEmailNotification: z.boolean().optional(),
})

interface TaskFormProps {
    task?: Task | null
    defaultClientId?: string
    initialDate?: Date
    onSuccess?: () => void
    onCancel?: () => void
}

export default function TaskForm({ task, defaultClientId, initialDate, onSuccess, onCancel }: TaskFormProps) {
    const { clients, allProjects: projects, users, currentUser, activityTypes, allTasks, taskPrioritySettings } = useLayoutData()
    const { toast } = useToast()
    const router = useRouter()
    const [isLoading, setIsLoading] = React.useState(false)
    const [newAttachmentUrl, setNewAttachmentUrl] = React.useState("")
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const [pendingFiles, setPendingFiles] = React.useState<File[]>([])
    const [isUploading, setIsUploading] = React.useState(false)
    const [useAutoDueDate, setUseAutoDueDate] = React.useState(!task && !initialDate) // Auto scadenza per nuovi task
    const [suggestedDuration, setSuggestedDuration] = React.useState<number | null>(null)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: task?.title || "",
            description: task?.description || "",
            status: task ? task.status : "Da Fare",
            priority: task ? task.priority : "Media",
            dueDate: task?.dueDate ? new Date(task.dueDate) : initialDate,
            estimatedDuration: task?.estimatedDuration?.toString() || "0",
            clientId: task?.clientId || defaultClientId || "",
            projectId: task?.projectId || "nessuno",
            assignedUserId: task?.assignedUserId || "nessuno",
            activityType: task?.activityType || "",
            attachments: task?.attachments || [],
            dependencies: task?.dependencies || [],
            requiresTwoStepApproval: task?.requiresTwoStepApproval || false,
            skipAttachmentOnApproval: task?.skipAttachmentOnApproval || false,
            sendEmailNotification: true, // Default true come richiesto
        },
    })

    const { fields: attachmentFields, append: appendAttachment, remove: removeAttachment } = useFieldArray({
        control: form.control,
        name: "attachments",
    })

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Store file for later upload and show preview with local URL
            const objectUrl = URL.createObjectURL(file);
            setPendingFiles(prev => [...prev, file]);
            appendAttachment({
                url: objectUrl, // Temporary preview URL
                documentType: file.type.startsWith('image/') ? 'Image' : 'File',
                filename: file.name,
                // Mark as pending upload
                _pendingUpload: true,
                _fileIndex: pendingFiles.length
            } as any);

            toast({
                title: "File Selezionato",
                description: `Il file ${file.name} verrà caricato al salvataggio.`,
            })

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    }

    const isImage = (url: string, type?: string) => {
        if (type === 'Image') return true;
        return url.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null;
    }

    // Filter projects and tasks based on selected client
    const watchedClientId = form.watch("clientId")

    // Reset form when task changes
    React.useEffect(() => {
        if (task) {
            form.reset({
                title: task.title || "",
                description: task.description || "",
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
                estimatedDuration: task.estimatedDuration?.toString() || "0",
                clientId: task.clientId || "",
                projectId: task.projectId || "nessuno",
                assignedUserId: task.assignedUserId || "nessuno",
                activityType: task.activityType || "",
                attachments: task.attachments || [],
                dependencies: task.dependencies || [],
                requiresTwoStepApproval: task.requiresTwoStepApproval || false,
                skipAttachmentOnApproval: task.skipAttachmentOnApproval || false,
                sendEmailNotification: true,
            })
        }
    }, [task, form])

    // Sorted clients alphabetically
    const sortedClients = React.useMemo(() => {
        return [...clients].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' }));
    }, [clients]);

    // Filter activity types based on selected client
    const filteredActivityTypes = React.useMemo(() => {
        let types = [...activityTypes];

        if (watchedClientId) {
            const client = clients.find(c => c.id === watchedClientId);
            // Check if allowedActivityTypeIds exists and is an array
            if (client?.allowedActivityTypeIds && Array.isArray(client.allowedActivityTypeIds)) {
                if (client.allowedActivityTypeIds.length > 0) {
                    types = types.filter(t => client.allowedActivityTypeIds?.includes(t.id));
                } else if (client.allowedActivityTypeIds.length === 0) {
                    // Explicitly empty allowed list means NO activities allowed (if that's the logic intended)
                    // Or, assuming empty array means "no restrictions"? 
                    // The original code implied empty array -> empty list. 
                    // "Explicitly empty allowed list means NO activities allowed"
                    types = [];
                }
            }
            // If property is missing, we assume all activities are allowed (standard behavior)
        }

        return types.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' }));
    }, [activityTypes, watchedClientId, clients]);

    const filteredProjects = React.useMemo(() => {
        if (!watchedClientId) return [];
        return projects
            .filter(p => p.clientId === watchedClientId)
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' }));
    }, [projects, watchedClientId]);

    const filteredDependencyTasks = React.useMemo(() => {
        if (!watchedClientId) return [];
        return allTasks
            .filter(t =>
                t.clientId === watchedClientId &&
                t.id !== task?.id && // Exclude self
                t.status !== 'Approvato' &&
                t.status !== 'Annullato'
            )
            .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'it', { sensitivity: 'base' }));
    }, [allTasks, watchedClientId, task?.id]);

    // 🤖 AI: Calcola tempo suggerito basato su task simili (stesso tipo attività e cliente)
    const watchedActivityType = form.watch("activityType")
    const watchedPriority = form.watch("priority")

    React.useEffect(() => {
        if (!watchedActivityType || !watchedClientId || task) {
            setSuggestedDuration(null);
            return;
        }

        // Trova task completati con stesso tipo attività e cliente
        const similarTasks = allTasks.filter(t =>
            t.activityType === watchedActivityType &&
            t.clientId === watchedClientId &&
            t.status === 'Approvato' &&
            t.timeSpent && t.timeSpent > 0
        );

        if (similarTasks.length >= 1) {
            // Calcola media del tempo effettivo (in minuti)
            const avgTimeSpent = similarTasks.reduce((sum, t) => sum + (t.timeSpent || 0), 0) / similarTasks.length;
            // Converti da secondi a minuti
            const avgMinutes = Math.round(avgTimeSpent / 60);
            setSuggestedDuration(avgMinutes);
        } else {
            // Se non ci sono task simili con stesso cliente, prova solo per tipo attività
            const typeOnlyTasks = allTasks.filter(t =>
                t.activityType === watchedActivityType &&
                t.status === 'Approvato' &&
                t.timeSpent && t.timeSpent > 0
            );
            if (typeOnlyTasks.length >= 1) {
                const avgTimeSpent = typeOnlyTasks.reduce((sum, t) => sum + (t.timeSpent || 0), 0) / typeOnlyTasks.length;
                const avgMinutes = Math.round(avgTimeSpent / 60);
                setSuggestedDuration(avgMinutes);
            } else {
                setSuggestedDuration(null);
            }
        }
    }, [watchedActivityType, watchedClientId, allTasks, task]);

    // 🗓️ Calcola scadenza automatica basata su priorità
    React.useEffect(() => {
        if (!task && useAutoDueDate && taskPrioritySettings && watchedPriority) {
            const daysToAdd = taskPrioritySettings[watchedPriority] || 7;
            const newDueDate = new Date();
            newDueDate.setDate(newDueDate.getDate() + daysToAdd);
            form.setValue('dueDate', newDueDate);
        }
    }, [watchedPriority, useAutoDueDate, taskPrioritySettings, task, form]);


    const handleAddAttachment = () => {
        if (!newAttachmentUrl) return;
        try {
            // Basic URL validation
            new URL(newAttachmentUrl);
            appendAttachment({ url: newAttachmentUrl, documentType: 'Link', filename: '' });
            setNewAttachmentUrl("");
        } catch (e) {
            toast({
                title: "URL non valido",
                description: "Inserisci un URL valido (es. https://example.com)",
                variant: "destructive"
            })
        }
    }

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!currentUser) return;
        setIsLoading(true)

        try {
            // Upload pending files to Firebase Storage
            let finalAttachments = [...(values.attachments || [])];

            if (pendingFiles.length > 0) {
                setIsUploading(true);
                toast({
                    title: "Caricamento file...",
                    description: `Caricamento di ${pendingFiles.length} file in corso...`,
                });

                try {
                    const uploadedAttachments = await uploadFilesAndGetAttachments(
                        pendingFiles,
                        `tasks/${values.clientId}`,
                        currentUser.id
                    );

                    // Replace pending attachments with uploaded ones
                    let uploadIndex = 0;
                    finalAttachments = finalAttachments.map((att: any) => {
                        if (att._pendingUpload && uploadIndex < uploadedAttachments.length) {
                            const uploaded = uploadedAttachments[uploadIndex];
                            uploadIndex++;
                            return {
                                url: uploaded.url,
                                filename: uploaded.filename,
                                type: uploaded.type,
                                size: uploaded.size,
                                documentType: att.documentType === 'Image' ? 'Altro' : 'Altro',
                                date: uploaded.date,
                                userId: uploaded.userId,
                            };
                        }
                        return att;
                    });

                    // Clean up any remaining pending markers
                    finalAttachments = finalAttachments.filter((att: any) => !att._pendingUpload);

                } catch (uploadError) {
                    console.error('Error uploading files:', uploadError);
                    toast({
                        title: "Errore caricamento file",
                        description: "Non è stato possibile caricare alcuni file. Riprova.",
                        variant: "destructive"
                    });
                    setIsLoading(false);
                    setIsUploading(false);
                    return;
                }
                setIsUploading(false);
            }

            // Clean attachments from internal markers before saving
            const cleanedAttachments = finalAttachments.map((att: any) => {
                const { _pendingUpload, _fileIndex, ...clean } = att;
                return clean;
            });

            const taskData: any = {
                title: values.title,
                description: values.description,
                status: values.status,
                priority: values.priority,
                dueDate: values.dueDate ? values.dueDate.toISOString() : undefined,
                estimatedDuration: Number(values.estimatedDuration),
                clientId: values.clientId,
                projectId: values.projectId === "nessuno" ? undefined : values.projectId,
                assignedUserId: values.assignedUserId === "nessuno" ? undefined : values.assignedUserId,
                activityType: values.activityType,
                attachments: cleanedAttachments,
                dependencies: values.dependencies,
                requiresTwoStepApproval: values.requiresTwoStepApproval,
                skipAttachmentOnApproval: values.skipAttachmentOnApproval,
            }

            if (task) {
                await updateTask(task.id, taskData, currentUser.id)
                toast({ title: "Task aggiornato", description: "Le modifiche sono state salvate." })
            } else {
                await addTask(taskData, currentUser.id)
                toast({ title: "Task creato", description: "Il nuovo task è stato aggiunto." })
            }

            // Reset state
            setPendingFiles([]);
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
            setIsUploading(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4 max-h-[80vh] overflow-y-auto pr-4">
                {task && (
                    <div className="flex justify-end mb-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="bg-yellow-50 border-yellow-200 hover:bg-yellow-100 hover:text-yellow-700 text-yellow-600"
                            onClick={() => router.push(`/focus/${task.id}`)}
                        >
                            <Zap className="h-4 w-4 mr-2" /> Focus Mode
                        </Button>
                    </div>
                )}
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Titolo</FormLabel>
                            <FormControl>
                                <Input className="rounded-full" placeholder="Titolo del task" {...field} />
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
                                <FormLabel>Descrizione</FormLabel>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                    onClick={() => {
                                        const current = form.getValues('description') || '';
                                        form.setValue('description', current + (current ? '\n\n' : '') + '✨ Suggerimento AI:\n- Obiettivo:\n- Passaggi:\n- Scadenza:');
                                        toast({ title: "AI Assist", description: "Suggerimento generato!" });
                                    }}
                                >
                                    ✨ AI Assist
                                </Button>
                            </div>
                            <FormControl>
                                <Textarea placeholder="Descrizione dettagliata..." {...field} />
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
                                <FormLabel>Cliente</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="rounded-full">
                                            <SelectValue placeholder="Seleziona un cliente" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {sortedClients.map((client) => (
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
                        name="projectId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Progetto</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!watchedClientId}>
                                    <FormControl>
                                        <SelectTrigger className="rounded-full">
                                            <SelectValue placeholder="Nessun progetto" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="nessuno">Nessun progetto</SelectItem>
                                        {filteredProjects.map((project) => (
                                            <SelectItem key={project.id} value={project.id}>
                                                {project.name}
                                            </SelectItem>
                                        ))}
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
                        name="priority"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Priorità</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="rounded-full">
                                            <SelectValue placeholder="Seleziona una priorità" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {allTaskPriorities.map((priority) => (
                                            <SelectItem key={priority} value={priority}>
                                                {priority}
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
                                <FormLabel>Stato</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="rounded-full">
                                            <SelectValue placeholder="Seleziona stato" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {allTaskStatuses.map((status) => (
                                            <SelectItem key={status} value={status}>
                                                {status}
                                            </SelectItem>
                                        ))}
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
                        name="dueDate"
                        render={({ field }) => {
                            return (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Data Scadenza</FormLabel>
                                    <FormControl>
                                        <DatePickerDialog
                                            value={field.value}
                                            onChange={(date) => {
                                                field.onChange(date);
                                                if (date) setUseAutoDueDate(false);
                                            }}
                                            label="Seleziona Data"
                                            minDate={new Date("1900-01-01")}
                                        />
                                    </FormControl>
                                    {!task && (
                                        <div className="flex items-center gap-2 mt-1">
                                            <Checkbox
                                                id="useAutoDueDate"
                                                checked={useAutoDueDate}
                                                onCheckedChange={(checked) => {
                                                    setUseAutoDueDate(!!checked);
                                                    if (!checked) {
                                                        form.setValue('dueDate', undefined);
                                                    }
                                                }}
                                            />
                                            <label htmlFor="useAutoDueDate" className="text-xs text-muted-foreground cursor-pointer">
                                                Auto ({taskPrioritySettings?.[watchedPriority] || 7} giorni per priorità {watchedPriority})
                                            </label>
                                        </div>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            );
                        }}
                    />

                    <FormField
                        control={form.control}
                        name="estimatedDuration"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                    Durata Stimata (min)
                                    {suggestedDuration && (
                                        <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-primary/30">
                                            <Zap className="h-3 w-3 mr-1" />
                                            AI: ~{suggestedDuration} min
                                        </Badge>
                                    )}
                                </FormLabel>
                                <div className="flex gap-2">
                                    <FormControl>
                                        <Input type="number" step="0.5" min="0" className="rounded-full flex-1" {...field} />
                                    </FormControl>
                                    {suggestedDuration && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="rounded-full text-primary border-primary/30 hover:bg-primary/10"
                                            onClick={() => form.setValue('estimatedDuration', suggestedDuration.toString())}
                                        >
                                            <Zap className="h-4 w-4 mr-1" />
                                            Usa
                                        </Button>
                                    )}
                                </div>
                                {suggestedDuration && (
                                    <FormDescription className="text-xs text-primary">
                                        💡 Suggerito in base a task simili completati
                                    </FormDescription>
                                )}
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="activityType"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tipo di Attività</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!watchedClientId}>
                                    <FormControl>
                                        <SelectTrigger className="rounded-full">
                                            <SelectValue placeholder={!watchedClientId ? "Seleziona prima un cliente" : "Seleziona un'attività"} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {filteredActivityTypes.length === 0 ? (
                                            <div className="p-2 text-sm text-muted-foreground text-center">
                                                {watchedClientId ? "Nessuna attività disponibile per questo cliente" : "Seleziona un cliente"}
                                            </div>
                                        ) : (
                                            filteredActivityTypes.map((type) => (
                                                <SelectItem key={type.name} value={type.name}>
                                                    {type.name}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="assignedUserId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Assegna a</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="rounded-full">
                                            <SelectValue placeholder="Seleziona un utente" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="nessuno">Nessuno</SelectItem>
                                        {[...users].sort((a, b) => a.name.localeCompare(b.name, 'it')).map((user: User) => (
                                            <SelectItem key={user.id} value={user.id}>
                                                {user.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <div className="mt-2 text-xs">
                                    <FormLabel className="text-xs">Carico settimanale:</FormLabel>
                                    {field.value && field.value !== 'nessuno' ? (
                                        (() => {
                                            const userTasks = allTasks.filter(t =>
                                                t.assignedUserId === field.value &&
                                                t.status !== 'Approvato' && t.status !== 'Annullato'
                                            );
                                            const totalHours = userTasks.reduce((acc, t) => acc + (t.estimatedDuration || 0), 0) / 60;
                                            const maxHours = 40; // Hardcoded per ora
                                            const percentage = Math.min((totalHours / maxHours) * 100, 100);

                                            return (
                                                <>
                                                    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} className="relative w-full overflow-hidden rounded-full bg-secondary h-2 my-1">
                                                        <div className="h-full w-full flex-1 bg-primary transition-all" style={{ transform: `translateX(-${100 - percentage}%)` }}></div>
                                                    </div>
                                                    <p className="text-right text-muted-foreground">{totalHours.toFixed(1)} / {maxHours} ore pianificate</p>
                                                </>
                                            )
                                        })()
                                    ) : <p className="text-muted-foreground">Nessun utente selezionato</p>}
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="space-y-2 pt-4 border-t">
                    <FormLabel className="text-base font-semibold">Allegati</FormLabel>
                    <div className="flex gap-2">
                        <Input
                            value={newAttachmentUrl}
                            onChange={(e) => setNewAttachmentUrl(e.target.value)}
                            placeholder="Incolla un link qui..."
                            className="rounded-full flex-1"
                        />
                        <Button type="button" onClick={handleAddAttachment} className="rounded-full">
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Link
                        </Button>
                        <Input
                            type="file"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            className="rounded-full"
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            Carica File
                        </Button>
                    </div>
                    <div className="space-y-2">
                        {attachmentFields.map((field, index) => {
                            const attachment = field as any;
                            const isImg = isImage(attachment.url, attachment.documentType);

                            return (
                                <div key={field.id} className="flex items-center justify-between p-2 bg-secondary rounded-md">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        {isImg ? (
                                            <div className="h-10 w-10 flex-shrink-0 rounded-md overflow-hidden bg-background border">
                                                <img src={attachment.url} alt="anteprima" className="h-full w-full object-cover" />
                                            </div>
                                        ) : (
                                            attachment.documentType === 'File' ? <FileIcon className="h-4 w-4 flex-shrink-0" /> : <LinkIcon className="h-4 w-4 flex-shrink-0" />
                                        )}

                                        <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="text-sm truncate hover:underline underline-offset-4 decoration-primary">
                                            {attachment.filename || attachment.url}
                                        </a>
                                    </div>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => removeAttachment(index)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="space-y-2 pt-4 border-t">
                    <FormLabel className="text-base font-semibold flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" /> Dipendenze
                    </FormLabel>
                    <p className="text-sm text-muted-foreground">Seleziona i task che devono essere completati prima di questo.</p>

                    <ScrollArea className="h-40 w-full rounded-md border p-2">
                        {filteredDependencyTasks.length > 0 ? (
                            <div className="space-y-2">
                                {filteredDependencyTasks.map(depTask => (
                                    <FormField
                                        key={depTask.id}
                                        control={form.control}
                                        name="dependencies"
                                        render={({ field }) => {
                                            return (
                                                <FormItem
                                                    key={depTask.id}
                                                    className="flex flex-row items-start space-x-3 space-y-0"
                                                >
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={field.value?.includes(depTask.id)}
                                                            onCheckedChange={(checked) => {
                                                                return checked
                                                                    ? field.onChange([...(field.value || []), depTask.id])
                                                                    : field.onChange(
                                                                        field.value?.filter(
                                                                            (value) => value !== depTask.id
                                                                        )
                                                                    )
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormLabel className="font-normal flex items-center justify-between w-full">
                                                        <span>{depTask.title}</span>
                                                        <Badge variant="secondary" className="text-xs">{depTask.status}</Badge>
                                                    </FormLabel>
                                                </FormItem>
                                            )
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground p-4">Nessun altro task disponibile per questo cliente.</p>
                        )}
                    </ScrollArea>
                </div>

                <div className="space-y-4 pt-4 border-t">
                    <FormLabel className="text-base font-semibold">Opzioni di Approvazione</FormLabel>
                    <FormField
                        control={form.control}
                        name="requiresTwoStepApproval"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                    Richiedi Approvazione a 2 Livelli
                                </FormLabel>
                            </FormItem>
                        )}
                    />
                    {currentUser?.role === 'Amministratore' && (
                        <FormField
                            control={form.control}
                            name="skipAttachmentOnApproval"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <FormLabel className="text-sm font-normal text-muted-foreground">
                                        Salta allegato in approvazione (solo admin)
                                    </FormLabel>
                                </FormItem>
                            )}
                        />
                    )}
                </div>

                <div className="space-y-4 pt-4 border-t">
                    <FormLabel className="text-base font-semibold">Notifiche</FormLabel>
                    <FormField
                        control={form.control}
                        name="sendEmailNotification"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                    Invia notifica email all'utente assegnato
                                </FormLabel>
                            </FormItem>
                        )}
                    />
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
                    {onCancel && (
                        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading} className="rounded-full hover:bg-accent hover:text-accent-foreground">
                            Annulla
                        </Button>
                    )}
                    <Button type="submit" disabled={isLoading || isUploading} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
                        {isUploading ? "Caricamento file..." : isLoading ? "Salvataggio..." : (task ? "Salva Modifiche" : "Crea Task")}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
