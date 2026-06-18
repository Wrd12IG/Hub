"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";

/**
 * Avvolge ogni pagina con un fade-in + leggero slide-up.
 * Durata 220ms — fluido e reattivo.
 * Rispetta prefers-reduced-motion tramite il hook useReducedMotion.
 */
export function PageTransition({ children }: { children: ReactNode }) {
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
      style={{ height: "100%" }}
    >
      {children}
    </motion.div>
  );
}
