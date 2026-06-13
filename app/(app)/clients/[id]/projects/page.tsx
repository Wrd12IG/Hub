"use client"

import React, { Suspense } from 'react'
import { LayoutGrid } from 'lucide-react'
import { ProjectsPageContent } from '../../../projects/projects-content'

export default function ClientProjectsPage({ params }: { params: { id: string } }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '2rem 2rem 0', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <LayoutGrid size={32} color="#3b82f6" />
          Progetti
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '1rem', marginBottom: '1rem' }}>
          Visualizzazione di tutti i progetti attivi per questo cliente.
        </p>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <Suspense fallback={<div className="flex h-full items-center justify-center p-8">Caricamento Progetti...</div>}>
          <ProjectsPageContent forcedClientId={params.id} />
        </Suspense>
      </div>
    </div>
  )
}
