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
  const [selectedLine, setSelectedLine] = useState("");
  const [typedLine, setTypedLine] = useState("");

  useEffect(() => {
    if (visible) {
      const idx = Math.floor(Math.random() * pool.length);
      setSelectedLine(pool[idx]);
    }
  }, [visible, pool]);

  useEffect(() => {
    if (!visible) {
      setTypedLine("");
      return;
    }

    if (reduceMotion) {
      setTypedLine(selectedLine);
      return;
    }

    const chars = Array.from(selectedLine);
    let index = 0;
    setTypedLine("");

    const timer = window.setInterval(() => {
      index += 1;
      setTypedLine(chars.slice(0, index).join(""));
      if (index >= chars.length) {
        window.clearInterval(timer);
      }
    }, 34);

    return () => window.clearInterval(timer);
  }, [selectedLine, visible, reduceMotion]);

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        zIndex: 40,
        top: "66%",
        left: side === "right" ? "68%" : undefined,
        right: side === "left" ? "68%" : undefined,
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
            className="relative bg-white/95 text-gray-900 rounded-2xl px-4 py-3 text-[13px] md:text-[14px] font-medium font-mono leading-snug min-w-[220px] sm:min-w-[280px] md:min-w-[340px] max-w-[240px] sm:max-w-[340px] md:max-w-[420px] md:whitespace-nowrap shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
            aria-label={t.hero.speechBubbleAriaLabel}
            role="status"
          >
            <span>{typedLine}</span>
            <motion.span
              className="inline-block w-[1.5px] h-[1.05em] ml-1 align-[-0.12em] rounded-full bg-[#6c4fff] shadow-[0_0_8px_rgba(108,79,255,0.65)]"
              animate={reduceMotion ? { opacity: 1 } : { opacity: [0.18, 1, 0.18] }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.72, repeat: Infinity, ease: "easeInOut" }
              }
              aria-hidden="true"
            />
            <span
              className="absolute w-3 h-3 bg-white/95 rotate-45"
              style={{
                left: side === "right" ? "-6px" : undefined,
                right: side === "left" ? "-6px" : undefined,
                top: "68%",
              }}
              aria-hidden="true"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
