"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { trackEvent } from "@/lib/analytics";
import { fadeUpVariants, getFadeUpTransition, motionViewport } from "@/lib/motion";
import DailyBriefCard from "@/modules/landing/DailyBriefCard";

function DailyReportInput() {
  const { t, locale } = useI18n();
  const reduceMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      if (!navigator.clipboard) return;

      await navigator.clipboard.writeText(t.scenarios.daily.defaultPrompt);
      trackEvent("daily_prompt_copy", { locale, surface: "daily_input" });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.warn("Clipboard API unavailable", error);
    }
  };

  return (
    <div className="relative w-full flex-1">
      <motion.button
        type="button"
        onClick={handleClick}
        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
        className="w-full min-h-[48px] text-left bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3 text-sm text-gray-400 hover:border-[#7c5cff]/40 hover:text-gray-300 transition-colors cursor-pointer"
      >
        {t.scenarios.daily.inputPlaceholder}
      </motion.button>
      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
            transition={{ duration: 0.18 }}
            className="absolute -top-10 left-0 px-3 py-1.5 rounded-md bg-[#7c5cff] text-white text-xs font-semibold shadow-lg"
          >
            {t.scenarios.daily.copiedToast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DailyReportCard({ delay }: { delay: number }) {
  const { t, locale } = useI18n();
  const reduceMotion = useReducedMotion();
  const [ctaCopied, setCtaCopied] = useState(false);

  const handleCtaClick = async () => {
    try {
      if (!navigator.clipboard) return;

      await navigator.clipboard.writeText(t.scenarios.daily.ctaClipboard);
      trackEvent("daily_cta_copy", { locale, surface: "daily_cta" });
      setCtaCopied(true);
      window.setTimeout(() => setCtaCopied(false), 2000);
    } catch (error) {
      console.warn("Clipboard API unavailable", error);
    }
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={motionViewport}
      variants={fadeUpVariants(reduceMotion)}
      transition={getFadeUpTransition(delay)}
      whileHover={reduceMotion ? undefined : { y: -8, scale: 1.01 }}
      className="card-glow h-full bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 transition-[box-shadow,border-color,background-color] duration-500"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 h-full">
        <div className="flex flex-col h-full">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h3 className="text-xl md:text-2xl font-bold text-white">
              {t.scenarios.daily.title}
            </h3>
            <span className="px-2.5 py-1 text-xs font-bold bg-[#7c5cff]/20 text-[#d7ccff] rounded-full border border-[#7c5cff]/30">
              {t.scenarios.daily.badge}
            </span>
          </div>
          <p className="text-gray-400 text-sm md:text-base leading-relaxed mb-6">
            {t.scenarios.daily.desc}
          </p>

          <div className="mt-auto flex flex-col items-start gap-5">
            <DailyReportInput />
            <div className="relative">
              <motion.button
                type="button"
                onClick={handleCtaClick}
                whileHover={reduceMotion ? undefined : { scale: 1.05 }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                className="px-5 py-3 bg-[#7c5cff] text-white text-sm font-semibold rounded-lg hover:bg-[#8e6bff] hover:shadow-[0_0_20px_rgba(124,92,255,0.4)] transition-all shrink-0 inline-flex items-center justify-center"
              >
                {t.scenarios.daily.cta}
              </motion.button>
              <AnimatePresence>
                {ctaCopied && (
                  <motion.div
                    initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                    transition={{ duration: 0.18 }}
                    className="absolute -top-10 left-0 whitespace-nowrap px-3 py-1.5 rounded-md bg-[#7c5cff] text-white text-xs font-semibold shadow-lg z-10"
                  >
                    {t.scenarios.daily.ctaCopiedToast}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <DailyBriefCard delay={delay + 0.08} />
      </div>
    </motion.div>
  );
}

function RealtimeMonitorCard({ delay }: { delay: number }) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={motionViewport}
      variants={fadeUpVariants(reduceMotion)}
      transition={getFadeUpTransition(delay)}
      whileHover={reduceMotion ? undefined : { y: -8, scale: 1.01 }}
      className="card-glow flex-1 bg-[#111] border border-white/10 rounded-2xl p-5 transition-[box-shadow,border-color,background-color] duration-500"
    >
      <h3 className="text-base md:text-lg font-semibold text-white mb-2">
        {t.scenarios.realtime.title}
      </h3>
      <p className="text-gray-400 text-xs md:text-sm leading-relaxed">
        {t.scenarios.realtime.desc}
      </p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-mono text-gray-300">
        <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.7)]" />
        {t.scenarios.realtime.ticker}
      </div>
    </motion.div>
  );
}

function AutoTradeCard({ delay }: { delay: number }) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={motionViewport}
      variants={fadeUpVariants(reduceMotion)}
      transition={getFadeUpTransition(delay)}
      whileHover={reduceMotion ? undefined : { y: -8, scale: 1.01 }}
      className="card-glow flex-1 bg-[#111] border border-white/10 rounded-2xl p-5 transition-[box-shadow,border-color,background-color] duration-500"
    >
      <h3 className="text-base md:text-lg font-semibold text-white mb-2">
        {t.scenarios.autoTrade.title}
      </h3>
      <p className="text-gray-400 text-xs md:text-sm leading-relaxed">
        {t.scenarios.autoTrade.desc}
      </p>
      <span className="mt-4 inline-flex text-xs font-semibold text-[#d1ff55]">
        {t.scenarios.autoTrade.cta}
      </span>
    </motion.div>
  );
}

export function ScenariosSection() {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={motionViewport}
      variants={fadeUpVariants(reduceMotion)}
      transition={getFadeUpTransition()}
      className="relative max-w-7xl mx-auto px-6 md:px-12 lg:px-20 py-16 md:py-20"
    >
      <div className="absolute inset-0 pointer-events-none -z-10 opacity-60">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,92,255,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,138,212,0.08),transparent_50%)]" />
      </div>

      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-white">
          {t.scenarios.sectionTitle}
        </h2>
        <p className="text-gray-400 text-base md:text-lg max-w-3xl mx-auto leading-relaxed">
          {t.scenarios.sectionSubtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-2 h-full">
          <DailyReportCard delay={0} />
        </div>
        <div className="flex flex-col gap-4 h-full">
          <RealtimeMonitorCard delay={0.16} />
          <AutoTradeCard delay={0.24} />
        </div>
      </div>
    </motion.section>
  );
}
