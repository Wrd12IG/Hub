"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  hue: number; // slight hue variation for visual richness
}

/**
 * Antigravity Particle Network Background
 * 65 particelle amber/indigo che si connettono e reagiscono al mouse.
 * Dual-color: 70% amber (brand primary), 30% indigo (accent)
 * Performance: requestAnimationFrame, ~60fps, GPU via canvas 2D.
 * Rispetta prefers-reduced-motion: disabilita il canvas se attivo.
 */
export default function FloatingNetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Rispetta prefers-reduced-motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const PARTICLE_COUNT = 65;
    const CONNECT_DISTANCE = 140;
    const MOUSE_ATTRACT_DISTANCE = 120; // mouse attrae le particelle vicine
    const MOUSE_REPEL_DISTANCE = 60;    // ma le respinge se troppo vicine
    const SPEED = 0.28;
    // Amber: hsl(45, 93%, 47%) → rgb approx 232, 184, 8
    // Indigo: hsl(239, 84%, 67%) → rgb approx 99, 102, 241
    const AMBER_COLOR = "245, 197, 24";
    const INDIGO_COLOR = "99, 102, 241";

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", () => {
      mouseRef.current = { x: -1000, y: -1000 };
    });

    // Init particles — 70% amber, 30% indigo
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * SPEED,
      vy: (Math.random() - 0.5) * SPEED,
      radius: Math.random() * 1.6 + 0.6,
      opacity: Math.random() * 0.35 + 0.15,
      hue: i < PARTICLE_COUNT * 0.7 ? 0 : 1, // 0=amber, 1=indigo
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      // Update positions
      for (const p of particles) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < MOUSE_REPEL_DISTANCE && dist > 0) {
          // Repel — troppo vicine
          const force = (MOUSE_REPEL_DISTANCE - dist) / MOUSE_REPEL_DISTANCE;
          p.vx += (dx / dist) * force * 0.5;
          p.vy += (dy / dist) * force * 0.5;
        } else if (dist < MOUSE_ATTRACT_DISTANCE && dist > MOUSE_REPEL_DISTANCE) {
          // Attract — zona media
          const force = ((MOUSE_ATTRACT_DISTANCE - dist) / MOUSE_ATTRACT_DISTANCE) * 0.04;
          p.vx -= (dx / dist) * force;
          p.vy -= (dy / dist) * force;
        }

        // Gentle speed restoration (damping toward SPEED)
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > SPEED * 4) {
          p.vx = (p.vx / speed) * SPEED * 4;
          p.vy = (p.vy / speed) * SPEED * 4;
        }
        // Nudge back to base speed if too slow
        if (speed < SPEED * 0.3 && speed > 0) {
          p.vx = (p.vx / speed) * SPEED * 0.5;
          p.vy = (p.vy / speed) * SPEED * 0.5;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Bounce off edges with damping
        if (p.x < 0) { p.x = 0; p.vx *= -0.8; }
        if (p.x > canvas.width) { p.x = canvas.width; p.vx *= -0.8; }
        if (p.y < 0) { p.y = 0; p.vy *= -0.8; }
        if (p.y > canvas.height) { p.y = canvas.height; p.vy *= -0.8; }
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < CONNECT_DISTANCE * CONNECT_DISTANCE) {
            const dist = Math.sqrt(distSq);
            const alpha = (1 - dist / CONNECT_DISTANCE) * 0.12;
            // Use amber color for connections between amber particles
            const color = (a.hue === 0 && b.hue === 0) ? AMBER_COLOR : INDIGO_COLOR;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${color}, ${alpha})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        const color = p.hue === 0 ? AMBER_COLOR : INDIGO_COLOR;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, ${p.opacity})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -2,
        pointerEvents: "none",
        opacity: 0.55,
      }}
    />
  );
}
