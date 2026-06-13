'use client'

import React, { useState, useEffect } from 'react'
import { Sparkles, Users, FileImage } from 'lucide-react'

// ============================================================
// DWELL TIME OPTIMIZER (AI Format Helper)
// ============================================================

export function LinkedinDwellTimeWarning({ text, onFormatFix }: { text: string, onFormatFix?: (newText: string) => void }) {
  const [warnings, setWarnings] = useState<string[]>([])

  useEffect(() => {
    const newWarnings = []
    
    // Check line length (wall of text)
    const lines = text.split('\n')
    const hasLongParagraphs = lines.some(l => l.length > 250)
    if (hasLongParagraphs) {
      newWarnings.push('Hai un paragrafo molto lungo ("Wall of Text"). Usa più spazi bianchi (a-capo) per aumentare il Dwell Time.')
    }

    // Check sentence spacing
    const hasBulletPoints = text.includes('•') || text.includes('- ') || text.includes('* ')
    if (!hasBulletPoints && text.length > 500) {
      newWarnings.push('Considera l\'uso di elenchi puntati per rendere il post più leggibile (scansionabile).')
    }

    // Check questions (Hook/Debate)
    const hasQuestionMark = text.includes('?')
    if (!hasQuestionMark && text.length > 300) {
      newWarnings.push('Aggiungi una domanda alla fine per stimolare il dibattito nei commenti (favorisce l\'algoritmo).')
    }

    setWarnings(newWarnings)
  }, [text])

  if (!warnings.length) return null

  return (
    <div style={{ padding: '0.75rem', background: 'rgba(10,102,194,0.05)', borderRadius: '8px', borderLeft: '3px solid #0a66c2', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#0a66c2', marginBottom: '4px' }}>
        <Sparkles size={14} /> Dwell Time Optimizer
      </div>
      <ul style={{ margin: 0, paddingLeft: '16px' }}>
        {warnings.map((w, i) => (
          <li key={i} style={{ marginBottom: '2px' }}>{w}</li>
        ))}
      </ul>
    </div>
  )
}

// ============================================================
// SEE MORE PREVIEW (Where does it cut?)
// ============================================================

export function LinkedinSeeMorePreview({ text }: { text: string }) {
  if (!text) return null
  
  // LinkedIn typically cuts after ~3 lines or ~210 characters if there are no line breaks earlier
  const lines = text.split('\n')
  
  let visibleText = ''
  let cutoff = false

  if (lines.length > 3) {
    visibleText = lines.slice(0, 3).join('\n')
    cutoff = true
  } else if (text.length > 210) {
    visibleText = text.substring(0, 210)
    cutoff = true
  } else {
    visibleText = text
  }

  return (
    <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', fontFamily: '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto' }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#0a66c2', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>Anteprima "Vedi Altro"</div>
      {visibleText}{cutoff && <span style={{ color: 'var(--text-tertiary)' }}>... <span style={{ color: '#0a66c2', cursor: 'pointer', fontWeight: 600 }}>vedi altro</span></span>}
    </div>
  )
}

// ============================================================
// MENTIONS (Mock lookup)
// ============================================================

export function LinkedinMentionLookup({ onSelect }: { onSelect: (urn: string, name: string) => void }) {
  const [query, setQuery] = useState('')
  // MOCK: in production this calls LinkedIn's typeahead API
  const MOCK_RESULTS = [
    { urn: 'urn:li:person:123', name: 'Roberto (WRDigital)', subtitle: 'CEO' },
    { urn: 'urn:li:organization:456', name: 'Meta Ads AI', subtitle: 'Azienda IT' },
  ]

  const results = query.length > 1 ? MOCK_RESULTS.filter(r => r.name.toLowerCase().includes(query.toLowerCase())) : []

  return (
    <div style={{ position: 'relative' }}>
      <label style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
        <Users size={10} /> Ricerca e Menzione (@)
      </label>
      <input 
        value={query} 
        onChange={e => setQuery(e.target.value)}
        placeholder="Cerca profili o aziende da taggare..."
        style={{ width: '100%', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '7px', padding: '5px 9px', fontSize: '0.82rem', outline: 'none' }} 
      />
      
      {results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, marginTop: '4px', overflow: 'hidden' }}>
          {results.map(r => (
            <div 
              key={r.urn} 
              onClick={() => { onSelect(r.urn, r.name); setQuery('') }}
              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.05)', fontSize: '0.78rem' }}
            >
              <div style={{ fontWeight: 600 }}>{r.name}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{r.subtitle}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
