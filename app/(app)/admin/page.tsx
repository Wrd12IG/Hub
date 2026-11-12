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
    updateDepartment,
    deleteDepartment,
    updateTeam,
    deleteTeam,
    getActivityTypes,
    addActivityType,
    updateActivityType,
    deleteActivityType,
    updateClient,
    getClients,
    getRolePermissions,
    updateRolePermissions,
    getEditorialFormats,
    getEditorialStatuses,
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
import { AdminPermissions } from '@/components/admin-permissions';
import { toggle as togglePermission } from '@/lib/admin-permissions-model';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, MoreVertical, X, Plus, Trash2, Pencil, LayoutDashboard, Mail, Volume2, Zap, Coins, Image as ImageIcon, Users, Building2, Shield, Sliders, CheckSquare, Calendar, FileText, CalendarDays } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { SYSTEM_STATUSES, SYSTEM_FORMATS, isSystemRow } from '@/lib/actions';
import type { ClientImpact } from '@/lib/client-delete';
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
import { getInitials, getUserAvatar } from '@/lib/utils';
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

const AdminClientCosts = dynamic(() => import('@/components/admin-client-costs'), { ssr: false });
const AdminCompanyCosts = dynamic(() => import('@/components/admin-company-costs'), {
    loading: () => <div className="p-6 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>,
});

const AdminSiteIcons = dynamic(() => import('@/components/admin-site-icons'), {
    loading: () => <div className="p-6 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>,
});


type ModalState = 'user' | 'client' | 'department' | 'team' | 'activity' | 'service' | 'calendar_preset' | 'edit-user' | 'edit-client' | 'edit-department' | 'edit-team' | 'edit-activity' | 'edit-service' | 'edit-calendar_preset' | null;

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
    const { currentUser, handleCreateUser, users, clients, activityTypes, allTasks: tasks, isLoadingLayout, refetchData, taskPrioritySettings: initialPrioritySettings, setTaskPrioritySettings, calendarActivityPresets: presets } = useLayoutData();
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
    const [clientImpact, setClientImpact] = useState<ClientImpact | null>(null);
    const [clientImpactError, setClientImpactError] = useState<string | null>(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
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
    const [editorialFormats, setEditorialFormats] = useState<EditorialFormat[]>([]);
    const [editorialStatuses, setEditorialStatuses] = useState<EditorialStatus[]>([]);
    const [editorialColumns, setEditorialColumns] = useState<EditorialColumn[]>([]);
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
                formatsData,
                statusesData,
                columnsData,
                briefServicesData,
                briefServiceCategoriesData,
            ] = await Promise.all([
                getDepartments(),
                getTeams(),
                getRolePermissions(),
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

    const [isSavingPermissions, setIsSavingPermissions] = useState(false);

    const handlePermissionChange = (role: string, permission: string, checked: boolean) => {
        setRolePermissions(prev => togglePermission(prev, role, permission, checked));
    };

    const handleSavePermissions = async () => {
        setIsSavingPermissions(true);
        try {
            const promises = Object.entries(rolePermissions).map(([roleId, permissions]) =>
                updateRolePermissions(roleId, permissions)
            );
            await Promise.all(promises);
            setInitialPermissions(rolePermissions);
            toast({ title: "Permessi salvati", description: "Le modifiche valgono da subito; chi è già collegato le vede ricaricando la pagina." });
        } catch (error) {
            console.error("Failed to save permissions", error);
            toast({ title: "Errore", description: "Impossibile salvare i permessi.", variant: 'destructive' });
        } finally {
            setIsSavingPermissions(false);
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
                        avatar: (data.avatar as string)?.trim() || undefined,
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
                        avatar: (data.avatar as string)?.trim() || undefined,
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
                        socialManagerId: data.socialManagerId && data.socialManagerId !== 'none' ? data.socialManagerId : undefined,
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
                        socialManagerId: data.socialManagerId && data.socialManagerId !== 'none' ? data.socialManagerId : undefined,
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

    const { authFetch } = useAuthFetch();

    /** Blocca o riapre l'accesso di una persona (account di accesso incluso). I suoi task e lo storico restano. */
    const handleToggleUserStatus = async (user: User) => {
        const next = user.status === 'Inattivo' ? 'Attivo' : 'Inattivo';
        try {
            const res = await authFetch(`/api/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j?.error || `Errore ${res.status}`);
            toast({ title: next === 'Inattivo' ? 'Accesso bloccato' : 'Accesso riaperto', description: next === 'Inattivo' ? `${user.name} non può più entrare.` : `${user.name} può entrare di nuovo.` });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Errore', description: error.message || "Impossibile cambiare lo stato.", variant: 'destructive' });
        }
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;
        try {
            const res = await authFetch(`/api/users/${userToDelete.id}`, { method: 'DELETE' });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j?.error || `Errore ${res.status}`);
            toast({ title: "Utente eliminato", description: `${userToDelete.name} non ha più né profilo né accesso.` });
            setUserToDelete(null);
            fetchData();
        } catch (error: any) {
            console.error('Failed to delete user:', error);
            toast({ title: "Errore", description: error.message || "Impossibile eliminare l'utente.", variant: 'destructive' });
        }
    };

    /** Apre la conferma e legge cosa sparirebbe davvero: i numeri veri, non una frase generica. */
    const askDeleteClient = async (client: Client) => {
        setClientToDelete(client);
        setClientImpact(null);
        setClientImpactError(null);
        setDeleteConfirmText('');
        try {
            const res = await authFetch(`/api/clients/${client.id}/impact`);
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j?.error || `Errore ${res.status}`);
            setClientImpact(j);
        } catch (error: any) {
            setClientImpactError(error.message || 'Impossibile leggere cosa verrebbe eliminato.');
        }
    };

    const handleDeleteClient = async () => {
        if (!clientToDelete) return;
        try {
            const res = await authFetch(`/api/clients/${clientToDelete.id}`, { method: 'DELETE' });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j?.error || `Errore ${res.status}`);
            toast({ title: "Cliente eliminato", description: `${clientToDelete.name} e i dati collegati sono stati eliminati.` });
            setClientToDelete(null);
            fetchData();
        } catch (error: any) {
            console.error('Failed to delete client:', error);
            toast({ title: "Errore", description: error.message || "Impossibile eliminare il cliente.", variant: 'destructive' });
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
                    Persone e accessi, regole di lavoro, costi, comunicazioni e aspetto dell&apos;app.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="h-auto flex-col items-stretch gap-3 bg-transparent p-0">
                    {ADMIN_GROUPS.map((group) => (
                        <div key={group.label} className="flex flex-wrap items-center gap-2">
                            <span className="w-full text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:w-36">{group.label}</span>
                            {group.tabs.map(({ value, label, Icon, color }) => (
                                <TabsTrigger key={value} value={value} className="border border-input bg-background hover:bg-accent hover:text-accent-foreground data-[state=active]:border-primary data-[state=active]:border-2 data-[state=active]:shadow-md transition-all flex items-center gap-1.5"><Icon className={`h-4 w-4 ${color}`} /> {label}</TabsTrigger>
                            ))}
                            {/* Collegamento a una pagina a parte (non è una scheda): stesso aspetto, solo amministratori. */}
                            {group.label === 'Azienda' && currentUser?.role === 'Amministratore' && (
                                <Link href="/admin/report-mensile" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground gap-1.5">
                                    <Mail className="h-4 w-4 text-sky-400" /> Mail mensile KPI
                                </Link>
                            )}
                        </div>
                    ))}
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
                                        {[...users].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-9 w-9">
                                                            <AvatarImage src={getUserAvatar(user)} alt={user.name} />
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
                                                            <DropdownMenuItem onClick={() => handleToggleUserStatus(user)}>{user.status === 'Inattivo' ? 'Riattiva accesso' : 'Blocca accesso'}</DropdownMenuItem>
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
                                            <TableHead className="hidden md:table-cell">Social Manager</TableHead>
                                            <TableHead className="hidden md:table-cell">N. Task</TableHead>
                                            <TableHead className="hidden lg:table-cell">Budget</TableHead>
                                            <TableHead className="text-right">
                                                <span className="sr-only">Azioni</span>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[...clients].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((client) => {
                                            const stats = getClientStats(client.id);
                                            const socialManager = client.socialManagerId ? users.find(u => u.id === client.socialManagerId) : null;
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
                                                                    {(client?.name || "").charAt(0)}
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
                                                        {socialManager ? (
                                                            <div className="flex items-center gap-2">
                                                                <Avatar className="h-6 w-6">
                                                                    <AvatarImage src={socialManager.avatar || getUserAvatar(socialManager)} />
                                                                    <AvatarFallback style={{ backgroundColor: socialManager.color || '#4285F4' }} className="text-xs text-white font-bold">
                                                                        {getInitials(socialManager.name)}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <span className="text-xs font-medium">{socialManager.name}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground italic">Non assegnato</span>
                                                        )}
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
                                                                <DropdownMenuItem className="text-red-500" onClick={() => askDeleteClient(client)}>
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
                    <AdminPermissions
                        permissions={rolePermissions}
                        initial={initialPermissions}
                        onChange={handlePermissionChange}
                        onDiscard={() => setRolePermissions(initialPermissions)}
                        onSave={handleSavePermissions}
                        saving={isSavingPermissions}
                        onGoToUsers={() => setActiveTab('users')}
                    />
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
                                        {[...activityTypes].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((activity) => (
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
                                                <TableCell>€{(activity.hourlyRate || 0).toFixed(2)}</TableCell>
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
                                                            {isSystemRow(f) || (SYSTEM_FORMATS as readonly string[]).includes(f.name)
                                                                ? <span className="text-[11px] text-muted-foreground" title="Lo usa l'app: non si elimina">di sistema</span>
                                                                : <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => { await deleteEditorialFormat(f.id); await fetchData(); }}>
                                                                    <Trash2 />
                                                                </Button>}
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
                                                            {isSystemRow(s) || SYSTEM_STATUSES.some(([n]) => n === s.name)
                                                                ? <span className="text-[11px] text-muted-foreground" title="Lo usa l'app: non si elimina">di sistema</span>
                                                                : <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => { await deleteEditorialStatus(s.id); await fetchData(); }}>
                                                                    <Trash2 />
                                                                </Button>}
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
                                            {[...clients].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(client => (
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
                    <div className="space-y-10">
                        <section>
                            <h2 className="mb-3 text-xl font-semibold tracking-tight">Costi fissi</h2>
                            <AdminCompanyCosts users={users} />
                        </section>
                        <AdminClientCosts />
                    </div>
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
                        <AlertDialogTitle>Eliminare {userToDelete?.name}?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            <span className="block">Verranno eliminati il profilo <b>e l&apos;account con cui accede</b>: non potrà più entrare, e non si torna indietro.</span>
                            <span className="block">I suoi task, le ore registrate e i commenti restano dove sono, con il suo nome nello storico.</span>
                            <span className="block">Se vuoi solo impedirgli di entrare per ora, usa «Blocca accesso»: si può riaprire.</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setUserToDelete(null)}>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90">
                            Elimina definitivamente
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!clientToDelete} onOpenChange={(isOpen) => !isOpen && setClientToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Eliminare {clientToDelete?.name}?</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3 text-sm">
                                <p>Non si torna indietro. Insieme alla scheda sparisce:</p>
                                {clientImpactError && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-destructive">{clientImpactError}</p>}
                                {!clientImpact && !clientImpactError && <p>Sto contando cosa verrebbe eliminato…</p>}
                                {clientImpact && (
                                    <ul className="list-disc space-y-0.5 pl-5">
                                        <li>budget, note riservate e collegamenti con Meta, Google e gli altri canali (token compresi)</li>
                                        {clientImpact.hasPublicLink && <li>il link pubblico del report: chi lo ha non lo vedrà più</li>}
                                        {clientImpact.counts.map((c) => <li key={c.label}><b>{c.count}</b> {c.label}</li>)}
                                        {clientImpact.counts.length === 0 && <li>nessun task, progetto o contenuto collegato</li>}
                                    </ul>
                                )}
                                {clientImpact && clientImpact.sharedActivities > 0 && <p>{clientImpact.sharedActivities} attività del calendario condivise con altri clienti restano, senza questo cliente.</p>}
                                {clientImpact && clientImpact.clientUsers.length > 0 && <p>Gli accessi del cliente ({clientImpact.clientUsers.map((u) => u.email || u.name).join(', ')}) non vengono eliminati ma <b>vengono bloccati</b>.</p>}
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-foreground">Per confermare scrivi il nome del cliente: <b>{clientToDelete?.name}</b></label>
                                    <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder={clientToDelete?.name} autoComplete="off" />
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setClientToDelete(null)}>Annulla</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteClient}
                            disabled={!clientImpact || deleteConfirmText.trim().toLowerCase() !== (clientToDelete?.name || '').trim().toLowerCase()}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            Elimina definitivamente
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
                            Questa azione non può essere annullata. Questo eliminerà permanentemente l&apos;attività
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

/** Come sono raggruppate le schede. L'ordine segue il lavoro: prima chi (persone e accessi), poi come si lavora, poi i soldi. */
const ADMIN_GROUPS: { label: string; tabs: { value: string; label: string; Icon: React.ComponentType<{ className?: string }>; color: string }[] }[] = [
    { label: 'Persone e accessi', tabs: [
        { value: 'users', label: 'Utenti', Icon: Users, color: 'text-blue-400' },
        { value: 'clients', label: 'Clienti', Icon: Building2, color: 'text-emerald-400' },
        { value: 'permissions', label: 'Permessi', Icon: Shield, color: 'text-amber-400' },
    ] },
    { label: 'Come si lavora', tabs: [
        { value: 'task_priorities', label: 'Priorità', Icon: Sliders, color: 'text-purple-400' },
        { value: 'activities', label: 'Attività dei task', Icon: CheckSquare, color: 'text-teal-400' },
        { value: 'calendar_activities', label: 'Attività del calendario', Icon: Calendar, color: 'text-rose-400' },
        { value: 'brief_services', label: 'Servizi dei brief', Icon: FileText, color: 'text-yellow-400' },
        { value: 'editorial-plan', label: 'Piano editoriale', Icon: CalendarDays, color: 'text-pink-400' },
    ] },
    { label: 'Azienda', tabs: [
        { value: 'company_costs', label: 'Costi', Icon: Coins, color: 'text-emerald-400' },
    ] },
    { label: 'Comunicazione', tabs: [
        { value: 'email_templates', label: 'Template email', Icon: Mail, color: 'text-sky-400' },
        { value: 'automations', label: 'Automazioni', Icon: Zap, color: 'text-amber-400' },
    ] },
    { label: 'Aspetto', tabs: [
        { value: 'dashboard_widgets', label: 'Widget della dashboard', Icon: LayoutDashboard, color: 'text-cyan-400' },
        { value: 'sounds', label: 'Suoni', Icon: Volume2, color: 'text-violet-400' },
        { value: 'site_icons', label: 'Icone del sito', Icon: ImageIcon, color: 'text-fuchsia-400' },
    ] },
];

export default function AdminPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AdminPageContent />
        </Suspense>
    )
}
