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
          bottom: "18%",
          width: "min(180px, 15vw)",
          height: "min(260px, 22vw)",
          transform: `translate(-50%, 0) translate(${parallaxX}px, ${parallaxY}px)`,
          zIndex: 17,
          background:
            "linear-gradient(180deg, rgba(198,182,255,0) 0%, rgba(198,182,255,0.24) 18%, rgba(149,121,255,0.52) 42%, rgba(96,73,246,0.46) 66%, rgba(73,201,255,0.14) 82%, rgba(73,201,255,0) 100%)",
          filter: "blur(22px)",
          borderRadius: "999px",
        }}
        animate={reduceMotion ? { opacity: 0.9 } : { opacity: [0.48, 0.92, 0.48] }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
        }
      />

      <motion.div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          bottom: "24%",
          width: "min(260px, 22vw)",
          height: "min(132px, 10vw)",
          transform: `translate(-50%, 0) translate(${parallaxX}px, ${parallaxY}px)`,
          zIndex: 18,
          background:
            "radial-gradient(ellipse 52% 68% at 50% 56%, rgba(207,190,255,0.98) 0%, rgba(154,125,255,0.72) 24%, rgba(108,79,244,0.46) 44%, rgba(73,201,255,0.18) 64%, transparent 82%)",
          filter: "blur(24px)",
        }}
        animate={reduceMotion ? { opacity: 0.88 } : { opacity: [0.62, 1, 0.62] }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
        }
      />

      <motion.div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          bottom: "23%",
          width: "min(196px, 16vw)",
          height: "min(196px, 16vw)",
          transform: `translate(-50%, 0) translate(${parallaxX}px, ${parallaxY}px)`,
          zIndex: 19,
          background:
            "radial-gradient(circle, rgba(228,218,255,0.98) 0%, rgba(176,152,255,0.72) 28%, rgba(111,86,248,0.28) 54%, transparent 78%)",
          filter: "blur(20px)",
        }}
        animate={reduceMotion ? { opacity: 0.96 } : { opacity: [0.76, 1, 0.76] }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 1.7, repeat: Infinity, ease: "easeInOut" }
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
