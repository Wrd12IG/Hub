"use client";

import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";

interface TaskApprovedCelebrationProps {
  trigger: boolean;
}

/**
 * Fires a burst of gold + purple sparkles when `trigger` flips to true.
 * Lightweight: canvas-confetti is ~14KB, no WebGL, no React Three Fiber.
 */
export function TaskApprovedCelebration({ trigger }: TaskApprovedCelebrationProps) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!trigger || firedRef.current) return;
    firedRef.current = true;

    const duration = 1800;
    const end = Date.now() + duration;

    const colors = ["#667eea", "#764ba2", "#f6d365", "#fda085", "#ffffff"];

    // Centro-sinistra burst
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { x: 0.4, y: 0.6 },
      colors,
      shapes: ["star", "circle"],
      scalar: 1.2,
    });

    // Centro-destra burst
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { x: 0.6, y: 0.6 },
      colors,
      shapes: ["star", "circle"],
      scalar: 1.2,
    });

    // Secondo burst ritardato (pioggia dall'alto)
    setTimeout(() => {
      confetti({
        particleCount: 40,
        spread: 100,
        startVelocity: 30,
        origin: { x: 0.5, y: 0.3 },
        colors,
        gravity: 1.2,
      });
    }, 300);

    // Reset flag dopo la durata
    setTimeout(() => {
      firedRef.current = false;
    }, duration + 500);
  }, [trigger]);

  return null; // nessun elemento DOM — effetto solo canvas
}
