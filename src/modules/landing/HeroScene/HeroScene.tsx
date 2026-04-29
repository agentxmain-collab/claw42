"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { COINW_SKILLS_URL } from "@/lib/constants";
import { trackEvent } from "@/lib/analytics";
import { useMarketTicker } from "@/modules/agent-watch/hooks/useAgentAnalysis";
import { useMouseNormalized } from "./useMouseNormalized";
import { useRobotPose, type Pose } from "./useRobotPose";
import { RobotLayer } from "./RobotLayer";
import { PedestalLayer } from "./PedestalLayer";
import { CoinsLayer } from "./CoinsLayer";
import type { CoinSymbol } from "@/modules/agent-watch/types";

/** Simple mobile detection without extra dependencies. */
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

const MOBILE_POSE_CYCLE: Pose[] = ["center", "left", "center", "right"];

/** Auto-cycle pose on mobile: center → left → center → right → repeat every 8 s. */
function useMobilePoseCycle(isMobile: boolean, reduceMotion: boolean): Pose {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!isMobile || reduceMotion) {
      setIdx(0);
      return;
    }
    const timer = setInterval(() => {
      setIdx((prev) => (prev + 1) % MOBILE_POSE_CYCLE.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [isMobile, reduceMotion]);

  if (!isMobile || reduceMotion) return "center";
  return MOBILE_POSE_CYCLE[idx];
}

export function HeroScene() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const reduceMotion = useReducedMotion() ?? false;
  const stageRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [heroCopied, setHeroCopied] = useState(false);
  const { data: tickerData } = useMarketTicker({ enabled: true, intervalMs: 60_000 });

  const handleHeroCtaClick = async () => {
    try {
      if (!navigator.clipboard) return;

      await navigator.clipboard.writeText(t.hero.ctaPrimaryClipboard);
      trackEvent("hero_cta_copy", { locale, surface: "hero_primary" });
      setHeroCopied(true);
      window.setTimeout(() => setHeroCopied(false), 2000);
    } catch (error) {
      console.warn("Clipboard API unavailable", error);
    }
  };

  // Desktop: mouse-driven normalised coordinates. Mobile: always (0, 0).
  const rawMouse = useMouseNormalized(stageRef);
  const mouseX = isMobile ? 0 : rawMouse.x;
  const mouseY = isMobile ? 0 : rawMouse.y;

  // Desktop: pose from mouse. Mobile: auto-cycle.
  const desktopPose = useRobotPose(mouseX, reduceMotion);
  const mobilePose = useMobilePoseCycle(isMobile, reduceMotion);
  const pose = isMobile ? mobilePose : desktopPose;
  const watchPath = `/${locale}/agent`;
  const handleOpenWatch = () => {
    trackEvent("hero_agent_watch_click", { locale, surface: "hero_robot" });
    router.push(watchPath);
  };
  const handleOpenCoinWatch = (symbol: CoinSymbol) => {
    trackEvent("hero_coin_watch_click", { locale, symbol, surface: "hero_coin" });
    router.push(`${watchPath}#${symbol}`);
  };

  return (
    <section
      ref={stageRef}
      className="claw42-hero-scene relative w-full aspect-[4/5] overflow-hidden bg-black pt-[72px] md:aspect-auto md:h-screen md:min-h-[760px] md:max-h-[920px] md:pt-[80px]"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "url('/images/agents/hero-background-glow-1920x1080.png')",
          backgroundPosition: "center bottom",
          backgroundSize: "cover",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.5) 12%, rgba(0,0,0,0.04) 32%, rgba(0,0,0,0.02) 58%, rgba(0,0,0,0.64) 78%, rgba(0,0,0,0.98) 100%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 120% 84% at 50% 46%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.44) 78%, rgba(0,0,0,0.94) 100%)",
        }}
      />
      <motion.div
        className="absolute inset-0 z-[8] pointer-events-none"
        style={{
          backgroundImage: "url('/images/agents/hero-background-glow-1920x1080.png')",
          backgroundPosition: "center bottom",
          backgroundSize: "cover",
          filter: "brightness(1.22) saturate(1.18)",
          mixBlendMode: "screen",
          WebkitMaskImage:
            "linear-gradient(180deg, transparent 38%, black 47%, black 66%, transparent 74%)",
          maskImage:
            "linear-gradient(180deg, transparent 38%, black 47%, black 66%, transparent 74%)",
        }}
        animate={
          reduceMotion
            ? { opacity: 0.1 }
            : {
                opacity: [0.04, 0.14, 0.04],
              }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 3.6, repeat: Infinity, ease: "easeInOut" }
        }
      />

      {/* z-10 Pedestal */}
      <PedestalLayer mouseX={mouseX} mouseY={mouseY} reduceMotion={reduceMotion} />

      {/* z-20/25 Robot */}
      <RobotLayer
        pose={pose}
        mouseX={mouseX}
        mouseY={mouseY}
        reduceMotion={reduceMotion}
        onOpenWatch={handleOpenWatch}
      />

      {/* z-30 Coins */}
      <CoinsLayer
        mouseX={mouseX}
        mouseY={mouseY}
        reduceMotion={reduceMotion}
        tickers={tickerData?.tickers}
        onSelectCoin={handleOpenCoinWatch}
      />

      {/* z-50 Gradient scrim for title readability */}
      <div className="absolute inset-x-0 bottom-0 z-50 h-[48%] bg-gradient-to-t from-black via-black/72 to-transparent pointer-events-none" />

      {/* z-50 Title + CTA overlay */}
      <div className="claw42-hero-copy absolute left-1/2 top-[71%] z-50 flex w-full max-w-3xl -translate-x-1/2 flex-col items-center px-6 text-center">
        <div className="claw42-hero-text flex flex-col items-center">
          <h1 className="mb-3 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl md:text-[44px] lg:text-[48px]">
            {t.hero.title}
          </h1>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base md:text-[17px]">
            {t.hero.subtitle}
          </p>
        </div>
        <div className="claw42-hero-actions flex flex-col items-center justify-center gap-4 pointer-events-auto sm:flex-row">
          <div className="relative">
            <motion.button
              type="button"
              onClick={handleHeroCtaClick}
              whileHover={reduceMotion ? undefined : { scale: 1.05 }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              className="inline-flex min-w-[9.25rem] items-center justify-center rounded-xl bg-[#7c5cff] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#8e6bff] hover:shadow-[0_0_24px_rgba(124,92,255,0.5)] md:text-base"
            >
              {t.hero.ctaPrimary}
            </motion.button>
            <AnimatePresence>
              {heroCopied && (
                <motion.div
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                  transition={{ duration: 0.18 }}
                  className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-md bg-[#7c5cff] text-white text-xs font-semibold shadow-lg z-10"
                >
                  {t.hero.ctaPrimaryCopiedToast}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <motion.a
            href={COINW_SKILLS_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackEvent("hero_api_docs_click", {
                locale,
                surface: "hero_secondary",
              })
            }
            whileHover={reduceMotion ? undefined : { scale: 1.05 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            className="inline-flex min-w-[9.25rem] items-center justify-center rounded-xl border border-white/20 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/15 md:text-base"
          >
            {t.hero.ctaSecondary}
          </motion.a>
        </div>
      </div>
    </section>
  );
}
