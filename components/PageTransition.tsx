"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";

/**
 * Avvolge ogni pagina con un fade-in + leggero slide-up.
 * Durata 220ms — fluido e reattivo.
 * Rispetta prefers-reduced-motion tramite il hook useReducedMotion.
 */
export function PageTransition({ children, fullHeight = false }: { children: ReactNode; fullHeight?: boolean }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
      transition={{ 
        duration: shouldReduceMotion ? 0.12 : 0.22, 
        ease: [0.22, 1, 0.36, 1] 
      }}
      // Altezza MINIMA, non fissa: con `height: 100%` il contenuto più lungo usciva dal contenitore e lo spazio lasciato
      // sotto per la barra flottante (layout) si appoggiava al bordo del contenitore, non alla fine vera della pagina:
      // l'ultima riga restava sotto la barra. Solo le pagine a tutta altezza (chat, focus) tengono l'altezza fissa.
      style={fullHeight ? { height: "100%", width: "100%" } : { minHeight: "100%", width: "100%" }}
    >
      {children}
    </motion.div>
  );
}
