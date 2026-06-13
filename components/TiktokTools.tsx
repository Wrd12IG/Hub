'use client'

import React, { useState } from 'react'
import { Sparkles, Music, AlertTriangle, Search, ActivitySquare } from 'lucide-react'

// ============================================================
// KEYWORD SUGGESTIONS (TikTok SEO Search)
// ============================================================

export function TiktokKeywordSuggestions({ onAdd }: { onAdd: (keyword: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [keywords, setKeywords] = useState<string[]>([])

  const analyze = () => {
    setLoading(true)
    // SIMULATED AI ACTION: reads TikTok trends based on current context
    setTimeout(() => {
      setKeywords([
        "2026 marketing hacks",
        "behind the scenes startup",
        "tutorial italiano veloce",
        "trucchi segreti iphone"
      ])
      setLoading(false)
    }, 1200)
  }

  return (
    <div style={{ marginTop: '0.4rem', padding: '0.75rem', background: 'rgba(105,201,208,0.06)', borderRadius: '8px', border: '1px solid rgba(105,201,208,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#69c9d0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Search size={14} /> TikTok Search Keywords
        </div>
        <button onClick={analyze} disabled={loading} style={{ background: '#69c9d0', color: '#000', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.7rem', cursor: loading ? 'wait' : 'pointer', fontWeight: 600 }}>
          {loading ? 'Analizzando Trend...' : 'Trova Keyword'}
        </button>
      </div>

      {keywords.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {keywords.map((kw, i) => (
            <span key={i} onClick={() => onAdd(kw)} style={{ fontSize: '0.7rem', background: '#fff', padding: '4px 8px', borderRadius: '12px', cursor: 'pointer', border: '1px solid rgba(0,0,0,0.05)', display: 'inline-block' }}>
              🔍 {kw}
            </span>
          ))}
          <div style={{ width: '100%', fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>Clicca per aggiungere alla caption. TikTok ora indicizza frasi complete meglio dei singoli hashtag.</div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// ANTI-SHADOWBAN CHECKER
// ============================================================

export function TiktokAntiShadowbanCheck({ videoUrls }: { videoUrls: string[] }) {
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<'IDLE' | 'SAFE' | 'WARNING'>('IDLE')

  const verify = () => {
    if (!videoUrls.length) return
    setChecking(true)
    
    // Simulate AI Vision scanning the video for other platform logos (IG Reels, YT Shorts)
    setTimeout(() => {
      // Dummy logic: random result just to show the feature
      const isWarn = Math.random() > 0.8
      setStatus(isWarn ? 'WARNING' : 'SAFE')
      setChecking(false)
    }, 2000)
  }

  return (
    <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.03)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
          <ActivitySquare size={14} /> Anti-Shadowban Scanner
        </div>
        <button onClick={verify} disabled={checking || !videoUrls.length} style={{ background: '#000', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.7rem', cursor: (checking || !videoUrls.length) ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
          {checking ? 'Scansione Frame...' : 'Verifica Video'}
        </button>
      </div>

      {status === 'WARNING' && (
        <div style={{ marginTop: '4px', padding: '0.5rem', background: 'rgba(244,67,54,0.1)', borderLeft: '3px solid #f44336', fontSize: '0.7rem', color: '#c62828', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span><strong>Rilevato Watermark:</strong> Abbiamo individuato possibili loghi di altre piattaforme (es. Instagram/CapCut). TikTok ridurrà attivamente la reach del 90%. Usa un video "pulito".</span>
        </div>
      )}
      
      {status === 'SAFE' && (
        <div style={{ marginTop: '4px', fontSize: '0.7rem', color: '#4caf50', display: 'flex', gap: '4px', alignItems: 'center' }}>
          <Sparkles size={12} /> Nessun watermark evidente rilevato. Video sicuro per l'algoritmo.
        </div>
      )}
    </div>
  )
}

// ============================================================
// COMMERCIAL MUSIC WARNING
// ============================================================

export function TiktokMusicWarning() {
  return (
    <div style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
      <Music size={14} color="#69c9d0" style={{ flexShrink: 0, marginTop: '2px' }} />
      <div>
        <strong style={{ color: 'var(--text-primary)' }}>Audio Commerciale:</strong> Se usi un account TikTok Business, assicurati che la musica nel video sia presa dalla <em>Commercial Music Library</em>. Tracce trendig normali verranno mutate dopo la pubblicazione.
      </div>
    </div>
  )
}
