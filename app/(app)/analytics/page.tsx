"use client"

import React, { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  TrendingUp, Clock, Zap, Calendar, AlertTriangle, DollarSign, Target, Activity,
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

// ─── Mocked demo data (replace with Firebase fetches) ────────────────────────
const DEMO_TIME_ENTRIES: TimeEntry[] = [
  ...Array.from({ length: 80 }, (_, i) => ({
    userId: 'team',
    date: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
    hour: Math.floor(8 + Math.random() * 10),
    minutes: Math.floor(20 + Math.random() * 55),
  })),
  // Spike at 10:00
  ...Array.from({ length: 40 }, () => ({ userId: 'team', date: '2026-04-01', hour: 10, minutes: 55 })),
]

const DEMO_DAYS: DayActivity[] = Array.from({ length: 90 }, (_, i) => {
  const date = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
  const isWeekend = new Date(date).getDay() % 6 === 0
  return { date, totalMinutes: isWeekend ? 0 : Math.floor(100 + Math.random() * 400), taskCount: Math.floor(Math.random() * 12) }
})

const DEMO_CLIENTS: ClientRevenueInput[] = [
  { clientId: 'c1', clientName: 'Acme Corp', revenue: 12000, hoursWorked: 80, averageHourlyRate: 40 },
  { clientId: 'c2', clientName: 'Globex', revenue: 8000, hoursWorked: 120, averageHourlyRate: 40 },
  { clientId: 'c3', clientName: 'Initech', revenue: 6500, hoursWorked: 50, averageHourlyRate: 40 },
  { clientId: 'c4', clientName: 'Umbrella', revenue: 3000, hoursWorked: 90, averageHourlyRate: 40 },
]

const DEMO_PROJECTS: ProjectROIInput[] = [
  { projectId: 'p1', projectName: 'Sito Web E-commerce', contractValue: 7000, laborCost: 3000, otherCosts: 500 },
  { projectId: 'p2', projectName: 'Campagna Social Q1', contractValue: 4000, laborCost: 1500 },
  { projectId: 'p3', projectName: 'Brand Identity', contractValue: 5000, laborCost: 4200, otherCosts: 200 },
]

const DEMO_MONTHLY_SPEND = [3200, 3500, 3100, 3800, 4200, 3900]

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string
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
      <p style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>{value}</p>
      {sub && <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: 0 }}>{sub}</p>}
    </div>
  )
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────
const HEATMAP_COLORS = ['#e2e8f0', '#bfdbfe', '#93c5fd', '#3b82f6', '#1d4ed8']

function ActivityHeatmap({ data }: { data: ReturnType<typeof buildHeatmapData> }) {
  const weeks: typeof data[] = []
  for (let i = 0; i < data.length; i += 7) weeks.push(data.slice(i, i + 7))

  return (
    <div>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Attività ultimi 90 giorni</h3>
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [tab, setTab] = useState<'produttivita' | 'finanza' | 'previsioni'>('produttivita')

  const hourlyData = useMemo(() => computeHourlyProductivity(DEMO_TIME_ENTRIES), [])
  const peak = useMemo(() => findPeakHours(hourlyData), [hourlyData])
  const heatmapData = useMemo(() => buildHeatmapData(DEMO_DAYS, 90), [])

  const clientProfits = useMemo(() => DEMO_CLIENTS.map(calculateClientProfit), [])
  const projectROIs = useMemo(() => DEMO_PROJECTS.map(calculateProjectROI), [])
  const budgetForecast = useMemo(() => forecastMonthlyBudget(DEMO_MONTHLY_SPEND, 3), [])

  const totalRevenue = clientProfits.reduce((s, c) => s + c.revenue, 0)
  const totalProfit = clientProfits.reduce((s, c) => s + c.profit, 0)
  const avgMargin = clientProfits.reduce((s, c) => s + c.profitMargin, 0) / clientProfits.length

  const TABS = [
    { id: 'produttivita', label: '⚡ Produttività' },
    { id: 'finanza', label: '💰 Finanza' },
    { id: 'previsioni', label: '📈 Previsioni' },
  ] as const

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
          <Activity size={32} color="#6366f1" /> Analytics Dashboard
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: 0 }}>
          Produttività team, margini cliente e previsioni di budget.
        </p>
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
            <KpiCard icon={Zap} label="Picco di Produttività" value={peak.label} sub="Fascia oraria più attiva" color="#f59e0b" />
            <KpiCard icon={Clock} label="Ore Medie/Giorno" value={`${Math.round(DEMO_DAYS.reduce((s, d) => s + d.totalMinutes, 0) / DEMO_DAYS.length / 6) / 10}h`} sub="ultimi 90 giorni" color="#6366f1" />
            <KpiCard icon={Calendar} label="Giorni Attivi" value={`${DEMO_DAYS.filter(d => d.totalMinutes > 0).length}`} sub="su 90 giorni" color="#22c55e" />
          </div>

          {/* Hourly Chart */}
          <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, rgba(0,0,0,0.08))', borderRadius: '16px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem', marginTop: 0 }}>Produttività per Ora del Giorno (minuti medi)</h3>
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
          </div>

          {/* Heatmap */}
          <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, rgba(0,0,0,0.08))', borderRadius: '16px', padding: '1.5rem' }}>
            <ActivityHeatmap data={heatmapData} />
          </div>
        </div>
      )}

      {/* ── FINANZA ── */}
      {tab === 'finanza' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <KpiCard icon={DollarSign} label="Fatturato Totale" value={`€${totalRevenue.toLocaleString('it-IT')}`} sub="clienti attivi" color="#22c55e" />
            <KpiCard icon={TrendingUp} label="Profitto Netto" value={`€${totalProfit.toLocaleString('it-IT')}`} sub="al netto dei costi orari" color="#6366f1" />
            <KpiCard icon={Target} label="Margine Medio" value={`${Math.round(avgMargin)}%`} sub="su tutti i clienti" color="#f59e0b" />
          </div>

          {/* Client Profit Table */}
          <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, rgba(0,0,0,0.08))', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.08))' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Profitto per Cliente</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                  {['Cliente', 'Fatturato', 'Ore Lavorate', 'Profitto', 'Margine'].map(h => (
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
          </div>

          {/* Project ROI */}
          <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, rgba(0,0,0,0.08))', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.08))' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>ROI Progetti</h3>
            </div>
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
          </div>
        </div>
      )}

      {/* ── PREVISIONI ── */}
      {tab === 'previsioni' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, rgba(0,0,0,0.08))', borderRadius: '16px', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1rem', fontWeight: 700 }}>Previsione Budget — Prossimi 3 Mesi</h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {DEMO_MONTHLY_SPEND.map((v, i) => (
                <div key={i} style={{ flex: 1, minWidth: 120, padding: '1rem', borderRadius: 12, background: 'rgba(0,0,0,0.02)', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mese -{DEMO_MONTHLY_SPEND.length - i}</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '1.4rem', fontWeight: 800 }}>€{v.toLocaleString('it-IT')}</p>
                </div>
              ))}
              {budgetForecast.map((v, i) => (
                <div key={`f${i}`} style={{ flex: 1, minWidth: 120, padding: '1rem', borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px dashed #6366f1', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>📈 Previsto +{i + 1}</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '1.4rem', fontWeight: 800, color: '#6366f1' }}>€{v.toLocaleString('it-IT')}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '16px', padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <AlertTriangle size={24} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: '#b45309' }}>Attenzione: trend in crescita</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#92400e' }}>Il modello prevede un aumento della spesa del {Math.round((budgetForecast[2] - DEMO_MONTHLY_SPEND[DEMO_MONTHLY_SPEND.length - 1]) / DEMO_MONTHLY_SPEND[DEMO_MONTHLY_SPEND.length - 1] * 100)}% nei prossimi 3 mesi. Valuta una revisione del budget.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
