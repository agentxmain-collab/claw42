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
      className="claw42-hero-scene relative aspect-[4/5] w-full overflow-hidden bg-black pt-[72px] md:aspect-[21/9] md:pt-[80px]"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 50% 40%, rgba(115, 90, 255, 0.84) 0%, rgba(96, 70, 235, 0.64) 18%, rgba(58, 36, 150, 0.48) 36%, rgba(18, 12, 42, 0.18) 56%, rgba(0, 0, 0, 0) 74%),
            radial-gradient(circle at 50% 54%, rgba(255, 255, 255, 0.12) 0%, rgba(198, 189, 255, 0.08) 14%, rgba(14, 9, 34, 0) 34%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.84) 10%, rgba(0,0,0,0.28) 24%, rgba(0,0,0,0.1) 34%, rgba(0,0,0,0.08) 66%, rgba(0,0,0,0.34) 80%, rgba(0,0,0,0.8) 92%, rgba(0,0,0,0.98) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 128% 88% at 50% 50%, rgba(0,0,0,0) 46%, rgba(0,0,0,0.44) 74%, rgba(0,0,0,0.92) 100%)",
        }}
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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 h-[42%] bg-gradient-to-t from-black via-black/80 to-transparent" />

      {/* z-50 Title + CTA overlay */}
      <div className="claw42-hero-copy absolute bottom-[6%] left-1/2 z-50 flex w-full max-w-4xl -translate-x-1/2 flex-col items-center px-6 text-center">
        <div className="claw42-hero-text flex flex-col items-center">
          <h1 className="mb-4 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl lg:text-[56px]">
            {t.hero.title}
          </h1>
          <p className="mb-8 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base md:text-lg">
            {t.hero.subtitle}
          </p>
        </div>
        <div className="claw42-hero-actions pointer-events-auto flex flex-col items-center justify-center gap-4 sm:flex-row">
          <div className="relative">
            <motion.button
              type="button"
              onClick={handleHeroCtaClick}
              whileHover={reduceMotion ? undefined : { scale: 1.05 }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              className="inline-flex min-w-[11rem] items-center justify-center rounded-xl bg-[#7c5cff] px-8 py-3 text-base font-semibold text-white transition-all hover:bg-[#8e6bff] hover:shadow-[0_0_24px_rgba(124,92,255,0.5)]"
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
                  className="absolute -top-10 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#7c5cff] px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
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
            className="inline-flex min-w-[11rem] items-center justify-center rounded-xl border border-white/20 bg-white/10 px-8 py-3 text-base font-semibold text-white transition-all hover:bg-white/15"
          >
            {t.hero.ctaSecondary}
          </motion.a>
        </div>
      </div>
    </section>
  );
}
