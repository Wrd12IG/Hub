'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, Mail, Eye, Copy, Code2 } from 'lucide-react';
import { getEmailTemplates, addEmailTemplate, updateEmailTemplate, deleteEmailTemplate } from '@/lib/actions';
import type { EmailTemplate, NotificationType } from '@/lib/data';
import { EMAIL_TEMPLATE_PLACEHOLDERS } from '@/lib/data';

// Notification types grouped by category
const NOTIFICATION_TYPES: { category: string; types: { value: NotificationType; label: string }[] }[] = [
    {
        category: 'Task',
        types: [
            { value: 'task_assigned', label: 'Task Assegnato' },
            { value: 'task_due_soon', label: 'Task in Scadenza (24h)' },
            { value: 'task_due_urgent', label: 'Task Urgente (3h)' },
            { value: 'task_overdue', label: 'Task Scaduto' },
            { value: 'task_comment', label: 'Nuovo Commento' },
            { value: 'task_approval_requested', label: 'Richiesta Approvazione' },
            { value: 'task_approved', label: 'Task Approvato' },
            { value: 'task_rejected', label: 'Task Rifiutato' },
            { value: 'task_attachment', label: 'Nuovo Allegato' },
        ]
    },
    {
        category: 'Progetti',
        types: [
            { value: 'project_added', label: 'Aggiunto a Progetto' },
            { value: 'project_due_soon', label: 'Progetto in Scadenza' },
            { value: 'project_completed', label: 'Progetto Completato' },
            { value: 'project_new_task', label: 'Nuovo Task nel Progetto' },
        ]
    },
    {
        category: 'Assenze',
        types: [
            { value: 'absence_request', label: 'Richiesta Assenza' },
            { value: 'absence_approved', label: 'Assenza Approvata' },
            { value: 'absence_rejected', label: 'Assenza Rifiutata' },
            { value: 'absence_colleague', label: 'Collega in Ferie' },
        ]
    },
    {
        category: 'Brief',
        types: [
            { value: 'brief_assigned', label: 'Brief Assegnato' },
            { value: 'brief_approved', label: 'Brief Approvato' },
            { value: 'brief_revision', label: 'Brief in Revisione' },
        ]
    },
    {
        category: 'Calendario',
        types: [
            { value: 'calendar_reminder', label: 'Promemoria Evento' },
            { value: 'calendar_event_assigned', label: 'Nuovo Evento' },
        ]
    },
    {
        category: 'Editoriale',
        types: [
            { value: 'editorial_due_soon', label: 'Contenuto in Scadenza' },
            { value: 'editorial_publish_today', label: 'Da Pubblicare Oggi' },
        ]
    },
];

const DEFAULT_TEMPLATE: Omit<EmailTemplate, 'id'> = {
    type: 'task_assigned',
    name: '',
    subject: '',
    headerTitle: '',
    headerColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    bodyContent: `<p>Ciao <strong>{{userName}}</strong>,</p>
<p>Descrivi qui il contenuto della tua email...</p>

<div class="email-highlight">
    <strong>{{taskTitle}}</strong>
</div>

<p>Clicca il pulsante qui sotto per ulteriori dettagli.</p>`,
    buttonText: 'Visualizza Dettagli',
    isActive: true,
};

const GRADIENT_PRESETS = [
    { name: 'Viola', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { name: 'Verde', value: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
    { name: 'Arancione', value: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
    { name: 'Rosso', value: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
    { name: 'Blu', value: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' },
    { name: 'Rosa', value: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' },
    { name: 'Ciano', value: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' },
    { name: 'Indaco', value: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' },
];

export default function AdminEmailTemplates() {
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
    const [formData, setFormData] = useState<Omit<EmailTemplate, 'id'>>(DEFAULT_TEMPLATE);
    const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null);

    const fetchTemplates = async () => {
        try {
            const data = await getEmailTemplates();
            setTemplates(data);
        } catch (error) {
            console.error('Failed to fetch email templates:', error);
            toast.error('Errore nel caricamento dei template');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleOpenCreate = () => {
        setEditingTemplate(null);
        setFormData(DEFAULT_TEMPLATE);
        setIsDialogOpen(true);
    };

    const handleOpenEdit = (template: EmailTemplate) => {
        setEditingTemplate(template);
        setFormData({
            type: template.type,
            name: template.name,
            subject: template.subject,
            headerTitle: template.headerTitle,
            headerColor: template.headerColor,
            bodyContent: template.bodyContent,
            buttonText: template.buttonText,
            isActive: template.isActive,
        });
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name.trim() || !formData.subject.trim()) {
            toast.error('Compila tutti i campi obbligatori');
            return;
        }

        setIsSaving(true);
        try {
            if (editingTemplate) {
                await updateEmailTemplate(editingTemplate.id, formData);
                toast.success('Template aggiornato');
            } else {
                await addEmailTemplate(formData);
                toast.success('Template creato');
            }
            setIsDialogOpen(false);
            fetchTemplates();
        } catch (error) {
            console.error('Failed to save template:', error);
            toast.error('Errore nel salvataggio');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!templateToDelete) return;

        try {
            await deleteEmailTemplate(templateToDelete.id);
            toast.success('Template eliminato');
            setTemplateToDelete(null);
            fetchTemplates();
        } catch (error) {
            console.error('Failed to delete template:', error);
            toast.error('Errore nell\'eliminazione');
        }
    };

    const handleToggleActive = async (template: EmailTemplate) => {
        try {
            await updateEmailTemplate(template.id, { isActive: !template.isActive });
            fetchTemplates();
            toast.success(template.isActive ? 'Template disattivato' : 'Template attivato');
        } catch (error) {
            console.error('Failed to toggle template:', error);
            toast.error('Errore');
        }
    };

    const insertPlaceholder = (placeholder: string) => {
        setFormData(prev => ({
            ...prev,
            bodyContent: prev.bodyContent + ' ' + placeholder
        }));
    };

    const getNotificationTypeLabel = (type: NotificationType) => {
        for (const category of NOTIFICATION_TYPES) {
            const found = category.types.find(t => t.value === type);
            if (found) return found.label;
        }
        return type;
    };

    const getPlaceholdersForType = (type: NotificationType) => {
        const placeholders = [...EMAIL_TEMPLATE_PLACEHOLDERS.common];

        if (type.startsWith('task_')) {
            placeholders.push(...EMAIL_TEMPLATE_PLACEHOLDERS.task);
        } else if (type.startsWith('project_')) {
            placeholders.push(...EMAIL_TEMPLATE_PLACEHOLDERS.project);
        } else if (type.startsWith('absence_')) {
            placeholders.push(...EMAIL_TEMPLATE_PLACEHOLDERS.absence);
        } else if (type.startsWith('chat_')) {
            placeholders.push(...EMAIL_TEMPLATE_PLACEHOLDERS.chat);
        } else if (type.startsWith('brief_')) {
            placeholders.push(...EMAIL_TEMPLATE_PLACEHOLDERS.brief);
        } else if (type.startsWith('editorial_')) {
            placeholders.push(...EMAIL_TEMPLATE_PLACEHOLDERS.editorial);
        } else if (type.startsWith('calendar_')) {
            placeholders.push(...EMAIL_TEMPLATE_PLACEHOLDERS.calendar);
        }

        return placeholders;
    };

    const generatePreviewHtml = () => {
        const sampleData: Record<string, string> = {
            userName: 'Mario Rossi',
            taskTitle: 'Creazione logo aziendale',
            taskId: '123',
            priority: 'Alta',
            dueDate: new Date().toLocaleDateString('it-IT'),
            assignedBy: 'Admin',
            approverName: 'Project Manager',
            requesterName: 'Designer',
            reason: 'Necessarie alcune modifiche ai colori',
            projectName: 'Rebranding Q1',
            projectId: '456',
            clientName: 'Acme Corp',
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('it-IT'),
            days: '7',
            type: 'Ferie',
            startDate: new Date().toLocaleDateString('it-IT'),
            endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('it-IT'),
            senderName: 'Collega',
            preview: 'Ciao, ho una domanda...',
            conversationName: 'Team Design',
            groupName: 'Marketing',
            count: '5',
            briefTitle: 'Brief Campagna Social',
            topic: 'Post Instagram',
            eventTitle: 'Call con cliente',
            date: 'Oggi alle 15:00',
            link: '#',
        };

        let content = formData.bodyContent;
        Object.entries(sampleData).forEach(([key, value]) => {
            content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
        });

        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .email-header { padding: 30px; text-align: center; }
        .email-header h1 { color: white; margin: 0; font-size: 24px; font-weight: 600; }
        .email-body { padding: 40px 30px; color: #374151; line-height: 1.6; }
        .email-body p { margin: 0 0 15px 0; }
        .email-highlight { background: #f3f4f6; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .email-highlight strong { color: #1f2937; display: block; margin-bottom: 5px; }
        .email-button { display: inline-block; padding: 14px 32px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 500; }
        .email-footer { background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; }
        .email-footer p { color: #6b7280; font-size: 13px; margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="email-header" style="background: ${formData.headerColor};">
            <h1>${formData.headerTitle || 'Titolo Email'}</h1>
        </div>
        <div class="email-body">
            ${content}
            <div style="text-align: center; margin-top: 30px;">
                <a href="#" class="email-button" style="background: ${formData.headerColor};">${formData.buttonText}</a>
            </div>
        </div>
        <div class="email-footer">
            <p><strong>W[r]Digital Hub</strong></p>
            <p>Notifica automatica - Non rispondere a questa email.</p>
        </div>
    </div>
</body>
</html>`;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Template Email</h2>
                    <p className="text-muted-foreground">
                        Personalizza i template delle email di notifica inviate agli utenti.
                    </p>
                </div>
                <Button onClick={handleOpenCreate} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nuovo Template
                </Button>
            </div>

            {templates.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Mail className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <p className="text-muted-foreground text-center">
                            Nessun template personalizzato.<br />
                            I template di default verranno utilizzati per le notifiche.
                        </p>
                        <Button onClick={handleOpenCreate} variant="outline" className="mt-4 gap-2">
                            <Plus className="h-4 w-4" />
                            Crea il primo template
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {templates.map(template => (
                        <Card key={template.id} className={!template.isActive ? 'opacity-60' : ''}>
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-base">{template.name}</CardTitle>
                                        <CardDescription className="text-xs mt-1">
                                            {getNotificationTypeLabel(template.type)}
                                        </CardDescription>
                                    </div>
                                    <Badge variant={template.isActive ? 'default' : 'secondary'}>
                                        {template.isActive ? 'Attivo' : 'Inattivo'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div
                                    className="h-2 rounded-full mb-3"
                                    style={{ background: template.headerColor }}
                                />
                                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                                    Oggetto: {template.subject}
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 gap-1"
                                        onClick={() => handleOpenEdit(template)}
                                    >
                                        <Pencil className="h-3 w-3" />
                                        Modifica
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleToggleActive(template)}
                                    >
                                        {template.isActive ? 'Disattiva' : 'Attiva'}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => setTemplateToDelete(template)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>
                            {editingTemplate ? 'Modifica Template' : 'Nuovo Template Email'}
                        </DialogTitle>
                        <DialogDescription>
                            Personalizza il template dell'email. Usa i segnaposto per inserire dati dinamici.
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="content" className="flex-1 overflow-hidden">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="content">Contenuto</TabsTrigger>
                            <TabsTrigger value="style">Stile</TabsTrigger>
                            <TabsTrigger value="preview">Anteprima</TabsTrigger>
                        </TabsList>

                        <ScrollArea className="flex-1 mt-4 h-[400px]">
                            <TabsContent value="content" className="space-y-4 pr-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Nome Template *</Label>
                                        <Input
                                            id="name"
                                            value={formData.name}
                                            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="es. Task Assegnato - Custom"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="type">Tipo Notifica</Label>
                                        <Select
                                            value={formData.type}
                                            onValueChange={value => setFormData(prev => ({ ...prev, type: value as NotificationType }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {NOTIFICATION_TYPES.map(category => (
                                                    <div key={category.category}>
                                                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                                                            {category.category}
                                                        </div>
                                                        {category.types.map(type => (
                                                            <SelectItem key={type.value} value={type.value}>
                                                                {type.label}
                                                            </SelectItem>
                                                        ))}
                                                    </div>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="subject">Oggetto Email *</Label>
                                    <Input
                                        id="subject"
                                        value={formData.subject}
                                        onChange={e => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                                        placeholder="es. Nuovo task assegnato: {{taskTitle}}"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="headerTitle">Titolo Header</Label>
                                    <Input
                                        id="headerTitle"
                                        value={formData.headerTitle}
                                        onChange={e => setFormData(prev => ({ ...prev, headerTitle: e.target.value }))}
                                        placeholder="es. 📋 Nuovo Task Assegnato"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="bodyContent">Contenuto Email (HTML)</Label>
                                        <div className="flex items-center gap-1">
                                            <Code2 className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">Supporta HTML</span>
                                        </div>
                                    </div>
                                    <Textarea
                                        id="bodyContent"
                                        value={formData.bodyContent}
                                        onChange={e => setFormData(prev => ({ ...prev, bodyContent: e.target.value }))}
                                        rows={8}
                                        className="font-mono text-sm"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Segnaposto Disponibili</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {getPlaceholdersForType(formData.type).map(placeholder => (
                                            <Badge
                                                key={placeholder}
                                                variant="outline"
                                                className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                                                onClick={() => insertPlaceholder(placeholder)}
                                            >
                                                <Copy className="h-3 w-3 mr-1" />
                                                {placeholder}
                                            </Badge>
                                        ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Clicca su un segnaposto per inserirlo nel contenuto.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="buttonText">Testo Pulsante</Label>
                                    <Input
                                        id="buttonText"
                                        value={formData.buttonText}
                                        onChange={e => setFormData(prev => ({ ...prev, buttonText: e.target.value }))}
                                        placeholder="es. Visualizza Task"
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="style" className="space-y-4 pr-4">
                                <div className="space-y-2">
                                    <Label>Colore Header</Label>
                                    <div className="grid grid-cols-4 gap-3">
                                        {GRADIENT_PRESETS.map(preset => (
                                            <button
                                                key={preset.name}
                                                onClick={() => setFormData(prev => ({ ...prev, headerColor: preset.value }))}
                                                className={`h-12 rounded-lg transition-all ${formData.headerColor === preset.value
                                                        ? 'ring-2 ring-offset-2 ring-primary'
                                                        : 'hover:scale-105'
                                                    }`}
                                                style={{ background: preset.value }}
                                                title={preset.name}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="customGradient">Gradiente Personalizzato</Label>
                                    <Input
                                        id="customGradient"
                                        value={formData.headerColor}
                                        onChange={e => setFormData(prev => ({ ...prev, headerColor: e.target.value }))}
                                        placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                                        className="font-mono text-sm"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div>
                                        <Label htmlFor="isActive" className="font-medium">Template Attivo</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Solo i template attivi vengono utilizzati per le notifiche.
                                        </p>
                                    </div>
                                    <Switch
                                        id="isActive"
                                        checked={formData.isActive}
                                        onCheckedChange={checked => setFormData(prev => ({ ...prev, isActive: checked }))}
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="preview" className="pr-4">
                                <div className="border rounded-lg overflow-hidden">
                                    <div className="bg-muted px-4 py-2 flex items-center justify-between">
                                        <span className="text-sm font-medium">Anteprima Email</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsPreviewOpen(true)}
                                        >
                                            <Eye className="h-4 w-4 mr-1" />
                                            Ingrandisci
                                        </Button>
                                    </div>
                                    <iframe
                                        srcDoc={generatePreviewHtml()}
                                        className="w-full h-[400px] bg-gray-100"
                                        title="Email Preview"
                                    />
                                </div>
                            </TabsContent>
                        </ScrollArea>
                    </Tabs>

                    <DialogFooter className="pt-4 border-t">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Annulla
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingTemplate ? 'Salva Modifiche' : 'Crea Template'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Full Preview Dialog */}
            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-3xl h-[80vh]">
                    <DialogHeader>
                        <DialogTitle>Anteprima Email Completa</DialogTitle>
                    </DialogHeader>
                    <iframe
                        srcDoc={generatePreviewHtml()}
                        className="w-full flex-1 bg-gray-100 rounded-lg"
                        title="Email Preview Full"
                    />
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!templateToDelete} onOpenChange={() => setTemplateToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Elimina Template</AlertDialogTitle>
                        <AlertDialogDescription>
                            Sei sicuro di voler eliminare il template "{templateToDelete?.name}"?
                            Questa azione non può essere annullata.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                            Elimina
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
