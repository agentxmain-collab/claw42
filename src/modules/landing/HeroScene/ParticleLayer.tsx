"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

interface ParticleLayerProps {
  stageRef: RefObject<HTMLDivElement>;
  robotRef: RefObject<HTMLDivElement>;
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
const PARTICLE_LIFE_MS = 2200;
const SPAWN_RADIUS = 60;
const AMBIENT_DRIFT_SPEED = 0.3;
const MAX_FOLLOW_FORCE = 0.018;
const FAR_DISTANCE = 400;
const NEAR_DISTANCE = 100;
const FRICTION = 0.9;

function particleForceForDistance(distance: number) {
  if (distance > FAR_DISTANCE) return 0;
  if (distance <= NEAR_DISTANCE) return MAX_FOLLOW_FORCE;
  return MAX_FOLLOW_FORCE * ((FAR_DISTANCE - distance) / (FAR_DISTANCE - NEAR_DISTANCE));
}

function resolveRobotCenter(stage: HTMLDivElement, robot: HTMLDivElement | null) {
  const stageRect = stage.getBoundingClientRect();
  if (!robot) {
    return { x: stageRect.width / 2, y: stageRect.height / 2 };
  }

  const robotRect = robot.getBoundingClientRect();
  return {
    x: robotRect.left + robotRect.width / 2 - stageRect.left,
    y: robotRect.top + robotRect.height / 2 - stageRect.top,
  };
}

export function ParticleLayer({
  stageRef,
  robotRef,
  mouseX,
  mouseY,
  reduceMotion,
}: ParticleLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
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
      const deltaMs = lastFrameRef.current ? now - lastFrameRef.current : 16;
      lastFrameRef.current = now;

      const currentMouse = mouseRef.current;
      const mousePoint = {
        x: rect.width / 2 + (currentMouse.x * rect.width) / 2,
        y: rect.height / 2 + (currentMouse.y * rect.height) / 2,
      };
      const robotCenter = resolveRobotCenter(stage, robotRef.current);
      const mouseDistance = Math.hypot(
        mousePoint.x - robotCenter.x,
        mousePoint.y - robotCenter.y,
      );
      const followForce = particleForceForDistance(mouseDistance);
      const shouldSpawn = mouseDistance <= FAR_DISTANCE;

      if (
        shouldSpawn &&
        now - lastSpawnRef.current > 24 &&
        particlesRef.current.length < PARTICLE_COUNT_DESKTOP
      ) {
        lastSpawnRef.current = now;
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * SPAWN_RADIUS;
        particlesRef.current.push({
          x: robotCenter.x + Math.cos(angle) * distance,
          y: robotCenter.y + Math.sin(angle) * distance,
          vx: (Math.random() - 0.5) * 0.7,
          vy: (Math.random() - 0.5) * 0.7,
          size: 1.4 + Math.random() * 2.4,
          life: 1,
          hue: 250 + Math.random() * 30,
        });
      }

      ctx.clearRect(0, 0, rect.width, rect.height);

      const survivors: Particle[] = [];
      for (const particle of particlesRef.current) {
        const toMouseX = mousePoint.x - particle.x;
        const toMouseY = mousePoint.y - particle.y;
        const toRobotX = robotCenter.x - particle.x;
        const toRobotY = robotCenter.y - particle.y;
        const orbitDistance = Math.max(1, Math.hypot(toRobotX, toRobotY));
        const orbitX = (-toRobotY / orbitDistance) * AMBIENT_DRIFT_SPEED;
        const orbitY = (toRobotX / orbitDistance) * AMBIENT_DRIFT_SPEED;

        particle.vx =
          particle.vx * FRICTION +
          toMouseX * followForce +
          toRobotX * 0.0012 +
          orbitX;
        particle.vy =
          particle.vy * FRICTION +
          toMouseY * followForce +
          toRobotY * 0.0012 +
          orbitY;
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
    };
  }, [reduceMotion, robotRef, stageRef]);

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
