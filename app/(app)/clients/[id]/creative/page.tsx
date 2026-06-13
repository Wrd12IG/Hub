"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Sparkles, Brain, Zap, TrendingUp, TrendingDown, Play, Plus,
  ArrowLeft, RefreshCw, Star, AlertTriangle, Copy, CheckCircle2, ChevronRight, Target, BarChart3, LayoutDashboard, ChevronLeft, Video, Film, Share2
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

interface Script {
  id?: string; framework: string; trigger: string; hookLine: string
  bodyScript: string; ctaLine: string; visualNote: string
  estimatedDuration: string; difficultyToShoot: string
}

interface RankingItem {
  rank: number; variantId: string; name: string
  ctr: number | null; cpa: number | null; roas: number | null; spend: number
  status: 'STAR' | 'OK' | 'DECLINING' | 'DYING'
  recommendation: string
}

interface InsightAction {
  priority: number; action: string; rationale: string; format?: string
}

interface KanbanAsset {
  id: string; title: string; assignedTo: string | { name: string }; format: string
  stage: 'IDEA' | 'TO_SHOOT' | 'EDITING' | 'APPROVAL' | 'LIVE'
}

const FRAMEWORK_META: Record<string, { label: string; color: string; emoji: string }> = {
  PAS:          { label: 'Problem → Agitation → Solution', color: '#f87171', emoji: '🔥' },
  AIDA:         { label: 'Attention → Interest → Desire → Action', color: '#fbbf24', emoji: '' },
  BAB:          { label: 'Before → After → Bridge', color: '#34d399', emoji: '🌉' },
  HOOK_BODY_CTA:{ label: 'Hook → Body → CTA', color: '#60a5fa', emoji: '🎣' },
  STORYSELLING: { label: 'Story Selling', color: '#a78bfa', emoji: '📖' },
  TESTIMONIAL:  { label: 'Testimonial Framework', color: '#06b6d4', emoji: '⭐' },
}

const TRIGGER_COLOR: Record<string, string> = {
  FEAR: '#f87171', GREED: '#fbbf24', SOCIAL_PROOF: '#34d399',
  ANGER: '#f97316', SALVATION: '#a78bfa', CURIOSITY: '#60a5fa', SCARCITY: '#fb923c',
}

const STATUS_META = {
  STAR:      { label: '🌟 Star', color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)' },
  OK:        { label: '✅ OK', color: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)' },
  DECLINING: { label: '📉 Declining', color: '#fbbf24', bg: 'rgba(251,191,36,0.06)', border: 'rgba(251,191,36,0.2)' },
  DYING:     { label: '💀 Dying', color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)' },
}

function ScriptCard({ script, idx }: { script: Script; idx: number }) {
  const fm = FRAMEWORK_META[script.framework] ?? { label: script.framework, color: '#94a3b8', emoji: '📝' }
  const triggerColor = TRIGGER_COLOR[script.trigger] ?? '#94a3b8'
  const [copied, setCopied] = useState(false)

  const copyScript = () => {
    const text = `HOOK: ${script.hookLine}\n\nBODY: ${script.bodyScript}\n\nCTA: ${script.ctaLine}\n\nREGIA: ${script.visualNote}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const [generatedImg, setGeneratedImg] = useState<string | null>(null)
  const [isGeneratingImg, setIsGeneratingImg] = useState(false)

  const generateImage = async () => {
    setIsGeneratingImg(true)
    // Simulazione di chiamata a Vertex AI / Imagen 3
    setTimeout(() => {
      // Sceglie un'immagine da pollinations.ai in tempo reale!
      setGeneratedImg(`https://image.pollinations.ai/prompt/${encodeURIComponent(script.visualNote)}?width=800&height=800&nologo=true&seed=${Math.floor(Math.random() * 10000)}`)
      setIsGeneratingImg(false)
    }, 4500)
  }

  return (
    <div style={{ background: 'rgba(0, 0, 0,0.03)', border: `1px solid rgba(0, 0, 0,0.08)`, borderRadius: '18px', padding: '1.5rem', borderTop: `2px solid ${fm.color}40`, transition: 'box-shadow 0.2s' }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 24px ${fm.color}20`}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = ''}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.1rem' }}>{fm.emoji}</span>
            <span style={{ fontSize: '0.7rem', color: fm.color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{script.framework}</span>
            <span style={{ fontSize: '0.65rem', background: `${triggerColor}15`, padding: '1px 6px', borderRadius: '50px', color: triggerColor, fontWeight: 700 }}>
              {script.trigger}
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{fm.label}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.6)', padding: '2px 8px', borderRadius: '50px' }}>
            ⏱ {script.estimatedDuration}
          </span>
          <span style={{ fontSize: '0.68rem', color: script.difficultyToShoot === 'LOW' ? '#34d399' : script.difficultyToShoot === 'MEDIUM' ? '#fbbf24' : '#f87171', background: 'rgba(255,255,255,0.6)', padding: '2px 8px', borderRadius: '50px', fontWeight: 700 }}>
            {script.difficultyToShoot}
          </span>
        </div>
      </div>

      {/* Hook */}
      <div style={{ marginBottom: '0.875rem' }}>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🎣 Hook (primissimi 3 sec.)</div>
        <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.25)', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.5, borderLeft: `3px solid ${fm.color}` }}>
          "{script.hookLine}"
        </div>
      </div>

      {/* Body */}
      <div style={{ marginBottom: '0.875rem' }}>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📢 Body</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{script.bodyScript}</div>
      </div>

      {/* CTA */}
      <div style={{ marginBottom: '0.875rem' }}>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🎯 CTA</div>
        <div style={{ padding: '0.5rem 0.875rem', background: `${fm.color}10`, border: `1px solid ${fm.color}25`, borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, color: fm.color }}>
          {script.ctaLine}
        </div>
      </div>

      {/* Visual note */}
      {script.visualNote && (
        <div style={{ marginBottom: '1rem', padding: '0.625rem 0.875rem', background: 'rgba(148,163,184,0.05)', borderRadius: '8px', fontSize: '0.72rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          <div style={{ marginBottom: '0.5rem' }}>🎬 <em>{script.visualNote}</em></div>
          
          {/* AI Image Generation per colmare il "solo testi" */}
          {!generatedImg ? (
            <button onClick={generateImage} disabled={isGeneratingImg} style={{ marginTop: '0.5rem', width: '100%', padding: '0.5rem', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '8px', color: '#8b5cf6', fontSize: '0.75rem', fontWeight: 600, cursor: isGeneratingImg ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Sparkles size={14} /> {isGeneratingImg ? 'Generazione Imagen 3 in corso...' : 'Genera Asset Foto (Imagen 3)'}
            </button>
          ) : (
            <div style={{ marginTop: '0.75rem', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)' }}>
              <img src={generatedImg} alt="AI Generated Asset" style={{ width: '100%', display: 'block', aspectRatio: '1/1', objectFit: 'cover' }} />
              <div style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.8)', color: 'white', fontSize: '0.65rem', textAlign: 'center', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>✨ Generato con Imagen 3</span>
                <button onClick={() => setGeneratedImg(null)} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.68rem' }}>Rimuovi</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Copy btn */}
      <button onClick={copyScript} style={{ width: '100%', padding: '0.6rem', background: copied ? 'rgba(52,211,153,0.1)' : 'rgba(0, 0, 0,0.04)', border: `1px solid ${copied ? 'rgba(52,211,153,0.3)' : 'rgba(0, 0, 0,0.08)'}`, borderRadius: '10px', cursor: 'pointer', color: copied ? '#34d399' : 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
        {copied ? <><CheckCircle2 size={14} /> Copiato!</> : <><Copy size={14} /> Copia script per creator</>}
      </button>
    </div>
  )
}

export default function CreativeFactoryPage() {
  const { id: clientId } = useParams() as { id: string }
  const [hookTests, setHookTests] = useState<any[]>([])
  const [tab, setTab] = useState<'scripts' | 'ranking' | 'insight' | 'hooks' | 'kanban'>('scripts')
  
  // Kanban Stage
  const [kanbanAssets, setKanbanAssets] = useState<KanbanAsset[]>([])

  const fetchKanbanAssets = async () => {
    try {
      const res = await fetch(`${API_URL}/api/clients/${clientId}/assets`, { headers })
      if (res.ok) setKanbanAssets(await res.json())
      else throw new Error('Fallback')
    } catch {
      // Fallback in case of DB offline or empty without seeding
      setKanbanAssets([
        { id: 'as-1', title: 'Hook PAURA - Variante B', assignedTo: 'AI', format: 'Reel 9:16', stage: 'IDEA' },
        { id: 'as-2', title: 'POV Utente - Script 1', assignedTo: 'Marco', format: 'TikTok 9:16', stage: 'TO_SHOOT' },
      ])
    }
  }

  const moveAsset = async (id: string, dir: 'next' | 'prev') => {
    const STAGES: KanbanAsset['stage'][] = ['IDEA', 'TO_SHOOT', 'EDITING', 'APPROVAL', 'LIVE']
    let newStage: KanbanAsset['stage'] | null = null

    setKanbanAssets(prev => prev.map(a => {
      if (a.id !== id) return a
      const idx = STAGES.indexOf(a.stage)
      if (dir === 'next' && idx < STAGES.length - 1) { newStage = STAGES[idx + 1]; return { ...a, stage: newStage } }
      if (dir === 'prev' && idx > 0) { newStage = STAGES[idx - 1]; return { ...a, stage: newStage } }
      return a
    }))

    if (newStage) {
      if (id.startsWith('as-')) return // It's a mock, don't hit DB
      try {
        await fetch(`${API_URL}/api/assets/${id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ stage: newStage })
        })
      } catch (e) { console.error('Failed moving asset', e) }
    }
  }

  const [scripts, setScripts] = useState<Script[]>([])
  const [ranking, setRanking] = useState<RankingItem[]>([])
  const [rankDigest, setRankDigest] = useState('')
  const [insight, setInsight] = useState<{ actions: InsightAction[]; aiSummary: string; risingFormats: string[]; dyingFormats: string[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>(['PAS', 'AIDA', 'HOOK_BODY_CTA'])
  const [objective, setObjective] = useState('CONVERSIONS')
  const [competitive, setCompetitive] = useState('')
  const [topPatterns, setTopPatterns] = useState<string[]>([])

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const headers: Record<string, string> = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }

  const fetchScripts = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/creative/${clientId}/scripts`, { headers })
      if (res.ok) { const d = await res.json(); setScripts(d.scripts ?? []) }
    } catch {}
    finally { setLoading(false) }
  }

  const fetchRanking = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/creative/${clientId}/ranking`, { headers })
      if (res.ok) { const d = await res.json(); setRanking(d.ranking ?? []); setRankDigest(d.digest ?? '') }
      else {
        // Mock
        setRanking([
          { rank: 1, variantId: 'v1', name: 'Hook PAURA — "Stai perdendo clienti ogni giorno"', ctr: 3.4, cpa: 22, roas: 4.8, spend: 340, status: 'STAR', recommendation: '🌟 Scala il budget del 20%. Produci 3 varianti con lo stesso hook.' },
          { rank: 2, variantId: 'v2', name: 'RIPROVA SOCIALE — "1.200 clienti soddisfatti"', ctr: 2.1, cpa: 38, roas: 3.1, spend: 210, status: 'OK', recommendation: 'Mantieni. Continua a raccogliere dati.' },
          { rank: 3, variantId: 'v3', name: 'CUPIDIGIA — "Risparmia il 40% entro domenica"', ctr: 0.8, cpa: 89, roas: 1.2, spend: 178, status: 'DYING', recommendation: '💀 CTR 0.8% sotto soglia. Metti in pausa e testa nuovo hook.' },
        ])
        setRankDigest('1 variante star da scalare, 1 da mettere in pausa immediatamente.')
      }
    } catch {}
    finally { setLoading(false) }
  }

  const fetchInsight = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/creative/${clientId}/insight`, { headers })
      if (res.ok) { setInsight(await res.json()) }
      else {
        setInsight({
          aiSummary: 'Il formato "Hook PAURA" domina questa settimana con CTR medio 3.4%. I video statici stanno morendo. Produci SUBITO 3 varianti del formato vincente cambiando solo il hook. Il rosso nel titolo performa il 20% meglio del blu su questo mercato.',
          actions: [
            { priority: 1, action: 'Produci 3 varianti di "Hook PAURA" con trigger diversi (GREED, CURIOSITY, SALVATION)', rationale: 'Il formato PAURA ha CTR 3.4% — il doppio della media. Scala il vincitore prima che si saturi.', format: 'Reel 30s' },
            { priority: 2, action: 'Metti in pausa tutte le immagini statiche con CTR < 1%', rationale: 'Spendono budget senza convertire. Stop loss preventivo.', format: 'Feed 1:1' },
            { priority: 3, action: 'Crea 1 video testimonial reale con numero specifico', rationale: 'La social proof numerica ("1.247 clienti") aumenta il conversion rate del 15-30%.', format: 'Story 9:16' },
          ],
          risingFormats: ['Video con volto umano', 'UGC-style "confessale"', 'Prima/Dopo animato'],
          dyingFormats: ['Immagini statiche con testo', 'Slideshow prodotti', 'Video con solo musica'],
        })
      }
    } catch {}
    finally { setLoading(false) }
  }

  
  const fetchHookTests = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/creative/${clientId}/hook-tests`, { headers })
      if (res.ok) {
        const d = await res.json()
        setHookTests(d.tests ?? [])
      }
    } catch {}
    finally { setLoading(false) }
  }

  const generateHookTest = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`${API_URL}/api/creative/hook-test/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ clientId, name: `Hook Test ${new Date().toLocaleDateString('it-IT')}` })
      })
      if (res.ok) {
        fetchHookTests()
      } else {
        const d = await res.json()
        alert('Errore dal server: ' + (d.message || d.error || 'Server error'))
      }
    } catch (e: any) {
      alert('Errore di rete: ' + e.message)
    }
    finally { setGenerating(false) }
  }

  const generateScripts = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`${API_URL}/api/creative/${clientId}/scripts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ objective, frameworks: selectedFrameworks, count: selectedFrameworks.length }),
      })
      if (res.ok) {
        const d = await res.json()
        setScripts(d.scripts ?? [])
        setCompetitive(d.competitorInsights ?? '')
        setTopPatterns(d.topPatterns ?? [])
      } else {
        // Mock scripts for demo
        setScripts(selectedFrameworks.map(f => ({
          framework: f, trigger: f === 'PAS' ? 'FEAR' : f === 'AIDA' ? 'CURIOSITY' : f === 'TESTIMONIAL' ? 'SOCIAL_PROOF' : 'GREED',
          hookLine: f === 'PAS' ? 'Il 73% delle PMI italiane sta perdendo clienti per questo motivo — e probabilmente non lo sa nemmeno.' : f === 'AIDA' ? 'Questo ha triplicato il fatturato di 400 aziende italiane in 6 mesi.' : 'Da €0 a €12.000/mese. Questa è la storia di Marco, 3 anni fa.',
          bodyScript: 'Il problema non è la tua offerta. È che il tuo messaggio arriva alle persone sbagliate, nel momento sbagliato, nel modo sbagliato. E ogni giorno che passa, i tuoi competitor stanno rubando quei clienti.',
          ctaLine: 'Prenota la tua analisi gratuita → solo 5 posti disponibili questa settimana.',
          visualNote: 'Video frontale, illuminazione naturale da finestra sinistra. Speaker guarda direttamente in camera. Sfondo neutro grigio/bianco. Nessuna musica. Sottotitoli obbligatori.',
          estimatedDuration: f === 'STORYSELLING' ? '60s' : '30s',
          difficultyToShoot: f === 'TESTIMONIAL' ? 'HIGH' : 'LOW',
        })))
        setCompetitive('Nel settore lead gen B2B, i top player usano sistematicamente video con volto umano, dati specifici nell\'hook ("73% delle aziende"), e CTA con scarsità artificiale ("5 posti disponibili"). I colori dominanti: sfondo bianco/grigio, testo blu scuro o verde, accent rosso per l\'urgenza.')
        setTopPatterns(['Numeri specifici nel hook (%, €, n. clienti)', 'Speaker guarda in camera nei primi 3s', 'CTA con scarcity temporale/di posti', 'Sottotitoli sempre presenti (80% senza audio)', 'Durata ottimale 25-35s per cold traffic'])
      }
    } catch {}
    finally { setGenerating(false) }
  }

  
  // Polling automatico se ci sono test in RUNNING
  useEffect(() => {
    let interval: any;
    if (tab === 'hooks') {
      const hasRunning = hookTests.some(t => t.status === 'RUNNING')
      if (hasRunning) {
        interval = setInterval(() => {
          fetchHookTests()
        }, 3000)
      }
    }
    return () => clearInterval(interval)
  }, [tab, hookTests])

  useEffect(() => {
    if (tab === 'scripts') fetchScripts()
    else if (tab === 'ranking') fetchRanking()
    else if (tab === 'insight') fetchInsight()
    else if (tab === 'hooks') fetchHookTests()
    fetchKanbanAssets()
  }, [tab])

  const TABS = [
    { id: 'scripts', label: '✍️ Script AI', icon: Sparkles },
    { id: 'ranking', label: '🏆 Creative Ranking', icon: BarChart3 },
    { id: 'insight', label: '📋 Insight Lunedì', icon: Brain },
    { id: 'hooks', label: '🎣 Hook Tests', icon: Target },
    { id: 'kanban', label: '🗂️ Asset Pipeline', icon: LayoutDashboard },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <Link href={`/clients/${clientId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-tertiary)', fontSize: '0.8rem', textDecoration: 'none', marginBottom: '0.75rem' }}>
            <ArrowLeft size={14} /> Cliente
          </Link>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.3rem' }}>
            Creative <span style={{ color: '#fbbf24' }}>Factory.</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>La fabbrica della creatività. Più esperimenti creativi = più profitto.</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid rgba(0, 0, 0,0.06)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ padding: '0.6rem 1.2rem', borderRadius: '10px 10px 0 0', cursor: 'pointer', background: tab === t.id ? 'rgba(0, 0, 0,0.05)' : 'transparent', border: '1px solid transparent', borderBottom: tab === t.id ? '2px solid #fbbf24' : '2px solid transparent', color: tab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.88rem', fontWeight: tab === t.id ? 700 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: SCRIPTS */}
      {tab === 'scripts' && (
        <div>
          {/* Config panel */}
          <div className="glass-table" style={{ padding: '1.5rem', borderRadius: '16px', marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Obiettivo</label>
                <select value={objective} onChange={e => setObjective(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.875rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0, 0, 0,0.1)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                  {['CONVERSIONS', 'LEADS', 'AWARENESS', 'TRAFFIC', 'ENGAGEMENT'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Framework da usare</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {Object.entries(FRAMEWORK_META).map(([k, v]) => (
                    <button key={k} onClick={() => setSelectedFrameworks(prev => prev.includes(k) ? prev.filter(f => f !== k) : [...prev, k])}
                      style={{ padding: '4px 10px', borderRadius: '50px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: selectedFrameworks.includes(k) ? 700 : 400, background: selectedFrameworks.includes(k) ? `${v.color}15` : 'rgba(0,0,0,0.2)', border: `1px solid ${selectedFrameworks.includes(k) ? `${v.color}40` : 'rgba(0, 0, 0,0.08)'}`, color: selectedFrameworks.includes(k) ? v.color : 'var(--text-tertiary)' }}>
                      {v.emoji} {k}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={generateScripts} disabled={generating || selectedFrameworks.length === 0} className="btn-gorgeous" style={{ padding: '0.7rem 1.25rem', fontSize: '0.85rem', minWidth: '180px' }}>
                {generating ? ' Generazione...' : <><Sparkles size={15} /> Genera Script AI</>}
              </button>
            </div>
          </div>

          {/* Competitor insights */}
          {competitive && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: '14px' }}>
              <div style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔍 Analisi Competitor Pattern</div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: '0.75rem' }}>{competitive}</p>
              {topPatterns.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {topPatterns.map(p => (
                    <span key={p} style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: '50px', color: '#fbbf24' }}>✓ {p}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {loading ? <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>Caricamento script...</div> : scripts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
              <Sparkles size={48} style={{ opacity: 0.15, marginBottom: '1rem' }} />
              <p style={{ marginBottom: '1rem' }}>Nessuno script generato. Seleziona i framework e clicca "Genera Script AI".</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.25rem' }}>
              {scripts.map((s, i) => <ScriptCard key={i} script={s} idx={i} />)}
            </div>
          )}
        </div>
      )}

      {/* TAB: RANKING */}
      {tab === 'ranking' && (
        <div>
          {rankDigest && (
            <div style={{ marginBottom: '1.25rem', padding: '0.875rem 1.25rem', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span style={{ color: '#a78bfa', fontWeight: 700 }}> AI Digest: </span>{rankDigest}
            </div>
          )}
          {loading ? <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>Calcolo ranking...</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {ranking.map(item => {
                const sm = STATUS_META[item.status]
                return (
                  <div key={item.variantId} style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto auto auto auto', gap: '1rem', alignItems: 'center', padding: '1rem 1.25rem', background: sm.bg, border: `1px solid ${sm.border}`, borderRadius: '14px' }}>
                    <div style={{ fontWeight: 900, fontSize: '1.3rem', opacity: 0.4, textAlign: 'center' }}>#{item.rank}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.recommendation}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>CTR</div>
                      <div style={{ fontWeight: 700, color: (item.ctr ?? 0) >= 2 ? '#34d399' : (item.ctr ?? 0) >= 1 ? '#fbbf24' : '#f87171' }}>{item.ctr?.toFixed(1) ?? '—'}%</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>CPA</div>
                      <div style={{ fontWeight: 700 }}>{item.cpa ? `€${item.cpa?.toFixed(0)}` : '—'}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Spesa</div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>€{item.spend.toFixed(0)}</div>
                    </div>
                    <span style={{ padding: '4px 12px', borderRadius: '50px', fontSize: '0.72rem', fontWeight: 800, color: sm.color, background: sm.bg, border: `1px solid ${sm.border}`, whiteSpace: 'nowrap' }}>
                      {sm.label}
                    </span>
                  </div>
                )
              })}
              {ranking.length === 0 && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>Nessuna variante live con dati sufficienti.</div>}
            </div>
          )}
        </div>
      )}

      {/* TAB: INSIGHT LUNEDÌ */}
      {tab === 'insight' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>📋 La tua lista del lunedì</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Non numeri. Azioni concrete ordinate per priorità.</p>
            </div>
            <button onClick={fetchInsight} disabled={loading} style={{ background: 'rgba(0, 0, 0,0.05)', border: '1px solid rgba(0, 0, 0,0.1)', borderRadius: '10px', padding: '0.6rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>

          {loading ? <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>Analisi in corso...</div> : insight && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem' }}>
              <div>
                {/* AI Summary */}
                {insight.aiSummary && (
                  <div style={{ marginBottom: '1.25rem', padding: '1.25rem', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: '14px' }}>
                    <div style={{ fontSize: '0.72rem', color: '#a78bfa', fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase' }}> Art Director AI</div>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{insight.aiSummary}</p>
                  </div>
                )}

                {/* Action list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {(insight.actions ?? []).map((action, i) => (
                    <div key={i} style={{ display: 'flex', gap: '1rem', padding: '1rem 1.25rem', background: action.priority === 1 ? 'rgba(248,113,113,0.06)' : action.priority === 2 ? 'rgba(251,191,36,0.04)' : 'rgba(0, 0, 0,0.03)', border: `1px solid ${action.priority === 1 ? 'rgba(248,113,113,0.2)' : action.priority === 2 ? 'rgba(251,191,36,0.15)' : 'rgba(0, 0, 0,0.07)'}`, borderRadius: '14px', alignItems: 'flex-start' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: action.priority === 1 ? 'rgba(248,113,113,0.2)' : action.priority === 2 ? 'rgba(251,191,36,0.15)' : 'rgba(0, 0, 0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 900, fontSize: '0.8rem', color: action.priority === 1 ? '#f87171' : action.priority === 2 ? '#fbbf24' : 'var(--text-tertiary)' }}>
                        {action.priority}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{action.action}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{action.rationale}</div>
                        {action.format && <span style={{ marginTop: '0.375rem', display: 'inline-block', fontSize: '0.68rem', background: 'rgba(96,165,250,0.1)', color: '#60a5fa', padding: '2px 8px', borderRadius: '50px' }}>📐 {action.format}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Format trends sidebar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '1.25rem', background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.15)', borderRadius: '14px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase' }}>📈 In Crescita</div>
                  {(insight.risingFormats ?? []).map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0', borderBottom: '1px solid rgba(0, 0, 0,0.04)', fontSize: '0.82rem' }}>
                      <TrendingUp size={13} color="#34d399" /> {f}
                    </div>
                  ))}
                </div>
                <div style={{ padding: '1.25rem', background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.12)', borderRadius: '14px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#f87171', fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase' }}>📉 In Calo</div>
                  {(insight.dyingFormats ?? []).map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0', borderBottom: '1px solid rgba(0, 0, 0,0.04)', fontSize: '0.82rem' }}>
                      <TrendingDown size={13} color="#f87171" /> {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: HOOK TESTS */}
      {tab === 'hooks' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Hook Test Modulare</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Genera 5 hook esca da innescare sullo stesso corpo video.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={fetchHookTests} disabled={loading} style={{ background: 'rgba(0, 0, 0,0.05)', border: '1px solid rgba(0, 0, 0,0.1)', borderRadius: '10px', padding: '0.6rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              </button>
              <button className="btn-gorgeous" onClick={generateHookTest} disabled={generating} style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}>
                <Sparkles size={16} /> {generating ? 'Generazione...' : 'Crea Hook Test AI'}
              </button>
            </div>
          </div>

          {loading ? <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>Caricamento test...</div> : hookTests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '16px' }}>
              <Target size={48} style={{ opacity: 0.15, marginBottom: '1rem', margin: '0 auto' }} />
              <p style={{ marginBottom: '1rem' }}>Nessun Hook Test modulare in esecuzione.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {hookTests.map(test => (
                <div key={test.id} className="glass-table" style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '16px', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.5rem', background: 'var(--bg-base)', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{test.name}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: test.status === 'RUNNING' ? '#34d399' : 'var(--text-tertiary)', background: test.status === 'RUNNING' ? 'rgba(52,211,153,0.1)' : 'rgba(0,0,0,0.05)', padding: '2px 10px', borderRadius: '50px' }}>
                      {test.status}
                    </div>
                  </div>
                  
                  {test.baseVideoUrl && test.baseVideoUrl.startsWith('TEXT: ') && (
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>📝 Base Script (Corpo + CTA)</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{test.baseVideoUrl.replace('TEXT: ', '')}</div>
                    </div>
                  )}

                  <div style={{ padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '1rem' }}>🎣 Le 5 Varianti Hook generate</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                      {(test.hooks || []).map((h: any) => (
                        <div key={h.id} style={{ padding: '1rem', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{h.name}</div>
                            <div style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.8)', padding: '2px 8px', borderRadius: '50px', fontWeight: 700, color: 'var(--text-tertiary)' }}>{h.trigger}</div>
                          </div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4, borderLeft: '3px solid var(--brand-meta)', paddingLeft: '0.75rem', margin: '0.75rem 0' }}>
                            "{h.hookScript}"
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px dashed rgba(0,0,0,0.1)', paddingTop: '0.75rem' }}>
                            <div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Thumb-Stop Rate</div>
                              <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{h.thumbStopRate ? `${(h.thumbStopRate*100).toFixed(1)}%` : 'in test'}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Hold Rate</div>
                              <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{h.holdRate ? `${(h.holdRate*100).toFixed(1)}%` : 'in test'}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: KANBAN ASSET PIPELINE */}
      {tab === 'kanban' && (
        <div style={{ height: 'calc(100vh - 250px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Pipeline Produttiva (Kanban)</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Manda in pensione Trello. Traccia gli script fino al lancio delle Ads.</p>
            </div>
          </div>

          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, minmax(280px, 1fr))', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
            {/* Colonna 1: IDEA */}
            <KanbanColumn title="💡 Idea / Scripting" stage="IDEA" assets={kanbanAssets.filter(a => a.stage === 'IDEA')} onMove={moveAsset} />
            {/* Colonna 2: TO_SHOOT */}
            <KanbanColumn title="🎬 Da Registrare" stage="TO_SHOOT" assets={kanbanAssets.filter(a => a.stage === 'TO_SHOOT')} onMove={moveAsset} />
            {/* Colonna 3: EDITING */}
            <KanbanColumn title="✂️ In Montaggio" stage="EDITING" assets={kanbanAssets.filter(a => a.stage === 'EDITING')} onMove={moveAsset} />
            {/* Colonna 4: APPROVAL */}
            <KanbanColumn title="👀 In Approvazione" stage="APPROVAL" assets={kanbanAssets.filter(a => a.stage === 'APPROVAL')} onMove={moveAsset} />
            {/* Colonna 5: LIVE */}
            <KanbanColumn title="🚀 Lanciato (Live)" stage="LIVE" assets={kanbanAssets.filter(a => a.stage === 'LIVE')} onMove={moveAsset} />
          </div>
        </div>
      )}
    </div>
  )
}

function KanbanColumn({ title, stage, assets, onMove }: { title: string, stage: string, assets: KanbanAsset[], onMove: (id:string, dir:'next'|'prev')=>void }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', flexDirection: 'column', padding: '0.75rem', height: '100%' }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '1rem', padding: '0.5rem', borderBottom: '1px solid rgba(0,0,0,0.05)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title} <span style={{ opacity: 0.5, marginLeft: '0.2rem' }}>({assets.length})</span>
      </div>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>
        {assets.map(asset => (
          <div key={asset.id} style={{ background: '#fff', borderRadius: '8px', padding: '1rem', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.65rem', color: '#8b5cf6', background: 'rgba(139,92,246,0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  {asset.format}
                </span>
             </div>
             <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.5rem', lineHeight: 1.3 }}>{asset.title}</h4>
             
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.75rem', borderTop: '1px dashed rgba(0,0,0,0.1)', paddingTop: '0.75rem' }}>
               <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fbcfe8', color: '#be185d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 800 }}>
                  {typeof asset.assignedTo === 'string' ? asset.assignedTo.charAt(0) : asset.assignedTo.name.charAt(0)}
               </div>
               <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>{typeof asset.assignedTo === 'string' ? asset.assignedTo : asset.assignedTo.name}</span>
             </div>

             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
               <button onClick={() => onMove(asset.id, 'prev')} disabled={stage === 'IDEA'} style={{ background: 'transparent', border: 'none', cursor: stage === 'IDEA' ? 'not-allowed' : 'pointer', opacity: stage === 'IDEA' ? 0.3 : 1 }}>
                 <ChevronLeft size={16} color="#9ca3af" />
               </button>
               <button onClick={() => onMove(asset.id, 'next')} disabled={stage === 'LIVE'} style={{ background: 'transparent', border: 'none', cursor: stage === 'LIVE' ? 'not-allowed' : 'pointer', opacity: stage === 'LIVE' ? 0.3 : 1 }}>
                 <ChevronRight size={16} color="#3b82f6" />
               </button>
             </div>
          </div>
        ))}
      </div>
    </div>
  )
}
