"use client";

import { motion, Variants } from "framer-motion";
import { ReactNode } from "react";

/**
 * AnimatedGrid — Antigravity Design System
 * 
 * Avvolge una griglia di card con stagger entrance animation.
 * Ogni item figlio (AnimatedGridItem) entra dal basso con delay progressivo.
 * 
 * Rispetta prefers-reduced-motion automaticamente via framer-motion.
 * 
 * Usage:
 * <AnimatedGrid className="grid grid-cols-3 gap-4">
 *   {items.map(item => (
 *     <AnimatedGridItem key={item.id}>
 *       <MyCard item={item} />
 *     </AnimatedGridItem>
 *   ))}
 * </AnimatedGrid>
 */

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.04,
    },
  },
};

const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 18,
    scale: 0.97,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1], // custom spring-like easing
    },
  },
};

interface AnimatedGridProps {
  children: ReactNode;
  className?: string;
  /** Override stagger delay in seconds. Default: 0.07 */
  stagger?: number;
}

export function AnimatedGrid({ children, className = "", stagger = 0.07 }: AnimatedGridProps) {
  const variants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: stagger,
        delayChildren: 0.04,
      },
    },
  };

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

interface AnimatedGridItemProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedGridItem({ children, className = "" }: AnimatedGridItemProps) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}

/**
 * AnimatedListItem — per liste verticali (task list, notification list, ecc.)
 * Stesso effetto del grid item ma con delay più stretto (0.04s).
 */
const listItemVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
  },
};

export function AnimatedList({ children, className = "" }: AnimatedGridItemProps) {
  return (
    <motion.div
      className={className}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export function AnimatedListItem({ children, className = "" }: AnimatedGridItemProps) {
  return (
    <motion.div className={className} variants={listItemVariants}>
      {children}
    </motion.div>
  );
}

/**
 * GlassCard3D — Card con effetto tilt 3D al hover (Antigravity style)
 * Wrappa qualsiasi contenuto e aggiunge depth effect su hover.
 */
export function GlassCard3D({ children, className = "" }: AnimatedGridItemProps) {
  return (
    <motion.div
      className={`glass-card rounded-xl ${className}`}
      whileHover={{
        rotateX: -3,
        rotateY: 3,
        scale: 1.015,
        transition: { type: "spring", stiffness: 400, damping: 25 },
      }}
      style={{
        transformStyle: "preserve-3d",
        perspective: 800,
        willChange: "transform",
      }}
    >
      {children}
    </motion.div>
  );
}
