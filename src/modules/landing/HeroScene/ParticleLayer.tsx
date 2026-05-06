"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

interface ParticleLayerProps {
  stageRef: RefObject<HTMLDivElement>;
  mouseX: number;
  mouseY: number;
  reduceMotion: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  hue: number;
}

const PARTICLE_COUNT_DESKTOP = 60;
const PARTICLE_LIFE_MS = 2200;
const SPAWN_RADIUS = 80;
const FOLLOW_FORCE = 0.012;
const FRICTION = 0.92;

export function ParticleLayer({
  stageRef,
  mouseX,
  mouseY,
  reduceMotion,
}: ParticleLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastSpawnRef = useRef(0);
  const mouseRef = useRef({ x: mouseX, y: mouseY });

  useEffect(() => {
    mouseRef.current = { x: mouseX, y: mouseY };
  }, [mouseX, mouseY]);

  useEffect(() => {
    if (reduceMotion) return;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);

    const tick = (now: number) => {
      const rect = stage.getBoundingClientRect();
      const currentMouse = mouseRef.current;
      const cx = rect.width / 2 + (currentMouse.x * rect.width) / 2;
      const cy = rect.height / 2 + (currentMouse.y * rect.height) / 2;

      if (
        now - lastSpawnRef.current > 18 &&
        particlesRef.current.length < PARTICLE_COUNT_DESKTOP
      ) {
        lastSpawnRef.current = now;
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * SPAWN_RADIUS;
        particlesRef.current.push({
          x: cx + Math.cos(angle) * distance,
          y: cy + Math.sin(angle) * distance,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          size: 1.5 + Math.random() * 2.5,
          life: 1,
          hue: 250 + Math.random() * 30,
        });
      }

      ctx.clearRect(0, 0, rect.width, rect.height);

      const survivors: Particle[] = [];
      for (const particle of particlesRef.current) {
        const dx = cx - particle.x;
        const dy = cy - particle.y;
        particle.vx = particle.vx * FRICTION + dx * FOLLOW_FORCE;
        particle.vy = particle.vy * FRICTION + dy * FOLLOW_FORCE;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= 16 / PARTICLE_LIFE_MS;

        if (particle.life > 0) {
          const alpha = particle.life * 0.7;
          ctx.beginPath();
          ctx.fillStyle = `hsla(${particle.hue}, 90%, 70%, ${alpha})`;
          ctx.shadowColor = `hsla(${particle.hue}, 90%, 60%, ${alpha})`;
          ctx.shadowBlur = 8;
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
          survivors.push(particle);
        }
      }

      particlesRef.current = survivors;
      ctx.shadowBlur = 0;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      observer.disconnect();
      particlesRef.current = [];
    };
  }, [reduceMotion, stageRef]);

  if (reduceMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="claw42-hero-particles absolute inset-0 pointer-events-none"
      style={{ zIndex: 25, mixBlendMode: "screen" }}
      aria-hidden="true"
    />
  );
}
