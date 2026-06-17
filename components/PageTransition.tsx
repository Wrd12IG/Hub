"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

/**
 * Avvolge ogni pagina con un fade-in + leggero slide-up.
 * Durata 200ms — abbastanza veloce da non essere percepito come lento,
 * abbastanza lungo da sembrare fluido.
 * Rispetta prefers-reduced-motion tramite framer-motion built-in.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      style={{ height: "100%" }}
    >
      {children}
    </motion.div>
  );
}
