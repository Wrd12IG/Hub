"use client"

import React, { useEffect, useMemo, useState } from "react"
import { ArrowUp, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { authFetch } from "@/lib/client-api-auth"
import { BRAND_MAX, MAX_SITES, brandsOf, type ClientSite } from "@/lib/client-sites"

interface Row { key: string; id?: string; url: string; brand: string; ga4PropertyId: string; searchConsole: string }

let counter = 0
const toRow = (s?: ClientSite): Row => ({ key: `r${++counter}`, id: s?.id, url: s?.url ?? "", brand: s?.brand ?? "", ga4PropertyId: s?.ga4PropertyId ?? "", searchConsole: s?.searchConsole ?? "" })

/**
 * «Gestisci siti»: aggiunge, modifica, toglie e riordina i siti di un cliente (di solito uno per marca), ognuno con il
 * suo Analytics e la sua Search Console. Il controllo vero lo fa il server; qui si mostra il suo messaggio.
 */
export function ClientSitesDialog({ clientId, sites, open, onOpenChange, onSaved }: {
  clientId: string
  sites: ClientSite[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (sites: ClientSite[]) => void
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ogni volta che si apre, si riparte dai siti salvati
  useEffect(() => { if (open) { setRows(sites.length ? sites.map(toRow) : [toRow()]); setError(null) } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const suggestions = useMemo(() => brandsOf(rows.map((r) => ({ id: r.key, url: r.url, brand: r.brand }))), [rows])

  const patch = (key: string, field: keyof Row, value: string) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)))
  const remove = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key))
  const moveUp = (key: string) => setRows((rs) => { const i = rs.findIndex((r) => r.key === key); if (i <= 0) return rs; const c = rs.slice(); [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c })

  const save = async () => {
    setSaving(true); setError(null)
    try {
      // Le righe vuote (nessun indirizzo e nessun ID) si ignorano: non sono un errore dell'utente
      const payload = rows.filter((r) => r.url.trim() || r.ga4PropertyId.trim() || r.searchConsole.trim())
        .map((r) => ({ id: r.id, url: r.url, brand: r.brand, ga4PropertyId: r.ga4PropertyId, searchConsole: r.searchConsole }))
      const res = await authFetch(`/api/clients/${clientId}/sites`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sites: payload }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `Il server ha risposto ${res.status}.`)
      toast.success(payload.length === 1 ? "Sito salvato" : `${payload.length} siti salvati`)
      onSaved(json.sites as ClientSite[])
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossibile salvare i siti.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Siti del cliente</DialogTitle>
          <DialogDescription>
            Un sito per riga, di solito uno per marca, ognuno con il suo Analytics e la sua Search Console. Audit SEO e monitor del sito usano il primo.
          </DialogDescription>
        </DialogHeader>

        <datalist id="client-site-brands">{suggestions.map((b) => <option key={b} value={b} />)}</datalist>

        <div className="space-y-4">
          {rows.map((r, i) => (
            <div key={r.key} className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{i === 0 ? "Sito 1 · principale" : `Sito ${i + 1}`}</p>
                <div className="flex items-center gap-1">
                  {i > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => moveUp(r.key)} aria-label={`Sposta il sito ${i + 1} in su`}><ArrowUp className="h-4 w-4" /></Button>}
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(r.key)} aria-label={`Togli il sito ${i + 1}`}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`url-${r.key}`}>Indirizzo del sito</Label>
                  <Input id={`url-${r.key}`} value={r.url} onChange={(e) => patch(r.key, "url", e.target.value)} placeholder="www.esempio.it" autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`brand-${r.key}`}>Marca (facoltativa)</Label>
                  <Input id={`brand-${r.key}`} list="client-site-brands" value={r.brand} onChange={(e) => patch(r.key, "brand", e.target.value)} maxLength={BRAND_MAX} placeholder="Es. Renault" autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`ga4-${r.key}`}>GA4 Property ID</Label>
                  <Input id={`ga4-${r.key}`} value={r.ga4PropertyId} onChange={(e) => patch(r.key, "ga4PropertyId", e.target.value)} inputMode="numeric" placeholder="345678901" autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`sc-${r.key}`}>Search Console</Label>
                  <Input id={`sc-${r.key}`} value={r.searchConsole} onChange={(e) => patch(r.key, "searchConsole", e.target.value)} placeholder="sc-domain:esempio.it" autoComplete="off" />
                </div>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, toRow()])} disabled={rows.length >= MAX_SITES}>
            <Plus className="mr-2 h-4 w-4" /> Aggiungi un sito
          </Button>
          {rows.length >= MAX_SITES && <p className="text-xs text-muted-foreground">Al massimo {MAX_SITES} siti per cliente.</p>}
          <p className="text-[11px] text-muted-foreground">Il Property ID di GA4 è un numero (GA4 → Amministrazione → Impostazioni proprietà). La Search Console è «sc-domain:esempio.it» oppure l'indirizzo completo con la barra finale.</p>
        </div>

        {error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Annulla</Button>
          <Button type="button" onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salva</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
