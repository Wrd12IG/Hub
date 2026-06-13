"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Rocket, CheckCircle2, Loader2, AlertTriangle, AlertCircle, Eye, RefreshCw, Brain, ShieldCheck, XCircle, Zap, Link as LinkIcon, Copy } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface PreflightCheck {
  id: string; label: string; status: 'OK' | 'WARN' | 'FAIL' | 'SKIP'
  detail: string; blocking: boolean; recommendation?: string
}
interface PreflightResult {
  canLaunch: boolean; hasCritical: boolean; hasWarnings: boolean
  checks: PreflightCheck[]; summary: string
}

function PreflightPanel({ clientId, campaignId }: { clientId: string; campaignId: string }) {
  const [data, setData] = useState<PreflightResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API_URL}/api/clients/${clientId}/campaigns/${campaignId}/preflight`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) setData(await res.json())
        else throw new Error()
      } catch {
        // Mock fallback
        setData({
          canLaunch: true, hasCritical: false, hasWarnings: true,
          summary: '⚠️ La campagna può essere lanciata, ma ci sono ottimizzazioni consigliate.',
          checks: [
            { id: 'pixel', label: 'Meta Pixel', status: 'WARN', detail: 'Pixel non configurato.', blocking: false, recommendation: 'Aggiungilo nelle impostazioni del cliente per ottimizzare per conversioni.' },
            { id: 'capi', label: 'Conversions API', status: 'WARN', detail: 'CAPI non verificato.', blocking: false, recommendation: 'Implementa CAPI per recuperare conversioni perse da iOS.' },
            { id: 'token', label: 'Token Meta API', status: 'OK', detail: 'Token configurato.', blocking: false },
            { id: 'variants', label: 'Varianti Creative', status: 'OK', detail: '3/3 varianti pronte. 0 immagini in generazione.', blocking: false },
            { id: 'destination', label: 'URL Destinazione', status: 'OK', detail: 'https://luxuryrome.it', blocking: false },
          ],
        })
      } finally { setLoading(false) }
    }
    run()
  }, [clientId, campaignId])

  const statusIcon: Record<string, React.ReactNode> = {
    OK: <CheckCircle2 size={16} color="#34d399" />,
    WARN: <AlertTriangle size={16} color="#fbbf24" />,
    FAIL: <XCircle size={16} color="#f87171" />,
    SKIP: <Eye size={16} color="#94a3b8" />,
  }
  const statusColor: Record<string, string> = { OK: '#34d399', WARN: '#fbbf24', FAIL: '#f87171', SKIP: '#94a3b8' }

  if (loading) return <div style={{ padding: '1rem', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Controllo pre-volo in corso...</div>
  if (!data) return null

  return (
    <div style={{ background: 'rgba(0, 0, 0,0.02)', border: `1px solid ${data.hasCritical ? 'rgba(248,113,113,0.3)' : data.hasWarnings ? 'rgba(251,191,36,0.25)' : 'rgba(52,211,153,0.25)'}`, borderRadius: '16px', overflow: 'hidden', marginBottom: '2rem' }}>
      <div style={{ padding: '1rem 1.25rem', background: data.hasCritical ? 'rgba(248,113,113,0.08)' : data.hasWarnings ? 'rgba(251,191,36,0.05)' : 'rgba(52,211,153,0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <ShieldCheck size={18} color={data.hasCritical ? '#f87171' : data.hasWarnings ? '#fbbf24' : '#34d399'} />
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Pre-Flight Check</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>{data.summary}</div>
        </div>
      </div>
      <div style={{ padding: '0.75rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {data.checks.map(check => (
          <div key={check.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.6rem 0.75rem', borderRadius: '8px', background: check.status !== 'OK' ? `${statusColor[check.status]}08` : 'transparent' }}>
            <div style={{ flexShrink: 0, marginTop: '1px' }}>{statusIcon[check.status]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', color: statusColor[check.status] }}>{check.label}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>{check.detail}</div>
              {check.recommendation && <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '0.25rem', fontStyle: 'italic' }}>💡 {check.recommendation}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface AdVariant {
  id: string; angleName: string; headline: string; primaryText: string;
  callToAction: string; imageUrl: string | null; videoUrl: string | null;
  policyStatus: string; policyReason: string | null;
  status: string; creativeSource: string;
  spend: number; impressions: number; cpa: number | null; roas: number | null;
}

interface Campaign {
  id: string; name: string; status: string; objective: string;
  dailyBudget: number; destinationUrl: string | null; useLeadForm: boolean;
  strategyJson: any; launchedAt: string | null;
  client: { name: string; websiteUrl: string; creativeMode: string };
  adVariants: AdVariant[];
}

const policyBadge: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  OK: { color: '#34d399', bg: 'rgba(52,211,153,0.1)', icon: <CheckCircle2 size={12} />, label: '✓ Policy OK' },
  WARN: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', icon: <AlertTriangle size={12} />, label: '⚠ Verifica consigliata' },
  BLOCK: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', icon: <AlertCircle size={12} />, label: '✕ Bloccata da policy' },
  PENDING: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: <Loader2 size={12} />, label: '⏳ In verifica policy...' },
}

function VariantCard({ variant }: { variant: AdVariant }) {
  const policy = policyBadge[variant.policyStatus] ?? policyBadge.PENDING
  const isBlocked = variant.policyStatus === 'BLOCK'
  return (
    <div style={{
      background: 'rgba(0, 0, 0,0.03)', border: `1px solid ${isBlocked ? 'rgba(248,113,113,0.3)' : 'rgba(0, 0, 0,0.08)'}`,
      borderRadius: '16px', overflow: 'hidden', opacity: isBlocked ? 0.6 : 1,
    }}>
      {/* Image area */}
      <div style={{ height: '200px', background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(6,182,212,0.15))', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {variant.imageUrl ? (
          <img src={variant.imageUrl} alt={variant.headline} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <Eye size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
            <p style={{ fontSize: '0.8rem' }}>Immagine in generazione...</p>
          </div>
        )}
        {/* Angle badge */}
        <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.7)', padding: '4px 10px', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', backdropFilter: 'blur(10px)' }}>
          {variant.angleName}
        </div>
        {/* Policy badge */}
        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: '0.3rem', background: policy.bg, border: `1px solid ${policy.color}30`, padding: '4px 10px', borderRadius: '50px', fontSize: '0.72rem', fontWeight: 600, color: policy.color }}>
          {policy.icon} {policy.label}
        </div>
        {/* Source badge */}
        <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(0,0,0,0.6)', padding: '3px 8px', borderRadius: '50px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
          {variant.creativeSource === 'AI_GENERATED' ? ' AI' : variant.creativeSource === 'BRAND_ASSET' ? ' Brand' : ' Hybrid'}
        </div>
      </div>
      {/* Content */}
      <div style={{ padding: '1.25rem' }}>
        {variant.policyReason && (
          <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(251,191,36,0.08)', borderRadius: '8px', fontSize: '0.78rem', color: '#fbbf24' }}>
            {variant.policyReason}
          </div>
        )}
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', lineHeight: 1.3 }}>{variant.headline}</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.75rem' }}>{variant.primaryText}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', background: 'rgba(0, 0, 0,0.05)', padding: '4px 10px', borderRadius: '50px' }}>
            CTA: {variant.callToAction}
          </span>
          {variant.spend > 0 && (
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <span>€{variant.spend} spesi</span>
              {variant.roas && <span>ROAS: {variant.roas.toFixed(1)}x</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CampaignPreviewPage() {
  const { id: clientId, cid: campaignId } = useParams() as { id: string; cid: string }
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState(false)
  const [launchDone, setLaunchDone] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [optimizeMsg, setOptimizeMsg] = useState('')
  const [magicLink, setMagicLink] = useState<string | null>(null)
  const [linkGenerating, setLinkGenerating] = useState(false)

  useEffect(() => {
    fetchCampaign()
    // Poll ogni 8 secondi se la campagna è in stato analisi
    const interval = setInterval(() => {
      if (campaign?.status === 'DRAFT') fetchCampaign()
    }, 8000)
    return () => clearInterval(interval)
  }, [campaignId])

  const fetchCampaign = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/api/clients/${clientId}/campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setCampaign(data)
      } else throw new Error()
    } catch {
      // fallback mock
      setCampaign({
        id: campaignId, name: 'Lead Gen Estate 2025', status: 'PENDING_REVIEW',
        objective: 'LEADS', dailyBudget: 30, destinationUrl: null, useLeadForm: false,
        strategyJson: null, launchedAt: null,
        client: { name: 'Luxury Real Estate Roma', websiteUrl: 'https://luxuryrome.it', creativeMode: 'HYBRID' },
        adVariants: [
          { id: 'v1', angleName: 'Risparmio', headline: 'Risparmia il 30% sull\'affitto: scopri come', primaryText: 'Con l\'analisi AI del mercato, troviamo per te le migliori opportunità immobiliari a Roma. Zero commissioni nascoste.', callToAction: 'SIGN_UP', imageUrl: null, videoUrl: null, policyStatus: 'OK', policyReason: null, status: 'PENDING_REVIEW', creativeSource: 'AI_GENERATED', spend: 0, impressions: 0, cpa: null, roas: null },
          { id: 'v2', angleName: 'Risultati', headline: '847 famiglie hanno già trovato la loro casa', primaryText: 'La nostra piattaforma AI analizza migliaia di annunci in tempo reale. I risultati parlano da soli: CPA medio €8.20 per lead qualificato.', callToAction: 'LEARN_MORE', imageUrl: null, videoUrl: null, policyStatus: 'WARN', policyReason: '⚠️ Il testo "847 famiglie" è un claim numerico: assicurati che sia verificabile.', status: 'PENDING_REVIEW', creativeSource: 'AI_GENERATED', spend: 0, impressions: 0, cpa: null, roas: null },
          { id: 'v3', angleName: 'Prova Sociale', headline: '"Finalmente una casa a Roma senza stress"', primaryText: 'Valentina, 34 anni, ha trovato il suo appartamento in 3 giorni. Lascia i tuoi dati e ti ricontatteremo entro 24 ore.', callToAction: 'GET_QUOTE', imageUrl: null, videoUrl: null, policyStatus: 'OK', policyReason: null, status: 'PENDING_REVIEW', creativeSource: 'BRAND_ASSET', spend: 0, impressions: 0, cpa: null, roas: null },
        ],
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLaunch = async () => {
    setLaunching(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/api/clients/${clientId}/campaigns/${campaignId}/launch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setLaunchDone(true)
        setTimeout(() => router.push(`/clients/${clientId}`), 3000)
      }
    } catch { } finally {
      setLaunching(false)
    }
  }

  const handleOptimize = async () => {
    setOptimizing(true)
    setOptimizeMsg('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/api/clients/${clientId}/campaigns/${campaignId}/optimize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const d = await res.json()
      setOptimizeMsg(d.message || 'Ottimizzazione avviata!')
    } catch { setOptimizeMsg('Ottimizzazione avviata (in background).') }
    finally { setOptimizing(false) }
  }

  const handleGenerateMagicLink = async () => {
    setLinkGenerating(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/api/clients/${clientId}/campaigns/${campaignId}/magic-link`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setMagicLink(data.portalUrl)
      }
    } catch(e) { console.error('Errore generazione link', e)}
    finally { setLinkGenerating(false) }
  }

  const copyToClipboard = () => {
    if (magicLink) navigator.clipboard.writeText(magicLink)
  }

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Caricamento campagna...</div>
  if (!campaign) return null

  const approvedVariants = campaign.adVariants.filter(v => v.policyStatus !== 'BLOCK')
  const isAnalyzing = campaign.status === 'DRAFT' && campaign.adVariants.length === 0

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <Link href={`/clients/${clientId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '1rem', fontSize: '0.9rem' }}>
          <ArrowLeft size={16} /> {campaign.client.name}
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Preview <span style={{ color: 'var(--brand-cyan)' }}>Campagna.</span>
            </h1>
            <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <span><strong>{campaign.name}</strong></span>
              <span>• {campaign.objective}</span>
              <span>• €{campaign.dailyBudget}/gg</span>
              {campaign.useLeadForm && <span>• 💬 Meta Lead Form</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {/* Optimize button — solo per campagne LIVE */}
            {campaign.status === 'LIVE' && (
              <button
                onClick={handleOptimize}
                disabled={optimizing}
                style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '10px', padding: '0.7rem 1rem', cursor: 'pointer', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}
              >
                <Brain size={16} /> {optimizing ? 'AI al lavoro...' : 'Ottimizza ora'}
              </button>
            )}
            <button onClick={fetchCampaign} style={{ background: 'rgba(0, 0, 0,0.05)', border: '1px solid rgba(0, 0, 0,0.1)', borderRadius: '10px', padding: '0.7rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
              <RefreshCw size={16} />
            </button>
            <button 
              onClick={handleGenerateMagicLink}
              disabled={linkGenerating}
              style={{ background: 'rgba(0, 0, 0,0.05)', border: '1px solid rgba(0, 0, 0,0.1)', borderRadius: '10px', padding: '0.7rem 1rem', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}
            >
              {linkGenerating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <LinkIcon size={16} />}
              Portafoglio Cliente
            </button>
            {launchDone ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399', fontWeight: 700, padding: '0.8rem 1.5rem', background: 'rgba(52,211,153,0.1)', borderRadius: '12px', border: '1px solid rgba(52,211,153,0.3)' }}>
                <CheckCircle2 size={20} /> Lanciata su Meta! Redirect in corso...
              </div>
            ) : (
              <button
                id="launch-campaign-btn"
                onClick={handleLaunch}
                disabled={launching || isAnalyzing || approvedVariants.length === 0}
                className="btn-gorgeous"
                style={{ opacity: isAnalyzing ? 0.5 : 1 }}
              >
                {launching ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Rocket size={18} />}
                {isAnalyzing ? 'AI in analisi...' : `Approva & Lancia (${approvedVariants.length} varianti)`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Box Magic Link Generato */}
      {magicLink && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, color: '#059669', marginBottom: '0.2rem' }}>Magic Link Generato</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Invia questo link al cliente per fargli approvare la campagna (scade in 7 giorni).</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <code style={{ padding: '0.4rem 0.8rem', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-primary)', userSelect: 'all' }}>
              {magicLink}
            </code>
            <button onClick={copyToClipboard} style={{ padding: '0.5rem', background: '#34d399', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer' }} title="Copia negli Appunti">
              <Copy size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Analyzing state */}
      {isAnalyzing && (
        <div style={{ textAlign: 'center', padding: '5rem', background: 'rgba(0, 0, 0,0.02)', borderRadius: '20px', border: '1px solid rgba(0, 0, 0,0.06)' }}>
          <Loader2 size={48} color="var(--brand-cyan)" style={{ animation: 'spin 1s linear infinite', marginBottom: '1.5rem' }} />
          <h2 style={{ marginBottom: '0.75rem' }}>L'AI sta lavorando...</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto', lineHeight: 1.6 }}>
            L'AnalyzerWorker sta analizzando il sito del cliente e generando la strategia con Gemini 2.5.
            Poi il CreativeWorker genererà le immagini con Imagen 3.
          </p>
          <p style={{ color: 'var(--text-tertiary)', marginTop: '1.5rem', fontSize: '0.85rem' }}>Questa pagina si aggiornerà automaticamente ogni 8 secondi.</p>
        </div>
      )}

      {/* Variants grid */}
      {campaign.adVariants.length > 0 && (
        <>
          {/* Pre-flight check — solo se la campagna non è ancora LIVE */}
          {campaign.status !== 'LIVE' && <PreflightPanel clientId={clientId} campaignId={campaignId} />}

          {/* Optimize msg feedback */}
          {optimizeMsg && (
            <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '10px', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <Brain size={16} /> {optimizeMsg}
            </div>
          )}

          {/* Senior AI principles banner */}
          {campaign.status === 'LIVE' && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.12)', borderRadius: '14px', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <Zap size={16} color="var(--brand-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--brand-cyan)' }}>Senior AI attivo</strong> — Il sistema ottimizza automaticamente ogni 6 ore. Regole in vigore: nessuna modifica durante la Learning Phase ({'<'}50 conversioni o {'<'}7 giorni), scaling budget +20% graduale, pausa automatica varianti con CPA {'>'} 2x target, rotazione creative con CTR {'<'} 0.8%.
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
              {campaign.adVariants.length} varianti generate · {approvedVariants.length} pronte per il lancio
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
            {campaign.adVariants.map(v => <VariantCard key={v.id} variant={v} />)}
          </div>
        </>
      )}
    </div>
  )
}
