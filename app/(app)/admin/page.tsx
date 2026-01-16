'use client';

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    getDepartments,
    getTasks,
    getTeams,
    getUsers,
    addClient,
    addDepartment,
    addTeam,
    updateUser,
    deleteUser,
    updateDepartment,
    deleteDepartment,
    updateTeam,
    deleteTeam,
    getActivityTypes,
    addActivityType,
    updateActivityType,
    deleteActivityType,
    updateClient,
    deleteClient,
    getClients,
    getRolePermissions,
    updateRolePermissions,
    getEditorialPillars,
    getEditorialFormats,
    getEditorialStatuses,
    addEditorialPillar,
    deleteEditorialPillar,
    addEditorialFormat,
    deleteEditorialFormat,
    addEditorialStatus,
    deleteEditorialStatus,
    getEditorialColumns,
    addEditorialColumn,
    deleteEditorialColumn,
    getBriefServices,
    addBriefService,
    updateBriefService,
    deleteBriefService,
    getTaskPrioritySettings,
    updateTaskPrioritySettings,
    addCalendarActivityPreset,
    updateCalendarActivityPreset,
    deleteCalendarActivityPreset,
    getBriefServiceCategories,
    addBriefServiceCategory,
    deleteBriefServiceCategory,
} from '@/lib/actions';
import {
    Client,
    Department,
    Task,
    Team,
    User,
    ActivityType,
    RolePermissions,
    EditorialPillar,
    EditorialFormat,
    EditorialStatus,
    EditorialColumn,
    BriefService,
    BriefServiceCategory,
    TaskPrioritySettings,
    allTaskPriorities,
    CalendarActivityPreset,
} from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, MoreVertical, X, Plus, Trash2, Pencil } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import React, { useEffect, useState, useCallback, Suspense, useReducer } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import dynamic from 'next/dynamic';
import { isEqual } from 'lodash';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLayoutData } from '@/app/(app)/layout-context';
import { Switch } from '@/components/ui/switch';
import { getInitials } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const AdminForm = dynamic(() => import('@/components/admin-form'), {
    loading: () => <AdminFormSkeleton />,
});

const AdminSoundsSettings = dynamic(() => import('@/components/admin-sounds-settings'), {
    loading: () => <div className="p-6 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>,
});

const AdminUserWidgets = dynamic(() => import('@/components/admin-user-widgets'), {
    loading: () => <div className="p-6 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>,
});

const AdminEmailTemplates = dynamic(() => import('@/components/admin-email-templates'), {
    loading: () => <div className="p-6 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>,
});

const AdminAutomations = dynamic(() => import('@/components/admin-automations').then(m => ({ default: m.AdminAutomations })), {
    loading: () => <div className="p-6 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>,
});

const AdminCompanyCosts = dynamic(() => import('@/components/admin-company-costs'), {
    loading: () => <div className="p-6 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>,
});

const AdminSiteIcons = dynamic(() => import('@/components/admin-site-icons'), {
    loading: () => <div className="p-6 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>,
});


type ModalState = 'user' | 'client' | 'department' | 'team' | 'activity' | 'service' | 'calendar_preset' | 'edit-user' | 'edit-client' | 'edit-department' | 'edit-team' | 'edit-activity' | 'edit-service' | 'edit-calendar_preset' | null;

const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/tasks', label: 'Tasks' },
    { href: '/projects', label: 'Progetti' },
    { href: '/calendar', label: 'Calendario' },
    { href: '/editorial-plan', label: 'Piano Editoriale' },
    { href: '/briefs', label: 'Briefs' },
    { href: '/absences', label: 'Assenze' },
    { href: '/chat', label: 'Chat' },
    { href: '/documents', label: 'Documenti' },
    { href: '/admin', label: 'Pannello Admin' },
];

const actionPermissions = [
    { key: '_create-task', label: 'Crea Task' },
    { key: '_approve-tasks', label: 'Approva Task' },
    { key: '_create-recurring-projects', label: 'Crea Progetti Ricorrenti' },
    { key: '_manage-users', label: 'Gestione Utenti' },
    { key: '_view-financials', label: 'Visualizza Budget e Costi' },
    { key: '_delete-task', label: 'Elimina Task' },
    { key: '_manage-clients', label: 'Gestione Clienti' },
    { key: '_approve-absences', label: 'Approva Assenze' },
    { key: '_manage-editorial-plan', label: 'Gestione Piano Editoriale' },
];

const AdminFormSkeleton = () => (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-4 pt-2">
        <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
        </div>
        <Skeleton className="h-10" />
        <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
        </div>
        <Skeleton className="h-20" />
        <DialogFooter>
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
        </DialogFooter>
    </div>
);


function AdminPageContent() {
    const { handleCreateUser, users, clients, activityTypes, allTasks: tasks, isLoadingLayout, refetchData, taskPrioritySettings: initialPrioritySettings, setTaskPrioritySettings, calendarActivityPresets: presets } = useLayoutData();
    const [departments, setDepartments] = useState<Department[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [briefServices, setBriefServices] = useState<BriefService[]>([]);
    const [briefServiceCategories, setBriefServiceCategories] = useState<BriefServiceCategory[]>([]);

    const [modalOpen, setModalOpen] = useState<ModalState>(null);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
    const [editingTeam, setEditingTeam] = useState<Team | null>(null);
    const [editingActivity, setEditingActivity] = useState<ActivityType | null>(null);
    const [editingService, setEditingService] = useState<BriefService | null>(null);
    const [editingCalendarPreset, setEditingCalendarPreset] = useState<CalendarActivityPreset | null>(null);

    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
    const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
    const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
    const [activityToDelete, setActivityToDelete] = useState<ActivityType | null>(null);
    const [serviceToDelete, setServiceToDelete] = useState<BriefService | null>(null);
    const [presetToDelete, setPresetToDelete] = useState<CalendarActivityPreset | null>(null);

    const { toast } = useToast();

    const [rolePermissions, setRolePermissions] = useState<RolePermissions>({});
    const [initialPermissions, setInitialPermissions] = useState<RolePermissions>({});

    const [prioritySettings, setPrioritySettingsState] = useState<TaskPrioritySettings>({
        Critica: 1, Alta: 3, Media: 7, Bassa: 14,
    });

    useEffect(() => {
        if (initialPrioritySettings) {
            setPrioritySettingsState(initialPrioritySettings);
        }
    }, [initialPrioritySettings]);


    const handlePrioritySettingsChange = (priority: Task['priority'], days: string) => {
        const value = parseInt(days, 10);
        if (!isNaN(value) && value >= 0) {
            setPrioritySettingsState(prev => ({ ...prev, [priority]: value }));
        }
    };

    const handleSavePrioritySettings = async () => {
        try {
            await updateTaskPrioritySettings(prioritySettings);
            setTaskPrioritySettings(prioritySettings); // Update context
            toast({ title: "Successo", description: "Impostazioni di priorità aggiornate." });
        } catch (e) {
            toast({ title: "Errore", description: "Impossibile salvare le impostazioni.", variant: 'destructive' });
        }
    };


    // Editorial Plan Settings State
    const [editorialPillars, setEditorialPillars] = useState<EditorialPillar[]>([]);
    const [editorialFormats, setEditorialFormats] = useState<EditorialFormat[]>([]);
    const [editorialStatuses, setEditorialStatuses] = useState<EditorialStatus[]>([]);
    const [editorialColumns, setEditorialColumns] = useState<EditorialColumn[]>([]);
    const [newPillarName, setNewPillarName] = useState('');
    const [newPillarClient, setNewPillarClient] = useState('all');
    const [newFormatName, setNewFormatName] = useState('');
    const [newStatusName, setNewStatusName] = useState('');
    const [newStatusColor, setNewStatusColor] = useState('#888888');

    // State for new custom column
    const [newColumnName, setNewColumnName] = useState('');
    const [newColumnType, setNewColumnType] = useState<'text' | 'select'>('text');
    const [newColumnOptions, setNewColumnOptions] = useState('');
    const [newColumnClients, setNewColumnClients] = useState<string[]>([]);

    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab') || 'users';
    const [activeTab, setActiveTab] = useState(initialTab);


    const fetchData = useCallback(async () => {
        try {
            const [
                departmentsData,
                teamsData,
                permissionsData,
                pillarsData,
                formatsData,
                statusesData,
                columnsData,
                briefServicesData,
                briefServiceCategoriesData,
            ] = await Promise.all([
                getDepartments(),
                getTeams(),
                getRolePermissions(),
                getEditorialPillars(),
                getEditorialFormats(),
                getEditorialStatuses(),
                getEditorialColumns(),
                getBriefServices(),
                getBriefServiceCategories(),
            ]);
            setDepartments(departmentsData);
            setTeams(teamsData);
            setRolePermissions(permissionsData);
            setInitialPermissions(permissionsData);
            setEditorialPillars(pillarsData);
            setEditorialFormats(formatsData);
            setEditorialStatuses(statusesData);
            setEditorialColumns(columnsData);
            setBriefServices(briefServicesData);
            setBriefServiceCategories(briefServiceCategoriesData);


        } catch (error) {
            console.error('Failed to fetch admin data:', error);
            toast({ title: "Errore", description: "Impossibile caricare i dati.", variant: 'destructive' });
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handlePermissionChange = (role: string, permission: string, checked: boolean) => {
        setRolePermissions(prev => {
            const currentPermissions = prev[role] || [];
            const newPermissions = checked
                ? [...currentPermissions, permission]
                : currentPermissions.filter(p => p !== permission);
            return {
                ...prev,
                [role]: newPermissions
            };
        });
    };

    const handleSavePermissions = async () => {
        try {
            const promises = Object.entries(rolePermissions).map(([roleId, permissions]) =>
                updateRolePermissions(roleId, permissions)
            );
            await Promise.all(promises);
            setInitialPermissions(rolePermissions);
            toast({ title: "Successo", description: "Permessi aggiornati." });
        } catch (error) {
            console.error("Failed to save permissions", error);
            toast({ title: "Errore", description: "Impossibile salvare i permessi.", variant: 'destructive' });
        }
    };

    const getClientStats = (clientId: string) => {
        const clientTasks = tasks.filter((t) => t.clientId === clientId);
        const completedTasks = clientTasks.filter(
            (t) => t.status === 'Approvato'
        ).length;
        return {
            taskCount: clientTasks.length,
            completionRate:
                clientTasks.length > 0
                    ? (completedTasks / clientTasks.length) * 100
                    : 0,
        };
    };

    const openEditUserModal = (user: User) => {
        setEditingUser(user);
        setModalOpen('edit-user');
    };

    const openEditClientModal = (client: Client) => {
        setEditingClient(client);
        setModalOpen('edit-client');
    };

    const openEditDepartmentModal = (department: Department) => {
        setEditingDepartment(department);
        setModalOpen('edit-department');
    };

    const openEditTeamModal = (team: Team) => {
        setEditingTeam(team);
        setModalOpen('edit-team');
    };

    const openEditActivityModal = (activity: ActivityType) => {
        setEditingActivity(activity);
        setModalOpen('edit-activity');
    };

    const openEditServiceModal = (service: BriefService) => {
        setEditingService(service);
        setModalOpen('edit-service');
    }

    const openEditCalendarPresetModal = (preset: CalendarActivityPreset) => {
        setEditingCalendarPreset(preset);
        setModalOpen('edit-calendar_preset');
    }

    const handleCloseModal = () => {
        setModalOpen(null);
        setEditingUser(null);
        setEditingClient(null);
        setEditingDepartment(null);
        setEditingTeam(null);
        setEditingActivity(null);
        setEditingService(null);
        setEditingCalendarPreset(null);
    }

    const handleFormSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);

        const data: { [key: string]: any } = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });

        const getMembersFromForm = (form: HTMLFormElement, name: string) => {
            return Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)).map(cb => cb.value);
        }

        try {
            switch (modalOpen) {
                case 'user': {
                    const skillsString = data.skills as string;
                    const newUser: Omit<User, 'id'> = {
                        name: data.name as string,
                        email: data.email as string,
                        phone: data.phone as string,
                        role: data.role as User['role'],
                        clientId: data.role === 'Cliente' ? data.clientId : undefined,
                        departmentId: data.departmentId || null,
                        teamId: data.teamId || null,
                        startDate: data.startDate || new Date().toISOString(),
                        birthDate: data.birthDate || undefined,
                        color: data.color as string,
                        skills: skillsString ? skillsString.split(',').map(s => s.trim()).filter(Boolean) : [],
                        status: data.status as User['status'],
                        salary: parseFloat(String(data.salary).replace(',', '.')) || 0,
                        hourlyRate: parseFloat(String(data.hourlyRate).replace(',', '.')) || 0,
                        avatar: undefined,
                    };
                    const result = await handleCreateUser(newUser, data.password);
                    if (!result.success && result.error) {
                        toast({
                            title: "Errore Creazione Utente",
                            description: result.error,
                        });
                        return; // Stop execution
                    }
                    break;
                }
                case 'edit-user':
                    if (!editingUser) return;
                    const updatedSkillsString = (data.skills as string) || '';
                    const updatedUserData: Partial<User> = {
                        name: data.name as string,
                        email: data.email as string,
                        phone: data.phone as string,
                        role: data.role as User['role'],
                        clientId: data.role === 'Cliente' ? data.clientId : undefined,
                        departmentId: data.departmentId || null,
                        teamId: data.teamId || null,
                        birthDate: data.birthDate || undefined,
                        color: data.color as string,
                        skills: updatedSkillsString ? updatedSkillsString.split(',').map(s => s.trim()).filter(s => s) : [],
                        status: data.status as User['status'],
                        salary: parseFloat(String(data.salary).replace(',', '.')) || 0,
                        hourlyRate: parseFloat(String(data.hourlyRate).replace(',', '.')) || 0,
                    };
                    await updateUser(editingUser.id, updatedUserData);
                    break;
                case 'client':
                    await addClient({
                        name: data.name,
                        email: data.email,
                        phone: data.phone,
                        budget: Number(data.budget) || 0,
                        address: data.address,
                        color: data.color,
                        notes: data.notes,
                        managedBy: getMembersFromForm(form, 'managedBy'),
                        allowedActivityTypeIds: getMembersFromForm(form, 'allowedActivityTypeIds'),
                    });
                    break;
                case 'edit-client':
                    if (!editingClient) return;
                    await updateClient(editingClient.id, {
                        name: data.name,
                        email: data.email,
                        phone: data.phone,
                        budget: Number(data.budget) || 0,
                        address: data.address,
                        color: data.color,
                        notes: data.notes,
                        managedBy: getMembersFromForm(form, 'managedBy'),
                        allowedActivityTypeIds: getMembersFromForm(form, 'allowedActivityTypeIds'),
                    });
                    break;
                case 'department':
                    await addDepartment({
                        name: data.name,
                        color: data.color,
                        members: getMembersFromForm(form, 'members')
                    } as Omit<Department, 'id'>);
                    break;
                case 'edit-department':
                    if (!editingDepartment) return;
                    await updateDepartment(editingDepartment.id, {
                        name: data.name,
                        color: data.color,
                        members: getMembersFromForm(form, 'members')
                    } as Partial<Department>);
                    break;
                case 'team':
                    await addTeam({
                        name: data.name,
                        color: data.color,
                        members: getMembersFromForm(form, 'members')
                    } as Omit<Team, 'id'>);
                    break;
                case 'edit-team':
                    if (!editingTeam) return;
                    await updateTeam(editingTeam.id, {
                        name: data.name,
                        color: data.color,
                        members: getMembersFromForm(form, 'members')
                    } as Partial<Team>);
                    break;
                case 'activity': {
                    const hasDeadlineTask = form.querySelector<HTMLInputElement>('input[name="hasDeadlineTask"]')?.checked || false;
                    await addActivityType({
                        ...data,
                        hourlyRate: Number(data.hourlyRate),
                        hasDeadlineTask: hasDeadlineTask
                    } as Omit<ActivityType, 'id'>);
                    break;
                }
                case 'edit-activity': {
                    if (!editingActivity) return;
                    const hasDeadlineTask = form.querySelector<HTMLInputElement>('input[name="hasDeadlineTask"]')?.checked || false;
                    await updateActivityType(editingActivity.id, {
                        ...data,
                        hourlyRate: Number(data.hourlyRate),
                        hasDeadlineTask: hasDeadlineTask
                    } as Partial<ActivityType>);
                    break;
                }
                case 'service':
                    await addBriefService({
                        name: data.name,
                        description: data.description,
                        categoryId: data.categoryId
                    } as Omit<BriefService, 'id'>);
                    break;
                case 'edit-service':
                    if (!editingService) return;
                    await updateBriefService(editingService.id, {
                        name: data.name,
                        description: data.description,
                        categoryId: data.categoryId
                    } as Partial<BriefService>);
                    break;
                case 'calendar_preset':
                    await addCalendarActivityPreset({
                        name: data.name,
                        description: data.description,
                        color: data.color,
                        defaultDuration: Number(data.defaultDuration),
                        hourlyRate: Number(data.hourlyRate)
                    } as Omit<CalendarActivityPreset, 'id'>);
                    break;
                case 'edit-calendar_preset':
                    if (!editingCalendarPreset) return;
                    await updateCalendarActivityPreset(editingCalendarPreset.id, {
                        name: data.name,
                        description: data.description,
                        color: data.color,
                        defaultDuration: Number(data.defaultDuration),
                        hourlyRate: Number(data.hourlyRate)
                    } as Partial<CalendarActivityPreset>);
                    break;
                default:
                    return;
            }
            toast({ title: "Successo", description: "Operazione completata con successo." });
            handleCloseModal();
            fetchData();
        } catch (error: any) {
            console.error(`Failed to perform action for ${modalOpen}:`, error);
            toast({ title: "Errore", description: error.message || `Impossibile completare l'operazione.`, variant: 'destructive' });
        }
    }, [modalOpen, editingUser, editingClient, editingDepartment, editingTeam, editingActivity, editingService, editingCalendarPreset, toast, handleCreateUser, fetchData]);

    const handleDeleteUser = async () => {
        if (!userToDelete) return;
        try {
            await deleteUser(userToDelete.id);
            toast({ title: "Successo", description: `Utente ${userToDelete.name} eliminato.` });
            setUserToDelete(null);
            fetchData();
        } catch (error) {
            console.error('Failed to delete user:', error);
            toast({ title: "Errore", description: "Impossibile eliminare l'utente.", variant: 'destructive' });
        }
    };

    const handleDeleteClient = async () => {
        if (!clientToDelete) return;
        try {
            await deleteClient(clientToDelete.id);
            toast({ title: "Successo", description: `Cliente ${clientToDelete.name} eliminato.` });
            setClientToDelete(null);
            fetchData();
        } catch (error) {
            console.error('Failed to delete client:', error);
            toast({ title: "Errore", description: "Impossibile eliminare il cliente.", variant: 'destructive' });
        }
    };

    const handleDeleteDepartment = async () => {
        if (!departmentToDelete) return;
        try {
            await deleteDepartment(departmentToDelete.id);
            toast({ title: "Successo", description: `Reparto ${departmentToDelete.name} eliminato.` });
            setDepartmentToDelete(null);
            fetchData();
        } catch (error) {
            console.error('Failed to delete department:', error);
            toast({ title: "Errore", description: "Impossibile eliminare il reparto.", variant: 'destructive' });
        }
    };

    const handleDeleteTeam = async () => {
        if (!teamToDelete) return;
        try {
            await deleteTeam(teamToDelete.id);
            toast({ title: "Successo", description: `Team ${teamToDelete.name} eliminato.` });
            setTeamToDelete(null);
            fetchData();
        } catch (error) {
            console.error('Failed to delete team:', error);
            toast({ title: "Errore", description: "Impossibile eliminare il team.", variant: 'destructive' });
        }
    };

    const handleDeleteActivity = async () => {
        if (!activityToDelete) return;
        try {
            await deleteActivityType(activityToDelete.id);
            toast({ title: "Successo", description: `Attività ${activityToDelete.name} eliminata.` });
            setActivityToDelete(null);
            fetchData();
        } catch (error) {
            console.error('Failed to delete activity:', error);
            toast({ title: "Errore", description: "Impossibile eliminare l'attività.", variant: 'destructive' });
        }
    };

    const handleDeleteService = async () => {
        if (!serviceToDelete) return;
        try {
            await deleteBriefService(serviceToDelete.id);
            toast({ title: "Successo", description: `Servizio ${serviceToDelete.name} eliminato.` });
            setServiceToDelete(null);
            fetchData();
        } catch (e) {
            toast({ title: "Errore", description: "Impossibile eliminare il servizio.", variant: 'destructive' });
        }
    };

    const handleDeletePreset = async () => {
        if (!presetToDelete) return;
        try {
            await deleteCalendarActivityPreset(presetToDelete.id);
            toast({ title: "Successo", description: `Preset ${presetToDelete.name} eliminato.` });
            setPresetToDelete(null);
            fetchData();
        } catch (e) {
            toast({ title: "Errore", description: "Impossibile eliminare il preset.", variant: 'destructive' });
        }
    };

    // --- Editorial Plan Settings Handlers ---
    const handleAddPillar = async () => {
        if (!newPillarName.trim()) return;
        try {
            await addEditorialPillar({ name: newPillarName, clientId: newPillarClient === 'all' ? undefined : newPillarClient });
            setNewPillarName('');
            setNewPillarClient('all');
            await fetchData();
            toast({ title: "Topic Aggiunto" });
        } catch (e) { toast({ title: "Errore", variant: 'destructive' }); }
    };

    const handleAddFormat = async () => {
        if (!newFormatName.trim()) return;
        try {
            await addEditorialFormat({ name: newFormatName });
            setNewFormatName('');
            await fetchData();
            toast({ title: "Formato Aggiunto" });
        } catch (e) { toast({ title: "Errore", variant: 'destructive' }); }
    };

    const handleAddStatus = async () => {
        if (!newStatusName.trim()) return;
        try {
            await addEditorialStatus({ name: newStatusName, color: newStatusColor });
            setNewStatusName('');
            setNewStatusColor('#888888');
            await fetchData();
            toast({ title: "Stato Aggiunto" });
        } catch (e) { toast({ title: "Errore", variant: 'destructive' }); }
    };

    const handleAddColumn = async () => {
        if (!newColumnName.trim()) return;
        try {
            const options = newColumnType === 'select' ? newColumnOptions.split(',').map(s => s.trim()).filter(Boolean) : [];
            const slug = newColumnName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            await addEditorialColumn({ name: newColumnName, slug, clientIds: newColumnClients, type: newColumnType, options });
            setNewColumnName('');
            setNewColumnType('text');
            setNewColumnOptions('');
            setNewColumnClients([]);
            await fetchData();
            toast({ title: "Colonna Aggiunta" });
        } catch (e) { console.error(e); toast({ title: "Errore nell'aggiunta della colonna", variant: 'destructive' }); }
    };

    const handleColumnClientToggle = (clientId: string) => {
        setNewColumnClients(prev =>
            prev.includes(clientId)
                ? prev.filter(id => id !== clientId)
                : [...prev, clientId]
        );
    };

    if (isLoadingLayout) {
        return <div>Loading...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">
                    Pannello di Amministrazione
                </h1>
                <p className="text-muted-foreground">
                    Gestisci utenti, clienti, reparti, team, attività e permessi.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="h-auto flex flex-wrap justify-start gap-2 bg-transparent p-0">
                    <TabsTrigger value="users" className="border border-input bg-background hover:bg-accent hover:text-accent-foreground data-[state=active]:border-primary data-[state=active]:border-2 data-[state=active]:shadow-md transition-all">Utenti</TabsTrigger>
                    <TabsTrigger value="clients" className="border border-input bg-background hover:bg-accent hover:text-accent-foreground data-[state=active]:border-primary data-[state=active]:border-2 data-[state=active]:shadow-md transition-all">Clienti</TabsTrigger>
                    <TabsTrigger value="permissions" className="border border-input bg-background hover:bg-accent hover:text-accent-foreground data-[state=active]:border-primary data-[state=active]:border-2 data-[state=active]:shadow-md transition-all">Permessi</TabsTrigger>
                    <TabsTrigger value="task_priorities" className="border border-input bg-background hover:bg-accent hover:text-accent-foreground data-[state=active]:border-primary data-[state=active]:border-2 data-[state=active]:shadow-md transition-all">Priorità</TabsTrigger>
                    <TabsTrigger value="departments_teams" className="border border-input bg-background hover:bg-accent hover:text-accent-foreground data-[state=active]:border-primary data-[state=active]:border-2 data-[state=active]:shadow-md transition-all">Reparti & Team</TabsTrigger>
                    <TabsTrigger value="activities" className="border border-input bg-background hover:bg-accent hover:text-accent-foreground data-[state=active]:border-primary data-[state=active]:border-2 data-[state=active]:shadow-md transition-all">Tipi Attività Task</TabsTrigger>
                    <TabsTrigger value="calendar_activities" className="border border-input bg-background hover:bg-accent hover:text-accent-foreground data-[state=active]:border-primary data-[state=active]:border-2 data-[state=active]:shadow-md transition-all">Tipi Attività Calendario</TabsTrigger>
                    <TabsTrigger value="brief_services" className="border border-input bg-background hover:bg-accent hover:text-accent-foreground data-[state=active]:border-primary data-[state=active]:border-2 data-[state=active]:shadow-md transition-all">Servizi Brief</TabsTrigger>
                    <TabsTrigger value="editorial-plan" className="border border-input bg-background hover:bg-accent hover:text-accent-foreground data-[state=active]:border-primary data-[state=active]:border-2 data-[state=active]:shadow-md transition-all">Piano Editoriale</TabsTrigger>
                    <TabsTrigger value="dashboard_widgets" className="border border-input bg-background hover:bg-accent hover:text-accent-foreground data-[state=active]:border-primary data-[state=active]:border-2 data-[state=active]:shadow-md transition-all">📊 Widget Dashboard</TabsTrigger>
                    <TabsTrigger value="email_templates" className="border border-input bg-background hover:bg-accent hover:text-accent-foreground data-[state=active]:border-primary data-[state=active]:border-2 data-[state=active]:shadow-md transition-all">📧 Template Email</TabsTrigger>
                    <TabsTrigger value="sounds" className="border border-input bg-background hover:bg-accent hover:text-accent-foreground data-[state=active]:border-primary data-[state=active]:border-2 data-[state=active]:shadow-md transition-all">🔊 Suoni</TabsTrigger>
                    <TabsTrigger value="automations" className="border border-input bg-background hover:bg-accent hover:text-accent-foreground data-[state=active]:border-primary data-[state=active]:border-2 data-[state=active]:shadow-md transition-all">⚡ Automazioni</TabsTrigger>
                    <TabsTrigger value="company_costs" className="border border-input bg-background hover:bg-accent hover:text-accent-foreground data-[state=active]:border-primary data-[state=active]:border-2 data-[state=active]:shadow-md transition-all">💰 Costi Aziendali</TabsTrigger>
                    <TabsTrigger value="site_icons" className="border border-input bg-background hover:bg-accent hover:text-accent-foreground data-[state=active]:border-primary data-[state=active]:border-2 data-[state=active]:shadow-md transition-all">🖼️ Icone Sito</TabsTrigger>
                </TabsList>

                <TabsContent value="users">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Utenti</CardTitle>
                            <Button size="sm" onClick={() => setModalOpen('user')}>+ Nuovo Utente</Button>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nome</TableHead>
                                            <TableHead className="hidden md:table-cell">Ruolo</TableHead>
                                            <TableHead className="hidden md:table-cell">Stato</TableHead>
                                            <TableHead className="text-right">
                                                <span className="sr-only">Azioni</span>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[...users].sort((a, b) => a.name.localeCompare(b.name)).map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-9 w-9">
                                                            <AvatarFallback
                                                                style={{
                                                                    backgroundColor: user.color,
                                                                    color: 'white',
                                                                }}
                                                            >
                                                                {user.name ? getInitials(user.name) : '?'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="grid gap-0.5">
                                                            <p className="font-medium">{user.name}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {user.email}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell">{user.role}</TableCell>
                                                <TableCell className="hidden md:table-cell">
                                                    <Badge
                                                        variant={user.status === 'Attivo' ? 'default' : 'secondary'}
                                                        className={
                                                            user.status === 'Attivo' ? 'bg-green-500' : 'bg-red-500'
                                                        }
                                                    >
                                                        {user.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon">
                                                                <MoreVertical />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem onClick={() => openEditUserModal(user)}>Modifica</DropdownMenuItem>
                                                            <DropdownMenuItem>Disattiva</DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="text-red-500" onClick={() => setUserToDelete(user)}>
                                                                Elimina
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="clients">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Clienti</CardTitle>
                            <Button size="sm" onClick={() => setModalOpen('client')}>+ Nuovo Cliente</Button>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead className="hidden sm:table-cell">Contatto</TableHead>
                                            <TableHead className="hidden md:table-cell">N. Task</TableHead>
                                            <TableHead className="hidden lg:table-cell">Budget</TableHead>
                                            <TableHead className="text-right">
                                                <span className="sr-only">Azioni</span>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[...clients].sort((a, b) => a.name.localeCompare(b.name)).map((client) => {
                                            const stats = getClientStats(client.id);
                                            return (
                                                <TableRow key={client.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="hidden h-9 w-9 sm:flex">
                                                                <AvatarFallback
                                                                    style={{
                                                                        backgroundColor: client.color,
                                                                        color: 'white',
                                                                    }}
                                                                >
                                                                    {client.name.charAt(0)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <Link href={`/clients/${client.id}`} className="font-medium hover:underline">
                                                                {client.name}
                                                            </Link>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden sm:table-cell">
                                                        <p className="text-sm text-muted-foreground">
                                                            {client.email}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {client.phone}
                                                        </p>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">
                                                        <Badge variant="outline">{stats.taskCount}</Badge>
                                                    </TableCell>
                                                    <TableCell className="hidden lg:table-cell">
                                                        €{(client.budget || 0).toLocaleString('it-IT')}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    aria-haspopup="true"
                                                                    size="icon"
                                                                    variant="ghost"
                                                                >
                                                                    <MoreHorizontal />
                                                                    <span className="sr-only">Toggle menu</span>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuLabel>Azioni</DropdownMenuLabel>
                                                                <DropdownMenuItem asChild>
                                                                    <Link href={`/clients/${client.id}`} className="w-full">Visualizza Profilo</Link>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => openEditClientModal(client)}>Modifica</DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem className="text-red-500" onClick={() => setClientToDelete(client)}>
                                                                    Elimina
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="permissions">
                    <Card>
                        <CardHeader>
                            <CardTitle>Gestione Permessi Ruoli</CardTitle>
                            <CardDescription>
                                Definisci quali pagine possono essere visualizzate e quali azioni possono essere eseguite da ciascun ruolo.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[200px]">Permesso</TableHead>
                                            <TableHead className="text-center">Amministratore</TableHead>
                                            <TableHead className="text-center">Project Manager</TableHead>
                                            <TableHead className="text-center">Collaboratore</TableHead>
                                            <TableHead className="text-center">Cliente</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow className="bg-secondary/30">
                                            <TableCell colSpan={5} className="font-semibold">Accesso Pagine</TableCell>
                                        </TableRow>
                                        {navItems.map((page) => (
                                            <TableRow key={page.href}>
                                                <TableCell className="font-medium">{page.label}</TableCell>
                                                <TableCell className="text-center">
                                                    <Checkbox checked disabled />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Checkbox
                                                        checked={rolePermissions['Project Manager']?.includes(page.href)}
                                                        onCheckedChange={(checked) => handlePermissionChange('Project Manager', page.href, !!checked)}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Checkbox
                                                        checked={rolePermissions['Collaboratore']?.includes(page.href)}
                                                        onCheckedChange={(checked) => handlePermissionChange('Collaboratore', page.href, !!checked)}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Checkbox
                                                        checked={rolePermissions['Cliente']?.includes(page.href)}
                                                        onCheckedChange={(checked) => handlePermissionChange('Cliente', page.href, !!checked)}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="bg-secondary/30">
                                            <TableCell colSpan={5} className="font-semibold">Azioni Specifiche</TableCell>
                                        </TableRow>
                                        {actionPermissions.map((action) => (
                                            <TableRow key={action.key}>
                                                <TableCell className="font-medium">{action.label}</TableCell>
                                                <TableCell className="text-center">
                                                    <Checkbox checked disabled />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Checkbox
                                                        checked={rolePermissions['Project Manager']?.includes(action.key)}
                                                        onCheckedChange={(checked) => handlePermissionChange('Project Manager', action.key, !!checked)}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Checkbox
                                                        checked={rolePermissions['Collaboratore']?.includes(action.key)}
                                                        onCheckedChange={(checked) => handlePermissionChange('Collaboratore', action.key, !!checked)}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Checkbox
                                                        checked={rolePermissions['Cliente']?.includes(action.key)}
                                                        onCheckedChange={(checked) => handlePermissionChange('Cliente', action.key, !!checked)}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="flex justify-end mt-4">
                                <Button onClick={handleSavePermissions} disabled={isEqual(initialPermissions, rolePermissions)}>
                                    Salva Permessi
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="task_priorities">
                    <Card>
                        <CardHeader>
                            <CardTitle>Impostazioni Priorità Task</CardTitle>
                            <CardDescription>
                                Definisci il numero di giorni lavorativi per la scadenza automatica di un task in base alla sua priorità.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4 max-w-md">
                                {allTaskPriorities.map(priority => (
                                    <div key={priority} className="flex items-center justify-between">
                                        <Label htmlFor={`priority-${priority}`} className="text-base">{priority}</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id={`priority-${priority}`}
                                                type="number"
                                                min="0"
                                                className="w-24"
                                                value={prioritySettings[priority] ?? ''}
                                                onChange={(e) => handlePrioritySettingsChange(priority, e.target.value)}
                                            />
                                            <span className="text-muted-foreground">giorni</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end mt-6">
                                <Button onClick={handleSavePrioritySettings}>Salva Impostazioni Priorità</Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="departments_teams">
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Reparti</CardTitle>
                                <Button size="sm" onClick={() => setModalOpen('department')}>+ Nuovo Reparto</Button>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Nome</TableHead>
                                                <TableHead className="hidden sm:table-cell">Utenti</TableHead>
                                                <TableHead className="text-right">
                                                    <span className="sr-only">Azioni</span>
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {departments.map((dept) => (
                                                <TableRow key={dept.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className="w-3 h-3 rounded-full"
                                                                style={{ backgroundColor: dept.color }}
                                                            />
                                                            {dept.name}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden sm:table-cell">
                                                        {dept.members?.length || 0}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon">
                                                                    <MoreVertical />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent>
                                                                <DropdownMenuItem onClick={() => openEditDepartmentModal(dept)}>Modifica</DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem className="text-red-500" onClick={() => setDepartmentToDelete(dept)}>Elimina</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Team</CardTitle>
                                <Button size="sm" onClick={() => setModalOpen('team')}>+ Nuovo Team</Button>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Nome</TableHead>
                                                <TableHead className="hidden sm:table-cell">Membri</TableHead>
                                                <TableHead className="text-right">
                                                    <span className="sr-only">Azioni</span>
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {teams.map((team) => (
                                                <TableRow key={team.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className="w-3 h-3 rounded-full"
                                                                style={{ backgroundColor: team.color }}
                                                            />
                                                            {team.name}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden sm:table-cell">{(team.members || []).length}</TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon">
                                                                    <MoreVertical />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent>
                                                                <DropdownMenuItem onClick={() => openEditTeamModal(team)}>Modifica</DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem className="text-red-500" onClick={() => setTeamToDelete(team)}>Elimina</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="activities">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Tipi di Attività per Task</CardTitle>
                            <Button size="sm" onClick={() => setModalOpen('activity')}>+ Nuova Attività</Button>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nome Attività</TableHead>
                                            <TableHead>Costo Orario</TableHead>
                                            <TableHead>Task Scadenza</TableHead>
                                            <TableHead className="text-right">
                                                <span className="sr-only">Azioni</span>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[...activityTypes].sort((a, b) => a.name.localeCompare(b.name)).map((activity) => (
                                            <TableRow key={activity.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="w-3 h-3 rounded-full"
                                                            style={{ backgroundColor: activity.color }}
                                                        />
                                                        {activity.name}
                                                    </div>
                                                </TableCell>
                                                <TableCell>€{activity.hourlyRate.toFixed(2)}</TableCell>
                                                <TableCell>
                                                    {activity.hasDeadlineTask ? <Badge variant="default">Sì</Badge> : <Badge variant="secondary">No</Badge>}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon">
                                                                <MoreVertical />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem onClick={() => openEditActivityModal(activity)}>Modifica</DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="text-red-500" onClick={() => setActivityToDelete(activity)}>Elimina</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="calendar_activities">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Tipi di Attività per Calendario</CardTitle>
                            <Button size="sm" onClick={() => setModalOpen('calendar_preset')}>+ Nuova Attività Calendario</Button>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nome Attività</TableHead>
                                            <TableHead>Durata Predefinita (min)</TableHead>
                                            <TableHead>Costo Orario (€)</TableHead>
                                            <TableHead className="text-right">Azioni</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[...presets].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' })).map((preset) => (
                                            <TableRow key={preset.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="w-3 h-3 rounded-full"
                                                            style={{ backgroundColor: preset.color }}
                                                        />
                                                        {preset.name}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{preset.defaultDuration}</TableCell>
                                                <TableCell>€{preset.hourlyRate?.toFixed(2) || '0.00'}</TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon">
                                                                <MoreVertical />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem onClick={() => openEditCalendarPresetModal(preset)}>Modifica</DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="text-red-500" onClick={() => setPresetToDelete(preset)}>Elimina</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="brief_services">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Servizi per Brief</CardTitle>
                            <Button size="sm" onClick={() => setModalOpen('service')}>+ Nuovo Servizio</Button>
                        </CardHeader>
                        <CardContent>
                            {briefServiceCategories.map(category => (
                                <div key={category.id} className="mb-6">
                                    <h3 className="text-lg font-semibold mb-2 border-b pb-2">{category.name}</h3>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Nome Servizio</TableHead>
                                                <TableHead className="hidden sm:table-cell">Descrizione</TableHead>
                                                <TableHead className="text-right">Azioni</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {briefServices.filter(s => s.categoryId === category.id).map(service => (
                                                <TableRow key={service.id}>
                                                    <TableCell className="font-medium">{service.name}</TableCell>
                                                    <TableCell className="hidden sm:table-cell">{service.description}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon" onClick={() => openEditServiceModal(service)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setServiceToDelete(service)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="editorial-plan">
                    <Card>
                        <CardHeader>
                            <CardTitle>Impostazioni Piano Editoriale</CardTitle>
                            <CardDescription>
                                Gestisci le opzioni globali per la creazione di contenuti.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                {/* Gestione Pillars (Topics) */}
                                <div className="space-y-4 p-4 border rounded-lg">
                                    <h3 className="font-semibold">Topics</h3>
                                    <div className="flex gap-2">
                                        <Input placeholder="Nuovo Topic" value={newPillarName} onChange={e => setNewPillarName(e.target.value)} />
                                    </div>
                                    <div className="flex gap-2">
                                        <Select value={newPillarClient} onValueChange={setNewPillarClient}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Per tutti i clienti</SelectItem>
                                                {[...clients].sort((a, b) => a.name.localeCompare(b.name)).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <Button type="button" onClick={handleAddPillar}><Plus /></Button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableBody>
                                                {editorialPillars.map(p => (
                                                    <TableRow key={p.id}>
                                                        <TableCell>{p.name} <Badge variant="outline">{p.clientId ? clients.find(c => c.id === p.clientId)?.name : 'Globale'}</Badge></TableCell>
                                                        <TableCell className="text-right">
                                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => { await deleteEditorialPillar(p.id); await fetchData(); }}>
                                                                <Trash2 />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                                {/* Gestione Formats */}
                                <div className="space-y-4 p-4 border rounded-lg">
                                    <h3 className="font-semibold">Formati</h3>
                                    <div className="flex gap-2">
                                        <Input placeholder="Nuovo Formato" value={newFormatName} onChange={e => setNewFormatName(e.target.value)} />
                                        <Button type="button" onClick={handleAddFormat}><Plus /></Button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableBody>
                                                {editorialFormats.map(f => (
                                                    <TableRow key={f.id}>
                                                        <TableCell>{f.name}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => { await deleteEditorialFormat(f.id); await fetchData(); }}>
                                                                <Trash2 />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                                {/* Gestione Statuses */}
                                <div className="space-y-4 p-4 border rounded-lg">
                                    <h3 className="font-semibold">Stati Contenuto</h3>
                                    <div className="flex gap-2">
                                        <Input placeholder="Nuovo Stato" value={newStatusName} onChange={e => setNewStatusName(e.target.value)} />
                                        <Input type="color" value={newStatusColor} onChange={e => setNewStatusColor(e.target.value)} className="w-12 p-1" />
                                        <Button type="button" onClick={handleAddStatus}><Plus /></Button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableBody>
                                                {editorialStatuses.map(s => (
                                                    <TableRow key={s.id}>
                                                        <TableCell><Badge style={{ backgroundColor: s.color, color: 'white' }}>{s.name}</Badge></TableCell>
                                                        <TableCell className="text-right">
                                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => { await deleteEditorialStatus(s.id); await fetchData(); }}>
                                                                <Trash2 />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {/* Gestione Colonne Personalizzate */}
                                <div className="space-y-4 p-4 border rounded-lg">
                                    <h3 className="font-semibold">Colonne Personalizzate</h3>
                                    <div className="space-y-2">
                                        <Label htmlFor="newColumnName">Nome Nuova Colonna</Label>
                                        <Input id="newColumnName" placeholder="Es. Tone of Voice" value={newColumnName} onChange={e => setNewColumnName(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="newColumnType">Tipo Colonna</Label>
                                        <Select value={newColumnType} onValueChange={(v) => setNewColumnType(v as 'text' | 'select')}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="text">Testo Semplice</SelectItem>
                                                <SelectItem value="select">Elenco a Discesa</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {newColumnType === 'select' && (
                                        <div className="space-y-2">
                                            <Label htmlFor="newColumnOptions">Opzioni (separate da virgola)</Label>
                                            <Input id="newColumnOptions" placeholder="Es. Informativo, Promozionale" value={newColumnOptions} onChange={e => setNewColumnOptions(e.target.value)} />
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <Label>Applica Colonna a Clienti (opzionale)</Label>
                                        <div className="max-h-32 overflow-y-auto space-y-1 border p-2 rounded-md">
                                            {[...clients].sort((a, b) => a.name.localeCompare(b.name)).map(client => (
                                                <div key={client.id} className="flex items-center gap-2">
                                                    <Checkbox
                                                        id={`client-col-${client.id}`}
                                                        checked={newColumnClients.includes(client.id)}
                                                        onCheckedChange={() => handleColumnClientToggle(client.id)}
                                                    />
                                                    <Label htmlFor={`client-col-${client.id}`} className="font-normal">{client.name}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        <Button type="button" onClick={handleAddColumn}><Plus /> Aggiungi Colonna</Button>
                                    </div>

                                    <div className="overflow-x-auto pt-4 border-t">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Nome Colonna</TableHead>
                                                    <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                                                    <TableHead className="text-right">Azioni</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {editorialColumns.map(c => (
                                                    <TableRow key={c.id}>
                                                        <TableCell>
                                                            <p className="font-medium">{c.name}</p>
                                                            <div className="text-xs text-muted-foreground space-x-1">
                                                                {(c.clientIds || []).length > 0
                                                                    ? (c.clientIds || []).map(id => <Badge key={id} variant="secondary">{clients.find(cl => cl.id === id)?.name || 'N/D'}</Badge>)
                                                                    : <Badge variant="outline">Tutti i clienti</Badge>
                                                                }
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="hidden sm:table-cell">
                                                            <Badge variant="outline">{c.type}</Badge>
                                                            {c.type === 'select' && c.options && (
                                                                <div className="text-xs text-muted-foreground mt-1 space-x-1">
                                                                    {c.options.map(opt => <Badge key={opt} variant="secondary">{opt}</Badge>)}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => { await deleteEditorialColumn(c.id); await fetchData(); }}>
                                                                <Trash2 />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Sounds Settings Tab */}
                <TabsContent value="sounds">
                    <AdminSoundsSettings />
                </TabsContent>

                {/* Dashboard Widgets Settings Tab */}
                <TabsContent value="dashboard_widgets">
                    <AdminUserWidgets users={users} onUpdate={() => refetchData('users')} />
                </TabsContent>

                {/* Email Templates Settings Tab */}
                <TabsContent value="email_templates">
                    <AdminEmailTemplates />
                </TabsContent>

                {/* Automations Tab */}
                <TabsContent value="automations">
                    <AdminAutomations />
                </TabsContent>

                {/* Company Costs Tab */}
                <TabsContent value="company_costs">
                    <AdminCompanyCosts users={users} />
                </TabsContent>

                {/* Site Icons Tab */}
                <TabsContent value="site_icons">
                    <AdminSiteIcons />
                </TabsContent>
            </Tabs>


            <Dialog open={!!modalOpen} onOpenChange={(isOpen) => !isOpen && handleCloseModal()}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {modalOpen === 'user' && 'Crea Nuovo Utente'}
                            {modalOpen === 'edit-user' && `Modifica Utente: ${editingUser?.name}`}
                            {modalOpen === 'client' && 'Crea Nuovo Cliente'}
                            {modalOpen === 'edit-client' && `Modifica Cliente: ${editingClient?.name}`}
                            {modalOpen === 'department' && 'Crea Nuovo Reparto'}
                            {modalOpen === 'edit-department' && `Modifica Reparto: ${editingDepartment?.name}`}
                            {modalOpen === 'team' && 'Crea Nuovo Team'}
                            {modalOpen === 'edit-team' && `Modifica Team: ${editingTeam?.name}`}
                            {modalOpen === 'activity' && 'Crea Nuova Attività'}
                            {modalOpen === 'edit-activity' && `Modifica Attività: ${editingActivity?.name}`}
                            {modalOpen === 'service' && 'Crea Nuovo Servizio Brief'}
                            {modalOpen === 'edit-service' && `Modifica Servizio Brief: ${editingService?.name}`}
                            {modalOpen === 'calendar_preset' && 'Crea Nuova Attività Calendario'}
                            {modalOpen === 'edit-calendar_preset' && `Modifica Attività Calendario: ${editingCalendarPreset?.name}`}
                        </DialogTitle>
                        <DialogDescription>
                            Compila i campi sottostanti per procedere.
                        </DialogDescription>
                    </DialogHeader>
                    <Suspense fallback={<AdminFormSkeleton />}>
                        <AdminForm
                            modalOpen={modalOpen}
                            editingUser={editingUser}
                            editingClient={editingClient}
                            editingDepartment={editingDepartment}
                            editingTeam={editingTeam}
                            editingActivity={editingActivity}
                            editingService={editingService}
                            briefServiceCategories={briefServiceCategories}
                            editingCalendarPreset={editingCalendarPreset}
                            departments={departments}
                            teams={teams}
                            users={users}
                            clients={clients}
                            activityTypes={activityTypes}
                            handleFormSubmit={handleFormSubmit}
                            handleCloseModal={handleCloseModal}
                        />
                    </Suspense>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!userToDelete} onOpenChange={(isOpen) => !isOpen && setUserToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Questa azione non può essere annullata. Questo eliminerà permanentemente l'utente
                            <span className="font-bold"> {userToDelete?.name}</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setUserToDelete(null)}>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90">
                            Elimina
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!clientToDelete} onOpenChange={(isOpen) => !isOpen && setClientToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Questa azione non può essere annullata. Questo eliminerà permanentemente il cliente
                            <span className="font-bold"> {clientToDelete?.name}</span> e tutti i suoi dati associati (task, progetti, ecc.).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setClientToDelete(null)}>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteClient} className="bg-destructive hover:bg-destructive/90">
                            Elimina
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!departmentToDelete} onOpenChange={(isOpen) => !isOpen && setDepartmentToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Questa azione non può essere annullata. Questo eliminerà permanentemente il reparto
                            <span className="font-bold"> {departmentToDelete?.name}</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDepartmentToDelete(null)}>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteDepartment} className="bg-destructive hover:bg-destructive/90">
                            Elimina
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!teamToDelete} onOpenChange={(isOpen) => !isOpen && setTeamToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Questa azione non può essere annullata. Questo eliminerà permanentemente il team
                            <span className="font-bold"> {teamToDelete?.name}</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setTeamToDelete(null)}>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteTeam} className="bg-destructive hover:bg-destructive/90">
                            Elimina
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!activityToDelete} onOpenChange={(isOpen) => !isOpen && setActivityToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Questa azione non può essere annullata. Questo eliminerà permanentemente l'attività
                            <span className="font-bold"> {activityToDelete?.name}</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setActivityToDelete(null)}>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteActivity} className="bg-destructive hover:bg-destructive/90">
                            Elimina
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!serviceToDelete} onOpenChange={(isOpen) => !isOpen && setServiceToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Questa azione non può essere annullata. Questo eliminerà permanentemente il servizio
                            <span className="font-bold"> {serviceToDelete?.name}</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setServiceToDelete(null)}>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteService} className="bg-destructive hover:bg-destructive/90">
                            Elimina
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!presetToDelete} onOpenChange={(isOpen) => !isOpen && setPresetToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Questa azione non può essere annullata. Questo eliminerà permanentemente il preset
                            <span className="font-bold"> {presetToDelete?.name}</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setPresetToDelete(null)}>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeletePreset} className="bg-destructive hover:bg-destructive/90">
                            Elimina
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default function AdminPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AdminPageContent />
        </Suspense>
    )
}
