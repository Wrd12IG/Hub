'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Zap,
    Play,
    Pause,
    Plus,
    Settings2,
    Clock,
    Bell,
    Mail,
    CheckCircle,
    AlertCircle,
    RefreshCw,
    Trash2,
    Edit,
    History,
    Loader2,
    Send,
    CalendarClock,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { DEFAULT_AUTOMATION_RULES, type AutomationRule, type AutomationLog } from '@/lib/automation-types';

interface AutomationRuleWithFirestore extends AutomationRule {
    id: string;
}

const TRIGGER_LABELS: Record<string, string> = {
    'task_created': '📝 Task Creato',
    'task_updated': '✏️ Task Aggiornato',
    'task_due_soon': '⏰ Task in Scadenza',
    'task_overdue': '🚨 Task Scaduto',
    'task_stuck': '⏳ Task Bloccato',
    'project_status_change': '📊 Cambio Stato Progetto',
    'brief_approved': '✅ Brief Approvato',
    'time_based': '🕐 Schedulato',
};

const ACTION_LABELS: Record<string, string> = {
    'send_notification': '🔔 Invia Notifica',
    'send_email': '📧 Invia Email',
    'update_field': '📝 Aggiorna Campo',
    'create_task': '➕ Crea Task',
    'add_label': '🏷️ Aggiungi Etichetta',
};

export function AdminAutomations() {
    const [rules, setRules] = useState<AutomationRuleWithFirestore[]>([]);
    const [logs, setLogs] = useState<AutomationLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRunning, setIsRunning] = useState(false);
    const [showNewRuleDialog, setShowNewRuleDialog] = useState(false);

    // New rule form state
    const [newRule, setNewRule] = useState({
        name: '',
        description: '',
        triggerType: 'task_due_soon',
        actionType: 'send_notification',
        isActive: true,
    });

    // Load rules and logs
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Load rules
            const rulesSnapshot = await getDocs(collection(db, 'automation_rules'));
            const rulesData = rulesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as AutomationRuleWithFirestore[];

            // If no rules exist, initialize with defaults
            if (rulesData.length === 0) {
                // Initialize default rules
                for (const rule of DEFAULT_AUTOMATION_RULES) {
                    await addDoc(collection(db, 'automation_rules'), {
                        ...rule,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        createdBy: 'system'
                    });
                }
                // Reload
                const newSnapshot = await getDocs(collection(db, 'automation_rules'));
                setRules(newSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as AutomationRuleWithFirestore[]);
            } else {
                setRules(rulesData);
            }

            // Load logs
            const logsSnapshot = await getDocs(
                query(collection(db, 'automation_logs'), orderBy('executedAt', 'desc'), limit(50))
            );
            setLogs(logsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as AutomationLog[]);
        } catch (error) {
            console.error('Error loading automation data:', error);
            toast.error('Errore nel caricamento delle automazioni');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Toggle rule active state
    const toggleRule = async (ruleId: string, isActive: boolean) => {
        try {
            await updateDoc(doc(db, 'automation_rules', ruleId), {
                isActive,
                updatedAt: new Date().toISOString()
            });
            setRules(prev => prev.map(r =>
                r.id === ruleId ? { ...r, isActive } : r
            ));
            toast.success(isActive ? 'Automazione attivata' : 'Automazione disattivata');
        } catch (error) {
            console.error('Error toggling rule:', error);
            toast.error('Errore nell\'aggiornamento');
        }
    };

    // Run automations manually
    const runAutomations = async (type: string = 'all') => {
        setIsRunning(true);
        try {
            const response = await fetch(`/api/automations/run?type=${type}`, {
                method: 'POST',
                headers: {
                    'x-automation-secret': process.env.NEXT_PUBLIC_AUTOMATION_SECRET || 'default-automation-key'
                }
            });

            const result = await response.json();

            if (response.ok) {
                toast.success(`Automazioni eseguite con successo!`);
                // Reload logs
                loadData();
            } else {
                toast.error(`Errore: ${result.error}`);
            }
        } catch (error) {
            console.error('Error running automations:', error);
            toast.error('Errore nell\'esecuzione delle automazioni');
        } finally {
            setIsRunning(false);
        }
    };

    // Delete rule
    const deleteRule = async (ruleId: string) => {
        try {
            await deleteDoc(doc(db, 'automation_rules', ruleId));
            setRules(prev => prev.filter(r => r.id !== ruleId));
            toast.success('Regola eliminata');
        } catch (error) {
            console.error('Error deleting rule:', error);
            toast.error('Errore nell\'eliminazione');
        }
    };

    // Create new rule
    const createRule = async () => {
        try {
            const ruleData: Omit<AutomationRule, 'id'> = {
                name: newRule.name,
                description: newRule.description,
                isActive: newRule.isActive,
                trigger: {
                    type: newRule.triggerType as any,
                    conditions: []
                },
                actions: [{
                    type: newRule.actionType as any,
                    config: {}
                }],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: 'admin'
            };

            await addDoc(collection(db, 'automation_rules'), ruleData);
            toast.success('Regola creata con successo!');
            setShowNewRuleDialog(false);
            setNewRule({
                name: '',
                description: '',
                triggerType: 'task_due_soon',
                actionType: 'send_notification',
                isActive: true,
            });
            loadData();
        } catch (error) {
            console.error('Error creating rule:', error);
            toast.error('Errore nella creazione della regola');
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Zap className="h-6 w-6 text-yellow-500" />
                        Automazioni
                    </h2>
                    <p className="text-muted-foreground">
                        Configura regole automatiche per task, notifiche e email
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => runAutomations('all')}
                        disabled={isRunning}
                    >
                        {isRunning ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Play className="h-4 w-4 mr-2" />
                        )}
                        Esegui Ora
                    </Button>
                    <Dialog open={showNewRuleDialog} onOpenChange={setShowNewRuleDialog}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Nuova Regola
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Crea Nuova Automazione</DialogTitle>
                                <DialogDescription>
                                    Definisci una regola automatica per il tuo workflow
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Nome Regola</Label>
                                    <Input
                                        value={newRule.name}
                                        onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                                        placeholder="Es: Notifica task urgenti"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Descrizione</Label>
                                    <Textarea
                                        value={newRule.description}
                                        onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                                        placeholder="Descrivi cosa fa questa automazione..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Quando (Trigger)</Label>
                                    <Select
                                        value={newRule.triggerType}
                                        onValueChange={(v) => setNewRule({ ...newRule, triggerType: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(TRIGGER_LABELS).map(([key, label]) => (
                                                <SelectItem key={key} value={key}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Azione</Label>
                                    <Select
                                        value={newRule.actionType}
                                        onValueChange={(v) => setNewRule({ ...newRule, actionType: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(ACTION_LABELS).map(([key, label]) => (
                                                <SelectItem key={key} value={key}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        checked={newRule.isActive}
                                        onCheckedChange={(v) => setNewRule({ ...newRule, isActive: v })}
                                    />
                                    <Label>Attiva immediatamente</Label>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowNewRuleDialog(false)}>
                                    Annulla
                                </Button>
                                <Button onClick={createRule} disabled={!newRule.name}>
                                    Crea Regola
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Regole Attive</p>
                                <p className="text-2xl font-bold">
                                    {rules.filter(r => r.isActive).length}/{rules.length}
                                </p>
                            </div>
                            <Zap className="h-8 w-8 text-yellow-500 opacity-50" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Esecuzioni Oggi</p>
                                <p className="text-2xl font-bold">
                                    {logs.filter(l => {
                                        const logDate = parseISO(l.executedAt);
                                        return format(logDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                                    }).length}
                                </p>
                            </div>
                            <Play className="h-8 w-8 text-green-500 opacity-50" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Successi</p>
                                <p className="text-2xl font-bold text-green-500">
                                    {logs.filter(l => l.status === 'success').length}
                                </p>
                            </div>
                            <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Errori</p>
                                <p className="text-2xl font-bold text-red-500">
                                    {logs.filter(l => l.status === 'failed').length}
                                </p>
                            </div>
                            <AlertCircle className="h-8 w-8 text-red-500 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="rules" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="rules">
                        <Settings2 className="h-4 w-4 mr-2" />
                        Regole
                    </TabsTrigger>
                    <TabsTrigger value="schedule">
                        <CalendarClock className="h-4 w-4 mr-2" />
                        Schedulazioni
                    </TabsTrigger>
                    <TabsTrigger value="logs">
                        <History className="h-4 w-4 mr-2" />
                        Cronologia
                    </TabsTrigger>
                </TabsList>

                {/* Rules Tab */}
                <TabsContent value="rules">
                    <Card>
                        <CardHeader>
                            <CardTitle>Regole di Automazione</CardTitle>
                            <CardDescription>
                                Gestisci le regole che automatizzano il tuo workflow
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {rules.map((rule) => (
                                    <div
                                        key={rule.id}
                                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex items-start gap-4">
                                            <Switch
                                                checked={rule.isActive}
                                                onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                                            />
                                            <div>
                                                <h4 className="font-medium">{rule.name}</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    {rule.description}
                                                </p>
                                                <div className="flex gap-2 mt-2">
                                                    <Badge variant="outline">
                                                        {TRIGGER_LABELS[rule.trigger.type] || rule.trigger.type}
                                                    </Badge>
                                                    {rule.actions.map((action, i) => (
                                                        <Badge key={i} variant="secondary">
                                                            {ACTION_LABELS[action.type] || action.type}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                                                {rule.isActive ? 'Attiva' : 'Disattivata'}
                                            </Badge>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => deleteRule(rule.id)}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Schedule Tab */}
                <TabsContent value="schedule">
                    <Card>
                        <CardHeader>
                            <CardTitle>Schedulazioni Automatiche</CardTitle>
                            <CardDescription>
                                Attività eseguite automaticamente a intervalli regolari
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {/* Due Soon Check */}
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-yellow-500/10 rounded-lg">
                                            <Clock className="h-5 w-5 text-yellow-500" />
                                        </div>
                                        <div>
                                            <h4 className="font-medium">Controllo Task in Scadenza</h4>
                                            <p className="text-sm text-muted-foreground">
                                                Notifica utenti per task in scadenza entro 24h
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => runAutomations('due_soon')}
                                        disabled={isRunning}
                                    >
                                        <Play className="h-4 w-4 mr-2" />
                                        Esegui
                                    </Button>
                                </div>

                                {/* Overdue Check */}
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-red-500/10 rounded-lg">
                                            <AlertCircle className="h-5 w-5 text-red-500" />
                                        </div>
                                        <div>
                                            <h4 className="font-medium">Controllo Task Scaduti</h4>
                                            <p className="text-sm text-muted-foreground">
                                                Notifica admin per task oltre la scadenza
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => runAutomations('overdue')}
                                        disabled={isRunning}
                                    >
                                        <Play className="h-4 w-4 mr-2" />
                                        Esegui
                                    </Button>
                                </div>

                                {/* Stuck Tasks Check */}
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-orange-500/10 rounded-lg">
                                            <Pause className="h-5 w-5 text-orange-500" />
                                        </div>
                                        <div>
                                            <h4 className="font-medium">Controllo Task Bloccati</h4>
                                            <p className="text-sm text-muted-foreground">
                                                Task in approvazione da oltre 48h
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => runAutomations('stuck')}
                                        disabled={isRunning}
                                    >
                                        <Play className="h-4 w-4 mr-2" />
                                        Esegui
                                    </Button>
                                </div>

                                {/* Weekly Report */}
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <Mail className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="font-medium">Report Settimanale</h4>
                                            <p className="text-sm text-muted-foreground">
                                                Invia email riepilogo a tutti gli utenti
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => runAutomations('weekly_report')}
                                        disabled={isRunning}
                                    >
                                        <Send className="h-4 w-4 mr-2" />
                                        Invia Ora
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                                <h4 className="font-medium mb-2">⏰ Esecuzione Automatica</h4>
                                <p className="text-sm text-muted-foreground">
                                    Per eseguire automaticamente queste automazioni, configura un cron job che chiami:
                                </p>
                                <code className="block mt-2 p-2 bg-background rounded text-xs font-mono">
                                    POST /api/automations/run?type=all
                                </code>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Esempio: ogni ora per controlli task, ogni lunedì alle 9:00 per report settimanale
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Logs Tab */}
                <TabsContent value="logs">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Cronologia Esecuzioni</CardTitle>
                                <CardDescription>
                                    Ultime 50 esecuzioni delle automazioni
                                </CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={loadData}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Aggiorna
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Data</TableHead>
                                            <TableHead>Regola</TableHead>
                                            <TableHead>Trigger</TableHead>
                                            <TableHead>Azioni</TableHead>
                                            <TableHead>Stato</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {logs.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell className="text-sm">
                                                    <div className="font-mono">
                                                        {format(parseISO(log.executedAt), 'dd/MM HH:mm')}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {formatDistanceToNow(parseISO(log.executedAt), {
                                                            addSuffix: true,
                                                            locale: it
                                                        })}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-medium">{log.ruleName}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">
                                                        {TRIGGER_LABELS[log.triggerType] || log.triggerType}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-xs max-w-[200px] truncate">
                                                        {log.actionsExecuted.join(', ')}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={
                                                            log.status === 'success' ? 'default' :
                                                                log.status === 'partial' ? 'secondary' : 'destructive'
                                                        }
                                                    >
                                                        {log.status === 'success' ? '✓' :
                                                            log.status === 'partial' ? '⚠' : '✗'}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {logs.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                                    Nessuna esecuzione registrata
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
