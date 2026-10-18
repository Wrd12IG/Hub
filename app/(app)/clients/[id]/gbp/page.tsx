"use client"

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertCircle, Star, MessageSquare, Eye, MousePointerClick, StarHalf, MessageCircle } from 'lucide-react'
import {
  ComposedChart,
  Line,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  BarChart
} from 'recharts'
import { MetricoolCard } from '@/components/metricool/MetricoolCard'
import { MetricoolTable } from '@/components/metricool/MetricoolTable'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

// --- Types ---
interface Recensione {
  id: string;
  utenteNome: string;
  utenteIniziale: string;
  utenteColore: string;
  avatarUrl?: string;
  messaggio: string;
  data: string;
  valutazione: number;
  risposta: boolean;
}

interface ParolaChiave {
  parola: string;
  impression: number;
}

interface Sede {
  id: string;
  nome: string;
  totaleRecensioni: number;
  valutazione: number | null;
}

interface DashboardData {
  sedi?: Sede[];
  coperturaSummary: any;
  clicSummary: any;
  recensioniSummary: any;
  coperturaChart: any[];
  clicChart: any[];
  recensioniChart: any[];
  distribuzioneCopertura: any[];
  paroleChiave: ParolaChiave[];
  recensioni: Recensione[];
}

// --- Utils ---
const formatNumber = (num: number) => {
  if (num === 0 || !num) return '-';
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(2) + 'k';
  return num.toLocaleString('it-IT', { maximumFractionDigits: 2 });
};

export default function GbpPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Sede e periodo prima stavano solo nella scheda "Profilo GBP" del cliente, che duplicava questa pagina
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [sede, setSede] = useState<string>('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setSede(q.get('sede') ?? '');
    const d = Number(q.get('days'));
    if (d === 7 || d === 90) setDays(d);
    setReady(true);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ days: String(days) });
      if (sede) query.set('locationId', sede);
      const response = await fetch(`/api/clients/${id}/gbp?${query}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const result = await response.json().catch(() => ({}));
      // Il messaggio dell'API (es. "nessuna sede configurata") è quello utile, non un generico "failed to fetch"
      if (!response.ok) throw new Error(result?.error || `Errore ${response.status}`);
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (ready) fetchData(); }, [id, days, sede, ready]);

  // L'errore va controllato PRIMA dello scheletro: con `loading || !data` per primo, una richiesta fallita
  // lasciava lo scheletro grigio per sempre e l'errore non compariva mai.
  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] gap-4 text-center px-6">
        <AlertCircle size={48} className="text-destructive" />
        <p className="font-semibold text-destructive max-w-xl">Errore nel caricamento: {error}</p>
        <button onClick={fetchData} className="px-4 py-2 rounded-lg border text-sm font-semibold hover:bg-muted transition-colors">Riprova</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
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

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star 
          key={i} 
          size={16} 
          fill={i <= rating ? '#eab308' : 'transparent'} 
          className={i <= rating ? "text-yellow-500" : "text-muted-foreground"}
        />
      );
    }
    return <div className="flex gap-0.5">{stars}</div>;
  };

  const recensioniColumns = [
    { 
      key: 'utente', 
      label: 'Utente', 
      render: (row: Recensione) => (
        <div className="flex items-center gap-3">
          <div className="relative">
            {row.avatarUrl ? (
              <img src={row.avatarUrl} alt={row.utenteNome} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-lg" style={{ background: row.utenteColore }}>
                {row.utenteIniziale}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 bg-orange-500 rounded-full p-[2px] border-2 border-background">
              <Star size={10} fill="#fff" className="text-white" />
            </div>
          </div>
          <span className="font-medium text-foreground">{row.utenteNome}</span>
        </div>
      )
    },
    { 
      key: 'messaggio', 
      label: 'Messaggio',
      render: (row: Recensione) => (
        <div className="max-w-[400px]">
          <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
            {row.messaggio}
          </p>
          <button className="text-primary hover:underline text-xs font-medium mt-1 flex items-center gap-1">
            <MessageSquare size={12} /> Altro
          </button>
        </div>
      )
    },
    { 
      key: 'data', 
      label: 'Data', 
      render: (row: Recensione) => (
        <span className="text-muted-foreground text-sm">{row.data}</span>
      ) 
    },
    { 
      key: 'valutazione', 
      label: 'Valutazione', 
      render: (row: Recensione) => renderStars(row.valutazione) 
    },
    { 
      key: 'risposta', 
      label: 'Risposta', 
      render: (row: Recensione) => (
        <div className="flex flex-col items-start gap-2">
          <span className="font-medium text-foreground text-sm">{row.risposta ? 'Sì' : 'No'}</span>
          <button className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-1 rounded-full text-xs font-medium transition-colors">
            Modifica
          </button>
        </div>
      ) 
    }
  ];

  const paroleChiaveColumns = [
    { key: 'parola', label: 'Parola chiave' },
    { key: 'impression', label: 'Impression', render: (row: ParolaChiave) => formatNumber(row.impression) }
  ];

  return (
    <div className={`flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 transition-opacity ${loading ? 'opacity-50' : ''}`} aria-busy={loading}>

      {/* BARRA: sede e periodo */}
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Google Business Profile</h1>
          <p className="text-sm text-muted-foreground">
            {sede ? (data.sedi?.find(s => s.id === sede)?.nome ?? sede) : `Tutte le sedi${data.sedi ? ` (${data.sedi.length})` : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(data.sedi?.length ?? 0) > 1 && (
            <select
              aria-label="Sede"
              value={sede}
              onChange={(e) => setSede(e.target.value)}
              className="text-sm font-medium px-3 py-2 rounded-lg border bg-card max-w-[300px]"
            >
              <option value="">Tutte le sedi</option>
              {data.sedi!.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          )}
          <select
            aria-label="Periodo"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as 7 | 30 | 90)}
            className="text-sm font-medium px-3 py-2 rounded-lg border bg-card"
          >
            <option value={7}>Ultimi 7 giorni</option>
            <option value={30}>Ultimi 30 giorni</option>
            <option value={90}>Ultimi 90 giorni</option>
          </select>
        </div>
      </section>

      {/* 1. COPERTURA */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Copertura</h2>
        
        <div className="flex justify-end gap-2 mb-4">
          <MetricoolCard title="Google Maps" value={data.coperturaSummary.googleMaps} variant="blue" className="w-48" />
          <MetricoolCard title="Ricerca Google" value={data.coperturaSummary.ricercaGoogle} variant="pink" className="w-48" />
          <MetricoolCard title="Totale" value={data.coperturaSummary.totale} variant="orange" className="w-48" />
        </div>

        <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.coperturaChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis yAxisId="left" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" hide />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Bar yAxisId="right" dataKey="totale" name="Totale" fill="#fcebc7" barSize={10} radius={[4, 4, 0, 0]} opacity={0.6} />
              <Line yAxisId="left" type="monotone" dataKey="googleMaps" name="Google Maps" stroke="#8b9af7" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="left" type="monotone" dataKey="ricercaGoogle" name="Ricerca Google" stroke="#fc8bd2" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 2. DISTRIBUZIONE E PAROLE CHIAVE */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
        <div className="bg-card border rounded-xl p-6 shadow-sm flex flex-col h-[400px]">
          <h3 className="text-base font-semibold mb-6">La distribuzione della copertura per fonte</h3>
          <div className="flex-1 min-h-0 relative flex items-center">
            <ResponsiveContainer width="60%" height="100%">
              <PieChart>
                <Pie
                  data={data.distribuzioneCopertura}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {data.distribuzioneCopertura.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value: number) => formatNumber(value)}
                  contentStyle={tooltipStyle}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-[40%] flex flex-col justify-center gap-3">
              {data.distribuzioneCopertura.map((item: any) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-0 shadow-sm flex flex-col h-[400px] overflow-hidden">
          <div className="flex-1 overflow-auto -mx-4 px-4 h-full pt-4">
             <MetricoolTable columns={paroleChiaveColumns} data={data.paroleChiave} filename="parole_chiave_gbp.csv" />
          </div>
        </div>
      </section>

      {/* 3. CLIC */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Clic</h2>
          <div className="flex gap-2">
            <MetricoolCard title="Sito Web" value={data.clicSummary.sitoWeb} variant="blue" className="w-32" size="sm"/>
            <MetricoolCard title="Telefono" value={data.clicSummary.telefono} variant="green" className="w-32" size="sm"/>
            <MetricoolCard title="Indirizzo" value={data.clicSummary.indirizzo} variant="pink" className="w-32" size="sm"/>
            <MetricoolCard title="Totale" value={data.clicSummary.totale} variant="orange" className="w-32" size="sm"/>
          </div>
        </div>
        <div className="h-[250px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.clicChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis yAxisId="left" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" hide />
              <RechartsTooltip contentStyle={tooltipStyle}/>
              <Bar yAxisId="right" dataKey="totale" name="Totale" fill="#fcebc7" barSize={10} radius={[4, 4, 0, 0]} opacity={0.6}/>
              <Line yAxisId="left" type="monotone" dataKey="sitoWeb" name="Sito Web" stroke="#8b9af7" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="left" type="monotone" dataKey="telefono" name="Telefono" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="left" type="monotone" dataKey="indirizzo" name="Indirizzo" stroke="#f472b6" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* SEDI: totali di sempre e voto di ogni sede */}
      {(data.sedi?.length ?? 0) > 1 && !sede && (
        <section className="space-y-3 pt-4 border-t">
          <h2 className="text-xl font-semibold tracking-tight">Sedi</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {data.sedi!.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSede(s.id)}
                className="text-left bg-card border rounded-xl p-4 shadow-sm hover:border-primary/40 transition-colors"
              >
                <div className="text-sm font-semibold line-clamp-2">{s.nome}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {s.totaleRecensioni > 0 ? `${s.totaleRecensioni} recensioni · voto ${s.valutazione?.toFixed(1) ?? '—'}` : 'Nessuna recensione'}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 4. RECENSIONI */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Recensioni</h2>
          <div className="flex gap-2">
            <MetricoolCard title="Valutazione" value={data.recensioniSummary.valutazione} variant="blue" className="w-36" size="sm"/>
            <MetricoolCard title="Totale" value={data.recensioniSummary.totale} variant="orange" className="w-36" size="sm"/>
            <MetricoolCard title="Nel periodo" value={data.recensioniSummary.nelPeriodo ?? 0} variant="green" className="w-36" size="sm"/>
            <MetricoolCard title="Senza risposta" value={data.recensioniSummary.senzaRisposta ?? 0} variant="pink" className="w-36" size="sm"/>
          </div>
        </div>
        <div className="h-[250px] w-full bg-card border rounded-xl p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.recensioniChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis yAxisId="left" domain={[0, 6]} tick={{fontSize: 12, fill: "hsl(var(--muted-foreground))"}} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" hide />
              <RechartsTooltip contentStyle={tooltipStyle}/>
              <Bar yAxisId="right" dataKey="totale" name="Totale" fill="#fcebc7" barSize={10} radius={[4, 4, 0, 0]} opacity={0.6}/>
              <Line yAxisId="left" type="monotone" dataKey="valutazione" name="Valutazione" stroke="#8b9af7" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="pt-6">
          <h2 className="text-xl font-semibold tracking-tight mb-4">Lista delle recensioni</h2>
          <MetricoolTable columns={recensioniColumns} data={data.recensioni} filename="recensioni_gbp.csv" searchPlaceholder="Cerca recensioni..." />
        </div>
      </section>

    </div>
  )
}
