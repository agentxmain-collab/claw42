import type { MajorEventAnalysis, SignalDistributionMode, SignalHealth } from "@/types/signal";

export type DistributionSurface = "major_event" | "hotlist" | "none";
export type DistributionPolicyReason = "health_blocked" | "stale_data" | "no_major_event" | "thin_evidence" | "low_confidence";

export type DistributionPolicyDecision = {
  mode: SignalDistributionMode;
  surface: DistributionSurface;
  allowsActions: boolean;
  showsDirectionalJudgment: boolean;
  reasons: DistributionPolicyReason[];
};

export function resolveDistributionPolicy({ health, majorEvent }: { health: SignalHealth; majorEvent: MajorEventAnalysis }): DistributionPolicyDecision {
  const reasons: DistributionPolicyReason[] = [];
  const freshnessCheck = health.checks.find((check) => check.key === "freshness");

  if (health.status === "blocked" || health.distributionMode === "hold" || freshnessCheck?.status === "fail") {
    return {
      mode: "hold",
      surface: "none",
      allowsActions: false,
      showsDirectionalJudgment: false,
      reasons: [health.status === "blocked" || health.distributionMode === "hold" ? "health_blocked" : "stale_data"]
    };
  }

  const event = majorEvent.event;
  if (!event) {
    return {
      mode: "watch_only",
      surface: "hotlist",
      allowsActions: false,
      showsDirectionalJudgment: false,
      reasons: ["no_major_event"]
    };
  }

  if (majorEvent.evidence.length < 2 || !event.evidence.multiSourceConfirm) reasons.push("thin_evidence");
  if (event.judgment.confidence < 40 || event.judgment.direction === null) reasons.push("low_confidence");
  if (freshnessCheck?.status === "warn") reasons.push("stale_data");

  const mode: SignalDistributionMode = reasons.length === 0 && health.distributionMode === "auto" ? "auto" : "watch_only";

  return {
    mode,
    surface: "major_event",
    allowsActions: mode === "auto" && !reasons.includes("thin_evidence"),
    showsDirectionalJudgment: !reasons.includes("low_confidence"),
    reasons
  };
}
