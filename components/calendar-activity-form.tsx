import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { X, Check, ChevronsUpDown } from 'lucide-react';
import { Client } from '@/lib/data';
// Remove complex UI imports to simplify debugging and fix crash

import { useLayoutData } from '@/app/(app)/layout-context';
import { addCalendarActivity, updateCalendarActivity } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { CalendarActivity } from '@/lib/data';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const ClientMultiSelect = ({
    value = [],
    onChange,
    clients
}: {
    value?: string[],
    onChange: (value: string[]) => void,
    clients: Client[]
}) => {
    const [open, setOpen] = useState(false);

    // Sort clients alphabetically
    const sortedClients = [...clients].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' })
    );

    const toggleClient = (clientId: string) => {
        const current = value || [];
        let newValue;
        if (current.includes(clientId)) {
            newValue = current.filter((id) => id !== clientId);
        } else {
            newValue = [...current, clientId];
        }

        // Update state in next tick to avoid potential synchronous loops in RHF
        setTimeout(() => onChange(newValue), 0);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-auto min-h-10 py-2 px-3 text-left font-normal bg-background"
                >
                    <div className="flex flex-wrap gap-1">
                        {value && value.length > 0 ? (
                            value.map(id => {
                                const client = clients.find(c => c.id === id);
                                return (
                                    <Badge key={id} variant="secondary" className="mr-1 mb-1">
                                        {client?.name || id}
                                    </Badge>
                                )
                            })
                        ) : (
                            <span className="text-muted-foreground">Seleziona clienti...</span>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Cerca cliente..." />
                    <CommandList>
                        <CommandEmpty>Nessun cliente trovato.</CommandEmpty>
                        <CommandGroup className="max-h-[200px] overflow-auto">
                            {sortedClients.map((client) => {
                                const isSelected = value?.includes(client.id);
                                return (
                                    <CommandItem
                                        key={client.id}
                                        value={client.name || client.id}
                                        onSelect={() => toggleClient(client.id)}
                                        className="cursor-pointer"
                                    >
                                        <div
                                            className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                            )}
                                        >
                                            <Check className={cn("h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                                        </div>
                                        <span>{client.name}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

const formSchema = z.object({
    presetId: z.string().optional(),
    title: z.string().min(1, "Il titolo è obbligatorio"),
    userId: z.string().min(1, "Seleziona un utente"),
    clientIds: z.array(z.string()).optional(),
    startDate: z.string().min(1, "Data inizio richiesta"),
    startTime: z.string().min(1, "Ora inizio richiesta"),
    endDate: z.string().min(1, "Data fine richiesta"),
    endTime: z.string().min(1, "Ora fine richiesta"),
    color: z.string().optional(),
    notes: z.string().optional(),
});

interface CalendarActivityFormProps {
    activity?: CalendarActivity | null;
    initialDate?: Date;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export function CalendarActivityForm({ activity, initialDate, onSuccess, onCancel }: CalendarActivityFormProps) {
    const { users, clients, calendarActivityPresets, refetchData, currentUser } = useLayoutData();
    const { toast } = useToast();

    // Initial values - supporta sia startTime/endTime che start/end (legacy)
    const activityStart = activity?.startTime || activity?.start;
    const activityEnd = activity?.endTime || activity?.end;

    const defaultValues = activity ? {
        presetId: activity.presetId || '',
        title: activity.title,
        userId: activity.userId || '',
        clientIds: activity.clientIds || (activity.clientId ? [activity.clientId] : []),
        startDate: activityStart ? format(new Date(activityStart), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        startTime: activityStart ? format(new Date(activityStart), 'HH:mm') : '09:00',
        endDate: activityEnd ? format(new Date(activityEnd), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        endTime: activityEnd ? format(new Date(activityEnd), 'HH:mm') : '10:00',
        color: activity.color || '#FBBF24',
        notes: activity.description || activity.notes || '',
    } : {
        presetId: '',
        title: '',
        userId: '',
        clientIds: [],
        startDate: format(initialDate || new Date(), 'yyyy-MM-dd'),
        startTime: '09:00',
        endDate: format(initialDate || new Date(), 'yyyy-MM-dd'),
        endTime: '10:00',
        color: '#FBBF24',
        notes: '',
    };

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues,
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            const startDateTime = new Date(`${values.startDate}T${values.startTime}`);
            const endDateTime = new Date(`${values.endDate}T${values.endTime}`);

            const activityData = {
                title: values.title,
                description: values.notes,
                startTime: startDateTime.toISOString(),
                endTime: endDateTime.toISOString(),
                color: values.color,
                presetId: values.presetId,
                userId: values.userId,
                clientIds: values.clientIds || [],
            };

            if (activity) {
                await updateCalendarActivity(activity.id, activityData);
                toast({ title: "Attività aggiornata con successo" });
            } else {
                await addCalendarActivity(activityData, currentUser?.id);
                toast({ title: "Attività creata con successo" });
            }

            await refetchData('calendarActivities');
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error("Error saving activity:", error);
            toast({
                title: "Errore",
                description: "Si è verificato un errore durante il salvataggio dell'attività.",
                variant: "destructive",
            });
        }
    };

    return (
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <h2 className="text-lg font-semibold leading-none tracking-tight mb-4">
                {activity ? "Modifica Attività" : "Crea Nuova Attività"}
            </h2>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="presetId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tipo di Attività</FormLabel>
                                <Select onValueChange={(val) => {
                                    field.onChange(val);
                                    // Auto-fill logic if needed based on preset
                                    const preset = calendarActivityPresets.find(p => p.id === val);
                                    if (preset) {
                                        if (preset.name) form.setValue('title', preset.name);
                                        if (preset.color) form.setValue('color', preset.color);
                                        // Could auto-set duration too
                                    }
                                }} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="rounded-full">
                                            <SelectValue placeholder="Scegli un tipo di attività o compila manualmente..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="none">Nessun preset</SelectItem>
                                        {[...calendarActivityPresets].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' })).map((preset) => (
                                            <SelectItem key={preset.id} value={preset.id}>
                                                {preset.name}
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
                        name="title"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Titolo</FormLabel>
                                <FormControl>
                                    <Input {...field} className="rounded-full" placeholder="Titolo attività" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="userId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Assegna a</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="rounded-full">
                                                <SelectValue placeholder="Seleziona utente" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {[...users].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' })).map((user) => (
                                                <SelectItem key={user.id} value={user.id}>
                                                    {user.name || `${user.id}`}
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
                            name="clientIds"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Clienti (opzionale)</FormLabel>
                                    <ClientMultiSelect
                                        value={field.value || []}
                                        onChange={field.onChange}
                                        clients={clients}
                                    />
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
                                <FormItem>
                                    <FormLabel>Data Inizio</FormLabel>
                                    <FormControl>
                                        <Input {...field} type="date" className="rounded-full" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="startTime"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Ora Inizio</FormLabel>
                                    <FormControl>
                                        <Input {...field} type="time" className="rounded-full" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="endDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Data Fine</FormLabel>
                                    <FormControl>
                                        <Input {...field} type="date" className="rounded-full" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="endTime"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Ora Fine</FormLabel>
                                    <FormControl>
                                        <Input {...field} type="time" className="rounded-full" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="color"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Colore</FormLabel>
                                <FormControl>
                                    <div className="flex items-center gap-2">
                                        <Input {...field} type="color" className="w-full h-10 rounded-full p-1" />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Note</FormLabel>
                                <FormControl>
                                    <Textarea {...field} className="min-h-[80px]" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" className="rounded-full" onClick={onCancel}>
                            Annulla
                        </Button>
                        <Button type="submit" className="rounded-full">
                            {activity ? "Salva Modifiche" : "Salva Attività"}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}

export default CalendarActivityForm;
