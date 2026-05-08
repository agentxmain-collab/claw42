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
        className="min-h-[48px] w-full cursor-pointer rounded-lg border border-white/10 bg-[#0a0a0a] px-4 py-3 text-left text-sm text-gray-400 transition-colors hover:border-[#7c5cff]/40 hover:text-gray-300"
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
            className="absolute -top-10 left-0 rounded-md bg-[#7c5cff] px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
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
      className="card-glow h-full rounded-2xl border border-white/10 bg-[#111] p-6 transition-[box-shadow,border-color,background-color] duration-500 md:p-8"
    >
      <div className="grid h-full grid-cols-1 gap-6 md:gap-8 lg:grid-cols-2">
        <div className="flex h-full flex-col">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-bold text-white md:text-2xl">{t.scenarios.daily.title}</h3>
            <span className="rounded-full border border-[#7c5cff]/30 bg-[#7c5cff]/20 px-2.5 py-1 text-xs font-bold text-[#d7ccff]">
              {t.scenarios.daily.badge}
            </span>
          </div>
          <p className="mb-6 text-sm leading-relaxed text-gray-400 md:text-base">
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
                className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#7c5cff] px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-[#8e6bff] hover:shadow-[0_0_20px_rgba(124,92,255,0.4)]"
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
                    className="absolute -top-10 left-0 z-10 whitespace-nowrap rounded-md bg-[#7c5cff] px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
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
      className="card-glow flex-1 rounded-2xl border border-white/10 bg-[#111] p-5 transition-[box-shadow,border-color,background-color] duration-500"
    >
      <h3 className="mb-2 text-base font-semibold text-white md:text-lg">
        {t.scenarios.realtime.title}
      </h3>
      <p className="text-xs leading-relaxed text-gray-400 md:text-sm">
        {t.scenarios.realtime.desc}
      </p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-gray-300">
        <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.7)]" />
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
      className="card-glow flex-1 rounded-2xl border border-white/10 bg-[#111] p-5 transition-[box-shadow,border-color,background-color] duration-500"
    >
      <h3 className="mb-2 text-base font-semibold text-white md:text-lg">
        {t.scenarios.autoTrade.title}
      </h3>
      <p className="text-xs leading-relaxed text-gray-400 md:text-sm">
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
      className="relative mx-auto max-w-7xl px-6 py-16 md:px-12 md:py-20 lg:px-20"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-60">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,92,255,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,138,212,0.08),transparent_50%)]" />
      </div>

      <div className="mb-10 text-center">
        <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl lg:text-5xl">
          {t.scenarios.sectionTitle}
        </h2>
        <p className="mx-auto max-w-3xl text-base leading-relaxed text-gray-400 md:text-lg">
          {t.scenarios.sectionSubtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
        <div className="h-full lg:col-span-2">
          <DailyReportCard delay={0} />
        </div>
        <div className="flex h-full flex-col gap-4">
          <RealtimeMonitorCard delay={0.16} />
          <AutoTradeCard delay={0.24} />
        </div>
      </div>
    </motion.section>
  );
}
