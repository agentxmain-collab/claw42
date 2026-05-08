export const HERO_TRENDING_STABLE_SYMBOLS = new Set([
  "usdt",
  "usdc",
  "dai",
  "fdusd",
  "tusd",
  "usdp",
  "usdd",
  "usde",
  "busd",
  "pyusd",
]);

export function computeTrendingScore(changePercent24h: number, volumeUsd24h: number) {
  const safeChange = Number.isFinite(changePercent24h) ? changePercent24h : 0;
  const safeVolume = Number.isFinite(volumeUsd24h) ? Math.max(0, volumeUsd24h) : 0;
  return Math.abs(safeChange) * 0.6 + Math.log10(safeVolume / 1_000_000 + 1) * 4;
}
