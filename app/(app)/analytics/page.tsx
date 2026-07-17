"use client"

import React, { useState, useMemo, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  TrendingUp, Clock, Zap, Calendar, DollarSign, Target, Activity,
  RefreshCw, Users, CheckSquare,
} from 'lucide-react'
import {
  computeHourlyProductivity,
  findPeakHours,
  buildHeatmapData,
  calculateClientProfit,
  calculateProjectROI,
  forecastMonthlyBudget,
  type TimeEntry,
  type DayActivity,
  type ClientRevenueInput,
  type ProjectROIInput,
} from '@/lib/analytics-engine'
import { getTasks, getUsers, getClients, getProjects } from '@/lib/actions'
import type { Task, User, Client, Project } from '@/lib/data'

// ─── Period options ────────────────────────────────────────────────────────────
type Period = '7d' | '30d' | '90d'
const PERIOD_OPTIONS: { value: Period; label: string; days: number }[] = [
  { value: '7d', label: 'Ultima settimana', days: 7 },
  { value: '30d', label: 'Ultimo mese', days: 30 },
  { value: '90d', label: 'Ultimo trimestre', days: 90 },
]

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ height = 120, borderRadius = 12 }: { height?: number; borderRadius?: number }) {
  return (
    <div
      style={{
        height,
        borderRadius,
        background: 'linear-gradient(90deg, var(--border-color, rgba(0,0,0,0.06)) 25%, rgba(0,0,0,0.03) 50%, var(--border-color, rgba(0,0,0,0.06)) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    />
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon, label, value, sub, color, loading,
}: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string; loading?: boolean
}) {
  return (
    <div style={{
      background: 'var(--card-bg, #fff)',
      border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
      borderRadius: '16px',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: 40, height: 40, borderRadius: '12px', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} color={color} />
        </div>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      </div>
      {loading ? (
        <Skeleton height={36} borderRadius={8} />
      ) : (
        <>
          <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>{value}</p>
          {sub && <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: 0 }}>{sub}</p>}
        </>
      )}
    </div>
  )
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────
const HEATMAP_COLORS = ['#e2e8f0', '#bfdbfe', '#93c5fd', '#3b82f6', '#1d4ed8']

function ActivityHeatmap({ data, days }: { data: ReturnType<typeof buildHeatmapData>; days: number }) {
  return (
    <div>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
        Attività ultimi {days} giorni
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
        {data.map((d) => (
          <div
            key={d.date}
            title={`${d.date}: ${Math.round(d.minutes / 60 * 10) / 10}h`}
            style={{
              width: 12, height: 12, borderRadius: 2,
              background: HEATMAP_COLORS[d.level],
              cursor: 'default',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Meno</span>
        {HEATMAP_COLORS.map((c) => (
          <div key={c} style={{ width: 12, height: 12, borderRadius: 2, background: c }} />
        ))}
        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Più</span>
      </div>
    </div>
  )
}

// ─── Data aggregation helpers ─────────────────────────────────────────────────

/**
 * Convert tasks to TimeEntry array for the hourly productivity chart.
 * Tasks store `timeSpent` in minutes total but no per-hour breakdown.
 * We approximate: distribute timeSpent minutes at the hour of `updatedAt`.
 */
function tasksToTimeEntries(tasks: Task[], cutoffDate: Date): TimeEntry[] {
  const entries: TimeEntry[] = []
  for (const task of tasks) {
    if (!task.timeSpent || task.timeSpent <= 0) continue
    // Use updatedAt if available; fallback to createdAt
    const rawDate = task.updatedAt ?? task.createdAt
    if (!rawDate) continue
    const d = new Date(rawDate)
    if (d < cutoffDate) continue
    entries.push({
      userId: task.assignedUserId ?? 'unknown',
      date: d.toISOString().slice(0, 10),
      hour: d.getHours(),
      minutes: Math.min(task.timeSpent, 480), // cap at 8h to avoid outliers
    })
  }
  return entries
}

/**
 * Build DayActivity from tasks (summing timeSpent per day).
 */
function tasksToDayActivities(tasks: Task[], days: number): DayActivity[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const map = new Map<string, { totalMinutes: number; taskCount: number }>()

  for (const task of tasks) {
    const rawDate = task.updatedAt ?? task.createdAt
    if (!rawDate) continue
    const d = new Date(rawDate)
    if (d < cutoff) continue
    const dateStr = d.toISOString().slice(0, 10)
    const prev = map.get(dateStr) ?? { totalMinutes: 0, taskCount: 0 }
    map.set(dateStr, {
      totalMinutes: prev.totalMinutes + (task.timeSpent ?? 0),
      taskCount: prev.taskCount + 1,
    })
  }

  return Array.from(map.entries()).map(([date, val]) => ({ date, ...val }))
}

/**
 * Build ClientRevenueInput from tasks + users + clients.
 * Revenue = client budget (proxy), labor cost = hours × avg hourly rate.
 */
function buildClientInputs(
  tasks: Task[],
  users: User[],
  clients: Client[],
  cutoffDate: Date,
): ClientRevenueInput[] {
  const avgRate = users.reduce((s, u) => s + (u.hourlyRate ?? 40), 0) / Math.max(users.length, 1)

  // Group hours by clientId
  const hoursMap = new Map<string, number>()
  for (const task of tasks) {
    if (!task.timeSpent || task.timeSpent <= 0) continue
    const rawDate = task.updatedAt ?? task.createdAt
    if (rawDate && new Date(rawDate) < cutoffDate) continue
    const prev = hoursMap.get(task.clientId) ?? 0
    hoursMap.set(task.clientId, prev + task.timeSpent / 60)
  }

  const result: ClientRevenueInput[] = []
  for (const client of clients) {
    const hours = hoursMap.get(client.id)
    if (!hours || hours <= 0) continue
    result.push({
      clientId: client.id,
      clientName: client.name,
      revenue: client.budget ?? hours * avgRate * 1.3, // budget or estimated
      hoursWorked: Math.round(hours * 10) / 10,
      averageHourlyRate: avgRate,
    })
  }
  return result
}

/**
 * Build ProjectROIInput from projects + tasks.
 */
function buildProjectInputs(
  projects: Project[],
  tasks: Task[],
  users: User[],
  cutoffDate: Date,
): ProjectROIInput[] {
  const avgRate = users.reduce((s, u) => s + (u.hourlyRate ?? 40), 0) / Math.max(users.length, 1)

  // Group hours by projectId
  const hoursMap = new Map<string, number>()
  for (const task of tasks) {
    if (!task.projectId || !task.timeSpent || task.timeSpent <= 0) continue
    const rawDate = task.updatedAt ?? task.createdAt
    if (rawDate && new Date(rawDate) < cutoffDate) continue
    const prev = hoursMap.get(task.projectId) ?? 0
    hoursMap.set(task.projectId, prev + task.timeSpent / 60)
  }

  const result: ProjectROIInput[] = []
  for (const project of projects) {
    const hours = hoursMap.get(project.id) ?? 0
    if (hours <= 0 && !project.budget) continue
    result.push({
      projectId: project.id,
      projectName: project.name,
      contractValue: project.budget ?? hours * avgRate * 1.3,
      laborCost: hours * avgRate,
    })
  }
  return result
}

/**
 * Build monthly labor cost series (last 6 months) from tasks.
 * Used for the budget forecast.
 */
function buildMonthlyLaborCosts(tasks: Task[], users: User[]): number[] {
  const avgRate = users.reduce((s, u) => s + (u.hourlyRate ?? 40), 0) / Math.max(users.length, 1)
  const monthMap = new Map<string, number>()

  for (const task of tasks) {
    if (!task.timeSpent || task.timeSpent <= 0) continue
    const rawDate = task.updatedAt ?? task.createdAt
    if (!rawDate) continue
    const d = new Date(rawDate)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const prev = monthMap.get(key) ?? 0
    monthMap.set(key, prev + task.timeSpent / 60)
  }

  // Build last 6 months (sorted ascending)
  const months: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return months.map((m) => Math.round((monthMap.get(m) ?? 0) * avgRate))
}

/**
 * Month label: "Gen", "Feb", etc.
 */
function monthLabel(offset: number): string {
  const names = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
  const d = new Date()
  d.setMonth(d.getMonth() - offset)
  return names[d.getMonth()]
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [tab, setTab] = useState<'produttivita' | 'finanza' | 'previsioni'>('produttivita')
  const [period, setPeriod] = useState<Period>('30d')
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  const loadData = async () => {
    setLoading(true)
    try {
      const [t, u, c, p] = await Promise.all([getTasks(), getUsers(), getClients(), getProjects()])
      setTasks(t)
      setUsers(u)
      setClients(c)
      setProjects(p)
      setLastRefresh(new Date())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // ─── Derived data ─────────────────────────────────────────────────────────
  const periodDays = PERIOD_OPTIONS.find((o) => o.value === period)?.days ?? 30
  const cutoffDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - periodDays)
    return d
  }, [periodDays])

  const timeEntries = useMemo(() => tasksToTimeEntries(tasks, cutoffDate), [tasks, cutoffDate])
  const dayActivities = useMemo(() => tasksToDayActivities(tasks, periodDays), [tasks, periodDays])
  const clientInputs = useMemo(() => buildClientInputs(tasks, users, clients, cutoffDate), [tasks, users, clients, cutoffDate])
  const projectInputs = useMemo(() => buildProjectInputs(projects, tasks, users, cutoffDate), [projects, tasks, users, cutoffDate])
  const monthlyLaborCosts = useMemo(() => buildMonthlyLaborCosts(tasks, users), [tasks, users])

  const hourlyData = useMemo(() => computeHourlyProductivity(timeEntries), [timeEntries])
  const peak = useMemo(() => findPeakHours(hourlyData), [hourlyData])
  const heatmapData = useMemo(() => buildHeatmapData(dayActivities, periodDays), [dayActivities, periodDays])

  const clientProfits = useMemo(() => clientInputs.map(calculateClientProfit), [clientInputs])
  const projectROIs = useMemo(() => projectInputs.map(calculateProjectROI), [projectInputs])
  const budgetForecast = useMemo(() => forecastMonthlyBudget(monthlyLaborCosts, 3), [monthlyLaborCosts])

  // KPIs
  const totalRevenue = clientProfits.reduce((s, c) => s + c.revenue, 0)
  const totalProfit = clientProfits.reduce((s, c) => s + c.profit, 0)
  const avgMargin = clientProfits.length > 0
    ? clientProfits.reduce((s, c) => s + c.profitMargin, 0) / clientProfits.length
    : 0

  const totalMinutes = dayActivities.reduce((s, d) => s + d.totalMinutes, 0)
  const avgMinPerDay = dayActivities.length > 0 ? totalMinutes / dayActivities.length : 0
  const activeDays = dayActivities.filter((d) => d.totalMinutes > 0).length
  const completedTasks = tasks.filter((t) => {
    if (t.status !== 'Approvato') return false
    const rawDate = t.updatedAt ?? t.createdAt
    return rawDate ? new Date(rawDate) >= cutoffDate : false
  }).length

  const TABS = [
    { id: 'produttivita', label: 'Produttività' },
    { id: 'finanza', label: 'Finanza' },
    { id: 'previsioni', label: 'Previsioni' },
  ] as const

  const lastMonth = monthlyLaborCosts[monthlyLaborCosts.length - 1] ?? 0
  const forecastEnd = budgetForecast[2] ?? 0
  const trendPct = lastMonth > 0 ? Math.round((forecastEnd - lastMonth) / lastMonth * 100) : 0

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
            <Activity size={32} color="#6366f1" /> Analytics Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: 0 }}>
            Produttività team, margini cliente e previsioni di budget.
            {lastRefresh && (
              <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                Aggiornato alle {lastRefresh.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Period selector */}
          <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--border-color, rgba(0,0,0,0.06))', borderRadius: '10px', padding: '3px' }}>
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: period === opt.value ? 700 : 400,
                  background: period === opt.value ? '#6366f1' : 'transparent',
                  color: period === opt.value ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Refresh button */}
          <button
            onClick={loadData}
            disabled={loading}
            title="Ricarica dati"
            style={{
              padding: '0.5rem',
              borderRadius: '10px',
              border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
              background: 'var(--card-bg, #fff)',
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.08))', paddingBottom: '0' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '0.75rem 1.25rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: tab === t.id ? 700 : 400,
              color: tab === t.id ? '#6366f1' : 'var(--text-secondary)',
              borderBottom: tab === t.id ? '2px solid #6366f1' : '2px solid transparent',
              transition: 'all 0.15s',
              fontSize: '0.9rem',
              marginBottom: '-1px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PRODUTTIVITÀ ── */}
      {tab === 'produttivita' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <KpiCard
              icon={Zap}
              label="Picco di Produttività"
              value={loading ? '—' : (timeEntries.length > 0 ? peak.label : 'N/D')}
              sub="Fascia oraria più attiva"
              color="#f59e0b"
              loading={loading}
            />
            <KpiCard
              icon={Clock}
              label="Ore Medie/Giorno"
              value={loading ? '—' : `${Math.round(avgMinPerDay / 60 * 10) / 10}h`}
              sub={`ultimi ${periodDays} giorni`}
              color="#6366f1"
              loading={loading}
            />
            <KpiCard
              icon={Calendar}
              label="Giorni Attivi"
              value={loading ? '—' : `${activeDays}`}
              sub={`su ${periodDays} giorni`}
              color="#22c55e"
              loading={loading}
            />
            <KpiCard
              icon={CheckSquare}
              label="Task Completati"
              value={loading ? '—' : `${completedTasks}`}
              sub={`nel periodo selezionato`}
              color="#8b5cf6"
              loading={loading}
            />
          </div>

          {/* Hourly Chart */}
          <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, rgba(0,0,0,0.08))', borderRadius: '16px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem', marginTop: 0 }}>
              Produttività per Ora del Giorno (minuti medi)
            </h3>
            {loading ? (
              <Skeleton height={200} />
            ) : timeEntries.length === 0 ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', flexDirection: 'column', gap: '0.5rem' }}>
                <Clock size={32} color="var(--text-tertiary)" />
                <span style={{ fontSize: '0.9rem' }}>Nessun dato di timer nel periodo selezionato</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={hourlyData.filter(h => h.hour >= 7 && h.hour <= 20)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v} min`, 'Media']} />
                  <Bar dataKey="averageMinutes" radius={[4, 4, 0, 0]}>
                    {hourlyData.filter(h => h.hour >= 7 && h.hour <= 20).map((entry) => (
                      <Cell key={entry.hour} fill={entry.hour >= peak.start && entry.hour <= peak.end ? '#6366f1' : '#e0e7ff'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Heatmap */}
          <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, rgba(0,0,0,0.08))', borderRadius: '16px', padding: '1.5rem' }}>
            {loading ? <Skeleton height={100} /> : <ActivityHeatmap data={heatmapData} days={periodDays} />}
          </div>
        </div>
      )}

      {/* ── FINANZA ── */}
      {tab === 'finanza' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <KpiCard icon={DollarSign} label="Fatturato Stimato" value={loading ? '—' : `€${totalRevenue.toLocaleString('it-IT')}`} sub="da budget clienti" color="#22c55e" loading={loading} />
            <KpiCard icon={TrendingUp} label="Profitto Netto" value={loading ? '—' : `€${totalProfit.toLocaleString('it-IT')}`} sub="al netto dei costi orari" color="#6366f1" loading={loading} />
            <KpiCard icon={Target} label="Margine Medio" value={loading ? '—' : `${Math.round(avgMargin)}%`} sub="su tutti i clienti attivi" color="#f59e0b" loading={loading} />
            <KpiCard icon={Users} label="Clienti con ore" value={loading ? '—' : `${clientProfits.length}`} sub={`nel periodo selezionato`} color="#ec4899" loading={loading} />
          </div>

          {/* Client Profit Table */}
          <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, rgba(0,0,0,0.08))', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.08))' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Costo orario per Cliente</h3>
            </div>
            {loading ? (
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[1, 2, 3].map((i) => <Skeleton key={i} height={48} />)}
              </div>
            ) : clientProfits.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                Nessun dato cliente nel periodo selezionato
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                    {['Cliente', 'Budget', 'Ore Lavorate', 'Costo Orario', 'Margine'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientProfits.sort((a, b) => b.profit - a.profit).map((c) => (
                    <tr key={c.clientId} style={{ borderTop: '1px solid var(--border-color, rgba(0,0,0,0.06))' }}>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>{c.clientName}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>€{c.revenue.toLocaleString('it-IT')}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>{c.totalHoursWorked}h</td>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 700, color: c.profit >= 0 ? '#22c55e' : '#ef4444' }}>
                        €{c.profit.toLocaleString('it-IT')}
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, c.profitMargin))}%`, background: c.profitMargin > 30 ? '#22c55e' : c.profitMargin > 0 ? '#f59e0b' : '#ef4444', borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: 40 }}>{c.profitMargin}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Project ROI */}
          <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, rgba(0,0,0,0.08))', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.08))' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>ROI Progetti</h3>
            </div>
            {loading ? (
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[1, 2, 3].map((i) => <Skeleton key={i} height={48} />)}
              </div>
            ) : projectROIs.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                Nessun progetto con ore registrate nel periodo selezionato
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                    {['Progetto', 'Valore Contratto', 'Costi Totali', 'Profitto', 'ROI'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projectROIs.sort((a, b) => b.roi - a.roi).map((p) => (
                    <tr key={p.projectId} style={{ borderTop: '1px solid var(--border-color, rgba(0,0,0,0.06))' }}>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>{p.projectName}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>€{(p.profit + p.totalCosts).toLocaleString('it-IT')}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>€{p.totalCosts.toLocaleString('it-IT')}</td>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 700, color: p.profit >= 0 ? '#22c55e' : '#ef4444' }}>€{p.profit.toLocaleString('it-IT')}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 700, background: p.roi > 50 ? 'rgba(34,197,94,0.1)' : p.roi > 0 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', color: p.roi > 50 ? '#22c55e' : p.roi > 0 ? '#f59e0b' : '#ef4444' }}>
                          {p.roi > 0 ? '+' : ''}{p.roi}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── PREVISIONI ── */}
      {tab === 'previsioni' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, rgba(0,0,0,0.08))', borderRadius: '16px', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1rem', fontWeight: 700 }}>Costo Lavoro — Storico + Previsione 3 Mesi</h3>
            {loading ? (
              <Skeleton height={160} />
            ) : (
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {monthlyLaborCosts.map((v, i) => (
                  <div key={i} style={{ flex: 1, minWidth: 120, padding: '1rem', borderRadius: 12, background: 'rgba(0,0,0,0.02)', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {monthLabel(monthlyLaborCosts.length - 1 - i)}
                    </p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '1.4rem', fontWeight: 800 }}>€{v.toLocaleString('it-IT')}</p>
                  </div>
                ))}
                {budgetForecast.map((v, i) => (
                  <div key={`f${i}`} style={{ flex: 1, minWidth: 120, padding: '1rem', borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px dashed #6366f1', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Previsto +{i + 1}</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '1.4rem', fontWeight: 800, color: '#6366f1' }}>€{v.toLocaleString('it-IT')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!loading && trendPct !== 0 && (
            <div style={{ background: trendPct > 0 ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)', border: `1px solid ${trendPct > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'}`, borderRadius: '16px', padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <TrendingUp size={24} color={trendPct > 0 ? '#f59e0b' : '#22c55e'} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: trendPct > 0 ? '#b45309' : '#166534' }}>
                  {trendPct > 0 ? 'Attenzione: trend in crescita' : 'Ottimo: trend in riduzione'}
                </p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: trendPct > 0 ? '#92400e' : '#14532d' }}>
                  Il modello prevede un {trendPct > 0 ? 'aumento' : 'calo'} del costo lavoro del {Math.abs(trendPct)}% nei prossimi 3 mesi.
                  {trendPct > 0 && ' Valuta una revisione del budget.'}
                </p>
              </div>
            </div>
          )}

          {!loading && monthlyLaborCosts.every((v) => v === 0) && (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)', background: 'var(--card-bg, #fff)', borderRadius: '16px', border: '1px solid var(--border-color, rgba(0,0,0,0.08))' }}>
              Nessun dato di timer registrato. Usa il timer sui task per visualizzare le previsioni di budget.
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
