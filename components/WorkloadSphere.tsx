"use client";

import { useMemo } from "react";

interface WorkloadSphereProps {
  /** Valore 0-100 (percentuale di carico) */
  load: number;
  /** Dimensione in px */
  size?: number;
  /** Label sotto la sfera */
  label?: string;
}

function getColor(load: number) {
  if (load <= 40) return { from: "#10b981", to: "#34d399", glow: "rgba(16,185,129,0.35)" };
  if (load <= 70) return { from: "#f59e0b", to: "#fbbf24", glow: "rgba(245,158,11,0.35)" };
  return { from: "#ef4444", to: "#f87171", glow: "rgba(239,68,68,0.4)" };
}

/**
 * Sfera 3D pura CSS che cambia colore in base al carico.
 * Verde (≤40%) → Giallo (≤70%) → Rosso (>70%).
 * Nessuna dipendenza esterna oltre CSS.
 */
export function WorkloadSphere({ load, size = 56, label }: WorkloadSphereProps) {
  const clampedLoad = Math.max(0, Math.min(100, load));
  const colors = useMemo(() => getColor(clampedLoad), [clampedLoad]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div
        title={`${clampedLoad.toFixed(0)}% carico`}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 35%, ${colors.from}, ${colors.to})`,
          boxShadow: `
            inset -${size * 0.12}px -${size * 0.12}px ${size * 0.2}px rgba(0,0,0,0.3),
            inset ${size * 0.06}px ${size * 0.06}px ${size * 0.15}px rgba(255,255,255,0.25),
            0 0 ${size * 0.5}px ${colors.glow},
            0 ${size * 0.08}px ${size * 0.25}px rgba(0,0,0,0.25)
          `,
          position: "relative",
          transition: "background 0.6s ease, box-shadow 0.6s ease",
          cursor: "default",
          flexShrink: 0,
        }}
      >
        {/* Highlight speculare */}
        <div
          style={{
            position: "absolute",
            top: "18%",
            left: "22%",
            width: "35%",
            height: "22%",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.35)",
            filter: "blur(3px)",
            transform: "rotate(-20deg)",
          }}
        />
        {/* Percentuale centrata */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: size * 0.23,
            fontWeight: 700,
            color: "rgba(255,255,255,0.92)",
            textShadow: "0 1px 3px rgba(0,0,0,0.4)",
            letterSpacing: "-0.03em",
          }}
        >
          {clampedLoad.toFixed(0)}%
        </div>
      </div>
      {label && (
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", textAlign: "center" }}>
          {label}
        </span>
      )}
    </div>
  );
}
