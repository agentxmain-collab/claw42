"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { COINW_SKILLS_URL } from "@/lib/constants";
import { trackEvent } from "@/lib/analytics";
import { PedestalLayer } from "@/modules/landing/HeroScene/PedestalLayer";
import { RobotLayer } from "@/modules/landing/HeroScene/RobotLayer";
import { heroStageCssVars } from "@/modules/landing/HeroScene/heroStageMotion";
import { useHeroScrollDepth } from "@/modules/landing/HeroScene/useHeroScrollDepth";
import { useMouseNormalized } from "@/modules/landing/HeroScene/useMouseNormalized";
import { useRobotPose, type Pose } from "@/modules/landing/HeroScene/useRobotPose";
import { ClawAnimation, type CoinSlotId } from "./components/ClawAnimation";
import { HeroMiniPlayer } from "./components/HeroMiniPlayer";
import { HintArrow } from "./components/HintArrow";
import { TrendingCoinSlot } from "./components/TrendingCoinSlot";
import { useMiniPlayer } from "./hooks/useMiniPlayer";
import { useTrendingCoins } from "./hooks/useTrendingCoins";
import type { HeroTrendingCoin } from "./types/trending-coin";

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

function useMobilePoseCycle(isMobile: boolean, reduceMotion: boolean): Pose {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!isMobile || reduceMotion) {
      setIdx(0);
      return;
    }

    const timer = window.setInterval(() => {
      setIdx((prev) => (prev + 1) % MOBILE_POSE_CYCLE.length);
    }, 8000);

    return () => window.clearInterval(timer);
  }, [isMobile, reduceMotion]);

  if (!isMobile || reduceMotion) return "center";
  return MOBILE_POSE_CYCLE[idx];
}

const desktopSlotClass: Record<CoinSlotId, string> = {
  "north-west": "left-[9%] top-[21%]",
  "north-east": "right-[9%] top-[21%]",
  "south-west": "left-[15%] top-[48%]",
  "south-east": "right-[15%] top-[48%]",
};

const slotIds: CoinSlotId[] = ["north-west", "north-east", "south-west", "south-east"];

type InteractiveStageStyle = CSSProperties & Record<`--claw42-hero-${string}`, string>;

function buildStageStyle(scrollDepth: number): InteractiveStageStyle {
  return {
    ...heroStageCssVars(scrollDepth),
    "--claw42-hero-robot-bottom": "43%",
    "--claw42-hero-robot-width": "min(320px, 19vw)",
    "--claw42-hero-pedestal-bottom": "32%",
    "--claw42-hero-pedestal-width": "min(438px, 24vw)",
    "--claw42-hero-pedestal-glow-bottom": "38%",
    "--claw42-hero-pedestal-beam-bottom": "39%",
    "--claw42-hero-pedestal-rays-bottom": "40%",
    "--claw42-hero-pedestal-top-glow-bottom": "44%",
    "--claw42-hero-pedestal-orb-bottom": "43%",
  };
}

export function HeroSceneInteractive() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const reduceMotion = useReducedMotion() ?? false;
  const stageRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [heroCopied, setHeroCopied] = useState(false);
  const { coins, isLoading } = useTrendingCoins();
  const miniPlayer = useMiniPlayer();
  const scrollDepth = useHeroScrollDepth(stageRef, reduceMotion);
  const stageStyle = buildStageStyle(scrollDepth);
  const rawMouse = useMouseNormalized(stageRef);
  const mouseX = isMobile ? 0 : rawMouse.x;
  const mouseY = isMobile ? 0 : rawMouse.y;
  const desktopPose = useRobotPose(mouseX, reduceMotion);
  const mobilePose = useMobilePoseCycle(isMobile, reduceMotion);
  const pose = isMobile ? mobilePose : desktopPose;
  const selectedIndex = coins.findIndex((coin) => coin.symbol === miniPlayer.selectedCoin?.symbol);
  const activeSlot = selectedIndex >= 0 ? slotIds[selectedIndex] : null;

  const handleHeroCtaClick = async () => {
    try {
      if (!navigator.clipboard) return;

      await navigator.clipboard.writeText(t.hero.ctaPrimaryClipboard);
      trackEvent("hero_cta_copy", { locale, surface: "hero_interactive_primary" });
      setHeroCopied(true);
      window.setTimeout(() => setHeroCopied(false), 2000);
    } catch (error) {
      console.warn("Clipboard API unavailable", error);
    }
  };

  const handleOpenWatch = () => {
    trackEvent("hero_agent_watch_click", { locale, surface: "hero_interactive_robot" });
    router.push(`/${locale}/agent`);
  };

  const handleSelectCoin = (coin: HeroTrendingCoin) => {
    trackEvent("hero_coin_watch_click", {
      locale,
      symbol: coin.symbol,
      surface: "hero_interactive_coin",
    });
    void miniPlayer.selectCoin(coin);
  };

  return (
    <section
      ref={stageRef}
      className="relative w-full min-h-[800px] overflow-hidden bg-black pt-[72px] md:h-screen md:min-h-[760px] md:max-h-[920px] md:pt-[80px]"
      style={stageStyle}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "url('/images/agents/hero-background-glow-1920x1080.png')",
          backgroundPosition: "center bottom",
          backgroundSize: "cover",
          transform: "translate3d(0, var(--claw42-hero-depth-bg-y, 0px), 0)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.5) 12%, rgba(0,0,0,0.08) 34%, rgba(0,0,0,0.24) 62%, rgba(0,0,0,0.88) 100%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 120% 84% at 50% 44%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.46) 78%, rgba(0,0,0,0.96) 100%)",
        }}
      />
      <motion.div
        className="absolute inset-0 z-[8] pointer-events-none"
        style={{
          backgroundImage: "url('/images/agents/hero-background-glow-1920x1080.png')",
          backgroundPosition: "center bottom",
          backgroundSize: "cover",
          filter: "brightness(1.18) saturate(1.12)",
          mixBlendMode: "screen",
          transform: "translate3d(0, var(--claw42-hero-depth-horizon-y, 0px), 0)",
          WebkitMaskImage:
            "linear-gradient(180deg, transparent 34%, black 46%, black 67%, transparent 76%)",
          maskImage:
            "linear-gradient(180deg, transparent 34%, black 46%, black 67%, transparent 76%)",
        }}
        animate={reduceMotion ? { opacity: 0.1 } : { opacity: [0.04, 0.13, 0.04] }}
        transition={
          reduceMotion ? { duration: 0 } : { duration: 3.6, repeat: Infinity, ease: "easeInOut" }
        }
      />

      <PedestalLayer mouseX={mouseX} mouseY={mouseY} reduceMotion={reduceMotion} />
      <RobotLayer
        pose={pose}
        mouseX={mouseX}
        mouseY={mouseY}
        reduceMotion={reduceMotion}
        onOpenWatch={handleOpenWatch}
      />

      <ClawAnimation
        activeSlot={activeSlot}
        active={miniPlayer.status === "picking" || miniPlayer.status === "loading"}
        reduceMotion={reduceMotion}
      />

      <div className="absolute inset-0 z-[45] hidden pointer-events-none md:block">
        {coins.map((coin, index) => {
          const slotId = slotIds[index];
          return (
            <div
              key={coin.id}
              className={`pointer-events-auto absolute ${desktopSlotClass[slotId]}`}
              style={{
                transform: "translate3d(0, var(--claw42-hero-depth-coin-y, 0px), 0)",
              }}
            >
              <TrendingCoinSlot
                coin={coin}
                selected={miniPlayer.selectedCoin?.symbol === coin.symbol}
                reduceMotion={reduceMotion}
                onSelect={handleSelectCoin}
              />
            </div>
          );
        })}
      </div>

      <div className="absolute left-1/2 top-[50%] z-[55] grid w-[min(330px,88vw)] -translate-x-1/2 grid-cols-2 justify-items-center gap-x-20 gap-y-12 pointer-events-none md:hidden">
        {coins.map((coin) => (
          <div key={coin.id} className="pointer-events-auto">
            <TrendingCoinSlot
              coin={coin}
              selected={miniPlayer.selectedCoin?.symbol === coin.symbol}
              reduceMotion={reduceMotion}
              onSelect={handleSelectCoin}
            />
          </div>
        ))}
      </div>

      <HintArrow text={t.hero.hint.tapCoin} reduceMotion={reduceMotion} />

      <div className="absolute inset-x-0 bottom-0 z-50 h-[46%] bg-gradient-to-t from-black via-black/74 to-transparent pointer-events-none" />
      <div className="absolute left-1/2 bottom-[5%] z-[60] flex w-full max-w-3xl -translate-x-1/2 flex-col items-center px-6 text-center md:bottom-[7%]">
        <div className="flex flex-col items-center">
          <h1 className="mb-3 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl md:text-[44px] lg:text-[48px]">
            {t.hero.title}
          </h1>
          <p className="mb-4 max-w-2xl text-sm leading-relaxed text-[#d4dde8] sm:text-base md:text-[17px]">
            {t.hero.subtitle}
          </p>
          <p className="mb-5 text-xs font-semibold text-[#8feeff] md:hidden">
            {t.hero.hint.tapCoinMobile}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 pointer-events-auto sm:flex-row">
          <div className="relative">
            <motion.button
              type="button"
              onClick={handleHeroCtaClick}
              whileHover={reduceMotion ? undefined : { scale: 1.04 }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              className="inline-flex min-w-[9.25rem] items-center justify-center rounded-lg bg-[#f4f0ff] px-6 py-2.5 text-sm font-semibold text-[#11131b] transition-colors hover:bg-white md:text-base"
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
                  className="absolute -top-10 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#f4f0ff] px-3 py-1.5 text-xs font-semibold text-[#11131b] shadow-lg"
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
                surface: "hero_interactive_secondary",
              })
            }
            whileHover={reduceMotion ? undefined : { scale: 1.04 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            className="inline-flex min-w-[9.25rem] items-center justify-center rounded-lg border border-[#62f0ff]/38 bg-[#05202a] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#09323f] md:text-base"
          >
            {t.hero.ctaSecondary}
          </motion.a>
        </div>
        {isLoading && (
          <p className="mt-3 text-[11px] text-[#aebdca]" role="status">
            {t.hero.miniPlayer.loading}
          </p>
        )}
      </div>

      <HeroMiniPlayer
        open={miniPlayer.isOpen}
        loading={miniPlayer.status === "loading"}
        data={miniPlayer.data}
        coin={miniPlayer.selectedCoin}
        locale={locale}
        t={t}
        reduceMotion={reduceMotion}
        onClose={miniPlayer.close}
      />
    </section>
  );
}
