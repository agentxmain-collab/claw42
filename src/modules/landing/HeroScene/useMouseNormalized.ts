"use client";
import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Track normalised mouse coordinates relative to a stage element.
 * Returns { x: -1..1, y: -1..1 } with centre = (0, 0).
 * When the cursor leaves the element the values lerp back to (0, 0).
 */
export function useMouseNormalized(ref: React.RefObject<HTMLElement | null>) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const latestPos = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  // Keep a ref in sync so the mouseleave animation reads the latest value.
  const updatePos = useCallback((next: { x: number; y: number }) => {
    latestPos.current = next;
    setPos(next);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleMove = (e: MouseEvent) => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      updatePos({
        x: Math.max(-1, Math.min(1, x)),
        y: Math.max(-1, Math.min(1, y)),
      });
    };

    const handleLeave = () => {
      const start = performance.now();
      const from = { ...latestPos.current };
      const animate = (now: number) => {
        const t = Math.min((now - start) / 400, 1);
        const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
        updatePos({
          x: from.x * (1 - ease),
          y: from.y * (1 - ease),
        });
        if (t < 1) {
          rafRef.current = requestAnimationFrame(animate);
        } else {
          rafRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(animate);
    };

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [ref, updatePos]);

  return pos;
}
