"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";

interface SpeechBubbleProps {
  visible: boolean;
  reduceMotion: boolean;
  side: "left" | "right";
}

export function SpeechBubble({ visible, reduceMotion, side }: SpeechBubbleProps) {
  const { t } = useI18n();
  const pool = t.hero.speechBubble;
  const [currentLine, setCurrentLine] = useState("");

  useEffect(() => {
    if (visible) {
      const idx = Math.floor(Math.random() * pool.length);
      setCurrentLine(pool[idx]);
    }
  }, [visible, pool]);

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        zIndex: 40,
        top: "58%",
        left: side === "right" ? "70%" : undefined,
        right: side === "left" ? "70%" : undefined,
        transform: "translateY(-50%)",
      }}
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            key="bubble"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.9, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 6 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
            className="relative bg-white/95 text-gray-900 rounded-2xl px-4 py-3 text-sm md:text-[14px] font-medium leading-snug max-w-[280px] md:max-w-[340px] shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
            aria-label={t.hero.speechBubbleAriaLabel}
            role="status"
          >
            {currentLine}
            <span
              className="absolute w-3 h-3 bg-white/95 rotate-45"
              style={{
                left: side === "right" ? "-6px" : undefined,
                right: side === "left" ? "-6px" : undefined,
                top: "74%",
              }}
              aria-hidden="true"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
