'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLayoutData } from '@/app/(app)/layout-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
    Download,
    FileSpreadsheet,
    FileText,
    Clock,
    Users,
    Building2,
    Calendar,
    TrendingUp,
    Euro,
    Filter,
    RefreshCw,
    Printer,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInSeconds, subMonths, isWithinInterval, startOfDay, endOfDay, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn, getInitials } from '@/lib/utils';
import type { Task, User, Client, CalendarActivity, ActivityType, CalendarActivityPreset } from '@/lib/data';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BurndownChart, VelocityChart } from '@/components/analytics-charts';
import { BarChart2 } from 'lucide-react';

// Types for report data
interface TimeEntry {
    date: string;
    userId: string;
    userName: string;
    clientId: string;
    clientName: string;
    projectName: string;
    taskTitle: string;
    activityType: string;
    hours: number;
    cost: number;
    source: 'task' | 'calendar';
}

interface UserTimesheet {
    userId: string;
    userName: string;
    userColor?: string;
    entries: { [date: string]: number };
    totalHours: number;
    totalCost: number;
}

interface ClientReport {
    clientId: string;
    clientName: string;
    clientColor?: string;
    totalHours: number;
    totalCost: number;
    taskCount: number;
    activities: { name: string; hours: number; cost: number }[];
}

// Format time utilities
const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
};

export default function ReportsPage() {
    const {
        users,
        clients,
        allTasks,
        allProjects,
        activityTypes,
        calendarActivities,
        calendarActivityPresets,
        clientsById,
        usersById,
        isLoadingLayout
    } = useLayoutData();

    // Filters
    const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date()),
    });
    const [selectedClient, setSelectedClient] = useState<string>('all');
    const [selectedUser, setSelectedUser] = useState<string>('all');
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [isFiltersOpen, setIsFiltersOpen] = useState(true);

    // Date shortcuts
    const setDateShortcut = (type: 'week' | 'month' | 'quarter' | 'year') => {
        const now = new Date();
        let start: Date, end: Date;

        switch (type) {
            case 'week':
                start = startOfWeek(now, { weekStartsOn: 1 });
                end = endOfWeek(now, { weekStartsOn: 1 });
                break;
            case 'month':
                start = startOfMonth(now);
                end = endOfMonth(now);
                break;
            case 'quarter':
                const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                start = quarterStart;
                end = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
                break;
            case 'year':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31);
                break;
            default:
                return;
        }

        setDateRange({ start, end });
    };

    // Previous month shortcut
    const setPreviousMonth = () => {
        const prevMonth = subMonths(new Date(), 1);
        setDateRange({
            start: startOfMonth(prevMonth),
            end: endOfMonth(prevMonth),
        });
    };

    // Activity type lookup
    const activityTypesByName = useMemo(() =>
        activityTypes.reduce((acc, type) => ({ ...acc, [type.name]: type }), {} as Record<string, ActivityType>),
        [activityTypes]
    );

    const presetsById = useMemo(() =>
        (calendarActivityPresets || []).reduce((acc, preset) => ({ ...acc, [preset.id]: preset }), {} as Record<string, CalendarActivityPreset>),
        [calendarActivityPresets]
    );

    // Calculate all time entries
    const timeEntries = useMemo((): TimeEntry[] => {
        const entries: TimeEntry[] = [];

        if (!dateRange.start || !dateRange.end) return entries;

        // Process tasks
        allTasks.forEach(task => {
            if (task.timeSpent && task.timeSpent > 0) {
                const taskDate = task.dueDate ? parseISO(task.dueDate) : (task.updatedAt ? parseISO(task.updatedAt as string) : new Date());

                if (!isWithinInterval(taskDate, { start: dateRange.start!, end: dateRange.end! })) return;
                if (selectedClient !== 'all' && task.clientId !== selectedClient) return;
                if (selectedUser !== 'all' && task.assignedUserId !== selectedUser) return;

                const hours = task.timeSpent / 3600;
                const activityType = task.activityType ? activityTypesByName[task.activityType] : null;
                const cost = hours * (activityType?.hourlyRate || 0);
                const project = allProjects.find(p => p.id === task.projectId);

                entries.push({
                    date: format(taskDate, 'yyyy-MM-dd'),
                    userId: task.assignedUserId || 'unassigned',
                    userName: task.assignedUserId ? (usersById[task.assignedUserId]?.name || 'N/D') : 'Non Assegnato',
                    clientId: task.clientId,
                    clientName: clientsById[task.clientId]?.name || 'N/D',
                    projectName: project?.name || '-',
                    taskTitle: task.title,
                    activityType: task.activityType || 'Altro',
                    hours,
                    cost,
                    source: 'task',
                });
            }
        });

        // Process calendar activities
        (calendarActivities || []).forEach(activity => {
            if (!activity.startTime || !activity.endTime) return;

            const activityDate = parseISO(activity.startTime);
            if (!isWithinInterval(activityDate, { start: dateRange.start!, end: dateRange.end! })) return;
            if (selectedUser !== 'all' && activity.userId !== selectedUser) return;

            const hours = differenceInSeconds(parseISO(activity.endTime), parseISO(activity.startTime)) / 3600;
            if (hours <= 0) return;

            const preset = activity.presetId ? presetsById[activity.presetId] : null;
            const hourlyRate = preset?.hourlyRate || 20;
            const cost = hours * hourlyRate;

            // Handle multiple clients
            const clientIds = activity.clientIds || (activity.clientId ? [activity.clientId] : []);

            if (selectedClient !== 'all' && !clientIds.includes(selectedClient)) return;

            const targetClients = selectedClient !== 'all'
                ? [selectedClient]
                : (clientIds.length > 0 ? clientIds : ['no-client']);

            targetClients.forEach(clientId => {
                const hoursPerClient = hours / targetClients.length;
                const costPerClient = cost / targetClients.length;

                entries.push({
                    date: format(activityDate, 'yyyy-MM-dd'),
                    userId: activity.userId || 'unassigned',
                    userName: activity.userId ? (usersById[activity.userId]?.name || 'N/D') : 'Non Assegnato',
                    clientId,
                    clientName: clientId !== 'no-client' ? (clientsById[clientId]?.name || 'N/D') : 'Senza Cliente',
                    projectName: '-',
                    taskTitle: activity.title,
                    activityType: preset?.name || 'Attività',
                    hours: hoursPerClient,
                    cost: costPerClient,
                    source: 'calendar',
                });
            });
        });

        return entries.sort((a, b) => b.date.localeCompare(a.date));
    }, [allTasks, calendarActivities, dateRange, selectedClient, selectedUser, activityTypesByName, presetsById, clientsById, usersById, allProjects]);

    // Calculate totals
    const totals = useMemo(() => ({
        hours: timeEntries.reduce((sum, e) => sum + e.hours, 0),
        cost: timeEntries.reduce((sum, e) => sum + e.cost, 0),
        entries: timeEntries.length,
    }), [timeEntries]);

    // User timesheets (weekly view)
    const userTimesheets = useMemo((): UserTimesheet[] => {
        if (!dateRange.start || !dateRange.end) return [];

        const sheets: { [userId: string]: UserTimesheet } = {};

        timeEntries.forEach(entry => {
            if (!sheets[entry.userId]) {
                const user = usersById[entry.userId];
                sheets[entry.userId] = {
                    userId: entry.userId,
                    userName: entry.userName,
                    userColor: user?.color,
                    entries: {},
                    totalHours: 0,
                    totalCost: 0,
                };
            }

            sheets[entry.userId].entries[entry.date] =
                (sheets[entry.userId].entries[entry.date] || 0) + entry.hours;
            sheets[entry.userId].totalHours += entry.hours;
            sheets[entry.userId].totalCost += entry.cost;
        });

        return Object.values(sheets).sort((a, b) => b.totalHours - a.totalHours);
    }, [timeEntries, usersById, dateRange]);

    // Client reports
    const clientReports = useMemo((): ClientReport[] => {
        const reports: { [clientId: string]: ClientReport } = {};

        timeEntries.forEach(entry => {
            if (!reports[entry.clientId]) {
                const client = clientsById[entry.clientId];
                reports[entry.clientId] = {
                    clientId: entry.clientId,
                    clientName: entry.clientName,
                    clientColor: client?.color,
                    totalHours: 0,
                    totalCost: 0,
                    taskCount: 0,
                    activities: [],
                };
            }

            reports[entry.clientId].totalHours += entry.hours;
            reports[entry.clientId].totalCost += entry.cost;
            if (entry.source === 'task') reports[entry.clientId].taskCount++;

            // Group by activity type
            const existingActivity = reports[entry.clientId].activities.find(a => a.name === entry.activityType);
            if (existingActivity) {
                existingActivity.hours += entry.hours;
                existingActivity.cost += entry.cost;
            } else {
                reports[entry.clientId].activities.push({
                    name: entry.activityType,
                    hours: entry.hours,
                    cost: entry.cost,
                });
            }
        });

        return Object.values(reports).sort((a, b) => b.totalCost - a.totalCost);
    }, [timeEntries, clientsById]);

    // Generate weekly dates for timesheet header
    const weekDates = useMemo(() => {
        if (!dateRange.start || !dateRange.end) return [];
        const dates: Date[] = [];
        let current = startOfDay(dateRange.start);
        while (current <= dateRange.end) {
            dates.push(current);
            current = addDays(current, 1);
        }
        // Limit to 31 days for display
        return dates.slice(0, 31);
    }, [dateRange]);

    // Export to Excel
    const exportToExcel = useCallback(async (type: 'timesheet' | 'client' | 'detailed') => {
        const XLSX = (await import('xlsx')).default;
        const { saveAs } = await import('file-saver');

        let data: any[] = [];
        let filename = '';

        if (type === 'detailed') {
            data = timeEntries.map(e => ({
                'Data': format(parseISO(e.date), 'dd/MM/yyyy'),
                'Utente': e.userName,
                'Cliente': e.clientName,
                'Progetto': e.projectName,
                'Attività': e.taskTitle,
                'Tipo': e.activityType,
                'Ore': parseFloat(e.hours.toFixed(2)),
                'Costo (€)': parseFloat(e.cost.toFixed(2)),
                'Fonte': e.source === 'task' ? 'Task' : 'Calendario',
            }));
            filename = `Report_Dettagliato_${format(dateRange.start!, 'yyyy-MM-dd')}_${format(dateRange.end!, 'yyyy-MM-dd')}.xlsx`;
        } else if (type === 'timesheet') {
            data = userTimesheets.map(ts => {
                const row: any = { 'Utente': ts.userName };
                weekDates.forEach(date => {
                    const dateKey = format(date, 'yyyy-MM-dd');
                    row[format(date, 'dd/MM')] = parseFloat((ts.entries[dateKey] || 0).toFixed(2));
                });
                row['Totale Ore'] = parseFloat(ts.totalHours.toFixed(2));
                row['Totale €'] = parseFloat(ts.totalCost.toFixed(2));
                return row;
            });
            filename = `Timesheet_${format(dateRange.start!, 'yyyy-MM-dd')}_${format(dateRange.end!, 'yyyy-MM-dd')}.xlsx`;
        } else if (type === 'client') {
            data = clientReports.map(c => ({
                'Cliente': c.clientName,
                'Ore Totali': parseFloat(c.totalHours.toFixed(2)),
                'Costo Totale (€)': parseFloat(c.totalCost.toFixed(2)),
                'N. Task': c.taskCount,
                'Attività Principali': c.activities.map(a => `${a.name}: ${a.hours.toFixed(1)}h`).join(', '),
            }));
            filename = `Report_Clienti_${format(dateRange.start!, 'yyyy-MM-dd')}_${format(dateRange.end!, 'yyyy-MM-dd')}.xlsx`;
        }

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

        // Auto-size columns
        const maxWidth = 50;
        const colWidths = Object.keys(data[0] || {}).map(key => ({
            wch: Math.min(maxWidth, Math.max(key.length, ...data.map(row => String(row[key] || '').length)))
        }));
        worksheet['!cols'] = colWidths;

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, filename);
    }, [timeEntries, userTimesheets, clientReports, weekDates, dateRange]);

    // Export to PDF
    const exportToPDF = useCallback(async (type: 'timesheet' | 'client' | 'detailed') => {
        const { jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;

        const doc = new jsPDF({ orientation: 'landscape' });

        // Header
        doc.setFontSize(20);
        doc.setTextColor(40, 40, 40);
        doc.text('W[r]Digital Marketing HUB', 14, 20);

        doc.setFontSize(14);
        doc.setTextColor(100, 100, 100);
        const periodText = `Periodo: ${format(dateRange.start!, 'dd/MM/yyyy')} - ${format(dateRange.end!, 'dd/MM/yyyy')}`;
        doc.text(periodText, 14, 28);

        doc.setFontSize(12);
        doc.text(`Generato il: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 35);

        let filename = '';

        if (type === 'detailed') {
            doc.setFontSize(16);
            doc.text('Report Dettagliato Time Tracking', 14, 45);

            const tableData = timeEntries.slice(0, 100).map(e => [
                format(parseISO(e.date), 'dd/MM'),
                e.userName.substring(0, 15),
                e.clientName.substring(0, 15),
                e.taskTitle.substring(0, 25),
                e.activityType.substring(0, 12),
                e.hours.toFixed(1) + 'h',
                formatCurrency(e.cost),
            ]);

            autoTable(doc, {
                head: [['Data', 'Utente', 'Cliente', 'Attività', 'Tipo', 'Ore', 'Costo']],
                body: tableData,
                startY: 50,
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [250, 204, 21], textColor: [0, 0, 0] },
            });

            filename = `Report_Dettagliato_${format(dateRange.start!, 'yyyy-MM-dd')}.pdf`;
        } else if (type === 'client') {
            doc.setFontSize(16);
            doc.text('Report per Cliente', 14, 45);

            const tableData = clientReports.map(c => [
                c.clientName,
                formatHours(c.totalHours),
                formatCurrency(c.totalCost),
                c.taskCount.toString(),
            ]);

            autoTable(doc, {
                head: [['Cliente', 'Ore Totali', 'Costo Totale', 'N. Task']],
                body: tableData,
                startY: 50,
                styles: { fontSize: 10 },
                headStyles: { fillColor: [250, 204, 21], textColor: [0, 0, 0] },
            });

            // Summary
            const finalY = (doc as any).lastAutoTable.finalY || 100;
            doc.setFontSize(12);
            doc.setTextColor(40, 40, 40);
            doc.text(`Totale Ore: ${formatHours(totals.hours)}`, 14, finalY + 15);
            doc.text(`Totale Costo: ${formatCurrency(totals.cost)}`, 14, finalY + 22);

            filename = `Report_Clienti_${format(dateRange.start!, 'yyyy-MM-dd')}.pdf`;
        } else if (type === 'timesheet') {
            doc.setFontSize(16);
            doc.text('Timesheet Settimanale', 14, 45);

            const headers = ['Utente', ...weekDates.slice(0, 7).map(d => format(d, 'EEE dd', { locale: it })), 'Totale'];
            const tableData = userTimesheets.map(ts => {
                const row = [ts.userName];
                weekDates.slice(0, 7).forEach(date => {
                    const dateKey = format(date, 'yyyy-MM-dd');
                    row.push((ts.entries[dateKey] || 0).toFixed(1) + 'h');
                });
                row.push(formatHours(ts.totalHours));
                return row;
            });

            autoTable(doc, {
                head: [headers],
                body: tableData,
                startY: 50,
                styles: { fontSize: 9 },
                headStyles: { fillColor: [250, 204, 21], textColor: [0, 0, 0] },
            });

            filename = `Timesheet_${format(dateRange.start!, 'yyyy-MM-dd')}.pdf`;
        }

        doc.save(filename);
    }, [timeEntries, clientReports, userTimesheets, weekDates, dateRange, totals]);

    if (isLoadingLayout) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">📊 Report & Time Tracking</h1>
                    <p className="text-muted-foreground">
                        Esporta report dettagliati su ore lavorate e costi
                    </p>
                </div>
            </div>

            {/* Filters */}
            <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
                <Card>
                    <CardHeader className="pb-3">
                        <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <Filter className="h-5 w-5" />
                                    <CardTitle className="text-lg">Filtri</CardTitle>
                                </div>
                                {isFiltersOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </div>
                        </CollapsibleTrigger>
                    </CardHeader>
                    <CollapsibleContent>
                        <CardContent className="space-y-4">
                            {/* Date shortcuts */}
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={() => setDateShortcut('week')}>
                                    Questa Settimana
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setDateShortcut('month')}>
                                    Questo Mese
                                </Button>
                                <Button variant="outline" size="sm" onClick={setPreviousMonth}>
                                    Mese Scorso
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setDateShortcut('quarter')}>
                                    Trimestre
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setDateShortcut('year')}>
                                    Anno
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label>Data Inizio</Label>
                                    <Input
                                        type="date"
                                        value={dateRange.start ? format(dateRange.start, 'yyyy-MM-dd') : ''}
                                        onChange={(e) => setDateRange(prev => ({
                                            ...prev,
                                            start: e.target.value ? parseISO(e.target.value) : null
                                        }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Data Fine</Label>
                                    <Input
                                        type="date"
                                        value={dateRange.end ? format(dateRange.end, 'yyyy-MM-dd') : ''}
                                        onChange={(e) => setDateRange(prev => ({
                                            ...prev,
                                            end: e.target.value ? parseISO(e.target.value) : null
                                        }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Cliente</Label>
                                    <Select value={selectedClient} onValueChange={setSelectedClient}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Tutti i clienti" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tutti i Clienti</SelectItem>
                                            {[...clients].sort((a, b) => a.name.localeCompare(b.name, 'it')).map(client => (
                                                <SelectItem key={client.id} value={client.id}>
                                                    {client.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Utente</Label>
                                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Tutti gli utenti" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tutti gli Utenti</SelectItem>
                                            {[...users].filter(u => u.role !== 'Cliente').sort((a, b) => a.name.localeCompare(b.name, 'it')).map(user => (
                                                <SelectItem key={user.id} value={user.id}>
                                                    {user.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </CollapsibleContent>
                </Card>
            </Collapsible>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Ore Totali</p>
                                <p className="text-2xl font-bold">{formatHours(totals.hours)}</p>
                            </div>
                            <Clock className="h-10 w-10 text-blue-500 opacity-50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Costo Totale</p>
                                <p className="text-2xl font-bold">{formatCurrency(totals.cost)}</p>
                            </div>
                            <Euro className="h-10 w-10 text-green-500 opacity-50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Registrazioni</p>
                                <p className="text-2xl font-bold">{totals.entries}</p>
                            </div>
                            <Calendar className="h-10 w-10 text-purple-500 opacity-50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Tariffa Media</p>
                                <p className="text-2xl font-bold">
                                    {totals.hours > 0 ? formatCurrency(totals.cost / totals.hours) : '€0'}/h
                                </p>
                            </div>
                            <TrendingUp className="h-10 w-10 text-yellow-500 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs with different views */}
            <Tabs defaultValue="client" className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <TabsList>
                        <TabsTrigger value="client">Per Cliente</TabsTrigger>
                        <TabsTrigger value="timesheet">Timesheet</TabsTrigger>
                        <TabsTrigger value="detailed">Dettagliato</TabsTrigger>
                        <TabsTrigger value="analytics" className="gap-2">
                            <BarChart2 className="h-4 w-4" />
                            Analytics
                        </TabsTrigger>
                    </TabsList>

                    {/* Export Buttons */}
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => exportToExcel('client')}>
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportToPDF('client')}>
                            <FileText className="h-4 w-4 mr-2" />
                            PDF
                        </Button>
                    </div>
                </div>

                {/* Client Report Tab */}
                <TabsContent value="client">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                Report per Cliente
                            </CardTitle>
                            <CardDescription>
                                Ore e costi raggruppati per cliente
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {clientReports.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">
                                    Nessun dato disponibile per il periodo selezionato
                                </p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead className="text-right">Ore</TableHead>
                                            <TableHead className="text-right">Costo</TableHead>
                                            <TableHead className="text-right">% del Totale</TableHead>
                                            <TableHead>Attività</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {clientReports.map(report => (
                                            <TableRow key={report.clientId}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarFallback style={{ backgroundColor: report.clientColor }}>
                                                                {getInitials(report.clientName)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="font-medium">{report.clientName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {formatHours(report.totalHours)}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-medium">
                                                    {formatCurrency(report.totalCost)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Progress
                                                            value={totals.cost > 0 ? (report.totalCost / totals.cost) * 100 : 0}
                                                            className="w-16 h-2"
                                                        />
                                                        <span className="text-sm text-muted-foreground w-12">
                                                            {totals.cost > 0 ? ((report.totalCost / totals.cost) * 100).toFixed(1) : 0}%
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {report.activities.slice(0, 3).map((a, i) => (
                                                            <Badge key={i} variant="secondary" className="text-xs">
                                                                {a.name}: {a.hours.toFixed(1)}h
                                                            </Badge>
                                                        ))}
                                                        {report.activities.length > 3 && (
                                                            <Badge variant="outline" className="text-xs">
                                                                +{report.activities.length - 3}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Timesheet Tab */}
                <TabsContent value="timesheet">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="h-5 w-5" />
                                    Timesheet per Utente
                                </CardTitle>
                                <CardDescription>
                                    Ore giornaliere per ogni membro del team
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => exportToExcel('timesheet')}>
                                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                                    Excel
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => exportToPDF('timesheet')}>
                                    <FileText className="h-4 w-4 mr-2" />
                                    PDF
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            {userTimesheets.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">
                                    Nessun dato disponibile per il periodo selezionato
                                </p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="sticky left-0 bg-background">Utente</TableHead>
                                            {weekDates.slice(0, 14).map(date => (
                                                <TableHead key={date.toISOString()} className="text-center min-w-[60px]">
                                                    <div className="text-xs">{format(date, 'EEE', { locale: it })}</div>
                                                    <div className="font-bold">{format(date, 'dd')}</div>
                                                </TableHead>
                                            ))}
                                            <TableHead className="text-right">Totale</TableHead>
                                            <TableHead className="text-right">Costo</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {userTimesheets.map(ts => (
                                            <TableRow key={ts.userId}>
                                                <TableCell className="sticky left-0 bg-background">
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-6 w-6">
                                                            <AvatarFallback style={{ backgroundColor: ts.userColor }} className="text-xs">
                                                                {getInitials(ts.userName)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-sm">{ts.userName}</span>
                                                    </div>
                                                </TableCell>
                                                {weekDates.slice(0, 14).map(date => {
                                                    const dateKey = format(date, 'yyyy-MM-dd');
                                                    const hours = ts.entries[dateKey] || 0;
                                                    return (
                                                        <TableCell
                                                            key={dateKey}
                                                            className={cn(
                                                                "text-center font-mono text-sm",
                                                                hours > 0 && "bg-primary/10",
                                                                hours >= 8 && "bg-green-500/20 text-green-700 dark:text-green-400"
                                                            )}
                                                        >
                                                            {hours > 0 ? hours.toFixed(1) : '-'}
                                                        </TableCell>
                                                    );
                                                })}
                                                <TableCell className="text-right font-mono font-bold">
                                                    {formatHours(ts.totalHours)}
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {formatCurrency(ts.totalCost)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Detailed Tab */}
                <TabsContent value="detailed">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5" />
                                    Registrazioni Dettagliate
                                </CardTitle>
                                <CardDescription>
                                    Tutte le registrazioni di tempo nel periodo
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => exportToExcel('detailed')}>
                                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                                    Excel
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => exportToPDF('detailed')}>
                                    <FileText className="h-4 w-4 mr-2" />
                                    PDF
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {timeEntries.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">
                                    Nessun dato disponibile per il periodo selezionato
                                </p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Data</TableHead>
                                            <TableHead>Utente</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Attività</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead className="text-right">Ore</TableHead>
                                            <TableHead className="text-right">Costo</TableHead>
                                            <TableHead>Fonte</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {timeEntries.slice(0, 50).map((entry, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="font-mono text-sm">
                                                    {format(parseISO(entry.date), 'dd/MM/yy')}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-6 w-6">
                                                            <AvatarFallback className="text-xs">
                                                                {getInitials(entry.userName)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-sm">{entry.userName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm">{entry.clientName}</TableCell>
                                                <TableCell className="max-w-[200px] truncate text-sm" title={entry.taskTitle}>
                                                    {entry.taskTitle}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-xs">
                                                        {entry.activityType}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {entry.hours.toFixed(2)}h
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {formatCurrency(entry.cost)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={entry.source === 'task' ? 'default' : 'secondary'} className="text-xs">
                                                        {entry.source === 'task' ? 'Task' : 'Calendar'}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                            {timeEntries.length > 50 && (
                                <p className="text-center text-muted-foreground text-sm mt-4">
                                    Mostrando 50 di {timeEntries.length} registrazioni. Esporta in Excel per vedere tutto.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Analytics Tab */}
                <TabsContent value="analytics">
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <VelocityChart weeks={8} className="animate-fade-in" />
                            <Card className="animate-fade-in">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <BarChart2 className="h-5 w-5 text-primary" />
                                        Progetti Attivi
                                    </CardTitle>
                                    <CardDescription>
                                        Seleziona un progetto per vedere il burndown chart
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Select value={selectedProject} onValueChange={setSelectedProject}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleziona progetto" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {allProjects
                                                .filter(p => p.status === 'In Corso')
                                                .map(project => (
                                                    <SelectItem key={project.id} value={project.id}>
                                                        {project.name}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </CardContent>
                            </Card>
                        </div>

                        {selectedProject && (
                            <BurndownChart
                                projectId={selectedProject}
                                className="animate-fade-in"
                            />
                        )}

                        {!selectedProject && (
                            <BurndownChart
                                title="Burndown Globale"
                                description="Andamento di tutti i task attivi"
                                className="animate-fade-in"
                            />
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
