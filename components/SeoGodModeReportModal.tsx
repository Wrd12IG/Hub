"use client"

import { useState, useEffect } from 'react'
import {
  Brain, AlertTriangle, Zap, Terminal, X, FileSearch, TrendingUp,
  Globe, Link2, MapPin, Map, ChevronDown, ChevronUp, CheckCircle2,
  BarChart2, Search, FileText, Bot, Award, Clock
} from 'lucide-react'

interface SeoGodModeReportModalProps {
  isOpen: boolean
  onClose: () => void
  clientId: string
  clientName: string
  websiteUrl: string
}

const SCAN_STEPS = [
  { icon: Terminal,   label: 'Crawling DOM & JS assets...' },
  { icon: BarChart2,  label: 'Analisi Core Web Vitals (LCP, INP, CLS, TTFB)...' },
  { icon: Search,     label: 'Mappatura keyword & intent SERP...' },
  { icon: FileText,   label: 'E-E-A-T content audit & freshness...' },
  { icon: Bot,        label: 'GEO — Citation tracking su ChatGPT, Gemini, Perplexity...' },
  { icon: Link2,      label: 'Link profile & toxic backlink scan...' },
  { icon: Globe,      label: 'Analisi competitiva Google vs AI citation...' },
  { icon: MapPin,     label: 'Local SEO & GMB audit...' },
  { icon: CheckCircle2, label: 'Costruzione roadmap con effort/impact...' },
]

const SECTIONS = [
  {
    id: '00',
    icon: Award,
    color: '#10b981',
    title: 'Executive Summary',
    subtitle: 'Punteggi aggregati, delta e 3 quick win urgenti',
    content: [
      { label: 'Health Score', value: '74/100', highlight: '#f59e0b' },
      { label: 'Performance Delta', value: '+12% vs 30gg', highlight: '#10b981' },
      { label: 'Visibilità GEO (AI)', value: 'Bassa', highlight: '#ef4444' },
    ],
    quickWins: [
      'Risolvere JS Render Blocking nella <head> (LCP da 3.2s → <1.5s)',
      'Richiedere backlink ai 3 clienti chiave → +Authority immediata',
      'Aggiungere schema FAQPage su ogni landing → Trigger GEO citation',
    ],
  },
  {
    id: '01',
    icon: Terminal,
    color: '#3b82f6',
    title: 'Audit Tecnico SEO',
    subtitle: 'Core Web Vitals, crawlability, schema markup, JS SEO',
    vitals: [
      { name: 'LCP', value: '3.2s', status: 'bad' },
      { name: 'INP', value: '450ms', status: 'warn' },
      { name: 'CLS', value: '0.12', status: 'warn' },
      { name: 'TTFB', value: '850ms', status: 'bad' },
    ],
    issues: [
      { severity: 'CRITICO', text: 'JS Render Blocking: GTM sincrono in <head> causa +3.2s LCP' },
      { severity: 'ALTO', text: 'Orphan Pages: 12 landing con alto CVR a >3 click dalla root' },
      { severity: 'MEDIO', text: 'Schema markup mancante su pagine prodotto e FAQ' },
    ],
  },
  {
    id: '02',
    icon: Search,
    color: '#8b5cf6',
    title: 'Keyword Research & Posizionamento',
    subtitle: 'Intent mapping, SERP features, gap vs competitor, cannibalizzazione',
    items: [
      { label: 'Intent dominante', value: 'Transazionale B2B — mancano TOFU informativi' },
      { label: 'SERP Features', value: 'Featured Snippet 0 · People Also Ask 3 · Local Pack 1' },
      { label: 'Cannibalizzazione', value: '/servizi vs /chi-siamo competono per "agenzia [città]"' },
      { label: 'Keyword Gap', value: '"Marketing Automation", "ROI tracker", "Analytics avanzato"' },
    ],
  },
  {
    id: '03',
    icon: FileText,
    color: '#f59e0b',
    title: 'Content Audit (E-E-A-T)',
    subtitle: 'Copertura topica, freshness e struttura per AI retrieval',
    metrics: [
      { name: 'E-E-A-T Score', value: '6.5/10', color: '#f59e0b' },
      { name: 'Freshness', value: '>6 mesi fa', color: '#ef4444' },
      { name: 'Topical Coverage', value: '42%', color: '#f59e0b' },
      { name: 'Struttura Answer-first', value: 'Assente', color: '#ef4444' },
    ],
  },
  {
    id: '04',
    icon: Bot,
    color: '#6366f1',
    title: 'GEO — Generative Engine Optimization',
    subtitle: 'Citation tracking, entity & knowledge graph, content signals per AI',
    isGeo: true,
    citations: [
      { engine: 'ChatGPT', status: 'Non citato', color: '#ef4444' },
      { engine: 'Gemini', status: 'Citato raramente', color: '#f59e0b' },
      { engine: 'Perplexity', status: 'Non citato', color: '#ef4444' },
      { engine: 'Claude', status: 'Non citato', color: '#ef4444' },
    ],
    entities: [
      { label: 'Google Knowledge Panel', value: 'Assente' },
      { label: 'Wikidata Entity', value: 'Non presente' },
      { label: 'Structured Data (JSON-LD)', value: 'Parziale' },
    ],
    signals: [
      'Struttura answer-first mancante nelle pagine chiave',
      'Nessun dato proprietario originale pubblicato (ricerche, statistiche)',
      'FAQ non marcate con schema → nessun trigger di citation AI',
      'Autorevolezza percepita dagli LLM: BASSA',
    ],
  },
  {
    id: '05',
    icon: Link2,
    color: '#ec4899',
    title: 'Link Profile',
    subtitle: 'Backlink tradizionali e menzioni autorevoli per LLM trust',
    stats: [
      { label: 'Backlink totali', value: '124' },
      { label: 'Domini referral', value: '38' },
      { label: 'Toxic links', value: '8', color: '#ef4444' },
      { label: 'Trust mentions media', value: '0', color: '#ef4444' },
    ],
  },
  {
    id: '06',
    icon: TrendingUp,
    color: '#14b8a6',
    title: 'Analisi Competitiva',
    subtitle: 'Chi ti batte su Google vs chi viene citato dagli AI al posto tuo',
    competitors: [
      { name: 'Competitor A', google: '#1', ai: 'Citato spesso' },
      { name: 'Competitor B', google: '#3', ai: 'Citato' },
      { name: 'Il tuo sito', google: '#8', ai: 'Non citato' },
    ],
  },
  {
    id: '07',
    icon: MapPin,
    color: '#f97316',
    title: 'Local SEO',
    subtitle: 'GMB, NAP consistency, local pack e segnali geo-rilevanti',
    issues: [
      { severity: 'ALTO', text: 'Profilo GMB non aggiornato — nessun post nelle ultime 8 settimane' },
      { severity: 'MEDIO', text: 'NAP inconsistency rilevata su 3 directory di settore' },
      { severity: 'BASSO', text: 'Mancano foto profilo aggiornate e video brevi nel GMB' },
    ],
  },
  {
    id: '08',
    icon: Map,
    color: '#a78bfa',
    title: 'Roadmap Operativa',
    subtitle: 'Ogni azione con effort, impact e owner — senza questa sezione il report è accademico',
    roadmap: [
      { action: 'Sblocco risorse critiche JS (defer GTM)', effort: 'M', impact: 'A', owner: 'Dev', week: 'Settimana 1' },
      { action: 'Fix schema FAQPage su tutte le landing', effort: 'B', impact: 'A', owner: 'SEO', week: 'Settimana 1' },
      { action: 'Creazione entity Wikidata aziendale', effort: 'B', impact: 'M', owner: 'SEO', week: 'Settimana 2' },
      { action: 'Richiesta link a 3 clienti strategici', effort: 'B', impact: 'A', owner: 'BizDev', week: 'Settimana 2' },
      { action: 'Redazione 3 pillar article TOFU (1500w+)', effort: 'A', impact: 'A', owner: 'Content', week: 'Mese 1' },
      { action: 'Struttura answer-first su tutte le pagine SEO', effort: 'M', impact: 'A', owner: 'Content', week: 'Mese 1' },
    ],
  },
]

export default function SeoGodModeReportModal({ isOpen, onClose, clientId, clientName, websiteUrl }: SeoGodModeReportModalProps) {
  const [scanStep, setScanStep] = useState(0)
  const [isScanning, setIsScanning] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>('00')

  useEffect(() => {
    if (!isOpen) return
    setIsScanning(true)
    setScanStep(0)
    setExpandedSection('00')

    const timers = SCAN_STEPS.map((_, i) =>
      setTimeout(() => {
        setScanStep(i + 1)
        if (i === SCAN_STEPS.length - 1) setIsScanning(false)
      }, 600 + i * 500)
    )
    return () => timers.forEach(clearTimeout)
  }, [isOpen])

  if (!isOpen) return null

  const handleGenerate = async () => {
    setIsSaving(true)
    try {
      const token = localStorage.getItem('token')
      const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

      const res = await fetch(`${API_URL}/api/clients/${clientId}/seo-reports/generate-document`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Errore nella generazione del report')
      }

      const data = await res.json()
      if (data.fileUrl) {
        window.open(`${API_URL}${data.fileUrl}`, '_blank')
      }
    } catch (err: any) {
      console.error(err)
      alert(`API Error: ${err.message || 'Errore durante la generazione'}`)
    } finally {
      setIsSaving(false)
      onClose()
    }
  }

  const badgeColor = (level: string) =>
    level === 'CRITICO' || level === 'A' ? '#ef4444' :
    level === 'ALTO'    || level === 'M' ? '#f59e0b' : '#10b981'

  const vitalColor = (s: string) => s === 'bad' ? '#ef4444' : s === 'warn' ? '#f59e0b' : '#10b981'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        background: '#09090b', borderRadius: '24px',
        width: '100%', maxWidth: '960px', maxHeight: '92vh',
        overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)',
        color: '#fff', position: 'relative',
        boxShadow: '0 0 60px rgba(139,92,246,0.25), 0 0 120px rgba(99,102,241,0.1)'
      }}>

        {/* ── HEADER ── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'rgba(9,9,11,0.95)', backdropFilter: 'blur(16px)',
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              width: 44, height: 44, borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 24px rgba(99,102,241,0.5)'
            }}>
              <Brain size={22} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', background: 'linear-gradient(90deg,#fff,#a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                GODMODE SEO & GEO Audit
              </div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                {clientName} · {websiteUrl}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', lineHeight: 0 }}>
            <X size={22} />
          </button>
        </div>

        <div style={{ padding: '1.5rem 1.75rem' }}>

          {/* ── SCANNING ── */}
          {isScanning && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', gap: '2rem' }}>
              <div style={{ position: 'relative', width: 72, height: 72 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  border: '3px solid rgba(99,102,241,0.15)',
                  borderTopColor: '#6366f1',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <Brain size={28} color="#6366f1" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
              </div>

              <div style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {SCAN_STEPS.map((step, i) => {
                  const Icon = step.icon
                  const done = scanStep > i
                  const active = scanStep === i
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      color: done ? '#10b981' : active ? '#a5b4fc' : 'rgba(255,255,255,0.2)',
                      fontSize: '0.85rem', transition: 'color 0.3s'
                    }}>
                      <Icon size={15} />
                      <span>{step.label}</span>
                      {done && <CheckCircle2 size={14} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── REPORT CONTENT ── */}
          {!isScanning && (
            <div style={{ animation: 'fadeUp 0.5s ease-out both' }}>
              <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>

              {/* Quick stats bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {[
                  { l: 'Health Score',       v: '74/100',    c: '#f59e0b' },
                  { l: 'GEO Visibility',      v: '12%',       c: '#ef4444' },
                  { l: 'Sezioni Analizzate',  v: '9',         c: '#6366f1' },
                  { l: 'Azioni in Roadmap',   v: '6',         c: '#10b981' },
                ].map((s, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '0.9rem 1rem' }}>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.l}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>

              {/* Accordion sections */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {SECTIONS.map((sec) => {
                  const Icon = sec.icon
                  const open = expandedSection === sec.id
                  return (
                    <div key={sec.id} style={{
                      background: open ? 'rgba(255,255,255,0.03)' : 'transparent',
                      border: `1px solid ${open ? `${sec.color}40` : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: 14,
                      overflow: 'hidden',
                      transition: 'all 0.2s'
                    }}>
                      {/* Section header (clickable) */}
                      <button
                        onClick={() => setExpandedSection(open ? null : sec.id)}
                        style={{
                          width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
                          padding: '0.9rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                          color: '#fff', textAlign: 'left'
                        }}
                      >
                        <div style={{
                          width: 34, height: 34, borderRadius: '9px', flexShrink: 0,
                          background: `${sec.color}22`, border: `1px solid ${sec.color}44`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <Icon size={16} color={sec.color} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                            <span style={{ color: `${sec.color}99`, fontSize: '0.72rem', marginRight: 6 }}>{sec.id}</span>
                            {sec.title}
                          </div>
                          <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{sec.subtitle}</div>
                        </div>
                        {open ? <ChevronUp size={16} color="rgba(255,255,255,0.3)" /> : <ChevronDown size={16} color="rgba(255,255,255,0.3)" />}
                      </button>

                      {/* Section body */}
                      {open && (
                        <div style={{ padding: '0 1.1rem 1.1rem' }}>

                          {/* 00 Executive */}
                          {'quickWins' in sec && (
                            <>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.6rem', marginBottom: '1rem' }}>
                                {sec.content!.map((c, i) => (
                                  <div key={i} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 9, padding: '0.7rem 0.9rem' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>{c.label}</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: c.highlight }}>{c.value}</div>
                                  </div>
                                ))}
                              </div>
                              <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '0.9rem 1rem' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fca5a5', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔥 3 Quick Win Urgenti</div>
                                {sec.quickWins!.map((w, i) => (
                                  <div key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', marginBottom: i < sec.quickWins!.length - 1 ? '0.5rem' : 0 }}>
                                    <span style={{ color: '#ef4444', fontWeight: 700 }}>{i + 1}.</span> {w}
                                  </div>
                                ))}
                              </div>
                            </>
                          )}

                          {/* 01 Technical */}
                          {'vitals' in sec && (
                            <>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem', marginBottom: '0.8rem' }}>
                                {sec.vitals!.map((v, i) => (
                                  <div key={i} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 9, padding: '0.6rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>{v.name}</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: vitalColor(v.status) }}>{v.value}</div>
                                  </div>
                                ))}
                              </div>
                              {sec.issues!.map((iss, i) => (
                                <div key={i} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '0.5rem', fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)' }}>
                                  <span style={{ background: `${badgeColor(iss.severity)}22`, color: badgeColor(iss.severity), fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 50, flexShrink: 0, marginTop: 1 }}>{iss.severity}</span>
                                  {iss.text}
                                </div>
                              ))}
                            </>
                          )}

                          {/* 02 Keywords */}
                          {'items' in sec && sec.id === '02' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                              {sec.items!.map((it, i) => (
                                <div key={i} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 9, padding: '0.65rem 0.9rem', fontSize: '0.83rem' }}>
                                  <span style={{ color: '#a5b4fc', fontWeight: 600, marginRight: 8 }}>{it.label}:</span>
                                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>{it.value}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 03 Content */}
                          {'metrics' in sec && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.6rem' }}>
                              {sec.metrics!.map((m, i) => (
                                <div key={i} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 9, padding: '0.7rem 0.9rem' }}>
                                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>{m.name}</div>
                                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: m.color }}>{m.value}</div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 04 GEO */}
                          {'isGeo' in sec && (
                            <>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a5b4fc', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Citation Tracking</div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                                {sec.citations!.map((c, i) => (
                                  <div key={i} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 9, padding: '0.6rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>{c.engine}</div>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: c.color }}>{c.status}</div>
                                  </div>
                                ))}
                              </div>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a5b4fc', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entity & Knowledge Graph</div>
                              {sec.entities!.map((e, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                  <span style={{ color: 'rgba(255,255,255,0.55)' }}>{e.label}</span>
                                  <span style={{ color: '#ef4444', fontWeight: 600 }}>{e.value}</span>
                                </div>
                              ))}
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a5b4fc', margin: '0.8rem 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Content Signals per AI Retrieval</div>
                              {sec.signals!.map((s, i) => (
                                <div key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', marginBottom: '0.4rem' }}>
                                  <span style={{ color: '#6366f1' }}>→</span> {s}
                                </div>
                              ))}
                            </>
                          )}

                          {/* 05 Links */}
                          {'stats' in sec && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.6rem' }}>
                              {sec.stats!.map((s, i) => (
                                <div key={i} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 9, padding: '0.7rem 0.9rem' }}>
                                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>{s.label}</div>
                                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: s.color ?? '#fff' }}>{s.value}</div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 06 Competitive */}
                          {'competitors' in sec && (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                              <thead>
                                <tr>
                                  {['Dominio', 'Posizione Google', 'Citazioni AI'].map((h, i) => (
                                    <th key={i} style={{ textAlign: 'left', padding: '0.5rem 0.7rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sec.competitors!.map((c, i) => (
                                  <tr key={i}>
                                    <td style={{ padding: '0.55rem 0.7rem', fontWeight: 600, color: i === 2 ? '#6366f1' : '#fff' }}>{c.name}</td>
                                    <td style={{ padding: '0.55rem 0.7rem', color: i === 2 ? '#ef4444' : '#10b981' }}>{c.google}</td>
                                    <td style={{ padding: '0.55rem 0.7rem', color: c.ai.includes('Non') ? '#ef4444' : '#10b981' }}>{c.ai}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}

                          {/* 07 Local */}
                          {sec.id === '07' && 'issues' in sec && (
                            sec.issues!.map((iss, i) => (
                              <div key={i} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '0.5rem', fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)' }}>
                                <span style={{ background: `${badgeColor(iss.severity)}22`, color: badgeColor(iss.severity), fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 50, flexShrink: 0, marginTop: 1 }}>{iss.severity}</span>
                                {iss.text}
                              </div>
                            ))
                          )}

                          {/* 08 Roadmap */}
                          {'roadmap' in sec && (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                              <thead>
                                <tr>
                                  {['Azione', 'Settimana', 'Sforzo', 'Impatto', 'Owner'].map((h, i) => (
                                    <th key={i} style={{ textAlign: 'left', padding: '0.5rem 0.6rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sec.roadmap!.map((r, i) => (
                                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <td style={{ padding: '0.5rem 0.6rem', fontWeight: 500 }}>{r.action}</td>
                                    <td style={{ padding: '0.5rem 0.6rem', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{r.week}</td>
                                    <td style={{ padding: '0.5rem 0.6rem' }}>
                                      <span style={{ background: `${badgeColor(r.effort)}22`, color: badgeColor(r.effort), fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 50 }}>{r.effort === 'A' ? 'Alto' : r.effort === 'M' ? 'Medio' : 'Basso'}</span>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.6rem' }}>
                                      <span style={{ background: `${badgeColor(r.impact)}22`, color: badgeColor(r.impact), fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 50 }}>{r.impact === 'A' ? 'Alto' : r.impact === 'M' ? 'Medio' : 'Basso'}</span>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.6rem', color: '#a5b4fc', fontWeight: 600 }}>{r.owner}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}

                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* ── ACTIONS ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <button
                  onClick={onClose}
                  style={{
                    background: 'rgba(255,255,255,0.05)', color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '0.9rem', borderRadius: '12px', fontSize: '0.9rem',
                    fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Chiudi
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isSaving}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff', border: 'none',
                    padding: '0.9rem', borderRadius: '12px', fontSize: '0.9rem',
                    fontWeight: 700, cursor: isSaving ? 'not-allowed' : 'pointer',
                    opacity: isSaving ? 0.7 : 1,
                    boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                  }}
                >
                  {isSaving
                    ? <><Clock size={16} /> Generazione PDF in corso...</>
                    : <><FileSearch size={16} /> Genera PDF GODMODE Completo</>
                  }
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
