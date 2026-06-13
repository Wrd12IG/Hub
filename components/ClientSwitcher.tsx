"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ChevronDown, Briefcase, Building2, Search } from 'lucide-react'

import { useLayoutData } from '@/app/(app)/layout-context'

export default function ClientSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  
  const { clients } = useLayoutData()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Calcola se siamo dentro un cliente specifico
  const clientMatch = pathname.match(/^\/clients\/([^/]+)/)
  const activeClientId = clientMatch ? clientMatch[1] : null

  // Chiudi dropdown se si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activeClient = clients.find(c => c.id === activeClientId)

  const handleSelectClient = (clientId: string) => {
    setIsOpen(false)
    setSearchQuery('')
    // Seleziona il cliente e naviga alla sua Overview
    router.push(`/clients/${clientId}`)
  }

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="client-switcher-container" ref={dropdownRef} style={{ position: 'relative', width: '100%', marginBottom: '1.5rem', zIndex: 50 }}>
      {/* TRIGGER BUTTON */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent border border-sidebar-border transition-all duration-200 text-sidebar-foreground"
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className={`p-2 rounded-md ${activeClient ? 'bg-amber-500 text-white' : 'bg-sidebar-primary/10 text-sidebar-primary'}`}>
            {activeClient ? <Building2 size={16} /> : <Briefcase size={16} />}
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[0.65rem] text-sidebar-foreground/60 uppercase tracking-wider font-semibold">
              Workspace
            </span>
            <span className="text-sm font-semibold truncate max-w-[140px] text-sidebar-foreground">
              {activeClient ? activeClient.name : 'Tutti i Clienti'}
            </span>
          </div>
        </div>
        <ChevronDown size={16} className={`text-sidebar-foreground/50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* DROPDOWN MENU */}
      {isOpen && (
        <div className="absolute top-[calc(100%+0.5rem)] left-0 w-full bg-popover text-popover-foreground border border-border rounded-lg shadow-xl overflow-hidden z-50">
          {/* SEARCH BOX */}
          <div className="p-3 border-b border-border relative">
            <Search size={14} className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Cerca cliente..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-muted/50 border border-input rounded-md text-sm outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all placeholder:text-muted-foreground"
            />
          </div>

          {/* LIST */}
          <div className="max-h-[250px] overflow-y-auto p-1">
            <button
              onClick={() => {
                setIsOpen(false)
                router.push('/dashboard') // Torna alla dashboard globale
              }}
              className={`w-full text-left px-3 py-2.5 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${!activeClientId ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              <Briefcase size={14} /> Generale (Tutti i clienti)
            </button>
            
            {filteredClients.map(c => (
              <button
                key={c.id}
                onClick={() => handleSelectClient(c.id)}
                className={`w-full text-left px-3 py-2.5 rounded-md flex items-center gap-2 text-sm transition-colors ${activeClientId === c.id ? 'bg-amber-500/10 text-amber-600 font-semibold dark:text-amber-500' : 'text-muted-foreground hover:bg-muted hover:text-foreground font-medium'}`}
              >
                <Building2 size={14} /> {c.name}
              </button>
            ))}
            
            {filteredClients.length === 0 && (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Nessun cliente trovato.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
