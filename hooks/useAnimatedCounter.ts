"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Anima un numero da 0 al valore target.
 * Rispetta prefers-reduced-motion (WCAG 2.1 2.3.3).
 */
export function useAnimatedCounter(
  target: number,
  {
    duration = 900,
    decimals = 0,
    prefix = "",
    suffix = "",
  }: {
    duration?: number;
    decimals?: number;
    prefix?: string;
    suffix?: string;
  } = {}
): string {
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  useEffect(() => {
    if (prefersReducedMotion || target === 0) {
      setDisplayed(target);
      return;
    }

    startRef.current = null;
    setDisplayed(0);

    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(eased * target);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayed(target);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, prefersReducedMotion]);

  const formatted = displayed.toFixed(decimals);
  return `${prefix}${formatted}${suffix}`;
}
