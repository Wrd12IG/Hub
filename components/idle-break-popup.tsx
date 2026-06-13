"use client"

import React, { useState, useEffect } from 'react'
import { Coffee, Utensils, Phone, Clock, X } from 'lucide-react'
import { useIdleDetection } from '@/hooks/useIdleDetection'

type BreakType = 'caffè' | 'pranzo' | 'meeting' | 'altro'

interface BreakLog {
  type: BreakType
  startedAt: Date
  endedAt?: Date
  minutes?: number
}

const BREAK_OPTIONS: { type: BreakType; icon: React.ElementType; label: string; color: string }[] = [
  { type: 'caffè', icon: Coffee, label: 'Pausa Caffè ☕', color: '#f59e0b' },
  { type: 'pranzo', icon: Utensils, label: 'Pausa Pranzo 🍽️', color: '#22c55e' },
  { type: 'meeting', icon: Phone, label: 'Meeting 📞', color: '#6366f1' },
  { type: 'altro', icon: Clock, label: 'Altro', color: '#94a3b8' },
]

interface IdleBreakPopupProps {
  idleMinutes?: number
  onBreakLogged?: (log: BreakLog) => void
}

export function IdleBreakPopup({ idleMinutes = 5, onBreakLogged }: IdleBreakPopupProps) {
  const { isIdle, resetIdle } = useIdleDetection(idleMinutes)
  const [isOpen, setIsOpen] = useState(false)
  const [activeBreak, setActiveBreak] = useState<BreakLog | null>(null)
  const [elapsed, setElapsed] = useState(0)

  // Show the popup as soon as idle is detected
  useEffect(() => {
    if (isIdle) {
      setIsOpen(true)
    }
  }, [isIdle])

  // Elapsed timer
  useEffect(() => {
    if (!activeBreak || activeBreak.endedAt) return
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - activeBreak.startedAt.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [activeBreak])

  const handleSelectBreak = (type: BreakType) => {
    setActiveBreak({ type, startedAt: new Date() })
  }

  const handleEndBreak = () => {
    if (!activeBreak) return
    const endedAt = new Date()
    const minutes = Math.round((endedAt.getTime() - activeBreak.startedAt.getTime()) / 60000)
    const completed = { ...activeBreak, endedAt, minutes }
    onBreakLogged?.(completed)
    setActiveBreak(null)
    setElapsed(0)
    setIsOpen(false)
    resetIdle()
  }

  const handleDismiss = () => {
    // If there was an active break that wasn't submitted but dismissed
    if (activeBreak && !activeBreak.endedAt) {
      const endedAt = new Date()
      const minutes = Math.round((endedAt.getTime() - activeBreak.startedAt.getTime()) / 60000)
      onBreakLogged?.({ ...activeBreak, endedAt, minutes })
    }
    setActiveBreak(null)
    setElapsed(0)
    setIsOpen(false)
    resetIdle()
  }

  if (!isOpen) return null

  const formatElapsed = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div
      data-testid="idle-break-popup"
      style={{
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        width: 320,
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        padding: '1.5rem',
        zIndex: 9999,
        border: '1px solid rgba(0,0,0,0.08)',
        animation: 'slideUp 0.3s ease',
      }}
    >
      <button
        onClick={handleDismiss}
        aria-label="Chiudi"
        style={{ position: 'absolute', top: '1rem', right: '1rem', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}
      >
        <X size={18} />
      </button>

      {!activeBreak ? (
        <>
          <p style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.25rem' }}>Sei in pausa? 🤔</p>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1.25rem' }}>Nessuna attività rilevata negli ultimi {idleMinutes} minuti.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {BREAK_OPTIONS.map(({ type, icon: Icon, label, color }) => (
              <button
                key={type}
                onClick={() => handleSelectBreak(type)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 1rem', borderRadius: 12,
                  border: `1px solid ${color}30`, background: `${color}08`,
                  color, fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Icon size={18} /> {label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.25rem' }}>
            {BREAK_OPTIONS.find(b => b.type === activeBreak.type)?.label}
          </p>
          <p style={{ fontSize: '2rem', fontWeight: 800, margin: '0.5rem 0', color: '#6366f1', fontVariantNumeric: 'tabular-nums' }}>
            {formatElapsed(elapsed)}
          </p>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 1rem' }}>Pausa in corso...</p>
          <button
            onClick={handleEndBreak}
            style={{ width: '100%', padding: '0.75rem', borderRadius: 12, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
          >
            Torna al Lavoro ✅
          </button>
        </>
      )}
    </div>
  )
}
