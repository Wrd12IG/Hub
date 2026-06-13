'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Save, LayoutDashboard, User as UserIcon, CheckCircle } from 'lucide-react';
import { updateUser } from '@/lib/actions';
import { getInitials } from '@/lib/utils';
import type { User } from '@/lib/data';

// Lista dei widget disponibili per la dashboard utente
const USER_DASHBOARD_WIDGETS = [
    { id: 'kpi_active_tasks', label: 'KPI: Task Attivi', description: 'Numero di task attualmente in lavorazione', category: 'KPI' },
    { id: 'kpi_overdue_tasks', label: 'KPI: Task Scaduti', description: 'Task che hanno superato la data di scadenza', category: 'KPI' },
    { id: 'kpi_active_projects', label: 'KPI: Progetti Attivi', description: 'Numero di progetti in corso', category: 'KPI' },
    { id: 'kpi_completed_tasks', label: 'KPI: Task Completati', description: 'Numero totale di task completati', category: 'KPI' },
    { id: 'chart_work_summary', label: 'Grafico: Riepilogo Lavoro', description: 'Ore stimate vs ore effettive per progetto', category: 'Grafici' },
    { id: 'list_deadlines', label: 'Lista: Prossime Scadenze', description: 'Elenco delle scadenze imminenti', category: 'Liste' },
    { id: 'calendar_personal', label: 'Calendario Personale', description: 'Vista calendario con scadenze e assenze', category: 'Calendario' },
];

const widgetCategories = ['KPI', 'Grafici', 'Liste', 'Calendario'];

interface AdminUserWidgetsProps {
    users: User[];
    onUpdate?: () => void;
}

export default function AdminUserWidgets({ users, onUpdate }: AdminUserWidgetsProps) {
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [editedWidgets, setEditedWidgets] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Filtra solo utenti non admin (gli admin vedono tutto)
    const editableUsers = users.filter(u => u.role !== 'Amministratore');

    // Quando si seleziona un utente, carica i suoi widget visibili
    useEffect(() => {
        if (selectedUserId) {
            const user = users.find(u => u.id === selectedUserId);
            if (user) {
                // Se l'utente non ha widget configurati, mostra tutti di default
                const widgets = user.visibleDashboardWidgets || USER_DASHBOARD_WIDGETS.map(w => w.id);
                setEditedWidgets(widgets);
                setHasChanges(false);
            }
        }
    }, [selectedUserId, users]);

    const handleWidgetToggle = (widgetId: string) => {
        setEditedWidgets(prev => {
            const newWidgets = prev.includes(widgetId)
                ? prev.filter(id => id !== widgetId)
                : [...prev, widgetId];
            setHasChanges(true);
            return newWidgets;
        });
    };

    const handleSelectAll = () => {
        setEditedWidgets(USER_DASHBOARD_WIDGETS.map(w => w.id));
        setHasChanges(true);
    };

    const handleDeselectAll = () => {
        setEditedWidgets([]);
        setHasChanges(true);
    };

    const handleSave = async () => {
        if (!selectedUserId) return;

        setIsSaving(true);
        try {
            await updateUser(selectedUserId, { visibleDashboardWidgets: editedWidgets });
            toast.success('Impostazioni salvate', {
                description: 'I widget della dashboard sono stati aggiornati per questo utente.'
            });
            setHasChanges(false);
            onUpdate?.();
        } catch (error) {
            console.error('Failed to save widget settings:', error);
            toast.error('Errore durante il salvataggio');
        } finally {
            setIsSaving(false);
        }
    };

    const selectedUser = selectedUserId ? users.find(u => u.id === selectedUserId) : null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lista utenti */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UserIcon className="h-5 w-5" />
                        Seleziona Utente
                    </CardTitle>
                    <CardDescription>
                        Scegli un utente per configurare i report visibili nella sua dashboard.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-2">
                            {editableUsers.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    Nessun utente disponibile
                                </p>
                            ) : (
                                editableUsers.map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => setSelectedUserId(user.id)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${selectedUserId === user.id
                                                ? 'bg-primary text-primary-foreground'
                                                : 'hover:bg-muted'
                                            }`}
                                    >
                                        <Avatar className="h-9 w-9">
                                            <AvatarFallback
                                                style={{
                                                    backgroundColor: selectedUserId === user.id ? 'white' : user.color,
                                                    color: selectedUserId === user.id ? 'hsl(var(--primary))' : 'white'
                                                }}
                                            >
                                                {getInitials(user.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{user.name}</p>
                                            <p className={`text-xs truncate ${selectedUserId === user.id
                                                    ? 'text-primary-foreground/70'
                                                    : 'text-muted-foreground'
                                                }`}>
                                                {user.role}
                                            </p>
                                        </div>
                                        {user.visibleDashboardWidgets && (
                                            <Badge variant="secondary" className="shrink-0">
                                                {user.visibleDashboardWidgets.length} widget
                                            </Badge>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Configurazione widget */}
            <Card className="lg:col-span-2">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <LayoutDashboard className="h-5 w-5" />
                                Widget Dashboard
                            </CardTitle>
                            <CardDescription>
                                {selectedUser
                                    ? `Configura i widget visibili per ${selectedUser.name}`
                                    : 'Seleziona un utente per configurare i widget'}
                            </CardDescription>
                        </div>
                        {selectedUser && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSelectAll}
                                >
                                    Seleziona tutti
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDeselectAll}
                                >
                                    Deseleziona tutti
                                </Button>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {!selectedUser ? (
                        <div className="flex flex-col items-center justify-center h-[400px] text-center text-muted-foreground">
                            <LayoutDashboard className="h-12 w-12 mb-4 opacity-20" />
                            <p>Seleziona un utente dalla lista per configurare i widget visibili nella sua dashboard.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <ScrollArea className="h-[350px] pr-4">
                                {widgetCategories.map(category => {
                                    const categoryWidgets = USER_DASHBOARD_WIDGETS.filter(w => w.category === category);
                                    if (categoryWidgets.length === 0) return null;

                                    return (
                                        <div key={category} className="mb-6">
                                            <h4 className="text-sm font-semibold text-muted-foreground mb-3">{category}</h4>
                                            <div className="grid gap-3">
                                                {categoryWidgets.map(widget => (
                                                    <div
                                                        key={widget.id}
                                                        className={`flex items-start p-4 rounded-lg border transition-all cursor-pointer ${editedWidgets.includes(widget.id)
                                                                ? 'border-primary bg-primary/5'
                                                                : 'border-border hover:border-muted-foreground/30'
                                                            }`}
                                                        onClick={() => handleWidgetToggle(widget.id)}
                                                    >
                                                        <Checkbox
                                                            id={widget.id}
                                                            checked={editedWidgets.includes(widget.id)}
                                                            onCheckedChange={() => handleWidgetToggle(widget.id)}
                                                            className="mt-1"
                                                        />
                                                        <div className="ml-3 flex-1">
                                                            <Label
                                                                htmlFor={widget.id}
                                                                className="font-medium cursor-pointer"
                                                            >
                                                                {widget.label}
                                                            </Label>
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                {widget.description}
                                                            </p>
                                                        </div>
                                                        {editedWidgets.includes(widget.id) && (
                                                            <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </ScrollArea>

                            <Separator />

                            <div className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">
                                    <span className="font-medium">{editedWidgets.length}</span> widget selezionati su {USER_DASHBOARD_WIDGETS.length}
                                </div>
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving || !hasChanges}
                                    className="gap-2"
                                >
                                    {isSaving ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4" />
                                    )}
                                    Salva Impostazioni
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
