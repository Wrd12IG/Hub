"use client"

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertCircle, Target, Users, MousePointerClick, TrendingUp, DollarSign, Activity } from 'lucide-react'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts'
import { MetricoolCard } from '@/components/metricool/MetricoolCard'
import { MetricoolTable } from '@/components/metricool/MetricoolTable'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

// --- Types ---
interface Campaign {
  id: string;
  name: string;
  updatedAt: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cpm: number;
  cpc: number;
  ctr: number;
  valoreConversione: number;
  roas: number;
  spend: number;
}

interface Keyword {
  keyword: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cpm: number;
  cpc: number;
  ctr: number;
  spend: number;
}

interface ChartDataPoint {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpm: number;
  cpc: number;
  ctr: number;
  valoreConversione: number;
  roas: number;
}

interface SummaryData {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa: number;
  ctr: number;
  cpm: number;
  cpc: number;
  valoreConversione: number;
  roas: number;
}

interface DashboardData {
  summary: SummaryData;
  chartData: ChartDataPoint[];
  campaigns: Campaign[];
  keywords: Keyword[];
}

// --- Utils ---
const formatNumber = (num: number) => {
  if (num === 0 || !num) return '-';
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(2) + 'k';
  return num.toLocaleString('it-IT', { maximumFractionDigits: 2 });
};

const formatCurrency = (num: number) => {
  if (num === 0 || !num) return '€0.00';
  if (num >= 1000000) return '€' + (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return '€' + (num / 1000).toFixed(2) + 'k';
  return '€' + num.toLocaleString('it-IT', { maximumFractionDigits: 2 });
};

export default function GoogleAdsPage({ params: propsParams }: { params?: { id: string } }) {
  const params = useParams();
  const id = (propsParams?.id || params.id) as string;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/clients/${id}/google-ads`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        if (!response.ok) throw new Error('Failed to fetch Google Ads data');
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading || !data) {
    return (
      <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] text-destructive">
        <AlertCircle size={48} className="mb-4" />
        <p className="font-semibold">Errore nel caricamento: {error}</p>
      </div>
    );
  }

  const tooltipStyle = {
    borderRadius: '8px', 
    border: '1px solid hsl(var(--border))', 
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    background: 'hsl(var(--card))',
    color: 'hsl(var(--card-foreground))'
  };

  // Common chart styling
  const chartHeight = 350;
  const orangeSpeso = "#fde68a"; // Light orange for bars

  // Table Columns Setup
  const campaignColumns = [
    { key: 'name', label: 'Nome', isPrimary: true, render: (row: any) => <span className="font-medium text-foreground">{row.name}</span> },
    { 
      key: 'updatedAt', 
      label: 'Aggiornato', 
      render: (row: any) => (
        <div className="flex flex-col">
          <span className="text-sm">{row.updatedAt.split(' ').slice(0,3).join(' ')}</span>
          <span className="text-xs text-muted-foreground">{row.updatedAt.split(' ')[3]}</span>
        </div>
      ) 
    },
    { key: 'impressions', label: 'Impression', render: (row: any) => formatNumber(row.impressions) },
    { key: 'clicks', label: 'Clic', render: (row: any) => formatNumber(row.clicks) },
    { key: 'conversions', label: 'Conversioni', render: (row: any) => formatNumber(row.conversions) },
    { key: 'cpm', label: 'CPM', render: (row: any) => `€${row.cpm.toFixed(2)}` },
    { key: 'cpc', label: 'CPC', render: (row: any) => `€${row.cpc.toFixed(2)}` },
    { key: 'ctr', label: 'CTR', render: (row: any) => `${row.ctr.toFixed(2)}%` },
    { key: 'valoreConversione', label: 'Valore di conversione', render: (row: any) => formatCurrency(row.valoreConversione) },
    { key: 'roas', label: 'ROAS', render: (row: any) => `${row.roas.toFixed(2)}x` },
    { key: 'spend', label: 'Spesa', sortable: true, render: (row: any) => formatCurrency(row.spend) }
  ];

  const keywordColumns = [
    { key: 'keyword', label: 'Parola chiave', isPrimary: true, render: (row: any) => <Badge variant="outline" className="font-normal">{row.keyword}</Badge> },
    { key: 'impressions', label: 'Impression', sortable: true, render: (row: any) => formatNumber(row.impressions) },
    { key: 'clicks', label: 'Clic', render: (row: any) => formatNumber(row.clicks) },
    { key: 'conversions', label: 'Conversioni', render: (row: any) => formatNumber(row.conversions) },
    { key: 'cpm', label: 'CPM', render: (row: any) => `€${row.cpm.toFixed(2)}` },
    { key: 'cpc', label: 'CPC', render: (row: any) => `€${row.cpc.toFixed(2)}` },
    { key: 'ctr', label: 'CTR', render: (row: any) => `${row.ctr.toFixed(2)}%` },
    { key: 'spend', label: 'Spesa', render: (row: any) => formatCurrency(row.spend) }
  ];

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      
      {/* 1. COPERTURA */}
      <section className="space-y-4">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Copertura</h2>
          <div className="flex gap-2">
            <MetricoolCard title="Impression" value={data.summary.impressions} icon={Users} variant="blue" className="w-40" />
            <MetricoolCard title="Speso" value={formatCurrency(data.summary.spend)} icon={DollarSign} variant="orange" className="w-40" />
          </div>
        </div>
        <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={(val) => `${new Date(val).getDate()} ${new Date(val).toLocaleString('it-IT', {month: 'short'})}`} tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis yAxisId="left" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
              <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Bar yAxisId="left" dataKey="spend" name="Speso" fill={orangeSpeso} barSize={20} radius={[4,4,0,0]} opacity={0.8}/>
              <Line yAxisId="right" type="monotone" dataKey="impressions" name="Impression" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 2. RISULTATI */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Risultati</h2>
          <div className="flex gap-2">
            <MetricoolCard title="Clic" value={data.summary.clicks} icon={MousePointerClick} variant="blue" className="w-32" size="sm"/>
            <MetricoolCard title="Conversioni" value={data.summary.conversions} icon={Target} variant="green" className="w-36" size="sm"/>
            <MetricoolCard title="Speso" value={formatCurrency(data.summary.spend)} icon={DollarSign} variant="orange" className="w-32" size="sm"/>
          </div>
        </div>
        <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={(val) => `${new Date(val).getDate()} ${new Date(val).toLocaleString('it-IT', {month: 'short'})}`} tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis yAxisId="left" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
              <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Bar yAxisId="right" dataKey="spend" name="Speso" fill={orangeSpeso} barSize={20} radius={[4,4,0,0]} opacity={0.8}/>
              <Line yAxisId="left" type="monotone" dataKey="clicks" name="Clic" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="left" type="monotone" dataKey="conversions" name="Conversioni" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 3. PERFORMANCE */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Performance</h2>
          <div className="flex gap-2">
            <MetricoolCard title="CPM" value={`€${data.summary.cpm.toFixed(2)}`} icon={Activity} variant="blue" className="w-32" size="sm"/>
            <MetricoolCard title="CPC" value={`€${data.summary.cpc.toFixed(2)}`} variant="green" className="w-32" size="sm"/>
            <MetricoolCard title="CTR" value={`${data.summary.ctr.toFixed(2)}%`} variant="pink" className="w-32" size="sm"/>
            <MetricoolCard title="Speso" value={formatCurrency(data.summary.spend)} icon={DollarSign} variant="orange" className="w-32" size="sm"/>
          </div>
        </div>
        <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={(val) => `${new Date(val).getDate()} ${new Date(val).toLocaleString('it-IT', {month: 'short'})}`} tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis yAxisId="left" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Bar yAxisId="right" dataKey="spend" name="Speso" fill={orangeSpeso} barSize={20} radius={[4,4,0,0]} opacity={0.8}/>
              <Line yAxisId="left" type="monotone" dataKey="cpm" name="CPM" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="left" type="monotone" dataKey="cpc" name="CPC" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="left" type="monotone" dataKey="ctr" name="CTR" stroke="#f472b6" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 4. ENTRATE */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Entrate</h2>
          <div className="flex gap-2">
            <MetricoolCard title="Valore di conversione" value={formatCurrency(data.summary.valoreConversione)} variant="blue" className="w-56" size="sm"/>
            <MetricoolCard title="ROAS" value={`${data.summary.roas.toFixed(2)}x`} icon={TrendingUp} variant="green" className="w-32" size="sm"/>
            <MetricoolCard title="Speso" value={formatCurrency(data.summary.spend)} icon={DollarSign} variant="orange" className="w-32" size="sm"/>
          </div>
        </div>
        <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={(val) => `${new Date(val).getDate()} ${new Date(val).toLocaleString('it-IT', {month: 'short'})}`} tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis yAxisId="left" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
              <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Bar yAxisId="right" dataKey="spend" name="Speso" fill={orangeSpeso} barSize={20} radius={[4,4,0,0]} opacity={0.8}/>
              <Line yAxisId="left" type="monotone" dataKey="valoreConversione" name="Valore di conversione" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="left" type="monotone" dataKey="roas" name="ROAS" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 5. TABELLA CAMPAGNE */}
      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-xl font-semibold tracking-tight mb-4">Lista delle campagne</h2>
        <MetricoolTable columns={campaignColumns} data={data.campaigns} filename="google_ads_campagne.csv" searchPlaceholder="Cerca campagne..." />
      </section>

      {/* 6. TABELLA PAROLE CHIAVE */}
      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-xl font-semibold tracking-tight mb-4">Lista di parole chiave</h2>
        <MetricoolTable columns={keywordColumns} data={data.keywords} filename="google_ads_keywords.csv" searchPlaceholder="Cerca parole chiave..." />
      </section>

    </div>
  )
}
