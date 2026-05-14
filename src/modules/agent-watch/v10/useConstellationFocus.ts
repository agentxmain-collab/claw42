"use client";

import { useEffect, type RefObject } from "react";

const PICK_RADIUS = 160;
const SWITCH_HYSTERESIS = 0.78;
const LEAVE_GRACE_MS = 320;

interface NodeCenter {
  node: HTMLElement;
  x: number;
  y: number;
}

export function useConstellationFocus(
  constellationRef: RefObject<HTMLDivElement>,
  enabled: boolean,
) {
  useEffect(() => {
    const root = constellationRef.current;
    if (!root || !enabled) return;
    const constellation: HTMLDivElement = root;

    const nodes = Array.from(constellation.querySelectorAll<HTMLElement>(".anode"));
    let currentFocus: HTMLElement | null = null;
    let leaveTimer: number | null = null;
    let centers: NodeCenter[] = [];

    function measure() {
      const target = constellationRef.current;
      if (!target) return;
      const styleFx = target.style.getPropertyValue("--fx");
      const styleFy = target.style.getPropertyValue("--fy");
      const wasFocused = target.classList.contains("focused");
      target.classList.remove("focused");
      const cRect = target.getBoundingClientRect();
      centers = nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          node,
          x: rect.left + rect.width / 2 - cRect.left,
          y: rect.top + rect.height / 2 - cRect.top,
        };
      });
      if (wasFocused) target.classList.add("focused");
      if (styleFx) target.style.setProperty("--fx", styleFx);
      if (styleFy) target.style.setProperty("--fy", styleFy);
    }

    function releaseFocus() {
      constellation.classList.remove("focused");
      nodes.forEach((node) => node.classList.remove("is-focus"));
      constellation.style.removeProperty("--fx");
      constellation.style.removeProperty("--fy");
      currentFocus = null;
    }

    function setFocus(node: HTMLElement) {
      if (node === currentFocus) return;
      const center = centers.find((entry) => entry.node === node);
      if (!center) return;
      const cRect = constellation.getBoundingClientRect();
      const dx = cRect.width / 2 - center.x;
      const dy = cRect.height / 2 - center.y;
      constellation.style.setProperty("--fx", `${dx.toFixed(1)}px`);
      constellation.style.setProperty("--fy", `${(dy * 0.7).toFixed(1)}px`);
      constellation.style.setProperty("--ox", `${((center.x / cRect.width) * 100).toFixed(1)}%`);
      constellation.style.setProperty("--oy", `${((center.y / cRect.height) * 100).toFixed(1)}%`);
      nodes.forEach((candidate) => candidate.classList.toggle("is-focus", candidate === node));
      constellation.classList.add("focused");
      currentFocus = node;
    }

    function handleMove(event: PointerEvent) {
      if (leaveTimer) window.clearTimeout(leaveTimer);
      const cRect = constellation.getBoundingClientRect();
      const mx = event.clientX - cRect.left;
      const my = event.clientY - cRect.top;
      let best: NodeCenter | null = null;
      let bestD = Infinity;

      for (const center of centers) {
        const distance = Math.hypot(center.x - mx, center.y - my);
        if (distance < bestD) {
          bestD = distance;
          best = center;
        }
      }

      if (!best) return;
      if (bestD > PICK_RADIUS) {
        if (currentFocus && bestD > PICK_RADIUS + 40) releaseFocus();
        return;
      }
      if (best.node === currentFocus) return;
      if (currentFocus) {
        const previous = centers.find((entry) => entry.node === currentFocus);
        if (previous) {
          const previousDistance = Math.hypot(previous.x - mx, previous.y - my);
          if (bestD > previousDistance * SWITCH_HYSTERESIS) return;
        }
      }
      setFocus(best.node);
    }

    function handleLeave() {
      leaveTimer = window.setTimeout(releaseFocus, LEAVE_GRACE_MS);
    }

    function handleDocumentClick(event: MouseEvent) {
      if (!constellation.contains(event.target as Node)) releaseFocus();
    }

    measure();
    window.addEventListener("resize", measure);
    constellation.addEventListener("pointermove", handleMove);
    constellation.addEventListener("pointerleave", handleLeave);
    document.addEventListener("click", handleDocumentClick);

    return () => {
      if (leaveTimer) window.clearTimeout(leaveTimer);
      releaseFocus();
      window.removeEventListener("resize", measure);
      constellation.removeEventListener("pointermove", handleMove);
      constellation.removeEventListener("pointerleave", handleLeave);
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [constellationRef, enabled]);
}
