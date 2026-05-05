"use client";

import { useEffect, useState } from "react";
import { heroScrollProgress } from "./heroStageMotion";

export function useHeroScrollDepth(
  ref: React.RefObject<HTMLElement | null>,
  reduceMotion: boolean,
) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      setProgress(0);
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const node = ref.current;
      if (!node) return;
      setProgress(heroScrollProgress(node.getBoundingClientRect()));
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [ref, reduceMotion]);

  return progress;
}
