"use client";

import React from "react";
import { motion } from "framer-motion";

export function HeroRobotGuide({
  label,
  visible,
  reduceMotion,
  side,
}: {
  label: string;
  visible: boolean;
  reduceMotion: boolean;
  side: "left" | "right";
}) {
  if (!visible) return null;

  return (
    <motion.div
      className="claw42-hero-robot-guide pointer-events-none absolute inset-0 z-30"
      data-hero-robot-guide="one-load"
      data-motion-mode={reduceMotion ? "static" : "animated"}
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.32 }}
    >
      {reduceMotion ? null : (
        <>
          <motion.span
            className="claw42-hero-robot-guide-halo absolute inset-[-18%] rounded-[44%] bg-[radial-gradient(circle_at_50%_52%,rgba(82,39,255,0.34),rgba(73,201,255,0.18)_34%,transparent_68%)] blur-xl"
            animate={{ opacity: [0.42, 0.82, 0.42], scale: [0.96, 1.06, 0.96] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            className="claw42-hero-robot-guide-ring absolute inset-[-8%] rounded-[40%] border border-[#5227FF]/50 shadow-[0_0_44px_rgba(82,39,255,0.48),0_0_26px_rgba(209,255,85,0.18)]"
            animate={{ opacity: [0.3, 0.72, 0.3], scale: [0.96, 1.05, 0.96] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            className="claw42-hero-robot-guide-tap-ripple absolute left-1/2 top-[88%] h-14 w-14 -translate-x-1/2 rounded-full border border-[#D1FF55]/70 shadow-[0_0_32px_rgba(209,255,85,0.34)]"
            animate={{ opacity: [0, 0.85, 0], scale: [0.48, 1.14, 1.6] }}
            transition={{ duration: 1.9, repeat: 2, ease: "easeOut" }}
          />
        </>
      )}
      <motion.span
        className={[
          "claw42-hero-robot-guide-chip bg-[#05070d]/82 absolute top-[12%] max-w-[11rem] rounded-2xl border border-[#5227FF]/55 px-3 py-2 text-center text-[12px] font-black leading-tight text-white shadow-[0_14px_42px_rgba(82,39,255,0.36),0_0_24px_rgba(73,201,255,0.22)] backdrop-blur-md",
          side === "right" ? "left-[72%]" : "right-[72%]",
        ].join(" ")}
        animate={reduceMotion ? { y: 0 } : { y: [0, -4, 0] }}
        transition={
          reduceMotion ? { duration: 0 } : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <span className="text-[#D1FF55]">{label}</span>
      </motion.span>
    </motion.div>
  );
}
