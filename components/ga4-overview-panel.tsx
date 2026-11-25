"use client"

import React from "react";
import { cn } from "@/lib/utils";

// Numeri all'italiana, anche a quattro cifre (di default Intl «it-IT» non raggruppa 6268)
const itNum = (v: number, decimals = 0) =>
  new Intl.NumberFormat("it-IT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: "always" }).format(v);

/**
 * I numeri di Google Analytics di UN sito: traffico e acquisizione, comportamento on-site, conversioni.
 * Era scritto dentro la pagina del cliente; è un componente a parte perché ora un cliente può avere più siti e lo stesso
 * pannello serve a ciascuno. `periodLabel` è il periodo letto, per il titolo delle conversioni (es. «ultimi 30gg»).
 */
export function Ga4OverviewPanel({ ga4Data, isClient, periodLabel }: { ga4Data: any; isClient: boolean; periodLabel: string }) {
  return (
    <div className="space-y-6">
      {/* Traffic Category */}
      <div className="space-y-3">
        <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest">
          Traffico & Acquisizione
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Visite al sito",
              hint: "Quante volte il sito è stato visitato",
              metric: ga4Data.traffic?.sessions,
              format: (v: number) => itNum(v),
            },
            {
              label: "Visitatori unici",
              hint: "Ogni persona è contata una volta sola",
              metric: ga4Data.traffic?.users,
              format: (v: number) => itNum(v),
            },
            {
              label: "Nuovi visitatori",
              hint: "Al loro primo accesso al sito",
              metric: ga4Data.traffic?.newUsers,
              format: (v: number) => itNum(v),
            },
            {
              label: "Visitatori che tornano",
              hint: "Persone già venute in passato",
              metric: ga4Data.traffic?.returningUsers,
              format: (v: number) => itNum(v),
            },
          ].map((item, i) => (
            <div
              key={i}
              className="hover:bg-muted hover:border-foreground/30 p-4 rounded-xl border border-border bg-muted/40 flex flex-col justify-between min-h-[95px] shadow-sm transition-all duration-300 hover:-translate-y-0.5"
            >
              <div>
                <div className="text-xs font-bold text-muted-foreground/75 uppercase tracking-wider leading-tight">
                  {item.label}
                </div>
                {item.hint && <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground/70">{item.hint}</div>}
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-xl font-extrabold tracking-tight text-foreground">
                  {item.metric ? item.format(item.metric.val) : "0"}
                </span>
                {item.metric && (
                  <span
                    className={cn(
                      "text-xs font-extrabold px-1.5 py-0.5 rounded shadow-sm",
                      item.metric.chg > 0
                        ? "bg-emerald-500/10 text-emerald-400"
                        : item.metric.chg < 0
                          ? "bg-rose-500/10 text-rose-400"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {item.metric.chg > 0 ? "+" : ""}
                    {item.metric.chg}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Behavior Category */}
      <div className="space-y-3">
        <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest">
          Comportamento On-Site
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Abbandono immediato",
              hint: "Visite chiuse senza interagire: più è basso, meglio è",
              metric: ga4Data.behavior?.bounceRate,
              format: (v: number) => `${itNum(v, 1)}%`,
            },
            {
              label: "Visite coinvolte",
              hint: "Visite con interazioni o oltre 10 secondi",
              metric: ga4Data.behavior?.engagementRate,
              format: (v: number) => `${itNum(v, 1)}%`,
            },
            {
              label: "Pagine per visita",
              hint: "Quante pagine guarda ogni visitatore",
              metric: ga4Data.behavior?.pagesPerSession,
              format: (v: number) => itNum(v, 2),
            },
            {
              label: "Durata media visita",
              hint: "Tempo medio passato sul sito",
              metric: ga4Data.behavior?.avgSessionDuration,
              format: (v: number) => { const t = Math.round(v); return t >= 60 ? `${Math.floor(t / 60)} min ${t % 60} s` : `${t} s` },
            },
          ].map((item, i) => (
            <div
              key={i}
              className="hover:bg-muted hover:border-foreground/30 p-4 rounded-xl border border-border bg-muted/40 flex flex-col justify-between min-h-[95px] shadow-sm transition-all duration-300 hover:-translate-y-0.5"
            >
              <div>
                <div className="text-xs font-bold text-muted-foreground/75 uppercase tracking-wider leading-tight">
                  {item.label}
                </div>
                {item.hint && <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground/70">{item.hint}</div>}
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-xl font-extrabold tracking-tight text-foreground">
                  {item.metric ? item.format(item.metric.val) : "0"}
                </span>
                {item.metric && (
                  <span
                    className={cn(
                      "text-xs font-extrabold px-1.5 py-0.5 rounded shadow-sm",
                      item.metric.chg > 0
                        ? "bg-rose-500/10 text-rose-400"
                        : item.metric.chg < 0
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {item.metric.chg > 0 ? "+" : ""}
                    {item.metric.chg}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conversions Category (al Cliente non si mostra se il sito non registra azioni: uno «0» non dice niente) */}
      <div className={cn("space-y-3", isClient && !ga4Data.conversions?.totalConversions?.val && "hidden")}>
        <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest">
          Conversioni ({periodLabel} vs prec.)
        </h4>
        {(["transactions", "revenue"] as const).every(
          (k) => ga4Data.conversions?.[k]?.val === 0 && ga4Data.conversions?.[k]?.chg === 0,
        ) && (
          <p className="text-xs text-muted-foreground">
            Nessun acquisto online tracciato: acquisti e revenue non vengono mostrati. Per questo cliente il risultato
            sono i lead (vedi il riepilogo in alto).
          </p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Azioni completate",
              hint: "Contatti, richieste ed eventi chiave del sito",
              metric: ga4Data.conversions?.totalConversions,
              format: (v: number) => itNum(v),
            },
            {
              label: "Visite con azione",
              hint: "Quota di visite con almeno un'azione completata",
              metric: ga4Data.conversions?.conversionRate,
              format: (v: number) => `${itNum(v, 2)}%`,
            },
            {
              label: "Acquisti online",
              hint: "Ordini completati sul sito",
              metric: ga4Data.conversions?.transactions,
              format: (v: number) => itNum(v),
              hideIfZero: true,
            },
            {
              label: "Incasso online",
              hint: "Valore degli ordini del sito",
              metric: ga4Data.conversions?.revenue,
              format: (v: number) => `€${v.toLocaleString()}`,
              hideIfZero: true,
            },
          ]
            // Acquisti e revenue a zero in entrambi i periodi (val 0 e variazione 0): il cliente non vende online,
            // quei riquadri sono solo rumore. Il suo risultato sono i lead (vedi il riepilogo in alto).
            .filter((item: any) => !(item.hideIfZero && item.metric && item.metric.val === 0 && item.metric.chg === 0))
            .map((item, i) => (
            <div
              key={i}
              className="hover:bg-muted hover:border-foreground/30 p-4 rounded-xl border border-border bg-muted/40 flex flex-col justify-between min-h-[95px] shadow-sm transition-all duration-300 hover:-translate-y-0.5"
            >
              <div>
                <div className="text-xs font-bold text-muted-foreground/75 uppercase tracking-wider leading-tight">
                  {item.label}
                </div>
                {item.hint && <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground/70">{item.hint}</div>}
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-xl font-extrabold tracking-tight text-foreground">
                  {item.metric ? item.format(item.metric.val) : "0"}
                </span>
                {item.metric && (
                  <span
                    className={cn(
                      "text-xs font-extrabold px-1.5 py-0.5 rounded shadow-sm",
                      item.metric.chg > 0
                        ? "bg-emerald-500/10 text-emerald-400"
                        : item.metric.chg < 0
                          ? "bg-rose-500/10 text-rose-400"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {item.metric.chg > 0 ? "+" : ""}
                    {item.metric.chg}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
