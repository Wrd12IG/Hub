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
  PieChart,
  Pie,
  Cell,
  BarChart
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

interface InteractionDataPoint {
  date: string;
  visualizzazioni: number;
  miPiace: number;
  nonMiPiace: number;
  commenti: number;
  condiviso: number;
}

interface SubscriberDataPoint {
  date: string;
  guadagnato: number;
  perso: number;
  video: number;
}

interface SummaryData {
  visualizzazioni: number;
  miPiace: number;
  nonMiPiace: number;
  commenti: number;
  condivisi: number;
  iscrittiGuadagnati: number;
  iscrittiPersi: number;
  iscrittiVideo: number;
}

interface Demographics {
  genere: { name: string, value: number, color: string }[];
  eta: { ageGroup: string, value: number }[];
  paese: { name: string, value: number, color: string }[];
  traffico: { fonte: string, ctr: number, percentuale: string }[];
}

interface DashboardData {
  summary: SummaryData;
  interactionChart: InteractionDataPoint[];
  subscriberChart: SubscriberDataPoint[];
  videos: VideoModel[];
  demographics: Demographics;
}

// --- Utils ---
const formatNumber = (num: number) => {
  if (num === 0 || !num) return '-';
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(2) + 'k';
  return num.toLocaleString('it-IT', { maximumFractionDigits: 2 });
};

export default function YouTubePage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/clients/${id}/youtube`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        if (!response.ok) throw new Error('Failed to fetch YouTube data');
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
                <Badge key={tag} variant="secondary" className="text-[10px] py-0 px-1 font-normal bg-red-100 text-red-800 hover:bg-red-100/80">{tag}</Badge>
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
    { key: 'visualizzazioni', label: 'Visualizzazioni', render: (row: any) => formatNumber(row.visualizzazioni) },
    { key: 'tempoVisualizzazione', label: 'Tempo vis.' },
    { key: 'durataMedia', label: 'Durata media' },
    { key: 'miPiace', label: 'Mi piace', render: (row: any) => formatNumber(row.miPiace) },
    { key: 'nonMiPiace', label: 'Non mi piace', render: (row: any) => formatNumber(row.nonMiPiace) },
    { key: 'commenti', label: 'Commenti', render: (row: any) => formatNumber(row.commenti) },
    { key: 'condivisi', label: 'Condivisi', render: (row: any) => formatNumber(row.condivisi) }
  ];

  const trafficoColumns = [
    { key: 'fonte', label: 'Fonte', isPrimary: true },
    { key: 'ctr', label: 'CTR', render: (row: any) => formatNumber(row.ctr) },
    { key: 'percentuale', label: 'Percentuale' }
  ];

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      
      {/* 1. INTERAZIONI VIDEO */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Interazioni Video</h2>
        <div className="flex justify-end gap-2 mb-4 flex-wrap">
          <MetricoolCard title="Visualizzazioni" value={data.summary.visualizzazioni} icon={Eye} variant="green" className="w-40" />
          <MetricoolCard title="Mi piace" value={data.summary.miPiace} icon={Heart} variant="blue" className="w-32" />
          <MetricoolCard title="Non mi piace" value={data.summary.nonMiPiace} variant="pink" className="w-32" />
          <MetricoolCard title="Commenti" value={data.summary.commenti} icon={MessageCircle} variant="purple" className="w-32" />
          <MetricoolCard title="Condiviso" value={data.summary.condivisi} icon={Share2} variant="blue" className="w-32" />
        </div>

        <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.interactionChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={(val) => `${new Date(val).getDate()} ${new Date(val).toLocaleString('it-IT', {month: 'short'})}`} tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="visualizzazioni" name="Visualizzazioni video" stroke="#86cc96" strokeWidth={2} dot={{r: 3}} />
              <Line type="monotone" dataKey="miPiace" name="Mi piace" stroke="#8b9af7" strokeWidth={2} dot={{r: 3}} />
              <Line type="monotone" dataKey="nonMiPiace" name="Non mi piace" stroke="#f472b6" strokeWidth={2} dot={{r: 3}} />
              <Line type="monotone" dataKey="commenti" name="Commenti" stroke="#c084fc" strokeWidth={2} dot={{r: 3}} />
              <Line type="monotone" dataKey="condiviso" name="Condiviso" stroke="#93c5fd" strokeWidth={2} dot={{r: 3}} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 2. SALDO DEGLI ABBONATI */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Saldo degli abbonati</h2>
          <div className="flex gap-2">
            <MetricoolCard title="Guadagnato" value={data.summary.iscrittiGuadagnati} icon={UserPlus} variant="blue" className="w-32" size="sm"/>
            <MetricoolCard title="Perso" value={data.summary.iscrittiPersi} icon={Users} variant="pink" className="w-32" size="sm"/>
            <MetricoolCard title="Video" value="-" icon={Video} variant="orange" className="w-32" size="sm"/>
          </div>
        </div>
        <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.subscriberChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={(val) => `${new Date(val).getDate()} ${new Date(val).toLocaleString('it-IT', {month: 'short'})}`} tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="guadagnato" name="Guadagnato" stroke="#60a5fa" strokeWidth={2} dot={{r: 3}} />
              <Line type="monotone" dataKey="perso" name="Perso" stroke="#f472b6" strokeWidth={2} dot={{r: 3}} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 3. TABELLA VIDEO */}
      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-xl font-semibold tracking-tight mb-4">Elenco dei video</h2>
        <MetricoolTable columns={videoColumns} data={data.videos} searchPlaceholder="Cerca video..." filename="youtube_videos.csv" />
      </section>

      {/* 4. DEMOGRAFICHE */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
        
        {/* Genere */}
        <div className="bg-card border rounded-xl p-6 shadow-sm flex flex-col h-[350px]">
          <h3 className="text-base font-semibold mb-6">Genere</h3>
          <div className="flex-1 min-h-0 relative flex items-center">
            <ResponsiveContainer width="60%" height="100%">
              <PieChart>
                <Pie
                  data={data.demographics.genere}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {data.demographics.genere.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-[40%] flex flex-col justify-center gap-3">
              {data.demographics.genere.map((item: any) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Spettatori per paese */}
        <div className="bg-card border rounded-xl p-6 shadow-sm flex flex-col h-[350px]">
          <h3 className="text-base font-semibold mb-6">Spettatori per paese</h3>
          <div className="flex-1 min-h-0 relative flex items-center">
            <ResponsiveContainer width="60%" height="100%">
              <PieChart>
                <Pie
                  data={data.demographics.paese}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {data.demographics.paese.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-[40%] flex flex-col justify-center gap-2 flex-wrap max-h-full overflow-hidden">
              {data.demographics.paese.map((item: any) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-xs font-medium truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Età */}
        <div className="bg-card border rounded-xl p-6 shadow-sm flex flex-col h-[350px]">
          <h3 className="text-base font-semibold mb-6">Età</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.demographics.eta} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="ageGroup" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} dy={5} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <RechartsTooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="#8b9af7" radius={[4,4,0,0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Origine del traffico */}
        <div className="bg-card border rounded-xl p-0 shadow-sm flex flex-col h-[350px] overflow-hidden">
           <div className="flex-1 overflow-auto -mx-4 px-4 h-full pt-4">
             <MetricoolTable columns={trafficoColumns} data={data.demographics.traffico} filename="traffico_youtube.csv" hideToolbar={true} />
           </div>
        </div>
      </section>

    </div>
  )
}
