"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";

interface SpeechBubbleProps {
  visible: boolean;
  reduceMotion: boolean;
  side: "left" | "right";
  lines?: string[];
}

export function SpeechBubble({ visible, reduceMotion, side, lines }: SpeechBubbleProps) {
  const { t } = useI18n();
  const pool = useMemo(() => {
    const cleaned = lines?.map((line) => line.trim()).filter(Boolean);
    return cleaned?.length ? cleaned : t.hero.speechBubble;
  }, [lines, t.hero.speechBubble]);
  const poolKey = pool.join("\u0001");
  const lastLineRef = useRef("");
  const [selectedLine, setSelectedLine] = useState("");
  const [typedLine, setTypedLine] = useState("");

  useEffect(() => {
    if (visible) {
      let nextLine = pool[Math.floor(Math.random() * pool.length)] ?? "";
      if (pool.length > 1 && nextLine === lastLineRef.current) {
        const nextIndex =
          (pool.indexOf(nextLine) + 1 + Math.floor(Math.random() * (pool.length - 1))) %
          pool.length;
        nextLine = pool[nextIndex] ?? nextLine;
      }
      lastLineRef.current = nextLine;
      setSelectedLine(nextLine);
    }
  }, [visible, pool, poolKey]);

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
      className="claw42-speech-bubble-root absolute pointer-events-none"
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
            className="claw42-speech-bubble relative bg-white/95 text-gray-900 rounded-2xl px-4 py-3 text-[13px] md:text-[14px] font-medium font-mono leading-snug shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
            style={{ width: "min(82vw, 420px)" }}
            aria-label={t.hero.speechBubbleAriaLabel}
            role="status"
          >
            <span className="inline whitespace-pre-wrap break-words">
              {typedLine}
              <motion.span
                className="inline-block w-[1.5px] h-[1.05em] ml-[2px] align-[-0.12em] rounded-full bg-[#6c4fff] shadow-[0_0_8px_rgba(108,79,255,0.65)]"
                animate={reduceMotion ? { opacity: 1 } : { opacity: [0.18, 1, 0.18] }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.72, repeat: Infinity, ease: "easeInOut" }
                }
                aria-hidden="true"
              />
            </span>
            <span
              className="claw42-speech-bubble-tail absolute w-3 h-3 bg-white/95 rotate-45"
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
