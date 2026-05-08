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

const PARTICLE_COUNT_DESKTOP = 50;
const PARTICLE_COUNT_MOBILE = 30;
const PARTICLE_LIFE_MS = 2200;
const SPAWN_RADIUS = 60;
const AMBIENT_DRIFT_SPEED = 0.3;
const FRICTION = 0.9;
const ACTIVE_SPAWN_INTERVAL_MS = 24;
const IDLE_SPAWN_INTERVAL_MS = 96;
const IDLE_AFTER_MS = 1500;

function resolveSpawnCenter(stage: HTMLDivElement, mouseX: number, mouseY: number) {
  const stageRect = stage.getBoundingClientRect();
  const mouseInStage = mouseX >= -1 && mouseX <= 1 && mouseY >= -1 && mouseY <= 1;

  if (!mouseInStage) {
    return { x: stageRect.width / 2, y: stageRect.height / 2 };
  }

  return {
    x: stageRect.width / 2 + (mouseX * stageRect.width) / 2,
    y: stageRect.height / 2 + (mouseY * stageRect.height) / 2,
  };
}

export function ParticleLayer({ stageRef, mouseX, mouseY, reduceMotion }: ParticleLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const mouseRef = useRef({ x: mouseX, y: mouseY });
  const lastMouseMoveRef = useRef(performance.now());

  useEffect(() => {
    const previousMouse = mouseRef.current;
    if (Math.abs(previousMouse.x - mouseX) > 0.001 || Math.abs(previousMouse.y - mouseY) > 0.001) {
      lastMouseMoveRef.current = performance.now();
    }
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
      const deltaMs = lastFrameRef.current ? now - lastFrameRef.current : 16;
      lastFrameRef.current = now;

      const currentMouse = mouseRef.current;
      const spawnCenter = resolveSpawnCenter(stage, currentMouse.x, currentMouse.y);
      const maxParticleCount =
        window.innerWidth < 768 ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
      const spawnInterval =
        now - lastMouseMoveRef.current >= IDLE_AFTER_MS
          ? IDLE_SPAWN_INTERVAL_MS
          : ACTIVE_SPAWN_INTERVAL_MS;

      if (
        now - lastSpawnRef.current > spawnInterval &&
        particlesRef.current.length < maxParticleCount
      ) {
        lastSpawnRef.current = now;
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * SPAWN_RADIUS;
        const driftSpeed = AMBIENT_DRIFT_SPEED + Math.random() * 0.45;
        particlesRef.current.push({
          x: spawnCenter.x + Math.cos(angle) * distance,
          y: spawnCenter.y + Math.sin(angle) * distance,
          vx: Math.cos(angle) * driftSpeed + (Math.random() - 0.5) * 0.25,
          vy: Math.sin(angle) * driftSpeed + (Math.random() - 0.5) * 0.25,
          size: 1.4 + Math.random() * 2.4,
          life: 1,
          hue: 250 + Math.random() * 30,
        });
      }

      ctx.clearRect(0, 0, rect.width, rect.height);

      const survivors: Particle[] = [];
      for (const particle of particlesRef.current) {
        particle.vx *= FRICTION;
        particle.vy *= FRICTION;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= deltaMs / PARTICLE_LIFE_MS;

        if (particle.life > 0) {
          const alpha = particle.life * 0.68;
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
      lastFrameRef.current = 0;
      lastSpawnRef.current = 0;
    };
  }, [reduceMotion, stageRef]);

  if (reduceMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="claw42-hero-particles pointer-events-none absolute inset-0"
      style={{ zIndex: 25, mixBlendMode: "screen" }}
      aria-hidden="true"
    />
  );
}
