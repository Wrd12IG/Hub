'use client'

import React, { useState } from 'react'
import { Sparkles, AlertTriangle, List, CheckCircle } from 'lucide-react'

// ============================================================
// SEO TITLE GENERATOR (AI Helper)
// ============================================================

export function YoutubeTitleOptimizer({ currentTitle, onAply }: { currentTitle: string, onAply: (t: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])

  const generate = () => {
    setLoading(true)
    // SIMULATED AI ACTION: in production this calls Google Vertex/Gemini
    setTimeout(() => {
      setSuggestions([
        `🔥 ${currentTitle || 'Il video incredibile'} (Novità 2026)`,
        `${currentTitle || 'Come fare'} | Guida definitiva step-by-step`,
        `Perché TUTTI sbagliano su: ${currentTitle || 'questo argomento'}`
      ])
      setLoading(false)
    }, 1500)
  }

  return (
    <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(255,0,0,0.04)', borderRadius: '8px', border: '1px solid rgba(255,0,0,0.1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ff0000', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={14} /> SEO Title Generator
        </div>
        <button onClick={generate} disabled={loading} style={{ background: '#ff0000', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.7rem', cursor: loading ? 'wait' : 'pointer', fontWeight: 600 }}>
          {loading ? 'Generazione...' : 'Analizza Keyword'}
        </button>
      </div>

      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {suggestions.map((s, i) => (
            <div key={i} onClick={() => onAply(s)} style={{ fontSize: '0.78rem', background: '#fff', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', border: '1px solid rgba(0,0,0,0.05)' }}>
              {s}
            </div>
          ))}
          <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>Clicca un titolo per applicarlo. I titoli sono ottimizzati per il click-through rate (CTR).</div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// AUTO CHAPTERS
// ============================================================

export function YoutubeAutoChapters({ onApply }: { onApply: (chaptersText: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const generate = () => {
    setLoading(true)
    // SIMULATED AI ACTION: reads video audio and maps timestamps
    setTimeout(() => {
      const chapters = `\n\n📌 Capitoli del video:\n00:00 - Introduzione\n01:15 - Il problema principale\n03:30 - La soluzione (Passo 1)\n05:45 - Errore da evitare\n08:00 - Conclusione`
      onApply(chapters)
      setDone(true)
      setLoading(false)
    }, 2000)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.03)', borderRadius: '8px' }}>
      <div style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
        <List size={14} /> Genera Capitoli Automatici (AI)
      </div>
      {done ? (
        <div style={{ fontSize: '0.7rem', color: 'green', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} /> Aggiunti al testo</div>
      ) : (
        <button onClick={generate} disabled={loading} style={{ background: '#000', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.7rem', cursor: loading ? 'wait' : 'pointer', fontWeight: 600 }}>
          {loading ? 'Analizzo Audio...' : 'Genera'}
        </button>
      )}
    </div>
  )
}

// ============================================================
// COPYRIGHT & FORMAT WARNING
// ============================================================

export function YoutubeFormatWarning({ isShort }: { isShort: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '0.5rem' }}>
      {isShort ? (
        <div style={{ padding: '0.6rem', background: 'rgba(255,152,0,0.1)', borderLeft: '3px solid #ff9800', fontSize: '0.7rem', color: '#e65100' }}>
          📱 <strong>Formato Short:</strong> Assicurati che il video sia in formato verticale (9:16) e duri meno di 60 secondi. Verrà pubblicato tramite l'infrastruttura YouTube Shorts.
        </div>
      ) : (
        <div style={{ padding: '0.6rem', background: 'rgba(33,150,243,0.1)', borderLeft: '3px solid #2196f3', fontSize: '0.7rem', color: '#0d47a1' }}>
          📺 <strong>Long-Form Video:</strong> La thumbnail personalizzata è fondamentale. L'A/B test delle thumbnail (Youtube Test & Compare) verrà applicato se ne carichi più di una.
        </div>
      )}
      <div style={{ padding: '0.6rem', background: 'rgba(244,67,54,0.05)', borderLeft: '3px solid #f44336', fontSize: '0.7rem', color: '#c62828', display: 'flex', gap: '6px' }}>
        <AlertTriangle size={14} style={{ flexShrink: 0 }} />
        <span><strong>Controllo Copyright:</strong> Al momento del caricamento, YouTube scannerizzerà l'audio (Content ID). Se usi musica non licenziata, il video potrebbe essere limitato o non monetizzabile.</span>
      </div>
    </div>
  )
}
