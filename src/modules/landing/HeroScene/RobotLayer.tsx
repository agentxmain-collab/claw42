"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Pose } from "./useRobotPose";

interface RobotLayerProps {
  pose: Pose;
  mouseX: number;
  mouseY: number;
  reduceMotion: boolean;
}

const POSE_SRC: Record<Pose, string> = {
  center: "/images/hero/robot-center.png",
  left: "/images/hero/robot-left.png",
  right: "/images/hero/robot-right.png",
};

export function RobotLayer({ pose, mouseX, mouseY, reduceMotion }: RobotLayerProps) {
  const depth = 0.3;
  const parallaxX = reduceMotion ? 0 : mouseX * depth * 20;
  const parallaxY = reduceMotion ? 0 : mouseY * depth * 12;

  // --- Eye tracking ---
  const faceDepth = 0.35;
  const faceParallaxX = reduceMotion ? 0 : mouseX * faceDepth * 20;
  const faceParallaxY = reduceMotion ? 0 : mouseY * faceDepth * 12;
  const eyeOffsetX = reduceMotion ? 0 : mouseX * 4;
  const eyeOffsetY = reduceMotion ? 0 : mouseY * 3;

  // --- Blinking ---
  const [blinking, setBlinking] = useState(false);
  const blinkTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerBlink = useCallback(() => {
    setBlinking(true);
    setTimeout(() => setBlinking(false), 150);
  }, []);

  // Idle blink every 3-5s
  useEffect(() => {
    if (reduceMotion) return;
    const scheduleBlink = () => {
      const delay = 3000 + Math.random() * 2000;
      blinkTimeout.current = setTimeout(() => {
        triggerBlink();
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();
    return () => {
      if (blinkTimeout.current) clearTimeout(blinkTimeout.current);
    };
  }, [reduceMotion, triggerBlink]);

  // --- Click bump ---
  const [bumping, setBumping] = useState(false);
  const handleClick = useCallback(() => {
    if (reduceMotion) return;
    triggerBlink();
    setBumping(true);
    setTimeout(() => setBumping(false), 200);
  }, [reduceMotion, triggerBlink]);

  return (
    <div
      className="absolute z-20 left-1/2 bottom-[28%] cursor-pointer"
      style={{
        transform: `translateX(-50%) translate(${parallaxX}px, ${parallaxY}px)`,
        transition: "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        width: "min(316px, 28vw)",
      }}
      onClick={handleClick}
    >
      {/* Idle float */}
      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 4, repeat: Infinity, ease: "easeInOut" }
        }
        style={{
          transform: bumping ? "scale(0.97)" : "scale(1)",
          transition: "transform 200ms ease-out",
        }}
      >
        <div className="relative">
          {/* Robot body – pose switching */}
          <AnimatePresence mode="popLayout">
            <motion.div
              key={pose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={POSE_SRC[pose]}
                alt="Claw 42 Robot"
                className="w-full select-none"
                draggable={false}
              />
            </motion.div>
          </AnimatePresence>

          {/* Face overlay – only in center pose */}
          <AnimatePresence>
            {pose === "center" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute z-[25]"
                style={{
                  top: "31.6%",
                  left: "50%",
                  width: "107px",
                  height: "59px",
                  transform: `translate(-50%, 0) translate(${faceParallaxX}px, ${faceParallaxY}px) translate(${eyeOffsetX}px, ${eyeOffsetY}px)`,
                  transition: "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/hero/robot-face.png"
                  alt=""
                  className="w-full h-full select-none"
                  style={{
                    transform: blinking ? "scaleY(0.1)" : "scaleY(1)",
                    transition: "transform 150ms ease-in-out",
                    transformOrigin: "center center",
                  }}
                  draggable={false}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
