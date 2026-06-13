'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { MetricoolCard } from '@/components/metricool/MetricoolCard';
import { MetricoolTable } from '@/components/metricool/MetricoolTable';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, ComposedChart, Cell, PieChart, Pie
} from 'recharts';
import { Users, UserPlus, Image as ImageIcon, Heart, MessageCircle, Bookmark, Share2, PlayCircle, Eye, Activity, Hash } from 'lucide-react';
import { MetricoolDatePicker } from '@/components/metricool/MetricoolDatePicker';
import { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';

export default function InstagramDashboard() {
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
        let url = `/api/clients/${clientId}/instagram`;
        if (dateRange?.from && dateRange?.to) {
          url += `?start=${dateRange.from.toISOString()}&end=${dateRange.to.toISOString()}`;
        }
        
        const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        if (!res.ok) throw new Error('Failed to fetch Instagram data');
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

  // Column definitions for Posts
  const postColumns = [
    {
      key: 'title',
      label: 'Post',
      render: (row: any) => (
        <div className="flex items-center gap-3 min-w-[300px]">
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
            <ImageIcon className="h-4 w-4 text-muted-foreground"/>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm line-clamp-1">{row.title}</span>
            <div className="flex gap-1">
              {(row.tags || []).map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-[10px] py-0 px-1 font-normal bg-emerald-100 text-emerald-800 hover:bg-emerald-100/80">{tag}</Badge>
              ))}
            </div>
          </div>
        </div>
      )
    },
    { key: 'date', label: 'Data' },
    { key: 'copertura', label: 'Copertura organica' },
    { key: 'viste', label: 'Viste Organiche' },
    { key: 'interazioni', label: 'Interazioni organiche' },
    { key: 'miPiace', label: 'Mi piace organici' },
    { key: 'commenti', label: 'Commenti organici' },
    { key: 'engagement', label: 'Engagement organico' },
  ];

  // Column definitions for Reels
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
              {(row.tags || []).map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-[10px] py-0 px-1 font-normal bg-emerald-100 text-emerald-800 hover:bg-emerald-100/80">{tag}</Badge>
              ))}
            </div>
          </div>
        </div>
      )
    },
    { key: 'date', label: 'Data' },
    { key: 'copertura', label: 'Copertura organica' },
    { key: 'viste', label: 'Viste Organiche' },
    { key: 'interazioni', label: 'Interazioni organiche' },
    { key: 'miPiace', label: 'Mi piace organici' },
    { key: 'risposteSalvate', label: 'Risposte salvate' },
    { key: 'azioni', label: 'Azioni Organiche' },
    { key: 'commenti', label: 'Commenti organici' },
    { key: 'engagement', label: 'Engagement organico' },
    { key: 'tempoMedio', label: 'Tempo medio di visualizzazione' },
    { key: 'tempoTot', label: 'Tempo di visualizzazione totale' },
    { key: 'durata', label: 'Durata' },
    { key: 'ritenzione', label: '% Ritenzione' },
    { key: 'vis15s', label: '% Visualizzazione (15 sec)' },
  ];

  // Column definitions for Hashtags
  const hashtagColumns = [
    { key: 'parola', label: 'Hashtag' },
    { key: 'viste', label: 'Viste Organiche', sortable: true },
    { key: 'post', label: 'Numero di post', sortable: true },
    { key: 'miPiace', label: 'Mi piace', sortable: true },
    { key: 'commenti', label: 'Commenti', sortable: true },
  ];

  // Column definitions for City
  const cittaColumns = [
    { key: 'citta', label: 'Gruppo' },
    { key: 'conteggio', label: 'Conteggio' }
  ];

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      
      {/* -------------------------------------------------------------------------
          SEZIONE 1: CRESCITA
          ------------------------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h2 className="text-xl font-semibold tracking-tight">Crescita</h2>
          <MetricoolDatePicker date={dateRange} setDate={setDateRange} />
        </div>
        
        {/* Header Cards (Metricool-style placed on top right or spanning) */}
        <div className="flex justify-end gap-2 mb-4">
          <MetricoolCard 
            title="Followers" 
            value={data.crescitaSummary.followers} 
            icon={Users} 
            variant="blue"
            trend={{ value: 2, isPositive: true }} 
            className="w-48"
          />
          <MetricoolCard 
            title="Seguiti" 
            value={data.crescitaSummary.seguiti} 
            icon={UserPlus} 
            variant="green"
            trend={{ value: -1, isPositive: false }} 
            className="w-48"
          />
          <MetricoolCard 
            title="Contenuti Totali" 
            value={data.crescitaSummary.contenutiTotali} 
            icon={ImageIcon} 
            variant="orange" 
            className="w-48"
          />
        </div>

        {/* Crescita Chart */}
        <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.crescitaChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis yAxisId="left" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
              <RechartsTooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
              <Bar yAxisId="right" dataKey="contenuti" name="Contenuti" fill="#f59e0b" barSize={8} radius={[4, 4, 0, 0]} />
              <Line yAxisId="left" type="monotone" dataKey="followers" name="Followers" stroke="#60a5fa" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} />
              <Line yAxisId="left" type="monotone" dataKey="seguiti" name="Seguiti" stroke="#34d399" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Medie Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-4">
          <MetricoolCard title="Followers" value={data.crescitaMedie.followers} variant="gray" size="sm" />
          <MetricoolCard title="Followers giornalieri" value={data.crescitaMedie.followersGiornalieri} variant="gray" size="sm" />
          <MetricoolCard title="Followers per post" value={data.crescitaMedie.followersPerPost} variant="gray" size="sm" />
          <MetricoolCard title="Seguiti" value={data.crescitaMedie.seguiti} variant="gray" size="sm" />
          <MetricoolCard title="Post giornalieri" value={data.crescitaMedie.postGiornalieri} variant="gray" size="sm" />
          <MetricoolCard title="Post a settimana" value={data.crescitaMedie.postSettimana} variant="gray" size="sm" />
        </div>

        {/* Saldo Follower */}
        <div className="mt-8">
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-lg font-semibold tracking-tight">Saldo dei follower</h3>
            <MetricoolCard 
              title="Followers" 
              value={data.crescitaMedie.followers} 
              variant="green" 
              className="w-32"
              size="sm"
            />
          </div>
          <div className="h-[200px] w-full bg-card border rounded-xl p-4 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.saldoFollower} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
                <RechartsTooltip cursor={{fill: 'hsl(var(--muted))', opacity: 0.4}} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}/>
                <Bar dataKey="value" name="Saldo">
                  {data.saldoFollower.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#34d399' : '#f472b6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------------
          SEZIONE 2: DATI DEMOGRAFICI
          ------------------------------------------------------------------------- */}
      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-xl font-semibold tracking-tight">Dati demografici</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Genere - Donut */}
          <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col h-[300px]">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Genere</h3>
            <div className="flex-1 min-h-0 relative flex items-center">
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie
                    data={data.demographics.genere}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
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

          {/* Età - Bar */}
          <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col h-[300px]">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Età</h3>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.demographics.eta} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
                  <YAxis tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
                  <RechartsTooltip cursor={{fill: 'hsl(var(--muted))', opacity: 0.4}} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}/>
                  <Bar dataKey="value" fill="#8b9af7" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Paese - Donut */}
          <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col h-[350px]">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Followers per paese</h3>
            <div className="flex-1 min-h-0 relative flex items-center">
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie
                    data={data.demographics.paese}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
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

          {/* Città - Table */}
          <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col h-[350px] overflow-hidden">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Followers per città</h3>
            <div className="flex-1 overflow-auto -mx-4 px-4">
              <MetricoolTable 
                data={data.demographics.citta} 
                columns={cittaColumns} 
                hideToolbar 
              />
            </div>
          </div>

        </div>
      </section>

      {/* -------------------------------------------------------------------------
          SEZIONE 3: POST PUBBLICATI (ORGANICO)
          ------------------------------------------------------------------------- */}
      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-xl font-semibold tracking-tight mb-6">Post pubblicati nel periodo</h2>
        
        {/* Riepilogo organico */}
        <div>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <h3 className="text-lg font-medium">Riepilogo organico</h3>
            <div className="flex flex-wrap gap-2">
              <MetricoolCard title="Engagement" value={data.organicoSummary.engagement} variant="blue" trend={{value: -0.05, isPositive: false}} size="sm"/>
              <MetricoolCard title="Interazioni" value={data.organicoSummary.interazioni} variant="green" trend={{value: 12, isPositive: true}} size="sm"/>
              <MetricoolCard title="Copertura media per reel" value={data.organicoSummary.coperturaMedia} variant="pink" trend={{value: 5, isPositive: true}} size="sm"/>
              <MetricoolCard title="Visualizzazioni" value={`${(data.organicoSummary.visualizzazioni / 1000).toFixed(2)}k`} variant="purple" trend={{value: -1.2, isPositive: false}} size="sm"/>
              <MetricoolCard title="Reels" value={data.organicoSummary.reels} variant="orange" trend={{value: 2, isPositive: true}} size="sm"/>
            </div>
          </div>
          <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.organicoChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis yAxisId="left" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}/>
                <Bar yAxisId="right" dataKey="contenuti" fill="#f59e0b" barSize={8} radius={[4, 4, 0, 0]} opacity={0.6}/>
                <Line yAxisId="left" type="monotone" dataKey="visualizzazioni" stroke="#c084fc" strokeWidth={2} dot={{r: 3}} />
                <Line yAxisId="left" type="monotone" dataKey="copertura" stroke="#f472b6" strokeWidth={2} dot={{r: 3}} />
                <Line yAxisId="left" type="monotone" dataKey="interazioni" stroke="#34d399" strokeWidth={2} dot={{r: 3}} />
                <Line yAxisId="left" type="monotone" dataKey="engagement" stroke="#60a5fa" strokeWidth={2} dot={{r: 3}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Interazioni organiche */}
        <div className="pt-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <h3 className="text-lg font-medium">Interazioni organiche</h3>
            <div className="flex flex-wrap gap-2">
              <MetricoolCard title="Mi piace" value={data.interazioniOrganicheSummary.miPiace} variant="green" trend={{value: 10, isPositive: true}} size="sm"/>
              <MetricoolCard title="Commenti" value={data.interazioniOrganicheSummary.commenti} variant="pink" size="sm"/>
              <MetricoolCard title="Salvati" value={data.interazioniOrganicheSummary.salvati} variant="purple" trend={{value: 5, isPositive: true}} size="sm"/>
              <MetricoolCard title="Condivisi" value={data.interazioniOrganicheSummary.condivisi} variant="blue" trend={{value: 12, isPositive: true}} size="sm"/>
              <MetricoolCard title="Reels" value={data.interazioniOrganicheSummary.reels} variant="orange" trend={{value: 2, isPositive: true}} size="sm"/>
            </div>
          </div>
          <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.interazioniOrganicheChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis yAxisId="left" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}/>
                <Bar yAxisId="right" dataKey="contenuti" fill="#f59e0b" barSize={8} radius={[4, 4, 0, 0]} opacity={0.6}/>
                <Line yAxisId="left" type="monotone" dataKey="condivisi" stroke="#60a5fa" strokeWidth={2} dot={{r: 3}} />
                <Line yAxisId="left" type="monotone" dataKey="salvati" stroke="#c084fc" strokeWidth={2} dot={{r: 3}} />
                <Line yAxisId="left" type="monotone" dataKey="commenti" stroke="#f472b6" strokeWidth={2} dot={{r: 3}} />
                <Line yAxisId="left" type="monotone" dataKey="miPiace" stroke="#34d399" strokeWidth={2} dot={{r: 3}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Medie Organiche */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-6">
          <MetricoolCard title="Mi piace giornalieri" value={data.organicoMedie.miPiaceGiornalieri} variant="gray" size="sm" />
          <MetricoolCard title="Mi piace per post" value={data.organicoMedie.miPiacePerPost} variant="gray" size="sm" />
          <MetricoolCard title="Commenti giornalieri" value={data.organicoMedie.commentiGiornalieri} variant="gray" size="sm" />
          <MetricoolCard title="Commenti per post" value={data.organicoMedie.commentiPerPost} variant="gray" size="sm" />
          <MetricoolCard title="Mi piace per commento" value={data.organicoMedie.miPiacePerCommento} variant="gray" size="sm" />
        </div>
      </section>

      {/* -------------------------------------------------------------------------
          SEZIONE 4: LISTE DATI (POST, REELS, HASHTAG)
          ------------------------------------------------------------------------- */}
      <section className="space-y-8 pt-4 border-t">
        
        {/* Lista dei post */}
        <div>
          <h2 className="text-xl font-semibold tracking-tight mb-4">Lista dei post</h2>
          <MetricoolTable 
            data={data.posts} 
            columns={postColumns} 
            searchPlaceholder="Cerca post..." 
            filename="instagram_posts.csv" 
          />
        </div>

        {/* Lista dei reels */}
        <div>
          <h2 className="text-xl font-semibold tracking-tight mb-4">Lista dei reels</h2>
          <MetricoolTable 
            data={data.reels} 
            columns={reelColumns} 
            searchPlaceholder="Cerca reels..." 
            filename="instagram_reels.csv" 
          />
        </div>

        {/* Lista degli hashtag */}
        <div>
          <h2 className="text-xl font-semibold tracking-tight mb-4">Lista degli hashtag</h2>
          <MetricoolTable 
            data={data.hashtags} 
            columns={hashtagColumns} 
            searchPlaceholder="Cerca hashtag..." 
            filename="instagram_hashtags.csv" 
          />
        </div>

      </section>

    </div>
  );
}
