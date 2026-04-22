"use client";

import { motion } from "framer-motion";

interface PedestalLayerProps {
  mouseX: number;
  mouseY: number;
  reduceMotion: boolean;
}

export function PedestalLayer({ mouseX, mouseY, reduceMotion }: PedestalLayerProps) {
  const depth = 0.1;
  const parallaxX = reduceMotion ? 0 : mouseX * depth * 20;
  const parallaxY = reduceMotion ? 0 : mouseY * depth * 12;

  return (
    <div
      className="absolute z-10 left-1/2 bottom-[20%]"
      style={{
        transform: `translateX(-50%) translate(${parallaxX}px, ${parallaxY}px)`,
        transition: "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        width: "min(456px, 40vw)",
      }}
    >
      {/* Glow breathing overlay */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(ellipse at center, rgba(124,92,255,0.35) 0%, transparent 70%)",
          filter: "blur(24px)",
        }}
        animate={reduceMotion ? { opacity: 0.4 } : { opacity: [0.4, 0.8, 0.4] }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 3, repeat: Infinity, ease: "easeInOut" }
        }
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/hero/pedestal.png"
        alt=""
        className="relative w-full select-none"
        draggable={false}
      />
    </div>
  );
}
