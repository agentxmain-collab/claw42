"use client";
import { useEffect, useState } from "react";

export type Pose = "center" | "left" | "right";

/**
 * Derive robot pose from normalised mouse-x with hysteresis to avoid jitter.
 *
 * Thresholds:
 *   enter left  : x < -0.33
 *   enter right : x >  0.33
 *   return to center from left  : x > -0.20
 *   return to center from right : x <  0.20
 */
export function useRobotPose(mouseX: number, reduceMotion: boolean): Pose {
  const [pose, setPose] = useState<Pose>("center");

  useEffect(() => {
    if (reduceMotion) {
      setPose("center");
      return;
    }

    setPose((current) => {
      if (current === "center") {
        if (mouseX < -0.33) return "left";
        if (mouseX > 0.33) return "right";
        return "center";
      }
      if (current === "left") {
        return mouseX > -0.20 ? "center" : "left";
      }
      // current === "right"
      return mouseX < 0.20 ? "center" : "right";
    });
  }, [mouseX, reduceMotion]);

  return pose;
}
