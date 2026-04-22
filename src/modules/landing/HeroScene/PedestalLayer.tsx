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
          bottom: "11%",
          width: "min(340px, 29vw)",
          height: "min(230px, 19vw)",
          transform: `translate(-50%, 0) translate(${parallaxX}px, ${parallaxY}px)`,
          zIndex: 15,
        }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 48% 100% at 50% 100%, rgba(160,134,255,0.72) 0%, rgba(124,92,255,0.48) 28%, rgba(88,58,215,0.24) 52%, transparent 76%)",
            filter: "blur(12px)",
          }}
          animate={reduceMotion ? { opacity: 0.65 } : { opacity: [0.45, 0.85, 0.45] }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 3, repeat: Infinity, ease: "easeInOut" }
          }
        />
      </motion.div>

      <motion.div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          bottom: "22%",
          width: "min(210px, 18vw)",
          height: "min(88px, 7vw)",
          transform: `translate(-50%, 0) translate(${parallaxX}px, ${parallaxY}px)`,
          zIndex: 18,
          background:
            "radial-gradient(ellipse 50% 60% at 50% 50%, rgba(178,152,255,0.92) 0%, rgba(124,92,255,0.52) 36%, rgba(73,201,255,0.2) 56%, transparent 76%)",
          filter: "blur(16px)",
        }}
        animate={reduceMotion ? { opacity: 0.75 } : { opacity: [0.55, 1, 0.55] }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
        }
      />

      <div
        className="absolute left-1/2 pointer-events-none"
        style={{
          bottom: "9%",
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
            top: "-10%",
            width: "74%",
            height: "46%",
            background:
              "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(160,136,255,0.7), rgba(124,92,255,0.32) 48%, transparent 74%)",
            filter: "blur(10px)",
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
