"use client"

import Image from 'next/image'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { 
  ArrowLeft, Brain, Globe, Plus, FileText, TrendingDown, Target, Zap, AlertTriangle, 
  CheckCircle2, Download, TrendingUp, Image as ImageIcon, Trash2, BarChart2,
  Share2, Youtube, Instagram, Music, Linkedin, Facebook, Video, Lightbulb, Filter, Users, Eye, LayoutDashboard, Activity, PlayCircle, MapPin, Calendar, Sparkles, Heart, MousePointerClick, GripVertical, Clock,
  Search, Link as LinkIcon, Star, MessageSquare, MonitorPlay, MousePointer2, PieChart, LayoutGrid, CalendarDays, Settings
} from 'lucide-react'
import MetaCampaignReportModal from '@/components/MetaCampaignReportModal'
import dynamic from 'next/dynamic';
const SeoGodModeReportModal = dynamic(() => import('@/components/SeoGodModeReportModal'), { ssr: false });
import GbpDashboardTab from '@/components/GbpDashboardTab'
import { MetaTokenManager } from '@/components/MetaTokenManager'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
  LIVE: { color: '#34d399', bg: 'rgba(52,211,153,0.1)', label: 'Live' },
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
  const [googleAdsAccounts, setGoogleAdsAccounts] = useState<{ id: string; name: string; formattedId: string }[]>([])
  const [loadingGoogleAdsAccounts, setLoadingGoogleAdsAccounts] = useState(false)
  const [metaAdAccounts, setMetaAdAccounts] = useState<{ id: string; name: string; currency: string; account_status: number }[]>([])
  const [loadingMetaAccounts, setLoadingMetaAccounts] = useState(false)
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
        if (!res.ok) return;
        const data = await res.json()
        if (data.status === 'running') {
          setLoadingAudit(true)
          setAuditProgress(data.progress)
        }
      } catch (e) {
        console.error('[audit] Error checking audit status:', e)
      }
    }
    checkAuditStatus()
  }, [id])

  useEffect(() => {
    let interval: NodeJS.Timeout
    let isMounted = true
    if (loadingAudit) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/api/clients/${id}/audit/status`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          })
          if (!res.ok || !isMounted) return;
          const data = await res.json()
          if (!isMounted) return;
          if (data.status === 'running') {
            setAuditProgress(data.progress)
          } else if (data.status === 'error') {
            clearInterval(interval)
            setLoadingAudit(false)
            console.error('[audit] Background operation failed:', data.error)
            toast.error('Operazione in background fallita: ' + data.error)
          } else if (data.status === 'completed') {
            clearInterval(interval)
            window.location.reload()
          }
        } catch (e) {
          console.error('[audit] Error polling audit status:', e)
        }
      }, 2000)
    }
    return () => {
      isMounted = false
      clearInterval(interval)
    }
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
      toast.error('Impossibile caricare il report. Controlla che la campagna abbia generato traffico.')
      if (!reportModalData) setReportModalData(null)
    } finally {
      setLoadingReportId(null)
      setIsReportRefreshing(false)
    }
  }

  const handleAddCompetitor = async () => {
    if (!newCompetitorName.trim() || !client) return
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_URL}/api/clients/${client.id}/intelligence/competitors`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCompetitorName })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setNewCompetitorName('')
      window.location.reload()
    } catch (e) {
      console.error('[competitor] Error adding competitor:', e)
      toast.error('Impossibile aggiungere il competitor. Riprova.')
    }
  }

  const handleDeleteCompetitor = async (index: number) => {
    if (!client) return
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_URL}/api/clients/${client.id}/intelligence/competitors/${index}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      window.location.reload()
    } catch (e) {
      console.error('[competitor] Error deleting competitor:', e)
      toast.error('Impossibile eliminare il competitor. Riprova.')
    }
  }

  const handleScreenshotUpload = async (index: number, file: File) => {
    if (!client || !file) return
    setUploadingVisionIndex(index)
    
    // Convert to base64
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64Image = reader.result as string
      const token = localStorage.getItem('token')
      try {
        const res = await fetch(`${API_URL}/api/clients/${client.id}/intelligence/competitors/${index}/vision`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Image })
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        window.location.reload()
      } catch (e) {
        console.error('[vision] Error uploading screenshot:', e)
        toast.error('Impossibile caricare lo screenshot. Riprova.')
      } finally {
        setUploadingVisionIndex(null)
      }
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
        toast.error(data.error || 'Errore durante la generazione dell\'audit.')
        setLoadingAudit(false)
      }
    } catch (e) {
      toast.error('Errore di connessione.')
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
    if (!client?.ga4PropertyId) return;
    const fetchGa4 = async () => {
      setLoadingGa4(true)
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API_URL}/api/clients/${id}/analytics?dateRange=${overviewDaysBack}d&compare=${compareMode}`, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (res.ok && !data.notConfigured) {
          setGa4Data(data)
        } else {
          setGa4Data(null)
        }
      } catch(e) {
        console.error('Failed to fetch GA4 data', e)
        setGa4Data(null)
      } finally {
        setLoadingGa4(false)
      }
    }
    fetchGa4()
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
    { id: 'overview', label: 'Overview & Audit', icon: LayoutDashboard },
    { id: 'intelligence', label: 'AI Intelligence', icon: Brain },
    { id: 'campaigns', label: `Campagne (${client.campaigns?.length || 0})`, icon: Target },
    { id: 'assets', label: `Brand Assets (${client.brandAssets?.length || 0})`, icon: ImageIcon },
    { id: 'heatmaps', label: 'Heatmaps & Registrazioni', icon: Eye },
    { id: 'gbp', label: 'Profilo GBP', icon: MapPin },
    { id: 'settings', label: 'Setup API', icon: Settings },
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
                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {client.websiteUrl.replace(/^https?:\/\//, '')}
                </a>
              )}
              {client.industry && (
                <Badge variant="secondary" className="font-semibold">{client.industry}</Badge>
              )}
              {client.creativeMode && (
                <Badge variant="outline" className="font-medium">Modalità: {client.creativeMode}</Badge>
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
          <Button asChild size="sm" className="active:scale-[0.97] transition-transform">
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
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 active:scale-[0.97]',
              color
            )}
          >
            <Icon className="h-3.5 w-3.5" />{label}
          </Link>
        ))}
      </div>

      {/* ── TAB BAR ── */}
      <div className="border-b border-border">
        <div className="flex gap-1 overflow-x-auto scrollbar-hidden">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition-all duration-200 flex items-center gap-2',
                  'border-b-2 -mb-px active:scale-[0.98]',
                  activeTab === tab.id
                    ? 'border-primary text-foreground bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* TAB: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-8">

          {/* CONTROL BAR: Date Filter & Comparazione */}
          <div className="glass-panel flex flex-col md:flex-row md:justify-between md:items-center p-4 rounded-2xl gap-4">
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-1.5 text-muted-foreground">
                 <Calendar className="h-4 w-4 text-primary" />
                 <span className="text-sm font-semibold">Periodo:</span>
               </div>
               <select 
                 value={overviewDaysBack} 
                 onChange={(e) => setOverviewDaysBack(Number(e.target.value))} 
                 className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm font-medium outline-none cursor-pointer hover:border-primary/50 transition-colors"
               >
                 <option value={7}>Ultimi 7 Giorni</option>
                 <option value={30}>Ultimi 30 Giorni</option>
                 <option value={60}>Ultimi 60 Giorni</option>
                 <option value={90}>Ultimi 90 Giorni</option>
                 <option value={180}>Ultimi 6 Mesi</option>
               </select>
            </div>
            
            <div className="flex items-center gap-3">
               <div className="text-sm font-semibold text-muted-foreground">Compara con:</div>
               <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border">
                  <button 
                    onClick={() => setCompareMode('prev_period')} 
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all duration-200 active:scale-[0.96]",
                      compareMode === 'prev_period' 
                        ? 'bg-primary text-primary-foreground shadow-sm' 
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Periodo Prec.
                  </button>
                  <button 
                    onClick={() => setCompareMode('prev_year')} 
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all duration-200 active:scale-[0.96]",
                      compareMode === 'prev_year' 
                        ? 'bg-primary text-primary-foreground shadow-sm' 
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Anno Prec.
                  </button>
                  <button 
                    onClick={() => setCompareMode('none')} 
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all duration-200 active:scale-[0.96]",
                      compareMode === 'none' 
                        ? 'bg-primary text-primary-foreground shadow-sm' 
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Nessuno
                  </button>
               </div>
            </div>
          </div>
          
          {/* TOP ROW: Mini-KPIs & Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LATO SX: Traffico & Funnel Cliente */}
            <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-6">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold font-headline">Performance Dominio: {client.websiteUrl?.replace('https://', '') || 'Nessun dominio'}</h3>
              </div>
              
              {/* WEB ANALYTICS COMPLETO */}
              {loadingGa4 ? (
                <div className="bg-muted/30 p-8 rounded-xl text-center flex flex-col items-center justify-center min-h-[120px] gap-2 border border-border">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground animate-pulse">Elaborazione Report Godmode GA4 e calcolo deltas storici...</span>
                </div>
              ) : !client.ga4PropertyId ? (
                <div className="bg-primary/5 border border-dashed border-primary/20 p-6 rounded-xl text-center space-y-3">
                  <div className="text-sm font-semibold text-primary">Google Analytics Non Collegato</div>
                  <div className="text-xs text-muted-foreground max-w-md mx-auto">Collega il Property ID di GA4 in "Setup API" per sbloccare l'intelligenza contestuale avanzata sul traffico.</div>
                  <Button onClick={() => setActiveTab('settings')} size="sm">Configura Analytics</Button>
                </div>
              ) : ga4Data ? (
                <div className="space-y-6">
                  
                  {/* Traffic Category */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Traffico & Acquisizione</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Sessioni Totali', metric: ga4Data.traffic?.sessions, format: (v: number) => v.toLocaleString(), colorClass: 'bg-blue-500/5 border-blue-500/15 text-blue-600 dark:text-blue-400' },
                        { label: 'Utenti Unici', metric: ga4Data.traffic?.users, format: (v: number) => v.toLocaleString(), colorClass: 'bg-blue-500/5 border-blue-500/15 text-blue-600 dark:text-blue-400' },
                        { label: 'Nuovi Utenti', metric: ga4Data.traffic?.newUsers, format: (v: number) => v.toLocaleString(), colorClass: 'bg-blue-500/5 border-blue-500/15 text-blue-600 dark:text-blue-400' },
                        { label: 'Utenti di Ritorno', metric: ga4Data.traffic?.returningUsers, format: (v: number) => v.toLocaleString(), colorClass: 'bg-blue-500/5 border-blue-500/15 text-blue-600 dark:text-blue-400' },
                      ].map((item, i) => (
                        <div key={i} className={cn("p-3.5 rounded-xl border flex flex-col justify-between min-h-[90px]", item.colorClass)}>
                          <div className="text-[11px] font-semibold text-muted-foreground truncate">{item.label}</div>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-lg font-bold text-foreground">{item.metric ? item.format(item.metric.val) : '0'}</span>
                            {item.metric && (
                              <span className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                item.metric.chg > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : item.metric.chg < 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                              )}>
                                {item.metric.chg > 0 ? '+' : ''}{item.metric.chg}%
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Behavior Category */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Comportamento On-Site</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Bounce Rate', metric: ga4Data.behavior?.bounceRate, format: (v: number) => `${v.toFixed(1)}%`, colorClass: 'bg-amber-500/5 border-amber-500/15 text-amber-600 dark:text-amber-400' },
                        { label: 'Engagement Rate', metric: ga4Data.behavior?.engagementRate, format: (v: number) => `${v.toFixed(1)}%`, colorClass: 'bg-amber-500/5 border-amber-500/15 text-amber-600 dark:text-amber-400' },
                        { label: 'Pagine / Sessione', metric: ga4Data.behavior?.pagesPerSession, format: (v: number) => v.toFixed(2), colorClass: 'bg-amber-500/5 border-amber-500/15 text-amber-600 dark:text-amber-400' },
                        { label: 'Tempo Medio (s)', metric: ga4Data.behavior?.avgSessionDuration, format: (v: number) => `${v.toFixed(0)} s`, colorClass: 'bg-amber-500/5 border-amber-500/15 text-amber-600 dark:text-amber-400' },
                      ].map((item, i) => (
                        <div key={i} className={cn("p-3.5 rounded-xl border flex flex-col justify-between min-h-[90px]", item.colorClass)}>
                          <div className="text-[11px] font-semibold text-muted-foreground truncate">{item.label}</div>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-lg font-bold text-foreground">{item.metric ? item.format(item.metric.val) : '0'}</span>
                            {item.metric && (
                              <span className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                item.metric.chg > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : item.metric.chg < 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                              )}>
                                {item.metric.chg > 0 ? '+' : ''}{item.metric.chg}%
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Conversions Category */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Conversioni (Ultimi {overviewDaysBack}gg vs prec.)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Conversioni Totali', metric: ga4Data.conversions?.totalConversions, format: (v: number) => v.toLocaleString(), colorClass: 'bg-purple-500/5 border-purple-500/15 text-purple-600 dark:text-purple-400' },
                        { label: 'Tasso di Conversione', metric: ga4Data.conversions?.conversionRate, format: (v: number) => `${v.toFixed(2)}%`, colorClass: 'bg-purple-500/5 border-purple-500/15 text-purple-600 dark:text-purple-400' },
                        { label: 'Acquisti (Transazioni)', metric: ga4Data.conversions?.transactions, format: (v: number) => v.toLocaleString(), colorClass: 'bg-purple-500/5 border-purple-500/15 text-purple-600 dark:text-purple-400' },
                        { label: 'Revenue Generato', metric: ga4Data.conversions?.revenue, format: (v: number) => `€${v.toLocaleString()}`, colorClass: 'bg-purple-500/5 border-purple-500/15 text-purple-600 dark:text-purple-400' },
                      ].map((item, i) => (
                        <div key={i} className={cn("p-3.5 rounded-xl border flex flex-col justify-between min-h-[90px]", item.colorClass)}>
                          <div className="text-[11px] font-semibold text-muted-foreground truncate">{item.label}</div>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-lg font-bold text-foreground">{item.metric ? item.format(item.metric.val) : '0'}</span>
                            {item.metric && (
                              <span className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                item.metric.chg > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : item.metric.chg < 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                              )}>
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
              <div className="glass-panel p-6 rounded-2xl border border-border mt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-indigo-500" />
                  <h3 className="text-lg font-bold font-headline">Intelligenza Artificiale: Audit Godmode SEO</h3>
                </div>
                <p className="text-xs text-muted-foreground">Genera un report tecnico omnicomprensivo che scansiona il sito simulando i crawler Google e l'entità LLM.</p>

                <Button 
                  onClick={() => setSeoReportOpen(true)}
                  className="w-full bg-gradient-to-r from-indigo-950 to-purple-950 hover:from-indigo-900 hover:to-purple-900 text-white border border-indigo-500/30 py-5 rounded-xl font-bold shadow-lg shadow-indigo-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="h-4 w-4 text-purple-400" /> Genera Report SEO (GODMODE)
                </Button>

                {/* SAVED REPORTS HISTORICAL LIST */}
                {seoReportsList.length > 0 && (
                  <div className="mt-4 border border-border rounded-xl overflow-hidden bg-muted/20">
                    <div
                      onClick={() => setIsReportsOpen(!isReportsOpen)}
                      className="flex justify-between items-center p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <span className="text-xs font-semibold">Archivio Report ({seoReportsList.length})</span>
                      <span className={cn("text-[10px] transition-transform duration-200", isReportsOpen && "transform rotate-180")}>▼</span>
                    </div>
                    {isReportsOpen && (
                      <div className="p-3 pt-0 flex flex-col gap-2">
                        {seoReportsList.map((report) => (
                          <div key={report.id} className="flex justify-between items-center p-2 bg-muted/65 rounded-lg text-xs">
                            <div className="flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>Report del {new Date(report.createdAt).toLocaleDateString()}</span>
                            </div>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">Score: {report.overallScore}/100</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* LATO DX: Alert & Health Score */}
            <div className="flex flex-col gap-6">
              
              {/* ALERTS */}
              <div className="glass-panel p-6 rounded-2xl border border-destructive/20 bg-gradient-to-b from-destructive/10 to-background/50">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
                  <h3 className="text-sm font-bold font-headline">Anomalie Cliente (Alerts)</h3>
                </div>
                {!client.hasMetaToken ? (
                  <div className="bg-destructive/5 border-l-4 border-destructive p-3.5 rounded-lg text-xs flex justify-between items-center gap-2">
                    <div>
                      <div className="font-bold text-destructive">Token Meta Mancante / Scaduto</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Le campagne non possono sincronizzarsi.</div>
                    </div>
                    <Button onClick={() => setActiveTab('settings')} size="sm" variant="outline" className="h-7 border-destructive text-destructive hover:bg-destructive/10 text-[10px]">Correggi</Button>
                  </div>
                ) : (
                   <div className="text-xs text-muted-foreground">Nessuna anomalia grave rilevata. Operatività fluida.</div>
                )}
                
                {/* Alert reali — visibili solo quando GA4 o Meta sono collegati */}
                {client.hasMetaToken && client.ga4PropertyId ? null : (
                  <div className="mt-3 bg-primary/5 border-l-4 border-primary/40 p-3.5 rounded-lg text-xs">
                    <div className="font-semibold text-primary">Collega i servizi per gli alert automatici</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Connetti Meta Ads e Google Analytics in "Setup API" per ricevere anomalie in tempo reale.</div>
                  </div>
                )}
              </div>

              {/* HEALTH SCORE COMPACT */}
              <div className="glass-panel p-6 rounded-2xl flex items-center justify-between gap-4 flex-1">
                 <div className="space-y-1">
                   <h3 className="text-sm font-bold text-muted-foreground">Health Score Ads</h3>
                   <div className="text-[10px] text-muted-foreground">{client.lastAuditAt ? `Aggiornato il ${new Date(client.lastAuditAt).toLocaleDateString()}` : 'Mai analizzato'}</div>
                   {client.lastAuditPdfUrl && (
                      <a href={client.lastAuditPdfUrl} target="_blank" className="inline-flex items-center gap-1 mt-2 text-xs text-primary font-semibold hover:underline">
                        <Download className="h-3.5 w-3.5" /> PDF Report
                      </a>
                   )}
                 </div>
                 {client.lastAuditScore !== null ? (
                    <div className="scale-90 origin-right">
                       <AuditMeter score={client.lastAuditScore} />
                    </div>
                 ) : (
                    <div className="flex items-center min-w-[150px]">
                       {loadingAudit ? (
                          <div className="w-full flex flex-col gap-1.5">
                             <div className="flex justify-between text-[11px] font-bold text-primary">
                                <span>Analisi AI in corso...</span>
                                <span>{auditProgress}%</span>
                             </div>
                             <div className="w-full h-2 rounded-full bg-muted overflow-hidden border border-border">
                                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${auditProgress}%` }} />
                             </div>
                          </div>
                       ) : (
                          <Button onClick={handleTriggerAudit} size="sm" className="w-full active:scale-[0.97] transition-all">🔄 Richiedi Audit AI</Button>
                       )}
                    </div>
                 )}
              </div>

            </div>
          </div>

          {/* ==================================================== */}
          {/* OMNICHANNEL ADVERTISING (META + GOOGLE ADS)          */}
          {/* ==================================================== */}
          <div className="glass-panel p-6 rounded-2xl border-t-4 border-primary relative overflow-hidden">
            
            {loadingPerformance && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
                  <div className="px-5 py-2.5 bg-background border border-border rounded-full shadow-lg text-primary font-bold flex items-center gap-2 text-sm animate-bounce">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Aggiornamento metriche in corso...
                  </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
              <h3 className="text-xl font-bold font-headline flex items-center gap-2">
                <Target className="h-6 w-6 text-primary" /> 
                Performance Advertising (Full Funnel)
              </h3>
              <div className="text-xs text-muted-foreground font-medium">Budget Omnicanale: <strong className="text-foreground text-sm font-bold">{
                 (performanceData?.meta?.spend != null || performanceData?.google?.spend != null) 
                 ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format((performanceData?.meta?.spend || 0) + (performanceData?.google?.spend || 0))
                 : 'N/D'
              }</strong></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
               
               {/* META ADS */}
               <div className="bg-blue-500/5 border border-blue-500/15 p-5 rounded-2xl space-y-4">
                  <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2"><Facebook className="h-4.5 w-4.5"/> Meta Ads</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-background/60 p-3 rounded-xl border border-border shadow-sm">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Spesa</div>
                      <div className="text-lg font-bold mt-0.5">{performanceData?.meta?.spend != null ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(performanceData.meta.spend) : 'N/D'}</div>
                    </div>
                    <div className="bg-background/60 p-3 rounded-xl border border-border shadow-sm">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">CPA (Acq.)</div>
                      <div className="text-lg font-bold mt-0.5">{performanceData?.meta?.cpa != null ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(performanceData.meta.cpa) : 'N/D'}</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-2 border-t border-blue-500/10 pt-3">
                     <div className="flex justify-between"><span>Impression:</span> <strong className="text-foreground">{performanceData?.meta?.impressions != null ? new Intl.NumberFormat('it-IT', { notation: 'compact' }).format(performanceData.meta.impressions) : 'N/D'}</strong></div>
                     <div className="flex justify-between"><span>Link Clicks:</span> <strong className="text-foreground">{performanceData?.meta?.clicks != null ? new Intl.NumberFormat('it-IT').format(performanceData.meta.clicks) : 'N/D'}</strong></div>
                     <div className="flex justify-between"><span>CTR:</span> <strong className="text-foreground">{performanceData?.meta?.ctr != null ? performanceData.meta.ctr.toFixed(2) + '%' : 'N/D'}</strong></div>
                  </div>
               </div>

               {/* GOOGLE ADS */}
               <div className="bg-red-500/5 border border-red-500/15 p-5 rounded-2xl space-y-4">
                  <h4 className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2"><Search className="h-4.5 w-4.5"/> Google Ads (Search)</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-background/60 p-3 rounded-xl border border-border shadow-sm">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Spesa</div>
                      <div className="text-lg font-bold mt-0.5">{performanceData?.google?.spend != null ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(performanceData.google.spend) : 'N/D'}</div>
                    </div>
                    <div className="bg-background/60 p-3 rounded-xl border border-border shadow-sm">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">CPC Medio</div>
                      <div className="text-lg font-bold mt-0.5 text-emerald-600 dark:text-emerald-400">{performanceData?.google?.cpc != null ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(performanceData.google.cpc) : 'N/D'}</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-2 border-t border-red-500/10 pt-3">
                     <div className="flex justify-between"><span>Impression:</span> <strong className="text-foreground">{performanceData?.google?.impressions != null ? new Intl.NumberFormat('it-IT', {notation:'compact'}).format(performanceData.google.impressions) : 'N/D'}</strong></div>
                     <div className="flex justify-between"><span>CTR (Search):</span> <strong className="text-foreground">{performanceData?.google?.ctr != null ? performanceData.google.ctr.toFixed(2) + '%' : 'N/D'}</strong></div>
                     <div className="flex justify-between"><span>Conversioni:</span> <strong className="text-foreground">{performanceData?.google?.conversions != null ? new Intl.NumberFormat('it-IT').format(performanceData.google.conversions) : 'N/D'}</strong></div>
                  </div>
               </div>

               {/* DISPLAY & AI BUDGET RIPARTITION */}
               <div className="bg-amber-500/5 border border-amber-500/15 p-5 rounded-2xl flex flex-col justify-between">
                  <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2"><MonitorPlay className="h-4.5 w-4.5"/> Insights & Allocazione</h4>
                  <div className="flex-1 flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                      <PieChart className="h-8 w-8 mb-2 opacity-30 text-amber-500" />
                      <div className="font-bold text-xs text-foreground mb-1">Display non configurato</div>
                      <div className="text-[11px] leading-relaxed max-w-[180px]">Collega le campagne Display/DV360 per vedere frequenza e viewability reali</div>
                   </div>
               </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* SEO & REPUTATION (GSC + REVIEWS)                     */}
          {/* ============          {/* ==================================================== */}
          {/* SEO & REPUTATION (GSC + REVIEWS)                     */}
          {/* ==================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
             
             {/* SEO (Search Console + Backlinks) */}
             <div className="glass-panel p-8 rounded-[20px] border-t-4 border-blue-500 lg:col-span-3">
                <h3 className="text-lg font-extrabold flex items-center gap-3 mb-6">
                  <Search size={20} className="text-blue-500" /> SEO & Keyword View (GSC)
                </h3>
                
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-muted-foreground bg-blue-500/5 rounded-xl border border-dashed border-blue-500/20">
                   <Search size={32} className="opacity-20 mb-3 text-blue-500" />
                   <div className="font-bold text-base mb-1 text-foreground">Google Search Console non collegato</div>
                   <div className="text-xs max-w-[320px] leading-relaxed">Collega GSC in Setup API per vedere ranking reali, keyword opportunities e backlink del cliente</div>
                   <button onClick={() => setActiveTab('settings')} className="mt-4 text-xs text-blue-500 bg-transparent border border-blue-500/40 hover:bg-blue-500/10 active:scale-95 transition-all rounded-lg px-4 py-1.5 font-semibold">Collega in Setup API →</button>
                 </div>
             </div>

             {/* QUALITATIVE FEEDBACK (Reviews) */}
             <div className="glass-panel p-8 rounded-[20px] border-t-4 border-amber-500 lg:col-span-2 flex flex-col">
                <h3 className="text-lg font-extrabold flex items-center gap-3 mb-6">
                  <Star size={20} className="text-amber-500 fill-amber-500" /> Reputation & UX
                </h3>
                
                <div className="flex-1 flex flex-col items-center justify-center py-8 px-4 text-center text-muted-foreground bg-amber-500/5 rounded-xl border border-dashed border-amber-500/20">
                     <Star size={32} className="opacity-20 mb-3 text-amber-500 fill-amber-500" />
                     <div className="font-bold text-base mb-1 text-foreground">Nessuna recensione collegata</div>
                     <div className="text-xs max-w-[220px] leading-relaxed">Collega Google Business Profile o Trustpilot per vedere recensioni e sentiment reali</div>
                     <button onClick={() => setActiveTab('settings')} className="mt-4 text-xs text-amber-500 bg-transparent border border-amber-500/40 hover:bg-amber-500/10 active:scale-95 transition-all rounded-lg px-4 py-1.5 font-semibold">Collega in Setup API →</button>
                  </div>
             </div>

          </div>

          {/* ==================================================== */}
          {/* ATTRAZIONE & COMPETITOR INTELLIGENCE FULL WIDTH      */}
          {/* ==================================================== */}
          <section className="glass-panel p-7 rounded-2xl border-t border-white/5 mt-6">
            <div className="flex items-center gap-3 mb-6">
              <Share2 size={24} className="text-pink-400" />
              <h2 className="text-xl font-bold text-foreground">Intelligenza di Attrazione (Content & Competitori)</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-7 gap-8">
              
              {/* LATO SINISTRO: Metriche Organiche e Database Contenuti */}
              <div className="flex flex-col gap-6 lg:col-span-4">
                
                {/* Metriche Canali Deep Dive */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Ecosistema Digitale (Deep Dive 30giorni)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     
                     {/* 1. SITO WEB */}
                     <div className="bg-blue-500/5 border border-blue-500/20 p-5 rounded-xl flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2">
                            <Globe size={20} className="text-blue-500" />
                            <span className="font-bold text-sm text-foreground">Sito Web (GA4)</span>
                          </div>
                          {loadingGa4 ? <span className="text-[10px] text-muted-foreground">Caricamento...</span> : ga4Data?.traffic?.users?.chg != null ? (
                             <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${ga4Data.traffic.users.chg >= 0 ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'}`}>
                               {ga4Data.traffic.users.chg > 0 ? '+' : ''}{ga4Data.traffic.users.chg}%
                             </span>
                          ) : null}
                        </div>
                        {!loadingGa4 && !ga4Data ? (
                          <div className="text-center py-4 text-muted-foreground text-xs flex-1 flex flex-col items-center justify-center">
                            <div className="text-2xl mb-2">📊</div>
                            <div className="font-semibold mb-1 text-foreground">GA4 non collegato</div>
                            <button onClick={() => setActiveTab('settings')} className="text-xs text-blue-500 hover:underline bg-transparent border-none cursor-pointer">Collega in Setup API →</button>
                          </div>
                        ) : (
                          <>
                            <div className="mb-4">
                              <div className="text-2xl font-extrabold leading-none text-foreground">{loadingGa4 ? '...' : ga4Data?.traffic?.users?.val != null ? ga4Data.traffic.users.val.toLocaleString() : '—'}</div>
                              <div className="text-[11px] text-muted-foreground mt-1">Utenti Unici nel Periodo</div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                               <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                                  <div className="text-muted-foreground mb-0.5 text-[10px]">Sessions Social</div>
                                  <div className="font-bold text-foreground">{loadingGa4 ? '...' : ga4Data ? totalSocialSessions.toLocaleString() : '—'}</div>
                               </div>
                               <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                                  <div className="text-muted-foreground mb-0.5 text-[10px]">CVR da Social</div>
                                  <div className="font-bold text-foreground">{loadingGa4 ? '...' : ga4Data ? `${socialCvr}%` : '—'}</div>
                               </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                               <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                                  <div className="text-muted-foreground mb-0.5 text-[10px]">Bounce Rate</div>
                                  <div className="font-bold text-foreground">{loadingGa4 ? '...' : ga4Data?.behavior?.bounceRate?.val != null ? `${ga4Data.behavior.bounceRate.val.toFixed(1)}%` : '—'}</div>
                               </div>
                               <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                                  <div className="text-muted-foreground mb-0.5 text-[10px]">Channel Top</div>
                                  <div className="font-bold text-foreground truncate">{loadingGa4 ? '...' : (ga4Data?.traffic?.channels?.[0]?.channel || '—')}</div>
                               </div>
                            </div>
                          </>
                        )}
                        <div className="mt-4 pt-3 border-t border-white/5">
                            <div className="text-muted-foreground text-[10px] italic">
                              {ga4Data ? 'Dati demografici disponibili nel report GA4 completo' : 'Collega GA4 per vedere le demografiche reali del sito'}
                            </div>
                         </div>
                      </div>

                     {/* 2. INSTAGRAM */}
                      <div className="bg-pink-500/5 border border-pink-500/20 p-5 rounded-xl flex flex-col">
                         <div className="flex justify-between items-start mb-4">
                           <div className="flex items-center gap-2">
                             <Instagram size={20} className="text-pink-500" />
                             <span className="font-bold text-sm text-foreground">Instagram</span>
                           </div>
                         </div>
                         <div className="flex-1 flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                           <div className="text-2xl mb-2">📱</div>
                           <div className="font-semibold text-xs mb-1 text-foreground">Instagram non collegato</div>
                           <div className="text-[10px] max-w-[200px] leading-relaxed">Collega il Page ID Meta in Setup API per vedere follower, reach ed engagement reali</div>
                           <button onClick={() => setActiveTab('settings')} className="mt-3 text-[10px] text-pink-500 bg-transparent border border-pink-500/30 hover:bg-pink-500/10 active:scale-95 transition-all rounded-lg px-3 py-1 font-semibold">Collega in Setup API →</button>
                         </div>
                      </div>

                     {/* 3. YOUTUBE */}
                      <div className="bg-red-500/5 border border-red-500/20 p-5 rounded-xl flex flex-col">
                         <div className="flex justify-between items-start mb-4">
                           <div className="flex items-center gap-2">
                             <Youtube size={20} className="text-red-500" />
                             <span className="font-bold text-sm text-foreground">YouTube</span>
                           </div>
                         </div>
                         <div className="flex-1 flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                           <div className="text-2xl mb-2">▶️</div>
                           <div className="font-semibold text-xs mb-1 text-foreground">YouTube non collegato</div>
                           <div className="text-[10px] max-w-[200px] leading-relaxed">Integrazione YouTube Analytics in arrivo — iscritti, views e watch time reali</div>
                         </div>
                      </div>

                     {/* 4. TIKTOK */}
                      <div className="bg-foreground/5 border border-foreground/10 p-5 rounded-xl flex flex-col">
                         <div className="flex items-center gap-2 mb-4">
                           <Music size={20} className="text-foreground" />
                           <span className="font-bold text-sm text-foreground">TikTok</span>
                         </div>
                         <div className="flex-1 flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                           <div className="text-2xl mb-2">🎵</div>
                           <div className="font-semibold text-xs mb-1 text-foreground">TikTok non collegato</div>
                           <div className="text-[10px] max-w-[200px] leading-relaxed">Integrazione TikTok Business API in arrivo — followers, views e completion rate reali</div>
                         </div>
                      </div>

                  </div>
                </div>

                {/* Contenuti Top Performance — visibili quando i canali social sono collegati */}
                <div className="flex flex-col items-center justify-center py-8 px-4 gap-3 bg-white/5 rounded-xl border border-dashed border-white/10">
                  <PlayCircle size={32} className="opacity-20 text-foreground" />
                  <div className="font-semibold text-sm text-foreground">Nessun contenuto tracciato</div>
                  <div className="text-xs text-muted-foreground text-center max-w-[320px]">Collega i canali social del cliente per visualizzare automaticamente i contenuti con le migliori performance.</div>
                  <button onClick={() => setActiveTab('settings')} className="mt-2 text-xs bg-cyan-600 hover:bg-cyan-500 text-white border-none py-1.5 px-4 rounded-lg cursor-pointer font-semibold active:scale-95 transition-all">⚙️ Setup API</button>
                </div>

              </div>

              {/* LATO DESTRO: Competitor e Trends */}
              <div className="flex flex-col gap-6 lg:col-span-3 border-t lg:border-t-0 lg:border-l border-white/5 pt-6 lg:pt-0 lg:pl-8">
                
                {/* Competitor Intelligence Gallery */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mappa Competitors Locali/Diretti</h3>
                    <button onClick={() => setActiveTab('intelligence')} className="text-xs flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 text-white border-none py-1.5 px-3 rounded-lg cursor-pointer font-semibold active:scale-95 transition-all">
                       <Plus size={14}/> Gestisci
                    </button>
                  </div>
                  
                  {/* Competitor reali — aggiunti dalla tab AI Intelligence */}
                  {client.intelligence?.competitors && client.intelligence.competitors.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {client.intelligence.competitors.map((c: any, i: number) => (
                        <div key={i} className="bg-white/5 border border-white/5 p-4 rounded-xl flex gap-3 items-center">
                          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex-shrink-0 flex items-center justify-center text-indigo-400 font-bold text-base">
                            {c.name?.charAt(0) || '?'}
                          </div>
                          <div className="flex-1">
                            <div className="fontWeight-600 text-sm text-foreground font-bold mb-0.5">{c.name}</div>
                            {c.insight && <div className="text-xs text-muted-foreground">{c.insight}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 px-4 gap-2 bg-white/5 rounded-xl border border-dashed border-white/10">
                      <Users size={28} className="opacity-20 text-foreground" />
                      <div className="text-xs font-semibold text-muted-foreground">Nessun competitor aggiunto</div>
                      <div className="text-[10px] text-muted-foreground text-center">Vai nella tab "AI Intelligence" per aggiungere i competitor del cliente.</div>
                    </div>
                  )}
                </div>

                {/* Trend Analysis */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Integrazione Trend Locali</h3>
                  <div className="flex flex-col items-center justify-center py-6 px-4 gap-2 bg-white/5 rounded-xl border border-dashed border-white/10">
                    <TrendingUp size={28} className="opacity-20 text-foreground" />
                    <div className="text-xs font-semibold text-muted-foreground">Trend non disponibili</div>
                    <div className="text-[10px] text-muted-foreground text-center">I trend di settore vengono generati automaticamente dall'analisi AI Intelligence.</div>
                  </div>
                </div>

              </div>
            </div>
          </section>
        </div>
      )}

      
      {/* TAB: INTELLIGENCE */}
      {activeTab === 'intelligence' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            {!client.intelligence ? (
              <div className="glass-panel p-10 text-center rounded-[20px]">
                <Brain size={48} className="opacity-20 mx-auto mb-4 text-cyan-400" />
                <h3 className="text-lg font-bold mb-2">Nessuna Analisi AI Disponibile</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
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
                  className="btn-gorgeous px-6 py-2.5 text-sm font-semibold active:scale-95 transition-all"
                >
                  Esegui Analisi Sito
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {/* USP e Prodotto */}
                <div className="glass-panel p-6 rounded-xl flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <Target className="text-amber-500" size={20} />
                    <h3 className="text-base font-bold text-foreground">Prodotto & USP</h3>
                    {client.intelligence.websiteScraped && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2.5 py-0.5 rounded-full font-semibold">✓ Sito Analizzato</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    <strong>Prodotto:</strong> {client.intelligence.productDescription}
                  </div>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    <strong>USP:</strong> {client.intelligence.uniqueValueProp}
                  </div>
                  <div className="flex gap-3 mt-2">
                    <div className="bg-white/5 px-3 py-1.5 rounded-lg text-xs border border-white/5">
                      <span className="text-muted-foreground">Tipo: </span>
                      <strong className="text-amber-500">{client.intelligence.businessType}</strong>
                    </div>
                    <div className="bg-white/5 px-3 py-1.5 rounded-lg text-xs border border-white/5">
                      <span className="text-muted-foreground">Ticket: </span>
                      <strong className="text-emerald-500">{client.intelligence.priceRange || 'Sconosciuto'}</strong>
                    </div>
                  </div>
                </div>

                {/* Target Avatar */}
                <div className="glass-panel p-6 rounded-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <Users className="text-cyan-500" size={20} />
                    <h3 className="text-base font-bold text-foreground">Target Avatar</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                    {client.intelligence.targetDescription}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-[11px] font-bold text-rose-500 mb-2 uppercase tracking-wider">I loro problemi (Pain Points)</h4>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground">
                        {client.intelligence.targetPainPoints.map((p: string, i: number) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-[11px] font-bold text-emerald-500 mb-2 uppercase tracking-wider">Leve Acquisto (Triggers)</h4>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground">
                        {client.intelligence.targetTriggers.map((t: string, i: number) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Competitor */}
                <div className="glass-panel p-6 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Target className="text-pink-500" size={20} />
                      <h3 className="text-base font-bold text-foreground">Competitor & Ads Library (Vision AI)</h3>
                    </div>
                  </div>
                  
                  {/* Lista Competitor */}
                  {(!client.intelligence.competitors || client.intelligence.competitors.length === 0) ? (
                    <p className="color-muted-foreground text-xs mb-4">Nessun competitor rilevato o aggiunto.</p>
                  ) : (
                    <div className="flex flex-col gap-4 mb-6">
                      {client.intelligence.competitors.map((c: any, i: number) => (
                        <div key={i} className="p-5 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-3">
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-foreground text-base">{c.name}</h4>
                            <button onClick={() => handleDeleteCompetitor(i)} className="bg-transparent border-none text-rose-500 hover:text-rose-400 cursor-pointer p-1 text-xs font-semibold hover:scale-95 transition-all">
                              Rimuovi
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="text-muted-foreground"><span className="text-emerald-500 font-semibold">Punti di forza:</span> {c.strength || '—'}</div>
                            <div className="text-muted-foreground"><span className="text-rose-500 font-semibold">Punti deboli:</span> {c.weakness || '—'}</div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <span className="text-muted-foreground/60 font-semibold">Stile Ads:</span> {c.adStyle || 'Non ancora analizzato.'}
                            {c.estimatedBudget && <span className="ml-2 text-cyan-400 font-semibold">({c.estimatedBudget})</span>}
                          </div>

                          {/* Vision Upload Box */}
                          <div className="p-4 bg-indigo-500/5 rounded-lg border border-dashed border-indigo-500/20 flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
                              Analisi Ads (Screenshot AI)
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed m-0">
                              Incolla uno screenshot della FB Ads Library qui, o clicca per caricare. Gemini capirà le inserzioni attive!
                            </p>
                            <input 
                              type="file" 
                              accept="image/*"
                              onChange={(e) => {
                                if (e.target.files?.[0]) handleScreenshotUpload(i, e.target.files[0])
                              }}
                              className="text-xs text-muted-foreground cursor-pointer mt-1 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20"
                            />
                            {uploadingVisionIndex === i && (
                              <div className="text-indigo-400 text-xs font-semibold flex items-center gap-1.5 mt-1 animate-pulse">
                                🤖 Lettura Vision in corso... (10s)
                              </div>
                            )}
                          </div>

                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Manual Competitor */}
                  <div className="flex gap-2 items-center bg-white/5 p-3 rounded-xl border border-white/5">
                    <input 
                      type="text" 
                      placeholder="Aggiungi nome concorrente (es. Sephora)" 
                      value={newCompetitorName}
                      onChange={e => setNewCompetitorName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddCompetitor()}
                      className="flex-1 bg-background/50 border border-white/10 hover:border-white/20 focus:border-cyan-500/50 text-foreground px-3 py-2 rounded-lg text-xs outline-none transition-all placeholder:text-muted-foreground/60"
                    />
                    <button onClick={handleAddCompetitor} className="bg-cyan-600 hover:bg-cyan-500 text-white border-none py-2 px-4 rounded-lg cursor-pointer text-xs font-semibold active:scale-95 transition-all">
                      Aggiungi
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Right */}
          <div className="flex flex-col gap-6">
            {client.intelligence && (
              <>
                {/* Meta Targeting */}
                <div className="glass-panel p-6 rounded-xl flex flex-col gap-4">
                  <h3 className="text-sm font-bold text-muted-foreground tracking-wide">Input per Algoritmo Meta</h3>
                  
                  <div>
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">Interessi Seed (Broad)</div>
                    <div className="flex flex-wrap gap-1.5">
                      {client.intelligence.metaInterests.map((interest: string, i: number) => (
                        <span key={i} className="text-[11px] bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full text-indigo-400 font-medium">
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">Dati Demografici Estesi</div>
                    <div className="text-xs text-muted-foreground leading-relaxed space-y-1 bg-white/5 p-3 rounded-lg border border-white/5">
                      <div>Età: <strong className="text-foreground">{client.intelligence.targetAgeMin} - {client.intelligence.targetAgeMax}</strong></div>
                      <div>Genere: <strong className="text-foreground">{client.intelligence.targetGender}</strong></div>
                      <div>Territorio: <strong className="text-foreground">{client.intelligence.territoryType}</strong> 
                      {client.intelligence.territoryCities && client.intelligence.territoryCities.length > 0 ? ` (${client.intelligence.territoryCities.join(', ')})` : ''}</div>
                    </div>
                  </div>
                </div>

                {/* Ultra Senior Notes */}
                {client.intelligence.analysisNotes && (
                  <div className="p-5 bg-gradient-to-r from-pink-500/10 to-indigo-500/10 rounded-xl border border-pink-500/20">
                    <h3 className="text-xs font-bold text-pink-500 uppercase tracking-wider mb-2">Ultra Senior Insight</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {client.intelligence.analysisNotes}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB: CAMPAGNE */}
      {activeTab === 'campaigns' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-xl font-extrabold text-foreground">Campagne in Piattaforma</h2>
            <Link href={`/clients/${id}/campaigns/new`} className="btn-gorgeous inline-flex items-center gap-2 no-underline text-xs font-semibold px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all">
              <Plus size={16} /> Nuova Campagna
            </Link>
          </div>
          {(client.campaigns?.length || 0) === 0 ? (
            <div className="text-center py-16 text-muted-foreground flex flex-col items-center justify-center gap-3 bg-white/[0.02] border border-white/5 rounded-2xl">
              <Zap size={40} className="opacity-20 text-muted-foreground" />
              <h3 className="font-bold text-foreground">Nessuna campagna ancora</h3>
              <p className="text-xs text-muted-foreground/60">Crea la prima campagna per questo cliente</p>
            </div>
          ) : (
            <div className="border border-white/10 rounded-xl overflow-hidden glass-panel">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="p-4">Nome Campagna</th>
                    <th className="p-4">Stato</th>
                    <th className="p-4">Obiettivo</th>
                    <th className="p-4">Budget/Giorno</th>
                    <th className="p-4">Varianti</th>
                    <th className="p-4">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-muted-foreground">
                  {(client.campaigns || []).map(c => {
                    const s = statusColors[c.status] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: c.status }
                    return (
                      <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 font-semibold text-foreground">{c.name}</td>
                        <td className="p-4">
                          <span style={{ color: s.color, backgroundColor: s.bg }} className="px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                            {s.label}
                          </span>
                        </td>
                        <td className="p-4">{c.objective}</td>
                        <td className="p-4 font-medium text-foreground">€{c.dailyBudget}/gg</td>
                        <td className="p-4">{c._count.adVariants} varianti</td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <Link href={`/clients/${id}/campaigns/${c.id}/preview`} className="px-3 py-1 rounded-lg text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:border-primary/30 transition-all no-underline inline-block">
                              Preview →
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Sezione Campagne Meta Sincronizzate */}
          <div className="mt-12 pt-8 border-t border-white/5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xl font-extrabold flex items-center gap-2 text-foreground">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <Image src="https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg" alt="Meta" width={42} height={14} className="h-3.5 w-auto" unoptimized /> Sincronizzate da Meta
                </h2>
                <p className="text-xs text-muted-foreground mt-1">Campagne attualmente attive sull'Ad Account configurato</p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <input 
                   type="text" 
                   placeholder="Filtra campagne (es. ODC)..." 
                   value={campaignFilter} 
                   onChange={e => {
                     setCampaignFilter(e.target.value)
                     localStorage.setItem(`meta_filter_${id}`, e.target.value)
                   }}
                   className="px-3 py-2 rounded-lg border border-white/10 bg-background/50 focus:border-cyan-500/50 text-xs w-full sm:w-64 outline-none transition-all placeholder:text-muted-foreground/50 text-foreground"
                />
                {loadingMeta && <span className="text-xs text-muted-foreground/60 animate-pulse shrink-0">Sincronizzazione...</span>}
              </div>
            </div>

            {!loadingMeta && metaCampaigns.length === 0 ? (
              <div className="text-center py-12 bg-background/20 rounded-2xl border border-white/5 text-muted-foreground/60 text-sm">
                Nessuna campagna trovata sull'account Meta corrente.
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto border border-white/10 rounded-xl glass-panel scrollbar-thin">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 bg-background/95 backdrop-blur-md border-b border-white/10 z-10 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="p-4">Nome (Meta)</th>
                      <th className="p-4">Stato</th>
                      <th className="p-4">Obiettivo</th>
                      <th className="p-4">Budget G. / Tot.</th>
                      <th className="p-4">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-muted-foreground">
                    {metaCampaigns.filter((mc: any) => mc.name.toLowerCase().includes(campaignFilter.toLowerCase())).map((mc: any) => {
                      const isActive = mc.status === 'ACTIVE'
                      return (
                        <tr key={mc.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-4 font-semibold text-foreground">{mc.name}</td>
                          <td className="p-4">
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide",
                              isActive ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" : "text-muted-foreground bg-white/5 border border-white/10"
                            )}>
                              {mc.status}
                            </span>
                          </td>
                          <td className="p-4">{mc.objective?.replace('OUTCOME_', '')}</td>
                          <td className="p-4 font-medium text-foreground">
                            {mc.daily_budget ? `€${(parseInt(mc.daily_budget) / 100).toFixed(2)}/gg` : 
                             mc.lifetime_budget ? `€${(parseInt(mc.lifetime_budget) / 100).toFixed(2)} Tot` : '-'}
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => handleOpenReport(mc.id, mc.objective, mc.name)}
                              disabled={loadingReportId === mc.id}
                              className={cn(
                                "py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all inline-flex items-center gap-1.5 active:scale-95 cursor-pointer",
                                loadingReportId === mc.id 
                                  ? "bg-white/5 text-muted-foreground cursor-not-allowed" 
                                  : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-500/30"
                              )}
                            >
                              {loadingReportId === mc.id ? <Loader2 size={10} className="animate-spin" /> : <BarChart2 size={10} />}
                              {loadingReportId === mc.id ? 'Caricamento...' : 'Report KPI'}
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
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-6">
            <p className="text-sm text-muted-foreground">Libreria creativa del cliente</p>
            <Link href={`/clients/${id}/brand-assets`} className="btn-gorgeous inline-flex items-center gap-2 no-underline text-xs font-semibold px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all">
              <Plus size={16} /> Gestisci Assets
            </Link>
          </div>
          {(client.brandAssets?.length || 0) === 0 ? (
            <div className="text-center py-16 text-muted-foreground bg-background/20 rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-3">
              Nessun asset caricato. Vai su "Gestisci Assets" per caricare immagini e video del cliente.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(client.brandAssets || []).map(a => (
                <div key={a.id} className="glass-card card-hover p-5 rounded-2xl border border-white/10 bg-white/[0.03] transition-all duration-300 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full">{a.type} · {a.format}</span>
                    {a.isActive ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertTriangle size={16} className="text-rose-400" />}
                  </div>
                  <div className="font-bold text-sm text-foreground">{a.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: HEATMAPS */}
      {activeTab === 'heatmaps' && (
        <div className="glass-panel p-6 sm:p-8 rounded-2xl min-h-[80vh] flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <MousePointerClick size={24} className="text-violet-400" />
              <h3 className="text-lg font-extrabold text-foreground">Mappe di Calore & Sessioni (Clarity)</h3>
            </div>
            {client.clarityProjectId && (
              <a href={`https://clarity.microsoft.com/projects/view/${client.clarityProjectId}/dashboard?date=Last%2030%20days`} target="_blank" rel="noreferrer" className="text-xs text-violet-400 hover:text-violet-300 font-semibold px-4 py-2 bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 rounded-lg no-underline transition-all inline-flex items-center justify-center">
                Apri a tutto schermo ↗
              </a>
            )}
          </div>
          
          {!client.clarityProjectId ? (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-violet-500/20 rounded-2xl bg-violet-500/5 p-8 text-center min-h-[400px]">
              <Eye size={40} className="text-violet-400 mb-4 opacity-50" />
              <h4 className="text-base font-bold text-foreground mb-2">Clarity Non Connesso</h4>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
                Inserisci il Project ID di Microsoft Clarity nelle impostazioni API per sbloccare le mappe di calore live e le registrazioni degli utenti sul sito {client.websiteUrl?.replace('https://', '') || 'selezionato'}.
              </p>
              <button onClick={() => setActiveTab('settings')} className="btn-gorgeous px-6 py-2.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white cursor-pointer transition-all">Vai a Setup API</button>
            </div>
          ) : (
             <div className="flex-1 relative w-full aspect-video min-h-[600px] rounded-xl overflow-hidden border border-white/10 bg-white">
                <iframe 
                   src={`https://clarity.microsoft.com/embed/${client.clarityProjectId}`}
                   className="absolute inset-0 w-full h-full border-0"
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
        <div className="max-w-2xl space-y-6">
          <div>
            <h2 className="text-xl font-extrabold text-foreground">Configurazione <span className="text-cyan-400">Integrazioni API</span></h2>
            <p className="text-xs text-muted-foreground mt-1">
              Collega Meta Ads e l’ecosistema Google per sincronizzare dati reali in automatico.
            </p>
          </div>

          {/* Stato Token Meta (live) */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10">
            <MetaTokenManager clientId={id as string} />
          </div>

          <form className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col gap-6 sm:gap-8" onSubmit={async (e) => {
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
                toast.success('Integrazioni aggiornate e salvate crittografate! La pagina si ricaricherà.')
                setTimeout(() => window.location.reload(), 1500)
              } else {
                const errBody = await res.json().catch(() => ({}))
                toast.error('Errore durante l\'aggiornamento: ' + (errBody?.error ?? res.status))
              }
            } catch {
              toast.error('Errore di rete.')
            }
          }}>
            {/* ─── META ADS INTEGRATION ─── */}
            <div className="space-y-6 pb-6 border-b border-white/5">
              <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
                <h3 className="text-base font-bold text-cyan-400">Meta Ads & Facebook</h3>
                <button
                  type="button"
                  disabled={loadingMetaAccounts}
                  onClick={async () => {
                    setLoadingMetaAccounts(true)
                    try {
                      const token = localStorage.getItem('token')
                      const res = await fetch(`${API_URL}/api/meta/ad-accounts`, {
                        headers: { Authorization: `Bearer ${token}` }
                      })
                      if (res.ok) {
                        const data = await res.json()
                        setMetaAdAccounts(data.accounts || [])
                      } else {
                        const err = await res.json().catch(() => ({}))
                        toast.error(err.error || 'Impossibile caricare gli account. Verifica META_SYSTEM_USER_TOKEN in Vercel.')
                      }
                    } catch(e) { console.error(e) }
                    finally { setLoadingMetaAccounts(false) }
                  }}
                  className={cn(
                    "text-xs font-semibold px-4 py-2 rounded-lg transition-all active:scale-95 inline-flex items-center gap-1.5 cursor-pointer",
                    loadingMetaAccounts ? "bg-cyan-500/20 text-cyan-400/60 cursor-not-allowed border border-cyan-500/10" : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20"
                  )}
                >
                  {loadingMetaAccounts ? <Loader2 className="h-3 w-3 animate-spin" /> : <Settings size={12} />}
                  {loadingMetaAccounts ? 'Caricamento...' : 'Carica Account Meta'}
                </button>
              </div>

              {/* Dropdown Meta Ad Account */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-muted-foreground">Ad Account ID</label>
                {metaAdAccounts.length > 0 ? (
                  <select
                    name="metaAdAccountId"
                    defaultValue={client.metaAdAccountId}
                    className="w-full text-sm bg-background/50 border border-white/10 hover:border-white/20 focus:border-cyan-500/50 text-foreground px-3 py-2.5 rounded-lg outline-none transition-all cursor-pointer"
                  >
                    <option value="">-- Seleziona account --</option>
                    {metaAdAccounts.map(a => (
                      <option key={a.id} value={a.id} className="bg-neutral-900 text-foreground">
                        {a.name} ({a.id}) — {a.currency} {a.account_status === 1 ? '✅' : '⚠️'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name="metaAdAccountId"
                    defaultValue={client.metaAdAccountId}
                    placeholder="es. act_123456789 — oppure clicca Carica Account Meta"
                    className="w-full text-sm bg-background/50 border border-white/10 hover:border-white/20 focus:border-cyan-500/50 text-foreground px-3 py-2.5 rounded-lg outline-none transition-all placeholder:text-muted-foreground/40"
                  />
                )}
                <p className="text-[10px] text-muted-foreground/60 leading-relaxed">Clicca "Carica Account Meta" per vedere gli account accessibili dall'agenzia.</p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-muted-foreground">Page ID (Opzionale)</label>
                <input name="metaPageId" defaultValue={client.metaPageId} placeholder="es. 104345345345" className="w-full text-sm bg-background/50 border border-white/10 hover:border-white/20 focus:border-cyan-500/50 text-foreground px-3 py-2.5 rounded-lg outline-none transition-all placeholder:text-muted-foreground/40" />
              </div>

              <div className="space-y-2">
                <label className="flex items-center text-xs font-bold text-muted-foreground">
                  System User Token (Meta)
                  {!client.hasMetaToken && <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wide bg-rose-500/10 text-rose-400 border border-rose-500/20">MANCANTE</span>}
                  {client.hasMetaToken && <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Configurato ✅ (lascia vuoto per mantenere)</span>}
                </label>
                <input name="metaAccessToken" placeholder="EAAB... (System User Token permanente da Meta Business)" type="password" className="w-full text-sm bg-background/50 border border-white/10 hover:border-white/20 focus:border-cyan-500/50 text-foreground px-3 py-2.5 rounded-lg outline-none transition-all placeholder:text-muted-foreground/40" />
                <p className="text-[10px] text-muted-foreground/60 leading-relaxed">Per il caricamento automatico degli account, aggiungi <code className="bg-white/5 border border-white/10 px-1 py-0.5 rounded text-[11px] font-mono text-cyan-300">META_SYSTEM_USER_TOKEN</code> nelle variabili Vercel.</p>
              </div>
            </div>

            {/* ─── GOOGLE INTEGRATION ─── */}
            <div className="space-y-6 pb-6 border-b border-white/5">
              <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
                <h3 className="text-base font-bold text-blue-400">Ecosistema Google</h3>
                <button
                  type="button"
                  disabled={loadingGoogleAdsAccounts}
                  onClick={async () => {
                    setLoadingGoogleAdsAccounts(true)
                    try {
                      const token = localStorage.getItem('token')
                      const res = await fetch(`${API_URL}/api/google-ads/customers`, {
                        headers: { Authorization: `Bearer ${token}` }
                      })
                      if (res.ok) {
                        const data = await res.json()
                        setGoogleAdsAccounts(data.customers || [])
                      } else {
                        const err = await res.json().catch(() => ({}))
                        toast.error(err.error || 'Configura GOOGLE_ADS_DEVELOPER_TOKEN e credenziali Google nelle variabili Vercel.')
                      }
                    } catch(e) { console.error(e) }
                    finally { setLoadingGoogleAdsAccounts(false) }
                  }}
                  className={cn(
                    "text-xs font-semibold px-4 py-2 rounded-lg transition-all active:scale-95 inline-flex items-center gap-1.5 cursor-pointer",
                    loadingGoogleAdsAccounts ? "bg-blue-500/20 text-blue-400/60 cursor-not-allowed border border-blue-500/10" : "bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
                  )}
                >
                  {loadingGoogleAdsAccounts ? <Loader2 className="h-3 w-3 animate-spin" /> : <Settings size={12} />}
                  {loadingGoogleAdsAccounts ? 'Caricamento...' : 'Carica Account Google Ads'}
                </button>
              </div>

              {/* Google Ads Customer ID */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-muted-foreground">Google Ads Customer ID</label>
                {googleAdsAccounts.length > 0 ? (
                  <select
                    name="googleAdAccountId"
                    defaultValue={client.googleAdAccountId || ''}
                    className="w-full text-sm bg-background/50 border border-white/10 hover:border-white/20 focus:border-blue-500/50 text-foreground px-3 py-2.5 rounded-lg outline-none transition-all cursor-pointer"
                  >
                    <option value="">-- Seleziona account --</option>
                    {googleAdsAccounts.map((a: any) => (
                      <option key={a.id} value={a.formattedId || a.id} className="bg-neutral-900 text-foreground">
                        {a.name} — {a.formattedId || a.id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name="googleAdAccountId"
                    defaultValue={client.googleAdAccountId || ''}
                    placeholder="es. 123-456-7890 — oppure clicca Carica Account Google Ads"
                    className="w-full text-sm bg-background/50 border border-white/10 hover:border-white/20 focus:border-blue-500/50 text-foreground px-3 py-2.5 rounded-lg outline-none transition-all placeholder:text-muted-foreground/40"
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-muted-foreground">GA4 Property ID (Analytics)</label>
                <input name="ga4PropertyId" defaultValue={client.ga4PropertyId || ''} placeholder="es. 345678901" className="w-full text-sm bg-background/50 border border-white/10 hover:border-white/20 focus:border-blue-500/50 text-foreground px-3 py-2.5 rounded-lg outline-none transition-all placeholder:text-muted-foreground/40" />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-muted-foreground">Google Refresh Token (OAuth)</label>
                <input name="googleRefreshToken" placeholder="1//04ABCD..." type="password" className="w-full text-sm bg-background/50 border border-white/10 hover:border-white/20 focus:border-blue-500/50 text-foreground px-3 py-2.5 rounded-lg outline-none transition-all placeholder:text-muted-foreground/40" />
                <p className="text-[10px] text-muted-foreground/60 leading-relaxed">Richiesto per sbloccare le statistiche di Google Ads.</p>
              </div>
            </div>

            {/* ─── Google Business Profile ─── */}
            <div className="space-y-6 pb-6 border-b border-white/5">
              <h3 className="text-base font-bold text-amber-400">Google Business Profile (Maps)</h3>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-muted-foreground">ID Account GBP (Account Name)</label>
                <input name="gbpAccountId" defaultValue={client.gbpAccountId || ''} placeholder="es. accounts/123456789" className="w-full text-sm bg-background/50 border border-white/10 hover:border-white/20 focus:border-amber-500/50 text-foreground px-3 py-2.5 rounded-lg outline-none transition-all placeholder:text-muted-foreground/40" />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-muted-foreground">GBP Refresh Token (OAuth)</label>
                <input name="gbpRefreshToken" placeholder="1//04ABCD..." type="password" className="w-full text-sm bg-background/50 border border-white/10 hover:border-white/20 focus:border-amber-500/50 text-foreground px-3 py-2.5 rounded-lg outline-none transition-all placeholder:text-muted-foreground/40" />
                <p className="text-[10px] text-muted-foreground/60 leading-relaxed">Spesso uguale a quello di Google Ads se gestiti dalla stessa email.</p>
              </div>
            </div>

            {/* ─── MICROSOFT CLARITY ─── */}
            <div className="p-5 border border-violet-500/20 bg-violet-500/5 rounded-2xl space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-violet-400">
                  Microsoft Clarity (Heatmaps)
                </label>
                <p className="text-[10px] text-muted-foreground mt-0.5">Sblocca le mappe di calore sulla dashboard inserendo il Project ID.</p>
              </div>
              <input name="clarityProjectId" defaultValue={client.clarityProjectId || ''} placeholder="es. 8abc123" className="w-full text-sm bg-background/50 border border-white/10 hover:border-white/20 focus:border-violet-500/50 text-foreground px-3 py-2.5 rounded-lg outline-none transition-all placeholder:text-muted-foreground/40" />
            </div>

            {/* GA4 Property selection */}
            <div className="p-5 border border-blue-500/20 bg-blue-500/5 rounded-2xl space-y-4">
              <label className="block text-xs font-bold text-blue-400">
                Google Analytics 4 — Collega Proprietà
              </label>

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
                        toast.error(err.error || 'Impossibile caricare le proprietà. Verifica che Analytics Admin API sia abilitata nel GCP project.')
                      }
                    } catch(e) { console.error(e) }
                    finally { setLoadingGa4Props(false) }
                  }}
                  className="w-full py-2.5 px-4 text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 rounded-lg cursor-pointer transition-all text-center"
                >
                  Carica Proprietà da Google Analytics
                </button>
              )}

              {loadingGa4Props && (
                <div className="py-2 text-center text-xs text-muted-foreground/60 animate-pulse">Connessione a Google Analytics...</div>
              )}

              {ga4Properties.length > 0 && (
                <div className="space-y-1.5">
                  <select
                    name="ga4PropertyId"
                    defaultValue={client.ga4PropertyId || ''}
                    className="w-full text-sm bg-background/50 border border-white/10 hover:border-white/20 focus:border-blue-500/50 text-foreground px-3 py-2.5 rounded-lg outline-none transition-all cursor-pointer"
                  >
                    <option value="">— Nessuna proprietà selezionata —</option>
                    {ga4Properties.map(p => (
                      <option key={p.propertyId} value={p.propertyId} className="bg-neutral-900 text-foreground">
                        {p.displayName} ({p.websiteUrl}) · ID: {p.propertyId}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground/60">Account: {ga4Properties[0]?.accountName} · {ga4Properties.length} proprietà trovate</p>
                </div>
              )}

              {ga4Properties.length === 0 && !loadingGa4Props && client.ga4PropertyId && (
                <div className="text-xs text-blue-400 py-2 px-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-between">
                  <span>Collega attivo: Property ID <strong>{client.ga4PropertyId}</strong></span>
                  <input type="hidden" name="ga4PropertyId" value={client.ga4PropertyId} />
                </div>
              )}
              {ga4Properties.length === 0 && !loadingGa4Props && !client.ga4PropertyId && (
                <input type="hidden" name="ga4PropertyId" value="" />
              )}
            </div>

            {/* GOOGLE ADS BLOCK */}
            <div className="p-5 border border-emerald-500/20 bg-emerald-500/5 rounded-2xl space-y-4">
              <label className="block text-xs font-bold text-emerald-400">
                Google Ads — Customer ID
              </label>

              {client.googleAdAccountId && (
                <div className="text-xs text-emerald-400 py-2 px-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  Collegato: <strong>{client.googleAdAccountId}</strong>
                </div>
              )}

              <input
                type="text"
                name="googleAdAccountId"
                defaultValue={client.googleAdAccountId || ''}
                placeholder="Es. 123-456-7890 oppure 1234567890"
                className="w-full text-sm bg-background/50 border border-white/10 hover:border-white/20 focus:border-emerald-500/50 text-foreground px-3 py-2.5 rounded-lg outline-none transition-all placeholder:text-muted-foreground/40"
              />
              <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                Trova il Customer ID su ads.google.com in alto a destra (formato: 123-456-7890). Rimuovi i trattini.
              </p>

              <div className="flex gap-4 items-center flex-wrap">
                <a
                  href={`${API_URL}/api/clients/${id}/google-ads/auth`}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('pendingGoogleAdsClientId', id as string)
                    }
                  }}
                >
                  Oppure accedi con Google per caricare la lista account automaticamente
                </a>
                {loadingGoogleAdsAccounts && (
                  <span className="text-xs text-muted-foreground/60 animate-pulse">Caricamento...</span>
                )}
              </div>

              {googleAdsAccounts.length > 0 && (
                <div className="mt-2">
                  <select
                    name="googleAdAccountId"
                    defaultValue={client.googleAdAccountId || ''}
                    className="w-full text-sm bg-background/50 border border-white/10 hover:border-white/20 focus:border-emerald-500/50 text-foreground px-3 py-2.5 rounded-lg outline-none transition-all cursor-pointer"
                  >
                    <option value="">— Seleziona Account —</option>
                    {googleAdsAccounts.map(a => (
                      <option key={a.id} value={a.formattedId || a.id} className="bg-neutral-900 text-foreground">
                        {a.name} — {a.formattedId || a.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* GOOGLE BUSINESS PROFILE BLOCK */}
            <div className="p-5 border border-amber-500/20 bg-amber-500/5 rounded-2xl space-y-4">
              <label className="block text-xs font-bold text-amber-400">
                Google Business Profile — Collega Location
              </label>

              {client.gbpLocationId && (
                <div className="text-xs text-amber-500 py-2 px-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between">
                  <span>Collegato: <strong>{client.gbpLocationId}</strong></span>
                  <input type="hidden" name="gbpLocationId" value={client.gbpLocationId} />
                  <input type="hidden" name="gbpAccountId" value={client.gbpAccountId || ''} />
                </div>
              )}

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
                        toast.error(err.error || 'Impossibile caricare le location. Devi prima fare login con l\'account Google.')
                      }
                    } catch(e) { console.error(e) }
                    finally { setLoadingGbpLocations(false) }
                  }}
                  className="w-full py-2.5 px-4 text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 rounded-lg cursor-pointer transition-all text-center"
                >
                  Carica Location GBP collegate
                </button>
              )}

              {loadingGbpLocations && (
                <div className="py-2 text-center text-xs text-muted-foreground/60 animate-pulse">Caricamento schede Google Business Profile...</div>
              )}

              {gbpLocations.length > 0 && (
                <div className="space-y-2">
                  <select
                    name="gbpLocationId"
                    defaultValue={client.gbpLocationId || ''}
                    className="w-full text-sm bg-background/50 border border-white/10 hover:border-white/20 focus:border-amber-500/50 text-foreground px-3 py-2.5 rounded-lg outline-none transition-all cursor-pointer"
                  >
                    <option value="">— Nessuna location selezionata —</option>
                    {gbpLocations.map(l => (
                      <option key={l.name} value={l.name} className="bg-neutral-900 text-foreground">
                        {l.title} ({l.address}) {l.isVerified ? '✅' : '❌'}
                      </option>
                    ))}
                  </select>
                  {gbpAccounts.length > 0 && (
                    <input type="hidden" name="gbpAccountId" value={gbpAccounts[0].name} />
                  )}
                  <p className="text-[10px] text-muted-foreground/60">{gbpLocations.length} location trovate in questo account.</p>
                </div>
              )}
            </div>

            <button type="submit" className="btn-gorgeous w-full py-3 text-sm font-extrabold uppercase tracking-wide bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl cursor-pointer shadow-lg active:scale-98 transition-all">Salva Configurazione</button>
          </form>
        </div>
      )}
    </div>
  )
}
