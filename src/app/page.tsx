"use client";

import Image from "next/image";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { SkillsEcoSection } from "@/modules/landing/SkillsEcoSection";
import { fadeUp, fadeIn, fadeInScale } from "@/lib/motion";

/* ─────────── Icons ─────────── */
function ClipboardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
  );
}

function TrendingUpIcon() {
  return (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  );
}

/* ─────────── Reduced-motion helper ─────────── */
function useMotionProps(variants: Record<string, unknown>) {
  const prefersReducedMotion = useReducedMotion();
  if (prefersReducedMotion) {
    return {
      initial: { opacity: 0 },
      whileInView: { opacity: 1 },
      viewport: { once: true, amount: 0.2 },
      transition: { duration: 0.6 },
    };
  }
  return variants;
}

/* ═══════════════════════════════════════════════════
   HERO SECTION
   ═══════════════════════════════════════════════════ */
function HeroSection() {
  const { t } = useI18n();
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="relative pt-24 md:pt-28 pb-12">
      {/* Hero background image — floating animation */}
      <motion.div
        animate={prefersReducedMotion ? {} : { y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="relative w-full hero-fade mb-8 md:mb-12"
      >
        <Image
          src="/images/hero-robot-scene.png"
          alt="Claw 42 AI Trading"
          width={1440}
          height={548}
          className="w-full h-auto object-cover"
          priority
        />
      </motion.div>

      {/* Content — completely independent from hero image, no negative margins */}
      <motion.div
        {...useMotionProps(fadeUp)}
        className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto"
      >
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] font-bold tracking-tight mb-4 text-white leading-tight">
          {t.hero.title}
        </h1>
        <p className="text-gray-400 text-sm sm:text-base md:text-lg max-w-2xl mb-8 leading-relaxed">
          {t.hero.subtitle}
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="px-8 py-3 rounded-full bg-[#d1ff55] text-black font-semibold text-base hover:brightness-110 transition-all"
          >
            {t.hero.ctaPrimary}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="px-8 py-3 rounded-full border border-white/30 text-white font-semibold text-base hover:border-white/60 transition-all"
          >
            {t.hero.ctaSecondary}
          </motion.button>
        </div>
      </motion.div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════
   QUICK START SECTION
   ═══════════════════════════════════════════════════ */
function QuickStartSection() {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const command = "pip install claw42-sdk && claw42 run daily-report";

  const handleCopy = () => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.section
      {...useMotionProps(fadeUp)}
      className="relative py-12 md:py-16 px-6 md:px-12 lg:px-20 flex flex-col items-center max-w-4xl mx-auto"
    >
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-10 gradient-text">
        {t.quickStart.title}
      </h2>

      {/* Terminal window */}
      <motion.div
        {...useMotionProps(fadeInScale)}
        className="w-full max-w-2xl terminal-glow rounded-xl overflow-hidden border border-white/10 bg-[#1a1a1a]"
      >
        {/* macOS title bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#111] border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
            <span className="ml-3 text-xs text-gray-500 font-mono uppercase tracking-wider">
              Quick Start Terminal
            </span>
          </div>
        </div>
        {/* Code content */}
        <div className="flex items-center justify-between p-5 font-mono text-sm md:text-base">
          <div className="leading-relaxed">
            <span className="text-gray-500">$ </span>
            <span className="text-white">pip install </span>
            <span className="text-green-400">claw42-sdk</span>
            <span className="text-white"> && </span>
            <span className="text-white">claw42 run </span>
            <span className="text-green-400">daily-report</span>
          </div>
          <button
            onClick={handleCopy}
            className="relative ml-4 p-2 text-gray-400 hover:text-white transition-colors shrink-0 copy-btn"
            title="Copy to clipboard"
          >
            {copied ? (
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <ClipboardIcon />
            )}
          </button>
        </div>
      </motion.div>
    </motion.section>
  );
}

/* ═══════════════════════════════════════════════════
   SCENARIOS SECTION (Bento Grid)
   ═══════════════════════════════════════════════════ */
function ScenariosSection() {
  const { t } = useI18n();
  const prefersReducedMotion = useReducedMotion();

  const cardMotion = (i: number) =>
    prefersReducedMotion
      ? { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true }, transition: { duration: 0.6, delay: i * 0.08 } }
      : { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.6, ease: "easeOut", delay: i * 0.08 } };

  const bulletMotion = (parentDelay: number, bulletIndex: number) =>
    prefersReducedMotion
      ? { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true }, transition: { duration: 0.4, delay: parentDelay + bulletIndex * 0.06 } }
      : { initial: { opacity: 0, y: 8 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.4, ease: "easeOut", delay: parentDelay + bulletIndex * 0.06 } };

  return (
    <motion.section
      {...useMotionProps(fadeUp)}
      className="relative py-12 md:py-16 px-6 md:px-12 lg:px-20 max-w-7xl mx-auto"
    >
      {/* Nebula background glow */}
      <div className="absolute inset-0 pointer-events-none -z-10 opacity-60">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,92,255,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,138,212,0.08),transparent_50%)]" />
      </div>

      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 text-white">
          {t.scenarios.sectionTitle}
        </h2>
        <p className="text-gray-400 text-base md:text-lg max-w-3xl mx-auto leading-relaxed">
          {t.scenarios.sectionSubtitle}
        </p>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT LARGE CARD */}
        <motion.div
          {...cardMotion(0)}
          whileHover={{ scale: 1.02 }}
          className="card-glow bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col lg:row-span-2
                     shadow-[0_0_40px_-10px_rgba(124,92,255,0.4),0_0_80px_-20px_rgba(255,138,212,0.2)]
                     hover:shadow-[0_0_60px_-8px_rgba(124,92,255,0.6),0_0_120px_-20px_rgba(255,138,212,0.3)]
                     transition-shadow duration-500"
        >
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-xl md:text-2xl font-bold text-white">{t.scenarios.daily.title}</h3>
            <span className="px-2.5 py-1 text-xs font-bold bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
              {t.scenarios.daily.badge}
            </span>
          </div>
          <p className="text-gray-400 text-sm md:text-base leading-relaxed mb-6">
            {t.scenarios.daily.desc}
          </p>

          {/* Input field — purple CTA */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 text-sm text-gray-500">
              {t.scenarios.daily.inputPlaceholder}
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="px-5 py-3 bg-[#7c5cff] text-white text-sm font-semibold rounded-lg
                         hover:bg-[#8e6bff] hover:shadow-[0_0_20px_rgba(124,92,255,0.4)]
                         transition-all shrink-0"
            >
              {t.scenarios.daily.cta}
            </motion.button>
          </div>

          {/* Chat preview card — rainbow gradient border */}
          <div className="flex-1 mt-auto rounded-xl p-[1.5px]
                          bg-gradient-to-br from-[#7c5cff] via-[#ff8ad4] to-[#d1ff55]
                          shadow-[0_0_32px_-4px_rgba(124,92,255,0.35)]">
            <div className="h-full bg-[#0a0a0a] rounded-[10px] p-5">
              <div className="flex items-center gap-2 mb-4">
                {/* Gradient avatar */}
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ff8ad4] via-[#a78bfa] to-[#7c5cff]
                                flex items-center justify-center shadow-[0_0_12px_rgba(167,139,250,0.5)]">
                  <span className="text-sm">✨</span>
                </div>
                <span className="text-sm font-semibold text-white">{t.scenarios.daily.chatSpeaker}</span>
                <span className="text-xs text-gray-500 ml-auto">{t.scenarios.daily.chatTime}</span>
              </div>
              <div className="space-y-2 text-sm text-gray-300">
                <p className="font-semibold text-white text-sm mb-2">{t.scenarios.daily.chatTitle}</p>
                <div className="space-y-1.5 text-xs md:text-sm">
                  {t.scenarios.daily.chatBullets.map((line, i) => (
                    <motion.p key={i} {...bulletMotion(0.3, i)} className="flex items-start gap-2">
                      <span className="text-[#d1ff55] mt-1">●</span>
                      <span className="text-gray-300">{line}</span>
                    </motion.p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* RIGHT TOP CARD */}
        <motion.div
          {...cardMotion(1)}
          whileHover={{ scale: 1.02 }}
          className="card-glow bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col
                     shadow-[0_0_24px_-10px_rgba(124,92,255,0.3)]
                     hover:shadow-[0_0_40px_-8px_rgba(124,92,255,0.5)]
                     transition-shadow duration-500"
        >
          <h3 className="text-xl font-bold text-white mb-2">{t.scenarios.realtime.title}</h3>
          <p className="text-gray-400 text-sm leading-relaxed mb-5">
            {t.scenarios.realtime.desc}
          </p>
          <div className="flex-1 bg-[#1a1a1a] rounded-xl min-h-[120px] flex items-center justify-center">
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 text-2xl font-mono font-bold text-white mb-2">
                <span className="text-green-400">📈</span>
                <span>$67,432</span>
                <span className="text-sm text-green-400">+2.3%</span>
              </div>
              <p className="text-xs text-gray-500">{t.scenarios.realtime.ticker}</p>
            </div>
          </div>
        </motion.div>

        {/* RIGHT BOTTOM CARD */}
        <motion.div
          {...cardMotion(2)}
          whileHover={{ scale: 1.02 }}
          className="card-glow bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col
                     shadow-[0_0_24px_-10px_rgba(124,92,255,0.3)]
                     hover:shadow-[0_0_40px_-8px_rgba(124,92,255,0.5)]
                     transition-shadow duration-500"
        >
          <h3 className="text-xl font-bold text-white mb-2">{t.scenarios.autoTrade.title}</h3>
          <p className="text-gray-400 text-sm leading-relaxed mb-5">
            {t.scenarios.autoTrade.desc}
          </p>
          <div className="flex-1 bg-[#1a1a1a] rounded-xl min-h-[120px] flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl mb-2">🔑</div>
              <p className="text-sm text-gray-400">{t.scenarios.autoTrade.cta}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}

/* ═══════════════════════════════════════════════════
   WHY SECTION
   ═══════════════════════════════════════════════════ */
function WhySection() {
  const { t } = useI18n();
  const prefersReducedMotion = useReducedMotion();
  const cards = t.why.cards;

  const cardMotion = (i: number) =>
    prefersReducedMotion
      ? { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true }, transition: { duration: 0.6, delay: i * 0.08 } }
      : { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.6, ease: "easeOut", delay: i * 0.08 } };

  return (
    <motion.section
      {...useMotionProps(fadeUp)}
      className="relative py-12 md:py-16 px-6 md:px-12 lg:px-20 max-w-7xl mx-auto"
    >
      <div className="text-center mb-4">
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 text-white leading-tight">
          {t.why.title}
        </h2>
        <p className="text-gray-400 text-sm md:text-base max-w-4xl mx-auto leading-relaxed">
          {t.why.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            {...cardMotion(i)}
            whileHover={{ y: -4 }}
            className="card-glow relative bg-[#111] border border-white/10 rounded-2xl p-8 flex flex-col overflow-hidden"
          >
            <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] border border-white/10 flex items-center justify-center mb-5 text-brand-purple">
              <TrendingUpIcon />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">{card.title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed flex-1">{card.desc}</p>
            {/* Purple gradient bar at bottom for highlighted card (index 1) */}
            {i === 1 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#6c4fff] to-[#a78bfa]" />
            )}
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

/* ═══════════════════════════════════════════════════
   DISCLAIMER SECTION
   ═══════════════════════════════════════════════════ */
function DisclaimerSection() {
  const { t } = useI18n();
  return (
    <motion.section
      {...useMotionProps(fadeIn)}
      className="relative border-t border-white/5 mt-10 py-10 px-6 md:px-12 lg:px-20"
    >
      <div className="max-w-5xl mx-auto">
        <h3 className="text-white font-bold text-lg mb-6">{t.disclaimer.title}</h3>
        <div className="space-y-4 text-gray-500 text-xs leading-relaxed">
          {t.disclaimer.paragraphs.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

/* ═══════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════ */
export default function Home() {
  return (
    <main className="bg-black min-h-screen">
      <HeroSection />
      <QuickStartSection />
      <ScenariosSection />
      <SkillsEcoSection />
      <WhySection />
      <DisclaimerSection />
    </main>
  );
}
