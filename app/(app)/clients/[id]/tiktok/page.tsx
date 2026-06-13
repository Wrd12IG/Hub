"use client"

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertCircle, Columns, Download, Search, Image as ImageIcon, Video, Type, Eye, Activity, Users, UserPlus, Heart, MessageCircle, Share2, PlayCircle, Clock, CheckCircle2, XCircle, MoreVertical } from 'lucide-react'
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

// --- Types ---
interface VideoModel {
  id: string;
  title: string;
  tags: string[];
  image: string;
  date: string;
  visualizzazioni: number;
  tempoVisualizzazione: string;
  durataMedia: string;
  miPiace: number;
  nonMiPiace: number;
  commenti: number;
  condivisi: number;
}

interface SummaryData {
  followers: number;
  post: number;
  acquisito: number;
  perso: number;
  engagement: number;
  interazioni: number;
  coperturaMedia: number;
  visualizzazioni: number;
  miPiace: number;
  commenti: number;
  condivisi: number;
  visualizzazioniProfilo: number;
}

interface DashboardData {
  summary: SummaryData;
  crescitaChart: any[];
  saldoFollowersChart: any[];
  riepilogoChart: any[];
  interazioniChart: any[];
  profiloChart: any[];
  postVisualizzatiChart: any[];
  medieVisualizzazioniChart: any[];
  posts: VideoModel[];
}

// --- Utils ---
const formatNumber = (num: number) => {
  if (num === 0 || !num) return '-';
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(2) + 'k';
  return num.toLocaleString('it-IT', { maximumFractionDigits: 2 });
};

export default function TikTokPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/clients/${id}/tiktok`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        if (!response.ok) throw new Error('Failed to fetch TikTok data');
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

  const videoColumns = [
    { 
      key: 'title', 
      label: 'Video', 
      render: (row: any) => (
        <div className="flex items-center gap-3 min-w-[300px]">
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
             <PlayCircle className="h-4 w-4 text-muted-foreground"/>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm line-clamp-1 font-medium">{row.title}</span>
            <div className="flex gap-1">
              {row.tags?.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-[10px] py-0 px-1 font-normal bg-pink-100 text-pink-800 hover:bg-pink-100/80">{tag}</Badge>
              ))}
            </div>
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
    { key: 'visualizzazioni', label: 'Visualizzazioni video', render: (row: any) => formatNumber(row.visualizzazioni) },
    { key: 'tempoVisualizzazione', label: 'Tempo di visualizzazione' },
    { key: 'durataMedia', label: 'Durata media' },
    { key: 'miPiace', label: 'Mi piace', render: (row: any) => formatNumber(row.miPiace) },
    { key: 'nonMiPiace', label: 'Non mi piace', render: (row: any) => formatNumber(row.nonMiPiace) },
    { key: 'commenti', label: 'Commenti', render: (row: any) => formatNumber(row.commenti) },
    { key: 'condivisi', label: 'Condivisi', render: (row: any) => formatNumber(row.condivisi) }
  ];

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      
      {/* 1. CRESCITA */}
      <section className="space-y-4">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Crescita</h2>
          <div className="flex gap-2">
            <MetricoolCard title="Followers" value="-" variant="blue" className="w-32" size="sm"/>
            <MetricoolCard title="Post" value="-" variant="orange" className="w-32" size="sm"/>
          </div>
        </div>
        <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.crescitaChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={(val) => `${new Date(val).getDate()} ${new Date(val).toLocaleString('it-IT', {month: 'short'})}`} tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="followers" name="Followers" stroke="#60a5fa" strokeWidth={2} dot={{r: 3}} />
              <Line type="monotone" dataKey="post" name="Post" stroke="#f59e0b" strokeWidth={2} dot={{r: 3}} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 2. SALDO DEI FOLLOWERS */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Saldo dei followers</h2>
          <div className="flex gap-2">
            <MetricoolCard title="Acquisito" value={data.summary.acquisito} icon={CheckCircle2} variant="blue" className="w-32" size="sm"/>
            <MetricoolCard title="Perso" value={data.summary.perso} icon={XCircle} variant="pink" className="w-32" size="sm"/>
            <MetricoolCard title="Post" value="-" variant="orange" className="w-32" size="sm"/>
          </div>
        </div>
        <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.saldoFollowersChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={(val) => `${new Date(val).getDate()} ${new Date(val).toLocaleString('it-IT', {month: 'short'})}`} tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="acquisito" name="Acquisito" stroke="#60a5fa" strokeWidth={2} dot={{r: 3}} />
              <Line type="monotone" dataKey="perso" name="Perso" stroke="#f472b6" strokeWidth={2} dot={{r: 3}} />
              <Line type="monotone" dataKey="post" name="Post" stroke="#f59e0b" strokeWidth={2} dot={{r: 3}} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 3. RIEPILOGO */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex justify-between items-end mb-4 flex-wrap">
          <h2 className="text-xl font-semibold tracking-tight">Riepilogo</h2>
          <div className="flex gap-2 flex-wrap">
            <MetricoolCard title="Engagement" value="-" variant="blue" className="w-32" size="sm"/>
            <MetricoolCard title="Interazioni" value="-" variant="green" className="w-32" size="sm"/>
            <MetricoolCard title="Copertura media dei post" value="-" variant="pink" className="w-48" size="sm"/>
            <MetricoolCard title="Visualizzazioni dei post" value="-" variant="purple" className="w-48" size="sm"/>
            <MetricoolCard title="Post" value="-" variant="orange" className="w-32" size="sm"/>
          </div>
        </div>
        <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.riepilogoChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={(val) => `${new Date(val).getDate()} ${new Date(val).toLocaleString('it-IT', {month: 'short'})}`} tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
              <RechartsTooltip contentStyle={tooltipStyle}/>
              <Line type="monotone" dataKey="engagement" name="Engagement" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="interazioni" name="Interazioni" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="coperturaMedia" name="Copertura media" stroke="#f472b6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="visualizzazioni" name="Visualizzazioni" stroke="#c084fc" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="post" name="Post" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 4. INTERAZIONI */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Interazioni</h2>
          <div className="flex gap-2">
            <MetricoolCard title="Mi piace" value="-" variant="green" className="w-32" size="sm"/>
            <MetricoolCard title="Commenti" value="-" variant="pink" className="w-32" size="sm"/>
            <MetricoolCard title="Condivisi" value="-" variant="purple" className="w-32" size="sm"/>
            <MetricoolCard title="Post" value="-" variant="orange" className="w-32" size="sm"/>
          </div>
        </div>
        <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.interazioniChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={(val) => `${new Date(val).getDate()} ${new Date(val).toLocaleString('it-IT', {month: 'short'})}`} tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
              <RechartsTooltip contentStyle={tooltipStyle}/>
              <Line type="monotone" dataKey="miPiace" name="Mi piace" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="commenti" name="Commenti" stroke="#f472b6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="condivisi" name="Condivisi" stroke="#c084fc" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="post" name="Post" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 5. PROFILO */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Profilo</h2>
          <div className="flex gap-2">
            <MetricoolCard title="Visualizzazioni profilo" value="0" variant="blue" className="w-48" size="sm"/>
            <MetricoolCard title="Post" value="-" variant="orange" className="w-32" size="sm"/>
          </div>
        </div>
        <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.profiloChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={(val) => `${new Date(val).getDate()} ${new Date(val).toLocaleString('it-IT', {month: 'short'})}`} tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
              <RechartsTooltip contentStyle={tooltipStyle}/>
              <Line type="monotone" dataKey="visualizzazioni" name="Visualizzazioni profilo" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="post" name="Post" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 6. POST VISUALIZZATI NEL PERIODO */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex justify-between items-end mb-4 flex-wrap">
          <h2 className="text-xl font-semibold tracking-tight">Post visualizzati nel periodo</h2>
          <div className="flex gap-2">
            <MetricoolCard title="Visualizzazioni dei post" value="0" variant="blue" className="w-48" size="sm"/>
            <MetricoolCard title="Mi piace" value="0" variant="green" className="w-32" size="sm"/>
            <MetricoolCard title="Commenti" value="0" variant="pink" className="w-32" size="sm"/>
            <MetricoolCard title="Condivisi" value="0" variant="purple" className="w-32" size="sm"/>
          </div>
        </div>
        <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.postVisualizzatiChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={(val) => `${new Date(val).getDate()} ${new Date(val).toLocaleString('it-IT', {month: 'short'})}`} tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
              <RechartsTooltip contentStyle={tooltipStyle}/>
              <Line type="monotone" dataKey="visualizzazioni" name="Visualizzazioni" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="miPiace" name="Mi piace" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="commenti" name="Commenti" stroke="#f472b6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="condivisi" name="Condivisi" stroke="#c084fc" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 7. FONTI E MEDIE */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold tracking-tight">Fonti di Impression</h2>
            <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <Columns size={14}/> Visualizza la tabella
            </button>
          </div>
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-xl text-sm">
            I dati delle Impression non sono disponibili per il periodo in corso.
          </div>
        </div>

        <div className="bg-card border rounded-xl p-6 shadow-sm flex flex-col h-[250px]">
          <h2 className="text-lg font-semibold tracking-tight mb-6">Medie delle visualizzazioni video</h2>
          <div className="flex-1 min-h-0 relative flex items-center">
            <div className="flex flex-col justify-between pr-4 pb-[24px] text-xs text-muted-foreground w-[150px] font-medium h-full">
              <span>Tempo medio guardato</span>
              <span>Durata media del video</span>
            </div>
            <div className="flex-1 h-full">
              <ResponsiveContainer>
                <ComposedChart layout="vertical" data={data.medieVisualizzazioniChart} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis type="number" stroke="hsl(var(--border))" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} domain={[0, 1.0]} />
                  <YAxis type="category" dataKey="date" hide />
                  <RechartsTooltip contentStyle={tooltipStyle} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* 8. ELENCO DEI POST */}
      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-xl font-semibold tracking-tight mb-4">Elenco dei post</h2>
        <MetricoolTable columns={videoColumns} data={data.posts} searchPlaceholder="Cerca video..." filename="tiktok_posts.csv" />
      </section>

    </div>
  )
}
