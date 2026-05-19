import { describe, expect, it } from "vitest";
import { buildDecisionOpsAlertSnapshot } from "@/lib/team/decisionOpsAlertSnapshot";
import type { DecisionOpsCausalRunbook } from "@/lib/team/decisionOpsCausalRunbook";

const now = Date.parse("2026-05-19T10:00:00.000Z");

function causalRunbook(
  overrides: Partial<DecisionOpsCausalRunbook> = {},
): DecisionOpsCausalRunbook {
  return {
    schemaVersion: 1,
    generatedAt: "2026-05-19T10:00:00.000Z",
    status: "healthy",
    primaryLayer: null,
    primaryIssue: null,
    alert: {
      severity: "healthy",
      shouldNotify: false,
      dedupeKey: null,
      cooldownMs: null,
    },
    summary: "Ops diagnostics do not currently require an alert.",
    diagnosis: [
      {
        layer: "schedule_to_public_chain",
        status: "healthy",
        issue: null,
        headline: "Cron, PM run, and public timeline output are fresh.",
        evidence: {
          latestCronJobAt: "2026-05-19T09:00:00.000Z",
          latestSuccessfulRunAt: "2026-05-19T09:04:00.000Z",
          latestPublicPmEventAt: "2026-05-19T09:05:00.000Z",
        },
      },
    ],
    actions: [],
    ...overrides,
  };
}

describe("buildDecisionOpsAlertSnapshot", () => {
  it("keeps healthy causal state quiet with a stable no-alert snapshot", () => {
    const snapshot = buildDecisionOpsAlertSnapshot({
      causalRunbook: causalRunbook(),
      now,
    });

    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      shouldNotify: false,
      activeAlert: null,
      repeatGuard: {
        dedupeKey: null,
        cooldownMs: null,
        nextEligibleAt: null,
      },
      operatorSummary: "No ops alert is active.",
      recommendedActions: [],
    });
  });

  it("turns critical causal failures into a deduped alert snapshot", () => {
    const snapshot = buildDecisionOpsAlertSnapshot({
      causalRunbook: causalRunbook({
        status: "critical",
        primaryLayer: "public_output_surface",
        primaryIssue: "duplicate_candidate_card",
        alert: {
          severity: "critical",
          shouldNotify: true,
          dedupeKey: "ops-causal:public_output_surface:duplicate_candidate_card",
          cooldownMs: 15 * 60_000,
        },
        summary: "Primary ops cause is duplicate_candidate_card in public_output_surface.",
        diagnosis: [
          {
            layer: "public_output_surface",
            status: "critical",
            issue: "duplicate_candidate_card",
            headline: "Public output surface issue: duplicate_candidate_card.",
            evidence: {
              publicPmEvents: 3,
              duplicateCandidateCards: 1,
              stageProgressGaps: 0,
            },
          },
        ],
        actions: [
          {
            title: "Inspect candidate dedupe",
            description: "Check hydration and projection dedupe before replay.",
            executable: false,
          },
        ],
      }),
      now,
    });

    expect(snapshot.status).toBe("critical");
    expect(snapshot.shouldNotify).toBe(true);
    expect(snapshot.activeAlert).toMatchObject({
      severity: "critical",
      layer: "public_output_surface",
      issue: "duplicate_candidate_card",
      evidence: {
        publicPmEvents: 3,
        duplicateCandidateCards: 1,
      },
    });
    expect(snapshot.repeatGuard).toMatchObject({
      dedupeKey: "ops-causal:public_output_surface:duplicate_candidate_card",
      cooldownMs: 15 * 60_000,
      nextEligibleAt: "2026-05-19T10:15:00.000Z",
    });
    expect(snapshot.recommendedActions).toEqual([
      expect.objectContaining({
        title: "Inspect candidate dedupe",
        executable: false,
      }),
    ]);
  });

  it("keeps degraded findings visible but uses the longer degraded cooldown", () => {
    const snapshot = buildDecisionOpsAlertSnapshot({
      causalRunbook: causalRunbook({
        status: "degraded",
        primaryLayer: "model_quality_baseline",
        primaryIssue: "candidate_type_sample_gap",
        alert: {
          severity: "degraded",
          shouldNotify: true,
          dedupeKey: "ops-causal:model_quality_baseline:candidate_type_sample_gap",
          cooldownMs: 60 * 60_000,
        },
        summary: "Primary ops cause is candidate_type_sample_gap in model_quality_baseline.",
        diagnosis: [
          {
            layer: "model_quality_baseline",
            status: "degraded",
            issue: "candidate_type_sample_gap",
            headline: "Model quality baseline issue: candidate_type_sample_gap.",
            evidence: {
              scoredRuns: 5,
              candidateTypesCovered: 2,
            },
          },
        ],
      }),
      now,
    });

    expect(snapshot.status).toBe("degraded");
    expect(snapshot.shouldNotify).toBe(true);
    expect(snapshot.repeatGuard).toMatchObject({
      dedupeKey: "ops-causal:model_quality_baseline:candidate_type_sample_gap",
      cooldownMs: 60 * 60_000,
      nextEligibleAt: "2026-05-19T11:00:00.000Z",
    });
  });
});
