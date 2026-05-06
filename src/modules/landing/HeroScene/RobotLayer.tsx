"use client";

import { useEffect, useMemo, useState } from "react";
import type { RefObject } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { useAgentAnalysis } from "@/modules/agent-watch/hooks/useAgentAnalysis";
import { resolveAgentWatchLocale } from "@/modules/agent-watch/locale";
import type { Pose } from "./useRobotPose";
import { SpeechBubble } from "./SpeechBubble";
import { buildHeroSpeechLines, mergeHeroSpeechLinePools } from "./heroSpeechLines";

interface RobotLayerProps {
  robotRef: RefObject<HTMLDivElement>;
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

const LIVE_LOADING_LINES = {
  zh_CN: ["正在读取实时市场信号", "Agent 正在扫描行情异动"],
  en_US: ["Reading live market signals", "Agents are scanning market shifts"],
};

const BODY_SPRING = {
  stiffness: 30,
  damping: 30,
  mass: 1.2,
};

const HEAD_SPRING = {
  stiffness: 80,
  damping: 20,
  mass: 0.8,
};

const FACE_SPRING = {
  stiffness: 150,
  damping: 18,
  mass: 0.5,
};

export function RobotLayer({
  robotRef,
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
  const agentWatchLocale = resolveAgentWatchLocale(locale);
  const { data } = useAgentAnalysis({ enabled: true, locale: agentWatchLocale });
  const liveLines = useMemo(
    () => buildHeroSpeechLines(data, agentWatchLocale) ?? LIVE_LOADING_LINES[agentWatchLocale],
    [data, agentWatchLocale],
  );
  const dynamicLines = useMemo(
    () => mergeHeroSpeechLinePools(liveLines, t.hero.speechBubble, locale !== agentWatchLocale),
    [liveLines, locale, agentWatchLocale, t.hero.speechBubble],
  );
  const mouseMotionX = useMotionValue(0);
  const mouseMotionY = useMotionValue(0);
  const bodyMouseX = useSpring(mouseMotionX, BODY_SPRING);
  const bodyMouseY = useSpring(mouseMotionY, BODY_SPRING);
  const headMouseX = useSpring(mouseMotionX, HEAD_SPRING);
  const headMouseY = useSpring(mouseMotionY, HEAD_SPRING);
  const faceMouseX = useSpring(mouseMotionX, FACE_SPRING);
  const faceMouseY = useSpring(mouseMotionY, FACE_SPRING);
  const bodyTranslateX = useTransform(bodyMouseX, [-1, 1], [-6, 6]);
  const bodyTranslateY = useTransform(bodyMouseY, [-1, 1], [-3, 3]);
  const bodyRotateY = useTransform(bodyMouseX, [-1, 1], [-3, 3]);
  const bodyRotateX = useTransform(bodyMouseY, [-1, 1], [2, -2]);
  const headTranslateX = useTransform(headMouseX, [-1, 1], [-4, 4]);
  const headTranslateY = useTransform(headMouseY, [-1, 1], [-3, 3]);
  const headScaleX = useTransform(headMouseX, [-1, 0, 1], [0.985, 1, 0.985]);
  const headRotateY = useTransform(headMouseX, [-1, 1], [-7, 7]);
  const headRotateX = useTransform(headMouseY, [-1, 1], [4, -4]);
  const headRotateZ = useTransform(headMouseX, [-1, 1], [-2, 2]);
  const faceTranslateX = useTransform(faceMouseX, [-1, 1], [-8, 8]);
  const faceTranslateY = useTransform(faceMouseY, [-1, 1], [-5, 5]);
  const spotlightBackground = useTransform([faceMouseX, faceMouseY], ([x, y]) => {
    const pointX = 50 + Number(x) * 30;
    const pointY = 40 + Number(y) * 20;
    return `radial-gradient(circle at ${pointX}% ${pointY}%, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.08) 25%, transparent 55%)`;
  });

  useEffect(() => {
    mouseMotionX.set(reduceMotion ? 0 : mouseX);
    mouseMotionY.set(reduceMotion ? 0 : mouseY);
  }, [mouseMotionX, mouseMotionY, mouseX, mouseY, reduceMotion]);

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

  return (
    <div
      ref={robotRef}
      className="claw42-hero-robot absolute z-40 left-1/2 bottom-[34%] md:bottom-[40%]"
      style={{
        transform: "translate(-50%, 0) translateY(var(--claw42-hero-depth-robot-y, 0px))",
        bottom: "var(--claw42-hero-robot-bottom, 58%)",
        width: "var(--claw42-hero-robot-width, min(316px, 18vw))",
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
        <motion.div
          className="relative"
          style={{
            x: bodyTranslateX,
            y: bodyTranslateY,
            rotateY: bodyRotateY,
            rotateX: bodyRotateX,
            transformStyle: "preserve-3d",
            transformOrigin: "center center",
          }}
        >
          <motion.div
            className="relative"
            style={{
              x: headTranslateX,
              y: headTranslateY,
              scaleX: headScaleX,
              rotateY: headRotateY,
              rotateX: headRotateX,
              rotateZ: headRotateZ,
              transformStyle: "preserve-3d",
              transformOrigin: "center center",
            }}
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
            <motion.div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{
                background: spotlightBackground,
                mixBlendMode: "overlay",
                opacity: reduceMotion ? 0 : 1,
              }}
            />
          </div>

          <motion.div
            className="absolute select-none pointer-events-none"
            style={{
              top: EYES_OVERLAY.top,
              left: FACE_LAYOUT[displayPose].x,
              width: EYES_OVERLAY.width,
              x: faceTranslateX,
              y: faceTranslateY,
            }}
          >
            <div
              style={{
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
          </motion.div>

          <motion.div
            className="absolute select-none pointer-events-none"
            style={{
              top: MOUTH_OVERLAY.top,
              left: FACE_LAYOUT[displayPose].x,
              width: MOUTH_OVERLAY.width,
              x: faceTranslateX,
              y: faceTranslateY,
            }}
          >
            <div style={{ transform: "translate(-50%, 0)" }}>
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
          </motion.div>
          </motion.div>
        </motion.div>

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
