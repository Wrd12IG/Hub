'use client';
import { useMemo, useState, useEffect } from 'react';
import { useLayoutData } from '@/app/(app)/layout-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { isPast, parseISO, formatDistanceToNow, format, isWithinInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import { AlertTriangle, Briefcase, CheckCircle, Clock, Calendar as CalendarIcon, TrendingUp, Zap, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { Calendar } from '@/components/ui/calendar';
import type { Project } from '@/lib/data';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedCard, AnimatedKPICard } from '@/components/ui/animated-card';
import { AnimatedCounter, AnimatedPercentage, AnimatedHours } from '@/components/ui/animated-counter';
import { DashboardSkeleton, SkeletonKPICard, SkeletonChartCard, SkeletonTableCard, SkeletonCalendarCard, SkeletonQuickActionsCard } from '@/components/ui/skeleton-card';
import { DeadlineCountdownWidget } from '@/components/dashboard/deadline-countdown';
import { WeatherWidget } from '@/components/dashboard/weather-widget';
import { UpcomingBirthdaysWidget } from '@/components/birthday-celebration';

const WIDGETS = [
  { id: 'kpi_active_tasks', label: 'KPI: Task Attivi', icon: '📋' },
  { id: 'kpi_overdue_tasks', label: 'KPI: Task Scaduti', icon: '⚠️' },
  { id: 'kpi_active_projects', label: 'KPI: Progetti Attivi', icon: '📁' },
  { id: 'kpi_completed_tasks', label: 'KPI: Task Completati', icon: '✅' },
  { id: 'kpi_hours_this_week', label: 'KPI: Ore Questa Settimana', icon: '⏱️' },
  { id: 'kpi_efficiency', label: 'KPI: Efficienza Tempo', icon: '📊' },
  { id: 'chart_work_summary', label: 'Grafico: Riepilogo Lavoro', icon: '📈' },
  { id: 'list_deadlines', label: 'Lista: Prossime Scadenze', icon: '📅' },
  { id: 'calendar_personal', label: 'Calendario Personale', icon: '🗓️' },
  { id: 'quick_actions', label: 'Azioni Rapide', icon: '⚡' },
  { id: 'recent_notifications', label: 'Notifiche Recenti', icon: '🔔' },
];

// Animated chart component wrapper
function AnimatedBarChart({ data }: { data: any[] }) {
  const [isVisible, setIsVisible] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);

  useEffect(() => {
    // Start animation after a small delay
    const timer = setTimeout(() => {
      setIsVisible(true);

      // Animate from 0 to 1 over 1 second
      const duration = 1000;
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

        setAnimationProgress(easeProgress);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  // Apply animation progress to data values
  const animatedData = data.map(item => ({
    ...item,
    'Ore Stimate': item['Ore Stimate'] * animationProgress,
    'Ore Effettive': item['Ore Effettive'] * animationProgress
  }));

  return (
    <div className={cn(
      "transition-opacity duration-500",
      isVisible ? "opacity-100" : "opacity-0"
    )}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={animatedData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis unit="h" allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
            formatter={(value: number) => `${value.toFixed(1)}h`}
          />
          <Legend />
          <Bar
            dataKey="Ore Stimate"
            fill="hsl(var(--secondary-foreground))"
            opacity={0.6}
            radius={[4, 4, 0, 0]}
            animationDuration={0}
          />
          <Bar
            dataKey="Ore Effettive"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
            animationDuration={0}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function UserDashboard() {
  const { currentUser, allTasks, allProjects, usersById, absences, isLoadingLayout } = useLayoutData();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [visibleWidgets, setVisibleWidgets] = useState<string[]>(WIDGETS.map(w => w.id));
  const [isLoaded, setIsLoaded] = useState(false);

  // Widget disponibili per questo utente (filtrati dall'admin)
  const availableWidgets = useMemo(() => {
    // Se l'admin ha configurato i widget per l'utente, usa quelli come base
    if (currentUser?.visibleDashboardWidgets && currentUser.visibleDashboardWidgets.length > 0) {
      return WIDGETS.filter(w => currentUser.visibleDashboardWidgets!.includes(w.id));
    }
    // Altrimenti tutti i widget sono disponibili
    return WIDGETS;
  }, [currentUser?.visibleDashboardWidgets]);

  // Load visibility settings from local storage (per personalizzazione utente)
  useEffect(() => {
    const saved = localStorage.getItem('user_dashboard_widgets');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Filtra solo i widget che l'admin ha permesso
        const allowedWidgetIds = availableWidgets.map(w => w.id);
        const filtered = parsed.filter((id: string) => allowedWidgetIds.includes(id));
        setVisibleWidgets(filtered.length > 0 ? filtered : allowedWidgetIds);
      } catch (e) {
        console.error("Failed to parse dashboard settings", e);
        setVisibleWidgets(availableWidgets.map(w => w.id));
      }
    } else {
      // Default: mostra tutti i widget disponibili
      setVisibleWidgets(availableWidgets.map(w => w.id));
    }
    setIsLoaded(true);
  }, [availableWidgets]);

  const toggleWidget = (widgetId: string) => {
    // Verifica che il widget sia tra quelli permessi dall'admin
    if (!availableWidgets.some(w => w.id === widgetId)) return;

    setVisibleWidgets(prev => {
      const newWidgets = prev.includes(widgetId)
        ? prev.filter(id => id !== widgetId)
        : [...prev, widgetId];
      localStorage.setItem('user_dashboard_widgets', JSON.stringify(newWidgets));
      return newWidgets;
    });
  };

  const isWidgetVisible = (id: string) => visibleWidgets.includes(id) && availableWidgets.some(w => w.id === id);

  const userTasks = useMemo(() => {
    if (!currentUser) return [];
    return allTasks.filter(task => task.assignedUserId === currentUser.id);
  }, [allTasks, currentUser]);

  const userAbsences = useMemo(() => {
    if (!currentUser) return [];
    return absences.filter(absence => absence.userId === currentUser.id && absence.status === 'Approvato');
  }, [absences, currentUser]);

  const userProjects = useMemo(() => {
    if (!currentUser) return [];

    // Get unique project IDs from user's tasks
    const projectIdsFromTasks = new Set(userTasks.map(task => task.projectId).filter(Boolean));

    // Get projects where the user is a team leader
    allProjects.forEach(project => {
      if (project.teamLeaderId === currentUser.id) {
        projectIdsFromTasks.add(project.id);
      }
    });

    return Array.from(projectIdsFromTasks).map(id => allProjects.find(p => p.id === id)).filter(Boolean) as Project[];

  }, [allProjects, userTasks, currentUser]);


  const kpis = useMemo(() => {
    const activeTasks = userTasks.filter(t => t.status !== 'Approvato' && t.status !== 'Annullato');
    const overdueTasks = activeTasks.filter(t => t.dueDate && isPast(parseISO(t.dueDate)));
    const completedTasks = userTasks.filter(t => t.status === 'Approvato');

    // Ore questa settimana (ultimi 7 giorni)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const hoursThisWeek = userTasks
      .filter(t => t.updatedAt && new Date(t.updatedAt) >= weekAgo)
      .reduce((sum, t) => sum + ((t.timeSpent || 0) / 3600), 0);

    // Efficienza: rapporto tempo stimato / tempo effettivo (solo per task completati con dati)
    const tasksWithBothTimes = completedTasks.filter(t =>
      t.estimatedDuration && t.estimatedDuration > 0 &&
      t.timeSpent && t.timeSpent > 0
    );
    const totalEstimated = tasksWithBothTimes.reduce((sum, t) => sum + (t.estimatedDuration || 0), 0);
    const totalActual = tasksWithBothTimes.reduce((sum, t) => sum + ((t.timeSpent || 0) / 60), 0);
    const efficiency = totalActual > 0 ? Math.round((totalEstimated / totalActual) * 100) : 100;

    return {
      activeTasks: activeTasks.length,
      overdueTasks: overdueTasks.length,
      completedTasks: completedTasks.length,
      activeProjects: userProjects.filter(p => p.status === 'In Corso').length,
      hoursThisWeek: hoursThisWeek,
      efficiency,
    };
  }, [userTasks, userProjects]);

  const upcomingDeadlines = useMemo(() => {
    return userTasks
      .filter(t => t.dueDate && t.status !== 'Approvato' && t.status !== 'Annullato' && !isPast(parseISO(t.dueDate)))
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 5);
  }, [userTasks]);

  const workSummaryData = useMemo(() => {
    const dataByProject: { [key: string]: { name: string; 'Ore Stimate': number; 'Ore Effettive': number } } = {};

    userTasks.forEach(task => {
      const projectName = allProjects.find(p => p.id === task.projectId)?.name || 'Task non assegnati';
      if (!dataByProject[projectName]) {
        dataByProject[projectName] = { name: projectName, 'Ore Stimate': 0, 'Ore Effettive': 0 };
      }
      dataByProject[projectName]['Ore Stimate'] += (task.estimatedDuration || 0) / 60; // to hours
      dataByProject[projectName]['Ore Effettive'] += (task.timeSpent || 0) / 3600; // to hours
    });

    return Object.values(dataByProject).map(p => ({
      ...p,
      'Ore Stimate': parseFloat(p['Ore Stimate'].toFixed(1)),
      'Ore Effettive': parseFloat(p['Ore Effettive'].toFixed(1)),
    })).filter(p => p['Ore Stimate'] > 0 || p['Ore Effettive'] > 0);

  }, [userTasks, allProjects]);


  const taskDeadlines = useMemo(() => userTasks.filter(t => t.dueDate).map(t => parseISO(t.dueDate!)), [userTasks]);
  const absenceDays = useMemo(() =>
    userAbsences.flatMap(a => {
      const interval = { start: parseISO(a.startDate), end: parseISO(a.endDate) };
      // This is simplified. For multi-day absences, you'd generate all days in between.
      return [interval.start, interval.end];
    }), [userAbsences]);

  // Show premium skeleton loader while loading
  if (isLoadingLayout || !isLoaded) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Animated Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold font-headline bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Ciao, {currentUser?.name.split(' ')[0]}! 👋
          </h1>
          <p className="text-muted-foreground">Ecco un riepilogo delle tue attività e dei tuoi progetti.</p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 hover:shadow-md transition-all">
              <Settings2 className="h-4 w-4" />
              Personalizza
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Personalizza Dashboard</DialogTitle>
              <DialogDescription>
                Scegli quali elementi visualizzare nella tua dashboard.
                {currentUser?.visibleDashboardWidgets && currentUser.visibleDashboardWidgets.length > 0 && (
                  <span className="block mt-1 text-xs text-muted-foreground">
                    ℹ️ Alcuni widget sono stati configurati dall'amministratore.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {availableWidgets.map(widget => (
                <div key={widget.id} className="flex items-center justify-between space-x-2">
                  <Label htmlFor={widget.id} className="flex-1 font-medium">{widget.label}</Label>
                  <Switch
                    id={widget.id}
                    checked={visibleWidgets.includes(widget.id)}
                    onCheckedChange={() => toggleWidget(widget.id)}
                  />
                </div>
              ))}
              {availableWidgets.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nessun widget disponibile.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Nuovi Widget Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in">
        <DeadlineCountdownWidget
          tasks={userTasks}
          onTaskClick={(taskId) => window.location.href = `/tasks?taskId=${taskId}`}
        />

        <UpcomingBirthdaysWidget users={Object.values(usersById)} />

        <WeatherWidget city="Milano" />
      </div>

      {/* KPI Section with Animated Cards */}
      <div className="flex flex-wrap gap-4">
        {isWidgetVisible('kpi_active_tasks') && (
          <AnimatedKPICard
            title="Task Attivi"
            value={kpis.activeTasks}
            icon={<Clock className="h-4 w-4" />}
            delay={0}
            className="flex-1 min-w-[200px]"
          />
        )}

        {isWidgetVisible('kpi_overdue_tasks') && (
          <AnimatedKPICard
            title="Task Scaduti"
            value={kpis.overdueTasks}
            icon={<AlertTriangle className="h-4 w-4" />}
            delay={50}
            variant={kpis.overdueTasks > 0 ? "danger" : "default"}
            className="flex-1 min-w-[200px]"
          />
        )}

        {isWidgetVisible('kpi_active_projects') && (
          <AnimatedKPICard
            title="Progetti Attivi"
            value={kpis.activeProjects}
            icon={<Briefcase className="h-4 w-4" />}
            delay={100}
            className="flex-1 min-w-[200px]"
          />
        )}

        {isWidgetVisible('kpi_completed_tasks') && (
          <AnimatedKPICard
            title="Task Completati"
            value={kpis.completedTasks}
            icon={<CheckCircle className="h-4 w-4" />}
            delay={150}
            variant="success"
            className="flex-1 min-w-[200px]"
          />
        )}

        {isWidgetVisible('kpi_hours_this_week') && (
          <AnimatedKPICard
            title="Ore Questa Settimana"
            value={kpis.hoursThisWeek}
            suffix="h"
            formatValue={(v) => v.toFixed(1)}
            icon={<TrendingUp className="h-4 w-4" />}
            description="Ultimi 7 giorni"
            delay={200}
            variant="primary"
            className="flex-1 min-w-[200px]"
          />
        )}

        {isWidgetVisible('kpi_efficiency') && (
          <AnimatedKPICard
            title="Efficienza Tempo"
            value={kpis.efficiency}
            suffix="%"
            icon={<BarChart3 className="h-4 w-4" />}
            description={
              kpis.efficiency >= 100 ? "🎯 Sotto budget" :
                kpis.efficiency >= 80 ? "⚠️ Nella media" :
                  "⏰ Sopra budget"
            }
            delay={250}
            variant={
              kpis.efficiency >= 100 ? "success" :
                kpis.efficiency >= 80 ? "warning" :
                  "danger"
            }
            className="flex-1 min-w-[200px]"
          />
        )}
      </div>

      {/* Charts and Deadlines with Animated Cards */}
      <div className={cn(
        "grid gap-6",
        isWidgetVisible('chart_work_summary') && isWidgetVisible('list_deadlines') ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"
      )}>
        {isWidgetVisible('chart_work_summary') && (
          <AnimatedCard
            delay={300}
            className={cn(isWidgetVisible('list_deadlines') ? "lg:col-span-2" : "col-span-1")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="animate-float">📈</span>
                Riepilogo Lavoro
              </CardTitle>
              <CardDescription>Confronto tra ore stimate e ore effettive per progetto.</CardDescription>
            </CardHeader>
            <CardContent>
              <AnimatedBarChart data={workSummaryData} />
            </CardContent>
          </AnimatedCard>
        )}

        {isWidgetVisible('list_deadlines') && (
          <AnimatedCard delay={350}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="animate-float">📅</span>
                Prossime Scadenze
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {upcomingDeadlines.map((task, index) => (
                    <TableRow
                      key={task.id}
                      className="group transition-colors hover:bg-muted/50"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <TableCell>
                        <Link href={`/tasks?taskId=${task.id}`} className="font-medium hover:underline block truncate group-hover:text-primary transition-colors">
                          {task.title}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {task.dueDate && formatDistanceToNow(parseISO(task.dueDate), { addSuffix: true, locale: it })}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {upcomingDeadlines.length === 0 && (
                    <TableRow>
                      <TableCell className="h-24 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <span className="text-3xl">🎉</span>
                          <span>Nessuna scadenza imminente. Ottimo lavoro!</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </AnimatedCard>
        )}
      </div>

      {isWidgetVisible('calendar_personal') && (
        <AnimatedCard delay={400}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="animate-float">🗓️</span>
              Calendario Personale
            </CardTitle>
            <CardDescription>Riepilogo delle tue scadenze e assenze.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="p-0"
              locale={it}
              modifiers={{
                taskDeadline: taskDeadlines,
                absence: absenceDays,
              }}
              modifiersStyles={{
                taskDeadline: {
                  color: 'hsl(var(--primary-foreground))',
                  backgroundColor: 'hsl(var(--primary))',
                  opacity: 0.8,
                },
                absence: {
                  color: 'hsl(var(--destructive-foreground))',
                  backgroundColor: 'hsl(var(--destructive))',
                  opacity: 0.8,
                }
              }}
            />
          </CardContent>
        </AnimatedCard>
      )}

      {/* Quick Actions Widget - Animated */}
      {isWidgetVisible('quick_actions') && (
        <AnimatedCard
          delay={450}
          className="bg-gradient-to-br from-accent/10 to-accent/20 border-accent/30"
        >
          <CardHeader>
            <CardTitle className="text-accent-foreground flex items-center gap-2">
              <span className="animate-float">⚡</span> Azioni Rapide
            </CardTitle>
            <CardDescription>Accedi velocemente alle funzioni più usate</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Link href="/tasks?new=true">
              <Button variant="outline" className="w-full justify-start gap-2 h-12 hover:bg-accent/20 border-accent/30 hover:scale-[1.02] transition-all">
                <span className="text-lg">📋</span>
                <span>Nuovo Task</span>
              </Button>
            </Link>
            <Link href="/projects?new=true">
              <Button variant="outline" className="w-full justify-start gap-2 h-12 hover:bg-accent/20 border-accent/30 hover:scale-[1.02] transition-all">
                <span className="text-lg">📁</span>
                <span>Nuovo Progetto</span>
              </Button>
            </Link>
            <Link href="/calendar">
              <Button variant="outline" className="w-full justify-start gap-2 h-12 hover:bg-accent/20 border-accent/30 hover:scale-[1.02] transition-all">
                <span className="text-lg">🗓️</span>
                <span>Calendario</span>
              </Button>
            </Link>
            <Link href="/briefs?new=true">
              <Button variant="outline" className="w-full justify-start gap-2 h-12 hover:bg-accent/20 border-accent/30 hover:scale-[1.02] transition-all">
                <span className="text-lg">📝</span>
                <span>Nuovo Brief</span>
              </Button>
            </Link>
          </CardContent>
        </AnimatedCard>
      )}

      {/* Recent Notifications Widget - Animated */}
      {isWidgetVisible('recent_notifications') && (
        <AnimatedCard delay={500}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="animate-float">🔔</span> Notifiche Recenti
            </CardTitle>
            <CardDescription>Ultime attività che ti riguardano</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {upcomingDeadlines.length > 0 ? (
                upcomingDeadlines.slice(0, 3).map((task, index) => (
                  <Link key={task.id} href={`/tasks?taskId=${task.id}`}>
                    <div
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-all cursor-pointer hover:scale-[1.01] group"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        📅
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate group-hover:text-primary transition-colors">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Scade {task.dueDate && formatDistanceToNow(parseISO(task.dueDate), { addSuffix: true, locale: it })}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground animate-fade-in">
                  <span className="text-4xl mb-3 block animate-float">✨</span>
                  <p className="font-medium">Nessuna scadenza imminente</p>
                  <p className="text-xs mt-1">Continua così!</p>
                </div>
              )}
              {upcomingDeadlines.length > 3 && (
                <Link href="/tasks">
                  <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground group">
                    <span>Vedi tutti i task ({kpis.activeTasks})</span>
                    <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </AnimatedCard>
      )}
    </div>
  );
}
