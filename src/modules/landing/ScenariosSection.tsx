"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { COINW_SKILLS_URL } from "@/lib/constants";
import { fadeUpVariants, getFadeUpTransition, motionViewport } from "@/lib/motion";

function DailyReportInput() {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      if (!navigator.clipboard) return;

      await navigator.clipboard.writeText(t.scenarios.daily.defaultPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.warn("Clipboard API unavailable", error);
    }
  };

  return (
    <div className="relative flex-1">
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

function TypingDots() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex gap-1 items-end pb-0.5">
      {[0, 1, 2].map((i) =>
        reduceMotion ? (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] opacity-50"
          />
        ) : (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#a78bfa]"
            animate={{ y: [0, -3, 0], opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        )
      )}
    </div>
  );
}

function DailyReportCard({ delay }: { delay: number }) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={motionViewport}
      variants={fadeUpVariants(reduceMotion)}
      transition={getFadeUpTransition(delay)}
      whileHover={reduceMotion ? undefined : { scale: 1.02 }}
      className="bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col shadow-[0_0_40px_-10px_rgba(124,92,255,0.4),0_0_80px_-20px_rgba(255,138,212,0.2)] hover:shadow-[0_0_60px_-8px_rgba(124,92,255,0.6),0_0_120px_-20px_rgba(255,138,212,0.3)] transition-shadow duration-500"
    >
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

      <div className="flex flex-col sm:flex-row items-stretch gap-3 mt-auto">
        <DailyReportInput />
        <motion.a
          href={COINW_SKILLS_URL}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={reduceMotion ? undefined : { scale: 1.05 }}
          whileTap={reduceMotion ? undefined : { scale: 0.98 }}
          className="px-5 py-3 bg-[#7c5cff] text-white text-sm font-semibold rounded-lg hover:bg-[#8e6bff] hover:shadow-[0_0_20px_rgba(124,92,255,0.4)] transition-all shrink-0 inline-flex items-center justify-center"
        >
          {t.scenarios.daily.cta}
        </motion.a>
      </div>
    </motion.div>
  );
}

function ChatPreviewCard({ delay }: { delay: number }) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={motionViewport}
      variants={fadeUpVariants(reduceMotion)}
      transition={getFadeUpTransition(delay)}
      whileHover={reduceMotion ? undefined : { scale: 1.02 }}
      className="bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col shadow-[0_0_40px_-10px_rgba(124,92,255,0.4),0_0_80px_-20px_rgba(255,138,212,0.2)] hover:shadow-[0_0_60px_-8px_rgba(124,92,255,0.6),0_0_120px_-20px_rgba(255,138,212,0.3)] transition-shadow duration-500"
    >
      <div className="rounded-xl p-[1.5px] bg-gradient-to-br from-[#7c5cff] via-[#ff8ad4] to-[#d1ff55] shadow-[0_0_32px_-4px_rgba(124,92,255,0.35)] flex-1">
        <div className="h-full bg-[#0a0a0a] rounded-[10px] p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ff8ad4] via-[#a78bfa] to-[#7c5cff] flex items-center justify-center shadow-[0_0_12px_rgba(167,139,250,0.5)]">
              <span className="text-sm">✨</span>
            </div>
            <span className="text-sm font-semibold text-white">
              {t.scenarios.daily.chatSpeaker}
            </span>
            <TypingDots />
            <span className="text-xs text-gray-500 ml-auto">
              {t.scenarios.daily.chatTime}
            </span>
          </div>

          <div className="space-y-2 text-sm text-gray-300">
            <p className="font-semibold text-white text-sm mb-2">
              {t.scenarios.daily.chatTitle}
            </p>
            <div className="space-y-1.5 text-xs md:text-sm">
              {t.scenarios.daily.chatBullets.map((line, i) => (
                <motion.p
                  key={line}
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={motionViewport}
                  transition={getFadeUpTransition(0.3 + i * 0.06)}
                >
                  • {line}
                </motion.p>
              ))}
            </div>
          </div>
        </div>
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
      whileHover={reduceMotion ? undefined : { scale: 1.02 }}
      className="bg-[#111] border border-white/10 rounded-2xl p-5 shadow-[0_0_16px_-8px_rgba(124,92,255,0.25)] hover:shadow-[0_0_28px_-6px_rgba(124,92,255,0.4)] transition-shadow duration-500"
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
      whileHover={reduceMotion ? undefined : { scale: 1.02 }}
      className="bg-[#111] border border-white/10 rounded-2xl p-5 shadow-[0_0_16px_-8px_rgba(124,92,255,0.25)] hover:shadow-[0_0_28px_-6px_rgba(124,92,255,0.4)] transition-shadow duration-500"
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <DailyReportCard delay={0} />
          <ChatPreviewCard delay={0.08} />
        </div>
        <div className="flex flex-col gap-4">
          <RealtimeMonitorCard delay={0.16} />
          <AutoTradeCard delay={0.24} />
        </div>
      </div>
    </motion.section>
  );
}
