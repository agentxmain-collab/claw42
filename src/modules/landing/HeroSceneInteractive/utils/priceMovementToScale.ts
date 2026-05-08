const MIN_SCALE = 0.5;
const MAX_SCALE = 1.5;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function priceMovementToScale(changePercent24h: number) {
  if (!Number.isFinite(changePercent24h)) return 1;

  const change = clamp(changePercent24h, -100, 100);
  const magnitude = Math.abs(change);
  const direction = Math.sign(change);

  if (magnitude <= 5) return 1 + direction * (magnitude / 5) * 0.1;
  if (magnitude <= 20) return 1 + direction * (0.1 + ((magnitude - 5) / 15) * 0.15);
  if (magnitude <= 50) return 1 + direction * (0.25 + ((magnitude - 20) / 30) * 0.25);
  return 1 + direction * 0.5;
}

export function clampCoinScale(scale: number) {
  if (!Number.isFinite(scale)) return 1;
  return clamp(scale, MIN_SCALE, MAX_SCALE);
}

export function isExtremeDrop(changePercent24h: number) {
  return Number.isFinite(changePercent24h) && changePercent24h <= -90;
}
