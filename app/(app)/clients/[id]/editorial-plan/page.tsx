"use client"

import React, { Suspense } from 'react'
import { CalendarDays, Sparkles } from 'lucide-react'
import { EditorialPlanPageContent } from '../../../editorial-plan/client'

export default function ClientEditorialPlanPage({ params }: { params: { id: string } }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        padding: '2.5rem 2.5rem 2rem', 
        maxWidth: '1400px', 
        margin: '0 auto', 
        width: '100%',
        background: 'linear-gradient(135deg, rgba(236,72,153,0.05) 0%, rgba(244,63,94,0.01) 100%)',
        borderBottom: '1px solid rgba(236,72,153,0.1)',
        borderBottomLeftRadius: '24px',
        borderBottomRightRadius: '24px',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(244,63,94,0.15))', padding: '0.4rem 1rem', borderRadius: '20px', marginBottom: '1rem', border: '1px solid rgba(236,72,153,0.2)' }}>
              <Sparkles size={14} color="#ec4899" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ec4899', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Content Engine</span>
            </div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem', letterSpacing: '-0.5px' }}>
              <CalendarDays size={36} color="#ec4899" />
              Piano Editoriale
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', fontSize: '1.1rem', maxWidth: '600px', lineHeight: 1.5 }}>
              Visualizzazione unificata per la gestione dei contenuti, canali e programmazione dedicata esclusivamente a questo progetto.
            </p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', padding: '0 2.5rem' }}>
        <Suspense fallback={<div className="flex h-full items-center justify-center p-8">Caricamento Piano Editoriale...</div>}>
          <EditorialPlanPageContent forcedClientId={params.id} />
        </Suspense>
      </div>
    </div>
  )
}
