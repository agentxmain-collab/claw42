"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";

interface SpeechBubbleProps {
  reduceMotion: boolean;
}

export function SpeechBubble({ reduceMotion }: SpeechBubbleProps) {
  const { t } = useI18n();
  const messages = t.hero.speechBubble;

  // Random start index, then sequential
  const startIndex = useMemo(
    () => Math.floor(Math.random() * messages.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages.length]
  );
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [messages.length]);

  return (
    <div
      className="absolute z-40 right-[15%] top-[12%] md:right-[28%] md:top-[10%] pointer-events-none"
      aria-label={t.hero.speechBubbleAriaLabel}
      role="status"
      aria-live="polite"
    >
      <div className="relative max-w-[70vw] md:max-w-xs">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeInOut" }}
            className="relative bg-white/95 text-gray-900 text-xs md:text-sm font-medium rounded-2xl px-4 py-3 shadow-lg"
          >
            {messages[index]}
            {/* Tail pointing down-left (desktop) / down (mobile) */}
            <svg
              className="absolute -bottom-2 left-6 md:left-4 w-4 h-3 text-white/95"
              viewBox="0 0 16 12"
              fill="currentColor"
            >
              <path d="M0 0 L8 12 L16 0 Z" />
            </svg>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
