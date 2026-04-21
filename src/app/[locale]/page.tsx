"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { COINW_SKILLS_URL } from "@/lib/constants";
import { ScenariosSection } from "@/modules/landing/ScenariosSection";
import { SkillsEcoSection } from "@/modules/landing/SkillsEcoSection";
import {
  fadeOnlyVariants,
  fadeScaleVariants,
  fadeUpVariants,
  getFadeUpTransition,
  motionViewport,
} from "@/lib/motion";

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

function Section({
  children,
  className = "",
  id,
  variant = "fadeUp",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  variant?: "fadeUp" | "scale" | "fade";
}) {
  const reduceMotion = useReducedMotion();
  const variants =
    variant === "scale"
      ? fadeScaleVariants(reduceMotion)
      : variant === "fade"
        ? fadeOnlyVariants()
        : fadeUpVariants(reduceMotion);

  return (
    <motion.section
      id={id}
      initial="hidden"
      whileInView="visible"
      viewport={motionViewport}
      variants={variants}
      transition={getFadeUpTransition()}
      className={`relative py-12 md:py-16 px-6 md:px-12 lg:px-20 ${className}`}
    >
      {children}
    </motion.section>
  );
}

function HeroSection() {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative pt-[72px] md:pt-[80px] pb-12">
      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="relative w-full hero-fade mb-8 md:mb-12 aspect-[16/5] overflow-hidden"
      >
        <Image
          src="/images/hero-robot-scene.png"
          alt="Claw 42 AI Trading"
          fill
          sizes="100vw"
          className="object-cover object-center"
          priority
        />
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={motionViewport}
        variants={fadeUpVariants(reduceMotion)}
        transition={getFadeUpTransition()}
        className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto"
      >
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] font-bold tracking-tight mb-4 text-white leading-tight">
          {t.hero.title}
        </h1>
        <p className="text-gray-400 text-sm sm:text-base md:text-lg max-w-2xl mb-8 leading-relaxed">
          {t.hero.subtitle}
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <motion.a
            href={COINW_SKILLS_URL}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={reduceMotion ? undefined : { scale: 1.05 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            className="px-8 py-3 bg-[#7c5cff] text-white text-base font-semibold rounded-xl hover:bg-[#8e6bff] hover:shadow-[0_0_24px_rgba(124,92,255,0.5)] transition-all inline-flex items-center justify-center"
          >
            {t.hero.ctaPrimary}
          </motion.a>
          <motion.a
            href={COINW_SKILLS_URL}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={reduceMotion ? undefined : { scale: 1.05 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            className="px-8 py-3 bg-white/10 border border-white/20 text-white text-base font-semibold rounded-xl hover:bg-white/15 transition-all inline-flex items-center justify-center"
          >
            {t.hero.ctaSecondary}
          </motion.a>
        </div>
      </motion.div>
    </section>
  );
}

function QuickStartSection() {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const command = `npx skills add ${COINW_SKILLS_URL}`;

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard) return;

      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Section className="flex flex-col items-center max-w-4xl mx-auto">
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-10 gradient-text">
        {t.quickStart.title}
      </h2>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={motionViewport}
        variants={fadeScaleVariants(reduceMotion)}
        transition={getFadeUpTransition()}
        className="w-full max-w-2xl terminal-glow rounded-xl overflow-hidden border border-white/10 bg-[#1a1a1a]"
      >
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
        <div className="flex items-center justify-between p-5 font-mono text-xs md:text-sm">
          <div className="flex-1 leading-relaxed whitespace-nowrap min-w-0">
            <span className="text-gray-500">$ </span>
            <span className="text-white">npx </span>
            <span className="text-green-400">skills add</span>
            <span className="text-white"> </span>
            <span className="text-[#7c5cff]">{COINW_SKILLS_URL}</span>
          </div>
          <motion.button
            onClick={handleCopy}
            whileHover={reduceMotion ? undefined : { scale: 1.05 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
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
          </motion.button>
        </div>
      </motion.div>
    </Section>
  );
}

function WhySection() {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const cards = t.why.cards;

  return (
    <Section className="max-w-7xl mx-auto">
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
            key={card.title}
            initial="hidden"
            whileInView="visible"
            viewport={motionViewport}
            variants={fadeUpVariants(reduceMotion)}
            transition={getFadeUpTransition(i * 0.08)}
            whileHover={reduceMotion ? undefined : { y: -4 }}
            className="card-glow relative bg-[#111] border border-white/10 rounded-2xl p-8 flex flex-col overflow-hidden"
          >
            <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] border border-white/10 flex items-center justify-center mb-5 text-brand-purple">
              <TrendingUpIcon />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">{card.title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed flex-1">{card.desc}</p>
            {i === 1 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#6c4fff] to-[#a78bfa]" />
            )}
          </motion.div>
        ))}
      </div>

      {t.why.tagline && (
        <p className="text-center text-gray-500 text-sm md:text-base italic tracking-wide mt-10">
          {t.why.tagline}
        </p>
      )}
    </Section>
  );
}

function DisclaimerSection() {
  const { t } = useI18n();

  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={motionViewport}
      variants={fadeOnlyVariants()}
      transition={getFadeUpTransition()}
      className="relative border-t border-white/5 mt-10 py-10"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20">
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

export default function Home() {
  return (
    <main className="bg-black min-h-screen">
      <HeroSection />
      <QuickStartSection />
      <ScenariosSection />
      <WhySection />
      <SkillsEcoSection />
      <DisclaimerSection />
    </main>
  );
}
