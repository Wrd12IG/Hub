'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getRecurringTasks,
  addRecurringTask,
  updateRecurringTask,
  deleteRecurringTask,
  addTask,
} from '@/lib/actions';
import type { RecurringTask, User, Client, Project, ActivityType, Task } from '@/lib/data';
import { allTaskPriorities } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, MoreVertical, Trash2, Edit, X, Loader2, Play, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useLayoutData } from '@/app/(app)/layout-context';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';


const daysOfWeek = [
  { value: 1, label: 'Lunedì' },
  { value: 2, label: 'Martedì' },
  { value: 3, label: 'Mercoledì' },
  { value: 4, 'label': 'Giovedì' },
  { value: 5, label: 'Venerdì' },
  { value: 6, label: 'Sabato' },
  { value: 0, label: 'Domenica' },
];

const weeksOfMonth = [
  { value: 1, label: 'Prima' },
  { value: 2, label: 'Seconda' },
  { value: 3, label: 'Terza' },
  { value: 4, label: 'Quarta' },
];

export default function RecurringTasksPage() {
  const { users, clients, allProjects, activityTypes, allTasks, usersById, refetchData, currentUser } = useLayoutData();
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState<'create' | 'edit' | null>(null);
  const [editingTask, setEditingTask] = useState<RecurringTask | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<RecurringTask | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const { toast } = useToast();

  // Stato per generazione task per data specifica
  const [datePickerModalOpen, setDatePickerModalOpen] = useState(false);
  const [taskForDatePicker, setTaskForDatePicker] = useState<RecurringTask | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isGenerating, setIsGenerating] = useState<string | null>(null);


  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const tasksData = await getRecurringTasks();
      setRecurringTasks(tasksData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast({ title: 'Errore', description: 'Impossibile caricare i dati.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCloseModal = () => {
    setModalOpen(null);
    setEditingTask(null);
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const definition: Omit<RecurringTask, 'id' | 'createdAt'> = {
      title: formData.get('title') as string,
      description: (formData.get('description') as string) || undefined,
      priority: formData.get('priority') as Task['priority'],
      clientId: formData.get('clientId') as string,
      projectId: (formData.get('projectId') as string) || undefined,
      activityType: (formData.get('activityType') as string) || undefined,
      estimatedDuration: Number(formData.get('estimatedDuration')),
      assignedUserId: (formData.get('assignedUserId') as string) || undefined,
      isActive: formData.get('isActive') === 'on',
      recurrence: {
        type: formData.get('type') as RecurringTask['recurrence']['type'],
        time: formData.get('time') as string,
        dayOfWeek: formData.has('dayOfWeek') ? Number(formData.get('dayOfWeek')) : undefined,
        weekOfMonth: formData.has('weekOfMonth') ? Number(formData.get('weekOfMonth')) : undefined,

      },
    };

    try {
      if (modalOpen === 'create') {
        await addRecurringTask({ ...definition, createdAt: new Date().toISOString() });
        toast({ title: 'Successo', description: 'Task ricorrente creato.' });
      } else if (editingTask) {
        await updateRecurringTask(editingTask.id, definition);
        toast({ title: 'Successo', description: 'Task ricorrente aggiornato.' });
      }
      fetchData();
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save recurring task:', error);
      toast({ title: 'Errore', description: 'Impossibile salvare il task ricorrente.', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!taskToDelete) return;
    try {
      await deleteRecurringTask(taskToDelete.id);
      toast({ title: 'Successo', description: 'Task ricorrente eliminato.' });
      setTaskToDelete(null);
      fetchData();
    } catch (e) {
      toast({ title: 'Errore', description: 'Impossibile eliminare il task.', variant: 'destructive' });
    }
  }

  const handleDeleteSelected = async () => {
    try {
      await Promise.all(selectedTaskIds.map(id => deleteRecurringTask(id)));
      toast({ title: 'Successo', description: `${selectedTaskIds.length} definizioni sono state eliminate.` });
      setSelectedTaskIds([]);
      fetchData();
    } catch (e) {
      toast({ title: 'Errore', description: 'Impossibile eliminare le definizioni selezionate.', variant: 'destructive' });
    }
  }

  const formatRecurrence = (recurrence: RecurringTask['recurrence']) => {
    const { type, time, dayOfWeek, weekOfMonth } = recurrence;
    if (type === 'daily') return `Ogni giorno alle ${time}`;
    if (type === 'weekly') return `Ogni ${daysOfWeek.find(d => d.value === dayOfWeek)?.label} alle ${time}`;
    if (type === 'monthly') return `Il ${weeksOfMonth.find(w => w.value === weekOfMonth)?.label} ${daysOfWeek.find(d => d.value === dayOfWeek)?.label} di ogni mese alle ${time}`;
    return 'N/D';
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTaskIds(recurringTasks.map(t => t.id));
    } else {
      setSelectedTaskIds([]);
    }
  };

  const handleSelectOne = (taskId: string, checked: boolean) => {
    if (checked) {
      setSelectedTaskIds(prev => [...prev, taskId]);
    } else {
      setSelectedTaskIds(prev => prev.filter(id => id !== taskId));
    }
  };

  // Handler per aprire il modal di selezione data
  const handleOpenDatePicker = (template: RecurringTask) => {
    setTaskForDatePicker(template);
    setSelectedDate(new Date());
    setDatePickerModalOpen(true);
  };

  // Genera task per data specifica
  const handleGenerateForDate = async () => {
    if (!taskForDatePicker) return;
    setIsGenerating(taskForDatePicker.id);

    try {
      const newTask: Omit<Task, 'id'> = {
        title: taskForDatePicker.title,
        description: taskForDatePicker.description || '',
        priority: taskForDatePicker.priority,
        clientId: taskForDatePicker.clientId,
        projectId: taskForDatePicker.projectId,
        status: 'Da Fare',
        dueDate: selectedDate.toISOString(),
        assignedUserId: taskForDatePicker.assignedUserId,
        estimatedDuration: taskForDatePicker.estimatedDuration,
        actualDuration: 0,
        timeSpent: 0,
        attachments: [],
        comments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activityType: taskForDatePicker.activityType,
      };

      await addTask(newTask, currentUser?.id || 'system');

      toast({ title: 'Successo', description: `Task "${taskForDatePicker.title}" creato per ${format(selectedDate, 'dd/MM/yyyy')}` });
      await refetchData('tasks');
      fetchData();
    } catch (error: any) {
      console.error(error);
      toast({ title: 'Errore', description: `Errore: ${error.message}`, variant: 'destructive' });
    } finally {
      setIsGenerating(null);
      setDatePickerModalOpen(false);
      setTaskForDatePicker(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Task Ricorrenti</h1>
          <p className="text-muted-foreground">Crea e gestisci task che si ripetono automaticamente.</p>
        </div>
        <Button onClick={() => setModalOpen('create')}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nuovo Task Ricorrente
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco Task Ricorrenti</CardTitle>
          {selectedTaskIds.length > 0 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{selectedTaskIds.length} selezionat{selectedTaskIds.length > 1 ? 'i' : 'o'}</p>
              <div className="space-x-2">
                <Button variant="outline" size="sm" disabled>
                  <Edit className="mr-2 h-4 w-4" /> Modifica Selezionati
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                  <Trash2 className="mr-2 h-4 w-4" /> Elimina Selezionati
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedTaskIds([])}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <CardDescription>Visualizza e gestisci tutte le definizioni di task ricorrenti.</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    checked={selectedTaskIds.length === recurringTasks.length && recurringTasks.length > 0}
                    aria-label="Seleziona tutto"
                  />
                </TableHead>
                <TableHead>Titolo Task</TableHead>
                <TableHead>Ricorrenza</TableHead>
                <TableHead>Assegnato a</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-5" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : recurringTasks.length > 0 ? (
                recurringTasks.map(task => (
                  <TableRow key={task.id} data-state={selectedTaskIds.includes(task.id) && "selected"}>
                    <TableCell>
                      <Checkbox
                        onCheckedChange={(checked) => handleSelectOne(task.id, !!checked)}
                        checked={selectedTaskIds.includes(task.id)}
                        aria-label={`Seleziona task ${task.title}`}
                      />
                    </TableCell>
                    <TableCell>{task.title}</TableCell>
                    <TableCell>{formatRecurrence(task.recurrence)}</TableCell>
                    <TableCell>{task.assignedUserId ? usersById[task.assignedUserId]?.name || task.assignedUserId : 'N/D'}</TableCell>
                    <TableCell>
                      <Badge variant={task.isActive ? 'default' : 'secondary'}>{task.isActive ? 'Attivo' : 'Inattivo'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => { setEditingTask(task); setModalOpen('edit'); }}>
                            <Edit className="mr-2 h-4 w-4" /> Modifica
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenDatePicker(task)}>
                            <Calendar className="mr-2 h-4 w-4" /> Genera per data
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setTaskToDelete(task)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Elimina
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">Nessun task ricorrente trovato.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RecurringTaskForm
        isOpen={!!modalOpen}
        onClose={handleCloseModal}
        onSubmit={handleFormSubmit}
        task={editingTask}
        users={users}
        clients={clients}
        projects={allProjects}
        activityTypes={activityTypes}
        allTasks={allTasks}
      />
      <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
            <AlertDialogDescription>Questa azione non può essere annullata. Questo eliminerà permanentemente la definizione del task ricorrente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTaskToDelete(null)}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal per selezione data di generazione */}
      <Dialog open={datePickerModalOpen} onOpenChange={setDatePickerModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Genera task per data specifica</DialogTitle>
            <DialogDescription>
              Seleziona la data di scadenza per il task "{taskForDatePicker?.title}".
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 flex flex-col items-center">
            <Label className="mb-2 self-start">Data di scadenza</Label>
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              locale={it}
              className="rounded-md border"
            />
            <p className="mt-2 text-sm text-muted-foreground">
              Data selezionata: <strong>{format(selectedDate, 'dd MMMM yyyy', { locale: it })}</strong>
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDatePickerModalOpen(false)}>Annulla</Button>
            <Button onClick={handleGenerateForDate} disabled={isGenerating === taskForDatePicker?.id}>
              {isGenerating === taskForDatePicker?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Genera Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface RecurringTaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  task: RecurringTask | null;
  users: User[];
  clients: Client[];
  projects: Project[];
  activityTypes: ActivityType[];
  allTasks: Task[];
}

function RecurringTaskForm({ isOpen, onClose, onSubmit, task, users, clients, projects, activityTypes, allTasks }: RecurringTaskFormProps) {
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly' | 'monthly'>((task?.recurrence.type as any) || 'daily');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (task) setRecurrenceType(task.recurrence.type as any);
    else setRecurrenceType('daily');
  }, [task]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setIsSubmitting(true);
    await onSubmit(e);
    setIsSubmitting(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{task ? 'Modifica Task Ricorrente' : 'Crea Nuovo Task Ricorrente'}</DialogTitle>
          <DialogDescription>Compila i dettagli per definire la creazione automatica del task.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4 max-h-[80vh] overflow-y-auto pr-4">
          {/* Sezione Definizione */}
          <Card>
            <CardHeader><CardTitle>Impostazioni</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end">
                <div className="flex items-center space-x-2">
                  <Switch id="isActive" name="isActive" defaultChecked={task?.isActive ?? true} />
                  <Label htmlFor="isActive">Attivo</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dettagli Task</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label htmlFor="title">Titolo Task</Label><Input id="title" name="title" required defaultValue={task?.title} /></div>
              <div><Label htmlFor="description">Descrizione</Label><Textarea id="description" name="description" defaultValue={task?.description} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="priority">Priorità</Label><Select name="priority" required defaultValue={task?.priority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{allTaskPriorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                <div><Label htmlFor="estimatedDuration">Durata Stimata (min)</Label><Input id="estimatedDuration" name="estimatedDuration" type="number" required defaultValue={task?.estimatedDuration} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="clientId">Cliente</Label><Select name="clientId" required defaultValue={task?.clientId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[...clients].sort((a, b) => a.name.localeCompare(b.name)).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label htmlFor="projectId">Progetto (Opzionale)</Label><Select name="projectId" defaultValue={task?.projectId || undefined}><SelectTrigger><SelectValue placeholder="Nessun Progetto" /></SelectTrigger><SelectContent>{[...projects].sort((a, b) => a.name.localeCompare(b.name)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="activityType">Tipo Attività</Label><Select name="activityType" required defaultValue={task?.activityType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[...activityTypes].sort((a, b) => a.name.localeCompare(b.name)).map(at => <SelectItem key={at.id} value={at.name}>{at.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label htmlFor="assignedUserId">Assegna a (Opzionale)</Label><Select name="assignedUserId" defaultValue={task?.assignedUserId || undefined}><SelectTrigger><SelectValue placeholder="Nessun utente assegnato" /></SelectTrigger><SelectContent>{[...users].sort((a, b) => a.name.localeCompare(b.name)).map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select></div>
              </div>
            </CardContent>
          </Card>

          {/* Sezione Ricorrenza */}
          <Card>
            <CardHeader><CardTitle>Ricorrenza</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="type">Tipo di Ricorrenza</Label>
                <Select name="type" required value={recurrenceType} onValueChange={(v) => setRecurrenceType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Giornaliera</SelectItem>
                    <SelectItem value="weekly">Settimanale</SelectItem>
                    <SelectItem value="monthly">Mensile</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {recurrenceType === 'weekly' || recurrenceType === 'monthly' ? (
                  <div>
                    <Label htmlFor="dayOfWeek">Giorno della settimana</Label>
                    <Select name="dayOfWeek" required defaultValue={task?.recurrence.dayOfWeek?.toString()}>
                      <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                      <SelectContent>{daysOfWeek.map(d => <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ) : <div />}
                <div>
                  <Label htmlFor="time">Orario</Label>
                  <Input id="time" name="time" type="time" required defaultValue={task?.recurrence.time || '09:00'} />
                </div>
              </div>
              {recurrenceType === 'monthly' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="weekOfMonth">Settimana del mese</Label>
                    <Select name="weekOfMonth" required defaultValue={task?.recurrence.weekOfMonth?.toString()}>
                      <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                      <SelectContent>{weeksOfMonth.map(w => <SelectItem key={w.value} value={w.value.toString()}>{w.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {task ? 'Salva Modifiche' : 'Crea Task Ricorrente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
