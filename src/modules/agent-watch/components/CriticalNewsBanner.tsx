"use client";

import type { Dict } from "@/i18n/types";
import type { NewsDebate } from "@/lib/types";

export function CriticalNewsBanner({
  debate,
  labels,
}: {
  debate?: NewsDebate | null;
  labels: Dict["agentWatch"]["newsDebate"];
}) {
  if (!debate || debate.layers.trigger.severity !== "critical") return null;
  return (
    <div className="rounded-2xl border border-rose-300/30 bg-rose-950/25 px-4 py-3 text-sm text-rose-100">
      <span className="mr-2 font-bold">{labels.criticalBadge}</span>
      {debate.newsTitle}
    </div>
  );
}
