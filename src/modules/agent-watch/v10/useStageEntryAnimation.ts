"use client";

import { useEffect, type RefObject } from "react";

export function useStageEntryAnimation(containerRef: RefObject<HTMLElement>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cards = Array.from(container.querySelectorAll<HTMLElement>(".fstage4"));
    if (cards.length === 0) return;

    if (!("IntersectionObserver" in window)) {
      cards.forEach((card) => card.classList.add("in-view"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              cards.indexOf(a.target as HTMLElement) - cards.indexOf(b.target as HTMLElement),
          )
          .forEach((entry, index) => {
            window.setTimeout(() => entry.target.classList.add("in-view"), index * 90);
            observer.unobserve(entry.target);
          });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [containerRef]);
}
