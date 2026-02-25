'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getRecurringProjects,
  addRecurringProject,
  updateRecurringProject,
  deleteRecurringProject,
  getTaskPrioritySettings,
  addProject,
  addTask, // Add import
} from '@/lib/actions';
import type { RecurringProject, User, Client, ActivityType, TaskTemplate, TaskPrioritySettings, Project, Task, RecurrenceConfig } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PlusCircle, MoreVertical, Trash2, Edit, Loader2, ClipboardList, Pencil, Play, Settings, Copy, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useLayoutData } from '@/app/(app)/layout-context';
import { allTaskPriorities } from '@/lib/data';
import { addDays, format, nextDay, setDay, startOfWeek, addWeeks, startOfMonth, addMonths, subDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';


const daysOfWeek = [
  { value: 1, label: 'Lunedì' }, { value: 2, label: 'Martedì' },
  { value: 3, label: 'Mercoledì' }, { value: 4, label: 'Giovedì' },
  { value: 5, label: 'Venerdì' }, { value: 6, 'label': 'Sabato' }, { value: 0, label: 'Domenica' }
];

const weeksOfMonth = [
  { value: 1, label: 'Prima' }, { value: 2, label: 'Seconda' },
  { value: 3, label: 'Terza' }, { value: 4, 'label': 'Quarta' }
];

const isWorkingDay = (date: Date): boolean => {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  const holidays = ['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26'];
  const formattedDate = format(date, 'MM-dd');
  if (holidays.includes(formattedDate)) return false;

  // Pasquetta
  const year = date.getFullYear();
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const dayOfMonth = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month - 1, dayOfMonth);
  const easterMonday = addDays(easter, 1);
  if (date.getTime() === new Date(year, easterMonday.getMonth(), easterMonday.getDate()).getTime()) return false;

  return true;
}

const addWorkingDays = (startDate: Date, days: number): Date => {
  if (days <= 0) return getNextWorkday(startDate);
  let currentDate = new Date(startDate);
  let addedDays = 0;
  while (addedDays < days) {
    currentDate = addDays(currentDate, 1);
    if (isWorkingDay(currentDate)) {
      addedDays++;
    }
  }
  return getNextWorkday(currentDate);
};

const subWorkingDays = (startDate: Date, days: number): Date => {
  if (days <= 0) return getPreviousWorkday(startDate);
  let currentDate = new Date(startDate);
  let subtractedDays = 0;
  while (subtractedDays < days) {
    currentDate = subDays(currentDate, 1);
    if (isWorkingDay(currentDate)) {
      subtractedDays++;
    }
  }
  return getPreviousWorkday(currentDate);
}

const getNextWorkday = (date: Date): Date => {
  let nextDate = new Date(date);
  while (!isWorkingDay(nextDate)) {
    nextDate = addDays(nextDate, 1);
  }
  return nextDate;
};

const getPreviousWorkday = (date: Date): Date => {
  let prevDate = new Date(date);
  while (!isWorkingDay(prevDate)) {
    prevDate = subDays(prevDate, 1);
  }
  return prevDate;
}

// Function to get the correct start date based on recurrence, always in the future or today
const getNextGenerationDate = (recurrence?: RecurringProject['recurrence']): Date => {
  const now = new Date();
  if (!recurrence || typeof recurrence === 'string') return now;
  const rec = recurrence as RecurrenceConfig;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [hours, minutes] = (rec.time || '09:00').split(':').map(Number);

  let nextDate = new Date();
  nextDate.setHours(hours, minutes, 0, 0);

  switch (rec.type) {
    case 'daily':
      if (nextDate < now) nextDate = addDays(nextDate, 1);
      break;
    case 'weekly':
      const targetDay = rec.dayOfWeek ?? 1;
      nextDate = setDay(nextDate, targetDay, { weekStartsOn: 1 });
      if (nextDate < today) nextDate = addWeeks(nextDate, 1);
      break;
    case 'monthly':
      const week = rec.weekOfMonth ?? 1;
      const day = rec.dayOfWeek ?? 1;
      const calculateForMonth = (monthDate: Date) => {
        let date = startOfMonth(monthDate);
        date = setDay(date, day, { weekStartsOn: 1 });
        if (date.getMonth() !== monthDate.getMonth()) date = addWeeks(date, 1);
        date = addWeeks(date, week - 1);
        date.setHours(hours, minutes, 0, 0);
        return date;
      }
      nextDate = calculateForMonth(today);
      if (nextDate < today) nextDate = calculateForMonth(addMonths(today, 1));
      break;
  }
  return nextDate;
};


export default function RecurringProjectsPage() {
  const { users, clients, activityTypes, usersById, clientsById, currentUser } = useLayoutData();
  const [recurringProjects, setRecurringProjects] = useState<RecurringProject[]>([]);
  const [prioritySettings, setPrioritySettings] = useState<TaskPrioritySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<'create' | 'edit' | null>(null);
  const [editingProject, setEditingProject] = useState<RecurringProject | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<RecurringProject | null>(null);

  const [recurrenceModalOpen, setRecurrenceModalOpen] = useState(false);
  const [projectForRecurrence, setProjectForRecurrence] = useState<RecurringProject | null>(null);

  // Stato per modal selezione data
  const [datePickerModalOpen, setDatePickerModalOpen] = useState(false);
  const [projectForDatePicker, setProjectForDatePicker] = useState<RecurringProject | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectsData, settingsData] = await Promise.all([
        getRecurringProjects(),
        getTaskPrioritySettings(),
      ]);
      setRecurringProjects(projectsData);
      setPrioritySettings(settingsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Impossibile caricare i dati.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCloseModal = () => {
    setModalOpen(null);
    setEditingProject(null);
  };

  const handleFormSubmit = async (formData: Omit<RecurringProject, 'id' | 'createdAt' | 'recurrence'>) => {
    try {
      let savedProject: RecurringProject;
      if (modalOpen === 'create') {
        const defaultRecurrence: RecurrenceConfig = { type: 'weekly', time: '09:00', dayOfWeek: 1 };
        const newProjectId = await addRecurringProject({ ...formData, recurrence: defaultRecurrence });
        savedProject = { ...formData, id: newProjectId, createdAt: new Date().toISOString(), recurrence: defaultRecurrence };
        toast.success('Template progetto creato.');
      } else if (editingProject) {
        await updateRecurringProject(editingProject.id, formData);
        savedProject = { ...editingProject, ...formData };
        toast.success('Template progetto aggiornato.');
      } else {
        throw new Error("Invalid state");
      }

      await fetchData();
      handleCloseModal();
      setProjectForRecurrence(savedProject);
      setRecurrenceModalOpen(true);

    } catch (error) {
      console.error(error); toast.error('Impossibile salvare.');
    }
  };

  const handleRecurrenceSubmit = async (recurrence: RecurringProject['recurrence']) => {
    if (!projectForRecurrence) return;
    try {
      await updateRecurringProject(projectForRecurrence.id, { recurrence });
      toast.success("Ricorrenza salvata.");
      setRecurrenceModalOpen(false);
      setProjectForRecurrence(null);
      fetchData();
    } catch (e) {
      toast.error('Errore.');
    }
  }

  const handleDelete = async () => {
    if (!projectToDelete) return;
    try {
      await deleteRecurringProject(projectToDelete.id);
      toast.success('Template eliminato.');
      setProjectToDelete(null);
      fetchData();
    } catch (e) {
      toast.error('Impossibile eliminare il template.');
    }
  }

  const handleDuplicate = async (templateToDuplicate: RecurringProject) => {
    const { id, createdAt, lastGenerated, ...duplicationData } = templateToDuplicate;

    const newTemplateData = {
      ...duplicationData,
      name: `${duplicationData.name} (copia)`,
      isActive: false, // Default to inactive
    };

    try {
      await addRecurringProject(newTemplateData);
      toast.success("Template duplicato con successo!");
      fetchData();
    } catch (error) {
      console.error("Failed to duplicate template:", error);
      toast.error("Impossibile duplicare il template.");
    }
  };

  // Genera progetto con data specifica (opzionale)
  const handleGenerateNow = async (template: RecurringProject, customDate?: Date) => {
    if (!currentUser) {
      toast.error("Dati mancanti (utente non trovato).");
      return;
    }
    setIsGenerating(template.id);
    try {
      // Usa la data custom se fornita, altrimenti calcola dalla ricorrenza
      const generationDate = customDate || getNextGenerationDate(template.recurrence);

      const priorityKey = template.projectDetails.priority as keyof TaskPrioritySettings;
      const defaultPriorityDays = prioritySettings && prioritySettings[priorityKey] != null ? Number(prioritySettings[priorityKey]) : 7;
      const priorityDays = template.durationDays && template.durationDays > 0 ? template.durationDays : defaultPriorityDays;

      const projectEndDate = addWorkingDays(generationDate, priorityDays);

      const projectToCreate: Omit<Project, 'id'> = {
        ...template.projectDetails,
        startDate: generationDate.toISOString(),
        endDate: projectEndDate.toISOString(),
        status: 'Pianificazione',
        spentBudget: 0,
        tags: '', // Project tags is string
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        progress: 0
      };

      const newProjectId = await addProject(projectToCreate);

      // I task hanno SEMPRE la scadenza del progetto (o calcolata in base ad essa)
      const tasksPromises = template.taskTemplates.map(tt => {
        let taskDueDate: Date;
        if (!tt.dueDateConfig || tt.dueDateConfig.type === 'PROJECT_END') {
          taskDueDate = projectEndDate;
        } else {
          taskDueDate = subWorkingDays(projectEndDate, tt.dueDateConfig.value || 0);
        }

        const newTask: Omit<Task, 'id'> = {
          title: tt.title,
          description: tt.description || '',
          priority: tt.priority,
          projectId: newProjectId,
          status: 'Da Fare',
          clientId: projectToCreate.clientId,
          dueDate: taskDueDate.toISOString(),
          assignedUserId: tt.assignedUserId,
          estimatedDuration: tt.estimatedDuration,
          actualDuration: 0,
          timeSpent: 0,
          attachments: [],
          comments: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          activityType: tt.activityType
        };
        // Add task with projectId
        return addTask(newTask, newProjectId);
      });

      await Promise.all(tasksPromises);

      await updateRecurringProject(template.id, { lastGenerated: new Date().toISOString() });
      toast.success(`Progetto generato: ${template.projectDetails.name}`);
      fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(`Errore generazione: ${error.message}`);
    } finally {
      setIsGenerating(null);
      setDatePickerModalOpen(false);
      setProjectForDatePicker(null);
    }
  }

  // Handler per aprire il modal di selezione data
  const handleOpenDatePicker = (template: RecurringProject) => {
    setProjectForDatePicker(template);
    setSelectedDate(new Date());
    setDatePickerModalOpen(true);
  }

  // Handler per generare con data selezionata
  const handleGenerateForDate = () => {
    if (!projectForDatePicker) return;
    handleGenerateNow(projectForDatePicker, selectedDate);
  }


  const formatRecurrence = (recurrence?: RecurringProject['recurrence']) => {
    if (!recurrence || typeof recurrence === 'string') return 'Non impostata';
    const rec = recurrence as RecurrenceConfig;
    if (rec.type === 'daily') return `Ogni giorno alle ${rec.time}`;
    if (rec.type === 'weekly') return `Ogni ${daysOfWeek.find(d => d.value === rec.dayOfWeek)?.label} alle ${rec.time}`;
    if (rec.type === 'monthly') return `Il ${weeksOfMonth.find(w => w.value === rec.weekOfMonth)?.label} ${daysOfWeek.find(d => d.value === rec.dayOfWeek)?.label} di ogni mese alle ${rec.time}`;
    return 'N/D';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Template Progetti Ricorrenti</h1>
          <p className="text-muted-foreground">Crea e gestisci template per progetti che si ripetono automaticamente.</p>
        </div>
        <Button onClick={() => setModalOpen('create')} className="bg-primary hover:bg-primary/90">
          <PlusCircle className="mr-2 h-4 w-4" />
          Nuovo Template
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco Template</CardTitle>
          <CardDescription>Visualizza e gestisci tutti i template di progetti ricorrenti.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome Template</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Ricorrenza</TableHead>
                <TableHead>N. Task</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Ultima Generazione</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : recurringProjects.length > 0 ? (
                recurringProjects.map(project => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell>{clientsById[project.projectDetails.clientId]?.name || 'N/D'}</TableCell>
                    <TableCell>{formatRecurrence(project.recurrence)}</TableCell>
                    <TableCell>{project.taskTemplates.length}</TableCell>
                    <TableCell>
                      <Badge variant={project.isActive ? 'default' : 'secondary'}>{project.isActive ? 'Attivo' : 'Inattivo'}</Badge>
                    </TableCell>
                    <TableCell>
                      {project.lastGenerated ? format(new Date(project.lastGenerated), 'dd/MM/yyyy HH:mm') : 'Mai'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => handleGenerateNow(project)} disabled={isGenerating === project.id}>
                        {isGenerating === project.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                        Genera Ora
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => { setEditingProject(project); setModalOpen('edit'); }}>
                            <Edit className="mr-2 h-4 w-4" /> Modifica
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(project)}>
                            <Copy className="mr-2 h-4 w-4" /> Duplica
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenDatePicker(project)}>
                            <Calendar className="mr-2 h-4 w-4" /> Genera per data
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setProjectForRecurrence(project); setRecurrenceModalOpen(true); }}>
                            <Settings className="mr-2 h-4 w-4" /> Imposta Ricorrenza
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setProjectToDelete(project)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Elimina
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">Nessun template trovato.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RecurringProjectForm
        key={editingProject?.id || 'create'}
        isOpen={!!modalOpen}
        onClose={handleCloseModal}
        onSubmit={handleFormSubmit}
        projectTemplate={editingProject}
        users={users}
        clients={clients}
        activityTypes={activityTypes}
      />

      <RecurrenceForm
        isOpen={recurrenceModalOpen}
        onClose={() => setRecurrenceModalOpen(false)}
        onSubmit={handleRecurrenceSubmit}
        project={projectForRecurrence}
      />

      <AlertDialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
            <AlertDialogDescription>Questa azione non può essere annullata. Questo eliminerà permanentemente il template.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProjectToDelete(null)}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal per selezione data di generazione */}
      <Dialog open={datePickerModalOpen} onOpenChange={setDatePickerModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Genera per data specifica</DialogTitle>
            <DialogDescription>
              Seleziona la data di inizio del progetto "{projectForDatePicker?.name}".
              La scadenza verrà calcolata automaticamente in base alla priorità.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 flex flex-col items-center">
            <Label className="mb-2 self-start">Data di inizio progetto</Label>
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
            <Button onClick={handleGenerateForDate} disabled={isGenerating === projectForDatePicker?.id}>
              {isGenerating === projectForDatePicker?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Genera Progetto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface RecurringProjectFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<RecurringProject, 'id' | 'createdAt' | 'recurrence'>) => void;
  projectTemplate: RecurringProject | null;
  users: User[];
  clients: Client[];
  activityTypes: ActivityType[];
}

function RecurringProjectForm({ isOpen, onClose, onSubmit, projectTemplate, users, clients, activityTypes }: RecurringProjectFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>(projectTemplate?.taskTemplates || []);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<(TaskTemplate & { tempId?: number }) | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    const data: Omit<RecurringProject, 'id' | 'createdAt' | 'recurrence'> = {
      name: formData.get('templateName') as string,
      isActive: formData.get('isActive') === 'on',
      projectDetails: {
        name: formData.get('projectName') as string,
        description: formData.get('description') as string,
        clientId: formData.get('clientId') as string,
        teamLeaderId: formData.get('teamLeaderId') as string,
        priority: formData.get('priority') as RecurringProject['projectDetails']['priority'],
        budget: 0
      },
      taskTemplates: taskTemplates,
      durationDays: formData.has('durationDays') ? Number(formData.get('durationDays')) : 0,
      clientId: formData.get('clientId') as string,
      lastGenerated: projectTemplate?.lastGenerated
    };

    await onSubmit(data);
    setIsSubmitting(false);
  }

  const handleTaskModalSubmit = (task: TaskTemplate) => {
    if (editingTask?.tempId) {
      setTaskTemplates(prev => prev.map(t => (t as any).tempId === editingTask.tempId ? task : t));
    } else {
      setTaskTemplates(prev => [...prev, { ...task, tempId: Date.now() } as any]);
    }
    setIsTaskModalOpen(false);
    setEditingTask(null);
  };

  const handleRemoveTask = (taskToRemove: TaskTemplate & { tempId?: number }) => {
    setTaskTemplates(prev => prev.filter(t => (t as any).tempId !== taskToRemove.tempId));
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{projectTemplate ? 'Modifica Template' : 'Crea Nuovo Template Progetto'}</DialogTitle>
            <DialogDescription>Compila i dettagli per definire il progetto che verrà generato.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 pt-4 max-h-[80vh] overflow-y-auto pr-4">
            <Card>
              <CardHeader><CardTitle>Definizione Template</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label htmlFor="templateName">Nome Template</Label><Input id="templateName" name="templateName" placeholder="Es. Newsletter Mensile" required defaultValue={projectTemplate?.name} /></div>
                  <div className="flex items-end"><div className="flex items-center space-x-2"><Switch id="isActive" name="isActive" defaultChecked={projectTemplate?.isActive ?? true} /><Label htmlFor="isActive">Attivo</Label></div></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Dettagli Progetto Generato</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><Label htmlFor="projectName">Nome Progetto</Label><Input id="projectName" name="projectName" placeholder="Es. Newsletter [Mese]" required defaultValue={projectTemplate?.projectDetails.name} /></div>
                <div><Label htmlFor="description">Descrizione Progetto</Label><Textarea id="description" name="description" defaultValue={projectTemplate?.projectDetails.description} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label htmlFor="clientId">Cliente</Label><Select name="clientId" required defaultValue={projectTemplate?.projectDetails.clientId}><SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger><SelectContent>{clients.sort((a, b) => a.name.localeCompare(b.name)).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label htmlFor="teamLeaderId">Team Leader</Label><Select name="teamLeaderId" required defaultValue={projectTemplate?.projectDetails.teamLeaderId}><SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger><SelectContent>{users.sort((a, b) => a.name.localeCompare(b.name)).map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="priority">Urgenza (per calcolo scadenza)</Label>
                    <Select name="priority" required defaultValue={projectTemplate?.projectDetails.priority || 'Media'}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{allTaskPriorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="durationDays">Giorni esatti per scadenza <span className="text-muted-foreground text-xs font-normal">(opzionale, sovrascrive l'urgenza)</span></Label>
                    <Input id="durationDays" name="durationDays" type="number" min="1" placeholder="Es. 10" defaultValue={projectTemplate?.durationDays || ''} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Task Predefiniti</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" /> Aggiungi Task</Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {taskTemplates.map((task, index) => (
                    <div key={(task as any).tempId || index} className="flex items-center justify-between p-2 rounded-md bg-secondary">
                      <div className="flex items-center gap-2 overflow-hidden"><ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" /><p className="font-medium truncate">{task.title}</p></div>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingTask(task as any); setIsTaskModalOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveTask(task as any)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                  {taskTemplates.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">Nessun task predefinito. Aggiungine uno.</p>}
                </div>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {projectTemplate ? 'Salva Modifiche' : 'Crea e imposta ricorrenza'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <TaskTemplateForm
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSubmit={handleTaskModalSubmit}
        task={editingTask}
        users={users}
        activityTypes={activityTypes}
      />
    </>
  );
}

interface TaskTemplateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: TaskTemplate) => void;
  task: (TaskTemplate & { tempId?: number }) | null;
  users: User[];
  activityTypes: ActivityType[];
}

// TaskTemplateForm fix
function TaskTemplateForm({ isOpen, onClose, onSubmit, task, users, activityTypes }: TaskTemplateFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dueDateType, setDueDateType] = useState<any>(task?.dueDateConfig?.type || 'PROJECT_END'); // Cast to any to avoid complex union mismatch

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const dueDateTypeValue = formData.get('dueDateType') as any;

    const taskData: TaskTemplate = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      priority: formData.get('priority') as 'Bassa' | 'Media' | 'Alta' | 'Critica',
      activityType: formData.get('activityType') as string,
      estimatedDuration: Number(formData.get('estimatedDuration')),
      assignedUserId: (formData.get('assignedUserId') as string) || undefined,
      offsetDays: 0,
      dueDateConfig: {
        type: dueDateTypeValue,
        value: dueDateTypeValue === 'DAYS_BEFORE_END' ? Number(formData.get('daysBeforeEnd')) : undefined
      },
    };
    onSubmit(taskData);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? 'Modifica Task' : 'Nuovo Task per Template'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div><Label htmlFor="title">Titolo</Label><Input id="title" name="title" required defaultValue={task?.title} /></div>
          <div><Label htmlFor="description">Descrizione</Label><Textarea id="description" name="description" defaultValue={task?.description} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label htmlFor="priority">Priorità</Label><Select name="priority" required defaultValue={task?.priority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{allTaskPriorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="estimatedDuration">Durata Stimata (min)</Label><Input id="estimatedDuration" name="estimatedDuration" type="number" required defaultValue={task?.estimatedDuration} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label htmlFor="activityType">Tipo Attività</Label><Select name="activityType" required defaultValue={task?.activityType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{activityTypes.sort((a, b) => a.name.localeCompare(b.name)).map(at => <SelectItem key={at.id} value={at.name}>{at.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="assignedUserId">Assegna a</Label><Select name="assignedUserId" defaultValue={task?.assignedUserId || undefined}><SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger><SelectContent>{users.sort((a, b) => a.name.localeCompare(b.name)).map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-2 pt-4 border-t">
            <Label className="text-base font-medium">Scadenza Task</Label>
            <RadioGroup name="dueDateType" value={dueDateType} onValueChange={(v) => setDueDateType(v as any)} className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="PROJECT_END" id="r1" />
                <Label htmlFor="r1">Usa data di scadenza del progetto</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="DAYS_BEFORE_END" id="r2" />
                <Label htmlFor="r2">Giorni lavorativi prima della scadenza del progetto</Label>
              </div>
            </RadioGroup>
            {dueDateType === 'DAYS_BEFORE_END' && (
              <div className="pl-6 pt-2">
                <Input
                  name="daysBeforeEnd"
                  type="number"
                  placeholder="Es. 2"
                  defaultValue={task?.dueDateConfig?.value || ''}
                  required
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
            <Button type="submit" disabled={isSubmitting}>{task ? 'Salva' : 'Aggiungi'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface RecurrenceFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (recurrence: RecurringProject['recurrence']) => void;
  project: RecurringProject | null;
}

// RecurrenceForm fix
function RecurrenceForm({ isOpen, onClose, onSubmit, project }: RecurrenceFormProps) {
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  useEffect(() => {
    if (project?.recurrence && typeof project.recurrence !== 'string') {
      const type = (project.recurrence as RecurrenceConfig).type;
      if (type === 'daily' || type === 'weekly' || type === 'monthly') {
        setRecurrenceType(type);
      }
    }
  }, [project]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: RecurrenceConfig = {
      type: formData.get('type') as any, // unsafe cast but form controlled
      time: formData.get('time') as string,
      dayOfWeek: formData.has('dayOfWeek') ? Number(formData.get('dayOfWeek')) : undefined,
      weekOfMonth: formData.has('weekOfMonth') ? Number(formData.get('weekOfMonth')) : undefined,
    };

    const rawEndDate = formData.get('endDate') as string;
    if (rawEndDate) {
      data.endDate = new Date(rawEndDate).toISOString();
    }

    onSubmit(data);
  }


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Imposta Ricorrenza per "{project?.name}"</DialogTitle>
          <DialogDescription>Scegli la frequenza con cui questo progetto deve essere generato.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
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
                <Select name="dayOfWeek" required defaultValue={(project?.recurrence && typeof project.recurrence !== 'string' && project.recurrence.dayOfWeek !== undefined) ? project.recurrence.dayOfWeek.toString() : undefined}>
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>{daysOfWeek.map(d => <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : <div />}
            <div>
              <Label htmlFor="time">Orario</Label>
              <Input id="time" name="time" type="time" required defaultValue={(project?.recurrence && typeof project.recurrence !== 'string') ? project.recurrence.time : '09:00'} />
            </div>
          </div>
          {recurrenceType === 'monthly' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="weekOfMonth">Settimana del mese</Label>
                <Select name="weekOfMonth" required defaultValue={(project?.recurrence && typeof project.recurrence !== 'string' && project.recurrence.weekOfMonth !== undefined) ? project.recurrence.weekOfMonth.toString() : undefined}>
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>{weeksOfMonth.map(w => <SelectItem key={w.value} value={w.value.toString()}>{w.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="pt-2 border-t">
            <Label htmlFor="endDate" className="mb-2 block">
              Data di fine ricorrenza <span className="text-sm font-normal text-muted-foreground">(opzionale)</span>
            </Label>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              defaultValue={(project?.recurrence && typeof project.recurrence !== 'string' && project.recurrence.endDate) ? new Date(project.recurrence.endDate).toISOString().split('T')[0] : ''}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Lascia vuoto se desideri che il progetto venga generato senza un limite di tempo.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
            <Button type="submit">Salva Ricorrenza</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
