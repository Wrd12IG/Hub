'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useLayoutData } from '@/app/(app)/layout-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Clock,
    CheckCircle2,
    FileText,
    Download,
    Instagram,
    Facebook,
    Linkedin,
    BarChart2,
    Calendar,
    Layers,
    TrendingUp,
    Loader2,
    AlertCircle,
} from 'lucide-react';
import {
    format,
    parseISO,
    startOfMonth,
    endOfMonth,
    isWithinInterval,
    subMonths,
    differenceInSeconds,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { getEditorialContents } from '@/lib/actions';
import type { EditorialContent } from '@/lib/data';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

interface Props {
    clientId: string;
    clientName: string;
}

const formatHours = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return `${h}h ${m}m`;
};

const MONTH_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
    '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#06b6d4', '#3b82f6', '#a78bfa', '#f472b6',
];

// Build list of last 12 months
function buildMonthOptions(): { value: string; label: string }[] {
    const options: { value: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
        const d = subMonths(new Date(), i);
        options.push({
            value: format(d, 'yyyy-MM'),
            label: format(d, 'MMMM yyyy', { locale: it }),
        });
    }
    return options;
}

export default function ClientMonthlyReport({ clientId, clientName }: Props) {
    const {
        allTasks,
        allProjects,
        calendarActivities,
        calendarActivityPresets,
        activityTypes,
        usersById,
        projectsById,
        isLoadingLayout,
    } = useLayoutData();

    const monthOptions = useMemo(() => buildMonthOptions(), []);
    const [selectedMonth, setSelectedMonth] = useState<string>(monthOptions[0].value);
    const [editorialContents, setEditorialContents] = useState<EditorialContent[]>([]);
    const [loadingEditorial, setLoadingEditorial] = useState(true);
    const [exportingPdf, setExportingPdf] = useState(false);

    // Load editorial contents once
    useEffect(() => {
        setLoadingEditorial(true);
        getEditorialContents()
            .then(setEditorialContents)
            .catch(() => setEditorialContents([]))
            .finally(() => setLoadingEditorial(false));
    }, []);

    // Compute date interval for selected month
    const { monthStart, monthEnd } = useMemo(() => {
        const base = parseISO(`${selectedMonth}-01`);
        return { monthStart: startOfMonth(base), monthEnd: endOfMonth(base) };
    }, [selectedMonth]);

    // Activity types map by name
    const activityTypesByName = useMemo(
        () =>
            activityTypes.reduce(
                (acc, at) => ({ ...acc, [at.name]: at }),
                {} as Record<string, typeof activityTypes[0]>,
            ),
        [activityTypes],
    );

    // Preset map by id
    const presetsById = useMemo(
        () =>
            calendarActivityPresets.reduce(
                (acc, p) => ({ ...acc, [p.id]: p }),
                {} as Record<string, typeof calendarActivityPresets[0]>,
            ),
        [calendarActivityPresets],
    );

    // --- TASKS for this client in this month ---
    const clientTasks = useMemo(() => {
        return allTasks.filter((t) => {
            if (t.clientId !== clientId) return false;
            const dateStr = t.dueDate ?? t.updatedAt;
            if (!dateStr) return false;
            try {
                const d = parseISO(dateStr as string);
                return isWithinInterval(d, { start: monthStart, end: monthEnd });
            } catch {
                return false;
            }
        });
    }, [allTasks, clientId, monthStart, monthEnd]);

    const completedTasks = useMemo(
        () => clientTasks.filter((t) => t.status === 'Approvato'),
        [clientTasks],
    );

    const totalTimeSpent = useMemo(
        () => clientTasks.reduce((sum, t) => sum + (t.timeSpent || 0), 0),
        [clientTasks],
    );

    // Breakdown by project
    const projectBreakdown = useMemo(() => {
        const map: Record<string, { name: string; seconds: number; taskCount: number }> = {};
        clientTasks.forEach((t) => {
            const key = t.projectId ?? 'no-project';
            if (!map[key]) {
                const pName = t.projectId
                    ? (projectsById[t.projectId]?.name ?? 'Progetto sconosciuto')
                    : 'Senza Progetto';
                map[key] = { name: pName, seconds: 0, taskCount: 0 };
            }
            map[key].seconds += t.timeSpent || 0;
            map[key].taskCount += 1;
        });
        return Object.values(map).sort((a, b) => b.seconds - a.seconds);
    }, [clientTasks, projectsById]);

    // Breakdown by activity type
    const activityBreakdown = useMemo(() => {
        const map: Record<string, { name: string; seconds: number }> = {};
        clientTasks.forEach((t) => {
            const key = t.activityType ?? 'Altro';
            if (!map[key]) map[key] = { name: key, seconds: 0 };
            map[key].seconds += t.timeSpent || 0;
        });
        return Object.values(map).sort((a, b) => b.seconds - a.seconds);
    }, [clientTasks]);

    // --- CALENDAR ACTIVITIES for this client in this month ---
    const clientCalendarSeconds = useMemo(() => {
        let total = 0;
        calendarActivities.forEach((a) => {
            const start = a.startTime ?? a.start;
            const end = a.endTime ?? a.end;
            if (!start || !end) return;
            const clientIds: string[] = a.clientIds ?? (a.clientId ? [a.clientId] : []);
            if (!clientIds.includes(clientId)) return;
            try {
                const sd = parseISO(start);
                if (!isWithinInterval(sd, { start: monthStart, end: monthEnd })) return;
                const secs = differenceInSeconds(parseISO(end), sd);
                if (secs > 0) total += secs / (clientIds.length || 1);
            } catch {
                // ignore
            }
        });
        return total;
    }, [calendarActivities, clientId, monthStart, monthEnd]);

    const grandTotalSeconds = totalTimeSpent + clientCalendarSeconds;

    // --- EDITORIAL CONTENTS published in this month ---
    const publishedContents = useMemo(() => {
        return editorialContents.filter((c) => {
            if (c.clientId !== clientId) return false;
            if (c.status !== 'Pubblicato') return false;
            if (!c.publicationDate) return false;
            try {
                const d = parseISO(c.publicationDate);
                return isWithinInterval(d, { start: monthStart, end: monthEnd });
            } catch {
                return false;
            }
        });
    }, [editorialContents, clientId, monthStart, monthEnd]);

    const platformCounts = useMemo(() => ({
        instagram: publishedContents.filter((c) => c.instagram).length,
        facebook: publishedContents.filter((c) => c.facebook).length,
        linkedin: publishedContents.filter((c) => c.linkedin).length,
        tiktok: publishedContents.filter((c) => c.tiktok).length,
    }), [publishedContents]);

    const contentByFormat = useMemo(() => {
        const map: Record<string, number> = {};
        publishedContents.forEach((c) => {
            const k = c.format || 'Altro';
            map[k] = (map[k] || 0) + 1;
        });
        return Object.entries(map)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [publishedContents]);

    // --- PDF EXPORT ---
    const exportPdf = useCallback(async () => {
        setExportingPdf(true);
        try {
            const { jsPDF } = await import('jspdf');
            const autoTable = (await import('jspdf-autotable')).default;
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

            const monthLabel =
                monthOptions.find((m) => m.value === selectedMonth)?.label ?? selectedMonth;

            // ---- Header ----
            doc.setFillColor(99, 102, 241); // indigo-500
            doc.rect(0, 0, 210, 32, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('Report Mensile Cliente', 14, 14);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.text(`${clientName} — ${monthLabel}`, 14, 22);
            doc.setFontSize(9);
            doc.text(`Generato il ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 29);

            let y = 42;

            // ---- KPI RIEPILOGO ----
            doc.setTextColor(40, 40, 40);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Riepilogo Attività', 14, y);
            y += 6;

            const kpiData = [
                ['Ore Totali Lavorate', formatHours(grandTotalSeconds)],
                ['Task nel Mese', String(clientTasks.length)],
                ['Task Completati', String(completedTasks.length)],
                ['Contenuti Pubblicati', String(publishedContents.length)],
                ['Post Instagram', String(platformCounts.instagram)],
                ['Post Facebook', String(platformCounts.facebook)],
                ['Post LinkedIn', String(platformCounts.linkedin)],
            ];

            autoTable(doc, {
                head: [['KPI', 'Valore']],
                body: kpiData,
                startY: y,
                styles: { fontSize: 10, cellPadding: 3 },
                headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold' },
                columnStyles: { 1: { halign: 'center', fontStyle: 'bold' } },
                margin: { left: 14, right: 14 },
            });

            y = (doc as any).lastAutoTable?.finalY + 10 || y + 50;

            // ---- TASK TABLE ----
            if (clientTasks.length > 0) {
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text('Task del Mese', 14, y);
                y += 4;

                const taskRows = clientTasks.map((t) => [
                    t.title.substring(0, 40),
                    projectsById[t.projectId ?? '']?.name ?? '-',
                    t.activityType ?? 'Altro',
                    t.status,
                    formatHours(t.timeSpent || 0),
                ]);

                autoTable(doc, {
                    head: [['Task', 'Progetto', 'Tipo', 'Stato', 'Ore']],
                    body: taskRows,
                    startY: y,
                    styles: { fontSize: 8, cellPadding: 2 },
                    headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] },
                    margin: { left: 14, right: 14 },
                    didParseCell: (data: any) => {
                        if (data.column.index === 3 && data.section === 'body') {
                            const status = data.cell.raw as string;
                            if (status === 'Approvato') {
                                data.cell.styles.textColor = [22, 163, 74];
                                data.cell.styles.fontStyle = 'bold';
                            }
                        }
                    },
                });
                y = (doc as any).lastAutoTable?.finalY + 10 || y + 60;
            }

            // ---- CONTENUTI EDITORIALI ----
            if (publishedContents.length > 0) {
                // New page if needed
                if (y > 240) { doc.addPage(); y = 20; }

                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(40, 40, 40);
                doc.text('Contenuti Pubblicati', 14, y);
                y += 4;

                const contentRows = publishedContents.map((c) => [
                    c.publicationDate ? format(parseISO(c.publicationDate), 'dd/MM') : '-',
                    c.topic.substring(0, 40),
                    c.format ?? '-',
                    [
                        c.instagram ? 'IG' : '',
                        c.facebook ? 'FB' : '',
                        c.linkedin ? 'LN' : '',
                        c.tiktok ? 'TK' : '',
                    ].filter(Boolean).join(', '),
                ]);

                autoTable(doc, {
                    head: [['Data', 'Argomento', 'Formato', 'Piattaforme']],
                    body: contentRows,
                    startY: y,
                    styles: { fontSize: 8, cellPadding: 2 },
                    headStyles: { fillColor: [236, 72, 153], textColor: [255, 255, 255] },
                    margin: { left: 14, right: 14 },
                });
                y = (doc as any).lastAutoTable?.finalY + 10 || y + 40;
            }

            // ---- BREAKDOWN PROGETTI ----
            if (projectBreakdown.length > 0) {
                if (y > 240) { doc.addPage(); y = 20; }

                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(40, 40, 40);
                doc.text('Ore per Progetto', 14, y);
                y += 4;

                autoTable(doc, {
                    head: [['Progetto', 'Task', 'Ore']],
                    body: projectBreakdown.map((p) => [p.name, String(p.taskCount), formatHours(p.seconds)]),
                    startY: y,
                    styles: { fontSize: 9, cellPadding: 2 },
                    headStyles: { fillColor: [139, 92, 246], textColor: [255, 255, 255] },
                    margin: { left: 14, right: 14 },
                });
            }

            // ---- Footer ----
            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(
                    `W[r]Digital Marketing HUB — ${clientName} — ${monthLabel} — Pag. ${i}/${pageCount}`,
                    14,
                    287,
                );
            }

            doc.save(`Report_${clientName.replace(/\s+/g, '_')}_${selectedMonth}.pdf`);
        } catch (err) {
            console.error('[monthly-report] PDF export error:', err);
        } finally {
            setExportingPdf(false);
        }
    }, [
        clientName,
        selectedMonth,
        monthOptions,
        grandTotalSeconds,
        clientTasks,
        completedTasks,
        publishedContents,
        platformCounts,
        projectBreakdown,
        projectsById,
    ]);

    const isLoading = isLoadingLayout || loadingEditorial;
    const isEmpty =
        !isLoading &&
        clientTasks.length === 0 &&
        publishedContents.length === 0 &&
        grandTotalSeconds === 0;

    return (
        <div className="space-y-6">
            {/* ── HEADER ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <BarChart2 className="h-5 w-5 text-indigo-400" />
                        <h2 className="text-xl font-bold text-foreground">Report Mensile</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Riepilogo attività, task e contenuti pubblicati per {clientName}
                    </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-44 h-9 text-sm font-semibold rounded-xl border-white/10 bg-background/50">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {monthOptions.map((m) => (
                                <SelectItem key={m.value} value={m.value} className="text-sm">
                                    {m.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button
                        size="sm"
                        onClick={exportPdf}
                        disabled={exportingPdf || isLoading || isEmpty}
                        className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                    >
                        {exportingPdf ? (
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4 mr-1.5" />
                        )}
                        Esporta PDF
                    </Button>
                </div>
            </div>

            {/* ── LOADING ── */}
            {isLoading && (
                <div className="flex items-center justify-center py-16 text-muted-foreground gap-3">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm">Caricamento dati report...</span>
                </div>
            )}

            {/* ── EMPTY STATE ── */}
            {!isLoading && isEmpty && (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                    <AlertCircle className="h-12 w-12 text-muted-foreground/30" />
                    <p className="text-lg font-semibold text-muted-foreground">
                        Nessun dato per{' '}
                        {monthOptions.find((m) => m.value === selectedMonth)?.label ?? selectedMonth}
                    </p>
                    <p className="text-sm text-muted-foreground/60 max-w-xs">
                        Non ci sono task, ore registrate o contenuti pubblicati per questo cliente nel mese selezionato.
                    </p>
                </div>
            )}

            {!isLoading && !isEmpty && (
                <>
                    {/* ── KPI CARDS ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <KpiCard
                            icon={<Clock className="h-5 w-5 text-blue-400" />}
                            label="Ore Totali"
                            value={formatHours(grandTotalSeconds)}
                            color="blue"
                        />
                        <KpiCard
                            icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                            label="Task Completati"
                            value={`${completedTasks.length} / ${clientTasks.length}`}
                            color="emerald"
                        />
                        <KpiCard
                            icon={<FileText className="h-5 w-5 text-pink-400" />}
                            label="Contenuti Pubblicati"
                            value={String(publishedContents.length)}
                            color="pink"
                        />
                        <KpiCard
                            icon={<TrendingUp className="h-5 w-5 text-indigo-400" />}
                            label="Completamento Task"
                            value={
                                clientTasks.length > 0
                                    ? `${Math.round((completedTasks.length / clientTasks.length) * 100)}%`
                                    : '—'
                            }
                            color="indigo"
                        />
                    </div>

                    {/* ── SEZIONE TASK ── */}
                    {clientTasks.length > 0 && (
                        <Card className="bg-white/[0.02] border-white/5 shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base font-bold">
                                    <CheckCircle2 className="h-4 w-4 text-blue-400" />
                                    Task &amp; Lavoro
                                </CardTitle>
                                <CardDescription>
                                    {clientTasks.length} task nel mese —{' '}
                                    {formatHours(grandTotalSeconds)} totali registrate
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                {/* Project breakdown chart */}
                                {projectBreakdown.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                            Ore per Progetto
                                        </p>
                                        <ResponsiveContainer width="100%" height={180}>
                                            <BarChart
                                                data={projectBreakdown.map((p) => ({
                                                    name: p.name.length > 18 ? p.name.substring(0, 18) + '…' : p.name,
                                                    ore: parseFloat((p.seconds / 3600).toFixed(1)),
                                                    fullName: p.name,
                                                }))}
                                                layout="vertical"
                                                margin={{ left: 8, right: 24, top: 0, bottom: 0 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                                                <XAxis
                                                    type="number"
                                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                                    tickFormatter={(v) => `${v}h`}
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <YAxis
                                                    type="category"
                                                    dataKey="name"
                                                    width={110}
                                                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <Tooltip
                                                    content={({ active, payload }) => {
                                                        if (!active || !payload?.length) return null;
                                                        const d = payload[0].payload;
                                                        return (
                                                            <div className="bg-popover border border-border rounded-xl p-2.5 shadow-xl text-sm">
                                                                <p className="font-bold text-foreground">{d.fullName}</p>
                                                                <p className="text-muted-foreground">{d.ore}h lavorate</p>
                                                            </div>
                                                        );
                                                    }}
                                                />
                                                <Bar dataKey="ore" radius={[0, 4, 4, 0]} maxBarSize={22}>
                                                    {projectBreakdown.map((_, i) => (
                                                        <Cell
                                                            key={i}
                                                            fill={MONTH_COLORS[i % MONTH_COLORS.length]}
                                                            fillOpacity={0.85}
                                                        />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}

                                {/* Task list */}
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                        Lista Task
                                    </p>
                                    <div className="divide-y divide-white/5">
                                        {clientTasks.map((task) => (
                                            <div
                                                key={task.id}
                                                className="flex items-center justify-between py-2.5 gap-3"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div
                                                        className={cn(
                                                            'w-2 h-2 rounded-full shrink-0',
                                                            task.status === 'Approvato'
                                                                ? 'bg-emerald-400'
                                                                : task.status === 'In Lavorazione'
                                                                ? 'bg-blue-400'
                                                                : task.status === 'Annullato'
                                                                ? 'bg-red-400'
                                                                : 'bg-amber-400',
                                                        )}
                                                    />
                                                    <span className="text-sm font-medium text-foreground truncate">
                                                        {task.title}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {task.activityType && (
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/10 text-muted-foreground">
                                                            {task.activityType}
                                                        </Badge>
                                                    )}
                                                    <span className="text-xs font-mono text-muted-foreground">
                                                        {formatHours(task.timeSpent || 0)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ── SEZIONE CONTENUTI EDITORIALI ── */}
                    {publishedContents.length > 0 && (
                        <Card className="bg-white/[0.02] border-white/5 shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base font-bold">
                                    <Calendar className="h-4 w-4 text-pink-400" />
                                    Contenuti Pubblicati
                                </CardTitle>
                                <CardDescription>
                                    {publishedContents.length} contenuti pubblicati nel mese
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                {/* Platform badges */}
                                <div className="flex flex-wrap gap-3">
                                    {platformCounts.instagram > 0 && (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 text-sm font-bold">
                                            <Instagram className="h-4 w-4" />
                                            Instagram: {platformCounts.instagram}
                                        </div>
                                    )}
                                    {platformCounts.facebook > 0 && (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-bold">
                                            <Facebook className="h-4 w-4" />
                                            Facebook: {platformCounts.facebook}
                                        </div>
                                    )}
                                    {platformCounts.linkedin > 0 && (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-sm font-bold">
                                            <Linkedin className="h-4 w-4" />
                                            LinkedIn: {platformCounts.linkedin}
                                        </div>
                                    )}
                                    {platformCounts.tiktok > 0 && (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-bold">
                                            <Layers className="h-4 w-4" />
                                            TikTok: {platformCounts.tiktok}
                                        </div>
                                    )}
                                </div>

                                {/* Format breakdown */}
                                {contentByFormat.length > 1 && (
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                            Per Formato
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {contentByFormat.map((f) => (
                                                <div
                                                    key={f.name}
                                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-xs font-semibold text-foreground"
                                                >
                                                    {f.name}
                                                    <span className="text-muted-foreground">×{f.count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Content list */}
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                        Lista Contenuti
                                    </p>
                                    <div className="divide-y divide-white/5">
                                        {publishedContents.map((c) => (
                                            <div
                                                key={c.id}
                                                className="flex items-start justify-between py-2.5 gap-3"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-foreground truncate">
                                                        {c.topic}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {c.format && (
                                                            <span className="mr-2">{c.format}</span>
                                                        )}
                                                        {c.publicationDate && (
                                                            <span>
                                                                {format(parseISO(c.publicationDate), 'd MMM', { locale: it })}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex gap-1 shrink-0 mt-0.5">
                                                    {c.instagram && (
                                                        <Instagram className="h-3.5 w-3.5 text-pink-400" />
                                                    )}
                                                    {c.facebook && (
                                                        <Facebook className="h-3.5 w-3.5 text-blue-400" />
                                                    )}
                                                    {c.linkedin && (
                                                        <Linkedin className="h-3.5 w-3.5 text-sky-400" />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}

// ── KPI Card helper ──
function KpiCard({
    icon,
    label,
    value,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    color: 'blue' | 'emerald' | 'pink' | 'indigo';
}) {
    const colorMap: Record<string, string> = {
        blue: 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
        emerald: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
        pink: 'from-pink-500/10 to-pink-600/5 border-pink-500/20',
        indigo: 'from-indigo-500/10 to-indigo-600/5 border-indigo-500/20',
    };

    return (
        <Card className={cn('bg-gradient-to-br border shadow-sm', colorMap[color])}>
            <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
                        <p className="text-2xl font-black text-foreground tracking-tight">{value}</p>
                    </div>
                    <div className="opacity-60 mt-0.5">{icon}</div>
                </div>
            </CardContent>
        </Card>
    );
}
