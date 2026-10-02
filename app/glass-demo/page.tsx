'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';

/* =============================================================================
   HUB × LIQUID GLASS — pagina di esempio
   Il linguaggio vetro applicato a una dashboard reale dell'Hub: stessi widget,
   stessi clienti, stesso accento ambra del design system Precision Industrial.
   Rotta isolata, dati finti: non tocca nulla dell'app.
============================================================================= */

const INK = '#1e232b';
const MUTED = '#67707d';
const AMBER = '#f5c518';

/* --- guscio di vetro: bordo spesso, smusso in alto, rifrazione in basso ---- */
function shell(radius: number): React.CSSProperties {
  return {
    position: 'relative',
    borderRadius: radius,
    /* niente tinta piena: solo un velo, piu' chiaro sui bordi dove la luce
       entra di taglio. Quello che sta dietro deve passare. */
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.56) 0%, rgba(255,255,255,0.3) 14%, rgba(255,255,255,0.26) 86%, rgba(255,255,255,0.46) 100%)',
    /* la saturazione e' cio' che rende il vetro vivo invece che sporco */
    backdropFilter: 'blur(18px) saturate(2.1)',
    WebkitBackdropFilter: 'blur(18px) saturate(2.1)',
    border: '1px solid rgba(255,255,255,0.55)',
    boxShadow: [
      '0 1px 2px rgba(22,34,54,0.06)',
      '0 12px 28px -18px rgba(22,34,54,0.3)',
      'inset 0 1px 0 rgba(255,255,255,0.9)',
      'inset 0 -1px 0 rgba(255,255,255,0.4)',
      'inset 0 0 0 1px rgba(255,255,255,0.18)',
    ].join(','),
  };
}

/* --- superficie interna ---------------------------------------------------- */
function pool(radius: number): React.CSSProperties {
  return { position: 'relative', borderRadius: radius };
}

/* --- lo spessore del vetro, visto sotto e in trasparenza ------------------- */
const Edge = (_: { radius: number; depth?: number }) => null;

const Caustic = ({ style, tone }: { style: React.CSSProperties; tone?: string }) => (
  <div
    aria-hidden
    className="pointer-events-none absolute"
    style={{
      zIndex: -1,
      filter: 'blur(13px)',
      background:
        tone ?? 'radial-gradient(62% 62% at 50% 50%, rgba(245,197,24,0.3) 0%, rgba(150,200,255,0.18) 55%, rgba(255,255,255,0) 86%)',
      ...style,
    }}
  />
);

const Gloss = () => null;

const rise = (i: number) => ({
  initial: { opacity: 0, y: 24, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 0.7, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] as const },
});

/* ---------------------------------------------------------------- dati finti */
const KPI = [
  { label: 'Task attivi', value: '47', delta: '+6', up: true, spark: [8, 11, 9, 14, 12, 17, 19] },
  { label: 'Task scaduti', value: '3', delta: '−4', up: true, spark: [9, 8, 7, 6, 5, 4, 3] },
  { label: 'Progetti attivi', value: '12', delta: '+1', up: true, spark: [7, 8, 8, 9, 10, 11, 12] },
  { label: 'Ore settimana', value: '31,5', delta: '−2,0', up: false, spark: [6, 7, 7, 6, 5, 5, 4] },
];

const CLIENTI = [
  { nome: 'City Motors Toyota', canali: 'Meta · Google Ads · GA4', salute: 82, stato: 'ok' },
  { nome: 'Dalma Srl', canali: 'Google Ads · GBP', salute: 41, stato: 'critico' },
  { nome: 'Yeppon', canali: 'Klaviyo · GA4 · Awin', salute: 68, stato: 'attenzione' },
  { nome: 'Help Computer', canali: 'Shopify · SMS', salute: 90, stato: 'ok' },
  { nome: 'Centrocarcazzaro', canali: 'Meta · GBP', salute: 74, stato: 'ok' },
];

const TASK = [
  { titolo: 'RSA da ricostruire su Windsor', cliente: 'Dalma Srl', stato: 'In corso', scadenza: 'Oggi', chi: 'RC' },
  { titolo: 'Piano editoriale ottobre', cliente: 'City Motors Toyota', stato: 'In revisione', scadenza: 'Domani', chi: 'MB' },
  { titolo: 'Flow SMS post-acquisto', cliente: 'Help Computer', stato: 'Da fare', scadenza: '3 ott', chi: 'RC' },
  { titolo: 'Audit funnel + Meta', cliente: 'Minta Maison', stato: 'Bloccato', scadenza: '4 ott', chi: 'SG' },
];

const STATO_COLORE: Record<string, { bg: string; ink: string }> = {
  'In corso': { bg: 'linear-gradient(180deg, #7ad3ff 0%, #3ba6e8 100%)', ink: '#06324f' },
  'In revisione': { bg: 'linear-gradient(180deg, #ffd95c 0%, #f5c518 100%)', ink: '#4a3800' },
  'Da fare': { bg: 'linear-gradient(180deg, #e6ecf5 0%, #cdd7e6 100%)', ink: '#3c4654' },
  Bloccato: { bg: 'linear-gradient(180deg, #ff9a8d 0%, #ef5f4c 100%)', ink: '#5c1208' },
};

function Spark({ data, positive }: { data: number[]; positive: boolean }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 64;
      const y = 22 - ((v - min) / Math.max(1, max - min)) * 18;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width="64" height="24" viewBox="0 0 64 24" fill="none" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={positive ? '#1fae7a' : '#e2663f'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const MESI = ['Lug', 'Ago', 'Set', 'Ott'];
const SERIE = [
  { g: 'Lun', task: 7, ore: 6.5 },
  { g: 'Mar', task: 11, ore: 7.5 },
  { g: 'Mer', task: 9, ore: 6 },
  { g: 'Gio', task: 14, ore: 8 },
  { g: 'Ven', task: 6, ore: 3.5 },
];

export default function GlassHubDemo() {
  const [periodo, setPeriodo] = useState('Settimana');

  return (
    <div
      className="relative min-h-screen w-full px-5 py-10 sm:px-8"
      style={{
        background: '#dfe4ea',
        overflowX: 'clip',
        color: INK,
        fontFamily: 'var(--font-jakarta), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(38% 30% at 10% 6%, rgba(255,205,70,0.34) 0%, rgba(255,205,70,0) 72%), radial-gradient(40% 32% at 94% 10%, rgba(110,185,255,0.32) 0%, rgba(110,185,255,0) 74%), radial-gradient(44% 34% at 90% 92%, rgba(255,140,170,0.26) 0%, rgba(255,140,170,0) 76%), radial-gradient(42% 32% at 8% 88%, rgba(110,220,185,0.26) 0%, rgba(110,220,185,0) 76%), radial-gradient(78% 56% at 50% 46%, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.3) 55%, rgba(255,255,255,0) 78%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-multiply"
        style={{
          opacity: 0.2,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-[1180px] flex-col gap-7">
        {/* ======================= BARRA SUPERIORE ======================= */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-4"
          style={{ ...shell(999), position: 'sticky', top: 16, zIndex: 30, height: 74, padding: 9 }}
        >
          <Edge radius={999} depth={11} />
          <Caustic style={{ left: '30%', right: '18%', bottom: -10, height: 20, borderRadius: 999, opacity: 0.35 }} />

          <div className="flex h-full w-full items-center gap-3 px-2" style={pool(999)}>
            <span
              className="ml-2 shrink-0"
              style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}
            >
              W<span style={{ color: AMBER }}>[r]</span>Digital <span style={{ fontWeight: 500, color: MUTED }}>HUB</span>
            </span>

            {/* segmented control */}
            <div className="ml-3 hidden items-center gap-1 rounded-full p-1 sm:flex" style={{ background: 'rgba(255,255,255,0.45)', boxShadow: 'inset 0 0 0 1px rgba(150,168,195,0.22)' }}>
              {['Oggi', 'Settimana', 'Mese'].map((p) => {
                const on = p === periodo;
                return (
                  <button
                    key={p}
                    onClick={() => setPeriodo(p)}
                    className="relative rounded-full px-3.5 py-1.5 transition-colors"
                    style={{
                      fontSize: 13.5,
                      fontWeight: on ? 600 : 500,
                      color: on ? '#4a3800' : MUTED,
                      background: on ? 'linear-gradient(180deg, #ffdf6e 0%, #f5c518 100%)' : 'transparent',
                      boxShadow: on ? 'inset 0 1px 0 rgba(255,255,255,0.65), 0 1px 3px -1px rgba(190,145,0,0.45)' : 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <div className="ml-auto flex items-center gap-2.5 pr-1">
              <span className="hidden text-right md:block" style={{ fontSize: 13, color: MUTED, whiteSpace: 'nowrap' }}>
                mercoledì 1 ottobre
              </span>
              <span
                className="grid place-items-center"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background: 'radial-gradient(circle at 34% 24%, #ffffff 0%, #eef2f8 55%, #d6dde8 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 6px -3px rgba(20,40,70,0.3)',
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: INK,
                }}
              >
                RC
              </span>
            </div>
          </div>
        </motion.div>

        {/* ======================= INTESTAZIONE ======================= */}
        <motion.div {...rise(1)} className="flex flex-wrap items-end justify-between gap-4 px-1">
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
              Buongiorno, Roberto
            </h1>
            <p style={{ fontSize: 15.5, color: MUTED, marginTop: 6 }}>
              3 task scadono oggi · 2 clienti chiedono attenzione
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative transition-transform active:scale-[0.985]" style={{ ...shell(999), height: 54, padding: 7 }}>
              <Edge radius={999} depth={9} />
              <Caustic style={{ left: '10%', right: '-2%', bottom: -9, height: 20, borderRadius: 999, opacity: 0.55 }} />
              <span className="flex h-full items-center justify-center px-6" style={pool(999)}>
                <span style={{ fontSize: 15, fontWeight: 500, whiteSpace: 'nowrap' }}>Report cliente</span>
              </span>
            </button>

            <button className="relative transition-transform active:scale-[0.985]" style={{ ...shell(999), height: 54, padding: 7 }}>
              <Edge radius={999} depth={9} />
              <Caustic
                tone="radial-gradient(62% 62% at 50% 50%, rgba(255,200,40,0.85) 0%, rgba(255,170,60,0.55) 40%, rgba(255,255,255,0) 82%)"
                style={{ left: '6%', right: '-2%', bottom: -10, height: 24, borderRadius: 999 }}
              />
              <span
                className="relative flex h-full items-center justify-center overflow-hidden px-7"
                style={{
                  borderRadius: 999,
                  background: 'linear-gradient(180deg, #ffd43f 0%, #f5c518 100%)',
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(120,86,0,0.18), 0 8px 18px -10px rgba(190,145,0,0.6)',
                }}
              >
                <Gloss />
                <span style={{ position: 'relative', fontSize: 15, fontWeight: 600, color: '#3d2e00', whiteSpace: 'nowrap' }}>
                  Nuovo task
                </span>
              </span>
            </button>
          </div>
        </motion.div>

        {/* ======================= KPI ======================= */}
        <motion.div {...rise(2)} className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {KPI.map((k, i) => (
            <div key={k.label} className="relative" style={{ ...shell(28), padding: 9 }}>
              <Edge radius={28} depth={9} />
              <Caustic
                style={{
                  left: i % 2 ? '8%' : '34%',
                  right: i % 2 ? '34%' : '2%',
                  bottom: -10,
                  height: 20,
                  borderRadius: 30,
                  opacity: 0.32,
                }}
              />
              <div className="flex h-full flex-col gap-3 px-4 py-4" style={pool(21)}>
                <span style={{ fontSize: 13, fontWeight: 500, color: MUTED, letterSpacing: '0.01em' }}>{k.label}</span>
                <div className="flex items-end justify-between gap-2">
                  <span
                    style={{
                      fontSize: 34,
                      fontWeight: 600,
                      letterSpacing: '-0.03em',
                      lineHeight: 1,
                      fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
                    }}
                  >
                    {k.value}
                  </span>
                  <Spark data={k.spark} positive={k.up} />
                </div>
                <span
                  className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: k.up ? '#0e7352' : '#a33c1c',
                    background: k.up ? 'rgba(31,174,122,0.14)' : 'rgba(226,102,63,0.14)',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.6)',
                  }}
                >
                  {k.delta}{' '}
                  <span className="hidden sm:inline" style={{ fontWeight: 500, opacity: 0.75, whiteSpace: 'nowrap' }}>
                    vs sett. scorsa
                  </span>
                </span>
              </div>
            </div>
          ))}
        </motion.div>

        {/* ======================= GRIGLIA PRINCIPALE ======================= */}
        <motion.div {...rise(3)} className="grid grid-cols-1 gap-5 lg:grid-cols-[1.55fr_1fr]">
          {/* ---- andamento ---- */}
          <div className="relative" style={{ ...shell(32), padding: 11 }}>
            <Edge radius={32} depth={14} />
            <Caustic style={{ left: '28%', right: '-2%', bottom: -13, height: 28, borderRadius: 36, opacity: 0.42 }} />
            <div className="flex h-full flex-col gap-6 px-6 py-6" style={pool(23)}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>Andamento attività</h2>
                  <p style={{ fontSize: 13.5, color: MUTED, marginTop: 4 }}>Task chiusi e ore registrate · questa settimana</p>
                </div>
                <div className="flex items-center gap-4" style={{ fontSize: 12.5, color: MUTED }}>
                  <span className="inline-flex items-center gap-1.5">
                    <i style={{ width: 9, height: 9, borderRadius: 3, background: AMBER, display: 'inline-block' }} /> Task
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i style={{ width: 9, height: 9, borderRadius: 3, background: '#7fb8e8', display: 'inline-block' }} /> Ore
                  </span>
                </div>
              </div>

              <div className="mt-auto flex items-end justify-between gap-3">
                {SERIE.map((d) => (
                  <div key={d.g} className="flex flex-1 flex-col items-center gap-2.5">
                    <div className="flex w-full items-end justify-center gap-1.5" style={{ height: 210 }}>
                      <div
                        style={{
                          width: '34%',
                          height: `${(d.task / 15) * 100}%`,
                          borderRadius: '7px 7px 3px 3px',
                          background: 'linear-gradient(180deg, #ffe275 0%, #f5c518 55%, #daa800 100%)',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55)',
                        }}
                      />
                      <div
                        style={{
                          width: '34%',
                          height: `${(d.ore / 10) * 100}%`,
                          borderRadius: '7px 7px 3px 3px',
                          background: 'linear-gradient(180deg, #bfe0f8 0%, #8cc3ea 60%, #5fa3d4 100%)',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55)',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 12.5, color: MUTED, fontWeight: 500 }}>{d.g}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ---- clienti ---- */}
          <div className="relative" style={{ ...shell(32), padding: 11 }}>
            <Edge radius={32} depth={14} />
            <Caustic style={{ left: '20%', right: '6%', bottom: -13, height: 26, borderRadius: 36, opacity: 0.38 }} />
            <div className="flex h-full flex-col gap-4 px-5 py-6" style={pool(23)}>
              <div className="flex items-baseline justify-between px-1">
                <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>Clienti</h2>
                <span style={{ fontSize: 13, color: MUTED }}>salute ultimi 30 gg</span>
              </div>

              <div className="flex flex-col gap-2">
                {CLIENTI.map((c) => {
                  const col =
                    c.stato === 'ok' ? '#1fae7a' : c.stato === 'attenzione' ? '#f5c518' : '#e2663f';
                  return (
                    <div
                      key={c.nome}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/60"
                      style={{ borderBottom: '1px solid rgba(150,168,195,0.16)' }}
                    >
                      <span
                        className="shrink-0"
                        style={{
                          width: 11,
                          height: 11,
                          borderRadius: 999,
                          background: `radial-gradient(circle at 32% 28%, #fff 0%, ${col} 62%)`,
                          boxShadow: `0 0 0 3px ${col}22, 0 2px 4px -1px ${col}88`,
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div style={{ fontSize: 14.5, fontWeight: 500, letterSpacing: '-0.01em' }} className="truncate">
                          {c.nome}
                        </div>
                        <div style={{ fontSize: 12, color: MUTED }} className="truncate">
                          {c.canali}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
                          color: col === '#f5c518' ? '#9a7b00' : col,
                        }}
                      >
                        {c.salute}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ======================= TASK IN SCADENZA ======================= */}
        <motion.div {...rise(4)} className="relative" style={{ ...shell(32), padding: 11 }}>
          <Edge radius={32} depth={14} />
          <Caustic style={{ left: '12%', right: '48%', bottom: -13, height: 26, borderRadius: 36, opacity: 0.36 }} />
          <div className="flex flex-col gap-4 px-5 py-6 sm:px-6" style={pool(23)}>
            <div className="flex items-baseline justify-between px-1">
              <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>Task in scadenza</h2>
              <button style={{ fontSize: 13.5, fontWeight: 500, color: '#9a7b00' }}>Vedi tutti →</button>
            </div>

            <div className="flex flex-col gap-2">
              {TASK.map((t) => {
                const s = STATO_COLORE[t.stato];
                return (
                  <div
                    key={t.titolo}
                    className="flex flex-wrap items-center gap-3 rounded-xl px-3.5 py-3 transition-colors hover:bg-white/60"
                    style={{ borderBottom: '1px solid rgba(150,168,195,0.16)' }}
                  >
                    <span
                      className="grid shrink-0 place-items-center"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 999,
                        background: 'radial-gradient(circle at 34% 24%, #ffffff 0%, #eef2f8 55%, #d6dde8 100%)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 5px -3px rgba(20,40,70,0.28)',
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: MUTED,
                      }}
                    >
                      {t.chi}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em' }} className="truncate">
                        {t.titolo}
                      </div>
                      <div style={{ fontSize: 12.5, color: MUTED }} className="truncate">
                        {t.cliente}
                      </div>
                    </div>

                    <span
                      className="rounded-full px-3 py-1"
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        background: s.bg,
                        color: s.ink,
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t.stato}
                    </span>

                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: t.scadenza === 'Oggi' ? '#a33c1c' : MUTED,
                        minWidth: 56,
                        textAlign: 'right',
                        fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
                      }}
                    >
                      {t.scadenza}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        <p className="pb-6 pt-2 text-center" style={{ fontSize: 12.5, color: '#98a1ad' }}>
          Pagina di esempio · linguaggio Liquid Glass applicato all'Hub · dati non reali
        </p>
      </div>
    </div>
  );
}
