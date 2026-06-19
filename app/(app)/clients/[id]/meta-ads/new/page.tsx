"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, Trophy, Activity, TrendingUp, Presentation, Megaphone, ShoppingCart, Lightbulb, Video, Target, Wallet, Globe, Zap, Plus, Trash2, ClipboardList, ChevronDown, Layers, Calendar, Users, Clock, MapPin, CheckCircle2, Smartphone, Monitor, Facebook, Instagram, Radio, MessageCircle, Building, Briefcase, User, Mail, Edit2 , ArrowLeft , Sliders, Eye, Link as LinkIcon, Settings, AlertTriangle } from 'lucide-react'

// ============================================
// PLACEMENT CONFIG
// ============================================

interface PlacementConfig {
  mode: 'ADVANTAGE_PLUS' | 'MANUAL'
  device: 'ALL' | 'MOBILE' | 'DESKTOP'
  platforms: {
    facebook: boolean
    instagram: boolean
    audienceNetwork: boolean
    messenger: boolean
  }
  placements: {
    // Facebook
    facebook_feed: boolean
    facebook_marketplace: boolean
    facebook_video_feeds: boolean
    facebook_right_column: boolean
    facebook_stories: boolean
    facebook_reels: boolean
    // Instagram
    instagram_feed: boolean
    instagram_stories: boolean
    instagram_reels: boolean
    instagram_explore: boolean
    // Audience Network
    an_native: boolean
    an_banner: boolean
    an_interstitial: boolean
    // Messenger
    messenger_inbox: boolean
    messenger_stories: boolean
  }
}

const defaultPlacement: PlacementConfig = {
  mode: 'ADVANTAGE_PLUS',
  device: 'ALL',
  platforms: { facebook: true, instagram: true, audienceNetwork: false, messenger: false },
  placements: {
    facebook_feed: true, facebook_marketplace: true, facebook_video_feeds: true,
    facebook_right_column: false, facebook_stories: true, facebook_reels: true,
    instagram_feed: true, instagram_stories: true, instagram_reels: true, instagram_explore: true,
    an_native: false, an_banner: false, an_interstitial: false,
    messenger_inbox: false, messenger_stories: false,
  },
}

const PLACEMENT_MAP: Record<string, { platform: keyof PlacementConfig['platforms']; label: string; desc: string }> = {
  facebook_feed: { platform: 'facebook', label: 'Feed Facebook', desc: 'Sezione principale del newsfeed' },
  facebook_marketplace: { platform: 'facebook', label: 'Marketplace', desc: 'Schede prodotto del marketplace' },
  facebook_video_feeds: { platform: 'facebook', label: 'Video Feeds', desc: 'Feed video dedicato' },
  facebook_right_column: { platform: 'facebook', label: 'Colonna Destra', desc: 'Solo Desktop. Formato piccolo.' },
  facebook_stories: { platform: 'facebook', label: 'Storie Facebook', desc: 'Full-screen verticale 9:16' },
  facebook_reels: { platform: 'facebook', label: 'Reels Facebook', desc: 'Tra i video brevi' },
  instagram_feed: { platform: 'instagram', label: 'Feed Instagram', desc: 'Nella sezione notizie IG' },
  instagram_stories: { platform: 'instagram', label: 'Storie Instagram', desc: 'Full-screen verticale 9:16' },
  instagram_reels: { platform: 'instagram', label: 'Reels Instagram', desc: 'Tra i video brevi IG' },
  instagram_explore: { platform: 'instagram', label: 'Esplora Instagram', desc: 'Sezione Esplora IG' },
  an_native: { platform: 'audienceNetwork', label: 'AN Native', desc: 'App terze parti — formato nativo' },
  an_banner: { platform: 'audienceNetwork', label: 'AN Banner', desc: 'App terze parti — banner' },
  an_interstitial: { platform: 'audienceNetwork', label: 'AN Interstiziale', desc: 'App terze parti — full-screen' },
  messenger_inbox: { platform: 'messenger', label: 'Inbox Messenger', desc: 'Lista chat di Messenger' },
  messenger_stories: { platform: 'messenger', label: 'Storie Messenger', desc: 'Full-screen in Messenger' },
}

function PlacementSelector({ config, onChange }: { config: PlacementConfig; onChange: (c: PlacementConfig) => void }) {
  const setMode = (mode: PlacementConfig['mode']) => onChange({ ...config, mode })
  const setDevice = (device: PlacementConfig['device']) => onChange({ ...config, device })
  const togglePlatform = (p: keyof PlacementConfig['platforms']) => {
    const platforms = { ...config.platforms, [p]: !config.platforms[p] }
    // Disable placements for this platform
    const placements = { ...config.placements }
    Object.entries(PLACEMENT_MAP).forEach(([key, val]) => {
      if (val.platform === p && config.platforms[p]) placements[key as keyof PlacementConfig['placements']] = false
    })
    onChange({ ...config, platforms, placements })
  }
  const togglePlacement = (k: keyof PlacementConfig['placements']) =>
    onChange({ ...config, placements: { ...config.placements, [k]: !config.placements[k] } })

  const platformInfo: Record<keyof PlacementConfig['platforms'], { icon: React.ReactNode; label: string; color: string }> = {
    facebook: { icon: <Facebook size={18} />, label: 'Facebook', color: '#1877f2' },
    instagram: { icon: <Instagram size={18} />, label: 'Instagram', color: '#e1306c' },
    audienceNetwork: { icon: <Radio size={18} />, label: 'Audience Network', color: '#ff8c00' },
    messenger: { icon: <MessageCircle size={18} />, label: 'Messenger', color: '#0084ff' },
  }

  const deviceOptions = [
    { value: 'ALL', icon: <Monitor size={18} />, label: 'Tutti i dispositivi' },
    { value: 'MOBILE', icon: <Smartphone size={18} />, label: 'Solo Mobile' },
    { value: 'DESKTOP', icon: <Monitor size={18} />, label: 'Solo Desktop' },
  ]

  return (
    <div style={{ marginTop: '0' }}>
      {/* Mode toggle */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div onClick={() => setMode('ADVANTAGE_PLUS')} style={{
          padding: '1rem 1.25rem', borderRadius: '12px', cursor: 'pointer',
          border: `1px solid ${config.mode === 'ADVANTAGE_PLUS' ? 'var(--brand-fuchsia)' : 'rgba(0, 0, 0,0.08)'}`,
          background: config.mode === 'ADVANTAGE_PLUS' ? 'rgba(236,72,153,0.08)' : 'rgba(0, 0, 0,0.02)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: '0.3rem' }}><Sparkles size={16} /> Advantage+ Placement</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Meta ottimizza automaticamente i placement per ridurre il CPA. Consigliato.</div>
        </div>
        <div onClick={() => setMode('MANUAL')} style={{
          padding: '1rem 1.25rem', borderRadius: '12px', cursor: 'pointer',
          border: `1px solid ${config.mode === 'MANUAL' ? 'var(--brand-cyan)' : 'rgba(0, 0, 0,0.08)'}`,
          background: config.mode === 'MANUAL' ? 'rgba(6,182,212,0.06)' : 'rgba(0, 0, 0,0.02)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: '0.3rem' }}><Sliders size={16} /> Placement Manuale</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Scegli tu esattamente dove mostrare le inserzioni.</div>
        </div>
      </div>

      {config.mode === 'MANUAL' && (
        <>
          {/* Device */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>Dispositivi target</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {deviceOptions.map(opt => (
                <button key={opt.value} onClick={() => setDevice(opt.value as any)} style={{
                  flex: 1, padding: '0.6rem', borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
                  border: `1px solid ${config.device === opt.value ? 'var(--brand-cyan)' : 'rgba(0, 0, 0,0.08)'}`,
                  background: config.device === opt.value ? 'rgba(6,182,212,0.1)' : 'rgba(0, 0, 0,0.02)',
                  color: config.device === opt.value ? 'var(--brand-cyan)' : 'var(--text-secondary)',
                  fontSize: '0.8rem', fontWeight: config.device === opt.value ? 600 : 400,
                }}>
                  <div>{opt.icon}</div>
                  <div>{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Platforms + placements per platform */}
          {(Object.keys(config.platforms) as Array<keyof PlacementConfig['platforms']>).map(platform => {
            const info = platformInfo[platform]
            const platformPlacements = Object.entries(PLACEMENT_MAP).filter(([, v]) => v.platform === platform)
            return (
              <div key={platform} style={{ marginBottom: '1rem', borderRadius: '12px', border: '1px solid rgba(0, 0, 0,0.06)', overflow: 'hidden' }}>
                {/* Platform header */}
                <div onClick={() => togglePlatform(platform)} style={{
                  display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1.25rem', cursor: 'pointer',
                  background: config.platforms[platform] ? 'rgba(0, 0, 0,0.04)' : 'rgba(0, 0, 0,0.01)',
                }}>
                  <div style={{ width: 18, height: 18, borderRadius: '4px', flexShrink: 0, border: `2px solid ${config.platforms[platform] ? info.color : 'rgba(0, 0, 0,0.2)'}`, background: config.platforms[platform] ? info.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'var(--text-primary)' }}>
                    {config.platforms[platform] ? '✓' : ''}
                  </div>
                  <span style={{ display: 'flex' }}>{info.icon}</span>
                  <span style={{ fontWeight: 600, flex: 1 }}>{info.label}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                    {platformPlacements.filter(([k]) => config.placements[k as keyof PlacementConfig['placements']]).length}/{platformPlacements.length} placement
                  </span>
                </div>
                {/* Placement checkboxes */}
                {config.platforms[platform] && (
                  <div style={{ padding: '0.75rem 1.25rem 1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'rgba(0,0,0,0.15)' }}>
                    {platformPlacements.map(([key, meta]) => {
                      const k = key as keyof PlacementConfig['placements']
                      return (
                        <div key={key} onClick={() => togglePlacement(k)} style={{
                          display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.6rem 0.75rem',
                          borderRadius: '8px', cursor: 'pointer',
                          background: config.placements[k] ? 'rgba(0, 0, 0,0.05)' : 'transparent',
                          border: `1px solid ${config.placements[k] ? 'rgba(0, 0, 0,0.1)' : 'transparent'}`,
                        }}>
                          <div style={{ width: 16, height: 16, borderRadius: '4px', flexShrink: 0, marginTop: '2px', border: `2px solid ${config.placements[k] ? info.color : 'rgba(0, 0, 0,0.2)'}`, background: config.placements[k] ? info.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: 'var(--text-primary)' }}>
                            {config.placements[k] ? '✓' : ''}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{meta.label}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{meta.desc}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''


type Objective = 'AWARENESS' | 'REACH' | 'TRAFFIC' | 'ENGAGEMENT' | 'LEADS' | 'CONVERSIONS' | 'VIDEO_VIEWS'

// Tipi di domanda disponibili nei Meta Lead Form
const META_QUESTION_TYPES = [
  { value: 'EMAIL', label: 'Email', icon: <Mail size={16} />, preset: true },
  { value: 'FULL_NAME', label: 'Nome e Cognome', icon: <User size={16} />, preset: true },
  { value: 'PHONE', label: 'Telefono', icon: <Smartphone size={16} />, preset: true },
  { value: 'COMPANY_NAME', label: 'Azienda', icon: <Building size={16} />, preset: true },
  { value: 'JOB_TITLE', label: 'Ruolo Lavorativo', icon: <Briefcase size={16} />, preset: true },
  { value: 'CITY', label: 'Città', icon: <MapPin size={16} />, preset: true },
  { value: 'CUSTOM', label: 'Domanda personalizzata', icon: <Edit2 size={16} />, preset: false },
]

interface LeadFormQuestion {
  id: string
  type: string
  label: string // per custom
  required: boolean
}

interface LeadFormConfig {
  formTitle: string
  headline: string
  description: string
  privacyPolicyUrl: string
  thankYouTitle: string
  thankYouBody: string
  ctaLabel: string
  questions: LeadFormQuestion[]
}

function suggestObjective(budget: number, hasPixel: boolean): { objective: Objective; reason: string } {
  if (budget < 10) return { objective: 'REACH', reason: 'Budget basso: ideale per Copertura e Awareness.' }
  if (budget < 30) return { objective: 'TRAFFIC', reason: 'Budget medio: ottimizza i click verso il sito.' }
  if (budget < 60) return { objective: 'LEADS', reason: hasPixel ? 'Budget ottimale per Lead con conversioni Pixel.' : 'Meta Lead Form consigliato: nessuna LP richiesta.' }
  return { objective: hasPixel ? 'CONVERSIONS' : 'LEADS', reason: hasPixel ? 'Budget alto: massimizza le conversioni con Pixel.' : 'Budget alto ma senza Pixel: fallback su LEADS.' }
}

const objectives = [
  { value: 'REACH', icon: <Activity size={24} />, label: 'Copertura' },
  { value: 'TRAFFIC', icon: <TrendingUp size={24} />, label: 'Traffico' },
  { value: 'ENGAGEMENT', icon: <MessageCircle size={18} />, label: 'Interazioni' },
  { value: 'LEADS', icon: <Megaphone size={24} />, label: 'Lead' },
  { value: 'CONVERSIONS', icon: <ShoppingCart size={24} />, label: 'Conversioni' },
  { value: 'AWARENESS', icon: <Lightbulb size={24} />, label: 'Awareness' },
  { value: 'VIDEO_VIEWS', icon: <Video size={24} />, label: 'Video Views' },
]

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem 1rem',
  background: 'rgba(0, 0, 0,0.05)',
  border: '1px solid rgba(0, 0, 0,0.1)',
  borderRadius: '10px', color: 'var(--text-primary)',
  fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
}

const defaultLeadForm: LeadFormConfig = {
  formTitle: 'Richiedi informazioni',
  headline: 'Vuoi saperne di più?',
  description: 'Compila il modulo e ti ricontatteremo entro 24 ore.',
  privacyPolicyUrl: '',
  thankYouTitle: 'Grazie per il tuo interesse!',
  thankYouBody: 'Un nostro consulente ti contatterà a breve.',
  ctaLabel: 'INVIA',
  questions: [
    { id: 'q1', type: 'FULL_NAME', label: 'Nome e Cognome', required: true },
    { id: 'q2', type: 'EMAIL', label: 'Email', required: true },
    { id: 'q3', type: 'PHONE', label: 'Telefono', required: false },
  ],
}

function LeadFormBuilder({ config, onChange }: { config: LeadFormConfig; onChange: (c: LeadFormConfig) => void }) {
  const setField = (k: keyof LeadFormConfig, v: any) => onChange({ ...config, [k]: v })
  const [showPreview, setShowPreview] = useState(false)

  const addQuestion = (type: string) => {
    const q: LeadFormQuestion = {
      id: `q${Date.now()}`, type,
      label: META_QUESTION_TYPES.find(t => t.value === type)?.label.replace(/^[^\w]+/, '') ?? 'Domanda',
      required: false,
    }
    onChange({ ...config, questions: [...config.questions, q] })
  }

  const removeQuestion = (id: string) => onChange({ ...config, questions: config.questions.filter(q => q.id !== id) })

  const toggleRequired = (id: string) => onChange({
    ...config,
    questions: config.questions.map(q => q.id === id ? { ...q, required: !q.required } : q),
  })

  const updateCustomLabel = (id: string, label: string) => onChange({
    ...config,
    questions: config.questions.map(q => q.id === id ? { ...q, label } : q),
  })

  return (
    <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ClipboardList size={20} color="#fbbf24" />
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Configurazione Meta Lead Form</h3>
          <span style={{ fontSize: '0.72rem', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: '50px', fontWeight: 600 }}>Creato via API Meta</span>
        </div>
        <button onClick={() => setShowPreview(!showPreview)} style={{ background: 'rgba(0, 0, 0,0.05)', border: '1px solid rgba(0, 0, 0,0.1)', borderRadius: '8px', padding: '0.4rem 0.8rem', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {showPreview ? <><Edit2 size={14} /> Modifica</> : <><Eye size={14} /> Anteprima</>}
        </button>
      </div>

      {!showPreview ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Form settings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Titolo form</label>
              <input style={inputStyle} value={config.formTitle} onChange={e => setField('formTitle', e.target.value)} placeholder="Es. Richiedi informazioni" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Headline (visible nell'ad)</label>
              <input style={inputStyle} value={config.headline} onChange={e => setField('headline', e.target.value)} placeholder="Es. Vuoi saperne di più?" />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Descrizione nel form</label>
            <textarea
              style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }}
              value={config.description}
              onChange={e => setField('description', e.target.value)}
              placeholder="Breve testo che appare prima dei campi..."
            />
          </div>

          {/* Questions builder */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Campi del form ({config.questions.length})</label>
            </div>

            {/* Existing questions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {config.questions.map((q, i) => (
                <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', background: 'rgba(0, 0, 0,0.04)', border: '1px solid rgba(0, 0, 0,0.08)', borderRadius: '10px' }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(0, 0, 0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--text-tertiary)', flexShrink: 0 }}>{i + 1}</span>
                  {q.type === 'CUSTOM' ? (
                    <input
                      style={{ ...inputStyle, padding: '0.4rem 0.75rem', fontSize: '0.85rem', flex: 1 }}
                      value={q.label}
                      onChange={e => updateCustomLabel(q.id, e.target.value)}
                      placeholder="Scrivi la domanda..."
                    />
                  ) : (
                    <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 500 }}>
                      {META_QUESTION_TYPES.find(t => t.value === q.type)?.label ?? q.label}
                    </span>
                  )}
                  {/* Required toggle */}
                  <button onClick={() => toggleRequired(q.id)} style={{
                    padding: '3px 8px', borderRadius: '50px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, flexShrink: 0,
                    background: q.required ? 'rgba(236,72,153,0.15)' : 'rgba(0, 0, 0,0.05)',
                    border: `1px solid ${q.required ? 'rgba(236,72,153,0.3)' : 'rgba(0, 0, 0,0.1)'}`,
                    color: q.required ? '#f9a8d4' : 'var(--text-tertiary)',
                  }}>
                    {q.required ? '* obbligatorio' : 'facoltativo'}
                  </button>
                  <button onClick={() => removeQuestion(q.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '0.25rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add field dropdown */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {META_QUESTION_TYPES.filter(t => !config.questions.some(q => q.type === t.value) || t.value === 'CUSTOM').map(type => (
                <button
                  key={type.value}
                  onClick={() => addQuestion(type.value)}
                  style={{
                    padding: '5px 12px', borderRadius: '50px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                    background: 'rgba(0, 0, 0,0.04)', border: '1px solid rgba(0, 0, 0,0.1)',
                    color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem',
                  }}
                >
                  <Plus size={12} /> {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Privacy + Thank you */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Privacy Policy URL <span style={{ color: '#f87171' }}>*</span></label>
              <input id="privacy-url" style={inputStyle} value={config.privacyPolicyUrl} onChange={e => setField('privacyPolicyUrl', e.target.value)} placeholder="https://rossi.it/privacy" />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><AlertTriangle size={12} color="#f59e0b" /> Obbligatoria per Meta Lead Forms</p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>CTA del bottone</label>
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={config.ctaLabel}
                onChange={e => setField('ctaLabel', e.target.value)}
              >
                <option value="INVIA">Invia</option>
                <option value="ISCRIVITI">Iscriviti</option>
                <option value="RICHIEDI_INFO">Richiedi informazioni</option>
                <option value="PRENOTA">Prenota ora</option>
                <option value="CONTATTACI">Contattaci</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Titolo schermata di ringraziamento</label>
              <input style={inputStyle} value={config.thankYouTitle} onChange={e => setField('thankYouTitle', e.target.value)} placeholder="Grazie!" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Messaggio di ringraziamento</label>
              <input style={inputStyle} value={config.thankYouBody} onChange={e => setField('thankYouBody', e.target.value)} placeholder="Ti contatteremo presto." />
            </div>
          </div>
        </div>
      ) : (
        /* ANTEPRIMA FORM */
        <div style={{ maxWidth: '340px', margin: '0 auto' }}>
          <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.4)', color: '#1c1e21' }}>
            {/* Meta header */}
            <div style={{ background: '#1877f2', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>f</div>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>Meta Ads — Lead Form</span>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem', color: '#1c1e21' }}>{config.headline}</h3>
              <p style={{ fontSize: '0.8rem', color: '#606770', marginBottom: '1rem', lineHeight: 1.5 }}>{config.description}</p>
              {config.questions.map((q, i) => (
                <div key={q.id} style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#606770', marginBottom: '0.25rem', fontWeight: 600 }}>
                    {META_QUESTION_TYPES.find(t => t.value === q.type)?.label.replace(/^[^\w]+/, '') ?? q.label}
                    {q.required && <span style={{ color: '#f87171' }}> *</span>}
                  </label>
                  <div style={{ padding: '0.6rem 0.8rem', background: '#f0f2f5', borderRadius: '8px', fontSize: '0.85rem', color: '#8a8d96' }}>—</div>
                </div>
              ))}
              <button style={{ width: '100%', padding: '0.8rem', background: '#1877f2', border: 'none', borderRadius: '8px', color: 'var(--text-primary)', fontWeight: 700, marginTop: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                {config.ctaLabel.replaceAll('_', ' ')}
              </button>
              <p style={{ fontSize: '0.68rem', color: '#8a8d96', textAlign: 'center', marginTop: '0.75rem' }}>
                Cliccando accetti la <a href={config.privacyPolicyUrl || '#'} style={{ color: '#1877f2' }}>Privacy Policy</a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function NewCampaignPage() {
  const { id: clientId } = useParams() as { id: string }
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')
  const [hasPixel, setHasPixel] = useState(false)
  const [leadFormConfig, setLeadFormConfig] = useState<LeadFormConfig>(defaultLeadForm)
  const [placementConfig, setPlacementConfig] = useState<PlacementConfig>(defaultPlacement)
  const [showPlacement, setShowPlacement] = useState(true)

  const [availablePages, setAvailablePages] = useState<Array<{id: string, name: string, instagramId?: string, instagramUsername?: string}>>([])
  const [loadingPages, setLoadingPages] = useState(false)

  // Ad Set: Budget & Programmazione
  const [schedule, setSchedule] = useState({
    budgetOptimization: 'CBO' as 'CBO' | 'ABO',
    budgetType: 'DAILY' as 'DAILY' | 'LIFETIME',
    startDate: '',
    endDate: '',
    conversionLocation: 'WEBSITE' as 'WEBSITE' | 'APP' | 'MESSENGER' | 'WHATSAPP' | 'ON_AD',
    optimizationGoal: 'LEAD_GENERATION' as string,
    attributionWindow: '7D_CLICK_1D_VIEW' as '1D_CLICK' | '7D_CLICK' | '7D_CLICK_1D_VIEW' | '28D_CLICK',
  })

  // Ad Set: Targeting pubblico
  const [targeting, setTargeting] = useState({
    countries: ['IT'],
    ageMin: 18,
    ageMax: 65,
    gender: 'ALL' as 'ALL' | 'MALE' | 'FEMALE',
    interests: [] as string[],
    newInterest: '',
    language: 'it',
    broadAudience: true,
  })

  // Ad: Identità inserzione
  const [identity, setIdentity] = useState({
    facebookPageId: '',
    facebookPageName: 'Pagina del cliente',
    instagramActorId: '',
    instagramUsername: '',
    useInstagram: false,
  })

  const [form, setForm] = useState({
    name: '',
    dailyBudget: 30,
    objective: 'LEADS' as Objective,
    objectiveSetBy: 'AI' as 'AI' | 'OPERATOR',
    destinationUrl: '',
    useLeadForm: false,
    useClientUrl: true,
  })

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    // Gestione Query Params per applicazione API dei Template Ultra Senior
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search)
      const templateId = searchParams.get('templateId')
      if (templateId && clientId) {
        const fetchTemplate = async () => {
          try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${API_URL}/api/templates/${templateId}/clone/${clientId}`, {
               headers: { Authorization: `Bearer ${token}` }
            })
            if (res.ok) {
               const data = await res.json()
               setForm(f => ({
                 ...f,
                 objective: data.campaignDefaults.objective || f.objective,
                 dailyBudget: data.campaignDefaults.dailyBudget || f.dailyBudget,
                 objectiveSetBy: 'OPERATOR'  // Impostato da template
               }))
               if (data.campaignDefaults.placement) {
                 setPlacementConfig(p => ({ ...p, mode: data.campaignDefaults.placement.mode }))
               }
               if (data.campaignDefaults.targeting) {
                 setTargeting(t => ({ 
                   ...t, 
                   broadAudience: data.campaignDefaults.targeting.mode === 'BROAD',
                   ageMin: data.campaignDefaults.targeting.ageMin || t.ageMin,
                   ageMax: data.campaignDefaults.targeting.ageMax || t.ageMax
                 }))
               }
               if (data.campaignDefaults.budgetType) {
                 setSchedule(s => ({ ...s, budgetType: data.campaignDefaults.budgetType as any }))
               }
               // Fallback intelligente per lead forms
               if (data.campaignDefaults.objective === 'LEADS') {
                 setForm(f => ({ ...f, useLeadForm: true }))
               }
            }
          } catch(e) { console.error('Errore caricamento template', e) }
        }
        fetchTemplate()
      }
    }
  }, [clientId])


  useEffect(() => {
    const fetchClient = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API_URL}/api/clients/${clientId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setClientName(data.name)
          setHasPixel(!!data.metaPixelId)
          setLeadFormConfig(c => ({ ...c, privacyPolicyUrl: data.websiteUrl + '/privacy' }))
          // Precompila identità dalla page del cliente
          setIdentity(id => ({ ...id, facebookPageId: data.metaPageId, facebookPageName: `Pagina di ${data.name}` }))
          const suggestion = suggestObjective(form.dailyBudget, !!data.metaPixelId)
          set('objective', suggestion.objective)
        }
      } catch { setClientName('Cliente') }
    }
    
    const fetchMetaPages = async () => {
      setLoadingPages(true)
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API_URL}/api/clients/${clientId}/meta/pages`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setAvailablePages(data.pages || [])
        } else {
          const errorData = await res.json().catch(() => null)
          if (errorData?.error && errorData.error.includes('RATE_LIMIT')) {
            setError(errorData.error)
          }
        }
      } catch (e) {
        console.error('Errore fetch pagine Meta', e)
      } finally {
        setLoadingPages(false)
      }
    }

    fetchClient()
    fetchMetaPages()
  }, [clientId])

  const suggestion = suggestObjective(form.dailyBudget, hasPixel)

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Inserisci il nome della campagna'); return }
    if (form.useLeadForm && !leadFormConfig.privacyPolicyUrl) {
      setError('Inserisci l\'URL della Privacy Policy (obbligatoria per i Meta Lead Form)')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/api/clients/${clientId}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name,
          objective: form.objective,
          objectiveSetBy: form.objectiveSetBy,
          dailyBudget: form.dailyBudget,
          destinationUrl: form.useLeadForm ? undefined : (form.useClientUrl ? undefined : form.destinationUrl),
          useLeadForm: form.useLeadForm,
          leadFormConfig: form.useLeadForm ? leadFormConfig : undefined,
          placementConfig,
          schedule,
          targeting,
          identity,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore creazione campagna')
      router.push(`/clients/${clientId}/campaigns/${data.id}/preview`)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="w-full min-w-0">
      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <Link href={`/clients/${clientId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '1rem', fontSize: '0.9rem' }}>
          <ArrowLeft size={16} /> {clientName}
        </Link>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800 }}>
          Nuova <span style={{ color: 'var(--brand-fuchsia)' }}>Campagna.</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Configura la campagna. L'AI analizzerà il sito e genererà strategia + creatività in autonomia.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Nome + Budget */}
        <div className="glass-table" style={{ padding: '1.75rem', borderRadius: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <Zap color="var(--brand-cyan)" size={20} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Informazioni Base</h2>
          </div>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>Nome campagna *</label>
            <input id="campaign-name" style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Es. Lead Gen Estate 2025" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>Budget giornaliero (€)</label>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px', gap: '1rem', alignItems: 'center', background: 'var(--bg-surface-hover)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
              <div style={{flex:1}}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <Wallet size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                  <input id="campaign-budget" type="range" min={5} max={500} step={5} value={form.dailyBudget} onChange={e => set('dailyBudget', Number(e.target.value))} style={{ flex: 1 }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', borderLeft: '1px solid var(--border-glass)', paddingLeft: '1rem' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>€{form.dailyBudget}<span style={{fontSize:'0.8rem', color:'var(--text-tertiary)'}}>/gg</span></div>
                <div style={{ fontSize: '0.75rem', color: 'var(--brand-meta)', fontWeight: 600 }}>Stima: €{(form.dailyBudget * 30).toLocaleString('it-IT')}/mese</div>
              </div>
            </div>

          </div>
        </div>

        {/* Obiettivo */}
        <div className="glass-table" style={{ padding: '1.75rem', borderRadius: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Target color="var(--brand-fuchsia)" size={20} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Obiettivo Campagna</h2>
          </div>
          <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#a78bfa', fontWeight: 600, marginBottom: '0.4rem' }}><Sparkles size={14} style={{ display: 'inline' }} /> Suggerito dall'AI (budget €{form.dailyBudget}/gg)</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem' }}>
                  {objectives.find(o => o.value === suggestion.objective)?.icon} {objectives.find(o => o.value === suggestion.objective)?.label}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{suggestion.reason}</div>
              </div>
              <button onClick={() => { set('objective', suggestion.objective); set('objectiveSetBy', 'AI') }} style={{
                padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', flexShrink: 0,
                background: form.objective === suggestion.objective && form.objectiveSetBy === 'AI' ? 'var(--brand-fuchsia)' : 'rgba(139,92,246,0.2)',
                border: '1px solid rgba(139,92,246,0.3)', color: 'var(--text-primary)',
              }}>
                {form.objective === suggestion.objective && form.objectiveSetBy === 'AI' ? '✓ Usato' : 'Usa questo'}
              </button>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Oppure scegli manualmente:</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
            {objectives.map(obj => (
              <button key={obj.value} onClick={() => { set('objective', obj.value); set('objectiveSetBy', 'OPERATOR') }} style={{
                padding: '0.6rem 0.5rem', borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
                border: `1px solid ${form.objective === obj.value ? 'var(--brand-fuchsia)' : 'rgba(0, 0, 0,0.08)'}`,
                background: form.objective === obj.value ? 'rgba(236,72,153,0.1)' : 'rgba(0, 0, 0,0.02)',
                color: form.objective === obj.value ? 'white' : 'var(--text-secondary)',
                fontSize: '0.8rem', fontWeight: form.objective === obj.value ? 600 : 400,
              }}>
                <div style={{ fontSize: '1.1rem' }}>{obj.icon}</div>
                <div>{obj.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* URL destinazione / Lead Form */}
        <div className="glass-table" style={{ padding: '1.75rem', borderRadius: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Globe color="#34d399" size={20} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Destinazione & Raccolta Lead</h2>
          </div>

          {/* Opzione 1: URL sito */}
          <div onClick={() => { set('useLeadForm', false); set('useClientUrl', true) }} style={{
            padding: '1rem 1.25rem', borderRadius: '12px', cursor: 'pointer', marginBottom: '0.75rem',
            border: `1px solid ${!form.useLeadForm && form.useClientUrl ? 'var(--brand-cyan)' : 'rgba(0, 0, 0,0.08)'}`,
            background: !form.useLeadForm && form.useClientUrl ? 'rgba(6,182,212,0.06)' : 'rgba(0, 0, 0,0.02)',
            display: 'flex', alignItems: 'center', gap: '1rem',
          }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: `2px solid ${!form.useLeadForm && form.useClientUrl ? 'var(--brand-cyan)' : 'rgba(0, 0, 0,0.2)'}`, background: !form.useLeadForm && form.useClientUrl ? 'var(--brand-cyan)' : 'transparent' }} />
            <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Globe size={16} /> Usa URL principale del sito cliente</span>
          </div>

          {/* Opzione 2: LP personalizzata */}
          <div onClick={() => { set('useLeadForm', false); set('useClientUrl', false) }} style={{
            padding: '1rem 1.25rem', borderRadius: '12px', cursor: 'pointer', marginBottom: '0.75rem',
            border: `1px solid ${!form.useLeadForm && !form.useClientUrl ? 'var(--brand-cyan)' : 'rgba(0, 0, 0,0.08)'}`,
            background: !form.useLeadForm && !form.useClientUrl ? 'rgba(6,182,212,0.06)' : 'rgba(0, 0, 0,0.02)',
            display: 'flex', alignItems: 'center', gap: '1rem',
          }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: `2px solid ${!form.useLeadForm && !form.useClientUrl ? 'var(--brand-cyan)' : 'rgba(0, 0, 0,0.2)'}`, background: !form.useLeadForm && !form.useClientUrl ? 'var(--brand-cyan)' : 'transparent' }} />
            <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}><LinkIcon size={16} /> Landing Page personalizzata</span>
          </div>
          {!form.useLeadForm && !form.useClientUrl && (
            <input id="destination-url" style={{ ...inputStyle, marginBottom: '0.75rem' }} value={form.destinationUrl} onChange={e => set('destinationUrl', e.target.value)} placeholder="https://offerta.rossi.it/promo-estate-2025" />
          )}

          {/* Opzione 3: Meta Lead Form con builder */}
          <div onClick={() => set('useLeadForm', true)} style={{
            borderRadius: '12px', cursor: 'pointer',
            border: `1px solid ${form.useLeadForm ? '#fbbf24' : 'rgba(0, 0, 0,0.08)'}`,
            background: form.useLeadForm ? 'rgba(251,191,36,0.04)' : 'rgba(0, 0, 0,0.02)',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: `2px solid ${form.useLeadForm ? '#fbbf24' : 'rgba(0, 0, 0,0.2)'}`, background: form.useLeadForm ? '#fbbf24' : 'transparent' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}><MessageCircle size={16} /> Crea Meta Lead Form direttamente dall'app</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Nessuna landing page richiesta. Il form viene creato automaticamente via API Meta al momento del lancio.
                </div>
              </div>
              <ChevronDown size={16} color="var(--text-tertiary)" style={{ transform: form.useLeadForm ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
            </div>

            {/* Lead Form Builder — espanso quando selezionato */}
            {form.useLeadForm && (
              <div onClick={e => e.stopPropagation()}>
                <LeadFormBuilder config={leadFormConfig} onChange={setLeadFormConfig} />
              </div>
            )}
          </div>
        </div>


        {/* IDENTITÀ INSERZIONE */}
        <div className="glass-table" style={{ padding: '1.75rem', borderRadius: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <User color="#1877f2" size={20} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Identità Inserzione</h2>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            {/* Pagina Facebook */}
            <div style={{ background: 'rgba(24,119,242,0.05)', border: '1px solid rgba(24,119,242,0.15)', padding: '1.25rem', borderRadius: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#1877f2', marginBottom: '0.75rem', fontWeight: 700 }}>
                <Facebook size={16} /> Pagina Facebook <span style={{ color: '#f87171' }}>*</span>
              </label>
              
              {loadingPages ? (
                <div style={{ padding: '0.75rem', background: '#fff', borderRadius: '10px', fontSize: '0.85rem', color: 'var(--text-tertiary)', border: '1px solid rgba(0,0,0,0.1)' }}>
                  Caricamento Pagine assegnate...
                </div>
              ) : availablePages.length > 0 ? (
                <select
                  style={{ ...inputStyle, marginBottom: '0.5rem', background: '#fff', cursor: 'pointer' }}
                  value={identity.facebookPageId}
                  onChange={e => {
                    const page = availablePages.find(p => p.id === e.target.value)
                    if (page) {
                      setIdentity(prev => ({
                        ...prev,
                        facebookPageId: page.id,
                        facebookPageName: page.name,
                        instagramActorId: page.instagramId || prev.instagramActorId,
                        instagramUsername: page.instagramUsername || prev.instagramUsername,
                        useInstagram: !!page.instagramId || prev.useInstagram
                      }))
                    } else {
                      setIdentity(prev => ({ ...prev, facebookPageId: e.target.value }))
                    }
                  }}
                  required
                >
                  <option value="" disabled>Seleziona una Pagina</option>
                  {availablePages.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.instagramUsername ? (p.instagramUsername.includes('(IG)') ? ' (+ IG)' : ` (+ IG: @${p.instagramUsername})`) : (p.instagramId ? ' (+ IG)' : '')}</option>
                  ))}
                </select>
              ) : (
                <input 
                  id="fb-page-id" 
                  style={{ ...inputStyle, marginBottom: '0.5rem', background: '#fff' }} 
                  value={identity.facebookPageId} 
                  onChange={e => setIdentity(prev => ({ ...prev, facebookPageId: e.target.value }))} 
                  placeholder="ID della Pagina (inserimento manuale)" 
                  required 
                />
              )}
              
              <input 
                id="fb-page-name" 
                style={{ ...inputStyle, background: '#fff' }} 
                value={identity.facebookPageName} 
                onChange={e => setIdentity(prev => ({ ...prev, facebookPageName: e.target.value }))} 
                placeholder="Nome della Pagina (uso interno)" 
                disabled={availablePages.some(p => p.id === identity.facebookPageId)} // disabilita se la pagina è nota
              />
              <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>L'ID della pagina è obbligatorio per pubblicare.</p>
            </div>

            {/* Account Instagram */}
            <div style={{ background: 'rgba(225,48,108,0.05)', border: '1px solid rgba(225,48,108,0.15)', padding: '1.25rem', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#e1306c', fontWeight: 700 }}>
                  <Instagram size={16} /> Account Instagram
                </label>
                <button onClick={() => setIdentity(prev => ({ ...prev, useInstagram: !prev.useInstagram }))} style={{
                  padding: '3px 8px', borderRadius: '50px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, flexShrink: 0,
                  background: identity.useInstagram ? 'rgba(225,48,108,0.15)' : 'rgba(0, 0, 0,0.05)',
                  border: `1px solid ${identity.useInstagram ? 'rgba(225,48,108,0.3)' : 'rgba(0, 0, 0,0.1)'}`,
                  color: identity.useInstagram ? '#e1306c' : 'var(--text-tertiary)',
                }}>
                  {identity.useInstagram ? 'Attivo' : 'Disattivato'}
                </button>
              </div>
              
              {identity.useInstagram ? (
                <>
                  <input 
                    id="ig-actor-id" 
                    style={{ ...inputStyle, marginBottom: '0.5rem', background: '#fff' }} 
                    value={identity.instagramUsername ? (identity.instagramUsername.includes('(IG)') ? identity.instagramUsername : `@${identity.instagramUsername}`) : identity.instagramActorId} 
                    onChange={e => {
                      if (!identity.instagramUsername) setIdentity(prev => ({ ...prev, instagramActorId: e.target.value }))
                    }} 
                    placeholder="Instagram Actor ID" 
                    disabled={!!identity.instagramUsername}
                  />
                  {identity.instagramUsername && (
                    <div style={{ fontSize: '0.65rem', color: 'var(--brand-meta)', marginBottom: '0.5rem', fontWeight: 600 }}>Identificativo API nascosto: {identity.instagramActorId}</div>
                  )}
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Se lasciato vuoto, Meta userà una pagina Instagram "fantasma" legata a Facebook per i placement su IG.</p>
                </>
              ) : (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Non configurare un account Instagram specifico. Le inserzioni appariranno a nome della Pagina Facebook se i placement su Instagram sono attivi.</p>
              )}
            </div>
          </div>
        </div>

        {/* PLACEMENT SECTION */}
        <div className="glass-table" style={{ padding: '1.75rem', borderRadius: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', cursor: 'pointer' }} onClick={() => setShowPlacement(!showPlacement)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Layers color="#f59e0b" size={20} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Piattaforme & Placement</h2>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', background: placementConfig.mode === 'ADVANTAGE_PLUS' ? 'rgba(236,72,153,0.15)' : 'rgba(6,182,212,0.15)', color: placementConfig.mode === 'ADVANTAGE_PLUS' ? '#f9a8d4' : 'var(--brand-cyan)', padding: '2px 8px', borderRadius: '50px', fontWeight: 600 }}>
                {placementConfig.mode === 'ADVANTAGE_PLUS' ? <><Sparkles size={12} /> Advantage+</> : <><Sliders size={12} /> Manuale</>}
              </span>
            </div>
            <ChevronDown size={16} color="var(--text-tertiary)" style={{ transform: showPlacement ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          {showPlacement && <PlacementSelector config={placementConfig} onChange={setPlacementConfig} />}
          {!showPlacement && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {placementConfig.mode === 'ADVANTAGE_PLUS' ? (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Meta ottimizzerà automaticamente su tutti i placement disponibili.</span>
              ) : (
                Object.entries(placementConfig.placements)
                  .filter(([, v]) => v)
                  .map(([k]) => (
                    <span key={k} style={{ fontSize: '0.75rem', background: 'rgba(0, 0, 0,0.06)', padding: '3px 8px', borderRadius: '50px', color: 'var(--text-secondary)' }}>
                      {PLACEMENT_MAP[k]?.label ?? k}
                    </span>
                  ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── BUDGET & PROGRAMMAZIONE ── */}
      <div className="glass-table" style={{ padding: '1.75rem', borderRadius: '20px', marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Calendar color="#34d399" size={20} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Budget & Programmazione</h2>
        </div>

        {/* CBO vs ABO */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>Ottimizzazione Budget</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div onClick={() => setSchedule(s => ({ ...s, budgetOptimization: 'CBO' }))} style={{ padding: '0.875rem 1rem', borderRadius: '12px', cursor: 'pointer', border: `1px solid ${schedule.budgetOptimization === 'CBO' ? '#34d399' : 'rgba(0, 0, 0,0.08)'}`, background: schedule.budgetOptimization === 'CBO' ? 'rgba(52,211,153,0.06)' : 'rgba(0, 0, 0,0.02)' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.2rem', fontSize: '0.9rem' }}><Trophy size={16} /> Livello Campagna (CBO)</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Meta sposta il budget dinamicamente sull'annuncio migliore</div>
            </div>
            <div onClick={() => setSchedule(s => ({ ...s, budgetOptimization: 'ABO' }))} style={{ padding: '0.875rem 1rem', borderRadius: '12px', cursor: 'pointer', border: `1px solid ${schedule.budgetOptimization === 'ABO' ? '#06b6d4' : 'rgba(0, 0, 0,0.08)'}`, background: schedule.budgetOptimization === 'ABO' ? 'rgba(6,182,212,0.06)' : 'rgba(0, 0, 0,0.02)' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.2rem', fontSize: '0.9rem' }}><Target size={16} /> Livello Gruppo Annunci (ABO)</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Controlli esattamente quanto spende ogni gruppo (utile per test)</div>
            </div>
          </div>
        </div>

        {/* Budget type */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>Tipo di budget</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {[{ v: 'DAILY', label: 'Giornaliero', desc: 'Meta spende circa questo importo ogni giorno' }, { v: 'LIFETIME', label: 'Lifetime (Totale)', desc: 'Budget totale della campagna ripartito nel periodo' }].map(b => (
              <div key={b.v} onClick={() => setSchedule(s => ({ ...s, budgetType: b.v as any }))} style={{ padding: '0.875rem 1rem', borderRadius: '12px', cursor: 'pointer', border: `1px solid ${schedule.budgetType === b.v ? '#34d399' : 'rgba(0, 0, 0,0.08)'}`, background: schedule.budgetType === b.v ? 'rgba(52,211,153,0.06)' : 'rgba(0, 0, 0,0.02)' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.2rem', fontSize: '0.9rem' }}>{b.label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{b.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Data di inizio</label>
            <input type="date" id="start-date" style={inputStyle} value={schedule.startDate} onChange={e => setSchedule(s => ({ ...s, startDate: e.target.value }))} min={new Date().toISOString().split('T')[0]} />
            <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.3rem' }}>Lascia vuoto per partire subito dopo approvazione</p>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Data di fine {schedule.budgetType === 'DAILY' ? '(opzionale)' : <span style={{ color: '#f87171' }}>*</span>}</label>
            <input type="date" id="end-date" style={inputStyle} value={schedule.endDate} onChange={e => setSchedule(s => ({ ...s, endDate: e.target.value }))} min={schedule.startDate || new Date().toISOString().split('T')[0]} />
          </div>
        </div>

        {/* Conversion location + Attribution */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Luogo di conversione</label>
            <select id="conversion-location" style={{ ...inputStyle, cursor: 'pointer' }} value={schedule.conversionLocation} onChange={e => setSchedule(s => ({ ...s, conversionLocation: e.target.value as any }))}>
              <option value="WEBSITE">Sito Web</option>
              <option value="ON_AD">Nel form dell'inserzione (Lead Form)</option>
              <option value="MESSENGER">Messenger</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="APP">App</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Finestra di attribuzione</label>
            <select id="attribution-window" style={{ ...inputStyle, cursor: 'pointer' }} value={schedule.attributionWindow} onChange={e => setSchedule(s => ({ ...s, attributionWindow: e.target.value as any }))}>
              <option value="7D_CLICK_1D_VIEW">7 giorni dal click + 1 giorno dalla visualizzazione (standard)</option>
              <option value="7D_CLICK">7 giorni dal click</option>
              <option value="1D_CLICK">1 giorno dal click</option>
              <option value="28D_CLICK">28 giorni dal click</option>
            </select>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.3rem' }}>Il settaggio standard consigliato da Meta è 7 giorni click + 1 giorno view</p>
          </div>
        </div>
      </div>

      {/* ── PUBBLICO & TARGETING ── */}
      <div className="glass-table" style={{ padding: '1.75rem', borderRadius: '20px', marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Users color="#a78bfa" size={20} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Pubblico & Targeting</h2>
          {targeting.broadAudience && <span style={{ fontSize: '0.75rem', background: 'rgba(139,92,246,0.15)', color: '#a78bfa', padding: '2px 8px', borderRadius: '50px', fontWeight: 600 }}>Advantage+ — consigliato</span>}
        </div>

        {/* Broad toggle */}
        <div onClick={() => setTargeting(t => ({ ...t, broadAudience: !t.broadAudience }))} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', borderRadius: '12px', cursor: 'pointer', marginBottom: '1.25rem', border: `1px solid ${targeting.broadAudience ? 'rgba(139,92,246,0.3)' : 'rgba(0, 0, 0,0.08)'}`, background: targeting.broadAudience ? 'rgba(139,92,246,0.05)' : 'rgba(0, 0, 0,0.02)' }}>
          <div style={{ width: 18, height: 18, borderRadius: '4px', flexShrink: 0, border: `2px solid ${targeting.broadAudience ? '#a78bfa' : 'rgba(0, 0, 0,0.2)'}`, background: targeting.broadAudience ? '#a78bfa' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'var(--text-primary)' }}>{targeting.broadAudience ? '✓' : ''}</div>
          <div>
            <div style={{ fontWeight: 600 }}><Sparkles size={16} /> Pubblico Advantage+ (lascia lavorare l'algoritmo)</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>L'algoritmo avanzato di Meta cerca conversioni oltre i confini del targeting manuale. Usalo per massimizzare le performance. Funziona meglio con Pixel attivo.</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          {/* Paesi */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Area geografica *</label>
            <select id="geo-country" style={{ ...inputStyle, cursor: 'pointer' }} value={targeting.countries[0]} onChange={e => setTargeting(t => ({ ...t, countries: [e.target.value] }))}>
              <option value="IT">Italia</option>
              <option value="IT,CH">Italia + Svizzera</option>
              <option value="IT,CH,DE">IT + CH + Germania</option>
              <option value="EU">Europa</option>
              <option value="US">Stati Uniti</option>
              <option value="WORLDWIDE">Tutto il mondo</option>
            </select>
          </div>
          {/* Lingua */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Lingua</label>
            <select id="language" style={{ ...inputStyle, cursor: 'pointer' }} value={targeting.language} onChange={e => setTargeting(t => ({ ...t, language: e.target.value }))}>
              <option value="it">Italiano</option>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
              <option value="fr">Français</option>
              <option value="es">Español</option>
            </select>
          </div>
        </div>

        {/* Età e Genere */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>Fascia d'età: {targeting.ageMin} – {targeting.ageMax === 65 ? '65+' : targeting.ageMax} anni</label>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <input type="range" min={18} max={64} value={targeting.ageMin} onChange={e => setTargeting(t => ({ ...t, ageMin: Number(e.target.value) }))} style={{ flex: 1 }} />
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', minWidth: '30px' }}>{targeting.ageMin}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.5rem' }}>
              <input type="range" min={19} max={65} value={targeting.ageMax} onChange={e => setTargeting(t => ({ ...t, ageMax: Number(e.target.value) }))} style={{ flex: 1 }} />
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', minWidth: '30px' }}>{targeting.ageMax === 65 ? '65+' : targeting.ageMax}</span>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>Genere</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {[{ v: 'ALL', label: 'Tutti' }, { v: 'MALE', label: 'Solo uomini' }, { v: 'FEMALE', label: 'Solo donne' }].map(g => (
                <div key={g.v} onClick={() => setTargeting(t => ({ ...t, gender: g.v as any }))} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.75rem', borderRadius: '8px', cursor: 'pointer', border: `1px solid ${targeting.gender === g.v ? 'rgba(167,139,250,0.4)' : 'rgba(0, 0, 0,0.06)'}`, background: targeting.gender === g.v ? 'rgba(139,92,246,0.08)' : 'transparent' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${targeting.gender === g.v ? '#a78bfa' : 'rgba(0, 0, 0,0.2)'}`, background: targeting.gender === g.v ? '#a78bfa' : 'transparent', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: targeting.gender === g.v ? 600 : 400 }}>{g.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Interessi (opzionale, solo se non broad) */}
        {!targeting.broadAudience && (
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>Interessi & Comportamenti <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(opzionale)</span></label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input id="interest-input" style={{ ...inputStyle, flex: 1 }} value={targeting.newInterest} onChange={e => setTargeting(t => ({ ...t, newInterest: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter' && targeting.newInterest.trim()) { setTargeting(t => ({ ...t, interests: [...t.interests, t.newInterest.trim()], newInterest: '' })) }}} placeholder="Es. Real estate, Investimenti, Casa e giardino..." />
              <button onClick={() => { if (targeting.newInterest.trim()) setTargeting(t => ({ ...t, interests: [...t.interests, t.newInterest.trim()], newInterest: '' })) }} style={{ padding: '0 1rem', borderRadius: '10px', background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', cursor: 'pointer', fontWeight: 600 }}>+ Aggiungi</button>
            </div>
            {targeting.interests.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {targeting.interests.map((int, i) => (
                  <span key={i} style={{ fontSize: '0.8rem', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)', padding: '4px 10px', borderRadius: '50px', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {int} <button onClick={() => setTargeting(t => ({ ...t, interests: t.interests.filter((_, j) => j !== i) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: 0, fontSize: '0.8rem', lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
            {targeting.interests.length === 0 && <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Lightbulb size={12} /> Scrivi un interesse e premi Invio o "Aggiungi"</p>}
          </div>
        )}
      </div>



      {error && (
        <div style={{ marginTop: '1.5rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
        <button
          id="create-campaign-btn"
          onClick={handleSubmit}
          disabled={loading}
          className="btn-gorgeous"
          style={{ minWidth: '240px', justifyContent: 'center', fontSize: '1rem', padding: '0.9rem 2rem' }}
        >
          {loading ? <><Settings size={18} className="animate-spin" /> Avvio analisi AI...</> : <><Sparkles size={18} /> Crea & Avvia Analisi AI &rarr;</>}
        </button>
      </div>
    </div>
  )
}
