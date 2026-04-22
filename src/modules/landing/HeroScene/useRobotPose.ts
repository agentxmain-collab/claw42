"use client";

export type Pose = "center" | "left" | "right";

/**
 * Derive robot pose from normalised mouse-x using the scene midline as the split.
 * Keep only a tiny dead zone at center to avoid flicker when hovering right on the line.
 */
export function useRobotPose(mouseX: number, reduceMotion: boolean): Pose {
  if (reduceMotion) return "center";

  if (mouseX < -0.02) return "left";
  if (mouseX > 0.02) return "right";
  return "center";
}
