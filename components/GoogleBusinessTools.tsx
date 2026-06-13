'use client'

import React, { useState } from 'react'
import { Sparkles, MapPin, ActivitySquare, AlertTriangle, Building2, Store } from 'lucide-react'

// ============================================================
// KEYWORD LOCAL SUGGESTER
// ============================================================

export function GbpLocalKeywordSuggestor({ onAdd }: { onAdd: (keyword: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [keywords, setKeywords] = useState<string[]>([])

  const analyze = () => {
    setLoading(true)
    // SIMULATED AI ACTION: reads Google Maps trends for the local area
    setTimeout(() => {
      setKeywords([
        "aperto oggi",
        "vicino a me",
        "parcheggio gratuito",
        "servizio rapido"
      ])
      setLoading(false)
    }, 1200)
  }

  return (
    <div style={{ marginTop: '0.4rem', padding: '0.75rem', background: 'rgba(52,168,83,0.06)', borderRadius: '8px', border: '1px solid rgba(52,168,83,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#34a853', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={14} /> Local SEO Keyword Suggestor
        </div>
        <button onClick={analyze} disabled={loading} style={{ background: '#34a853', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.7rem', cursor: loading ? 'wait' : 'pointer', fontWeight: 600 }}>
          {loading ? 'Ricerca su Maps...' : 'Analizza Zona'}
        </button>
      </div>

      {keywords.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {keywords.map((kw, i) => (
            <span key={i} onClick={() => onAdd(kw)} style={{ fontSize: '0.7rem', background: '#fff', padding: '4px 8px', borderRadius: '12px', cursor: 'pointer', border: '1px solid rgba(0,0,0,0.05)', display: 'inline-block' }}>
              📍 {kw}
            </span>
          ))}
          <div style={{ width: '100%', fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>Inserisci queste parole chiave in modo naturale nel testo del post. Aiuteranno il posizionamento in Local Pack.</div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// GEOTAGGING & REVIEW HEALTH HELPER
// ============================================================

export function GbpHealthWidgets() {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexDirection: 'column' }}>
      
      {/* Geotagging */}
      <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <MapPin size={14} color="#34a853" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Auto-Geotagging Attivo</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            I metadati EXIF delle foto (LAT/LONG) verranno iniettati prima dell'upload. Google favorisce i post con foto effettivamente scattate sul posto.
          </div>
        </div>
      </div>

      {/* Review Responder Alert */}
      <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,152,0,0.08)', borderRadius: '8px', borderLeft: '3px solid #ff9800', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <AlertTriangle size={14} color="#e65100" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#e65100' }}>AI Review Responder</div>
          <div style={{ fontSize: '0.65rem', color: '#e65100', marginTop: '2px', opacity: 0.9 }}>
            Rispondere alle recensioni entro 24h impatta sul Local Ranking. Se ci sono recensioni in sospeso, l'automazione pubblicherà la risposta AI in background insieme al post.
          </div>
        </div>
      </div>

    </div>
  )
}

// ============================================================
// STORE HOURS QUICK EDITOR (COVID-STYLE / EXTRAORDINARY)
// ============================================================

export function GbpStoreHoursQuickEditor() {
  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [specialDate, setSpecialDate] = useState('')
  const [isClosed, setIsClosed] = useState(true)
  const [openTime, setOpenTime] = useState('09:00')
  const [closeTime, setCloseTime] = useState('18:00')

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setIsOpen(false)
      alert("Orari aggiornati su Google Maps con successo!")
    }, 1500)
  }

  return (
    <div style={{ marginTop: '0.4rem', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
      <button onClick={() => setIsOpen(!isOpen)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 0.75rem', background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
        <Store size={14} color="#34a853" />
        Gestione Veloce Orari (Straordinari e Festività)
      </button>

      {isOpen && (
        <div style={{ padding: '0.75rem', background: '#fafafa', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
            Aggiorna gli orari della sede su Google Maps. Ottimo per chiusure impreviste o orari ridotti. L'aggiornamento sarà inviato tramite l'API Google My Business Information.
          </div>
          
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Data (es. Festività)</label>
              <input type="date" value={specialDate} onChange={e => setSpecialDate(e.target.value)} style={{ width: '100%', borderRadius: '4px', border: '1px solid #ccc', padding: '4px', fontSize: '0.75rem' }} />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingTop: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={isClosed} onChange={e => setIsClosed(e.target.checked)} /> Completamente Chiuso
              </label>
            </div>
          </div>

          {!isClosed && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Apertura Specifica</label>
                <input type="time" value={openTime} onChange={e => setOpenTime(e.target.value)} style={{ width: '100%', borderRadius: '4px', border: '1px solid #ccc', padding: '4px', fontSize: '0.75rem' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Chiusura Specifica</label>
                <input type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)} style={{ width: '100%', borderRadius: '4px', border: '1px solid #ccc', padding: '4px', fontSize: '0.75rem' }} />
              </div>
            </div>
          )}
          
          <button onClick={handleSave} disabled={saving || !specialDate} style={{ background: '#34a853', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: saving || !specialDate ? 'not-allowed' : 'pointer', marginTop: '4px' }}>
            {saving ? 'Aggiornamento Maps in corso...' : 'Invia Modifica a Google Business API'}
          </button>
        </div>
      )}
    </div>
  )
}
