"use client"

import React, { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { AlertCircle, Bot, DollarSign, Target, TrendingUp, Activity } from 'lucide-react'
import { MetricoolCard } from '@/components/metricool/MetricoolCard'
import { MetricoolTable } from '@/components/metricool/MetricoolTable'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

// --- Types ---
interface Campaign {
  id: string;
  name: string;
  status: string;
  spend: number;
  cpa: number;
  roas: number | null;
}

export default function MetaAdsPage({ params: propsParams }: { params?: { id: string } }) {
  const params = useParams();
  const id = (propsParams?.id || params.id) as string;
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [apiSummary, setApiSummary] = useState<{ totalSpend: number; avgCpa: number; avgRoas: number | null; activeCampaigns: number } | null>(null);
  // Su quale azione l'account conta le conversioni: senza dirlo, un CPA è un
  // numero senza unità di misura.
  const [conversionLabel, setConversionLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const response = await fetch(`/api/clients/${id}/meta-ads`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        const data = await response.json();
        if (!response.ok) {
          // Il messaggio della route dice *cosa* manca (id account, token…);
          // "Failed to fetch" non diceva niente a nessuno.
          throw new Error(data?.error || `Il server ha risposto ${response.status}.`);
        }
        // La route restituisce { campaigns, summary, … }: prima qui finiva
        // l'intero oggetto nello stato delle campagne, quindi la tabella
        // riceveva un oggetto invece di un array e i totali erano sempre zero.
        setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []);
        setApiSummary(data.summary ?? null);
        setConversionLabel(data.conversionLabel ?? null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, [id]);

  // I totali arrivano dalla route, non ricalcolati qui: la versione
  // precedente faceva la media semplice dei CPA fra campagne, così una da €10
  // pesava quanto una da €500. Il CPA di un account è spesa totale diviso
  // conversioni totali, non la media di rapporti.
  const summary = useMemo(() => ({
    spend: apiSummary?.totalSpend ?? 0,
    cpa: apiSummary?.avgCpa ?? 0,
    roas: apiSummary?.avgRoas ?? null,
    active: apiSummary?.activeCampaigns ?? 0,
  }), [apiSummary]);

  if (loading) {
    return (
      <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
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

  const columns = [
    { 
      key: 'name', 
      label: 'Nome Campagna', 
      isPrimary: true,
      sortable: true,
      render: (row: Campaign) => (
        <span className="font-medium text-foreground">{row.name}</span>
      )
    },
    { 
      key: 'status', 
      label: 'Stato', 
      sortable: true,
      render: (row: Campaign) => (
        <Badge 
          variant={row.status === 'ACTIVE' ? 'default' : 'destructive'} 
          className={row.status === 'ACTIVE' ? 'bg-green-100 text-green-800 hover:bg-green-100/80 border-transparent' : 'bg-red-100 text-red-800 hover:bg-red-100/80 border-transparent'}
        >
          {row.status}
        </Badge>
      )
    },
    { 
      key: 'spend', 
      label: 'Spesa', 
      sortable: true,
      render: (row: Campaign) => `€${row.spend.toFixed(2)}`
    },
    { 
      key: 'cpa', 
      label: 'CPA', 
      sortable: true,
      render: (row: Campaign) => `€${row.cpa.toFixed(2)}`
    },
    { 
      key: 'roas', 
      label: 'ROAS', 
      sortable: true,
      // null = nessun valore conversione dall'account: uno zero si
      // leggerebbe come "pessimo", un trattino come "non misurabile".
      render: (row: Campaign) => row.roas === null ? '—' : `${row.roas.toFixed(2)}x`
    }
  ];

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
          <Bot size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Meta Ads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoraggio e gestione delle campagne Meta Ads (Facebook/Instagram).
            {/* Quale azione stiamo contando come conversione: cambia da account
                ad account (acquisti, lead, carrello…) e senza dirlo il CPA è
                un numero senza unità di misura. */}
            {conversionLabel && (
              <> Conversioni misurate su <strong className="text-foreground">{conversionLabel.toLowerCase()}</strong>.</>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricoolCard 
          title="Campagne Attive" 
          value={summary.active} 
          icon={Activity} 
          variant="blue" 
        />
        <MetricoolCard 
          title="Spesa Totale" 
          value={`€${summary.spend.toFixed(2)}`} 
          icon={DollarSign} 
          variant="orange" 
        />
        <MetricoolCard 
          title="CPA Medio" 
          value={`€${summary.cpa.toFixed(2)}`} 
          icon={Target} 
          variant="pink" 
        />
        <MetricoolCard 
          title="ROAS Medio" 
          value={summary.roas === null ? '—' : `${summary.roas.toFixed(2)}x`} 
          icon={TrendingUp} 
          variant="green" 
        />
      </div>

      <div className="pt-4 border-t">
        <h2 className="text-xl font-semibold tracking-tight mb-4">Elenco Campagne</h2>
        {campaigns.length === 0 ? (
          <div className="bg-card border rounded-xl p-8 text-center shadow-sm">
            <p className="text-muted-foreground">Nessuna campagna Meta trovata per questo cliente.</p>
          </div>
        ) : (
          <MetricoolTable 
            columns={columns} 
            data={campaigns} 
            filename="campagne_meta_ads.csv" 
            searchPlaceholder="Cerca campagna..." 
          />
        )}
      </div>

    </div>
  )
}
