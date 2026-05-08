"use client";

import { motion } from "framer-motion";

interface HintArrowProps {
  text: string;
  reduceMotion: boolean;
}

export function HintArrow({ text, reduceMotion }: HintArrowProps) {
  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-[61%] z-[58] hidden -translate-x-1/2 flex-col items-center md:flex"
      initial={false}
      animate={reduceMotion ? { opacity: 0.9 } : { y: [0, 6, 0], opacity: [0.72, 1, 0.72] }}
      transition={reduceMotion ? { duration: 0 } : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
    >
      <span className="rounded-full border border-[#62f0ff]/28 bg-black/64 px-3 py-1 text-xs font-semibold text-white shadow-lg">
        {text}
      </span>
      <svg className="mt-2 h-10 w-10 text-[#62f0ff]" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path
          d="M20 5v25m0 0 8-8m-8 8-8-8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  );
}
