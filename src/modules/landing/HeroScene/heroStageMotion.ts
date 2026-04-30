import type { CSSProperties } from "react";

interface StageRectLike {
  top: number;
  height: number;
}

const DEPTH_MAX_OFFSET = {
  bg: 30,
  horizon: 22,
  robot: -6,
  coin: -10,
  pedestal: 6,
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function heroScrollProgress(rect: StageRectLike): number {
  if (!Number.isFinite(rect.height) || rect.height <= 0) return 0;
  if (!Number.isFinite(rect.top) || rect.top >= 0) return 0;
  return clamp(Math.abs(rect.top) / rect.height, 0, 1);
}

export function heroDepthOffset(progress: number, maxOffset: number): number {
  if (!Number.isFinite(progress) || !Number.isFinite(maxOffset)) return 0;
  return Math.round(clamp(progress, 0, 1) * maxOffset);
}

type HeroStageStyle = CSSProperties & Record<`--claw42-hero-depth-${string}`, string>;

export function heroStageCssVars(progress: number): HeroStageStyle {
  return {
    "--claw42-hero-depth-bg-y": `${heroDepthOffset(progress, DEPTH_MAX_OFFSET.bg)}px`,
    "--claw42-hero-depth-horizon-y": `${heroDepthOffset(progress, DEPTH_MAX_OFFSET.horizon)}px`,
    "--claw42-hero-depth-robot-y": `${heroDepthOffset(progress, DEPTH_MAX_OFFSET.robot)}px`,
    "--claw42-hero-depth-coin-y": `${heroDepthOffset(progress, DEPTH_MAX_OFFSET.coin)}px`,
    "--claw42-hero-depth-pedestal-y": `${heroDepthOffset(progress, DEPTH_MAX_OFFSET.pedestal)}px`,
  };
}
