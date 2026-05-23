"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { withBasePath } from "@/lib/basePath";
import { COINW_SKILLS_URL } from "@/lib/constants";
import { setAnalyticsLandingContext, trackEvent } from "@/lib/analytics";
import { ensureLandingSessionCookie } from "@/lib/coinw/landingId";
import {
  landingContextAnalyticsFields,
  type ExternalEntryLandingContext,
} from "@/lib/coinw/landingContext";
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

type CommandSegment = {
  text: string;
  className: string;
};

type ClientLandingPageProps = {
  landingContext: ExternalEntryLandingContext;
};

function useLoopingTypedLength(targetLength: number, reduceMotion: boolean) {
  const [length, setLength] = useState(reduceMotion ? targetLength : 0);

  useEffect(() => {
    if (reduceMotion) {
      setLength(targetLength);
      return;
    }

    let intervalId: number | undefined;
    let timeoutId: number | undefined;

    const startTyping = () => {
      setLength(0);
      intervalId = window.setInterval(() => {
        setLength((current) => {
          const next = Math.min(current + 1, targetLength);
          if (next >= targetLength) {
            window.clearInterval(intervalId);
            timeoutId = window.setTimeout(startTyping, 2200);
          }
          return next;
        });
      }, 34);
    };

    timeoutId = window.setTimeout(startTyping, 360);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [reduceMotion, targetLength]);

  return length;
}

function renderCommandSegments(segments: CommandSegment[], maxLength?: number) {
  let remaining = maxLength ?? Number.POSITIVE_INFINITY;

  return segments.map((segment, index) => {
    const visibleText = segment.text.slice(0, Math.max(0, remaining));
    remaining -= segment.text.length;

    if (!visibleText) return null;

    return (
      <span key={`${segment.text}-${index}`} className={segment.className}>
        {visibleText}
      </span>
    );
  });
}

function CopyIcon24() {
  return (
    <span className="relative block size-6" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="absolute left-[12.5%] top-[12.5%] size-[75%]"
        focusable="false"
      >
        <use href={withBasePath("/icons/copy.svg#icon")} />
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
  const commandSegments: CommandSegment[] = [
    { text: "npx ", className: "text-fg-primary" },
    { text: "skills add", className: "text-brand-purple-bright" },
    { text: " ", className: "text-fg-primary" },
    { text: COINW_SKILLS_URL, className: "text-brand-purple-bright" },
  ];
  const typedLength = useLoopingTypedLength(command.length, reduceMotion ?? false);

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
          <div className="min-w-0 flex-1 overflow-hidden">
            <span className="sr-only">{command}</span>
            <div
              className="flex w-max items-center gap-2 whitespace-nowrap font-mono text-[16px] leading-[24px] tracking-[0.15px]"
              aria-hidden="true"
            >
              <span className="text-brand-purple">$</span>
              <span className="relative">
                <span className="invisible whitespace-pre" aria-hidden="true">
                  {renderCommandSegments(commandSegments)}
                </span>
                <span className="absolute inset-y-0 left-0 whitespace-pre">
                  {renderCommandSegments(commandSegments, typedLength)}
                </span>
              </span>
              <span
                className="quick-start-caret ml-1 inline-block h-5 w-1 bg-brand-purple"
                aria-hidden="true"
              />
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
        <h2 className="mb-4 text-2xl font-bold leading-tight text-fg-primary md:text-3xl lg:text-4xl">
          {t.why.title}
        </h2>
        <p className="mx-auto max-w-4xl text-sm leading-relaxed text-fg-secondary md:text-base">
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
            className="card-glow card-glow-bottom-gradient group relative flex flex-col overflow-hidden rounded-card border border-transparent bg-bg-fill-card1 p-8"
          >
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(173,163,255,0.15)]">
              <Image
                src={withBasePath(`/images/icons/${WHY_ICON_SLUGS[i] ?? WHY_ICON_SLUGS[0]}.svg`)}
                alt=""
                aria-hidden="true"
                width={24}
                height={24}
                unoptimized
                className="h-6 w-6 object-contain"
              />
            </div>
            <h3 className="mb-3 text-xl font-bold text-fg-primary">{card.title}</h3>
            <p className="flex-1 text-sm leading-relaxed text-fg-secondary">{card.desc}</p>
          </motion.div>
        ))}
      </div>

      {t.why.tagline && (
        <p className="mt-10 text-center text-sm italic tracking-wide text-fg-tertiary md:text-base">
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
      className="disclaimer-section relative py-[120px]"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-[32px] px-6 md:px-12 lg:px-[90px]">
        <h2 className="text-3xl font-bold leading-tight text-fg-primary md:text-4xl lg:text-[45px] lg:leading-[52px]">
          {t.disclaimer.title}
        </h2>
        <div className="flex flex-col items-start gap-4 rounded-3xl p-[24px]">
          {t.disclaimer.paragraphs.map((para, i) => (
            <p key={i} className="text-sm leading-[22px] tracking-[0.25px] text-fg-primary">
              {para}
            </p>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

export default function ClientLandingPage({ landingContext }: ClientLandingPageProps) {
  useEffect(() => {
    if (!landingContext.isExternalEntry) return;

    const sessionId = ensureLandingSessionCookie();
    const analyticsContext = landingContextAnalyticsFields(landingContext);
    setAnalyticsLandingContext(analyticsContext);
    trackEvent("claw42_external_entry", {
      landing_id: landingContext.landing_id,
      session_id: sessionId,
      from: landingContext.from,
      sig_valid: landingContext.sig_valid,
      symbol: landingContext.symbol,
      pair: landingContext.pair,
      deep_link: landingContext.deep_link,
    });
    trackEvent("claw42_landing_rendered", {
      landing_id: landingContext.landing_id,
      from: landingContext.from,
      sig_valid: landingContext.sig_valid,
    });
  }, [landingContext]);

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
