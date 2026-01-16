'use client';

import { useState, useEffect, useRef } from 'react';

interface UseCountUpOptions {
  start?: number;
  end: number;
  duration?: number;
  decimals?: number;
  easing?: 'linear' | 'easeOut' | 'easeInOut';
  enabled?: boolean;
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

function linear(t: number): number {
  return t;
}

export function useCountUp({
  start = 0,
  end,
  duration = 1000,
  decimals = 0,
  easing = 'easeOut',
  enabled = true,
}: UseCountUpOptions) {
  const [value, setValue] = useState(enabled ? start : end);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousEndRef = useRef(end);
  const frameRef = useRef<number>();

  useEffect(() => {
    if (!enabled) {
      setValue(end);
      return;
    }

    // Solo anima se il valore è cambiato
    if (previousEndRef.current === end && value === end) {
      return;
    }

    const startValue = previousEndRef.current !== end ? previousEndRef.current : start;
    previousEndRef.current = end;

    const easingFn = easing === 'linear' ? linear : easing === 'easeInOut' ? easeInOutQuart : easeOutQuart;

    let startTime: number | null = null;
    setIsAnimating(true);

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easedProgress = easingFn(progress);
      const currentValue = startValue + (end - startValue) * easedProgress;

      setValue(Number(currentValue.toFixed(decimals)));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [end, duration, decimals, easing, enabled, start, value]);

  return { value, isAnimating };
}

// Hook semplificato per valori interi
export function useCountUpInt(end: number, duration = 1000, enabled = true) {
  return useCountUp({ end, duration, decimals: 0, enabled });
}

// Hook per valori con decimali
export function useCountUpDecimal(end: number, decimals = 2, duration = 1000, enabled = true) {
  return useCountUp({ end, duration, decimals, enabled });
}

// Hook per percentuali
export function useCountUpPercent(end: number, duration = 1000, enabled = true) {
  return useCountUp({ end, duration, decimals: 1, enabled });
}
