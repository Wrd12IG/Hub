"use client"

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { MetricoolTable } from '@/components/metricool/MetricoolTable';
import { formatEuro } from '@/lib/format';
import type { BreakdownRow } from '@/lib/meta-breakdown';

type ViewId = 'ads' | 'age' | 'region';

interface Payload {
  rows: BreakdownRow[];
  conversionLabel: string | null;
}

type State = { status: 'loading' } | { status: 'error'; message: string } | ({ status: 'ready' } & Payload);

const VIEWS: { id: ViewId; label: string; title: string; endpoint: string; filename: string }[] = [
  { id: 'ads', label: 'Per annuncio', title: 'Risultati per annuncio', endpoint: 'ads', filename: 'meta_ads_annunci.csv' },
  { id: 'age', label: 'Età e genere', title: 'Risultati per fascia d\'età e genere', endpoint: 'audience?view=age', filename: 'meta_ads_eta_genere.csv' },
  { id: 'region', label: 'Zona', title: 'Risultati per zona', endpoint: 'audience?view=region', filename: 'meta_ads_zona.csv' },
];

const nf = (digits: number) => new Intl.NumberFormat('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: 'always' });
const int = (n: number | null | undefined) => (n == null ? '—' : nf(0).format(n));
const euro = (n: number | null | undefined) => (n == null ? '—' : formatEuro(n));
const pct = (n: number | null | undefined) => (n == null ? '—' : `${nf(2).format(n)}%`);
const dec = (n: number | null | undefined) => (n == null ? '—' : nf(2).format(n));

/**
 * Tre viste di dettaglio dei dati Meta: per annuncio, per fascia d'età e genere, per zona.
 * Ogni lettura è lenta (8-20 s): nulla parte finché l'utente non apre la vista, e ogni vista si legge una volta sola
 * per periodo (il cambio periodo o «Aggiorna» svuota le viste già lette e rilegge solo quella aperta).
 */
export function MetaBreakdownSection({ clientId, days, reloadKey }: { clientId: string; days: number; reloadKey: number }) {
  const [active, setActive] = useState<ViewId | null>(null);
  const [states, setStates] = useState<Partial<Record<ViewId, State>>>({});
  const lastReload = useRef(reloadKey);
  const requested = useRef<Set<string>>(new Set());

  const load = useCallback(async (view: ViewId, refresh: boolean) => {
    const v = VIEWS.find((x) => x.id === view)!;
    const sep = v.endpoint.includes('?') ? '&' : '?';
    setStates((s) => ({ ...s, [view]: { status: 'loading' } }));
    try {
      const res = await fetch(`/api/clients/${clientId}/meta-ads/${v.endpoint}${sep}days=${days}${refresh ? '&refresh=1' : ''}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Il server ha risposto ${res.status}.`);
      setStates((s) => ({ ...s, [view]: { status: 'ready', rows: Array.isArray(data.rows) ? data.rows : [], conversionLabel: data.conversionLabel ?? null } }));
    } catch (e: any) {
      setStates((s) => ({ ...s, [view]: { status: 'error', message: e.message } }));
    }
  }, [clientId, days]);

  // Cambio periodo o «Aggiorna»: le viste già lette non valgono più; si rilegge solo quella aperta.
  useEffect(() => {
    const refresh = lastReload.current !== reloadKey;
    lastReload.current = reloadKey;
    requested.current = new Set();
    setStates({});
    if (active) {
      requested.current.add(active);
      load(active, refresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, reloadKey, clientId]);

  const open = (view: ViewId) => {
    setActive(view);
    if (!requested.current.has(view)) {
      requested.current.add(view);
      load(view, false);
    }
  };

  const view = VIEWS.find((v) => v.id === active);
  const state = active ? states[active] : undefined;

  return (
    <div className="pt-4 border-t border-border">
      <h2 className="text-xl font-semibold tracking-tight mb-1">Dettaglio</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Scegli una vista per leggerla: ogni scomposizione richiede qualche secondo e viene caricata solo quando la apri.
      </p>

      <div className="flex flex-wrap gap-2 mb-4" role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={active === v.id}
            onClick={() => open(v.id)}
            className={`text-sm px-3 py-2 rounded-lg border transition-colors ${active === v.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {!view && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground">Nessuna vista aperta.</p>
        </div>
      )}

      {view && (!state || state.status === 'loading') && (
        <div className="bg-card border border-border rounded-xl p-8 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="animate-spin" size={18} /> Leggo i dati, possono servire fino a 20 secondi…
        </div>
      )}

      {view && state?.status === 'error' && (
        <div className="bg-card border border-border rounded-xl p-6 flex items-start gap-3 text-destructive">
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Non riesco a leggere questa vista.</p>
            <p className="text-sm">{state.message}</p>
            <button onClick={() => load(view.id, true)} className="mt-3 text-sm px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted">Riprova</button>
          </div>
        </div>
      )}

      {view && state?.status === 'ready' && <ReadyView view={view.id} title={view.title} filename={view.filename} payload={state} />}
    </div>
  );
}

function ReadyView({ view, title, filename, payload }: { view: ViewId; title: string; filename: string; payload: Payload }) {
  const { rows, conversionLabel } = payload;
  const unit = (conversionLabel || 'conversione').toLowerCase();

  if (rows.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <p className="text-muted-foreground">Nessun dato per questo periodo: nessuna riga con spesa o impression.</p>
      </div>
    );
  }

  const metricColumns = [
    { key: 'spend', label: 'Spesa', sortable: true, render: (r: BreakdownRow) => euro(r.spend), csv: (r: BreakdownRow) => r.spend },
    { key: 'impressions', label: 'Impression', sortable: true, render: (r: BreakdownRow) => int(r.impressions) },
    { key: 'clicks', label: 'Click', sortable: true, render: (r: BreakdownRow) => int(r.clicks) },
    { key: 'ctr', label: 'CTR', sortable: true, render: (r: BreakdownRow) => pct(r.ctr), csv: (r: BreakdownRow) => r.ctr },
    { key: 'cpc', label: 'CPC', sortable: true, render: (r: BreakdownRow) => euro(r.cpc), csv: (r: BreakdownRow) => r.cpc },
    { key: 'conversions', label: conversionLabel || 'Lead', sortable: true, render: (r: BreakdownRow) => int(r.conversions) },
    { key: 'costPerConversion', label: `Costo per ${unit}`, sortable: true, render: (r: BreakdownRow) => euro(r.costPerConversion), csv: (r: BreakdownRow) => r.costPerConversion },
  ];

  const first =
    view === 'ads'
      ? [
          { key: 'label', label: 'Annuncio', isPrimary: true, sortable: true, render: (r: BreakdownRow) => <span className="font-medium text-foreground">{r.label}</span> },
          { key: 'detail', label: 'Campagna', sortable: true, render: (r: BreakdownRow) => r.detail || '—' },
        ]
      : view === 'age'
        ? [
            { key: 'label', label: 'Fascia d\'età', isPrimary: true, sortable: true, render: (r: BreakdownRow) => <span className="font-medium text-foreground">{r.label}</span> },
            { key: 'detail', label: 'Genere', sortable: true, render: (r: BreakdownRow) => r.detail || '—' },
          ]
        : [{ key: 'label', label: 'Regione', isPrimary: true, sortable: true, render: (r: BreakdownRow) => <span className="font-medium text-foreground">{r.label}</span> }];

  const columns =
    view === 'ads'
      ? [...first, ...metricColumns, { key: 'frequency', label: 'Frequenza', sortable: true, render: (r: BreakdownRow) => dec(r.frequency), csv: (r: BreakdownRow) => r.frequency }]
      : [...first, ...metricColumns];

  return (
    <div>
      <MetricoolTable title={title} columns={columns} data={rows} filename={filename} searchPlaceholder="Cerca…" />
      <div className="text-xs text-muted-foreground space-y-1 -mt-4">
        <p>
          Le conversioni sono quelle scelte per tutta la pagina: se l'account registra acquisti si contano quelli, altrimenti l'azione con più volume
          {conversionLabel ? <> (qui: <strong className="text-foreground">{conversionLabel.toLowerCase()}</strong>)</> : null}. CTR, CPC e costi sono ricalcolati dai totali di ogni riga; «—» significa che il divisore è zero.
        </p>
        {view === 'region' && (
          <p>
            {rows.length === 1 ? `Nel periodo gli annunci sono stati mostrati solo in ${rows[0].label}. ` : ''}
            Il dettaglio per città non è disponibile: la fonte dati non lo fornisce per questo account.
          </p>
        )}
        {view === 'age' && <p>Le persone «non specificato» sono quelle di cui Meta non conosce età o genere.</p>}
      </div>
    </div>
  );
}
