export function priceDeltaColor(pct: number): string {
  if (pct > 0) return "text-emerald-400";
  if (pct < 0) return "text-rose-400";
  return "text-white/40";
}
