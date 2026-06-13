'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { MetricoolCard } from '@/components/metricool/MetricoolCard';
import { MetricoolTable } from '@/components/metricool/MetricoolTable';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, ComposedChart, Cell, PieChart, Pie
} from 'recharts';
import { Users, UserPlus, Image as ImageIcon, PlayCircle, Video, Type, Eye, Activity } from 'lucide-react';
import { MetricoolDatePicker } from '@/components/metricool/MetricoolDatePicker';
import { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';

export default function FacebookDashboard() {
  const params = useParams();
  const clientId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  });

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        let url = `/api/clients/${clientId}/facebook`;
        if (dateRange?.from && dateRange?.to) {
          url += `?start=${dateRange.from.toISOString()}&end=${dateRange.to.toISOString()}`;
        }
        
        const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        if (!res.ok) throw new Error('Failed to fetch Facebook data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [clientId, dateRange]);

  if (loading || !data) {
    return (
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Common Tooltip Style
  const tooltipStyle = {
    borderRadius: '8px', 
    border: '1px solid hsl(var(--border))', 
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
  };

  // Colonne per la tabella dei Post
  const postColumns = [
    {
      key: 'title',
      label: 'Post',
      render: (row: any) => (
        <div className="flex items-center gap-3 min-w-[300px]">
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden relative">
            {row.image ? (
              <img src={row.image} alt="post" className="object-cover w-full h-full" />
            ) : (
              <ImageIcon className="h-4 w-4 text-muted-foreground"/>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm line-clamp-1">{row.title}</span>
            <div className="flex gap-1">
              {row.tags?.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-[10px] py-0 px-1 font-normal bg-blue-100 text-blue-800 hover:bg-blue-100/80">{tag}</Badge>
              ))}
            </div>
          </div>
        </div>
      )
    },
    { key: 'date', label: 'Data' },
    { key: 'copertura', label: 'Copertura' },
    { key: 'visualizzazioni', label: 'Visualizzazioni' },
    { key: 'reazioni', label: 'Reazioni' },
    { key: 'commenti', label: 'Commenti' },
    { key: 'condivisi', label: 'Condivisi' },
    { key: 'clic', label: 'Clic' },
    { key: 'clicLink', label: 'Clic sui link' },
    { key: 'visVideo', label: 'Visualizzazioni video' },
    { key: 'tempoVideo', label: 'Tempo di visione del video' },
    { key: 'engagement', label: 'Engagement' },
    { key: 'spesa', label: 'Spesa' },
  ];

  // Colonne per la tabella dei Reels
  const reelColumns = [
    {
      key: 'title',
      label: 'Reel',
      render: (row: any) => (
        <div className="flex items-center gap-3 min-w-[300px]">
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
            <PlayCircle className="h-4 w-4 text-muted-foreground"/>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm line-clamp-1">{row.title}</span>
            <div className="flex gap-1">
              <Badge variant="secondary" className="text-[10px] py-0 px-1 font-normal bg-blue-100 text-blue-800 hover:bg-blue-100/80">Reel</Badge>
            </div>
          </div>
        </div>
      )
    },
    { key: 'date', label: 'Data' },
    { key: 'copertura', label: 'Copertura' },
    { key: 'visualizzazioniVideo', label: 'Visualizzazioni video' },
    { key: 'miPiace', label: 'Mi piace' },
    { key: 'azioni', label: 'Azioni' },
    { key: 'engagement', label: 'Engagement' },
    { key: 'tempoTotale', label: 'Tempo totale guardato' },
    { key: 'tempoMedio', label: 'Tempo medio guardato' },
  ];

  // Colonne per la tabella delle Storie
  const storieColumns = [
    {
      key: 'title',
      label: 'Storia',
      render: (row: any) => (
        <div className="flex items-center gap-3 min-w-[300px]">
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
            {row.tipo === 'Foto' ? <ImageIcon className="h-4 w-4 text-muted-foreground"/> : <Video className="h-4 w-4 text-muted-foreground" />}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-blue-600 cursor-pointer hover:underline line-clamp-1">{row.title}</span>
          </div>
        </div>
      )
    },
    { 
      key: 'date', 
      label: 'Data',
      render: (row: any) => (
        <div className="flex flex-col">
          <span className="text-sm">{new Date(row.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <span className="text-xs text-muted-foreground">{new Date(row.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )
    },
    { key: 'tipo', label: 'Tipo' }
  ];

  const cittaColumns = [
    { key: 'citta', label: 'Gruppo' },
    { key: 'conteggio', label: 'Conteggio' }
  ];

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      
      {/* SEZIONE 1: CRESCITA */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h2 className="text-xl font-semibold tracking-tight">Crescita</h2>
          <MetricoolDatePicker date={dateRange} setDate={setDateRange} />
        </div>
        
        <div className="flex justify-end gap-2 mb-4">
          <MetricoolCard title="Followers" value={data.crescitaSummary.followers} icon={Users} variant="green" trend={{ value: 2, isPositive: true }} className="w-48"/>
          <MetricoolCard title="Visualizzazioni" value={data.crescitaSummary.visualizzazioni} icon={Eye} variant="pink" className="w-48"/>
          <MetricoolCard title="Visite alla pagina" value={data.crescitaSummary.visitePagina} icon={Activity} variant="purple" trend={{ value: -1, isPositive: false }} className="w-48"/>
          <MetricoolCard title="Contenuti Totali" value={data.crescitaSummary.contenutiTotali} icon={ImageIcon} variant="orange" className="w-48"/>
        </div>

        <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.crescitaChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis yAxisId="left" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
              <Bar yAxisId="right" dataKey="contenuti" name="Contenuti" fill="#f59e0b" barSize={8} radius={[4, 4, 0, 0]} opacity={0.6}/>
              <Line yAxisId="left" type="monotone" dataKey="followers" name="Followers" stroke="#34d399" strokeWidth={2} dot={{r: 3}} activeDot={{r: 5}} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          <MetricoolCard title="Medie giornaliere dei nuovi follower" value={data.crescitaMedie.followersGiornalieri} variant="gray" size="sm" />
          <MetricoolCard title="Visualizzazioni di pagina giornaliere" value={data.crescitaMedie.visiteGiornaliere} variant="gray" size="sm" />
          <MetricoolCard title="Post giornalieri" value={data.crescitaMedie.postGiornalieri} variant="gray" size="sm" />
          <MetricoolCard title="Post a settimana" value={data.crescitaMedie.postSettimana} variant="gray" size="sm" />
        </div>

        {/* Saldo Follower */}
        <div className="mt-8">
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-lg font-semibold tracking-tight">Saldo dei follower</h3>
            <div className="flex gap-2">
              <MetricoolCard title="Acquisiti" value={data.saldoFollowerSummary.acquisiti} variant="blue" className="w-32" size="sm" trend={{value: 5, isPositive: true}}/>
              <MetricoolCard title="Persi" value={data.saldoFollowerSummary.persi} variant="pink" className="w-32" size="sm" trend={{value: -1, isPositive: false}}/>
              <MetricoolCard title="Contenuti totali" value={data.saldoFollowerSummary.contenutiTotali} variant="orange" className="w-32" size="sm"/>
            </div>
          </div>
          <div className="h-[200px] w-full bg-card border rounded-xl p-4 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.saldoFollower} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
                <RechartsTooltip cursor={{fill: 'hsl(var(--muted))', opacity: 0.4}} contentStyle={tooltipStyle}/>
                <Bar dataKey="acquisiti" name="Acquisiti" fill="#60a5fa" barSize={8} radius={[4, 4, 0, 0]} />
                <Bar dataKey="persi" name="Persi" fill="#f472b6" barSize={8} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Post visualizzati nel periodo */}
        <div className="mt-8">
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-lg font-semibold tracking-tight">Post visualizzati nel periodo</h3>
            <div className="flex gap-2">
              <MetricoolCard title="Visualizzazioni" value={data.postVisualizzatiSummary.visualizzazioni} variant="blue" className="w-36" size="sm" trend={{value: 2, isPositive: true}}/>
              <MetricoolCard title="Reazioni" value={data.postVisualizzatiSummary.reazioni} variant="green" className="w-32" size="sm" trend={{value: 1, isPositive: true}}/>
            </div>
          </div>
          <div className="h-[250px] w-full bg-card border rounded-xl p-4 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.postVisualizzatiChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={tooltipStyle}/>
                <Line type="monotone" dataKey="visualizzazioni" name="Visualizzazioni" stroke="#60a5fa" strokeWidth={2} dot={{r: 3}} />
                <Line type="monotone" dataKey="reazioni" name="Reazioni" stroke="#34d399" strokeWidth={2} dot={{r: 3}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* SEZIONE 2: DATI DEMOGRAFICI */}
      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-xl font-semibold tracking-tight">Dati demografici</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col h-[300px]">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Genere</h3>
            <div className="flex-1 min-h-0 relative flex items-center">
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie data={data.demographics.genere} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                    {data.demographics.genere.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-1/2 flex flex-col justify-center gap-2 px-4">
                {data.demographics.genere.map((item: any) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col h-[300px]">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Età</h3>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.demographics.eta} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
                  <YAxis tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
                  <RechartsTooltip cursor={{fill: 'hsl(var(--muted))', opacity: 0.4}} contentStyle={tooltipStyle}/>
                  <Bar dataKey="value" fill="#8b9af7" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col h-[350px]">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Followers per paese</h3>
            <div className="flex-1 min-h-0 relative flex items-center">
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie data={data.demographics.paese} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                    {data.demographics.paese.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-1/2 flex flex-col justify-center gap-2 px-4 overflow-y-auto">
                {data.demographics.paese.map((item: any) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col h-[350px] overflow-hidden">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Followers per città</h3>
            <div className="flex-1 overflow-auto -mx-4 px-4">
              <MetricoolTable data={data.demographics.citta} columns={cittaColumns} hideToolbar />
            </div>
          </div>

        </div>
      </section>

      {/* SEZIONE 3: CLIC */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Clic</h2>
          <div className="flex gap-2">
            <MetricoolCard title="Clic totali" value={data.clicSummary.clicTotali} variant="green" className="w-32" size="sm"/>
            <MetricoolCard title="Visite alla pagina" value={data.clicSummary.visitePagina} variant="purple" className="w-36" size="sm" trend={{value: 12, isPositive: true}}/>
            <MetricoolCard title="Contenuti totali" value={data.clicSummary.contenutiTotali} variant="orange" className="w-36" size="sm"/>
          </div>
        </div>
        <div className="h-[250px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.clicChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis yAxisId="left" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
              <RechartsTooltip contentStyle={tooltipStyle}/>
              <Bar yAxisId="right" dataKey="contenuti" fill="#f59e0b" barSize={8} radius={[4, 4, 0, 0]} opacity={0.6}/>
              <Line yAxisId="left" type="monotone" dataKey="visite" name="Visite alla pagina" stroke="#c084fc" strokeWidth={2} dot={{r: 3}} />
              <Line yAxisId="left" type="monotone" dataKey="clic" name="Clic" stroke="#34d399" strokeWidth={2} dot={{r: 3}} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* SEZIONE 4: POST PUBBLICATI (ORGANICO) */}
      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-xl font-semibold tracking-tight mb-6">Post pubblicati nel periodo</h2>
        
        <div>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <h3 className="text-lg font-medium">Panoramica</h3>
            <div className="flex flex-wrap gap-2">
              <MetricoolCard title="Engagement" value={data.organicoSummary.engagement} variant="blue" trend={{value: -0.05, isPositive: false}} size="sm"/>
              <MetricoolCard title="Interazioni" value={data.organicoSummary.interazioni} variant="green" trend={{value: 12, isPositive: true}} size="sm"/>
              <MetricoolCard title="Copertura media per post" value={data.organicoSummary.coperturaMedia} variant="pink" trend={{value: 5, isPositive: true}} size="sm"/>
              <MetricoolCard title="Visualizzazioni" value={data.organicoSummary.visualizzazioni} variant="purple" trend={{value: -1.2, isPositive: false}} size="sm"/>
              <MetricoolCard title="Post" value={data.organicoSummary.post} variant="orange" trend={{value: 2, isPositive: true}} size="sm"/>
            </div>
          </div>
          <div className="h-[250px] w-full bg-card border rounded-xl p-4 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.organicoChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis yAxisId="left" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={tooltipStyle}/>
                <Bar yAxisId="right" dataKey="post" fill="#f59e0b" barSize={8} radius={[4, 4, 0, 0]} opacity={0.6}/>
                <Line yAxisId="left" type="monotone" dataKey="visualizzazioni" stroke="#c084fc" strokeWidth={2} dot={{r: 3}} />
                <Line yAxisId="left" type="monotone" dataKey="copertura" stroke="#f472b6" strokeWidth={2} dot={{r: 3}} />
                <Line yAxisId="left" type="monotone" dataKey="interazioni" stroke="#34d399" strokeWidth={2} dot={{r: 3}} />
                <Line yAxisId="left" type="monotone" dataKey="engagement" stroke="#60a5fa" strokeWidth={2} dot={{r: 3}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="pt-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <h3 className="text-lg font-medium">Interazioni</h3>
            <div className="flex flex-wrap gap-2">
              <MetricoolCard title="Reazioni" value={data.interazioniOrganicheSummary.reazioni} variant="blue" trend={{value: 10, isPositive: true}} size="sm"/>
              <MetricoolCard title="Commenti" value={data.interazioniOrganicheSummary.commenti || '-'} variant="green" size="sm"/>
              <MetricoolCard title="Condivisi" value={data.interazioniOrganicheSummary.condivisi || '-'} variant="pink" size="sm"/>
              <MetricoolCard title="Clic" value={data.interazioniOrganicheSummary.clic} variant="purple" trend={{value: 12, isPositive: true}} size="sm"/>
              <MetricoolCard title="Post" value={data.interazioniOrganicheSummary.post} variant="orange" trend={{value: 2, isPositive: true}} size="sm"/>
            </div>
          </div>
          <div className="h-[250px] w-full bg-card border rounded-xl p-4 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.interazioniOrganicheChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis yAxisId="left" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={tooltipStyle}/>
                <Bar yAxisId="right" dataKey="post" fill="#f59e0b" barSize={8} radius={[4, 4, 0, 0]} opacity={0.6}/>
                <Line yAxisId="left" type="monotone" dataKey="clic" stroke="#c084fc" strokeWidth={2} dot={{r: 3}} />
                <Line yAxisId="left" type="monotone" dataKey="reazioni" stroke="#60a5fa" strokeWidth={2} dot={{r: 3}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-6">
          <MetricoolCard title="Reazioni giornaliere" value={data.organicoMedie.reazioniGiornaliere} variant="gray" size="sm" />
          <MetricoolCard title="Reazioni per post" value={data.organicoMedie.reazioniPerPost} variant="gray" size="sm" />
          <MetricoolCard title="Commenti giornalieri" value={data.organicoMedie.commentiGiornalieri || '-'} variant="gray" size="sm" />
          <MetricoolCard title="Commenti per post" value={data.organicoMedie.commentiPerPost || '-'} variant="gray" size="sm" />
          <MetricoolCard title="Condivisioni giornaliere" value={data.organicoMedie.condivisioniGiornaliere || '-'} variant="gray" size="sm" />
          <MetricoolCard title="Condivisioni per post" value={data.organicoMedie.condivisioniPerPost || '-'} variant="gray" size="sm" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col h-[200px]">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Tipi</h3>
            <div className="flex-1 min-h-0 relative flex items-center">
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie data={data.tipiVisualizzazioni.tipi} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value" stroke="none">
                    {data.tipiVisualizzazioni.tipi.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-1/2 flex flex-col justify-center gap-2 px-4">
                {data.tipiVisualizzazioni.tipi.map((item: any) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col h-[200px]">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Visualizzazioni</h3>
            <div className="flex-1 min-h-0 relative flex items-center">
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie data={data.tipiVisualizzazioni.visualizzazioni} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value" stroke="none">
                    {data.tipiVisualizzazioni.visualizzazioni.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-1/2 flex flex-col justify-center gap-2 px-4">
                {data.tipiVisualizzazioni.visualizzazioni.map((item: any) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEZIONE 5: LISTA POST */}
      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-xl font-semibold tracking-tight mb-4">Elenco dei post</h2>
        <MetricoolTable data={data.posts} columns={postColumns} searchPlaceholder="Cerca post..." filename="facebook_posts.csv" />
      </section>

      {/* SEZIONE 6: REELS PUBBLICATI NEL PERIODO */}
      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-xl font-semibold tracking-tight mb-6">Reels pubblicati nel periodo</h2>
        
        <div>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <h3 className="text-lg font-medium">Riepilogo</h3>
            <div className="flex flex-wrap gap-2">
              <MetricoolCard title="Engagement" value={data.reelsSummary.engagement} variant="blue" trend={{value: -0.05, isPositive: false}} size="sm"/>
              <MetricoolCard title="Interazioni" value={data.reelsSummary.interazioni} variant="green" trend={{value: 12, isPositive: true}} size="sm"/>
              <MetricoolCard title="Copertura media per reel" value={data.reelsSummary.coperturaMedia} variant="pink" trend={{value: 5, isPositive: true}} size="sm"/>
              <MetricoolCard title="Visualizzazioni video" value={data.reelsSummary.visualizzazioniVideo} variant="purple" trend={{value: -1.2, isPositive: false}} size="sm"/>
              <MetricoolCard title="Reels" value={data.reelsSummary.reels} variant="orange" trend={{value: 2, isPositive: true}} size="sm"/>
            </div>
          </div>
          <div className="h-[250px] w-full bg-card border rounded-xl p-4 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.reelsChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis yAxisId="left" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={tooltipStyle}/>
                <Bar yAxisId="right" dataKey="reels" fill="#f59e0b" barSize={8} radius={[4, 4, 0, 0]} opacity={0.6}/>
                <Line yAxisId="left" type="monotone" dataKey="visualizzazioni" stroke="#c084fc" strokeWidth={2} dot={{r: 3}} />
                <Line yAxisId="left" type="monotone" dataKey="copertura" stroke="#f472b6" strokeWidth={2} dot={{r: 3}} />
                <Line yAxisId="left" type="monotone" dataKey="interazioni" stroke="#34d399" strokeWidth={2} dot={{r: 3}} />
                <Line yAxisId="left" type="monotone" dataKey="engagement" stroke="#60a5fa" strokeWidth={2} dot={{r: 3}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="pt-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <h3 className="text-lg font-medium">Interazioni</h3>
            <div className="flex flex-wrap gap-2">
              <MetricoolCard title="Mi piace" value={data.reelsInterazioniSummary.miPiace} variant="green" trend={{value: 10, isPositive: true}} size="sm"/>
              <MetricoolCard title="Azioni" value={data.reelsInterazioniSummary.azioni} variant="pink" size="sm"/>
              <MetricoolCard title="Reels" value={data.reelsInterazioniSummary.reels} variant="orange" trend={{value: 2, isPositive: true}} size="sm"/>
            </div>
          </div>
          <div className="h-[250px] w-full bg-card border rounded-xl p-4 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.reelsInterazioniChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis yAxisId="left" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={tooltipStyle}/>
                <Bar yAxisId="right" dataKey="reels" fill="#f59e0b" barSize={8} radius={[4, 4, 0, 0]} opacity={0.6}/>
                <Line yAxisId="left" type="monotone" dataKey="azioni" stroke="#c084fc" strokeWidth={2} dot={{r: 3}} />
                <Line yAxisId="left" type="monotone" dataKey="miPiace" stroke="#34d399" strokeWidth={2} dot={{r: 3}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="pt-6">
          <h2 className="text-xl font-semibold tracking-tight mb-4">Lista dei Reels</h2>
          <MetricoolTable data={data.reels} columns={reelColumns} searchPlaceholder="Cerca reels..." filename="facebook_reels.csv" />
        </div>
      </section>

      {/* SEZIONE 7: STORIE */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Storie</h2>
          <div className="flex gap-2">
            <MetricoolCard title="Storie" value={data.storieSummary.storie} variant="orange" className="w-32" size="sm"/>
          </div>
        </div>
        <div className="h-[200px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.storieChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
              <RechartsTooltip cursor={{fill: 'hsl(var(--muted))', opacity: 0.4}} contentStyle={tooltipStyle}/>
              <Bar dataKey="storie" name="Storie" fill="#fcebc7" barSize={12} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="pt-6">
          <h2 className="text-xl font-semibold tracking-tight mb-4">Lista delle storie</h2>
          <MetricoolTable data={data.storieList} columns={storieColumns} searchPlaceholder="Cerca storie..." filename="facebook_storie.csv" />
        </div>
      </section>

    </div>
  );
}
