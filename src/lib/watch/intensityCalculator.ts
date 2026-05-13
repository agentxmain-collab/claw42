import type { NewsEvidence } from "@/lib/news/newsEvidence";
import { PUBLIC_IMPORTANCE_ORDER, type PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

type EvidenceMap = Readonly<Record<string, NewsEvidence | undefined>>;

const EVIDENCE_SEVERITY_ORDER: Record<NewsEvidence["impactSeverity"], number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function clampIntensity(value: number) {
  return Math.min(4, Math.max(1, value));
}

function maxEvidenceSeverity(event: PublicTimelineEvent, evidenceMap: EvidenceMap = {}) {
  return event.evidenceIds.reduce((max, evidenceId) => {
    const severity = evidenceMap[evidenceId]?.impactSeverity;
    return severity ? Math.max(max, EVIDENCE_SEVERITY_ORDER[severity]) : max;
  }, 0);
}

export function calculateTopicIntensity({
  event,
  evidenceMap,
  confidence,
}: {
  event: PublicTimelineEvent;
  evidenceMap?: EvidenceMap;
  confidence?: number | null;
}) {
  let score = PUBLIC_IMPORTANCE_ORDER[event.importance] + 1;
  score = Math.max(score, maxEvidenceSeverity(event, evidenceMap));

  if (event.evidenceIds.length >= 3) score += 1;
  if (typeof confidence === "number" && confidence < 0.5) score += 1;

  return clampIntensity(score);
}
