"use client"

import React, { Suspense } from 'react'
import { ClipboardList } from 'lucide-react'
import { TasksPageContent } from '../../../tasks/tasks-content'

export default function ClientTasksPage({ params }: { params: { id: string } }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '2rem 2rem 0', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ClipboardList size={32} color="#10b981" />
          Task & Approvazioni
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '1rem', marginBottom: '1rem' }}>
          Gestione dei task operativi e delle approvazioni specifiche per questo cliente.
        </p>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        {/* We reuse the main TasksPageContent and pass the forcedClientId so it locks the filter to this specific client */}
        <Suspense fallback={<div className="flex h-full items-center justify-center p-8">Caricamento Task Board...</div>}>
          <TasksPageContent forcedClientId={params.id} />
        </Suspense>
      </div>
    </div>
  )
}
