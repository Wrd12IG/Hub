'use client';

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Users,
    Clock,
    CheckCircle,
    TrendingUp,
    TrendingDown,
    Filter,
    Target,
    BarChart as BarChartIcon,
    PieChart as PieChartIcon,
    Briefcase,
    UserX,
    ClipboardList,
    AlertCircle,
    CalendarClock,
    AlertTriangle,
    FilePieChart,
    DollarSign,
    Hourglass,
    GanttChart,
    Eraser,
    Activity,
    LineChart as LineChartIcon,
    Euro,
    Building2,
    ChevronDown,
    ChevronUp,
    Download,
    RefreshCw,
    Bell,
} from 'lucide-react';
import type {
    Task,
    Project,
    Client,
    User,
    ActivityType,
    Absence,
    CalendarActivity,
    CalendarActivityPreset,
    CompanyCosts
} from '@/lib/data';
import { allTaskStatuses } from '@/lib/data';
import { getCompanyCosts } from '@/lib/actions';
import { useEffect, useState, useMemo, useCallback } from 'react';
import {
    differenceInDays,
    parseISO,
    endOfWeek,
    startOfWeek,
    subWeeks,
    format,
    startOfMonth,
    endOfMonth,
    startOfQuarter,
    endOfQuarter,
    startOfYear,
    endOfYear,
    subMonths,
    isToday,
    isWithinInterval,
    addDays,
    startOfToday,
    isBefore,
    isAfter,
    differenceInSeconds,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie, Sector, LabelList, LineChart, Line, Area, ReferenceLine, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, getInitials } from '@/lib/utils';
import DatePickerDialog from '@/components/ui/date-picker-dialog';
import type { TooltipProps } from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { useLayoutData } from '@/app/(app)/layout-context';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Settings2, Trophy, Flame } from 'lucide-react';
import { Leaderboard, LevelBadge, StreakDisplay } from '@/components/gamification';
import { getLevelFromXp } from '@/lib/gamification';
import { DeadlineCountdownWidget } from '@/components/dashboard/deadline-countdown';
import { WeatherWidget } from '@/components/dashboard/weather-widget';
import { UpcomingBirthdaysWidget } from '@/components/birthday-celebration';

const ADMIN_WIDGETS = [
    { id: 'kpi_global', label: 'KPI Globali' },
    { id: 'alerts_smart', label: 'Avvisi Intelligenti (Smart Alerts)' },
    { id: 'chart_workload', label: 'Carico di Lavoro Team' },
    { id: 'chart_performance', label: 'Performance Individuali' },
    { id: 'table_future_workload', label: 'Carico Futuro (7 Giorni)' },
    { id: 'chart_status_distribution', label: 'Distribuzione Stati Task' },
    { id: 'chart_priority_distribution', label: 'Distribuzione Priorità' },
    { id: 'list_overdue_tasks', label: 'Task Scaduti' },
    { id: 'chart_activity_costs', label: 'Analisi Costi per Attività' },
    { id: 'chart_client_costs', label: 'Analisi Costi per Cliente' },
    { id: 'chart_monthly_costs', label: 'Andamento Costi Mensili' },
    { id: 'chart_calendar_user', label: 'Attività Calendario per Utente' },
    { id: 'chart_calendar_client', label: 'Attività Calendario per Cliente' },
    { id: 'table_absences', label: 'Assenze di Oggi' },
    { id: 'chart_client_profitability', label: '💰 Redditività Clienti' },
    { id: 'chart_predictive_delivery', label: '🔮 Previsioni Consegne' },
    { id: 'chart_efficiency_trends', label: '📈 Trend Efficienza' },
    { id: 'gamification_leaderboard', label: '🏆 Classifica Team' },
];


const TASK_STATUS_COLORS: { [key: string]: string } = {
    'Da Fare': '#9CA3AF',
    'In Lavorazione': '#3B82F6',
    'In Approvazione': '#F97316',
    'In Approvazione Cliente': '#A855F7',
    'Approvato': '#10B981',
    'Annullato': '#6B7280',
};

const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const DynamicBarChart = dynamic(() => Promise.resolve(BarChart), {
    ssr: false,
    loading: () => <Skeleton className="h-[300px] w-full" />,
});

const DynamicPieChart = dynamic(() => Promise.resolve(PieChart), {
    ssr: false,
    loading: () => <Skeleton className="h-[300px] w-full" />,
});

const DynamicLineChart = dynamic(() => Promise.resolve(LineChart), {
    ssr: false,
    loading: () => <Skeleton className="h-[300px] w-full" />,
});


const ActiveShape = (props: any) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    const mx = cx + (outerRadius + 30) * cos;
    const my = cy + (outerRadius + 30) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

    return (
        <g>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
            />
            <Sector
                cx={cx}
                cy={cy}
                startAngle={startAngle}
                endAngle={endAngle}
                innerRadius={outerRadius + 6}
                outerRadius={outerRadius + 10}
                fill={fill}
            />
            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
            <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="hsl(var(--foreground))" className="text-sm font-bold">
                {payload.name}
            </text>
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="hsl(var(--muted-foreground))">
                {`€${value.toLocaleString('it-IT')} (${(percent * 100).toFixed(2)}%)`}
            </text>
        </g>
    );
};

interface CustomTooltipPayload {
    ore?: number;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload as any;

        return (
            <div className="bg-background border border-border p-2 rounded-md shadow-lg">
                <p className="font-bold">{`${label}`}</p>
                <p className="text-sm" style={{ color: payload[0].color }}>
                    Costo: €{Number(payload[0].value).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {data.ore && (
                    <p className="text-sm text-muted-foreground">
                        Ore registrate: {data.ore.toFixed(1)}h
                    </p>
                )}
            </div>
        );
    }
    return null;
};


// Function to interpolate between two colors.
const interpolateColor = (color1: [number, number, number], color2: [number, number, number], factor: number) => {
    const result = color1.slice() as [number, number, number];
    for (let i = 0; i < 3; i++) {
        result[i] = Math.round(result[i] + factor * (color2[i] - result[i]));
    }
    return `rgb(${result.join(',')})`;
};

const hexToRgb = (hex: string): [number, number, number] | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : null;
};

// Formattazione numeri in formato italiano (punto per migliaia, virgola per decimali)
// Implementazione manuale per garantire il formato corretto
const formatNumber = (value: number, decimals: number = 1): string => {
    const fixed = value.toFixed(decimals);
    const [intPart, decPart] = fixed.split('.');
    // Aggiungi il punto come separatore delle migliaia
    const intWithThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    // Restituisci con virgola come separatore decimale
    return decPart ? `${intWithThousands},${decPart}` : intWithThousands;
};

const formatCurrency = (value: number, decimals: number = 2): string => {
    return '€' + formatNumber(value, decimals);
};



export default function Dashboard() {
    const { users, usersById, clients, clientsById, allTasks, allProjects, activityTypes, absences, calendarActivities, calendarActivityPresets, isLoadingLayout, currentUser } = useLayoutData();

    // Protezione accesso: solo Amministratore può vedere la dashboard
    if (!isLoadingLayout && currentUser && currentUser.role !== 'Amministratore') {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-destructive">Accesso Negato</CardTitle>
                        <CardDescription>
                            Non hai i permessi per accedere a questa pagina.
                            Solo gli Amministratori possono visualizzare la dashboard.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    const [filters, setFilters] = useState({
        startDate: null as Date | null,
        endDate: null as Date | null,
        clientId: 'all',
        userId: 'all'
    });

    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isKpisOpen, setIsKpisOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    const [visibleWidgets, setVisibleWidgets] = useState<string[]>(ADMIN_WIDGETS.map(w => w.id));
    const [isLoaded, setIsLoaded] = useState(false);

    // Company costs for overhead calculation
    const [companyCosts, setCompanyCosts] = useState<CompanyCosts | null>(null);
    const [hourlyOverhead, setHourlyOverhead] = useState<number>(0);

    // Load visibility settings from local storage
    useEffect(() => {
        const saved = localStorage.getItem('admin_dashboard_widgets');
        if (saved) {
            try {
                const savedWidgets = JSON.parse(saved) as string[];
                // Add any new widgets that aren't in the saved list
                const allWidgetIds = ADMIN_WIDGETS.map(w => w.id);
                const newWidgets = allWidgetIds.filter(id => !savedWidgets.includes(id));
                if (newWidgets.length > 0) {
                    // Include new widgets by default
                    setVisibleWidgets([...savedWidgets, ...newWidgets]);
                } else {
                    setVisibleWidgets(savedWidgets);
                }
            } catch (e) {
                console.error("Failed to parse admin dashboard settings", e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Load company costs for overhead calculation
    useEffect(() => {
        const loadCompanyCosts = async () => {
            try {
                const costs = await getCompanyCosts();
                setCompanyCosts(costs);

                // Calculate hourly overhead based on active Collaboratori and PM
                if (costs && users.length > 0) {
                    const billableEmployees = users.filter(u =>
                        (u.role === 'Collaboratore' || u.role === 'Project Manager') &&
                        u.status !== 'Inattivo'
                    );
                    const totalMonthlyCost = (costs.dirigenza || 0) + (costs.struttura || 0) + (costs.varie || 0);
                    const monthlyHours = 160; // Standard work hours per month
                    if (billableEmployees.length > 0 && totalMonthlyCost > 0) {
                        const costPerEmployee = totalMonthlyCost / billableEmployees.length;
                        setHourlyOverhead(costPerEmployee / monthlyHours);
                    }
                }
            } catch (error) {
                console.error('Error loading company costs:', error);
            }
        };
        if (!isLoadingLayout && users.length > 0) {
            loadCompanyCosts();
        }
    }, [isLoadingLayout, users]);

    const toggleWidget = (widgetId: string) => {
        setVisibleWidgets(prev => {
            const newWidgets = prev.includes(widgetId)
                ? prev.filter(id => id !== widgetId)
                : [...prev, widgetId];
            localStorage.setItem('admin_dashboard_widgets', JSON.stringify(newWidgets));
            return newWidgets;
        });
    };

    const isWidgetVisible = (id: string) => visibleWidgets.includes(id);

    const onPieEnter = useCallback(
        (_: any, index: number) => {
            setActiveIndex(index);
        },
        [setActiveIndex]
    );

    const filteredData = useMemo(() => {
        let tasks = [...allTasks];
        let projects = [...allProjects];
        let activities = [...(calendarActivities || [])];

        if (filters.clientId !== 'all') {
            tasks = tasks.filter(t => t.clientId === filters.clientId);
            projects = projects.filter(p => p.clientId === filters.clientId);
            activities = activities.filter(a => a.clientIds?.includes(filters.clientId));
        }

        if (filters.userId !== 'all') {
            tasks = tasks.filter(t => t.assignedUserId === filters.userId);
            projects = projects.filter(p => p.teamLeaderId === filters.userId);
            activities = activities.filter(a => a.userId === filters.userId);
        }

        if (filters.startDate && filters.endDate) {
            const { startDate, endDate } = filters;

            // Funzione helper per ottenere la data di riferimento del task
            // Priorità: data approvazione > data annullamento > updatedAt
            const getTaskReferenceDate = (t: Task): Date | null => {
                // Per task Approvati: usa la data dell'ultima approvazione
                if (t.status === 'Approvato' && t.approvals && t.approvals.length > 0) {
                    // Prendi la data dell'ultima approvazione
                    const lastApproval = t.approvals[t.approvals.length - 1];
                    if (lastApproval.timestamp) {
                        return parseISO(lastApproval.timestamp);
                    }
                }

                // Per task Annullati: usa cancelledAt o fallback su updatedAt
                if (t.status === 'Annullato') {
                    if (t.cancelledAt) {
                        return parseISO(t.cancelledAt);
                    }
                    // Fallback su updatedAt per task annullati senza cancelledAt
                    if (t.updatedAt) {
                        return parseISO(t.updatedAt);
                    }
                }

                // Per altri stati: nessuna data di riferimento (esclusi dal filtro date)
                return null;
            };

            tasks = tasks.filter(t => {
                const taskDate = getTaskReferenceDate(t);
                // Se il task non ha una data di riferimento (non approvato/annullato), escludilo dal filtro date
                if (!taskDate) return false;
                return taskDate >= startDate && taskDate <= endDate;
            });

            projects = projects.filter(p => {
                if (!p.startDate || !p.endDate) return false;
                const projectStartDate = parseISO(p.startDate);
                const projectEndDate = parseISO(p.endDate);
                return (projectStartDate <= endDate && projectEndDate >= startDate);
            });
            activities = activities.filter(a => {
                if (!a.startTime) return false;
                const activityDate = parseISO(a.startTime);
                return activityDate >= startDate && activityDate <= endDate;
            });
        }

        return { tasks, projects, activities };

    }, [filters, allTasks, allProjects, calendarActivities]);

    const absencesTodayData = useMemo(() => {
        const today = new Date();
        return absences
            .filter((a: any) =>
                isWithinInterval(today, {
                    start: parseISO(a.startDate),
                    end: parseISO(a.endDate),
                }) && a.status === 'Approvata'
            )
            .map((a: any) => ({
                user: users.find((u: any) => u.id === a.userId),
                absence: a
            }))
            .filter((item: any) => item.user);
    }, [absences, users]);


    const handleFilterChange = (filterName: keyof typeof filters, value: any) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const setDateShortcut = (type: 'week' | 'month' | 'quarter' | 'year' | 'last3months') => {
        const now = new Date();
        let start: Date;
        let end: Date;
        if (type === 'week') {
            start = startOfWeek(now, { weekStartsOn: 1 });
            end = endOfWeek(now, { weekStartsOn: 1 });
        } else if (type === 'month') {
            start = startOfMonth(now);
            end = endOfMonth(now);
        } else if (type === 'quarter') {
            start = startOfQuarter(now);
            end = endOfQuarter(now);
        } else if (type === 'year') {
            start = startOfYear(now);
            end = endOfYear(now);
        } else if (type === 'last3months') {
            start = subMonths(startOfMonth(now), 2);
            end = endOfMonth(now);
        }
        setFilters(prev => ({ ...prev, startDate: start, endDate: end }));
    }

    const resetFilters = () => {
        setFilters({
            startDate: null,
            endDate: null,
            clientId: 'all',
            userId: 'all'
        });
    }

    // --- KPI Calculations with Trend ---
    const globalKpis = useMemo(() => {
        const { projects: relevantProjects, tasks: relevantTasks } = filteredData;

        // Current period values
        const current = {
            activeProjects: relevantProjects.filter(p => p.status === 'In Corso').length,
            atRiskProjects: relevantProjects.filter(p => p.endDate && isBefore(parseISO(p.endDate), startOfToday()) && p.status !== 'Completato' && p.status !== 'Annullato').length,
            inProgressTasks: relevantTasks.filter((t) => t.status === 'In Lavorazione').length,
            upcomingDeadlines: relevantTasks.filter(
                (t) =>
                    t.dueDate &&
                    differenceInDays(parseISO(t.dueDate), new Date()) >= 0 &&
                    differenceInDays(parseISO(t.dueDate), new Date()) <= 7 &&
                    t.status !== 'Approvato' &&
                    t.status !== 'Annullato'
            ).length,
            completedTasks: relevantTasks.filter(t => t.status === 'Approvato').length,
            totalHours: relevantTasks.reduce((sum, t) => sum + (t.timeSpent || 0), 0) / 3600,
        };

        // Previous period (last 30 days for comparison)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const previousTasks = allTasks.filter(t => {
            if (!t.dueDate) return false;
            const taskDate = parseISO(t.dueDate);
            return taskDate >= sixtyDaysAgo && taskDate < thirtyDaysAgo;
        });

        const previous = {
            completedTasks: previousTasks.filter(t => t.status === 'Approvato').length,
            totalHours: previousTasks.reduce((sum, t) => sum + (t.timeSpent || 0), 0) / 3600,
        };

        // Calculate trends (positive = improvement)
        const completedTrend = previous.completedTasks > 0
            ? ((current.completedTasks - previous.completedTasks) / previous.completedTasks) * 100
            : current.completedTasks > 0 ? 100 : 0;
        const hoursTrend = previous.totalHours > 0
            ? ((current.totalHours - previous.totalHours) / previous.totalHours) * 100
            : current.totalHours > 0 ? 100 : 0;

        return {
            ...current,
            trends: {
                completedTasks: completedTrend,
                totalHours: hoursTrend,
            }
        };
    }, [filteredData, allTasks]);

    // --- Smart Alerts ---
    const smartAlerts = useMemo(() => {
        const alerts: Array<{ type: 'critical' | 'warning' | 'info', message: string, count: number }> = [];
        const { projects, tasks } = filteredData;

        // Critical: Overdue projects
        const overdueProjects = projects.filter(p =>
            p.endDate && isBefore(parseISO(p.endDate), new Date()) &&
            p.status !== 'Completato' && p.status !== 'Annullato'
        );
        if (overdueProjects.length > 0) {
            alerts.push({
                type: 'critical',
                message: `${overdueProjects.length} progett${overdueProjects.length === 1 ? 'o' : 'i'} scadut${overdueProjects.length === 1 ? 'o' : 'i'}`,
                count: overdueProjects.length
            });
        }

        // Warning: Tasks stuck for > 7 days
        const stuckTasks = tasks.filter(t => {
            if (t.status !== 'In Lavorazione' || !t.updatedAt) return false;
            const lastUpdate = typeof t.updatedAt === 'string' ? parseISO(t.updatedAt) : t.updatedAt;
            return differenceInDays(new Date(), lastUpdate) > 7;
        });
        if (stuckTasks.length > 0) {
            alerts.push({
                type: 'warning',
                message: `${stuckTasks.length} task blocc${stuckTasks.length === 1 ? 'o' : 'hi'} da più di 7 giorni`,
                count: stuckTasks.length
            });
        }

        // Warning: Tasks due in 48h
        const urgentTasks = tasks.filter(t => {
            if (!t.dueDate || t.status === 'Approvato' || t.status === 'Annullato') return false;
            const daysLeft = differenceInDays(parseISO(t.dueDate), new Date());
            return daysLeft >= 0 && daysLeft <= 2;
        });
        if (urgentTasks.length > 0) {
            alerts.push({
                type: 'warning',
                message: `${urgentTasks.length} task in scadenza entro 48h`,
                count: urgentTasks.length
            });
        }

        // Info: Unassigned tasks
        const unassignedTasks = tasks.filter(t => !t.assignedUserId && t.status !== 'Approvato' && t.status !== 'Annullato');
        if (unassignedTasks.length > 0) {
            alerts.push({
                type: 'info',
                message: `${unassignedTasks.length} task non assegnat${unassignedTasks.length === 1 ? 'o' : 'i'}`,
                count: unassignedTasks.length
            });
        }

        return alerts;
    }, [filteredData]);


    // --- Chart Data Calculations ---
    const userWorkload = useMemo(() => {
        const { tasks: relevantTasks } = filteredData;

        let tasksForWorkload = relevantTasks;
        if (filters.userId !== 'all') {
            tasksForWorkload = tasksForWorkload.filter(t => t.assignedUserId === filters.userId);
        }
        tasksForWorkload = tasksForWorkload.filter(t => t.status !== 'Approvato' && t.status !== 'Annullato');

        const workload = users
            .filter(user => user.role !== 'Amministratore')
            .map(user => {
                const taskCount = tasksForWorkload.filter(t => t.assignedUserId === user.id).length;
                return { name: user.name, tasks: taskCount };
            });
        return workload.filter(u => u.tasks > 0).sort((a, b) => b.tasks - a.tasks);
    }, [users, filteredData, filters.userId]);


    const userPerformanceData = useMemo(() => {
        const { tasks: relevantTasks, activities: relevantActivities } = filteredData;

        return [...users]
            .sort((a, b) => a.name.localeCompare(b.name))
            .filter(user => user.role !== 'Amministratore')
            .map(user => {
                const assignedTasks = relevantTasks.filter(t => t.assignedUserId === user.id);
                const assignedActivities = relevantActivities.filter(a => a.userId === user.id);

                const completedTasks = assignedTasks.filter(t => t.status === 'Approvato');

                const taskHours = assignedTasks.reduce((sum, t) => sum + (t.timeSpent || 0), 0) / 3600;
                const activityHours = assignedActivities.reduce((sum, a) => {
                    if (!a.startTime || !a.endTime) return sum;
                    const duration = differenceInSeconds(parseISO(a.endTime), parseISO(a.startTime));
                    return sum + duration;
                }, 0) / 3600;

                const totalHours = taskHours + activityHours;
                const estimatedHours = assignedTasks.reduce((sum, t) => sum + (t.estimatedDuration || 0), 0) / 60;
                const completionRate = assignedTasks.length > 0 ? (completedTasks.length / assignedTasks.length) * 100 : 0;

                return {
                    id: user.id,
                    name: user.name,
                    color: user.color,
                    assignedCount: assignedTasks.length,
                    completedCount: completedTasks.length,
                    hours: parseFloat(totalHours.toFixed(1)),
                    estimatedHours: parseFloat(estimatedHours.toFixed(1)),
                    rate: parseFloat(completionRate.toFixed(1)),
                };
            })
            .filter(u => u.assignedCount > 0 || u.hours > 0)
            .sort((a, b) => b.completedCount - a.completedCount);
    }, [users, filteredData]);

    const { futureWorkloadData, sevenDayHeaders } = useMemo(() => {
        const { tasks: activeTasks } = filteredData;
        const relevantTasks = activeTasks.filter(t => t.status !== 'Approvato' && t.status !== 'Annullato' && t.assignedUserId);

        const workload: { [userId: string]: { [date: string]: number } } = {};

        relevantTasks.forEach(task => {
            if (task.assignedUserId && task.dueDate) {
                const dateKey = format(parseISO(task.dueDate), 'yyyy-MM-dd');
                if (!workload[task.assignedUserId]) {
                    workload[task.assignedUserId] = {};
                }
                if (!workload[task.assignedUserId][dateKey]) {
                    workload[task.assignedUserId][dateKey] = 0;
                }
                workload[task.assignedUserId][dateKey] += (task.estimatedDuration || 0) / 60; // convert to hours
            }
        });

        const today = startOfToday();
        const sevenDays = Array.from({ length: 7 }, (_, i) => addDays(today, i));
        const sevenDayKeys = sevenDays.map(d => format(d, 'yyyy-MM-dd'));
        const sevenDayHeaders = sevenDays.map(d => format(d, 'EEE d', { locale: it }));

        const tableData = [...users]
            .sort((a, b) => a.name.localeCompare(b.name))
            .filter(u => u.role !== 'Amministratore' && workload[u.id])
            .map(user => {
                const userWorkload = sevenDayKeys.map(dateKey => workload[user.id]?.[dateKey] || 0);
                return {
                    user,
                    workload: userWorkload
                };
            });

        return { futureWorkloadData: tableData, sevenDayHeaders };
    }, [filteredData, users]);

    const taskStatusDistribution = useMemo(() => {
        const { tasks } = filteredData;
        const statusCounts = tasks.reduce((acc, task) => {
            acc[task.status] = (acc[task.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return allTaskStatuses.map(status => ({
            name: status,
            'Task': statusCounts[status] || 0,
        }));
    }, [filteredData]);

    const tasksByPriority = useMemo(() => {
        const { tasks } = filteredData;
        const priorityOrder: Task['priority'][] = ['Critica', 'Alta', 'Media', 'Bassa'];
        const priorityCounts = tasks.reduce((acc, task) => {
            if (task.status !== 'Approvato' && task.status !== 'Annullato') {
                acc[task.priority] = (acc[task.priority] || 0) + 1;
            }
            return acc;
        }, {} as Record<Task['priority'], number>);

        return priorityOrder.map(priority => ({
            name: priority,
            'Task Attivi': priorityCounts[priority] || 0,
        }));
    }, [filteredData]);

    const overdueTasks = useMemo(() => {
        const { tasks } = filteredData;
        return tasks.filter(task => task.dueDate && isBefore(parseISO(task.dueDate), startOfToday()) && task.status !== 'Approvato' && task.status !== 'Annullato')
            .sort((a, b) => {
                if (!a.dueDate || !b.dueDate) return 0;
                return differenceInDays(new Date(), parseISO(b.dueDate)) - differenceInDays(new Date(), parseISO(a.dueDate))
            });
    }, [filteredData]);

    // Gamification leaderboard data
    const gamificationLeaderboard = useMemo(() => {
        const { tasks } = filteredData;

        return users
            .filter(u => u.role !== 'Amministratore' && u.status !== 'Inattivo')
            .map(user => {
                const userTasks = tasks.filter(t => t.assignedUserId === user.id);
                const completedTasks = userTasks.filter(t => t.status === 'Approvato');
                const totalHours = userTasks.reduce((sum, t) => sum + (t.timeSpent || 0), 0) / 3600;

                // Calculate XP based on completed tasks and performance
                const baseXp = completedTasks.length * 25; // 25 XP per task
                const hoursBonus = Math.floor(totalHours / 10) * 10; // 10 XP per 10 hours
                const onTimeBonus = completedTasks.filter(t => {
                    if (!t.dueDate || !t.updatedAt) return false;
                    return new Date(t.updatedAt) <= new Date(t.dueDate);
                }).length * 15; // 15 XP bonus per on-time completion

                const totalXp = baseXp + hoursBonus + onTimeBonus;

                // Calculate streak (simplified - consecutive days with task completion)
                const streak = Math.floor(completedTasks.length / 5); // Simplified streak

                return {
                    id: user.id,
                    name: user.name,
                    xp: totalXp,
                    level: getLevelFromXp(totalXp).level,
                    streak: Math.min(streak, 30), // Cap at 30
                };
            })
            .sort((a, b) => b.xp - a.xp)
            .slice(0, 10);
    }, [users, filteredData]);

    const activityData = useMemo(() => {
        const { tasks, activities } = filteredData;
        const presetsById = calendarActivityPresets.reduce((acc, preset) => ({ ...acc, [preset.id]: preset }), {} as Record<string, CalendarActivityPreset>);

        const timeByActivity: Record<string, number> = {};
        const costByActivity: Record<string, number> = {};
        const rateByActivity: Record<string, number> = {};
        const rateCountByActivity: Record<string, number> = {};

        // Per i TASK: usa hourlyRate dell'utente assegnato + overhead costi aziendali
        tasks.forEach(task => {
            if (task.activityType && task.timeSpent > 0) {
                const hours = task.timeSpent / 3600;
                timeByActivity[task.activityType] = (timeByActivity[task.activityType] || 0) + hours;

                // Usa il costo orario dell'utente assegnato al task + overhead
                if (task.assignedUserId) {
                    const assignedUser = usersById[task.assignedUserId];
                    const rawRate = assignedUser?.hourlyRate as number | string | undefined;
                    const userHourlyRate = typeof rawRate === 'string'
                        ? parseFloat(rawRate.replace(',', '.')) || 0
                        : (Number(rawRate) || 0);
                    // Aggiungi overhead costi aziendali solo per Collaboratori e PM
                    const shouldApplyOverhead = assignedUser?.role === 'Collaboratore' || assignedUser?.role === 'Project Manager';
                    const effectiveRate = userHourlyRate + (shouldApplyOverhead ? hourlyOverhead : 0);
                    const cost = hours * effectiveRate;
                    costByActivity[task.activityType] = (costByActivity[task.activityType] || 0) + cost;
                    rateByActivity[task.activityType] = (rateByActivity[task.activityType] || 0) + effectiveRate;
                    rateCountByActivity[task.activityType] = (rateCountByActivity[task.activityType] || 0) + 1;
                }
            }
        });

        // Per le ATTIVITÀ CALENDARIO: usa hourlyRate dell'utente che ha creato l'attività + overhead
        activities.forEach(activity => {
            const preset = activity.presetId ? presetsById[activity.presetId] : null;
            const activityTypeName = preset ? preset.name : "Attività Manuale";

            if (!activity.startTime || !activity.endTime) return;
            const durationHours = differenceInSeconds(parseISO(activity.endTime), parseISO(activity.startTime)) / 3600;
            if (durationHours > 0) {
                timeByActivity[activityTypeName] = (timeByActivity[activityTypeName] || 0) + durationHours;

                // Usa il costo orario dell'utente che ha registrato l'attività + overhead
                const activityUser = activity.userId ? usersById[activity.userId] : null;
                const rawRate = activityUser?.hourlyRate as number | string | undefined;
                const userHourlyRate = typeof rawRate === 'string'
                    ? parseFloat(rawRate.replace(',', '.')) || 0
                    : (Number(rawRate) || 0);
                // Aggiungi overhead costi aziendali solo per Collaboratori e PM
                const shouldApplyOverhead = activityUser?.role === 'Collaboratore' || activityUser?.role === 'Project Manager';
                const effectiveRate = userHourlyRate + (shouldApplyOverhead ? hourlyOverhead : 0);
                const cost = durationHours * effectiveRate;
                costByActivity[activityTypeName] = (costByActivity[activityTypeName] || 0) + cost;
                rateByActivity[activityTypeName] = (rateByActivity[activityTypeName] || 0) + effectiveRate;
                rateCountByActivity[activityTypeName] = (rateCountByActivity[activityTypeName] || 0) + 1;
            }
        });

        return Object.entries(costByActivity).map(([name, cost]) => ({
            name,
            cost,
            hours: timeByActivity[name] || 0,
            // Calcola la media del rate effettivo
            rate: rateCountByActivity[name] > 0 ? rateByActivity[name] / rateCountByActivity[name] : 0,
        })).sort((a, b) => b.cost - a.cost);

    }, [filteredData, activityTypes, calendarActivityPresets, usersById, hourlyOverhead]);

    const clientData = useMemo(() => {
        const { tasks, activities } = filteredData;
        const timeByClient: Record<string, number> = {};
        const costByClient: Record<string, number> = {};

        // Per i TASK: usa hourlyRate dell'utente assegnato + overhead costi aziendali
        tasks.forEach(task => {
            if (task.clientId && task.timeSpent > 0) {
                const hours = task.timeSpent / 3600;
                timeByClient[task.clientId] = (timeByClient[task.clientId] || 0) + hours;

                // Usa il costo orario dell'utente assegnato al task + overhead
                if (task.assignedUserId) {
                    const assignedUser = usersById[task.assignedUserId];
                    // Gestisce sia numeri che stringhe con virgola (formato italiano)
                    const rawRate = assignedUser?.hourlyRate as number | string | undefined;
                    const userHourlyRate = typeof rawRate === 'string'
                        ? parseFloat(rawRate.replace(',', '.')) || 0
                        : (Number(rawRate) || 0);
                    // Aggiungi overhead costi aziendali solo per Collaboratori e PM
                    const shouldApplyOverhead = assignedUser?.role === 'Collaboratore' || assignedUser?.role === 'Project Manager';
                    const effectiveRate = userHourlyRate + (shouldApplyOverhead ? hourlyOverhead : 0);
                    const cost = hours * effectiveRate;
                    costByClient[task.clientId] = (costByClient[task.clientId] || 0) + cost;
                }
            }
        });

        // Per le ATTIVITÀ CALENDARIO: usa hourlyRate dell'utente che ha creato l'attività + overhead
        activities.forEach(activity => {
            // Supporta sia startTime/endTime che start/end (legacy)
            const activityStart = activity.startTime || activity.start;
            const activityEnd = activity.endTime || activity.end;
            if (!activityStart || !activityEnd) return;

            const durationHours = differenceInSeconds(parseISO(activityEnd), parseISO(activityStart)) / 3600;

            // Supporta sia clientIds (array) che clientId (singolo, legacy)
            let activityClientIds: string[] = [];
            if (activity.clientIds && activity.clientIds.length > 0) {
                activityClientIds = activity.clientIds;
            } else if (activity.clientId) {
                activityClientIds = [activity.clientId];
            }

            if (activityClientIds.length > 0 && durationHours > 0) {
                // Usa il costo orario dell'utente che ha registrato l'attività + overhead
                const activityUser = activity.userId ? usersById[activity.userId] : null;
                // Gestisce sia numeri che stringhe con virgola (formato italiano)
                const rawRate = activityUser?.hourlyRate as number | string | undefined;
                const userHourlyRate = typeof rawRate === 'string'
                    ? parseFloat(rawRate.replace(',', '.')) || 0
                    : (Number(rawRate) || 0);
                // Aggiungi overhead costi aziendali solo per Collaboratori e PM
                const shouldApplyOverhead = activityUser?.role === 'Collaboratore' || activityUser?.role === 'Project Manager';
                const effectiveRate = userHourlyRate + (shouldApplyOverhead ? hourlyOverhead : 0);
                const cost = durationHours * effectiveRate;

                const numClients = activityClientIds.length;
                const perClientHours = durationHours / numClients;
                const perClientCost = cost / numClients;

                activityClientIds.forEach(clientId => {
                    timeByClient[clientId] = (timeByClient[clientId] || 0) + perClientHours;
                    costByClient[clientId] = (costByClient[clientId] || 0) + perClientCost;
                });
            }
        });

        const clientCosts = Object.entries(costByClient).map(([clientId, cost]) => {
            const client = clientsById[clientId];
            const totalHours = timeByClient[clientId] || 0;
            const averageRate = totalHours > 0 ? cost / totalHours : 0;
            return {
                id: clientId,
                name: client?.name || 'N/D',
                cost,
                hours: totalHours,
                averageRate,
            };
        }).sort((a, b) => b.cost - a.cost);

        const totalCost = clientCosts.reduce((sum, client) => sum + client.cost, 0);
        const maxCost = Math.max(...clientCosts.map(c => c.cost), 0);

        return { clientCosts, totalCost, maxCost };

    }, [filteredData, usersById, clientsById, hourlyOverhead]);

    const monthlyCostTrend = useMemo(() => {
        const costsByMonth: { [month: string]: number } = {};
        const { tasks, activities } = filteredData;

        // Per i TASK: usa hourlyRate dell'utente assegnato + overhead costi aziendali
        tasks.forEach(task => {
            if (task.timeSpent > 0 && task.dueDate && task.assignedUserId) {
                const month = format(parseISO(task.dueDate), 'yyyy-MM');
                const hours = task.timeSpent / 3600;
                const assignedUser = usersById[task.assignedUserId];
                // Gestisce sia numeri che stringhe con virgola (formato italiano)
                const rawRate = assignedUser?.hourlyRate as number | string | undefined;
                const userHourlyRate = typeof rawRate === 'string'
                    ? parseFloat(rawRate.replace(',', '.')) || 0
                    : (Number(rawRate) || 0);
                // Aggiungi overhead costi aziendali solo per Collaboratori e PM
                const shouldApplyOverhead = assignedUser?.role === 'Collaboratore' || assignedUser?.role === 'Project Manager';
                const effectiveRate = userHourlyRate + (shouldApplyOverhead ? hourlyOverhead : 0);
                const cost = hours * effectiveRate;
                costsByMonth[month] = (costsByMonth[month] || 0) + cost;
            }
        });

        // Per le ATTIVITÀ CALENDARIO: usa hourlyRate dell'utente + overhead
        activities.forEach(activity => {
            // Supporta sia startTime/endTime che start/end (legacy)
            const activityStart = activity.startTime || activity.start;
            const activityEnd = activity.endTime || activity.end;
            if (!activityStart || !activityEnd || !activity.userId) return;
            const month = format(parseISO(activityStart), 'yyyy-MM');
            const hours = differenceInSeconds(parseISO(activityEnd), parseISO(activityStart)) / 3600;
            const activityUser = usersById[activity.userId];
            // Gestisce sia numeri che stringhe con virgola (formato italiano)
            const rawRate = activityUser?.hourlyRate as number | string | undefined;
            const userHourlyRate = typeof rawRate === 'string'
                ? parseFloat(rawRate.replace(',', '.')) || 0
                : (Number(rawRate) || 0);
            // Aggiungi overhead costi aziendali solo per Collaboratori e PM
            const shouldApplyOverhead = activityUser?.role === 'Collaboratore' || activityUser?.role === 'Project Manager';
            const effectiveRate = userHourlyRate + (shouldApplyOverhead ? hourlyOverhead : 0);
            const cost = hours * effectiveRate;
            costsByMonth[month] = (costsByMonth[month] || 0) + cost;
        });

        return Object.entries(costsByMonth)
            .map(([month, cost]) => ({
                name: format(parseISO(month), 'MMM yy', { locale: it }),
                'Costo Totale': parseFloat(cost.toFixed(2))
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'it'));

    }, [filteredData, usersById, hourlyOverhead]);

    const avgMonthlyCost = useMemo(() => {
        if (!monthlyCostTrend || monthlyCostTrend.length === 0) return 0;
        const sum = monthlyCostTrend.reduce((acc: number, curr: any) => acc + (curr['Costo Totale'] || 0), 0);
        return sum / monthlyCostTrend.length;
    }, [monthlyCostTrend]);

    const calendarActivityByUser = useMemo(() => {
        const { activities } = filteredData;
        const activityByUser: Record<string, { hours: number, count: number }> = {};

        activities.forEach(activity => {
            if (!activity.userId || !activity.startTime || !activity.endTime) return;

            const durationSeconds = differenceInSeconds(parseISO(activity.endTime), parseISO(activity.startTime));
            const durationHours = durationSeconds / 3600;

            if (!activityByUser[activity.userId]) {
                activityByUser[activity.userId] = { hours: 0, count: 0 };
            }
            activityByUser[activity.userId].hours += durationHours;
            activityByUser[activity.userId].count += 1;
        });

        return Object.entries(activityByUser)
            .map(([userId, data]) => ({
                user: usersById[userId],
                hours: parseFloat(data.hours.toFixed(1)),
                count: data.count,
            }))
            .filter(item => item.user)
            .sort((a, b) => b.hours - a.hours);
    }, [filteredData, usersById]);

    // Nuovo: Attività calendario per cliente
    const calendarActivityByClient = useMemo(() => {
        const { activities } = filteredData;
        const activityByClient: Record<string, { hours: number, count: number, cost: number }> = {};
        const presetsById = calendarActivityPresets.reduce((acc: any, preset: any) => ({ ...acc, [preset.id]: preset }), {} as Record<string, CalendarActivityPreset>);

        activities.forEach((activity: any) => {
            if (!activity.startTime || !activity.endTime) return;

            const durationSeconds = differenceInSeconds(parseISO(activity.endTime), parseISO(activity.startTime));
            const durationHours = durationSeconds / 3600;

            if (durationHours <= 0) return;

            const preset = activity.presetId ? presetsById[activity.presetId] : null;
            const hourlyRate = preset?.hourlyRate ?? 20;
            const cost = durationHours * hourlyRate;

            // Se l'attività ha più clienti, dividi proporzionalmente
            const clientIds = activity.clientIds && activity.clientIds.length > 0
                ? activity.clientIds
                : (activity.clientId ? [activity.clientId] : []);

            if (clientIds.length === 0) {
                // Attività senza cliente - raggruppala come "Senza Cliente"
                const noClientKey = '__no_client__';
                if (!activityByClient[noClientKey]) {
                    activityByClient[noClientKey] = { hours: 0, count: 0, cost: 0 };
                }
                activityByClient[noClientKey].hours += durationHours;
                activityByClient[noClientKey].count += 1;
                activityByClient[noClientKey].cost += cost;
            } else {
                const perClientHours = durationHours / clientIds.length;
                const perClientCost = cost / clientIds.length;

                clientIds.forEach((clientId: string) => {
                    if (!activityByClient[clientId]) {
                        activityByClient[clientId] = { hours: 0, count: 0, cost: 0 };
                    }
                    activityByClient[clientId].hours += perClientHours;
                    activityByClient[clientId].count += 1; // Conta ogni attività per ogni cliente
                    activityByClient[clientId].cost += perClientCost;
                });
            }
        });

        return Object.entries(activityByClient)
            .map(([clientId, data]) => ({
                clientId,
                client: clientId === '__no_client__' ? { name: 'Senza Cliente', id: '__no_client__' } : clientsById[clientId],
                hours: parseFloat(data.hours.toFixed(1)),
                count: data.count,
                cost: parseFloat(data.cost.toFixed(2)),
            }))
            .filter(item => item.client)
            .sort((a, b) => b.hours - a.hours);
    }, [filteredData, clientsById, calendarActivityPresets]);

    // Task con scadenza nelle prossime 48h (Alert)
    const upcomingDeadlines48h = useMemo(() => {
        const now = new Date();
        const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        return filteredData.tasks
            .filter((t: any) => {
                if (!t.dueDate || t.status === 'Completato') return false;
                const dueDate = parseISO(t.dueDate);
                return dueDate >= now && dueDate <= in48h;
            })
            .sort((a: any, b: any) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());
    }, [filteredData.tasks]);

    // Prossime attività calendario della settimana
    const upcomingCalendarActivities = useMemo(() => {
        const now = new Date();
        const endOfWeekDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        return filteredData.activities
            ?.filter((a: any) => {
                if (!a.startTime) return false;
                const activityDate = parseISO(a.startTime);
                return activityDate >= now && activityDate <= endOfWeekDate;
            })
            .sort((a: any, b: any) => parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime())
            .slice(0, 5) || [];
    }, [filteredData.activities]);

    // Weekly Activity Heatmap Data
    const weeklyHeatmapData = useMemo(() => {
        const days = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
        const hours: Record<string, Record<string, number>> = {};

        // Initialize
        days.forEach(day => {
            hours[day] = {};
            users.forEach(user => {
                hours[day][user.id] = 0;
            });
        });

        // Calculate hours worked per day per user from activities
        filteredData.activities.forEach(activity => {
            if (!activity.startTime || !activity.endTime || !activity.userId) return;
            const startDate = parseISO(activity.startTime);
            const dayIndex = startDate.getDay();
            // Convert Sunday = 0 to our index (Mon = 0)
            const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
            const dayName = days[adjustedIndex];
            const durationHours = differenceInSeconds(parseISO(activity.endTime), startDate) / 3600;

            if (hours[dayName] && hours[dayName][activity.userId] !== undefined) {
                hours[dayName][activity.userId] += durationHours;
            }
        });

        // Also count task time spent
        filteredData.tasks.forEach(task => {
            if (!task.dueDate || !task.assignedUserId || !task.timeSpent) return;
            const taskDate = parseISO(task.dueDate);
            const dayIndex = taskDate.getDay();
            const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
            const dayName = days[adjustedIndex];
            const taskHours = task.timeSpent / 3600;

            if (hours[dayName] && hours[dayName][task.assignedUserId] !== undefined) {
                hours[dayName][task.assignedUserId] += taskHours;
            }
        });

        // Transform for display
        return days.map(day => ({
            day,
            ...Object.fromEntries(
                users.map(user => [
                    user.name?.split(' ')[0] || user.id,
                    parseFloat((hours[day][user.id] || 0).toFixed(1))
                ])
            ),
            total: parseFloat(Object.values(hours[day]).reduce((sum, h) => sum + h, 0).toFixed(1))
        }));
    }, [filteredData, users]);

    // Radar Chart Data for User Performance Comparison - Only active users
    const userRadarData = useMemo(() => {
        // First, calculate activity for all users
        const usersWithActivity = users.map(user => {
            const userTasks = filteredData.tasks.filter(t => t.assignedUserId === user.id);
            const userActivities = filteredData.activities.filter(a => a.userId === user.id);
            const totalTasks = userTasks.length;
            const completedTasks = userTasks.filter(t => t.status === 'Approvato').length;
            const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

            const totalHours = userActivities.reduce((sum, a) => {
                if (!a.startTime || !a.endTime) return sum;
                return sum + differenceInSeconds(parseISO(a.endTime), parseISO(a.startTime)) / 3600;
            }, 0) + userTasks.reduce((sum, t) => sum + (t.timeSpent || 0) / 3600, 0);

            const onTimeDeliveries = userTasks.filter(t => {
                if (!t.dueDate || t.status !== 'Approvato') return false;
                return true;
            }).length;
            const onTimeRate = completedTasks > 0 ? (onTimeDeliveries / completedTasks) * 100 : 0;

            return {
                user,
                totalTasks,
                completedTasks,
                totalHours,
                completionRate,
                onTimeRate,
                hasActivity: totalTasks > 0 || totalHours > 0,
            };
        })
            // Filter only users with actual activity
            .filter(u => u.hasActivity)
            // Sort by activity (tasks + hours)
            .sort((a, b) => (b.totalTasks + b.totalHours) - (a.totalTasks + a.totalHours))
            // Take top 5
            .slice(0, 5);

        // Transform for radar chart
        return usersWithActivity.map(({ user, completionRate, totalHours, onTimeRate, totalTasks, completedTasks }) => ({
            name: user.name?.split(' ')[0] || 'User',
            fullName: user.name || 'User',
            color: user.color || '#6366f1',
            'Completamento': Math.round(completionRate),
            'Ore Lavorate': Math.min(Math.round(totalHours / 2), 100), // Normalized to 0-100
            'Puntualità': Math.round(onTimeRate),
            'Task Totali': Math.min(totalTasks * 5, 100), // Normalized
            'Produttività': Math.round((completedTasks / Math.max(totalHours, 1)) * 20), // Tasks per hour normalized
        }));
    }, [filteredData, users]);

    // Team Availability Today
    const teamAvailability = useMemo(() => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const absentToday = absences.filter(a => {
            if (!a.startDate || !a.endDate) return false;
            const start = a.startDate;
            const end = a.endDate;
            return today >= start && today <= end && a.status === 'Approvato';
        });

        const absentUserIds = new Set(absentToday.map(a => a.userId));
        const availableUsers = users.filter(u => !absentUserIds.has(u.id));
        const absentUsers = users.filter(u => absentUserIds.has(u.id));

        return {
            available: availableUsers,
            absent: absentUsers,
            total: users.length,
            absenceReasons: absentToday.reduce((acc, a) => {
                acc[a.userId] = a.type || 'Assente';
                return acc;
            }, {} as Record<string, string>),
        };
    }, [users, absences]);

    // Recent Activity Feed (last 10 activities/tasks updated)
    const recentActivityFeed = useMemo(() => {
        const activities: Array<{
            type: 'task' | 'activity' | 'project',
            title: string,
            user: User | undefined,
            timestamp: Date,
            status?: string,
            icon: 'check' | 'clock' | 'file' | 'user',
        }> = [];

        // Recent completed tasks
        filteredData.tasks
            .filter(t => t.status === 'Approvato' && t.updatedAt)
            .slice(0, 5)
            .forEach(t => {
                activities.push({
                    type: 'task',
                    title: t.title,
                    user: t.assignedUserId ? usersById[t.assignedUserId] : undefined,
                    timestamp: t.updatedAt ? (typeof t.updatedAt === 'string' ? parseISO(t.updatedAt) : new Date(t.updatedAt)) : new Date(),
                    status: 'Completato',
                    icon: 'check',
                });
            });

        // Recent activities registered
        filteredData.activities
            .filter(a => a.endTime)
            .slice(0, 5)
            .forEach(a => {
                const preset = a.presetId ? calendarActivityPresets.find(p => p.id === a.presetId) : null;
                activities.push({
                    type: 'activity',
                    title: preset?.name || 'Attività',
                    user: a.userId ? usersById[a.userId] : undefined,
                    timestamp: parseISO(a.endTime!),
                    icon: 'clock',
                });
            });

        // Sort by timestamp descending and take top 8
        return activities
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 8);
    }, [filteredData, usersById, calendarActivityPresets]);

    // Top Clients by Revenue
    const topClientsByRevenue = useMemo(() => {
        return clientData.clientCosts
            .filter((c: any) => c.cost > 0)
            .sort((a: any, b: any) => b.cost - a.cost)
            .slice(0, 5);
    }, [clientData]);

    // ===== NEW: Client Profitability Analysis =====
    const clientProfitability = useMemo(() => {
        const profitByClient: Record<string, {
            clientId: string;
            name: string;
            budget: number;
            costs: number;
            profit: number;
            profitMargin: number;
            tasksCompleted: number;
            hoursLogged: number;
        }> = {};

        // Calculate costs and hours per client from tasks
        filteredData.tasks.forEach(task => {
            if (!task.clientId) return;
            const clientId = task.clientId;
            const client = clientsById[clientId];
            if (!client) return;

            if (!profitByClient[clientId]) {
                profitByClient[clientId] = {
                    clientId,
                    name: client.name,
                    budget: client.budget || 0,
                    costs: 0,
                    profit: 0,
                    profitMargin: 0,
                    tasksCompleted: 0,
                    hoursLogged: 0,
                };
            }

            const hours = (task.timeSpent || 0) / 3600;
            const activityType = activityTypes.find(a => a.name === task.activityType);
            const hourlyRate = activityType?.hourlyRate || 25;
            const cost = hours * hourlyRate;

            profitByClient[clientId].costs += cost;
            profitByClient[clientId].hoursLogged += hours;
            if (task.status === 'Approvato') {
                profitByClient[clientId].tasksCompleted += 1;
            }
        });

        // Calculate profit and margin
        Object.values(profitByClient).forEach(client => {
            client.profit = client.budget - client.costs;
            client.profitMargin = client.budget > 0
                ? ((client.budget - client.costs) / client.budget) * 100
                : 0;
        });

        return Object.values(profitByClient)
            .filter(c => c.budget > 0 || c.costs > 0)
            .sort((a, b) => b.profit - a.profit);
    }, [filteredData.tasks, clientsById, activityTypes]);

    // ===== NEW: Predictive Delivery Analytics =====
    const predictiveDelivery = useMemo(() => {
        // Analyze completed tasks to predict future delivery times
        const completedWithEstimates = filteredData.tasks.filter(t =>
            t.status === 'Approvato' &&
            t.estimatedDuration > 0 &&
            t.timeSpent && t.timeSpent > 0
        );

        // Calculate average deviation by activity type
        const deviationByType: Record<string, {
            type: string;
            avgDeviation: number;
            samples: number;
            accuracyRate: number;
        }> = {};

        completedWithEstimates.forEach(task => {
            const type = task.activityType || 'Altro';
            const estimatedSeconds = task.estimatedDuration * 60;
            const actualSeconds = task.timeSpent || 0;
            const deviation = ((actualSeconds - estimatedSeconds) / estimatedSeconds) * 100;

            if (!deviationByType[type]) {
                deviationByType[type] = {
                    type,
                    avgDeviation: 0,
                    samples: 0,
                    accuracyRate: 0
                };
            }
            deviationByType[type].samples += 1;
            deviationByType[type].avgDeviation += deviation;
        });

        // Finalize averages
        Object.values(deviationByType).forEach(item => {
            if (item.samples > 0) {
                item.avgDeviation = item.avgDeviation / item.samples;
                // Accuracy: 100% if perfectly estimated, decreasing with deviation
                item.accuracyRate = Math.max(0, 100 - Math.abs(item.avgDeviation));
            }
        });

        // Predict active tasks
        const activeTasks = filteredData.tasks.filter(t =>
            t.status !== 'Approvato' && t.status !== 'Annullato' && t.dueDate
        );

        const predictions = activeTasks.slice(0, 10).map(task => {
            const type = task.activityType || 'Altro';
            const deviation = deviationByType[type]?.avgDeviation || 0;
            const predictedDelay = deviation > 0 ? Math.ceil(deviation / 10) : 0; // days of delay

            const originalDue = new Date(task.dueDate!);
            const predictedDue = new Date(originalDue);
            predictedDue.setDate(predictedDue.getDate() + predictedDelay);

            return {
                task,
                originalDue,
                predictedDue,
                predictedDelay,
                risk: predictedDelay > 3 ? 'high' : predictedDelay > 1 ? 'medium' : 'low',
            };
        });

        return {
            deviationByType: Object.values(deviationByType).sort((a, b) => b.samples - a.samples),
            predictions,
            overallAccuracy: Object.values(deviationByType).reduce((sum, d) => sum + d.accuracyRate, 0) /
                (Object.keys(deviationByType).length || 1),
        };
    }, [filteredData.tasks]);

    // ===== NEW: Efficiency Trends =====
    const efficiencyTrends = useMemo(() => {
        const monthlyData: Record<string, {
            month: string;
            estimated: number;
            actual: number;
            efficiency: number;
            tasksCompleted: number;
        }> = {};

        filteredData.tasks
            .filter(t => t.status === 'Approvato' && t.updatedAt)
            .forEach(task => {
                const month = typeof task.updatedAt === 'string'
                    ? format(parseISO(task.updatedAt), 'yyyy-MM')
                    : format(new Date(task.updatedAt as unknown as string | number | Date), 'yyyy-MM');

                if (!monthlyData[month]) {
                    monthlyData[month] = {
                        month,
                        estimated: 0,
                        actual: 0,
                        efficiency: 0,
                        tasksCompleted: 0
                    };
                }

                monthlyData[month].estimated += task.estimatedDuration || 0;
                monthlyData[month].actual += (task.timeSpent || 0) / 60; // convert to minutes
                monthlyData[month].tasksCompleted += 1;
            });

        // Calculate efficiency percentage
        Object.values(monthlyData).forEach(data => {
            data.efficiency = data.actual > 0
                ? Math.round((data.estimated / data.actual) * 100)
                : 100;
        });

        return Object.values(monthlyData)
            .sort((a, b) => a.month.localeCompare(b.month))
            .slice(-6) // Last 6 months
            .map(d => ({
                ...d,
                name: format(parseISO(d.month + '-01'), 'MMM', { locale: it }),
            }));
    }, [filteredData.tasks]);

    if (isLoadingLayout) {
        return <div className="space-y-8">
            <Skeleton className="h-10 w-1/3" />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
            </div>
            <Skeleton className="h-72" />
            <Skeleton className="h-96" />
        </div>;
    }

    // CSV Export function
    const handleExportCSV = () => {
        const { tasks, projects } = filteredData;

        // Create CSV content
        let csvContent = "data:text/csv;charset=utf-8,";

        // Tasks section
        csvContent += "=== REPORT TASK ===\n";
        csvContent += "Titolo,Stato,Scadenza,Assegnatario,Ore Registrate,Cliente\n";
        tasks.forEach(task => {
            const assignee = task.assignedUserId ? usersById[task.assignedUserId]?.name || 'N/A' : 'Non assegnato';
            const client = task.clientId ? clientsById[task.clientId]?.name || 'N/A' : 'N/A';
            const hours = ((task.timeSpent || 0) / 3600).toFixed(1);
            csvContent += `"${task.title}","${task.status}","${task.dueDate || 'N/D'}","${assignee}","${hours}h","${client}"\n`;
        });

        csvContent += "\n=== REPORT PROGETTI ===\n";
        csvContent += "Nome,Stato,Priorità,Data Inizio,Data Fine,Team Leader,Cliente\n";
        projects.forEach(project => {
            const teamLeader = project.teamLeaderId ? usersById[project.teamLeaderId]?.name || 'N/A' : 'Non assegnato';
            const client = project.clientId ? clientsById[project.clientId]?.name || 'N/A' : 'N/A';
            csvContent += `"${project.name}","${project.status}","${project.priority}","${project.startDate || 'N/D'}","${project.endDate || 'N/D'}","${teamLeader}","${client}"\n`;
        });

        // Download
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `dashboard_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            {/* Header con titolo, badge KPI e Quick Actions */}
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold">Dashboard Admin</h1>
                    <p className="text-sm text-muted-foreground">Panoramica delle attività e performance del team</p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-primary/20 text-primary border-primary/30">
                            📁 Progetti: {globalKpis.activeProjects}
                        </Badge>
                        <Badge className="bg-destructive/20 text-destructive border-destructive/30">
                            ⚠️ Rischio: {globalKpis.atRiskProjects}
                        </Badge>
                        <Badge className="bg-primary/20 text-primary border-primary/30">
                            🔄 Attivi: {globalKpis.inProgressTasks}
                        </Badge>
                        <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
                            ⏰ Scadenze: {globalKpis.upcomingDeadlines}
                        </Badge>
                        {/* Trend indicators */}
                        <Badge className={`${globalKpis.trends.completedTasks >= 0 ? 'bg-emerald-500/20 text-emerald-600' : 'bg-red-500/20 text-red-600'} border-transparent`}>
                            {globalKpis.trends.completedTasks >= 0 ? '↑' : '↓'} {Math.abs(globalKpis.trends.completedTasks).toFixed(0)}% task
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="hidden sm:flex gap-2" onClick={handleExportCSV}>
                            <Download className="h-4 w-4" />
                            Esporta CSV
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => window.location.reload()}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Nuovi Widget Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {isLoadingLayout ? (
                    <>
                        <Skeleton className="h-[200px] w-full rounded-lg" />
                        <Skeleton className="h-[200px] w-full rounded-lg" />
                        <Skeleton className="h-[200px] w-full rounded-lg" />
                    </>
                ) : (
                    <>
                        <DeadlineCountdownWidget
                            tasks={allTasks}
                            onTaskClick={(taskId) => window.location.href = `/tasks?taskId=${taskId}`}
                        />

                        <UpcomingBirthdaysWidget users={users} />

                        <WeatherWidget city="Milano" />
                    </>
                )}
            </div>

            {/* Smart Alerts Section */}
            {smartAlerts.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {smartAlerts.map((alert, index) => (
                        <Card key={index} className={`glass-card border-l-4 ${alert.type === 'critical' ? 'border-l-red-500 bg-red-500/5' :
                            alert.type === 'warning' ? 'border-l-amber-500 bg-amber-500/5' :
                                'border-l-primary bg-primary/5'
                            }`}>
                            <CardContent className="p-3 flex items-center gap-3">
                                <div className={`p-2 rounded-full ${alert.type === 'critical' ? 'bg-red-500/20' :
                                    alert.type === 'warning' ? 'bg-amber-500/20' :
                                        'bg-primary/20'
                                    }`}>
                                    {alert.type === 'critical' ? <AlertTriangle className="h-4 w-4 text-red-500" /> :
                                        alert.type === 'warning' ? <Clock className="h-4 w-4 text-amber-500" /> :
                                            <Bell className="h-4 w-4 text-primary" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{alert.message}</p>
                                    <p className="text-xs text-muted-foreground">Richiede attenzione</p>
                                </div>
                                <Badge variant={alert.type === 'critical' ? 'destructive' : 'secondary'} className="shrink-0">
                                    {alert.count}
                                </Badge>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Active Tasks - Chi sta lavorando su cosa */}
            <Card className="glass-card bg-transparent">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-emerald-500" />
                        Task in Lavorazione
                    </CardTitle>
                    <CardDescription>Task attualmente in corso con registrazione tempo</CardDescription>
                </CardHeader>
                <CardContent>
                    {allTasks.filter(t => t.timerStartedAt && t.status !== 'Approvato' && t.status !== 'Annullato').length === 0 ? (
                        <p className="text-muted-foreground text-sm text-center py-4">Nessun task con timer attivo al momento</p>
                    ) : (
                        <div className="space-y-3">
                            {allTasks.filter(t => t.timerStartedAt && t.status !== 'Approvato' && t.status !== 'Annullato').map(task => {
                                const client = clients.find(c => c.id === task.clientId);
                                const workingUser = users.find(u => u.id === task.timerUserId);
                                return (
                                    <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-medium" style={{ backgroundColor: workingUser?.color || '#6b7280' }}>
                                                {workingUser?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{task.title}</p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Briefcase className="h-3 w-3" />
                                                        {client?.name || 'Cliente non assegnato'}
                                                    </span>
                                                    <span>•</span>
                                                    <span>{workingUser?.name || 'Utente sconosciuto'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                                                <Clock className="h-3 w-3 mr-1 animate-breathing-custom" />
                                                In corso
                                            </Badge>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* NEW: Quick Actions, Team Availability & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Quick Actions */}
                <Card className="lg:col-span-1 glass-card bg-transparent">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Target className="h-4 w-4" /> Azioni Rapide
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Button variant="outline" className="w-full justify-start gap-2" size="sm">
                            <ClipboardList className="h-4 w-4" /> Nuovo Task
                        </Button>
                        <Button variant="outline" className="w-full justify-start gap-2" size="sm">
                            <Briefcase className="h-4 w-4" /> Nuovo Progetto
                        </Button>
                        <Button variant="outline" className="w-full justify-start gap-2" size="sm">
                            <Building2 className="h-4 w-4" /> Nuovo Cliente
                        </Button>
                        <Button variant="outline" className="w-full justify-start gap-2" size="sm">
                            <Clock className="h-4 w-4" /> Registra Attività
                        </Button>
                    </CardContent>
                </Card>

                {/* Team Availability */}
                <Card className="lg:col-span-1 glass-card bg-transparent">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Users className="h-4 w-4" /> Team Oggi
                        </CardTitle>
                        <CardDescription>
                            {teamAvailability.available.length}/{teamAvailability.total} disponibili
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {teamAvailability.absent.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground uppercase">Assenti</p>
                                    <div className="flex flex-wrap gap-2">
                                        {teamAvailability.absent.slice(0, 4).map(user => (
                                            <div key={user.id} className="flex items-center gap-1.5 bg-red-500/10 rounded-full px-2 py-1">
                                                <Avatar className="h-5 w-5">
                                                    <AvatarFallback className="text-[8px]" style={{ backgroundColor: user.color || '#ef4444', color: 'white' }}>
                                                        {user.name ? getInitials(user.name) : '?'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-xs text-red-600">{user.name?.split(' ')[0]}</span>
                                            </div>
                                        ))}
                                        {teamAvailability.absent.length > 4 && (
                                            <Badge variant="secondary" className="text-[10px]">+{teamAvailability.absent.length - 4}</Badge>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase">Disponibili</p>
                                <div className="flex -space-x-2">
                                    {teamAvailability.available.slice(0, 8).map(user => (
                                        <Avatar key={user.id} className="h-8 w-8 border-2 border-background" title={user.name}>
                                            <AvatarFallback className="text-xs" style={{ backgroundColor: user.color || '#10b981', color: 'white' }}>
                                                {user.name ? getInitials(user.name) : '?'}
                                            </AvatarFallback>
                                        </Avatar>
                                    ))}
                                    {teamAvailability.available.length > 8 && (
                                        <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                                            +{teamAvailability.available.length - 8}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Activity Feed */}
                <Card className="lg:col-span-1 glass-card">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Activity className="h-4 w-4" /> Attività Recenti
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {recentActivityFeed.length > 0 ? (
                            <div className="space-y-3 max-h-[200px] overflow-y-auto">
                                {recentActivityFeed.map((activity, index) => (
                                    <div key={index} className="flex items-start gap-3">
                                        <div className={`p-1.5 rounded-full shrink-0 ${activity.icon === 'check' ? 'bg-emerald-500/20' : 'bg-primary/20'
                                            }`}>
                                            {activity.icon === 'check' ? (
                                                <CheckCircle className="h-3 w-3 text-emerald-500" />
                                            ) : (
                                                <Clock className="h-3 w-3 text-primary" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{activity.title}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {activity.user?.name?.split(' ')[0] || 'Sistema'} · {format(activity.timestamp, 'dd/MM HH:mm')}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">Nessuna attività recente.</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
                <Card className="rounded-xl glass-card bg-transparent">
                    <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-xl">
                            <CardTitle className="flex items-center gap-2 text-lg justify-between">
                                <span className="flex items-center gap-2">
                                    <Filter className="h-5 w-5" />
                                    Filtri
                                    {isFiltersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8"
                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); resetFilters(); }}
                                >
                                    <Eraser className="mr-2 h-4 w-4" />
                                    Reset
                                </Button>
                            </CardTitle>
                        </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <Label>Periodo</Label>
                                <div className="flex flex-col sm:flex-row items-center gap-2">
                                    <DatePickerDialog
                                        value={filters.startDate || undefined}
                                        onChange={(date) => handleFilterChange('startDate', date || null)}
                                        label="Inizio"
                                    />
                                    <DatePickerDialog
                                        value={filters.endDate || undefined}
                                        onChange={(date) => handleFilterChange('endDate', date || null)}
                                        label="Fine"
                                    />
                                </div>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    <Button variant="outline" size="sm" onClick={() => setDateShortcut('week')}>Settimana</Button>
                                    <Button variant="outline" size="sm" onClick={() => setDateShortcut('month')}>Mese</Button>
                                    <Button variant="outline" size="sm" onClick={() => setDateShortcut('quarter')}>Trimestre</Button>
                                    <Button variant="outline" size="sm" onClick={() => setDateShortcut('last3months')}>Ultimi 3 Mesi</Button>
                                    <Button variant="outline" size="sm" onClick={() => setDateShortcut('year')}>Anno</Button>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="client-filter">Cliente</Label>
                                <Select value={filters.clientId} onValueChange={(value: string) => handleFilterChange('clientId', value)}>
                                    <SelectTrigger id="client-filter"><SelectValue placeholder="Tutti i Clienti" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tutti i Clienti</SelectItem>
                                        {[...clients].sort((a: any, b: any) => a.name.localeCompare(b.name)).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="user-filter">Collaboratore</Label>
                                <Select value={filters.userId} onValueChange={(value: string) => handleFilterChange('userId', value)}>
                                    <SelectTrigger id="user-filter"><SelectValue placeholder="Tutti i Collaboratori" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tutti i Collaboratori</SelectItem>
                                        {[...users].sort((a: any, b: any) => a.name.localeCompare(b.name)).map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </CollapsibleContent>
                </Card>
            </Collapsible>


            {/* Alert Scadenze Imminenti (entro 48h) */}
            {upcomingDeadlines48h.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center gap-4 animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 bg-destructive/20 rounded-full shrink-0">
                        <AlertTriangle className="h-6 w-6 text-destructive" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-destructive flex items-center gap-2">
                            Attenzione: {upcomingDeadlines48h.length} Task in scadenza nelle prossime 48h
                        </h3>
                        <p className="text-sm text-destructive/80">
                            È richiesto un intervento immediato per evitare ritardi.
                        </p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                        {upcomingDeadlines48h.slice(0, 3).map((task: any) => (
                            <div key={task.id} className="bg-background/50 border border-destructive/20 rounded-lg p-2 min-w-[200px] flex items-center gap-3 shadow-sm">
                                <div className={`w-1 h-8 rounded-full ${task.priority === 'Critica' ? 'bg-destructive' : 'bg-amber-500'
                                    }`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{task.title}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {usersById[task.assignedUserId]?.name || 'Non assegnato'} • {format(parseISO(task.dueDate), 'dd/MM HH:mm')}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {upcomingDeadlines48h.length > 3 && (
                            <div className="flex items-center justify-center bg-background/50 border border-destructive/20 rounded-lg p-2 min-w-[50px] shadow-sm">
                                <span className="text-sm font-bold text-destructive">+{upcomingDeadlines48h.length - 3}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-8">
                {/* Performance Utenti - Layout a Card */}
                <Card className="glass-card bg-transparent">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Performance Utenti</CardTitle>
                        <CardDescription>Riepilogo delle attività e delle performance per utente nel periodo selezionato.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {userPerformanceData.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {userPerformanceData.map((user, index) => {
                                    const efficiency = user.estimatedHours > 0
                                        ? ((user.hours / user.estimatedHours) * 100)
                                        : 0;
                                    const efficiencyStatus = efficiency === 0 ? 'neutral' :
                                        efficiency <= 90 ? 'excellent' :
                                            efficiency <= 110 ? 'good' : 'over';
                                    const efficiencyColor = efficiencyStatus === 'excellent' ? '#10b981' :
                                        efficiencyStatus === 'good' ? '#3b82f6' :
                                            efficiencyStatus === 'over' ? '#f59e0b' : '#9ca3af';
                                    const isTopPerformer = index < 3 && user.completedCount > 0;
                                    const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';

                                    return (
                                        <Card key={user.id} className={`relative overflow-hidden transition-all hover:shadow-lg ${isTopPerformer ? 'ring-2 ring-primary/20' : ''}`}>
                                            {isTopPerformer && (
                                                <div className="absolute top-2 right-2 text-xl">{rankEmoji}</div>
                                            )}
                                            <CardHeader className="pb-2 text-center">
                                                <Avatar className="h-16 w-16 mx-auto border-4" style={{ borderColor: user.color || '#6366f1' }}>
                                                    <AvatarFallback className="text-xl" style={{ backgroundColor: user.color || '#6366f1', color: 'white' }}>
                                                        {user.name ? getInitials(user.name) : '?'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <CardTitle className="text-lg mt-2">{user.name}</CardTitle>
                                                <CardDescription className="text-xs">
                                                    {user.assignedCount > 0
                                                        ? `${user.rate.toFixed(0)}% completamento`
                                                        : 'Nessun task assegnato'}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                {/* Stats Grid */}
                                                <div className="grid grid-cols-3 gap-2 text-center">
                                                    <div className="bg-muted/50 rounded-lg p-2">
                                                        <div className="text-lg font-bold text-primary">{user.assignedCount}</div>
                                                        <div className="text-[10px] text-muted-foreground uppercase">Assegnati</div>
                                                    </div>
                                                    <div className="bg-muted/50 rounded-lg p-2">
                                                        <div className="text-lg font-bold text-emerald-600">{user.completedCount}</div>
                                                        <div className="text-[10px] text-muted-foreground uppercase">Completati</div>
                                                    </div>
                                                    <div className="bg-muted/50 rounded-lg p-2">
                                                        <div className="text-lg font-bold">{user.hours}h</div>
                                                        <div className="text-[10px] text-muted-foreground uppercase">Ore</div>
                                                    </div>
                                                </div>

                                                {/* Efficiency Indicator */}
                                                {user.estimatedHours > 0 && (
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground">Efficienza</span>
                                                            <span className="font-semibold" style={{ color: efficiencyColor }}>
                                                                {efficiency.toFixed(0)}%
                                                            </span>
                                                        </div>
                                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full transition-all"
                                                                style={{
                                                                    width: `${Math.min(efficiency, 150) / 1.5}%`,
                                                                    backgroundColor: efficiencyColor
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                                            <span>{user.hours}h effettive</span>
                                                            <span>{user.estimatedHours}h stimate</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Completion Progress */}
                                                {user.assignedCount > 0 && (
                                                    <div className="pt-2 border-t">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-muted-foreground">Progresso Task</span>
                                                            <Badge variant={user.rate >= 80 ? 'default' : user.rate >= 50 ? 'secondary' : 'outline'} className="text-[10px] h-5">
                                                                {user.completedCount}/{user.assignedCount}
                                                            </Badge>
                                                        </div>
                                                        <Progress value={user.rate} className="h-1.5 mt-1" />
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
                                <div className="p-3 bg-muted rounded-full">
                                    <Users className="h-6 w-6 opacity-50" />
                                </div>
                                <p className="text-sm">Nessun dato utente da mostrare per i filtri selezionati.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
                {/* Progetti Principali - Layout a Card */}
                <Card className="glass-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" /> Progetti Principali</CardTitle>
                        <CardDescription>Una visione d'insieme dei progetti attivi e più importanti, in base ai filtri applicati.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {filteredData.projects.filter(p => p.status === 'In Corso' || p.priority === 'Critica').length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredData.projects.filter(p => p.status === 'In Corso' || p.priority === 'Critica').slice(0, 6).map(project => {
                                    const teamLeader = project.teamLeaderId ? usersById[project.teamLeaderId] : null;
                                    const client = project.clientId ? clientsById[project.clientId] : null;
                                    const endDate = project.endDate ? parseISO(project.endDate) : null;
                                    const daysRemaining = endDate ? differenceInDays(endDate, new Date()) : null;
                                    const isOverdue = daysRemaining !== null && daysRemaining < 0;
                                    const isUrgent = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7;

                                    // Calculate project health
                                    const projectTasks = filteredData.tasks.filter(t => t.projectId === project.id);
                                    const completedTasks = projectTasks.filter(t => t.status === 'Approvato').length;
                                    const progress = projectTasks.length > 0 ? (completedTasks / projectTasks.length) * 100 : 0;

                                    // Health indicator based on deadline and progress
                                    let healthStatus: 'good' | 'warning' | 'critical' = 'good';
                                    let healthColor = '#10b981';
                                    if (isOverdue) {
                                        healthStatus = 'critical';
                                        healthColor = '#ef4444';
                                    } else if (isUrgent && progress < 70) {
                                        healthStatus = 'warning';
                                        healthColor = '#f59e0b';
                                    } else if (project.priority === 'Critica') {
                                        healthStatus = progress < 50 ? 'critical' : 'warning';
                                        healthColor = progress < 50 ? '#ef4444' : '#f59e0b';
                                    }

                                    return (
                                        <Card
                                            key={project.id}
                                            className="relative overflow-hidden hover:shadow-lg transition-all border-l-4"
                                            style={{ borderLeftColor: healthColor }}
                                        >
                                            {/* Priority Badge */}
                                            {project.priority === 'Critica' && (
                                                <div className="absolute top-2 right-2">
                                                    <Badge variant="destructive" className="text-[10px] uppercase font-bold animate-pulse">
                                                        🔥 Critico
                                                    </Badge>
                                                </div>
                                            )}

                                            <CardHeader className="pb-2">
                                                <div className="flex items-start gap-2">
                                                    <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${project.status === 'In Corso' ? 'bg-green-500 animate-pulse' :
                                                        project.status === 'Completato' ? 'bg-primary' : 'bg-gray-300'
                                                        }`} />
                                                    <div className="flex-1 min-w-0">
                                                        <CardTitle className="text-base font-semibold truncate" title={project.name}>
                                                            {project.name}
                                                        </CardTitle>
                                                        <CardDescription className="text-xs truncate">
                                                            {client?.name || 'Nessun cliente'}
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                            </CardHeader>

                                            <CardContent className="space-y-3">
                                                {/* Team Leader */}
                                                {teamLeader && (
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-6 w-6 border" style={{ borderColor: teamLeader.color || '#6366f1' }}>
                                                            <AvatarFallback className="text-[10px]" style={{ backgroundColor: teamLeader.color || '#6366f1', color: 'white' }}>
                                                                {teamLeader.name ? getInitials(teamLeader.name) : '?'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-xs text-muted-foreground truncate">{teamLeader.name}</span>
                                                    </div>
                                                )}

                                                {/* Progress */}
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-muted-foreground">Avanzamento</span>
                                                        <span className="font-semibold">{progress.toFixed(0)}%</span>
                                                    </div>
                                                    <Progress value={progress} className="h-2" />
                                                    <div className="text-[10px] text-muted-foreground">
                                                        {completedTasks}/{projectTasks.length} task completati
                                                    </div>
                                                </div>

                                                {/* Deadline Countdown */}
                                                <div className={`flex items-center justify-between p-2 rounded-lg ${isOverdue ? 'bg-destructive/10' :
                                                    isUrgent ? 'bg-amber-500/10' : 'bg-muted/50'
                                                    }`}>
                                                    <div className="flex items-center gap-2">
                                                        <CalendarClock className={`h-4 w-4 ${isOverdue ? 'text-destructive' :
                                                            isUrgent ? 'text-amber-500' : 'text-muted-foreground'
                                                            }`} />
                                                        <span className="text-xs">
                                                            {endDate ? format(endDate, 'dd/MM/yy') : 'N/D'}
                                                        </span>
                                                    </div>
                                                    <Badge
                                                        variant={isOverdue ? 'destructive' : isUrgent ? 'secondary' : 'outline'}
                                                        className="text-[10px] h-5"
                                                    >
                                                        {daysRemaining !== null ? (
                                                            isOverdue
                                                                ? `${Math.abs(daysRemaining)}gg scaduto`
                                                                : daysRemaining === 0
                                                                    ? 'Oggi!'
                                                                    : `${daysRemaining}gg`
                                                        ) : 'N/D'}
                                                    </Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
                                <div className="p-3 bg-muted rounded-full">
                                    <Briefcase className="h-6 w-6 opacity-50" />
                                </div>
                                <p className="text-sm">Nessun progetto attivo trovato per i filtri selezionati.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 glass-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><LineChartIcon /> Trend Costi Mensili</CardTitle>
                        <CardDescription>Andamento dei costi totali nel tempo.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <DynamicLineChart data={monthlyCostTrend} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis allowDecimals={false} tickFormatter={val => `€${val / 1000}k`} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="Costo Totale" stroke="hsl(var(--primary))" fill="hsla(var(--primary), 0.2)" />
                                <Line type="monotone" dataKey="Costo Totale" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                                <ReferenceLine y={avgMonthlyCost} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label={{ position: 'insideTopRight', value: 'Media', fill: 'hsl(var(--destructive))', fontSize: 12 }} />
                            </DynamicLineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <div className="space-y-8">
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <UserX className="h-5 w-5" />
                                Assenti Oggi
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {absencesTodayData.length > 0 ? (
                                <div className="grid gap-4">
                                    {absencesTodayData.map(({ user, absence }: any) => (
                                        <div key={absence.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card/50">
                                            <Avatar className="h-10 w-10 border-2 border-background">
                                                <AvatarFallback style={{ backgroundColor: user.color, color: 'white' }}>
                                                    {user.name ? getInitials(user.name) : '?'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-medium text-sm">{user.name}</p>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Badge variant="outline" className="text-[10px] h-5 px-1 font-normal bg-muted">
                                                        {absence.type}
                                                    </Badge>
                                                    <span>fino al {format(parseISO(absence.endDate), 'dd/MM')}</span>
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground gap-2">
                                    <div className="p-3 bg-muted rounded-full">
                                        <UserX className="h-6 w-6 opacity-50" />
                                    </div>
                                    <p className="text-sm">Nessun membro del team è assente oggi.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="glass-card bg-transparent">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CalendarClock className="h-5 w-5" />
                                Prossime Attività
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {upcomingCalendarActivities.length > 0 ? (
                                <div className="space-y-4">
                                    {upcomingCalendarActivities.map((activity: any) => (
                                        <div key={activity.id} className="flex items-center gap-3 border-b last:border-0 pb-3 last:pb-0">
                                            <div className="bg-primary/10 p-2 rounded-lg text-primary text-center min-w-[50px]">
                                                <div className="text-xs font-bold uppercase">{format(parseISO(activity.startTime), 'MMM', { locale: it })}</div>
                                                <div className="text-lg font-bold">{format(parseISO(activity.startTime), 'dd')}</div>
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm line-clamp-1">{activity.title || 'Attività senza titolo'}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {format(parseISO(activity.startTime), 'HH:mm')} - {format(parseISO(activity.endTime), 'HH:mm')}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">Nessuna attività programmata.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Report Costi per Cliente - Layout a Card */}
            <Card className="glass-card">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Costi per Cliente</CardTitle>
                    <CardDescription>Costi totali stimati per cliente in base al tempo registrato. Totale: {formatCurrency(clientData.totalCost)}</CardDescription>
                </CardHeader>
                <CardContent>
                    {clientData.clientCosts.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {clientData.clientCosts.map(client => {
                                const percentage = clientData.totalCost > 0 ? (client.cost / clientData.totalCost) * 100 : 0;
                                const relativePercentage = clientData.maxCost > 0 ? (client.cost / clientData.maxCost) * 100 : 0;
                                const progressBarColor = relativePercentage > 75 ? 'bg-red-500' : relativePercentage > 40 ? 'bg-amber-500' : 'bg-emerald-500';
                                return (
                                    <Card key={client.id} className="border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: relativePercentage > 75 ? '#ef4444' : relativePercentage > 40 ? '#f59e0b' : '#10b981' }}>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-base font-semibold truncate" title={client.name}>{client.name}</CardTitle>
                                            <CardDescription className="text-xs">{percentage.toFixed(1)}% del totale</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="text-2xl font-bold text-primary">
                                                {formatCurrency(client.cost)}
                                            </div>
                                            <Progress value={relativePercentage} className="h-2" indicatorClassName={progressBarColor} />
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div className="bg-muted/50 rounded-md p-2">
                                                    <div className="text-muted-foreground">Ore</div>
                                                    <div className="font-semibold">{formatNumber(client.hours)}h</div>
                                                </div>
                                                <div className="bg-muted/50 rounded-md p-2">
                                                    <div className="text-muted-foreground">€/ora</div>
                                                    <div className="font-semibold">{formatCurrency(client.averageRate)}</div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
                            <div className="p-3 bg-muted rounded-full">
                                <Users className="h-6 w-6 opacity-50" />
                            </div>
                            <p className="text-sm">Nessun dato sui costi dei clienti.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
            {/* Report Costi per Attività - Layout a Card */}
            <Card className="glass-card">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Euro className="h-5 w-5" /> Costi per Attività</CardTitle>
                    <CardDescription>Costi totali stimati per tipo di attività in base al tempo registrato. Totale: {formatCurrency(activityData.reduce((sum, a) => sum + a.cost, 0))}</CardDescription>
                </CardHeader>
                <CardContent>
                    {activityData.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {activityData.map((activity, index) => {
                                const totalCost = activityData.reduce((sum, a) => sum + a.cost, 0);
                                const percentage = totalCost > 0 ? (activity.cost / totalCost) * 100 : 0;
                                const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];
                                const color = colors[index % colors.length];
                                return (
                                    <Card key={activity.name} className="border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: color }}>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-base font-semibold truncate" title={activity.name}>{activity.name}</CardTitle>
                                            <CardDescription className="text-xs">{percentage.toFixed(1)}% del totale</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="text-2xl font-bold" style={{ color }}>
                                                {formatCurrency(activity.cost)}
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: color }} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div className="bg-muted/50 rounded-md p-2">
                                                    <div className="text-muted-foreground">Ore</div>
                                                    <div className="font-semibold">{formatNumber(activity.hours)}h</div>
                                                </div>
                                                <div className="bg-muted/50 rounded-md p-2">
                                                    <div className="text-muted-foreground">€/ora</div>
                                                    <div className="font-semibold">{formatCurrency(activity.rate)}</div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
                            <div className="p-3 bg-muted rounded-full">
                                <Euro className="h-6 w-6 opacity-50" />
                            </div>
                            <p className="text-sm">Nessun dato sulle attività.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Report Conteggio Attività */}
            <Card className="glass-card">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Conteggio Attività</CardTitle>
                    <CardDescription>
                        Numero di attività calendario registrate per utente.
                        Totale: {calendarActivityByUser.reduce((sum, item) => sum + item.count, 0)} attività |
                        {formatNumber(calendarActivityByUser.reduce((sum, item) => sum + item.hours, 0))}h totali
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {calendarActivityByUser.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {calendarActivityByUser.map(({ user, hours, count }, index) => {
                                const totalActivities = calendarActivityByUser.reduce((sum, item) => sum + item.count, 0);
                                const percentage = totalActivities > 0 ? (count / totalActivities) * 100 : 0;
                                return (
                                    <Card key={user.id} className="hover:shadow-md transition-shadow border-t-4" style={{ borderTopColor: user.color || '#6366f1' }}>
                                        <CardHeader className="pb-2 flex flex-row items-center space-x-3">
                                            <Avatar className="h-10 w-10 border-2" style={{ borderColor: user.color || '#6366f1' }}>
                                                <AvatarFallback style={{ backgroundColor: user.color || '#6366f1', color: 'white' }}>
                                                    {user.name ? getInitials(user.name) : '?'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <CardTitle className="text-base font-semibold">{user.name}</CardTitle>
                                                <CardDescription className="text-xs">{percentage.toFixed(1)}% delle attività</CardDescription>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="text-center p-3 bg-primary/10 rounded-lg">
                                                    <div className="text-2xl font-bold text-primary">{count}</div>
                                                    <div className="text-xs text-muted-foreground">Attività</div>
                                                </div>
                                                <div className="text-center p-3 bg-muted/50 rounded-lg">
                                                    <div className="text-2xl font-bold">{formatNumber(hours)}h</div>
                                                    <div className="text-xs text-muted-foreground">Ore totali</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span>Media:</span>
                                                <Badge variant="outline" className="font-mono">
                                                    {count > 0 ? formatNumber(hours / count) : 0}h/attività
                                                </Badge>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
                            <div className="p-3 bg-muted rounded-full">
                                <ClipboardList className="h-6 w-6 opacity-50" />
                            </div>
                            <p className="text-sm">Nessuna attività calendario registrata.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="glass-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><FilePieChart /> Task per Stato</CardTitle>
                        <CardDescription>Distribuzione di tutti i task per stato.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={350}>
                            <DynamicBarChart data={taskStatusDistribution} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" allowDecimals={false} />
                                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} interval={0} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsla(var(--accent-foreground), 0.1)' }} />
                                <Bar dataKey="Task" name="Task" radius={[0, 4, 4, 0]}>
                                    {taskStatusDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={TASK_STATUS_COLORS[entry.name] || '#8884d8'} />
                                    ))}
                                </Bar>
                            </DynamicBarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card className="glass-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Target /> Task Attivi per Priorità</CardTitle>
                        <CardDescription>Conteggio dei task non conclusi per priorità.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={350}>
                            <DynamicBarChart data={tasksByPriority} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="Task Attivi" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </DynamicBarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="glass-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><AlertTriangle /> Task Scaduti</CardTitle>
                        <CardDescription>Task non ancora completati.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Task</TableHead>
                                        <TableHead>Assegnato</TableHead>
                                        <TableHead>Scaduto da</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {overdueTasks.slice(0, 5).map(task => (
                                        <TableRow key={task.id} className="bg-destructive/10">
                                            <TableCell className="font-medium">{task.title}</TableCell>
                                            <TableCell>{usersById[task.assignedUserId || '']?.name.split(' ')[0] || 'N/A'}</TableCell>
                                            <TableCell className="font-bold text-destructive">{differenceInDays(new Date(), parseISO(task.dueDate!))}gg</TableCell>
                                        </TableRow>
                                    ))}
                                    {overdueTasks.length === 0 && (
                                        <TableRow><TableCell colSpan={3} className="text-center h-24">Nessun task scaduto.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Activity /> Riepilogo Attività Calendario</CardTitle>
                        <CardDescription>Tempo registrato nelle attività del calendario per utente.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Utente</TableHead>
                                        <TableHead>N. Attività</TableHead>
                                        <TableHead className="text-right">Ore Registrate</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {calendarActivityByUser.map(({ user, hours, count }) => (
                                        <TableRow key={user.id}>
                                            <TableCell className="font-medium">{user.name}</TableCell>
                                            <TableCell>{count}</TableCell>
                                            <TableCell className="text-right font-mono">{formatNumber(hours)}h</TableCell>
                                        </TableRow>
                                    ))}
                                    {calendarActivityByUser.length === 0 && (
                                        <TableRow><TableCell colSpan={3} className="h-24 text-center">Nessuna attività registrata.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Building2 /> Attività Calendario per Cliente</CardTitle>
                        <CardDescription>Tempo registrato nelle attività del calendario diviso per cliente.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>N. Attività</TableHead>
                                        <TableHead>Ore</TableHead>
                                        <TableHead className="text-right">Costo Stimato</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {calendarActivityByClient.map(({ clientId, client, hours, count, cost }: any) => (
                                        <TableRow key={clientId}>
                                            <TableCell className="font-medium">{client?.name || 'Senza Cliente'}</TableCell>
                                            <TableCell>{count}</TableCell>
                                            <TableCell className="font-mono">{formatNumber(hours)}h</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(cost)}</TableCell>
                                        </TableRow>
                                    ))}
                                    {calendarActivityByClient.length === 0 && (
                                        <TableRow><TableCell colSpan={4} className="h-24 text-center">Nessuna attività registrata.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><GanttChart /> Ore Stimate vs. Ore Effettive per Utente</CardTitle>
                        <CardDescription>Confronto tra le ore pianificate e quelle effettivamente lavorate per utente.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <DynamicBarChart data={userPerformanceData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis allowDecimals={false} unit="h" />
                                <Tooltip content={<CustomTooltip formatter={(val) => `${val}h`} />} />
                                <Legend />
                                <Bar dataKey="estimatedHours" name="Ore Stimate" fill="hsl(var(--primary))" opacity={0.6} radius={[4, 4, 0, 0]} />
                                <Bar dataKey="hours" name="Ore Effettive" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                            </DynamicBarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><CalendarClock /> Previsione Carico di Lavoro</CardTitle>
                        <CardDescription>Ore stimate per i prossimi 7 giorni.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Utente</TableHead>
                                        {sevenDayHeaders.map(day => <TableHead key={day} className="text-center">{day}</TableHead>)}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {futureWorkloadData.map(({ user, workload }) => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarFallback style={{ backgroundColor: user.color, color: 'white' }}>{user.name ? getInitials(user.name) : '?'}</AvatarFallback>
                                                    </Avatar>
                                                </div>
                                            </TableCell>
                                            {workload.map((hours, index) => (
                                                <TableCell key={index} className={cn("text-center font-mono", hours > 8 ? 'text-destructive font-bold' : '')}>
                                                    {hours > 0 ? hours.toFixed(1) + 'h' : '-'}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                    {futureWorkloadData.length === 0 && (
                                        <TableRow><TableCell colSpan={8} className="h-24 text-center">Nessun carico.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* NEW: Weekly Activity Heatmap & Radar Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Weekly Activity Heatmap */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5" /> Attività Settimanale
                        </CardTitle>
                        <CardDescription>Ore lavorate per giorno della settimana (totali)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <DynamicBarChart data={weeklyHeatmapData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                                <YAxis allowDecimals={false} unit="h" />
                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={{ fill: 'hsla(var(--accent-foreground), 0.1)' }}
                                />
                                <Bar dataKey="total" name="Ore Totali" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                                    {weeklyHeatmapData.map((entry, index) => {
                                        const intensity = entry.total / Math.max(...weeklyHeatmapData.map(d => d.total || 1), 1);
                                        const color = `hsl(${220 - intensity * 120}, 70%, ${65 - intensity * 25}%)`;
                                        return <Cell key={`cell-${index}`} fill={color} />;
                                    })}
                                </Bar>
                            </DynamicBarChart>
                        </ResponsiveContainer>
                        <div className="mt-4 flex items-center justify-center gap-4">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(220, 70%, 65%)' }} />
                                <span>Basso</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(160, 70%, 50%)' }} />
                                <span>Medio</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(100, 70%, 40%)' }} />
                                <span>Alto</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* User Performance Radar Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="h-5 w-5" /> Confronto Performance
                        </CardTitle>
                        <CardDescription>Confronto multi-dimensionale degli utenti (top 5)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {userRadarData.length > 0 ? (
                            <>
                                <ResponsiveContainer width="100%" height={280}>
                                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={[
                                        { subject: 'Completamento', ...Object.fromEntries(userRadarData.map(u => [u.name, u['Completamento']])) },
                                        { subject: 'Ore Lavorate', ...Object.fromEntries(userRadarData.map(u => [u.name, u['Ore Lavorate']])) },
                                        { subject: 'Puntualità', ...Object.fromEntries(userRadarData.map(u => [u.name, u['Puntualità']])) },
                                        { subject: 'Task Totali', ...Object.fromEntries(userRadarData.map(u => [u.name, u['Task Totali']])) },
                                        { subject: 'Produttività', ...Object.fromEntries(userRadarData.map(u => [u.name, u['Produttività']])) },
                                    ]}>
                                        <PolarGrid />
                                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8 }} />
                                        {userRadarData.map((user, index) => (
                                            <Radar
                                                key={user.name}
                                                name={user.fullName}
                                                dataKey={user.name}
                                                stroke={user.color}
                                                fill={user.color}
                                                fillOpacity={0.2}
                                            />
                                        ))}
                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
                                <div className="p-3 bg-muted rounded-full">
                                    <Target className="h-6 w-6 opacity-50" />
                                </div>
                                <p className="text-sm">Nessun dato disponibile.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ===== NEW: Client Profitability Dashboard ===== */}
            {visibleWidgets.includes('chart_client_profitability') && clientProfitability.length > 0 && (
                <Card className="border-green-200 dark:border-green-800">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Euro className="h-5 w-5 text-green-600" />
                            💰 Redditività Clienti
                        </CardTitle>
                        <CardDescription>Analisi budget vs costi effettivi per cliente</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={clientProfitability.slice(0, 8)} layout="vertical" margin={{ left: 100 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" tickFormatter={(v) => `€${v.toLocaleString('it-IT')}`} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={95} />
                                <Tooltip
                                    formatter={(value: number, name: string) => [
                                        `€${value.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
                                        name
                                    ]}
                                />
                                <Legend />
                                <Bar dataKey="budget" name="Budget" fill="#10b981" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="costs" name="Costi" fill="#ef4444" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>

                        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                            {clientProfitability.slice(0, 4).map((client) => (
                                <div key={client.clientId} className={cn(
                                    "p-3 rounded-lg border",
                                    client.profitMargin >= 30 ? "bg-green-50 dark:bg-green-950/20 border-green-200" :
                                        client.profitMargin >= 0 ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200" :
                                            "bg-red-50 dark:bg-red-950/20 border-red-200"
                                )}>
                                    <p className="font-medium text-sm truncate">{client.name}</p>
                                    <p className={cn(
                                        "text-lg font-bold",
                                        client.profit >= 0 ? "text-green-600" : "text-red-600"
                                    )}>
                                        {client.profit >= 0 ? '+' : ''}€{client.profit.toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Margine: {client.profitMargin.toFixed(1)}%
                                    </p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ===== NEW: Predictive Delivery Analytics ===== */}
            {visibleWidgets.includes('chart_predictive_delivery') && (
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="border-purple-200 dark:border-purple-800">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <GanttChart className="h-5 w-5 text-purple-600" />
                                🔮 Previsioni Consegne
                            </CardTitle>
                            <CardDescription>
                                Precisione stime: <span className="font-bold">{predictiveDelivery.overallAccuracy.toFixed(0)}%</span>
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Task</TableHead>
                                        <TableHead>Scadenza</TableHead>
                                        <TableHead>Previsione</TableHead>
                                        <TableHead>Rischio</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {predictiveDelivery.predictions.slice(0, 5).map((prediction) => (
                                        <TableRow key={prediction.task.id}>
                                            <TableCell className="font-medium max-w-[150px] truncate">
                                                {prediction.task.title}
                                            </TableCell>
                                            <TableCell>{format(prediction.originalDue, 'dd/MM')}</TableCell>
                                            <TableCell>
                                                {prediction.predictedDelay > 0
                                                    ? format(prediction.predictedDue, 'dd/MM')
                                                    : '✓ In tempo'
                                                }
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    prediction.risk === 'high' ? 'destructive' :
                                                        prediction.risk === 'medium' ? 'default' : 'secondary'
                                                } className="text-xs">
                                                    {prediction.risk === 'high' ? '🔴 Alto' :
                                                        prediction.risk === 'medium' ? '🟡 Medio' : '🟢 Basso'}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <Card className="border-purple-200 dark:border-purple-800">
                        <CardHeader>
                            <CardTitle>Deviazione per Tipo Attività</CardTitle>
                            <CardDescription>Quanto i tempi effettivi deviano dalle stime</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {predictiveDelivery.deviationByType.slice(0, 6).map((item) => (
                                    <div key={item.type} className="flex items-center gap-3">
                                        <div className="flex-1">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="font-medium">{item.type}</span>
                                                <span className={cn(
                                                    item.avgDeviation > 20 ? "text-red-600" :
                                                        item.avgDeviation > 0 ? "text-amber-600" :
                                                            "text-green-600"
                                                )}>
                                                    {item.avgDeviation > 0 ? '+' : ''}{item.avgDeviation.toFixed(0)}%
                                                </span>
                                            </div>
                                            <Progress
                                                value={item.accuracyRate}
                                                className={cn(
                                                    item.accuracyRate >= 80 ? "[&>div]:bg-green-500" :
                                                        item.accuracyRate >= 60 ? "[&>div]:bg-amber-500" :
                                                            "[&>div]:bg-red-500"
                                                )}
                                            />
                                        </div>
                                        <span className="text-xs text-muted-foreground w-12 text-right">
                                            {item.samples} task
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ===== NEW: Efficiency Trends ===== */}
            {visibleWidgets.includes('chart_efficiency_trends') && efficiencyTrends.length > 0 && (
                <Card className="border-blue-200 dark:border-blue-800">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                            📈 Trend Efficienza Mensile
                        </CardTitle>
                        <CardDescription>Rapporto tempo stimato vs tempo effettivo negli ultimi mesi</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={efficiencyTrends} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis domain={[0, 150]} tickFormatter={(v) => `${v}%`} />
                                <Tooltip
                                    formatter={(value: number, name: string) => [
                                        name === 'efficiency' ? `${value}%` : value,
                                        name === 'efficiency' ? 'Efficienza' :
                                            name === 'tasksCompleted' ? 'Task Completati' : name
                                    ]}
                                />
                                <Legend />
                                <ReferenceLine y={100} stroke="#10b981" strokeDasharray="5 5" label="Target" />
                                <Line
                                    type="monotone"
                                    dataKey="efficiency"
                                    name="Efficienza %"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    dot={{ fill: '#3b82f6', r: 5 }}
                                    activeDot={{ r: 8 }}
                                />
                                <Bar dataKey="tasksCompleted" name="Task Completati" fill="#e2e8f0" />
                            </LineChart>
                        </ResponsiveContainer>

                        <div className="mt-4 flex justify-center gap-8">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-blue-600">
                                    {efficiencyTrends.length > 0
                                        ? Math.round(efficiencyTrends.reduce((sum, d) => sum + d.efficiency, 0) / efficiencyTrends.length)
                                        : 0}%
                                </p>
                                <p className="text-xs text-muted-foreground">Media Efficienza</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-green-600">
                                    {efficiencyTrends.reduce((sum, d) => sum + d.tasksCompleted, 0)}
                                </p>
                                <p className="text-xs text-muted-foreground">Task Totali</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-amber-600">
                                    {efficiencyTrends.length > 0
                                        ? Math.round(efficiencyTrends.reduce((sum, d) => sum + d.estimated, 0) / 60)
                                        : 0}h
                                </p>
                                <p className="text-xs text-muted-foreground">Ore Stimate</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ===== Gamification Leaderboard ===== */}
            {visibleWidgets.includes('gamification_leaderboard') && gamificationLeaderboard.length > 0 && (
                <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-amber-500" />
                            🏆 Classifica Team
                        </CardTitle>
                        <CardDescription>
                            Performance del team basata su task completati, ore lavorate e puntualità
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Leaderboard
                            users={gamificationLeaderboard}
                            currentUserId={currentUser?.id}
                            limit={10}
                        />

                        {/* Stats summary */}
                        <div className="mt-6 pt-4 border-t grid grid-cols-3 gap-4">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-amber-600">
                                    {gamificationLeaderboard.reduce((sum, u) => sum + u.xp, 0).toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">XP Totale Team</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-orange-600">
                                    {Math.round(gamificationLeaderboard.reduce((sum, u) => sum + u.level, 0) / gamificationLeaderboard.length * 10) / 10}
                                </p>
                                <p className="text-xs text-muted-foreground">Livello Medio</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-red-500">
                                    {gamificationLeaderboard.reduce((sum, u) => sum + u.streak, 0)}
                                </p>
                                <p className="text-xs text-muted-foreground">🔥 Streak Totali</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div >
    );
}
