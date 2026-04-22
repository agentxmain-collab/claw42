"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";

interface SpeechBubbleProps {
  visible: boolean;
  reduceMotion: boolean;
}

export function SpeechBubble({ visible, reduceMotion }: SpeechBubbleProps) {
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
      className="absolute pointer-events-none top-[-8%] left-1/2 -translate-x-1/2 md:top-[28%] md:left-[62%] md:translate-x-0"
      style={{ zIndex: 40 }}
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            key="bubble"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.9, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 6 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
            className="relative bg-white/95 text-gray-900 rounded-2xl px-4 py-2 text-sm font-medium max-w-[240px] md:max-w-[280px] shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
            aria-label={t.hero.speechBubbleAriaLabel}
            role="status"
          >
            {currentLine}
            <span
              className="absolute w-3 h-3 bg-white/95 rotate-45 left-[16px] bottom-[-6px] md:left-[16px]"
              aria-hidden="true"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
