'use client';

import React, { useState, useMemo } from 'react';
import { Client, Brief, BriefService, BriefServiceCategory } from '@/lib/data';
import { addBrief, updateBrief } from '@/lib/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { DatePickerDialog } from '@/components/ui/date-picker-dialog';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarIcon, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BriefFormProps {
    clients: Client[];
    currentUser: any;
    services: BriefService[];
    categories: BriefServiceCategory[];
    onSuccess: () => void;
    onCancel: () => void;
    initialData?: Brief;
}

export default function BriefForm({ clients, currentUser, services, categories, onSuccess, onCancel, initialData }: BriefFormProps) {
    const [formData, setFormData] = useState<Partial<Brief>>({
        clientId: initialData?.clientId || '',
        projectName: initialData?.projectName || '',
        contactPerson: initialData?.contactPerson || '',
        budget: initialData?.budget,
        deadline: initialData?.deadline,
        mainObjective: initialData?.mainObjective || '',
        selectedServiceIds: initialData?.selectedServiceIds || [],
        status: initialData?.status || 'Bozza',
        formatDimensions: initialData?.formatDimensions || '',
        toneOfVoice: initialData?.toneOfVoice || '',
        stylePreferences: initialData?.stylePreferences || '',
        references: initialData?.references || '',
        keyMessages: initialData?.keyMessages || '',
        slogans: initialData?.slogans || '',
        publishingPlatforms: initialData?.publishingPlatforms || '',
        revisionCount: initialData?.revisionCount || '2',
        approvalStakeholders: initialData?.approvalStakeholders || '',
        deliveryMethods: initialData?.deliveryMethods || '',
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Group services by category
    const groupedServices = useMemo(() => {
        return categories.map(cat => ({
            ...cat,
            services: services.filter(s => s.categoryId === cat.id)
        })).filter(group => group.services.length > 0);
    }, [categories, services]);

    // Initialize open state for all categories
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
        const initialState: Record<string, boolean> = {};
        categories.forEach(cat => {
            initialState[cat.id] = true;
        });
        return initialState;
    });

    const toggleCategory = (catId: string) => {
        setOpenCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
    };

    const handleServiceToggle = (serviceId: string) => {
        setFormData(prev => {
            const current = prev.selectedServiceIds || [];
            if (current.includes(serviceId)) {
                return { ...prev, selectedServiceIds: current.filter(s => s !== serviceId) };
            } else {
                return { ...prev, selectedServiceIds: [...current, serviceId] };
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.clientId || !formData.projectName || !formData.contactPerson || !formData.mainObjective) {
            toast.error("Compila tutti i campi obbligatori (*)");
            return;
        }

        setIsSubmitting(true);
        try {
            const briefData = {
                ...formData,
                title: formData.projectName,
                createdBy: initialData?.createdBy || currentUser?.id,
            } as any;

            // Remove id and undefined values (Firestore doesn't accept undefined)
            delete briefData.id;
            Object.keys(briefData).forEach(key => {
                if (briefData[key] === undefined) {
                    delete briefData[key];
                }
            });

            if (initialData?.id) {
                await updateBrief(initialData.id, briefData);
                toast.success("Brief aggiornato!");
            } else {
                await addBrief(briefData);
                toast.success("Brief creato!");
            }
            onSuccess();
        } catch (error) {
            console.error(error);
            toast.error("Errore nel salvataggio.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 p-1">

            {/* Informazioni Cliente e Progetto */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Informazioni sul cliente e progetto</h3>

                <div className="space-y-2">
                    <Label>Cliente *</Label>
                    <Select
                        value={formData.clientId || undefined}
                        onValueChange={(v) => setFormData({ ...formData, clientId: v })}
                    >
                        <SelectTrigger className="w-full bg-yellow-50/50 border-yellow-400/50 focus:ring-yellow-400">
                            <SelectValue placeholder="Seleziona un cliente..." />
                        </SelectTrigger>
                        <SelectContent>
                            {[...clients].sort((a, b) => a.name.localeCompare(b.name, 'it')).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Nome azienda/progetto *</Label>
                    <Input
                        value={formData.projectName || ''}
                        onChange={e => setFormData({ ...formData, projectName: e.target.value })}
                        className="bg-gray-50/50"
                    />
                </div>

                <div className="space-y-2">
                    <Label>Contatto di riferimento *</Label>
                    <Input
                        value={formData.contactPerson || ''}
                        onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                        className="bg-gray-50/50"
                        placeholder="Es. Mario Rossi"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Budget Disponibile (€)</Label>
                        <Input
                            type="number"
                            value={formData.budget || ''}
                            onChange={e => setFormData({ ...formData, budget: e.target.value ? parseFloat(e.target.value) : undefined })}
                            className="bg-gray-50/50"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Data Consegna Desiderata</Label>
                        <DatePickerDialog
                            value={formData.deadline ? new Date(formData.deadline) : undefined}
                            onChange={(d) => setFormData({ ...formData, deadline: d?.toISOString() })}
                            placeholder="Seleziona data"
                            label="Data Consegna Desiderata"
                        />
                    </div>
                </div>
            </div>

            {/* Obiettivi e Contesto */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Obiettivi e contesto</h3>
                <div className="space-y-2">
                    <Label>Obiettivo Principale del Progetto *</Label>
                    <Textarea
                        value={formData.mainObjective || ''}
                        onChange={e => setFormData({ ...formData, mainObjective: e.target.value })}
                        className="min-h-[120px] bg-gray-50/50 resize-y"
                        placeholder="Cosa vuoi ottenere con questo progetto?"
                    />
                </div>
            </div>

            {/* Servizi Richiesti */}
            <div className="space-y-6">
                <div className="flex items-center gap-2 border-b pb-2">
                    <h3 className="text-lg font-semibold">Servizi Richiesti *</h3>
                </div>

                {groupedServices.map((category) => (
                    <div key={category.id} className="space-y-2">
                        <div
                            className="flex items-center justify-between cursor-pointer py-1 hover:bg-muted/50 rounded px-2"
                            onClick={() => toggleCategory(category.id)}
                        >
                            <h4 className="font-medium text-base">{category.name}</h4>
                            {openCategories[category.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>

                        {openCategories[category.id] && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-4">
                                {category.services.map(service => (
                                    <div key={service.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={service.id}
                                            checked={(formData.selectedServiceIds || []).includes(service.id)}
                                            onCheckedChange={() => handleServiceToggle(service.id)}
                                            className="border-yellow-400 text-yellow-500 focus:ring-yellow-400 data-[state=checked]:bg-yellow-400 data-[state=checked]:text-white"
                                        />
                                        <label
                                            htmlFor={service.id}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                        >
                                            {service.name}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="h-px bg-border/40 my-2"></div>
                    </div>
                ))}
            </div>

            {/* Dettagli creativi */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Dettagli creativi</h3>
                <div className="space-y-2">
                    <Label>Dimensioni/formati necessari</Label>
                    <Textarea
                        value={formData.formatDimensions || ''}
                        onChange={e => setFormData({ ...formData, formatDimensions: e.target.value })}
                        placeholder="Es: 1080x1080px per Instagram, A4 per stampa..."
                        className="bg-gray-50/50"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Tono di voce</Label>
                    <Textarea
                        value={formData.toneOfVoice || ''}
                        onChange={e => setFormData({ ...formData, toneOfVoice: e.target.value })}
                        placeholder="Es: formale, amichevole, tecnico..."
                        className="bg-gray-50/50"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Stile desiderato o da evitare</Label>
                    <Textarea
                        value={formData.stylePreferences || ''}
                        onChange={e => setFormData({ ...formData, stylePreferences: e.target.value })}
                        className="bg-gray-50/50"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Esempi di riferimento</Label>
                    <Textarea
                        value={formData.references || ''}
                        onChange={e => setFormData({ ...formData, references: e.target.value })}
                        placeholder="Link a lavori che ti piacciono"
                        className="bg-gray-50/50"
                    />
                </div>
            </div>

            {/* Contenuti e messaggi */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Contenuti e messaggi</h3>
                <div className="space-y-2">
                    <Label>Messaggi chiave</Label>
                    <Textarea
                        value={formData.keyMessages || ''}
                        onChange={e => setFormData({ ...formData, keyMessages: e.target.value })}
                        placeholder="Quali sono i messaggi più importanti da comunicare?"
                        className="bg-gray-50/50"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Claim/Slogan da usare</Label>
                    <Textarea
                        value={formData.slogans || ''}
                        onChange={e => setFormData({ ...formData, slogans: e.target.value })}
                        className="bg-gray-50/50"
                    />
                </div>
            </div>

            {/* Vincoli e requisiti tecnici */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Vincoli e requisiti tecnici</h3>
                <div className="space-y-2">
                    <Label>Piattaforme di pubblicazione</Label>
                    <Textarea
                        value={formData.publishingPlatforms || ''}
                        onChange={e => setFormData({ ...formData, publishingPlatforms: e.target.value })}
                        className="bg-gray-50/50"
                    />
                </div>
            </div>

            {/* Processo e approvazioni */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Processo e approvazioni</h3>
                <div className="space-y-2">
                    <Label>Numero di revisioni incluse</Label>
                    <Input
                        value={formData.revisionCount || ''}
                        onChange={e => setFormData({ ...formData, revisionCount: e.target.value })}
                        className="bg-gray-50/50"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Stakeholder per approvazione</Label>
                    <Textarea
                        value={formData.approvalStakeholders || ''}
                        onChange={e => setFormData({ ...formData, approvalStakeholders: e.target.value })}
                        placeholder="Chi approverà il lavoro finale?"
                        className="bg-gray-50/50"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Modalità di consegna preferita</Label>
                    <Textarea
                        value={formData.deliveryMethods || ''}
                        onChange={e => setFormData({ ...formData, deliveryMethods: e.target.value })}
                        placeholder="Es: Email, Google Drive, WeTransfer..."
                        className="bg-gray-50/50"
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t z-10">
                <Button type="button" variant="outline" onClick={onCancel}>Annulla</Button>
                <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Salva Brief
                </Button>
            </div>
        </form>
    );
}
