'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { useLayoutData } from '@/app/(app)/layout-context'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Building2, Globe, Search, ArrowRight, PlusCircle } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { AnimatedGrid, AnimatedGridItem } from '@/components/AnimatedGrid'

export default function ClientsPage() {
  const { clients, isLoadingLayout } = useLayoutData()
  const [search, setSearch] = useState('')

  const filteredClients = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = clients as any[]
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.industry || '').toLowerCase().includes(search.toLowerCase())
    )
  }, [clients, search])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline">Clienti</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isLoadingLayout ? '…' : `${clients?.length ?? 0} clienti totali`}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca cliente..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Clients Grid */}
      {isLoadingLayout ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl border-dashed gap-3">
          <Building2 className="h-12 w-12 text-muted-foreground/40" />
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">
              {search ? 'Nessun risultato' : 'Nessun cliente ancora'}
            </h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              {search
                ? `Nessun cliente corrisponde a "${search}". Prova con un altro termine.`
                : 'Aggiungi il primo cliente per iniziare a gestire i tuoi progetti e task.'}
            </p>
          </div>
          {!search && (
            <Link href="/clients/new">
              <Button size="sm" className="gap-1.5 mt-1">
                <PlusCircle className="h-4 w-4" />
                Aggiungi cliente
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <AnimatedGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredClients.map((client) => (
            <AnimatedGridItem key={client.id}>
              <Link
                href={`/clients/${client.id}`}
                className="group block h-full"
              >
                <div
                  className={cn(
                    'relative h-full rounded-xl p-5 flex flex-col gap-3 glass-card glass-card-shine',
                    'hover:border-primary/30'
                  )}
                >
                  {/* Avatar + Name */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          style={{ backgroundColor: (client as any).color || undefined }}
                          className="text-white text-sm font-semibold"
                        >
                          {getInitials(client.name)}
                        </AvatarFallback>
                      </Avatar>
                      <h2 className="font-semibold text-base leading-tight truncate">
                        {client.name}
                      </h2>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* Details */}
                  <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(client as any).websiteUrl && (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Globe className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(client as any).websiteUrl.replace(/^https?:\/\//, '')}
                        </span>
                      </div>
                    )}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(client as any).industry && (
                      <div className="mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(client as any).industry}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </AnimatedGridItem>
          ))}
        </AnimatedGrid>
      )}
    </div>
  )
}
