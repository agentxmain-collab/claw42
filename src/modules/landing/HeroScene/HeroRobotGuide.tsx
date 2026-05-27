"use client";

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
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.32 }}
    >
      <motion.span
        className="claw42-hero-robot-guide-ring absolute inset-[-8%] rounded-[40%] border border-[#5227FF]/50 shadow-[0_0_44px_rgba(82,39,255,0.48),0_0_26px_rgba(209,255,85,0.18)]"
        animate={
          reduceMotion
            ? { opacity: 0.56, scale: 1 }
            : { opacity: [0.3, 0.72, 0.3], scale: [0.96, 1.05, 0.96] }
        }
        transition={
          reduceMotion ? { duration: 0 } : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
        }
      />
      <motion.span
        className={[
          "absolute top-[12%] max-w-[9.75rem] rounded-2xl border border-[#5227FF]/55 bg-black/70 px-3 py-2 text-center text-[12px] font-black leading-tight text-white shadow-[0_14px_42px_rgba(82,39,255,0.36)] backdrop-blur-md",
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
