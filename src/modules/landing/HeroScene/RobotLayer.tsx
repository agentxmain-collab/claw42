"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Pose } from "./useRobotPose";
import { SpeechBubble } from "./SpeechBubble";

interface RobotLayerProps {
  pose: Pose;
  mouseX: number;
  mouseY: number;
  reduceMotion: boolean;
}

type Expression = "neutral" | "smile" | "squint";

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

export function RobotLayer({ pose, mouseX, mouseY, reduceMotion }: RobotLayerProps) {
  const [blink, setBlink] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [expression, setExpression] = useState<Expression>("neutral");
  const displayPose: "left" | "right" = pose === "right" ? "right" : "left";

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

  useEffect(() => {
    if (reduceMotion) {
      setExpression("neutral");
      return;
    }

    if (hovered) {
      setExpression("smile");
      return;
    }

    let expressionId: ReturnType<typeof setTimeout> | undefined;
    let resetId: ReturnType<typeof setTimeout> | undefined;

    const scheduleExpression = () => {
      expressionId = setTimeout(() => {
        const nextExpression: Expression = Math.random() > 0.48 ? "smile" : "squint";
        setExpression(nextExpression);
        resetId = setTimeout(() => {
          setExpression("neutral");
          scheduleExpression();
        }, nextExpression === "smile" ? 980 : 820);
      }, 2800 + Math.random() * 2400);
    };

    scheduleExpression();

    return () => {
      if (expressionId) clearTimeout(expressionId);
      if (resetId) clearTimeout(resetId);
    };
  }, [hovered, reduceMotion]);

  const parallaxX = reduceMotion ? 0 : mouseX * 0.3 * 20;
  const parallaxY = reduceMotion ? 0 : mouseY * 0.3 * 12;

  return (
    <div
      className="absolute z-20 left-1/2 bottom-[34%] md:bottom-[40%]"
      style={{
        transform: `translate(-50%, 0) translate(${parallaxX}px, ${parallaxY}px)`,
        width: "min(316px, 28vw)",
        pointerEvents: "none",
      }}
    >
      <motion.div
        className="relative"
        animate={reduceMotion ? { y: 0 } : { y: [0, -12, 0] }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 3.5, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <AnimatePresence mode="popLayout">
          <motion.img
            key={displayPose}
            src={POSE_SRC[displayPose]}
            alt=""
            aria-label="Claw 42 robot"
            draggable={false}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="w-full h-auto select-none block cursor-pointer"
            style={{ pointerEvents: "auto" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        </AnimatePresence>

        <motion.div
          className="absolute select-none pointer-events-none"
          style={{
            top: EYES_OVERLAY.top,
            left: FACE_LAYOUT[displayPose].x,
            width: EYES_OVERLAY.width,
            transform: `translate(-50%, 0)${displayPose === "right" ? " scaleX(-1)" : ""}`,
            transformOrigin: "center center",
          }}
          animate={
            reduceMotion
              ? { y: 0, scaleX: 1, scaleY: 1 }
              : hovered
                ? {
                    y: [0, -0.8, 0.35, 0],
                    scaleX: [1, 1.02, 1],
                    scaleY: [1, 0.97, 1.02, 1],
                  }
                : expression === "squint"
                  ? { y: 0.8, scaleX: 1.01, scaleY: 0.88 }
                  : expression === "smile"
                    ? { y: -0.4, scaleX: 1.03, scaleY: 1.04 }
                    : { y: 0, scaleX: 1, scaleY: 1 }
          }
          transition={
            reduceMotion
              ? { duration: 0 }
              : hovered
                ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.28, ease: "easeOut" }
          }
        >
          <motion.img
            src="/images/hero/robot-eyes.png"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="w-full h-auto block"
            animate={blink ? { scaleY: [1, 0.05, 1] } : { scaleY: 1 }}
            transition={{ duration: 0.13 }}
            style={{
              transformOrigin: "center center",
              filter: "drop-shadow(0 0 10px rgba(73, 201, 255, 0.95)) saturate(1.35)",
            }}
          />
        </motion.div>

        <motion.img
          src="/images/hero/robot-mouth.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute select-none pointer-events-none"
          style={{
            top: MOUTH_OVERLAY.top,
            left: FACE_LAYOUT[displayPose].x,
            width: MOUTH_OVERLAY.width,
            transform: "translate(-50%, 0)",
            filter: "drop-shadow(0 0 8px rgba(73, 201, 255, 0.75)) saturate(1.2)",
          }}
          animate={
            reduceMotion
              ? { scaleX: 1, scaleY: 1, y: 0, rotate: 0 }
              : hovered
                ? {
                    scaleX: [1, 1.18, 0.9, 1.14, 0.95, 1.08, 1],
                    scaleY: [1, 1.52, 0.74, 1.28, 0.92, 1.18, 1],
                    y: [0, 0.5, -0.15, 0.35, -0.08, 0.12, 0],
                    rotate: [0, 0.5, -0.35, 0.28, 0],
                  }
                : expression === "smile"
                  ? { scaleX: 1.15, scaleY: 0.86, y: -0.55, rotate: 0 }
                  : expression === "squint"
                    ? { scaleX: 0.96, scaleY: 0.92, y: 0.08, rotate: 0 }
                    : { scaleX: 1, scaleY: 1, y: 0, rotate: 0 }
          }
          transition={
            reduceMotion
              ? { duration: 0 }
              : hovered
                ? { duration: 0.92, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.28, ease: "easeOut" }
          }
        />

        <SpeechBubble
          visible={hovered}
          reduceMotion={reduceMotion}
          side={displayPose === "right" ? "left" : "right"}
        />
      </motion.div>
    </div>
  );
}
