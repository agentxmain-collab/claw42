"use client";

import { AnimatePresence, motion } from "framer-motion";

export type CoinSlotId = "north-west" | "north-east" | "south-west" | "south-east";

const slotLine: Record<CoinSlotId, { x2: number; y2: number; rotate: number }> = {
  "north-west": { x2: 20, y2: 22, rotate: -22 },
  "north-east": { x2: 80, y2: 22, rotate: 22 },
  "south-west": { x2: 22, y2: 72, rotate: -34 },
  "south-east": { x2: 78, y2: 72, rotate: 34 },
};

interface ClawAnimationProps {
  activeSlot: CoinSlotId | null;
  active: boolean;
  reduceMotion: boolean;
}

export function ClawAnimation({ activeSlot, active, reduceMotion }: ClawAnimationProps) {
  const line = activeSlot ? slotLine[activeSlot] : null;

  return (
    <AnimatePresence>
      {active && line && (
        <motion.svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[46] hidden h-full w-full md:block"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.16 }}
        >
          <motion.path
            d={`M50 46 C50 36, ${line.x2} ${line.y2 + 10}, ${line.x2} ${line.y2}`}
            fill="none"
            stroke="rgba(98,240,255,0.78)"
            strokeWidth="0.42"
            strokeLinecap="round"
            strokeDasharray="1.6 1.2"
            initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.38, ease: "easeOut" }}
          />
          <motion.g
            transform={`translate(${line.x2} ${line.y2}) rotate(${line.rotate})`}
            initial={reduceMotion ? { scale: 1 } : { scale: 0.78 }}
            animate={reduceMotion ? { scale: 1 } : { scale: [0.78, 1.08, 0.94, 1] }}
            transition={{ duration: reduceMotion ? 0 : 0.52, ease: "easeOut" }}
          >
            <path
              d="M0 -2.8v4.2M-2.9 1.2C-2.1 3.2-.8 4.1 0 4.1S2.1 3.2 2.9 1.2M-3.9-1.1C-2.4-.1-1 .3 0 .3s2.4-.4 3.9-1.4"
              fill="none"
              stroke="rgba(255,255,255,0.92)"
              strokeWidth="0.62"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.g>
        </motion.svg>
      )}
    </AnimatePresence>
  );
}
