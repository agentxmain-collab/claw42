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

const POSE_SRC: Record<"left" | "right", string> = {
  left: "/images/hero/robot-left.png",
  right: "/images/hero/robot-right.png",
};

const FACE_OVERLAY = {
  top: "31.6%",
  left: "50%",
  width: "107px",
};

export function RobotLayer({ pose, mouseX, mouseY, reduceMotion }: RobotLayerProps) {
  const [blink, setBlink] = useState(false);
  const [hovered, setHovered] = useState(false);
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

  const parallaxX = reduceMotion ? 0 : mouseX * 0.3 * 20;
  const parallaxY = reduceMotion ? 0 : mouseY * 0.3 * 12;

  return (
    <div
      className="absolute z-20 left-1/2 bottom-[30%] md:bottom-[32%]"
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

        <div
          className="absolute select-none pointer-events-none"
          style={{
            top: FACE_OVERLAY.top,
            left: FACE_OVERLAY.left,
            width: FACE_OVERLAY.width,
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
            style={{ transformOrigin: "center center" }}
          />
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero/robot-mouth.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute select-none pointer-events-none"
          style={{
            top: FACE_OVERLAY.top,
            left: FACE_OVERLAY.left,
            width: FACE_OVERLAY.width,
            transform: "translate(-50%, 0)",
          }}
        />
      </motion.div>

      <SpeechBubble visible={hovered} reduceMotion={reduceMotion} />
    </div>
  );
}
