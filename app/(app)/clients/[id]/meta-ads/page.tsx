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
  roas: number;
}

export default function MetaAdsPage({ params: propsParams }: { params?: { id: string } }) {
  const params = useParams();
  const id = (propsParams?.id || params.id) as string;
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const response = await fetch(`/api/clients/${id}/meta-ads`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        if (!response.ok) {
          throw new Error('Failed to fetch Meta Ads campaigns');
        }
        const data = await response.json();
        setCampaigns(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, [id]);

  const summary = useMemo(() => {
    if (!campaigns.length) return { spend: 0, cpa: 0, roas: 0, active: 0 };
    
    const active = campaigns.filter(c => c.status === 'ACTIVE').length;
    const spend = campaigns.reduce((acc, c) => acc + c.spend, 0);
    const avgCpa = campaigns.reduce((acc, c) => acc + c.cpa, 0) / campaigns.length;
    const avgRoas = campaigns.reduce((acc, c) => acc + c.roas, 0) / campaigns.length;

    return { spend, cpa: avgCpa, roas: avgRoas, active };
  }, [campaigns]);

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
      render: (row: Campaign) => `${row.roas.toFixed(2)}x`
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
          value={`${summary.roas.toFixed(2)}x`} 
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
