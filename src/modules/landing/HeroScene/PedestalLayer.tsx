"use client";

import { motion } from "framer-motion";

interface PedestalLayerProps {
  mouseX: number;
  mouseY: number;
  reduceMotion: boolean;
}

export function PedestalLayer({ mouseX, mouseY, reduceMotion }: PedestalLayerProps) {
  const parallaxX = reduceMotion ? 0 : mouseX * 0.1 * 20;
  const parallaxY = reduceMotion ? 0 : mouseY * 0.1 * 12;

  return (
    <>
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          bottom: "20%",
          width: "min(280px, 26vw)",
          height: "min(180px, 14vw)",
          transform: `translate(-50%, 0) translate(${parallaxX}px, ${parallaxY}px)`,
          zIndex: 15,
        }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 100% at 50% 100%, rgba(124,92,255,0.55) 0%, rgba(124,92,255,0.22) 35%, transparent 70%)",
            filter: "blur(8px)",
          }}
          animate={reduceMotion ? { opacity: 0.65 } : { opacity: [0.45, 0.85, 0.45] }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 3, repeat: Infinity, ease: "easeInOut" }
          }
        />
      </motion.div>

      <div
        className="absolute left-1/2 pointer-events-none"
        style={{
          bottom: "20%",
          width: "min(456px, 40vw)",
          transform: `translate(-50%, 0) translate(${parallaxX}px, ${parallaxY}px)`,
          zIndex: 10,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero/pedestal.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="w-full h-auto select-none"
        />
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            top: "-8%",
            width: "70%",
            height: "40%",
            background:
              "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(124,92,255,0.6), transparent 70%)",
            filter: "blur(6px)",
          }}
          animate={reduceMotion ? { opacity: 0.6 } : { opacity: [0.4, 0.8, 0.4] }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 3, repeat: Infinity, ease: "easeInOut" }
          }
        />
      </div>
    </>
  );
}
