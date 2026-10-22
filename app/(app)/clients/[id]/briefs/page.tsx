"use client"

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ClientBriefsView } from '@/components/client-briefs-view'
import { useLayoutData } from '@/app/(app)/layout-context'

/** Il cliente richiede una lavorazione e vede lo stato delle sue richieste. Lo staff usa la pagina Brief generale. */
export default function ClientBriefsPage({ params }: { params: { id: string } }) {
  const { currentUser, isLoadingLayout } = useLayoutData()
  const router = useRouter()
  const isClient = currentUser?.role === 'Cliente'

  useEffect(() => {
    if (!isLoadingLayout && currentUser && !isClient) router.replace('/briefs')
  }, [isLoadingLayout, currentUser, isClient, router])

  if (isLoadingLayout || !currentUser || !isClient) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Caricamento…</div>
  return <ClientBriefsView clientId={params.id} />
}
