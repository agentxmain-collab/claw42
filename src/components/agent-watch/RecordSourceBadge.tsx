import React from "react";
import type { RecordSource } from "@/lib/team/strategyDecisionRecord";

export type RecordSourceBadgeType = RecordSource | "mixed" | "none";

const BADGE_CLASS: Record<RecordSourceBadgeType, string> = {
  live: "border-emerald-300/30 bg-emerald-300/[0.10] text-emerald-200",
  paper: "border-amber-300/30 bg-amber-300/[0.10] text-amber-200",
  legacy: "border-white/15 bg-white/[0.06] text-white/55",
  backtest: "border-sky-300/30 bg-sky-300/[0.10] text-sky-200",
  mixed: "border-orange-300/30 bg-orange-300/[0.10] text-orange-200",
  none: "border-white/10 bg-white/[0.04] text-white/45",
};

export function RecordSourceBadge({
  source,
  label,
}: {
  source: RecordSourceBadgeType;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] ${BADGE_CLASS[source]}`}
    >
      {label}
    </span>
  );
}
