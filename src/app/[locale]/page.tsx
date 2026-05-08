"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { COINW_SKILLS_URL } from "@/lib/constants";
import { trackEvent } from "@/lib/analytics";
import { ScenariosSection } from "@/modules/landing/ScenariosSection";
import { SkillsEcoSection } from "@/modules/landing/SkillsEcoSection";
import { StartTradeSection } from "@/modules/landing/StartTradeSection";
import { HeroScene } from "@/modules/landing/HeroScene";
import { HeroSceneInteractive } from "@/modules/landing/HeroSceneInteractive";
import {
  fadeOnlyVariants,
  fadeScaleVariants,
  fadeUpVariants,
  getFadeUpTransition,
  motionViewport,
} from "@/lib/motion";

const HERO_INTERACTIVE_ENABLED =
  process.env.HERO_INTERACTIVE_ENABLED === "true" ||
  process.env.NEXT_PUBLIC_HERO_INTERACTIVE_ENABLED === "true";

function CopyIcon24() {
  return (
    <span className="relative block size-6" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="absolute left-[12.5%] top-[12.5%] size-[75%]"
        focusable="false"
      >
        <use href="/icons/copy.svg#icon" />
      </svg>
    </span>
  );
}

function CopiedCheckIcon() {
  return (
    <span className="relative block size-6" aria-hidden="true">
      <svg
        className="absolute left-[12.5%] top-[12.5%] size-[75%] text-func-green"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        focusable="false"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    </span>
  );
}

// WhySection 三张卡片按位置绑定品牌图标：
// 0 → why-arena（竞技）, 1 → why-evolve（养成）, 2 → why-ecosystem（生态）
const WHY_ICON_SLUGS = ["why-arena", "why-evolve", "why-ecosystem"] as const;

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
      className={`relative px-6 py-12 md:px-12 md:py-16 lg:px-20 ${className}`}
    >
      {children}
    </motion.section>
  );
}

function QuickStartSection() {
  const { t, locale } = useI18n();
  const reduceMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const command = `npx skills add ${COINW_SKILLS_URL}`;

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard) return;

      await navigator.clipboard.writeText(command);
      trackEvent("quick_start_copy", { locale, surface: "quick_start" });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Section className="mx-auto flex max-w-4xl flex-col items-center">
      <h2 className="gradient-text mb-10 text-center text-3xl font-bold md:text-4xl lg:text-5xl">
        {t.quickStart.title}
      </h2>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={motionViewport}
        variants={fadeScaleVariants(reduceMotion)}
        transition={getFadeUpTransition()}
        className="terminal-glow w-full max-w-2xl overflow-hidden rounded-card border border-border-token-secondary bg-bg-fill-card2"
      >
        <div className="flex items-center gap-2 border-b border-[rgba(158,147,255,0.1)] bg-bg-fill-card1 px-4 pb-[9px] pt-2">
          <div className="flex gap-1.5 opacity-50" aria-hidden="true">
            <span className="size-3 rounded-full bg-func-red" />
            <span className="size-3 rounded-full bg-func-yellow" />
            <span className="size-3 rounded-full bg-func-green" />
          </div>
          <span className="flex-1 text-center text-[10px] font-normal uppercase leading-[12px] text-fg-secondary opacity-50">
            Quick Start Terminal
          </span>
        </div>
        <div className="flex items-center justify-between bg-bg-primary p-6">
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div
              className="flex w-max items-center gap-2 whitespace-nowrap text-[16px] leading-[24px] tracking-[0.15px]"
              aria-label={command}
            >
              <span className="text-brand-purple">$</span>
              <span className="text-fg-primary">npx </span>
              <span className="text-brand-purple-bright">skills add</span>
              <span className="text-fg-primary"> </span>
              <span className="text-brand-purple-bright">{COINW_SKILLS_URL}</span>
              <span className="ml-1 inline-block h-5 w-1 bg-brand-purple" aria-hidden="true" />
            </div>
          </div>
          <motion.button
            onClick={handleCopy}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            className={`copy-btn relative ml-4 shrink-0 text-fg-secondary transition-colors hover:text-fg-primary ${
              copied ? "copied" : ""
            }`}
            title="Copy to clipboard"
            aria-label="Copy quick start command"
          >
            {copied ? <CopiedCheckIcon /> : <CopyIcon24 />}
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
    <Section className="mx-auto max-w-7xl">
      <div className="mb-4 text-center">
        <h2 className="mb-4 text-2xl font-bold leading-tight text-white md:text-3xl lg:text-4xl">
          {t.why.title}
        </h2>
        <p className="mx-auto max-w-4xl text-sm leading-relaxed text-gray-400 md:text-base">
          {t.why.subtitle}
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        {cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial="hidden"
            whileInView="visible"
            viewport={motionViewport}
            variants={fadeUpVariants(reduceMotion)}
            transition={getFadeUpTransition(i * 0.08)}
            whileHover={reduceMotion ? undefined : { y: -8, scale: 1.01 }}
            className="card-glow group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111] p-8"
          >
            <div className="mb-5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a]">
              <Image
                src={`/images/icons/${WHY_ICON_SLUGS[i] ?? WHY_ICON_SLUGS[0]}.png`}
                alt=""
                aria-hidden="true"
                width={48}
                height={48}
                className="h-10 w-10 object-contain"
              />
            </div>
            <h3 className="mb-3 text-xl font-bold text-white">{card.title}</h3>
            <p className="flex-1 text-sm leading-relaxed text-gray-400">{card.desc}</p>
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#6c4fff] to-[#a78bfa] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </motion.div>
        ))}
      </div>

      {t.why.tagline && (
        <p className="mt-10 text-center text-sm italic tracking-wide text-gray-500 md:text-base">
          {t.why.tagline}
        </p>
      )}
    </Section>
  );
}

function StackedLogoGlow() {
  // 双层叠加：底层完整 logo（深灰线条 + 蓝色），顶层仅蓝色像素分离版加 drop-shadow 呼吸。
  // 这样 glow 只从眼睛/嘴/42 这些蓝色部分发出，深灰线条不参与发光（修复 v1 全体发光问题）。
  // 蓝色版 PNG 由色彩分离脚本生成（B > R+15 且 B > G+15）。
  return (
    <span className="relative inline-block w-28 md:w-36">
      <Image
        src="/images/brand/claw42-stacked.png"
        alt="Claw 42"
        width={220}
        height={220}
        className="relative h-auto w-full object-contain"
      />
      <Image
        src="/images/brand/claw42-stacked-blue.png"
        alt=""
        aria-hidden="true"
        width={220}
        height={220}
        className="claw42-blue-breathe pointer-events-none absolute inset-0 h-auto w-full object-contain"
      />
    </span>
  );
}

function DisclaimerSection() {
  const { t, locale } = useI18n();

  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={motionViewport}
      variants={fadeOnlyVariants()}
      transition={getFadeUpTransition()}
      className="relative mt-10 border-t border-white/5 py-10"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-12 lg:px-20">
        <h3 className="mb-6 text-lg font-bold text-white">{t.disclaimer.title}</h3>
        <div className="space-y-4 text-xs leading-relaxed text-gray-500">
          {t.disclaimer.paragraphs.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <a
            href="#top"
            aria-label="Back to top"
            onClick={() => trackEvent("back_to_top_click", { locale })}
            className="group p-4 transition-transform duration-300 hover:scale-[1.03] md:p-5"
          >
            <StackedLogoGlow />
          </a>
        </div>
      </div>
    </motion.section>
  );
}

export default function Home() {
  return (
    <main id="top" className="min-h-screen bg-black">
      {HERO_INTERACTIVE_ENABLED ? <HeroSceneInteractive /> : <HeroScene />}
      <QuickStartSection />
      <ScenariosSection />
      <WhySection />
      <SkillsEcoSection />
      <StartTradeSection />
      <DisclaimerSection />
    </main>
  );
}
