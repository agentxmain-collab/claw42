"use client";

import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";

interface SpeechBubbleProps {
  visible: boolean;
  reduceMotion: boolean;
  side: "left" | "right";
  lines?: string[];
  analysisLine?: string | null;
}

export function SpeechBubble({
  visible,
  reduceMotion,
  side,
  lines,
  analysisLine,
}: SpeechBubbleProps) {
  const { t } = useI18n();
  const resolvedAnalysisLine = analysisLine?.trim() ?? "";
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
      if (resolvedAnalysisLine) {
        lastLineRef.current = resolvedAnalysisLine;
        setSelectedLine(resolvedAnalysisLine);
        return;
      }

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
  }, [visible, pool, poolKey, resolvedAnalysisLine]);

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

  const fallbackLine = selectedLine || pool[0] || "";
  const displayLine = reduceMotion ? resolvedAnalysisLine || fallbackLine : typedLine;

  return (
    <div
      className="claw42-speech-bubble-root pointer-events-none absolute"
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
            className="claw42-speech-bubble relative rounded-2xl bg-white/95 px-4 py-3 font-mono text-[13px] font-medium leading-snug text-gray-900 shadow-[0_8px_32px_rgba(0,0,0,0.3)] md:text-[14px]"
            style={{ width: "min(82vw, 420px)" }}
            data-bubble-mode={resolvedAnalysisLine ? "analysis-summary" : "random-speech"}
            data-analysis-summary-source={resolvedAnalysisLine ? "watch-timeline" : undefined}
            aria-label={t.hero.speechBubbleAriaLabel}
            role="status"
          >
            <span className="inline whitespace-pre-wrap break-words">
              {displayLine}
              <motion.span
                className="ml-[2px] inline-block h-[1.05em] w-[1.5px] rounded-full bg-[#6c4fff] align-[-0.12em] shadow-[0_0_8px_rgba(108,79,255,0.65)]"
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
              className="claw42-speech-bubble-tail absolute h-3 w-3 rotate-45 bg-white/95"
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
