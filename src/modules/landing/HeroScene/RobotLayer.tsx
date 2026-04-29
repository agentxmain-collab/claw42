"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { useAgentAnalysis } from "@/modules/agent-watch/hooks/useAgentAnalysis";
import type { Pose } from "./useRobotPose";
import { SpeechBubble } from "./SpeechBubble";

interface RobotLayerProps {
  pose: Pose;
  mouseX: number;
  mouseY: number;
  reduceMotion: boolean;
  onOpenWatch: () => void;
}

const POSE_SRC: Record<"left" | "right", string> = {
  left: "/images/hero/robot-left.png",
  right: "/images/hero/robot-right.png",
};

const FACE_LAYOUT = {
  left: {
    x: "42.3%",
  },
  right: {
    x: "57.7%",
  },
};

const EYES_OVERLAY = {
  top: "54.4%",
  width: "33.9%",
};

const MOUTH_OVERLAY = {
  top: "54.6%",
  width: "33.9%",
};

export function RobotLayer({
  pose,
  mouseX,
  mouseY,
  reduceMotion,
  onOpenWatch,
}: RobotLayerProps) {
  const { t, locale } = useI18n();
  const [blink, setBlink] = useState(false);
  const [hovered, setHovered] = useState(false);
  const displayPose: "left" | "right" = pose === "right" ? "right" : "left";
  const isZh = locale === "zh_CN";
  const { data } = useAgentAnalysis({ enabled: isZh });
  const liveHeroLines =
    data?.source !== "static-fallback" ? data?.heroBubbles?.filter(Boolean) : undefined;
  const fallbackAnalysisLines = data?.stream?.map((message) => message.content).filter(Boolean);
  const dynamicLines = isZh
    ? liveHeroLines?.length
      ? liveHeroLines
      : fallbackAnalysisLines?.length
        ? fallbackAnalysisLines
        : [t.coinModal.loadingPrice]
    : undefined;

  useEffect(() => {
    if (reduceMotion) return;
    let blinkId: ReturnType<typeof setTimeout> | undefined;
    let closeId: ReturnType<typeof setTimeout> | undefined;

    const scheduleBlink = () => {
      blinkId = setTimeout(() => {
        setBlink(true);
        closeId = setTimeout(() => setBlink(false), 150);
        scheduleBlink();
      }, 3000 + Math.random() * 2000);
    };

    scheduleBlink();
    return () => {
      if (blinkId) clearTimeout(blinkId);
      if (closeId) clearTimeout(closeId);
    };
  }, [reduceMotion]);

  const parallaxX = reduceMotion ? 0 : mouseX * 0.3 * 20;
  const parallaxY = reduceMotion ? 0 : mouseY * 0.3 * 12;

  return (
    <div
      className="claw42-hero-robot absolute z-40 left-1/2 bottom-[34%] md:bottom-[40%]"
      style={{
        transform: `translate(-50%, 0) translate(${parallaxX}px, ${parallaxY}px)`,
        bottom: "var(--claw42-hero-robot-bottom, 38%)",
        width: "var(--claw42-hero-robot-width, min(316px, 28vw))",
        pointerEvents: "none",
      }}
    >
      <motion.div
        className="relative pointer-events-auto cursor-pointer"
        role="button"
        tabIndex={0}
        aria-label={t.hero.speechBubbleAriaLabel}
        onClick={onOpenWatch}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onOpenWatch();
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
        animate={reduceMotion ? { y: 0 } : { y: [0, -12, 0] }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 3.5, repeat: Infinity, ease: "easeInOut" }
        }
      >
        {/*
          Body 双张常驻 + opacity 切换，避免 AnimatePresence mount/unmount 导致
          motion.div 高度在切换瞬间塌陷（会让 eyes/mouth 的百分比定位跑到底座区域，
          并且造成机器人整体概率性消失的 flicker）
        */}
        <div className="relative">
          <motion.img
            src={POSE_SRC.left}
            alt=""
            aria-label="Claw 42 robot"
            draggable={false}
            className="w-full h-auto select-none block cursor-pointer"
            style={{ pointerEvents: displayPose === "left" ? "auto" : "none" }}
            initial={false}
            animate={{ opacity: displayPose === "left" ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.img
            src={POSE_SRC.right}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="w-full h-auto select-none block cursor-pointer absolute inset-0"
            style={{ pointerEvents: displayPose === "right" ? "auto" : "none" }}
            initial={false}
            animate={{ opacity: displayPose === "right" ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          />
        </div>

        <div
          className="absolute select-none pointer-events-none"
          style={{
            top: EYES_OVERLAY.top,
            left: FACE_LAYOUT[displayPose].x,
            width: EYES_OVERLAY.width,
            transform: `translate(-50%, 0)${displayPose === "right" ? " scaleX(-1)" : ""}`,
            transformOrigin: "center center",
          }}
        >
          <motion.img
            src="/images/hero/robot-eyes.png"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="w-full h-auto block"
            animate={blink ? { scaleY: [1, 0.1, 1] } : { scaleY: 1 }}
            transition={{ duration: 0.15 }}
            style={{
              transformOrigin: "center center",
              filter: "drop-shadow(0 0 10px rgba(73, 201, 255, 0.95)) saturate(1.35)",
            }}
          />
        </div>

        <div
          className="absolute select-none pointer-events-none"
          style={{
            top: MOUTH_OVERLAY.top,
            left: FACE_LAYOUT[displayPose].x,
            width: MOUTH_OVERLAY.width,
            transform: "translate(-50%, 0)",
          }}
        >
          <motion.div
            animate={
              reduceMotion || !hovered
                ? { scaleX: 1, scaleY: 1, y: 0 }
                : {
                    scaleX: [1, 1.12, 0.94, 1.08, 1],
                    scaleY: [1, 1.38, 0.82, 1.18, 1],
                    y: [0, 0.45, -0.08, 0.22, 0],
                  }
            }
            transition={
              reduceMotion || !hovered
                ? { duration: 0.18 }
                : { duration: 0.9, repeat: Infinity, ease: "easeInOut" }
            }
          >
            <motion.img
              src="/images/hero/robot-mouth.png"
              alt=""
              aria-hidden="true"
              draggable={false}
              className="w-full h-auto block"
              style={{
                filter: "drop-shadow(0 0 8px rgba(73, 201, 255, 0.75)) saturate(1.2)",
              }}
            />
          </motion.div>
        </div>

        <SpeechBubble
          visible={hovered}
          reduceMotion={reduceMotion}
          side={displayPose === "right" ? "left" : "right"}
          lines={dynamicLines}
        />
      </motion.div>
    </div>
  );
}
