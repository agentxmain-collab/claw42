"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { COINW_SKILLS_URL } from "@/lib/constants";
import { useMouseNormalized } from "./useMouseNormalized";
import { useRobotPose, type Pose } from "./useRobotPose";
import { RobotLayer } from "./RobotLayer";
import { PedestalLayer } from "./PedestalLayer";
import { CoinsLayer } from "./CoinsLayer";
import { SpeechBubble } from "./SpeechBubble";

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
  const { t } = useI18n();
  const reduceMotion = useReducedMotion() ?? false;
  const stageRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Desktop: mouse-driven normalised coordinates. Mobile: always (0, 0).
  const rawMouse = useMouseNormalized(stageRef);
  const mouseX = isMobile ? 0 : rawMouse.x;
  const mouseY = isMobile ? 0 : rawMouse.y;

  // Desktop: pose from mouse. Mobile: auto-cycle.
  const desktopPose = useRobotPose(mouseX, reduceMotion);
  const mobilePose = useMobilePoseCycle(isMobile, reduceMotion);
  const pose = isMobile ? mobilePose : desktopPose;

  return (
    <section
      ref={stageRef}
      className="relative w-full aspect-[4/5] md:aspect-[21/9] overflow-hidden bg-gradient-to-b from-[#0a0a12] via-[#0f0a1f] to-black pt-[72px] md:pt-[80px]"
    >
      {/* z-10 Pedestal */}
      <PedestalLayer mouseX={mouseX} mouseY={mouseY} reduceMotion={reduceMotion} />

      {/* z-20/25 Robot */}
      <RobotLayer pose={pose} mouseX={mouseX} mouseY={mouseY} reduceMotion={reduceMotion} />

      {/* z-30 Coins */}
      <CoinsLayer mouseX={mouseX} mouseY={mouseY} reduceMotion={reduceMotion} />

      {/* z-40 Speech bubble */}
      <SpeechBubble reduceMotion={reduceMotion} />

      {/* z-50 Gradient scrim for title readability */}
      <div className="absolute inset-x-0 bottom-0 z-50 h-[42%] bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />

      {/* z-50 Title + CTA overlay */}
      <div className="absolute inset-x-0 bottom-[6%] z-50 flex flex-col items-center text-center px-6 max-w-4xl mx-auto left-1/2 -translate-x-1/2">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] font-bold tracking-tight mb-4 text-white leading-tight">
          {t.hero.title}
        </h1>
        <p className="text-gray-400 text-sm sm:text-base md:text-lg max-w-2xl mb-8 leading-relaxed">
          {t.hero.subtitle}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 pointer-events-auto">
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
      </div>
    </section>
  );
}
