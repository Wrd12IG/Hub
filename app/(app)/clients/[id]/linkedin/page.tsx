"use client"

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertCircle, Columns, Download, Search, Image as ImageIcon, Video, Type, Eye, Activity, Users, UserPlus, Heart, MessageCircle, Share2, MousePointerClick, MoreVertical } from 'lucide-react'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts'
import { MetricoolCard } from '@/components/metricool/MetricoolCard'
import { MetricoolTable } from '@/components/metricool/MetricoolTable'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { MetricoolDatePicker } from '@/components/metricool/MetricoolDatePicker'
import { DateRange } from 'react-day-picker'
import { subDays } from 'date-fns'

// --- Types ---
interface Post {
  id: string;
  title: string;
  tags: string[];
  tipo: string;
  image: string;
  date: string;
  impression: number;
  reazioni: number;
  commenti: number;
  clic: number;
  condivisi: number;
  engagement: number;
  visualizzazioniVideo: number;
  visitatori: number;
}

interface Newsletter {
  id: string;
  title: string;
  date: string;
  impression: number;
  reazioni: number;
  commenti: number;
  clic: number;
  condivisi: number;
  engagement: number;
}

interface DashboardData {
  crescitaSummary: any;
  averagesSummary: any;
  riepilogoSummary: any;
  interazioniSummary: any;
  crescitaChart: any[];
  riepilogoChart: any[];
  interazioniChart: any[];
  posts: Post[];
  newsletters: Newsletter[];
}

// --- Utils ---
const formatNumber = (num: number) => {
  if (num === 0 || !num) return '-';
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(2) + 'k';
  return num.toLocaleString('it-IT', { maximumFractionDigits: 2 });
};

export default function LinkedinPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        let url = `/api/clients/${id}/linkedin`;
        if (dateRange?.from && dateRange?.to) {
          url += `?start=${dateRange.from.toISOString()}&end=${dateRange.to.toISOString()}`;
        }
        
        const response = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        if (!response.ok) throw new Error('Failed to fetch LinkedIn data');
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, dateRange]);

  if (loading || !data) {
    return (
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
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

  const postColumns = [
    { 
      key: 'title', 
      label: 'Post', 
      render: (row: any) => (
        <div className="flex items-center gap-3 min-w-[300px]">
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
             {row.tipo === 'Immagine' ? <ImageIcon className="h-4 w-4 text-muted-foreground"/> : <Video className="h-4 w-4 text-muted-foreground" />}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm line-clamp-1 font-medium">{row.title}</span>
            <div className="flex gap-1">
              {row.tags?.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-[10px] py-0 px-1 font-normal bg-blue-100 text-blue-800 hover:bg-blue-100/80">{tag}</Badge>
              ))}
            </div>
          </div>
        </div>
      )
    },
    { 
      key: 'tipo', 
      label: 'Tipo',
      render: (row: any) => (
        <span className="text-sm text-muted-foreground">{row.tipo}</span>
      )
    },
    { 
      key: 'date', 
      label: 'Data', 
      render: (row: any) => (
        <div className="flex flex-col">
          <span className="text-sm">{row.date.split(' ').slice(0,3).join(' ')}</span>
          <span className="text-xs text-muted-foreground">{row.date.split(' ')[3]}</span>
        </div>
      ) 
    },
    { key: 'impression', label: 'Impression', render: (row: any) => formatNumber(row.impression) },
    { key: 'reazioni', label: 'Reazioni', render: (row: any) => (
      <div className="flex items-center gap-2">
        <span>{formatNumber(row.reazioni)}</span>
        <Badge variant="outline" className="text-[10px] py-0 font-normal border-green-200 bg-green-50 text-green-700">Nuovo</Badge>
      </div>
    )},
    { key: 'commenti', label: 'Commenti', render: (row: any) => formatNumber(row.commenti) },
    { key: 'clic', label: 'Clic', render: (row: any) => formatNumber(row.clic) },
    { key: 'condivisi', label: 'Condivisi', render: (row: any) => formatNumber(row.condivisi) },
    { key: 'engagement', label: 'Engagement', render: (row: any) => row.engagement.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
    { key: 'visualizzazioniVideo', label: 'Vis. video', render: (row: any) => formatNumber(row.visualizzazioniVideo) },
    { key: 'visitatori', label: 'Visitatori', render: (row: any) => formatNumber(row.visitatori) }
  ];

  const newsletterColumns = [
    { 
      key: 'title', 
      label: 'Newsletter', 
      render: (row: any) => (
        <div className="flex items-center gap-3 min-w-[300px]">
          <div className="flex flex-col gap-1">
            <span className="text-sm line-clamp-1 font-medium">{row.title}</span>
          </div>
        </div>
      )
    },
    { 
      key: 'date', 
      label: 'Data', 
      render: (row: any) => (
        <div className="flex flex-col">
          <span className="text-sm">{row.date.split(' ').slice(0,3).join(' ')}</span>
          <span className="text-xs text-muted-foreground">{row.date.split(' ')[3]}</span>
        </div>
      ) 
    },
    { key: 'impression', label: 'Impression', render: (row: any) => formatNumber(row.impression) },
    { key: 'reazioni', label: 'Reazioni', render: (row: any) => (
      <div className="flex items-center gap-2">
        <span>{formatNumber(row.reazioni)}</span>
        <Badge variant="outline" className="text-[10px] py-0 font-normal border-green-200 bg-green-50 text-green-700">Nuovo</Badge>
      </div>
    )},
    { key: 'commenti', label: 'Commenti', render: (row: any) => formatNumber(row.commenti) },
    { key: 'clic', label: 'Clic', render: (row: any) => formatNumber(row.clic) },
    { key: 'condivisi', label: 'Condivisi', render: (row: any) => formatNumber(row.condivisi) },
    { key: 'engagement', label: 'Engagement', render: (row: any) => row.engagement.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
  ];

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      
      {/* 1. CRESCITA */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h2 className="text-xl font-semibold tracking-tight">Crescita</h2>
          <MetricoolDatePicker date={dateRange} setDate={setDateRange} />
        </div>
        
        <div className="flex justify-end gap-2 mb-4 flex-wrap">
          <MetricoolCard title="Followers" value={data.crescitaSummary.followers} icon={Users} variant="blue" className="w-40" />
          <MetricoolCard title="Media visitatori unici" value={data.crescitaSummary.mediaVisitatoriUnici} icon={UserPlus} variant="pink" className="w-48" />
          <MetricoolCard title="Clic totali dei pulsanti" value={data.crescitaSummary.clicPulsanti} icon={MousePointerClick} variant="pink" className="w-48" />
          <MetricoolCard title="Visualizzazioni di pagina" value={data.crescitaSummary.visualizzazioniPagina} icon={Eye} variant="purple" className="w-56" />
          <MetricoolCard title="Contenuto totale" value={data.crescitaSummary.contenutoTotale} icon={ImageIcon} variant="orange" className="w-40" />
        </div>

        <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.crescitaChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={(val) => `${new Date(val).getDate()} ${new Date(val).toLocaleString('it-IT', {month: 'short'})}`} tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis yAxisId="left" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
              <YAxis yAxisId="right" orientation="right" hide />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Bar yAxisId="right" dataKey="contenuto" name="Contenuto totale" fill="#f59e0b" barSize={10} radius={[4, 4, 0, 0]} opacity={0.6}/>
              <Line yAxisId="left" type="monotone" dataKey="followers" name="Followers" stroke="#60a5fa" strokeWidth={2} dot={{r: 3}} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 2. MEDIE */}
      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-xl font-semibold tracking-tight">Medie</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <MetricoolCard title="Followers" value={data.averagesSummary.followersGiornalieri} variant="gray" size="sm" />
          <MetricoolCard title="Followers giornalieri" value={data.averagesSummary.followersGiornalieri} variant="gray" size="sm" />
          <MetricoolCard title="Followers per post" value={data.averagesSummary.followersPerPost} variant="gray" size="sm" />
          <MetricoolCard title="Post giornalieri" value={data.averagesSummary.postGiornalieri} variant="gray" size="sm" />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <MetricoolCard title="Reazioni giornaliere" value={data.averagesSummary.reazioniGiornaliere} variant="gray" size="sm" />
          <MetricoolCard title="Reazioni per contenuto" value={data.averagesSummary.reazioniPerContenuto} variant="gray" size="sm" />
          <MetricoolCard title="Commenti giornalieri" value={data.averagesSummary.commentiGiornalieri} variant="gray" size="sm" />
          <MetricoolCard title="Commenti per contenuto" value={data.averagesSummary.commentiPerContenuto} variant="gray" size="sm" />
          <MetricoolCard title="Clic giornalieri" value={data.averagesSummary.clicGiornalieri} variant="gray" size="sm" />
          <MetricoolCard title="Clicks per content" value={data.averagesSummary.clicksPerContent} variant="gray" size="sm" />
        </div>
      </section>

      {/* 3. RIEPILOGO */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Riepilogo</h2>
          <div className="flex gap-2">
            <MetricoolCard title="Engagement" value={data.riepilogoSummary.engagement} variant="blue" className="w-32" size="sm"/>
            <MetricoolCard title="Interazioni" value={data.riepilogoSummary.interazioni} variant="green" className="w-32" size="sm"/>
            <MetricoolCard title="Impression" value={data.riepilogoSummary.impression} variant="purple" className="w-32" size="sm"/>
            <MetricoolCard title="Post" value={data.riepilogoSummary.post} variant="orange" className="w-32" size="sm"/>
          </div>
        </div>
        <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.riepilogoChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={(val) => `${new Date(val).getDate()} ${new Date(val).toLocaleString('it-IT', {month: 'short'})}`} tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis yAxisId="left" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
              <YAxis yAxisId="right" orientation="right" hide />
              <RechartsTooltip contentStyle={tooltipStyle}/>
              <Bar yAxisId="right" dataKey="post" name="Post" fill="#fcebc7" barSize={10} radius={[4, 4, 0, 0]} />
              <Line yAxisId="left" type="monotone" dataKey="engagement" name="Engagement" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="left" type="monotone" dataKey="interazioni" name="Interazioni" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="left" type="monotone" dataKey="impression" name="Impression" stroke="#c084fc" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 4. INTERAZIONI */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Interazioni</h2>
          <div className="flex gap-2">
            <MetricoolCard title="Reazioni" value={data.interazioniSummary.reazioni} variant="blue" className="w-32" size="sm"/>
            <MetricoolCard title="Commenti" value={data.interazioniSummary.commenti} variant="green" className="w-32" size="sm"/>
            <MetricoolCard title="Clic" value={data.interazioniSummary.clic} variant="pink" className="w-32" size="sm"/>
            <MetricoolCard title="Condivisi" value={data.interazioniSummary.condivisi} variant="purple" className="w-32" size="sm"/>
            <MetricoolCard title="Post" value={data.interazioniSummary.post} variant="orange" className="w-32" size="sm"/>
          </div>
        </div>
        <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.interazioniChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={(val) => `${new Date(val).getDate()} ${new Date(val).toLocaleString('it-IT', {month: 'short'})}`} tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis yAxisId="left" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
              <YAxis yAxisId="right" orientation="right" hide />
              <RechartsTooltip contentStyle={tooltipStyle}/>
              <Bar yAxisId="right" dataKey="post" name="Post" fill="#fcebc7" barSize={10} radius={[4, 4, 0, 0]} />
              <Line yAxisId="left" type="monotone" dataKey="reazioni" name="Reazioni" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="left" type="monotone" dataKey="commenti" name="Commenti" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="left" type="monotone" dataKey="clic" name="Clic" stroke="#f472b6" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="left" type="monotone" dataKey="condivisi" name="Condivisi" stroke="#c084fc" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 5. LISTA DEI POST */}
      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-xl font-semibold tracking-tight mb-4">Lista dei post</h2>
        <MetricoolTable columns={postColumns} data={data.posts} searchPlaceholder="Cerca post..." filename="linkedin_posts.csv" />
      </section>

      {/* 6. ELENCO DELLE NEWSLETTER */}
      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-xl font-semibold tracking-tight mb-4">Elenco delle newsletter</h2>
        <MetricoolTable columns={newsletterColumns} data={data.newsletters} searchPlaceholder="Cerca newsletter..." filename="linkedin_newsletter.csv" />
      </section>

    </div>
  )
}
