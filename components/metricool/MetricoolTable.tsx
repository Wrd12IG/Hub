"use client"

import React, { useMemo, useState } from 'react';
import { Download, Columns, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowDown } from 'lucide-react';
import { filterRows, sortRows, toCsv, paginate, type TableColumn } from '@/lib/table-utils';

const PAGE_SIZES = [5, 10, 20, 50];

/**
 * Tabella dati delle pagine piattaforma. Cerca, ordinamento, colonne, esportazione CSV e paginazione funzionano
 * davvero (prima erano solo grafica: la ricerca non filtrava, il CSV non scaricava, «1-5 di N» mostrava tutte le righe).
 */
export const MetricoolTable = ({
  title,
  columns,
  data,
  hideToolbar = false,
  searchPlaceholder = "Cerca",
  filename = "data.csv"
}: {
  title?: string;
  columns: TableColumn[];
  data: any[];
  hideToolbar?: boolean;
  searchPlaceholder?: string;
  filename?: string;
}) => {
  const safeData = Array.isArray(data) ? data : [];
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showColumns, setShowColumns] = useState(false);
  const [size, setSize] = useState(10);
  const [page, setPage] = useState(1);

  const visibleColumns = columns.filter((c) => !hidden.has(c.key));
  // Ordinabile se la pagina non lo vieta e la riga ha davvero quel campo (le colonne di sole azioni no)
  const isSortable = (c: TableColumn) => c.sortable ?? safeData.some((r) => r?.[c.key] !== undefined);
  const rows = useMemo(
    () => sortRows(filterRows(safeData, columns, query), sortKey, sortDir),
    [safeData, columns, query, sortKey, sortDir],
  );
  const view = paginate(rows, page, size);

  const sortBy = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
    setPage(1);
  };

  const downloadCsv = () => {
    // Si esporta ciò che si vede: righe filtrate e ordinate, colonne scelte
    const blob = new Blob([toCsv(rows, visibleColumns)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleColumn = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  return (
    <div className="mb-8">
      {title && <h2 className="text-xl font-semibold mb-6 text-foreground">{title}</h2>}

      {!hideToolbar && (
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="w-full px-4 py-2 rounded-lg border outline-none text-sm bg-background text-foreground"
            />
          </div>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-background border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download size={14} /> Scarica CSV
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColumns((v) => !v)}
              aria-expanded={showColumns}
              className="flex items-center gap-2 px-4 py-2 bg-background border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Columns size={14} /> Colonne{hidden.size > 0 ? ` (${columns.length - hidden.size}/${columns.length})` : ''}
            </button>
            {showColumns && (
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border bg-card p-2 shadow-lg">
                {columns.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!hidden.has(c.key)}
                      disabled={c.isPrimary}
                      onChange={() => toggleColumn(c.key)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border rounded-xl overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className="p-4 text-muted-foreground font-semibold whitespace-nowrap"
                    aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {isSortable(col) ? (
                      <button type="button" onClick={() => sortBy(col.key)} className="flex items-center gap-1 font-semibold hover:text-foreground cursor-pointer">
                        {col.label}
                        <ArrowDown
                          size={14}
                          className={sortKey === col.key ? `text-foreground transition-transform ${sortDir === 'asc' ? 'rotate-180' : ''}` : 'text-muted-foreground/50'}
                        />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">{col.label}</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.items.map((row, rowIdx) => (
                <tr key={rowIdx} className={`border-b transition-colors ${rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'} hover:bg-muted/50`}>
                  {visibleColumns.map((col) => (
                    <td key={col.key} className={`p-4 ${col.isPrimary ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.length} className="p-8 text-center text-muted-foreground">
                    {query ? `Nessun risultato per «${query}»` : 'Nessun dato disponibile'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end p-4 gap-6 border-t text-muted-foreground text-sm">
          <label className="flex items-center gap-2">
            Elementi per pagina:
            <select
              value={size}
              onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }}
              className="border rounded-md px-2 py-1 outline-none bg-background"
            >
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div>{view.from}-{view.to} di {rows.length}</div>
          <div className="flex gap-1">
            <button type="button" aria-label="Prima pagina" onClick={() => setPage(1)} disabled={view.page === 1} className="p-1 rounded-full hover:bg-muted disabled:opacity-30 cursor-pointer"><ChevronsLeft size={16} /></button>
            <button type="button" aria-label="Pagina precedente" onClick={() => setPage(view.page - 1)} disabled={view.page === 1} className="p-1 rounded-full hover:bg-muted disabled:opacity-30 cursor-pointer"><ChevronLeft size={16} /></button>
            <button type="button" aria-label="Pagina successiva" onClick={() => setPage(view.page + 1)} disabled={view.page === view.pages} className="p-1 rounded-full hover:bg-muted disabled:opacity-30 cursor-pointer"><ChevronRight size={16} /></button>
            <button type="button" aria-label="Ultima pagina" onClick={() => setPage(view.pages)} disabled={view.page === view.pages} className="p-1 rounded-full hover:bg-muted disabled:opacity-30 cursor-pointer"><ChevronsRight size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};
