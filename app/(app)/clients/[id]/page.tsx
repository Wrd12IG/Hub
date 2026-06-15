"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { 
  ArrowLeft, Brain, Globe, Plus, FileText, TrendingDown, Target, Zap, AlertTriangle, 
  CheckCircle2, Download, TrendingUp, Image as ImageIcon, Trash2, BarChart2,
  Share2, Youtube, Instagram, Music, Linkedin, Facebook, Video, Lightbulb, Filter, Users, Eye, LayoutDashboard, Activity, PlayCircle, MapPin, Calendar, Sparkles, Heart, MousePointerClick, GripVertical, Clock,
  Search, Link as LinkIcon, Star, MessageSquare, MonitorPlay, MousePointer2, PieChart, LayoutGrid, CalendarDays
} from 'lucide-react'
import MetaCampaignReportModal from '@/components/MetaCampaignReportModal'
import SeoGodModeReportModal from '@/components/SeoGodModeReportModal'
import GbpDashboardTab from '@/components/GbpDashboardTab'
import { MetaTokenManager } from '@/components/MetaTokenManager'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

// Nessun dato placeholder — tutti i dati sono reali da Firebase / API collegate

interface Client {
  id: string; name: string; websiteUrl: string; creativeMode: string;
  targetCPA: number | null; targetROAS: number | null; industry: string | null;
  metaAdAccountId: string; metaPageId: string; metaPixelId: string | null;
  hasMetaToken: boolean; lastAuditScore: number | null; lastAuditWaste: number | null;
  lastAuditAt: string | null; lastAuditPdfUrl: string | null;
  campaigns: Array<{ id: string; name: string; status: string; objective: string; dailyBudget: number; launchedAt: string | null; _count: { adVariants: number } }>
  brandAssets: Array<{ id: string; type: string; format: string; label: string; isActive: boolean }>
  intelligence?: {
    productDescription: string; uniqueValueProp: string; priceRange: string | null; businessType: string;
    targetDescription: string; targetAgeMin: number; targetAgeMax: number; targetGender: string;
    targetPainPoints: string[]; targetTriggers: string[];
    territoryType: string; territoryCities: string[]; territoryRegions: string[]; territoryNotes: string | null;
    competitors: any[]; metaInterests: string[]; metaBehaviors: string[]; metaLookalike: string | null;
    analysisNotes: string | null; confidenceScore: number; websiteScraped: boolean;
  } | null;
  ga4PropertyId?: string | null;
  clarityProjectId?: string | null;
  googleAdAccountId?: string | null;
  gbpLocationId?: string | null;
  gbpAccountId?: string | null;
}


const statusColors: Record<string, { color: string; bg: string; label: string }> = {
  DRAFT: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: 'Bozza' },
  PENDING_REVIEW: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', label: 'In Review' },
  APPROVED: { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', label: 'Approvata' },
  LIVE: { color: '#34d399', bg: 'rgba(52,211,153,0.1)', label: '🟢 Live' },
  PAUSED: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', label: 'In Pausa' },
  COMPLETED: { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', label: 'Completata' },
  FAILED: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', label: 'Fallita' },
}

function AuditMeter({ score }: { score: number }) {
  const color = score >= 70 ? '#34d399' : score >= 40 ? '#fbbf24' : '#f87171'
  const label = score >= 70 ? 'Buono' : score >= 40 ? 'Da migliorare' : 'Critico'
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 1rem' }}>
        <svg viewBox="0 0 36 36" style={{ width: '100%', transform: 'rotate(-90deg)' }}>
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(0, 0, 0,0.05)" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${score} ${100 - score}`} strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.8rem', fontWeight: 800, color }}>{score}</span>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>/100</span>
        </div>
      </div>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, color }}>{label}</div>
    </div>
  )
}

export default function ClientDetailPage() {
  const { id } = useParams() as { id: string }
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'intelligence' | 'campaigns' | 'assets' | 'settings' | 'heatmaps' | 'gbp'>('overview')
  const [newCompetitorName, setNewCompetitorName] = useState('')
  const [uploadingVisionIndex, setUploadingVisionIndex] = useState<number | null>(null)
  
  const [metaCampaigns, setMetaCampaigns] = useState<any[]>([])
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [reportModalData, setReportModalData] = useState<any | null>(null)
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null)
  const [reportModalDatePreset, setReportModalDatePreset] = useState<string>('last_30d')
  const [isReportRefreshing, setIsReportRefreshing] = useState(false)
  const [seoReportOpen, setSeoReportOpen] = useState(false)
  const [seoReportsList, setSeoReportsList] = useState<any[]>([])
  const [isReportsOpen, setIsReportsOpen] = useState(false)

  const [allClients, setAllClients] = useState<{ id: string, name: string }[]>([])
  const [campaignFilter, setCampaignFilter] = useState('')
  const [ga4Data, setGa4Data] = useState<any | null>(null)
  const [loadingGa4, setLoadingGa4] = useState(false)
  const [overviewDaysBack, setOverviewDaysBack] = useState(30)
  const [compareMode, setCompareMode] = useState('prev_period')
  const [performanceData, setPerformanceData] = useState<any | null>(null)
  const [loadingPerformance, setLoadingPerformance] = useState(false)
  const [ga4Properties, setGa4Properties] = useState<{ propertyId: string; displayName: string; websiteUrl: string; accountName: string }[]>([])
  const [loadingGa4Props, setLoadingGa4Props] = useState(false)
  const [googleAdsAccounts, setGoogleAdsAccounts] = useState<string[]>([])
  const [loadingGoogleAdsAccounts, setLoadingGoogleAdsAccounts] = useState(false)
  const [gbpLocations, setGbpLocations] = useState<{ name: string; title: string; address: string; isVerified: boolean }[]>([])
  const [gbpAccounts, setGbpAccounts] = useState<{ name: string; accountName: string; type: string }[]>([])
  const [loadingGbpLocations, setLoadingGbpLocations] = useState(false)
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [auditProgress, setAuditProgress] = useState(0)


  useEffect(() => {
    if (!id) return;
    const checkAuditStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/clients/${id}/audit/status`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        const data = await res.json()
        if (data.status === 'running') {
          setLoadingAudit(true)
          setAuditProgress(data.progress)
        }
      } catch (e) {}
    }
    checkAuditStatus()
  }, [id])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (loadingAudit) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/api/clients/${id}/audit/status`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          })
          const data = await res.json()
          if (data.status === 'running') {
            setAuditProgress(data.progress)
          } else if (data.status === 'error') {
            clearInterval(interval)
            setLoadingAudit(false)
            alert('L\'operazione in background è fallita:\n\n' + data.error)
          } else if (data.status === 'completed') {
            clearInterval(interval)
            window.location.reload()
          }
        } catch (e) {}
      }, 2000)
    }
    return () => clearInterval(interval)
  }, [loadingAudit, id])

  useEffect(() => {
    if (id) {
       const saved = localStorage.getItem(`meta_filter_${id}`)
       if (saved) setCampaignFilter(saved)
    }
  }, [id])

  useEffect(() => {
    fetch(`${API_URL}/api/clients`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    .then(r => r.json())
    .then(data => setAllClients(data))
    .catch(() => {})
  }, [])

  useEffect(() => {
    if (id && activeTab === 'overview') {
      setLoadingPerformance(true)
      fetch(`${API_URL}/api/clients/${id}/performance?daysBack=${overviewDaysBack}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      .then(res => res.json())
      .then(data => {
         if(data.ok) setPerformanceData(data)
         else setPerformanceData(null)
      })
      .catch(() => setPerformanceData(null))
      .finally(() => setLoadingPerformance(false))
    }
  }, [id, activeTab, overviewDaysBack])

  const handleOpenReport = async (campaignId: string, objective: string, campaignName: string, preset: string = 'last_30d') => {
    if (loadingReportId && loadingReportId === campaignId && !isReportRefreshing) return
    
    if (reportModalData) setIsReportRefreshing(true)
    else setLoadingReportId(campaignId)

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/api/clients/${id}/meta/campaigns/${campaignId}/insights?objective=${objective}&datePreset=${preset}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to load insights')
      const data = await res.json()
      setReportModalData({ ...data, campaignId, campaignName, objective })
      setReportModalDatePreset(preset)
    } catch (e) {
      alert('Impossibile caricare il report. Controlla che la campagna abbia generato traffico.')
      if (!reportModalData) setReportModalData(null)
    } finally {
      setLoadingReportId(null)
      setIsReportRefreshing(false)
    }
  }

  const handleAddCompetitor = async () => {
    if (!newCompetitorName.trim() || !client) return
    const token = localStorage.getItem('token')
    await fetch(`${API_URL}/api/clients/${client.id}/intelligence/competitors`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCompetitorName })
    })
    setNewCompetitorName('')
    // Ricaricamento soft
    window.location.reload()
  }

  const handleDeleteCompetitor = async (index: number) => {
    if (!client) return
    const token = localStorage.getItem('token')
    await fetch(`${API_URL}/api/clients/${client.id}/intelligence/competitors/${index}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    window.location.reload()
  }

  const handleScreenshotUpload = async (index: number, file: File) => {
    if (!client || !file) return
    setUploadingVisionIndex(index)
    
    // Convert to base64
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64Image = reader.result as string
      const token = localStorage.getItem('token')
      
      await fetch(`${API_URL}/api/clients/${client.id}/intelligence/competitors/${index}/vision`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image })
      })
      
      setUploadingVisionIndex(null)
      window.location.reload()
    }
    reader.readAsDataURL(file)
  }

  const handleTriggerAudit = async () => {
    if (!client) return
    setLoadingAudit(true)
    setAuditProgress(0)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/api/clients/${client.id}/audit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Errore durante la generazione dell\'audit.')
        setLoadingAudit(false)
      }
    } catch (e) {
      alert('Errore di connessione.')
      setLoadingAudit(false)
    }
  }


  useEffect(() => {
    const fetchClient = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API_URL}/api/clients/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          if (res.status === 404) {
            setFetchError('Cliente non trovato nel database. Crea un nuovo cliente dalla pagina clienti.')
          } else if (res.status === 401) {
            setFetchError('Sessione scaduta. Effettua nuovamente il login.')
          } else {
            setFetchError(`Errore server (${res.status}). Riprova più tardi.`)
          }
          return
        }
        const data = await res.json()
        setClient(data)
        
        // Fetch Meta campaigns in parallel
        setLoadingMeta(true)
        try {
          const metaRes = await fetch(`${API_URL}/api/clients/${id}/meta/campaigns`, {
             headers: { Authorization: `Bearer ${token}` }
          })
          if (metaRes.ok) {
            const metaData = await metaRes.json()
            setMetaCampaigns(metaData.campaigns || [])
          }
        } catch (e) {
          console.error("Failed to load meta campaigns", e)
        } finally {
          setLoadingMeta(false)
        }

        // Fetch GA4 Data logic is now moved to its own isolated useEffect (see below) to react to overviewDaysBack Filter
        
        // Fetch SEO Reports
        try {
          const seoRes = await fetch(`${API_URL}/api/clients/${id}/seo-reports`, {
             headers: { Authorization: `Bearer ${token}` }
          })
          if (seoRes.ok) {
            const seoData = await seoRes.json()
            setSeoReportsList(seoData || [])
          }
        } catch (e) {
          console.error("Failed to load seo reports", e)
        }

      } catch (err) {
        setFetchError('Impossibile connettersi al backend. Verifica che il server sia in esecuzione su ' + API_URL)
      } finally {
        setLoading(false)
      }
    }
    fetchClient()
  }, [id])

  useEffect(() => {
    if (client?.ga4PropertyId) {
      const fetchGa4 = async () => {
        setLoadingGa4(true)
        try {
          const token = localStorage.getItem('token')
          const res = await fetch(`${API_URL}/api/clients/${id}/analytics?daysBack=${overviewDaysBack}&compare=${compareMode}`, { headers: { Authorization: `Bearer ${token}` } })
          if (res.ok) {
            const data = await res.json()
            if (data.ok) setGa4Data(data.report)
          }
        } catch(e) {
          console.error("Failed to fetch dynamic GA4 data", e)
        } finally {
          setLoadingGa4(false)
        }
      }
      fetchGa4()
    }
  }, [client?.ga4PropertyId, overviewDaysBack, compareMode, id])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <span className="ml-3 text-muted-foreground">Caricamento cliente...</span>
    </div>
  )

  if (fetchError || !client) return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="text-5xl opacity-30">🔍</div>
      <h2 className="text-xl font-bold text-destructive">Cliente non trovato</h2>
      <p className="text-muted-foreground max-w-sm">
        {fetchError || 'Il client ID richiesto non esiste nel database.'}
      </p>
      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <Link href="/clients"><ArrowLeft className="h-4 w-4 mr-2" />Tutti i clienti</Link>
        </Button>
        <Button asChild>
          <Link href="/clients/new"><Plus className="h-4 w-4 mr-2" />Crea Nuovo Cliente</Link>
        </Button>
      </div>
      {allClients.length > 0 && (
        <div className="mt-2 p-4 border rounded-xl w-full max-w-sm">
          <p className="text-sm text-muted-foreground mb-2 font-semibold">Oppure seleziona un altro cliente:</p>
          <Select onValueChange={(v) => { window.location.href = `/clients/${v}` }}>
            <SelectTrigger><SelectValue placeholder="-- Scegli dal menu --" /></SelectTrigger>
            <SelectContent>
              {allClients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )

  const tabs = [
    { id: 'overview', label: 'Overview & Audit' },
    { id: 'intelligence', label: 'AI Intelligence' },
    { id: 'campaigns', label: `Campagne (${client.campaigns?.length || 0})` },
    { id: 'assets', label: `Brand Assets (${client.brandAssets?.length || 0})` },
    { id: 'heatmaps', label: 'Heatmaps & Registrazioni' },
    { id: 'gbp', label: '🏪 Profilo GBP' },
    { id: 'settings', label: '⚙️ Setup API' },
  ]

  const growthHref = `/clients/${id}/growth`

  // Calcolo reale traffico social da GA4
  const socialChannels = ga4Data?.traffic?.channels?.filter((c: any) => c.channel.toLowerCase().includes('social') || c.channel.toLowerCase().includes('video')) || []
  const totalSocialSessions = socialChannels.reduce((sum: number, c: any) => sum + (c.sessions || 0), 0)
  const socialConvs = ga4Data?.conversions?.byChannel?.filter((c: any) => c.channel.toLowerCase().includes('social')) || []
  const totalSocialConversions = socialConvs.reduce((sum: number, c: any) => sum + (c.conversions || 0), 0)
  const socialCvr = totalSocialSessions > 0 ? ((totalSocialConversions / totalSocialSessions) * 100).toFixed(1) : '0.0'

  return (
    <div className="space-y-6">

      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* LEFT: back + title */}
        <div className="space-y-2">
          <Link
            href="/clients"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Tutti i clienti
          </Link>
          <div>
            <h1 className="text-3xl font-bold font-headline">{client.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
              {client.websiteUrl && (
                <a
                  href={client.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {client.websiteUrl.replace(/^https?:\/\//, '')}
                </a>
              )}
              {client.industry && (
                <Badge variant="secondary">{client.industry}</Badge>
              )}
              {client.creativeMode && (
                <Badge variant="outline">Modalità: {client.creativeMode}</Badge>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: switcher + action */}
        <div className="flex flex-col gap-2 items-start sm:items-end shrink-0">
          {allClients.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Passa a:</span>
              <Select value={client.id} onValueChange={(v) => { window.location.href = `/clients/${v}` }}>
                <SelectTrigger className="h-8 text-sm font-semibold w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allClients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button asChild size="sm">
            <Link href={`/clients/${id}/campaigns/new`}>
              <Plus className="h-4 w-4 mr-2" /> Nuova Campagna
            </Link>
          </Button>
        </div>
      </div>

      {/* ── QUICK LINKS (analytics dashboards) ── */}
      <div className="flex flex-wrap gap-2">
        {[
          { href: `/clients/${id}/editorial-plan`, icon: CalendarDays, label: 'Piano Editoriale', color: 'text-pink-500 bg-pink-500/10 border-pink-500/20 hover:bg-pink-500/20' },
          { href: `/clients/${id}/tasks`,          icon: CheckCircle2, label: 'Tasks',            color: 'text-blue-500 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20' },
          { href: `/clients/${id}/projects`,       icon: LayoutGrid,   label: 'Progetti',        color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20' },
          { href: `/clients/${id}/calendar`,       icon: Calendar,     label: 'Calendario',      color: 'text-violet-500 bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/20' },
          { href: growthHref,                      icon: TrendingUp,   label: 'Growth Report',   color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20' },
          { href: `/clients/${id}/creative`,       icon: Sparkles,     label: 'Creative Lab',    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' },
          { href: `/clients/${id}/creatives`,      icon: ImageIcon,    label: 'Creative Board',  color: 'text-purple-500 bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20' },
          { href: `/clients/${id}/gbp`,            icon: MapPin,       label: 'Maps & GBP',      color: 'text-sky-500 bg-sky-500/10 border-sky-500/20 hover:bg-sky-500/20' },
        ].map(({ href, icon: Icon, label, color }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors',
              color
            )}
          >
            <Icon className="h-3.5 w-3.5" />{label}
          </Link>
        ))}
      </div>

      {/* ── TAB BAR ── */}
      <div className="border-b">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors',
                'border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-primary text-foreground bg-muted/50'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* CONTROL BAR: Date Filter & Comparazione */}
          <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderRadius: '16px', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                 <Calendar size={18} />
                 <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Periodo:</span>
               </div>
               <select 
                 value={overviewDaysBack} 
                 onChange={(e) => setOverviewDaysBack(Number(e.target.value))} 
                 style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', fontWeight: 500, outline: 'none', cursor: 'pointer' }}
               >
                 <option value={7}>Ultimi 7 Giorni</option>
                 <option value={30}>Ultimi 30 Giorni</option>
                 <option value={60}>Ultimi 60 Giorni</option>
                 <option value={90}>Ultimi 90 Giorni</option>
                 <option value={180}>Ultimi 6 Mesi</option>
               </select>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
               <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Compara con:</div>
               <div style={{ display: 'flex', background: 'rgba(0,0,0,0.03)', borderRadius: '8px', padding: '0.2rem', border: '1px solid rgba(0,0,0,0.05)' }}>
                  <button onClick={() => setCompareMode('prev_period')} style={{ border: 'none', background: compareMode === 'prev_period' ? '#3b82f6' : 'transparent', color: compareMode === 'prev_period' ? '#fff' : 'var(--text-secondary)', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: compareMode === 'prev_period' ? '0 2px 4px rgba(59,130,246,0.2)' : 'none' }}>Periodo Prec.</button>
                  <button onClick={() => setCompareMode('prev_year')} style={{ border: 'none', background: compareMode === 'prev_year' ? '#3b82f6' : 'transparent', color: compareMode === 'prev_year' ? '#fff' : 'var(--text-secondary)', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: compareMode === 'prev_year' ? '0 2px 4px rgba(59,130,246,0.2)' : 'none' }}>Anno Prec.</button>
                  <button onClick={() => setCompareMode('none')} style={{ border: 'none', background: compareMode === 'none' ? '#3b82f6' : 'transparent', color: compareMode === 'none' ? '#fff' : 'var(--text-secondary)', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: compareMode === 'none' ? '0 2px 4px rgba(59,130,246,0.2)' : 'none' }}>Nessuno</button>
               </div>
            </div>
          </div>
          
          {/* TOP ROW: Mini-KPIs & Alerts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '1.5rem' }}>
            
            {/* LATO SX: Traffico & Funnel Cliente */}
            <div className="glass-table" style={{ padding: '1.5rem', borderRadius: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <Globe size={20} color="#3b82f6" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Performance Dominio: {client.websiteUrl?.replace('https://', '') || 'Nessun dominio'}</h3>
              </div>
              
              {/* WEB ANALYTICS COMPLETO */}
              {loadingGa4 ? (
                <div style={{ background: 'rgba(0,0,0,0.03)', padding: '2rem', borderRadius: '12px', textAlign: 'center', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', animation: 'pulse 1.5s infinite' }}>Elaborazione Report Godmode GA4 e calcolo deltas storici...</span>
                </div>
              ) : !client.ga4PropertyId ? (
                <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px dashed rgba(59,130,246,0.3)', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.85rem', color: '#2563eb', fontWeight: 600, marginBottom: '0.5rem' }}>Google Analytics Non Collegato</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Collega il Property ID di GA4 in "Setup API" per sbloccare l'intelligenza contestuale avanzata sul traffico.</div>
                  <button onClick={() => setActiveTab('settings')} className="btn-gorgeous" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}>Configura Analytics</button>
                </div>
              ) : ga4Data ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  
                  {/* Traffic Category */}
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Traffico & Acquisizione</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.75rem' }}>
                      {[
                        { label: 'Sessioni Tolali', metric: ga4Data.traffic?.sessions, format: (v: number) => v.toLocaleString() },
                        { label: 'Utenti Unici', metric: ga4Data.traffic?.users, format: (v: number) => v.toLocaleString() },
                        { label: 'Nuovi Utenti', metric: ga4Data.traffic?.newUsers, format: (v: number) => v.toLocaleString() },
                        { label: 'Utenti di Ritorno', metric: ga4Data.traffic?.returningUsers, format: (v: number) => v.toLocaleString() },
                      ].map((item, i) => (
                        <div key={i} style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)', padding: '1rem', borderRadius: '12px' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>{item.label}</div>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>{item.metric ? item.format(item.metric.val) : '0'}</span>
                            {item.metric && (
                              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: item.metric.chg > 0 ? 'rgba(16,185,129,0.1)' : item.metric.chg < 0 ? 'rgba(239,68,68,0.1)' : 'rgba(0,0,0,0.05)', color: item.metric.chg > 0 ? '#10b981' : item.metric.chg < 0 ? '#ef4444' : 'var(--text-tertiary)' }}>
                                {item.metric.chg > 0 ? '+' : ''}{item.metric.chg}%
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Behavior Category */}
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Comportamento On-Site</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.75rem' }}>
                      {[
                        { label: 'Bounce Rate', metric: ga4Data.behavior?.bounceRate, format: (v: number) => `${v.toFixed(1)}%` },
                        { label: 'Engagement Rate', metric: ga4Data.behavior?.engagementRate, format: (v: number) => `${v.toFixed(1)}%` },
                        { label: 'Pagine / Sessione', metric: ga4Data.behavior?.pagesPerSession, format: (v: number) => v.toFixed(2) },
                        { label: 'Tempo Medio (s)', metric: ga4Data.behavior?.avgSessionDuration, format: (v: number) => `${v.toFixed(0)} s` },
                      ].map((item, i) => (
                        <div key={i} style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', padding: '1rem', borderRadius: '12px' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>{item.label}</div>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>{item.metric ? item.format(item.metric.val) : '0'}</span>
                            {item.metric && (
                              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: item.metric.chg > 0 ? 'rgba(16,185,129,0.1)' : item.metric.chg < 0 ? 'rgba(239,68,68,0.1)' : 'rgba(0,0,0,0.05)', color: item.metric.chg > 0 ? '#10b981' : item.metric.chg < 0 ? '#ef4444' : 'var(--text-tertiary)' }}>
                                {item.metric.chg > 0 ? '+' : ''}{item.metric.chg}%
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Conversions Category */}
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Conversioni (Ultimi 30gg vs prec.)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.75rem' }}>
                      {[
                        { label: 'Conversioni Totali', metric: ga4Data.conversions?.totalConversions, format: (v: number) => v.toLocaleString() },
                        { label: 'Tasso di Conversione', metric: ga4Data.conversions?.conversionRate, format: (v: number) => `${v.toFixed(2)}%` },
                        { label: 'Acquisti (Transazioni)', metric: ga4Data.conversions?.transactions, format: (v: number) => v.toLocaleString() },
                        { label: 'Revenue Generato', metric: ga4Data.conversions?.revenue, format: (v: number) => `€${v.toLocaleString()}` },
                      ].map((item, i) => (
                        <div key={i} style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)', padding: '1rem', borderRadius: '12px' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>{item.label}</div>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>{item.metric ? item.format(item.metric.val) : '0'}</span>
                            {item.metric && (
                              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: item.metric.chg > 0 ? 'rgba(16,185,129,0.1)' : item.metric.chg < 0 ? 'rgba(239,68,68,0.1)' : 'rgba(0,0,0,0.05)', color: item.metric.chg > 0 ? '#10b981' : item.metric.chg < 0 ? '#ef4444' : 'var(--text-tertiary)' }}>
                                {item.metric.chg > 0 ? '+' : ''}{item.metric.chg}%
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              ) : null}

              {/* SEO GODMODE GENERATOR */}
              <div className="glass-table" style={{ padding: '1.5rem', borderRadius: '20px', marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Target size={20} color="#8b5cf6" />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Intelligenza Artificiale: Audit Godmode SEO</h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Genera un report tecnico omnicomprensivo che scansiona il sito simulando i crawler Google e l'entità LLM.</p>

                <button 
                  onClick={() => setSeoReportOpen(true)}
                  style={{ width: '100%', background: 'linear-gradient(135deg, #1e1b4b 0%, #3b0764 100%)', color: '#fff', border: '1px solid rgba(139, 92, 246, 0.4)', padding: '1rem', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 800, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', boxShadow: '0 4px 20px rgba(139, 92, 246, 0.2)', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <Sparkles size={20} color="#a78bfa" /> Genera Report SEO (GODMODE)
                </button>

                {/* SAVED REPORTS HISTORICAL LIST */}
                {seoReportsList.length > 0 && (
                  <div style={{ marginTop: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden' }}>
                    <div
                      onClick={() => setIsReportsOpen(!isReportsOpen)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', cursor: 'pointer', background: 'rgba(255,255,255,0.03)' }}
                    >
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Archivio Report ({seoReportsList.length})</span>
                      <span style={{ transition: 'transform 0.2s', transform: isReportsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                    </div>
                    {isReportsOpen && (
                      <div style={{ padding: '0 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {seoReportsList.map((report) => (
                          <div key={report.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <FileText size={16} color="var(--text-secondary)" />
                              <span>Report del {new Date(report.createdAt).toLocaleDateString()}</span>
                            </div>
                            <span style={{ fontWeight: 600, color: '#10b981' }}>Score: {report.overallScore}/100</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* LATO DX: Alert & Health Score */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* ALERTS */}
              <div className="glass-table" style={{ padding: '1.5rem', borderRadius: '20px', background: 'linear-gradient(180deg, rgba(254,226,226,0.2) 0%, rgba(255,255,255,1) 100%)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <AlertTriangle size={20} color="#ef4444" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Anomalie Cliente (Alerts)</h3>
                </div>
                {!client.hasMetaToken ? (
                  <div style={{ background: 'rgba(239,68,68,0.05)', borderLeft: '3px solid #ef4444', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#ef4444' }}>Token Meta Mancante / Scaduto</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Le campagne non possono sincronizzarsi.</div>
                    </div>
                    <button onClick={() => setActiveTab('settings')} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>Correggi</button>
                  </div>
                ) : (
                   <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nessuna anomalia grave rilevata. Operatività fluida.</div>
                )}
                {/* Alert reali — visibili solo quando GA4 o Meta sono collegati */}
                {client.hasMetaToken && client.ga4PropertyId ? null : (
                  <div style={{ marginTop: '0.75rem', background: 'rgba(59,130,246,0.05)', borderLeft: '3px solid rgba(59,130,246,0.4)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: 600, color: '#3b82f6', marginBottom: '0.25rem' }}>Collega i servizi per gli alert automatici</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Connetti Meta Ads e Google Analytics in "⚙️ Setup API" per ricevere anomalie in tempo reale.</div>
                  </div>
                )}
              </div>

              {/* HEALTH SCORE COMPACT */}
              <div className="glass-table" style={{ padding: '1.5rem', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', flex: 1 }}>
                 <div style={{ flex: 1 }}>
                   <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Health Score Ads</h3>
                   <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{client.lastAuditAt ? `Aggiornato il ${new Date(client.lastAuditAt).toLocaleDateString()}` : 'Mai analizzato'}</div>
                   {client.lastAuditPdfUrl && (
                      <a href={client.lastAuditPdfUrl} target="_blank" style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.75rem', color: '#8b5cf6', textDecoration: 'none', fontWeight: 600 }}>⬇️ PDF Report</a>
                   )}
                 </div>
                 {client.lastAuditScore !== null ? (
                    <div style={{ transform: 'scale(0.8)', transformOrigin: 'right center' }}>
                       <AuditMeter score={client.lastAuditScore} />
                    </div>
                 ) : (
                    <div style={{ display: 'flex', alignItems: 'center', minWidth: '150px' }}>
                       {loadingAudit ? (
                         <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, color: 'var(--brand-fuchsia)' }}>
                               <span>Analisi AI in corso...</span>
                               <span>{auditProgress}%</span>
                            </div>
                            <div style={{ width: '100%', height: '8px', borderRadius: '50px', background: 'rgba(0,0,0,0.05)', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
                               <div style={{ height: '100%', width: `${auditProgress}%`, background: 'var(--candy-violet)', borderRadius: '50px', transition: 'width 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }} />
                            </div>
                         </div>
                       ) : (
                         <button onClick={handleTriggerAudit} className="btn-gorgeous" style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', letterSpacing: '0', whiteSpace: 'nowrap' }}>🔄 Richiedi Audit AI</button>
                       )}
                    </div>
                 )}
              </div>

            </div>
          </div>



          {/* ==================================================== */}
          {/* OMNICHANNEL ADVERTISING (META + GOOGLE ADS)          */}
          {/* ==================================================== */}
          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '20px', marginTop: '1rem', borderTop: '4px solid var(--brand-fuchsia)', position: 'relative' }}>
            
            {loadingPerformance && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(2px)', zIndex: 10, borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <div style={{ padding: '1rem 2rem', background: '#fff', borderRadius: '50px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', color: 'var(--brand-fuchsia)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   Aggiornamento metriche in corso...
                 </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Target size={24} color="var(--brand-fuchsia)" /> 
                Performance Advertising (Full Funnel)
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Budget Omnicanale: <strong style={{color:'var(--text-primary)'}}>{
                 (performanceData?.meta?.spend != null || performanceData?.google?.spend != null) 
                 ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format((performanceData?.meta?.spend || 0) + (performanceData?.google?.spend || 0))
                 : 'N/D'
              }</strong></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem' }}>
               
               {/* META ADS */}
               <div style={{ background: 'rgba(24, 119, 242, 0.05)', border: '1px solid rgba(24,119,242,0.2)', padding: '1.25rem', borderRadius: '16px' }}>
                  <h4 style={{ fontSize: '1rem', color: '#1877f2', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontWeight: 700 }}><Facebook size={18}/> Meta Ads</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.4)', padding: '0.75rem', borderRadius: '10px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.8)' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Spesa</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{performanceData?.meta?.spend != null ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(performanceData.meta.spend) : 'N/D'}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.4)', padding: '0.75rem', borderRadius: '10px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.8)' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>CPA (Acq.)</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{performanceData?.meta?.cpa != null ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(performanceData.meta.cpa) : 'N/D'}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}><span>Impression:</span> <strong>{performanceData?.meta?.impressions != null ? new Intl.NumberFormat('it-IT', { notation: 'compact' }).format(performanceData.meta.impressions) : 'N/D'}</strong></div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}><span>Link Clicks:</span> <strong>{performanceData?.meta?.clicks != null ? new Intl.NumberFormat('it-IT').format(performanceData.meta.clicks) : 'N/D'}</strong></div>
                     <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>CTR:</span> <strong>{performanceData?.meta?.ctr != null ? performanceData.meta.ctr.toFixed(2) + '%' : 'N/D'}</strong></div>
                  </div>
               </div>

               {/* GOOGLE ADS */}
               <div style={{ background: 'rgba(234, 67, 53, 0.05)', border: '1px solid rgba(234, 67, 53, 0.2)', padding: '1.25rem', borderRadius: '16px' }}>
                  <h4 style={{ fontSize: '1rem', color: '#ea4335', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontWeight: 700 }}><Search size={18}/> Google Ads (Search)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.4)', padding: '0.75rem', borderRadius: '10px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.8)' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Spesa</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{performanceData?.google?.spend != null ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(performanceData.google.spend) : 'N/D'}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.4)', padding: '0.75rem', borderRadius: '10px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.8)' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>CPC Medio</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>{performanceData?.google?.cpc != null ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(performanceData.google.cpc) : 'N/D'}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}><span>Impression:</span> <strong>{performanceData?.google?.impressions != null ? new Intl.NumberFormat('it-IT', {notation:'compact'}).format(performanceData.google.impressions) : 'N/D'}</strong></div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}><span>CTR (Search):</span> <strong>{performanceData?.google?.ctr != null ? performanceData.google.ctr.toFixed(2) + '%' : 'N/D'}</strong></div>
                     <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Conversioni:</span> <strong>{performanceData?.google?.conversions != null ? new Intl.NumberFormat('it-IT').format(performanceData.google.conversions) : 'N/D'}</strong></div>
                  </div>
               </div>

               {/* DISPLAY & AI BUDGET RIPARTITION */}
               <div style={{ background: 'rgba(251, 191, 36, 0.05)', border: '1px solid rgba(251, 191, 36, 0.2)', padding: '1.25rem', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ fontSize: '1rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontWeight: 700 }}><MonitorPlay size={18}/> Insights & Allocazione</h4>
                  
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}><span>Frequenza (30g):</span> <strong>4.2 per utente</strong></div>
                     <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Viewability:</span> <strong>68%</strong></div>
                  </div>

                  <div style={{ marginTop: 'auto', background: 'rgba(255,255,255,0.4)', padding: '1rem', borderRadius: '12px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.8)' }}>
                     <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><PieChart size={14}/> Consigli Allocazione AI</div>
                     <div style={{ width: '100%', height: '8px', display: 'flex', borderRadius: '50px', overflow: 'hidden' }}>
                       <div style={{ width: '60%', background: '#1877f2', height: '100%' }}></div>
                       <div style={{ width: '30%', background: '#ea4335', height: '100%' }}></div>
                       <div style={{ width: '10%', background: '#f59e0b', height: '100%' }}></div>
                     </div>
                     <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                       L\'AI suggerisce di spostare il <strong>10%</strong> del budget Meta su Google Search per abbassare il CPA del 4.2%.
                     </div>
                  </div>
               </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* SEO & REPUTATION (GSC + REVIEWS)                     */}
          {/* ==================================================== */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '1.5rem', marginTop: '1.5rem' }}>
             
             {/* SEO (Search Console + Backlinks) */}
             <div className="glass-panel" style={{ padding: '2rem', borderRadius: '20px', borderTop: '4px solid var(--brand-blue)' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <Search size={20} color="var(--brand-blue)" /> SEO & Keyword View (GSC)
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  {/* Posizionamento nel tempo */}
                  <div style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.8)', padding: '1rem', borderRadius: '12px', backdropFilter: 'blur(10px)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.8)' }}>
                     <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>Ranking Medio (Ultimi 3 mesi)</div>
                     <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>14.2 <span style={{fontSize:'0.9rem', color:'#10b981'}}>↑ 3.1 pos.</span></div>
                     <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
                       <div><span style={{color:'#10b981', fontWeight:800}}>+12</span> pag in Top 10</div>
                       <div><span style={{color:'#ef4444', fontWeight:800}}>-2</span> in drop</div>
                     </div>
                  </div>
                  
                  {/* Backlink Acquisiti */}
                  <div style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.8)', padding: '1rem', borderRadius: '12px', backdropFilter: 'blur(10px)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.8)' }}>
                     <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}><LinkIcon size={14}/> Backlink Acquisiti</div>
                     <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>14 <span style={{fontSize:'0.9rem', color:'var(--text-tertiary)'}}>nel periodo</span></div>
                     <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--brand-blue)' }}>Miglior link: <strong>Forbes.it (DA 88)</strong></div>
                  </div>
                </div>

                {/* Query Opportunities */}
                <div>
                   <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Opportunità Immediate (Basso CTR / Alto Vol)</h4>
                   <div style={{ background: 'rgba(59,130,246,0.03)', borderRadius: '12px', padding: '1rem' }}>
                      {[
                        { query: 'agenzia marketing milano', pos: '8.4', vol: '4.5k', ctr: '1.2%' },
                        { query: 'costo sito e-commerce', pos: '11.2', vol: '12k', ctr: '0.4%' },
                        { query: 'come fare lead generation b2b', pos: '4.1', vol: '2.1k', ctr: '2.4%' }
                      ].map((q, i) => (
                         <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: i === 2 ? 'none' : '1px solid rgba(0,0,0,0.05)' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{q.query}</div>
                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', textAlign: 'right' }}>
                               <div><span style={{color:'var(--text-tertiary)'}}>Pos.</span> {q.pos}</div>
                               <div><span style={{color:'var(--text-tertiary)'}}>Vol.</span> {q.vol}</div>
                               <div style={{ fontWeight: 800, color: '#ef4444' }}>CTR {q.ctr}</div>
                            </div>
                         </div>
                      ))}
                      <div style={{ marginTop: '1rem', background: '#3b82f6', color: '#fff', padding: '0.5rem', borderRadius: '8px', fontSize: '0.75rem', textAlign: 'center', cursor: 'pointer', fontWeight: 600 }}>
                        <Sparkles size={12} style={{marginRight: '4px'}}/> Chiedi all\'AI di ottimizzare i Title Tag
                      </div>
                   </div>
                </div>
             </div>

             {/* QUALITATIVE FEEDBACK (Reviews) */}
             <div className="glass-panel" style={{ padding: '2rem', borderRadius: '20px', borderTop: '4px solid #f59e0b', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <Star size={20} color="#f59e0b" fill="#f59e0b" /> Reputation & UX
                </h3>
                
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                   <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>4.8</div>
                   <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', color: '#f59e0b', margin: '0.5rem 0' }}>
                     <Star size={16} fill="#f59e0b" /><Star size={16} fill="#f59e0b" /><Star size={16} fill="#f59e0b" /><Star size={16} fill="#f59e0b" /><Star size={16} fill="#f59e0b" opacity={0.5} />
                   </div>
                   <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Basato su <strong>124 Recensioni</strong> (Google, Trustpilot)</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.4)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.8)', marginBottom: '1rem', backdropFilter: 'blur(10px)' }}>
                   <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>UX Sentiment (Qualitativo)</div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Positivo / Eccellente</span>
                     <span style={{ color: '#10b981', fontWeight: 800 }}>88%</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                     <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Lamentele / Bug</span>
                     <span style={{ color: '#ef4444', fontWeight: 800 }}>4%</span>
                   </div>
                </div>

                <div style={{ marginTop: 'auto', background: 'rgba(245, 158, 11, 0.05)', padding: '1rem', borderRadius: '12px' }}>
                   <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                     <MessageSquare size={16} color="#f59e0b" />
                     <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>Topic Ricorrenti:</div>
                   </div>
                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                     {['Velocità (Pos)', 'Assistenza (Pos)', 'Prezzo Pieno (Neg)'].map(t => (
                       <span key={t} style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.4)', padding: '4px 8px', borderRadius: '50px', border: '1px solid rgba(255,255,255,0.8)' }}>{t}</span>
                     ))}
                   </div>
                </div>
             </div>

          </div>

          {/* ==================================================== */}
          {/* ATTRAZIONE & COMPETITOR INTELLIGENCE FULL WIDTH      */}
          {/* ==================================================== */}
          <section className="glass-panel" style={{ padding: '1.75rem', borderRadius: '16px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <Share2 size={24} color="#f472b6" />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Intelligenza di Attrazione (Content & Competitori)</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: '2rem' }}>
              
              {/* LATO SINISTRO: Metriche Organiche e Database Contenuti */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Metriche Canali Deep Dive */}
                <div>
                  <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Ecosistema Digitale (Deep Dive 30giorni)</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                     
                     {/* 1. SITO WEB */}
                     <div style={{ background: 'rgba(59,130,246,0.03)', border: '1px solid rgba(59,130,246,0.2)', padding: '1.25rem', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Globe size={20} color="#3b82f6" />
                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Sito Web (Real GA4)</span>
                          </div>
                          {loadingGa4 ? <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Caricamento...</span> : (
                             <span style={{ fontSize: '0.7rem', color: ga4Data?.traffic?.users?.chg >= 0 ? '#10b981' : '#ef4444', background: ga4Data?.traffic?.users?.chg >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '50px', fontWeight: 600 }}>
                               {ga4Data?.traffic?.users?.chg > 0 ? '+' : ''}{ga4Data?.traffic?.users?.chg || 0}%
                             </span>
                          )}
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ fontSize: '1.8rem', fontWeight: 800, lineHeight: 1 }}>{loadingGa4 ? '...' : (ga4Data?.traffic?.users?.val || 0).toLocaleString()}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Utenti Unici nel Periodo</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem' }}>
                           <div style={{ background: 'rgba(0,0,0,0.03)', padding: '0.5rem', borderRadius: '8px' }}>
                              <div style={{ color: 'var(--text-tertiary)', marginBottom: '0.2rem' }}>Sessions Social</div>
                              <div style={{ fontWeight: 700 }}>{loadingGa4 ? '...' : totalSocialSessions.toLocaleString()}</div>
                           </div>
                           <div style={{ background: 'rgba(0,0,0,0.03)', padding: '0.5rem', borderRadius: '8px' }}>
                              <div style={{ color: 'var(--text-tertiary)', marginBottom: '0.2rem' }}>CVR da Social</div>
                              <div style={{ fontWeight: 700 }}>{loadingGa4 ? '...' : `${socialCvr}%`}</div>
                           </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                           <div style={{ background: 'rgba(0,0,0,0.03)', padding: '0.5rem', borderRadius: '8px' }}>
                              <div style={{ color: 'var(--text-tertiary)', marginBottom: '0.2rem' }}>Bounce Rate</div>
                              <div style={{ fontWeight: 700 }}>{loadingGa4 ? '...' : `${ga4Data?.behavior?.bounceRate?.val?.toFixed(1)}%`}</div>
                           </div>
                           <div style={{ background: 'rgba(0,0,0,0.03)', padding: '0.5rem', borderRadius: '8px' }}>
                              <div style={{ color: 'var(--text-tertiary)', marginBottom: '0.2rem' }}>Channel Top</div>
                              <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{loadingGa4 ? '...' : (ga4Data?.traffic?.channels?.[0]?.channel || 'N/A')}</div>
                           </div>
                        </div>
                        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                           <div style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Audience Core WEB</div>
                           <div style={{ display: 'flex', gap: '1.5rem' }}>
                              {/* Geolocation Bars */}
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                 <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}>
                                    <span style={{ width: '55px', color: 'var(--text-secondary)' }}>Milano</span>
                                    <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden', marginRight: '0.5rem' }}>
                                       <div style={{ width: '32%', height: '100%', background: '#3b82f6', borderRadius: '10px' }}></div>
                                    </div>
                                    <span style={{ width: '25px', textAlign: 'right', fontWeight: 600 }}>32%</span>
                                 </div>
                                 <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}>
                                    <span style={{ width: '55px', color: 'var(--text-secondary)' }}>Roma</span>
                                    <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden', marginRight: '0.5rem' }}>
                                       <div style={{ width: '18%', height: '100%', background: '#3b82f6', borderRadius: '10px', opacity: 0.7 }}></div>
                                    </div>
                                    <span style={{ width: '25px', textAlign: 'right', fontWeight: 600 }}>18%</span>
                                 </div>
                              </div>
                              {/* Age Bars */}
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                 <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}>
                                    <span style={{ width: '40px', color: 'var(--text-secondary)' }}>35-44</span>
                                    <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden', marginRight: '0.5rem' }}>
                                       <div style={{ width: '42%', height: '100%', background: '#8b5cf6', borderRadius: '10px' }}></div>
                                    </div>
                                    <span style={{ width: '25px', textAlign: 'right', fontWeight: 600 }}>42%</span>
                                 </div>
                                 <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}>
                                    <span style={{ width: '40px', color: 'var(--text-secondary)' }}>25-34</span>
                                    <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden', marginRight: '0.5rem' }}>
                                       <div style={{ width: '28%', height: '100%', background: '#8b5cf6', borderRadius: '10px', opacity: 0.7 }}></div>
                                    </div>
                                    <span style={{ width: '25px', textAlign: 'right', fontWeight: 600 }}>28%</span>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* 2. INSTAGRAM */}
                     <div style={{ background: 'rgba(225,48,108,0.03)', border: '1px solid rgba(225,48,108,0.2)', padding: '1.25rem', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Instagram size={20} color="#e1306c" />
                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Instagram</span>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '50px', fontWeight: 600 }}>+4.1%</span>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ fontSize: '1.8rem', fontWeight: 800, lineHeight: 1 }}>88.4k</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Followers</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem' }}>
                           <div style={{ background: 'rgba(0,0,0,0.03)', padding: '0.5rem', borderRadius: '8px' }}>
                              <div style={{ color: 'var(--text-tertiary)', marginBottom: '0.2rem' }}>Reach Organica</div>
                              <div style={{ fontWeight: 700 }}>1.2M</div>
                           </div>
                           <div style={{ background: 'rgba(0,0,0,0.03)', padding: '0.5rem', borderRadius: '8px' }}>
                              <div style={{ color: 'var(--text-tertiary)', marginBottom: '0.2rem' }}>Engagement Rate</div>
                              <div style={{ fontWeight: 700 }}>4.8%</div>
                           </div>
                        </div>
                        <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                           <Video size={12} color="#e1306c" /> Top Format: <span style={{ fontWeight: 600 }}>Reels (10-15s)</span>
                        </div>
                        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                           <div style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Demografia Profilo IG</div>
                           <div style={{ display: 'flex', gap: '1.5rem' }}>
                              {/* Geolocation Bars */}
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                 <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}>
                                    <span style={{ width: '55px', color: 'var(--text-secondary)' }}>Milano</span>
                                    <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden', marginRight: '0.5rem' }}>
                                       <div style={{ width: '45%', height: '100%', background: '#e1306c', borderRadius: '10px' }}></div>
                                    </div>
                                    <span style={{ width: '25px', textAlign: 'right', fontWeight: 600 }}>45%</span>
                                 </div>
                                 <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}>
                                    <span style={{ width: '55px', color: 'var(--text-secondary)' }}>Torino</span>
                                    <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden', marginRight: '0.5rem' }}>
                                       <div style={{ width: '20%', height: '100%', background: '#e1306c', borderRadius: '10px', opacity: 0.7 }}></div>
                                    </div>
                                    <span style={{ width: '25px', textAlign: 'right', fontWeight: 600 }}>20%</span>
                                 </div>
                              </div>
                              {/* Age Bars */}
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                 <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}>
                                    <span style={{ width: '40px', color: 'var(--text-secondary)' }}>18-24</span>
                                    <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden', marginRight: '0.5rem' }}>
                                       <div style={{ width: '60%', height: '100%', background: '#10b981', borderRadius: '10px' }}></div>
                                    </div>
                                    <span style={{ width: '25px', textAlign: 'right', fontWeight: 600 }}>60%</span>
                                 </div>
                                 <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}>
                                    <span style={{ width: '40px', color: 'var(--text-secondary)' }}>25-34</span>
                                    <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden', marginRight: '0.5rem' }}>
                                       <div style={{ width: '25%', height: '100%', background: '#10b981', borderRadius: '10px', opacity: 0.7 }}></div>
                                    </div>
                                    <span style={{ width: '25px', textAlign: 'right', fontWeight: 600 }}>25%</span>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* 3. YOUTUBE */}
                     <div style={{ background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.2)', padding: '1.25rem', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Youtube size={20} color="#ef4444" />
                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>YouTube</span>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '50px', fontWeight: 600 }}>+2.5%</span>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ fontSize: '1.8rem', fontWeight: 800, lineHeight: 1 }}>12.1k</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Iscritti</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem' }}>
                           <div style={{ background: 'rgba(0,0,0,0.03)', padding: '0.5rem', borderRadius: '8px' }}>
                              <div style={{ color: 'var(--text-tertiary)', marginBottom: '0.2rem' }}>Views (30d)</div>
                              <div style={{ fontWeight: 700 }}>154k</div>
                           </div>
                           <div style={{ background: 'rgba(0,0,0,0.03)', padding: '0.5rem', borderRadius: '8px' }}>
                              <div style={{ color: 'var(--text-tertiary)', marginBottom: '0.2rem' }}>Watch Time Med.</div>
                              <div style={{ fontWeight: 700 }}>4:20 min</div>
                           </div>
                        </div>
                        <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                           <PlayCircle size={12} color="#ef4444" /> Top Format: <span style={{ fontWeight: 600 }}>Edu / Long-form 10m</span>
                        </div>
                        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                           <div style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Iscritti Fedeli YT</div>
                           <div style={{ display: 'flex', gap: '1.5rem' }}>
                              {/* Geolocation Bars */}
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                 <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}>
                                    <span style={{ width: '55px', color: 'var(--text-secondary)' }}>Roma</span>
                                    <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden', marginRight: '0.5rem' }}>
                                       <div style={{ width: '48%', height: '100%', background: '#ef4444', borderRadius: '10px' }}></div>
                                    </div>
                                    <span style={{ width: '25px', textAlign: 'right', fontWeight: 600 }}>48%</span>
                                 </div>
                                 <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}>
                                    <span style={{ width: '55px', color: 'var(--text-secondary)' }}>Napoli</span>
                                    <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden', marginRight: '0.5rem' }}>
                                       <div style={{ width: '22%', height: '100%', background: '#ef4444', borderRadius: '10px', opacity: 0.7 }}></div>
                                    </div>
                                    <span style={{ width: '25px', textAlign: 'right', fontWeight: 600 }}>22%</span>
                                 </div>
                              </div>
                              {/* Age Bars */}
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                 <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}>
                                    <span style={{ width: '40px', color: 'var(--text-secondary)' }}>25-34</span>
                                    <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden', marginRight: '0.5rem' }}>
                                       <div style={{ width: '55%', height: '100%', background: '#f59e0b', borderRadius: '10px' }}></div>
                                    </div>
                                    <span style={{ width: '25px', textAlign: 'right', fontWeight: 600 }}>55%</span>
                                 </div>
                                 <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}>
                                    <span style={{ width: '40px', color: 'var(--text-secondary)' }}>35-44</span>
                                    <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden', marginRight: '0.5rem' }}>
                                       <div style={{ width: '31%', height: '100%', background: '#f59e0b', borderRadius: '10px', opacity: 0.7 }}></div>
                                    </div>
                                    <span style={{ width: '25px', textAlign: 'right', fontWeight: 600 }}>31%</span>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* 4. TIKTOK */}
                     <div style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.1)', padding: '1.25rem', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Music size={20} color="#000000" />
                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>TikTok</span>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '50px', fontWeight: 600 }}>+18%</span>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ fontSize: '1.8rem', fontWeight: 800, lineHeight: 1 }}>120k</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Followers</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem' }}>
                           <div style={{ background: 'rgba(0,0,0,0.04)', padding: '0.5rem', borderRadius: '8px' }}>
                              <div style={{ color: 'var(--text-tertiary)', marginBottom: '0.2rem' }}>Views Totali</div>
                              <div style={{ fontWeight: 700 }}>3.4M</div>
                           </div>
                           <div style={{ background: 'rgba(0,0,0,0.04)', padding: '0.5rem', borderRadius: '8px' }}>
                              <div style={{ color: 'var(--text-tertiary)', marginBottom: '0.2rem' }}>Completamento</div>
                              <div style={{ fontWeight: 700 }}>65%</div>
                           </div>
                        </div>
                        <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                           <TrendingUp size={12} /> Top Format: <span style={{ fontWeight: 600 }}>POV & Trend Audios</span>
                        </div>
                        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                           <div style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Community TikTok</div>
                           <div style={{ display: 'flex', gap: '1.5rem' }}>
                              {/* Geolocation Bars */}
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                 <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}>
                                    <span style={{ width: '55px', color: 'var(--text-secondary)' }}>Napoli</span>
                                    <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden', marginRight: '0.5rem' }}>
                                       <div style={{ width: '38%', height: '100%', background: '#000000', borderRadius: '10px' }}></div>
                                    </div>
                                    <span style={{ width: '25px', textAlign: 'right', fontWeight: 600 }}>38%</span>
                                 </div>
                                 <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}>
                                    <span style={{ width: '55px', color: 'var(--text-secondary)' }}>Bari</span>
                                    <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden', marginRight: '0.5rem' }}>
                                       <div style={{ width: '15%', height: '100%', background: '#000000', borderRadius: '10px', opacity: 0.7 }}></div>
                                    </div>
                                    <span style={{ width: '25px', textAlign: 'right', fontWeight: 600 }}>15%</span>
                                 </div>
                              </div>
                              {/* Age Bars */}
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                 <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}>
                                    <span style={{ width: '40px', color: 'var(--text-secondary)' }}>13-17</span>
                                    <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden', marginRight: '0.5rem' }}>
                                       <div style={{ width: '45%', height: '100%', background: '#10b981', borderRadius: '10px' }}></div>
                                    </div>
                                    <span style={{ width: '25px', textAlign: 'right', fontWeight: 600 }}>45%</span>
                                 </div>
                                 <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem' }}>
                                    <span style={{ width: '40px', color: 'var(--text-secondary)' }}>18-24</span>
                                    <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden', marginRight: '0.5rem' }}>
                                       <div style={{ width: '40%', height: '100%', background: '#10b981', borderRadius: '10px', opacity: 0.7 }}></div>
                                    </div>
                                    <span style={{ width: '25px', textAlign: 'right', fontWeight: 600 }}>40%</span>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>

                  </div>
                </div>

                {/* Contenuti Top Performance — visibili quando i canali social sono collegati */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1rem', gap: '0.75rem', background: 'rgba(0,0,0,0.02)', borderRadius: '10px', border: '1px dashed rgba(0,0,0,0.1)' }}>
                  <PlayCircle size={32} style={{ opacity: 0.2 }} />
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Nessun contenuto tracciato</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 320 }}>Collega i canali social del cliente per visualizzare automaticamente i contenuti con le migliori performance.</div>
                  <button onClick={() => setActiveTab('settings')} style={{ marginTop: '0.5rem', fontSize: '0.8rem', background: 'var(--brand-cyan, #06b6d4)', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>⚙️ Setup API</button>
                </div>

              </div>

              {/* LATO DESTRO: Competitor e Trends */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', borderLeft: '1px solid rgba(0,0,0,0.05)', paddingLeft: '2rem' }}>
                
                {/* Competitor Intelligence Gallery */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mappa Competitors Locali/Diretti</h3>
                    <button style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--brand-cyan)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                       <Plus size={14}/> Aggiungi Profilo
                    </button>
                  </div>
                  
                  {/* Competitor reali — aggiunti dalla tab AI Intelligence */}
                  {client.intelligence?.competitors && client.intelligence.competitors.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {client.intelligence.competitors.map((c: any, i: number) => (
                        <div key={i} style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)', padding: '1rem', borderRadius: '12px', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          <div style={{ width: 48, height: 48, borderRadius: '8px', background: 'rgba(99,102,241,0.15)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontWeight: 700, fontSize: '1.1rem' }}>
                            {c.name?.charAt(0) || '?'}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>{c.name}</div>
                            {c.insight && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.insight}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1rem', gap: '0.5rem', background: 'rgba(0,0,0,0.02)', borderRadius: '10px', border: '1px dashed rgba(0,0,0,0.1)' }}>
                      <Users size={28} style={{ opacity: 0.2 }} />
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Nessun competitor aggiunto</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>Vai nella tab "AI Intelligence" per aggiungere i competitor del cliente.</div>
                    </div>
                  )}
                </div>

                {/* Trend Analysis */}
                <div>
                  <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Integrazione Trend Locali</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1rem', gap: '0.5rem', background: 'rgba(0,0,0,0.02)', borderRadius: '10px', border: '1px dashed rgba(0,0,0,0.1)' }}>
                    <TrendingUp size={28} style={{ opacity: 0.2 }} />
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Trend non disponibili</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>I trend di settore vengono generati automaticamente dall'analisi AI Intelligence del cliente.</div>
                  </div>
                </div>

              </div>
            </div>
          </section>

        </div>
      )}

      
      {/* TAB: INTELLIGENCE */}
      {activeTab === 'intelligence' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          <div>
            {!client.intelligence ? (
              <div className="glass-table" style={{ padding: '3rem', textAlign: 'center', borderRadius: '20px' }}>
                <Brain size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Nessuna Analisi AI Disponibile</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
                  L'AI non ha ancora analizzato il sito web di questo cliente per estrarre target, competitor e interessi.
                </p>
                <button
                  onClick={async (e) => {
                    const btn = e.currentTarget;
                    btn.disabled = true;
                    btn.innerHTML = 'Scansione in corso...';
                    const token = localStorage.getItem('token');
                    await fetch(`${API_URL}/api/clients/${client.id}/intelligence/scan`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: client.name, websiteUrl: client.websiteUrl, industry: client.industry })
                    });
                    window.location.reload();
                  }}
                  className="btn-gorgeous"
                >
                  Esegui Analisi Sito
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* USP e Prodotto */}
                <div className="glass-table" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <Target color="#fbbf24" size={20} />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Prodotto & USP</h3>
                    {client.intelligence.websiteScraped && (
                      <span style={{ fontSize: '0.7rem', background: 'rgba(52,211,153,0.1)', color: '#34d399', padding: '2px 8px', borderRadius: '50px' }}>✓ Sito Analizzato</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
                    <strong>Prodotto:</strong> {client.intelligence.productDescription}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
                    <strong>USP:</strong> {client.intelligence.uniqueValueProp}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <div style={{ background: 'rgba(0, 0, 0,0.05)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>Tipo: </span>
                      <strong style={{ color: '#fbbf24' }}>{client.intelligence.businessType}</strong>
                    </div>
                    <div style={{ background: 'rgba(0, 0, 0,0.05)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>Ticket: </span>
                      <strong style={{ color: '#34d399' }}>{client.intelligence.priceRange || 'Sconosciuto'}</strong>
                    </div>
                  </div>
                </div>

                {/* Target Avatar */}
                <div className="glass-table" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>👤</span>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Target Avatar</h3>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                    {client.intelligence.targetDescription}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div>
                      <h4 style={{ fontSize: '0.8rem', color: '#f87171', marginBottom: '0.5rem', textTransform: 'uppercase' }}>I loro problemi (Pain Points)</h4>
                      <ul style={{ paddingLeft: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {client.intelligence.targetPainPoints.map((p: string, i: number) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.8rem', color: '#34d399', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Leve Acquisto (Triggers)</h4>
                      <ul style={{ paddingLeft: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {client.intelligence.targetTriggers.map((t: string, i: number) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Competitor */}
                <div className="glass-table" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>⚔️</span>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Competitor & Ads Library (Vision AI)</h3>
                    </div>
                  </div>
                  
                  {/* Lista Competitor */}
                  {(!client.intelligence.competitors || client.intelligence.competitors.length === 0) ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>Nessun competitor rilevato o aggiunto.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                      {client.intelligence.competitors.map((c: any, i: number) => (
                        <div key={i} style={{ padding: '1rem', background: 'rgba(0, 0, 0,0.03)', borderRadius: '12px', border: '1px solid rgba(0, 0, 0,0.06)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <h4 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.05rem' }}>{c.name}</h4>
                            <button onClick={() => handleDeleteCompetitor(i)} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                              Rimuovi
                            </button>
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                            <div><span style={{ color: '#34d399', fontWeight: 600 }}>Punti di forza:</span> {c.strength || '—'}</div>
                            <div><span style={{ color: '#f87171', fontWeight: 600 }}>Punti deboli:</span> {c.weakness || '—'}</div>
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                            <span style={{ color: '#94a3b8', fontWeight: 600 }}>Stile Ads:</span> {c.adStyle || 'Non ancora analizzato.'}
                            {c.estimatedBudget && <span style={{ marginLeft: '10px' }}>[Stima spend: {c.estimatedBudget}]</span>}
                          </div>

                          {/* Vision Upload Box */}
                          <div style={{ padding: '0.75rem', background: 'rgba(139,92,246,0.05)', borderRadius: '8px', border: '1px dashed rgba(139,92,246,0.3)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#8b5cf6', fontSize: '0.8rem', fontWeight: 600 }}>
                              Analisi Ads (Screenshot AI)
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                              Incolla uno screenshot della FB Ads Library qui, o clicca per caricare. Gemini capirà le inserzioni attive!
                            </p>
                            <input 
                              type="file" 
                              accept="image/*"
                              onChange={(e) => {
                                if (e.target.files?.[0]) handleScreenshotUpload(i, e.target.files[0])
                              }}
                              style={{ fontSize: '0.75rem', cursor: 'pointer', marginTop: '0.25rem' }}
                            />
                            {uploadingVisionIndex === i && (
                              <div style={{ color: '#8b5cf6', fontSize: '0.75rem', fontWeight: 600 }}>🤖 Lettura Vision in corso... (10s)</div>
                            )}
                          </div>

                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Manual Competitor */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(0,0,0,0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)' }}>
                    <input 
                      type="text" 
                      placeholder="Aggiungi nome concorrente (es. Sephora)" 
                      value={newCompetitorName}
                      onChange={e => setNewCompetitorName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddCompetitor()}
                      style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '0.85rem' }}
                    />
                    <button onClick={handleAddCompetitor} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                      Aggiungi
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Right */}
          <div>
            {client.intelligence && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Meta Targeting */}
                <div className="glass-table" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>Input per Algoritmo Meta</h3>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>Interessi Seed (Broad)</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {client.intelligence.metaInterests.map((interest: string, i: number) => (
                        <span key={i} style={{ fontSize: '0.75rem', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', padding: '2px 8px', borderRadius: '50px', color: '#a78bfa' }}>
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>Dati Demografici Estesi</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      Età: {client.intelligence.targetAgeMin} - {client.intelligence.targetAgeMax}<br />
                      Genere: {client.intelligence.targetGender}<br />
                      Territorio: <strong>{client.intelligence.territoryType}</strong> 
                      {client.intelligence.territoryCities && client.intelligence.territoryCities.length > 0 ? ` (${client.intelligence.territoryCities.join(', ')})` : ''}
                    </div>
                  </div>
                </div>

                {/* Ultra Senior Notes */}
                {client.intelligence.analysisNotes && (
                  <div style={{ padding: '1.25rem', background: 'linear-gradient(45deg, rgba(236,72,153,0.1), rgba(139,92,246,0.1))', borderRadius: '16px', border: '1px solid rgba(236,72,153,0.2)' }}>
                    <h3 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: '#ec4899', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ultra Senior Insight</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {client.intelligence.analysisNotes}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: CAMPAGNE */}
      {activeTab === 'campaigns' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Campagne in Piattaforma</h2>
            <Link href={`/clients/${id}/campaigns/new`} className="btn-gorgeous" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={18} /> Nuova Campagna
            </Link>
          </div>
          {(client.campaigns?.length || 0) === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
              <Zap size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <h3>Nessuna campagna ancora</h3>
              <p style={{ color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>Crea la prima campagna per questo cliente</p>
            </div>
          ) : (
            <table className="glass-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Nome Campagna</th>
                  <th>Stato</th>
                  <th>Obiettivo</th>
                  <th>Budget/Giorno</th>
                  <th>Varianti</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {(client.campaigns || []).map(c => {
                  const s = statusColors[c.status] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: c.status }
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>
                        <span style={{ color: s.color, background: s.bg, padding: '4px 10px', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 600 }}>
                          {s.label}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{c.objective}</td>
                      <td>€{c.dailyBudget}/gg</td>
                      <td>{c._count.adVariants} varianti</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <Link href={`/clients/${id}/campaigns/${c.id}/preview`} style={{
                            padding: '5px 12px', borderRadius: '8px', fontSize: '0.8rem',
                            background: 'rgba(139,92,246,0.15)', color: '#a78bfa',
                            textDecoration: 'none', border: '1px solid rgba(139,92,246,0.3)', fontWeight: 600,
                          }}>
                            Preview →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* Sezione Campagne Meta Sincronizzate */}
          <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img src="https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg" alt="Meta" style={{ height: '14px' }}/> Sincronizzate da Meta
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Campagne attualmente attive sull'Ad Account configurato</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input 
                   type="text" 
                   placeholder="Filtra campagne (es. ODC)..." 
                   value={campaignFilter} 
                   onChange={e => {
                     setCampaignFilter(e.target.value)
                     localStorage.setItem(`meta_filter_${id}`, e.target.value)
                   }}
                   style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', width: '250px', outline: 'none' }}
                />
                {loadingMeta && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Sincronizzazione in corso...</span>}
              </div>
            </div>

            {!loadingMeta && metaCampaigns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(0,0,0,0.02)', borderRadius: '16px', color: 'var(--text-tertiary)' }}>
                Nessuna campagna trovata sull'account Meta corrente.
              </div>
            ) : (
              <div style={{ maxHeight: '500px', overflowY: 'auto', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px' }}>
                <table className="glass-table" style={{ width: '100%', border: 'none' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <tr>
                      <th>Nome (Meta)</th>
                      <th>Stato</th>
                      <th>Obiettivo</th>
                      <th>Budget G. / Tot.</th>
                      <th>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metaCampaigns.filter((mc: any) => mc.name.toLowerCase().includes(campaignFilter.toLowerCase())).map((mc: any) => {
                      const isActive = mc.status === 'ACTIVE'
                      return (
                        <tr key={mc.id}>
                          <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{mc.name}</td>
                          <td>
                            <span style={{ 
                              color: isActive ? '#34d399' : '#94a3b8', 
                              background: isActive ? 'rgba(52,211,153,0.1)' : 'rgba(148,163,184,0.1)', 
                              padding: '2px 8px', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 700 
                            }}>
                              {mc.status}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{mc.objective?.replace('OUTCOME_', '')}</td>
                          <td style={{ fontSize: '0.85rem' }}>
                            {mc.daily_budget ? `€${(parseInt(mc.daily_budget) / 100).toFixed(2)}/gg` : 
                             mc.lifetime_budget ? `€${(parseInt(mc.lifetime_budget) / 100).toFixed(2)} Tot` : '-'}
                          </td>
                          <td>
                            <button
                              onClick={() => handleOpenReport(mc.id, mc.objective, mc.name)}
                              disabled={loadingReportId === mc.id}
                              style={{ 
                                padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                                background: 'white', color: '#1877f2', border: '1px solid #1877f2', cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: '0.3rem', opacity: loadingReportId === mc.id ? 0.5 : 1
                              }}
                            >
                              <BarChart2 size={12} /> {loadingReportId === mc.id ? 'Caricamento...' : 'Report KPI'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RENDER MODAL REPORT */}
      {reportModalData && (
        <MetaCampaignReportModal
          onClose={() => { setReportModalData(null); setReportModalDatePreset('last_30d') }}
          campaignTitle={reportModalData.campaignName}
          objective={reportModalData.objective || 'Sconosciuto'}
          baseMetrics={reportModalData.base}
          specificMetrics={reportModalData.specific}
          datePreset={reportModalDatePreset}
          isLoading={isReportRefreshing}
          onDateChange={(preset) => handleOpenReport(reportModalData.campaignId, reportModalData.objective || 'Sconosciuto', reportModalData.campaignName, preset)}
        />
      )}

      <SeoGodModeReportModal 
        isOpen={seoReportOpen} 
        onClose={() => setSeoReportOpen(false)} 
        clientId={client.id}
        clientName={client.name} 
        websiteUrl={client.websiteUrl} 
      />

      {/* TAB: BRAND ASSETS */}
      {activeTab === 'assets' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Libreria creativa del cliente</p>
            <Link href={`/clients/${id}/brand-assets`} className="btn-gorgeous" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={18} /> Gestisci Assets
            </Link>
          </div>
          {(client.brandAssets?.length || 0) === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              Nessun asset caricato. Vai su "Gestisci Assets" per caricare immagini e video del cliente.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              {(client.brandAssets || []).map(a => (
                <div key={a.id} className="glass-table" style={{ padding: '1.25rem', borderRadius: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', background: 'rgba(0, 0, 0,0.05)', padding: '2px 8px', borderRadius: '50px' }}>{a.type} · {a.format}</span>
                    {a.isActive ? <CheckCircle2 size={14} color="#34d399" /> : <AlertTriangle size={14} color="#f87171" />}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{a.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: HEATMAPS */}
      {activeTab === 'heatmaps' && (
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '20px', minHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <MousePointerClick size={24} color="#8b5cf6" />
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Mappe di Calore & Sessioni (Clarity)</h3>
            </div>
            {client.clarityProjectId && (
              <a href={`https://clarity.microsoft.com/projects/view/${client.clarityProjectId}/dashboard?date=Last%2030%20days`} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem', color: '#8b5cf6', textDecoration: 'none', fontWeight: 600, padding: '0.4rem 1rem', background: 'rgba(139,92,246,0.1)', borderRadius: '8px' }}>
                Apri a tutto schermo ↗
              </a>
            )}
          </div>
          
          {!client.clarityProjectId ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(139,92,246,0.2)', borderRadius: '16px', background: 'rgba(139,92,246,0.02)' }}>
              <Eye size={40} color="#8b5cf6" style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Clarity Non Connesso</h4>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'center', maxWidth: '400px' }}>
                Inserisci il Project ID di Microsoft Clarity nelle impostazioni API per sbloccare le mappe di calore live e le registrazioni degli utenti sul sito {client.websiteUrl?.replace('https://', '') || 'selezionato'}.
              </p>
              <button onClick={() => setActiveTab('settings')} className="btn-gorgeous" style={{ padding: '0.5rem 1.5rem' }}>Vai a Setup API</button>
            </div>
          ) : (
             <div style={{ flex: 1, position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)', background: '#fff' }}>
                <iframe 
                   src={`https://clarity.microsoft.com/embed/${client.clarityProjectId}`}
                   style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                   title="Microsoft Clarity Dashboard"
                />
             </div>
          )}
        </div>
      )}

      {/* TAB: GBP PROFILE */}
      {activeTab === 'gbp' && (
        <GbpDashboardTab clientId={client.id} />
      )}

      {/* TAB: API SETTINGS */}
      {activeTab === 'settings' && (
        <div style={{ maxWidth: '600px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Configurazione <span style={{ color: '#06b6d4' }}>Meta API</span></h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Aggiorna i parametri di connessione per scaricare dati reali dal Meta Business Manager.
          </p>

          {/* ── Stato Token Meta (live) ── */}
          <div style={{ marginBottom: '2rem' }}>
            <MetaTokenManager clientId={id as string} />
          </div>

          <form className="glass-table" style={{ padding: '2rem', borderRadius: '16px' }} onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;

            // Legge il valore da un campo del form per nome
            const getVal = (name: string): string =>
              ((form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null)?.value ?? '')

            const rawData = {
              metaAdAccountId: getVal('metaAdAccountId'),
              metaPageId: getVal('metaPageId'),
              metaAccessToken: getVal('metaAccessToken'),
              
              // Campi Google/GA4
              ga4PropertyId: getVal('ga4PropertyId'),
              googleAdAccountId: getVal('googleAdAccountId'),
              googleRefreshToken: getVal('googleRefreshToken'),
              
              // Campi GBP
              gbpAccountId: getVal('gbpAccountId'),
              gbpRefreshToken: getVal('gbpRefreshToken'),
              
              clarityProjectId: getVal('clarityProjectId'),
            }

            // Rimuovi campi vuoti per non sovrascrivere valori esistenti
            const data: Record<string, string> = {}
            if (rawData.metaAdAccountId) data.metaAdAccountId = rawData.metaAdAccountId
            if (rawData.metaPageId) data.metaPageId = rawData.metaPageId
            if (rawData.metaAccessToken) data.metaAccessToken = rawData.metaAccessToken
            
            if (rawData.ga4PropertyId) data.ga4PropertyId = rawData.ga4PropertyId
            if (rawData.googleAdAccountId) data.googleAdAccountId = rawData.googleAdAccountId
            if (rawData.googleRefreshToken) data.googleRefreshToken = rawData.googleRefreshToken
            
            if (rawData.gbpAccountId) data.gbpAccountId = rawData.gbpAccountId
            if (rawData.gbpRefreshToken) data.gbpRefreshToken = rawData.gbpRefreshToken
            
            if (rawData.clarityProjectId) data.clarityProjectId = rawData.clarityProjectId


            try {
              const token = localStorage.getItem('token');
              const res = await fetch(`${API_URL}/api/clients/${id}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });
              if (res.ok) {
                alert('Integrazioni aggiornate con successo e salvate crittografate! La pagina si ricarichera\'.');
                window.location.reload();
              } else {
                const errBody = await res.json().catch(() => ({}))
                alert('Errore durante l\'aggiornamento: ' + (errBody?.error ?? res.status));
              }
            } catch(err) {
              alert('Errore di rete.');
            }
          }}>
            {/* ─── META ADS INTEGRATION ─── */}
            <div style={{ marginBottom: '2.5rem', paddingBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#06b6d4', marginBottom: '1rem' }}>Meta Ads & Facebook</h3>
              
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Ad Account ID</label>
                <input name="metaAdAccountId" defaultValue={client.metaAdAccountId} placeholder="es. act_123456789" style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '10px', color: 'var(--text-primary)' }} />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.4rem' }}>Inserisci il prefisso "act_" seguito dal numero del tuo Ad Account</p>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Page ID (Opzionale)</label>
                <input name="metaPageId" defaultValue={client.metaPageId} placeholder="es. 104345345345" style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '10px', color: 'var(--text-primary)' }} />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  System User Token (Meta)
                  {!client.hasMetaToken && <span style={{ marginLeft: '0.5rem', color: '#ef4444', fontSize: '0.75rem' }}>MANCANTE</span>}
                  {client.hasMetaToken && <span style={{ marginLeft: '0.5rem', color: '#10b981', fontSize: '0.75rem' }}>Configurato ✅ (lascia vuoto per mantenere)</span>}
                </label>
                <input name="metaAccessToken" placeholder="EAAB..." type="password" style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '10px', color: 'var(--text-primary)' }} />
              </div>
            </div>

            {/* ─── GOOGLE INTEGRATION ─── */}
            <div style={{ marginBottom: '2.5rem', paddingBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#3b82f6', marginBottom: '1rem' }}>Ecosistema Google</h3>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Google Ads Customer ID</label>
                <input name="googleAdAccountId" defaultValue={client.googleAdAccountId || ''} placeholder="es. 123-456-7890" style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '10px', color: 'var(--text-primary)' }} />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>GA4 Property ID (Analytics)</label>
                <input name="ga4PropertyId" defaultValue={client.ga4PropertyId || ''} placeholder="es. 345678901" style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '10px', color: 'var(--text-primary)' }} />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Google Refresh Token (OAuth)
                </label>
                <input name="googleRefreshToken" placeholder="1//04ABCD..." type="password" style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '10px', color: 'var(--text-primary)' }} />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.4rem' }}>Richiesto per sbloccare le statistiche di Google Ads.</p>
              </div>
            </div>

            {/* ─── GOOGLE BUSINESS PROFILE ─── */}
            <div style={{ marginBottom: '2.5rem', paddingBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b', marginBottom: '1rem' }}>Google Business Profile (Maps)</h3>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>ID Account GBP (Account Name)</label>
                <input name="gbpAccountId" defaultValue={client.gbpAccountId || ''} placeholder="es. accounts/123456789" style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '10px', color: 'var(--text-primary)' }} />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  GBP Refresh Token (OAuth)
                </label>
                <input name="gbpRefreshToken" placeholder="1//04ABCD..." type="password" style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '10px', color: 'var(--text-primary)' }} />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.4rem' }}>Spesso uguale a quello di Google Ads se gestiti dalla stessa email.</p>
              </div>
            </div>

            {/* ─── MICROSOFT CLARITY ─── */}
            <div style={{ marginBottom: '2rem', padding: '1.25rem', border: '1px solid rgba(139, 92, 246, 0.2)', backgroundColor: 'rgba(139, 92, 246, 0.05)', borderRadius: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 700, color: '#8b5cf6', marginBottom: '0.2rem' }}>
                 Microsoft Clarity (Heatmaps)
              </label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Sblocca le mappe di calore sulla dashboard inserendo il Project ID.</p>
              <input name="clarityProjectId" defaultValue={client.clarityProjectId || ''} placeholder="es. 8abc123" style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '10px', color: 'var(--text-primary)' }} />
            </div>

            <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid rgba(59, 130, 246, 0.2)', backgroundColor: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 700, color: '#2563eb', marginBottom: '0.75rem' }}>
                Google Analytics 4 — Collega Proprieta'
              </label>

              {/* Trigger: carica lista proprieta' al click */}
              {ga4Properties.length === 0 && !loadingGa4Props && (
                <button
                  type="button"
                  onClick={async () => {
                    setLoadingGa4Props(true)
                    try {
                      const token = localStorage.getItem('token')
                      const res = await fetch(`${API_URL}/api/clients/analytics/properties`, {
                        headers: { Authorization: `Bearer ${token}` }
                      })
                      if (res.ok) {
                        const data = await res.json()
                        setGa4Properties(data.properties || [])
                      } else {
                        const err = await res.json().catch(() => ({}))
                        alert('Errore: ' + (err.error || 'impossibile caricare le proprieta\'. Verifica che Analytics Admin API sia abilitata nel GCP project.'))
                      }
                    } catch(e) { console.error(e) }
                    finally { setLoadingGa4Props(false) }
                  }}
                  style={{ width: '100%', padding: '0.75rem', background: 'rgba(37,99,235,0.08)', border: '1px dashed rgba(37,99,235,0.4)', borderRadius: '10px', color: '#2563eb', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  Carica Proprieta' da Google Analytics
                </button>
              )}

              {loadingGa4Props && (
                <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Connessione a Google Analytics...</div>
              )}

              {ga4Properties.length > 0 && (
                <div>
                  <select
                    name="ga4PropertyId"
                    defaultValue={client.ga4PropertyId || ''}
                    style={{ width: '100%', padding: '0.75rem', background: '#fff', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}
                  >
                    <option value="">— Nessuna proprietà selezionata —</option>
                    {ga4Properties.map(p => (
                      <option key={p.propertyId} value={p.propertyId}>
                        {p.displayName} ({p.websiteUrl}) · ID: {p.propertyId}
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Account: {ga4Properties[0]?.accountName} · {ga4Properties.length} proprietà trovate</p>
                </div>
              )}

              {/* Campo nascosto con valore corrente se non ancora caricato il picker */}
              {ga4Properties.length === 0 && !loadingGa4Props && client.ga4PropertyId && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#2563eb', padding: '0.4rem 0.75rem', background: 'rgba(37,99,235,0.05)', borderRadius: '6px' }}>
                  ✅ Già collegato: Property ID <strong>{client.ga4PropertyId}</strong>
                  <input type="hidden" name="ga4PropertyId" value={client.ga4PropertyId} />
                </div>
              )}
              {ga4Properties.length === 0 && !loadingGa4Props && !client.ga4PropertyId && (
                <input type="hidden" name="ga4PropertyId" value="" />
              )}
            </div>

            {/* GOOGLE ADS BLOCK */}
            <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid rgba(16, 185, 129, 0.2)', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 700, color: '#10b981', marginBottom: '0.75rem' }}>
                Google Ads — Customer ID
              </label>

              {/* Se gia collegato mostra lo stato */}
              {client.googleAdAccountId && (
                <div style={{ marginBottom: '0.75rem', fontSize: '0.8rem', color: '#10b981', padding: '0.4rem 0.75rem', background: 'rgba(16,185,129,0.08)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Collegato: <strong>{client.googleAdAccountId}</strong></span>
                </div>
              )}

              {/* Input manuale Customer ID — il modo piu affidabile */}
              <input
                type="text"
                name="googleAdAccountId"
                defaultValue={client.googleAdAccountId || ''}
                placeholder="Es. 123-456-7890 oppure 1234567890"
                style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', fontSize: '0.9rem', background: '#fff', boxSizing: 'border-box', marginBottom: '0.5rem' }}
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
                Trova il Customer ID su ads.google.com in alto a destra (formato: 123-456-7890). Rimuovi i trattini.
              </p>

              {/* OAuth opzionale per caricare la lista account */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <a
                  href={`${API_URL}/api/clients/${id}/google-ads/auth`}
                  style={{ fontSize: '0.8rem', color: '#10b981', textDecoration: 'underline', cursor: 'pointer' }}
                  onClick={() => {
                    // Salva l'ID cliente in localStorage per usarlo dopo il redirect OAuth
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('pendingGoogleAdsClientId', id as string)
                    }
                  }}
                >
                  Oppure accedi con Google per caricare la lista account automaticamente
                </a>
                {loadingGoogleAdsAccounts && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Caricamento...</span>
                )}
              </div>

              {/* Dropdown se l'OAuth e' andato a buon fine */}
              {googleAdsAccounts.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <select
                    name="googleAdAccountId"
                    defaultValue={client.googleAdAccountId || ''}
                    style={{ width: '100%', padding: '0.75rem', background: '#fff', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                  >
                    <option value="">— Seleziona Account —</option>
                    {googleAdsAccounts.map(p => (
                      <option key={p} value={p?.replace('customers/', '').replace(/-/g, '')}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {/* GOOGLE BUSINESS PROFILE BLOCK */}
            <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid rgba(245, 158, 11, 0.2)', backgroundColor: 'rgba(245, 158, 11, 0.05)', borderRadius: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.75rem' }}>
                Google Business Profile — Collega Location
              </label>

              {/* Se gia collegato mostra lo stato */}
              {client.gbpLocationId && (
                <div style={{ marginBottom: '0.75rem', fontSize: '0.8rem', color: '#d97706', padding: '0.4rem 0.75rem', background: 'rgba(245,158,11,0.08)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Collegato: <strong>{client.gbpLocationId}</strong></span>
                  <input type="hidden" name="gbpLocationId" value={client.gbpLocationId} />
                  <input type="hidden" name="gbpAccountId" value={client.gbpAccountId || ''} />
                </div>
              )}

              {/* Trigger: carica lista location al click */}
              {gbpLocations.length === 0 && !loadingGbpLocations && (
                <button
                  type="button"
                  onClick={async () => {
                    setLoadingGbpLocations(true)
                    try {
                      const token = localStorage.getItem('token')
                      const res = await fetch(`${API_URL}/api/clients/${id}/gbp/locations`, {
                        headers: { Authorization: `Bearer ${token}` }
                      })
                      if (res.ok) {
                        const data = await res.json()
                        setGbpLocations(data.locations || [])
                        setGbpAccounts(data.accounts || [])
                      } else {
                        const err = await res.json().catch(() => ({}))
                        alert('Errore: ' + (err.error || 'impossibile caricare le location. Devi prima fare login con l\'account Google.'))
                      }
                    } catch(e) { console.error(e) }
                    finally { setLoadingGbpLocations(false) }
                  }}
                  style={{ width: '100%', padding: '0.75rem', background: 'rgba(245,158,11,0.08)', border: '1px dashed rgba(245,158,11,0.4)', borderRadius: '10px', color: '#d97706', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  Carica Location GBP collegate
                </button>
              )}

              {loadingGbpLocations && (
                <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Caricamento schede Google Business Profile...</div>
              )}

              {gbpLocations.length > 0 && (
                <div>
                  <select
                    name="gbpLocationId"
                    defaultValue={client.gbpLocationId || ''}
                    style={{ width: '100%', padding: '0.75rem', background: '#fff', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}
                  >
                    <option value="">— Nessuna location selezionata —</option>
                    {gbpLocations.map(l => (
                      <option key={l.name} value={l.name}>
                        {l.title} ({l.address}) {l.isVerified ? '✅' : '❌'}
                      </option>
                    ))}
                  </select>
                  {/* Salviamo anche l'Account ID se disponibile */}
                  {gbpAccounts.length > 0 && (
                    <input type="hidden" name="gbpAccountId" value={gbpAccounts[0].name} />
                  )}
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{gbpLocations.length} location trovate in questo account.</p>
                </div>
              )}
            </div>

            <button type="submit" className="btn-gorgeous" style={{ width: '100%', padding: '0.8rem' }}>Salva Configurazione</button>
          </form>
        </div>
      )}
    </div>
  )
}
