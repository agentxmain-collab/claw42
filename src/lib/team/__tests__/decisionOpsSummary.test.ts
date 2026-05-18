import { describe, expect, it } from "vitest";
import { buildDecisionOpsSummary } from "@/lib/team/decisionOpsSummary";
import type { DecisionOpsChainRunbook } from "@/lib/team/decisionOpsChainRunbook";
import type { DecisionOpsLifecycleDiagnostics } from "@/lib/team/decisionOpsLifecycleDiagnostics";
import type { DecisionOpsModelQualityReport } from "@/lib/team/decisionOpsModelQuality";
import type { DecisionOpsQueueRecoveryPolicy } from "@/lib/team/decisionOpsQueueRecoveryPolicy";

const now = Date.parse("2026-05-19T01:30:00.000Z");

function runbook(overrides: Partial<DecisionOpsChainRunbook> = {}): DecisionOpsChainRunbook {
  return {
    schemaVersion: 1,
    generatedAt: "2026-05-19T01:30:00.000Z",
    status: "healthy",
    rootCause: "public_output_recent",
    publicBoardState: "has_recent_public_output",
    summary: "Cron, PM run, and public timeline output are fresh.",
    evidence: {
      latestCronJobAt: "2026-05-19T00:00:00.000Z",
      latestSuccessfulRunAt: "2026-05-19T00:05:00.000Z",
      latestPublicPmEventAt: "2026-05-19T00:05:00.000Z",
      cronIssueCodes: [],
      freshnessAlerts: [],
      healthAlerts: [],
    },
    chain: [],
    runbookActions: [],
    ...overrides,
  };
}

function recovery(
  overrides: Partial<DecisionOpsQueueRecoveryPolicy> = {},
): DecisionOpsQueueRecoveryPolicy {
  return {
    schemaVersion: 1,
    generatedAt: "2026-05-19T01:30:00.000Z",
    status: "healthy",
    mode: "observe",
    shouldPauseNewTriggers: false,
    autoRecoveryAllowed: false,
    primaryAction: null,
    evidence: {
      rootCause: "public_output_recent",
      publicBoardState: "has_recent_public_output",
      queueMode: "inline",
      cronIssueCodes: [],
      healthAlerts: [],
      exhaustedCronJobs: 0,
      staleRunningCronJobs: 0,
      overdueCronRetries: 0,
      zeroOutputCronJobs: 0,
    },
    recoverySteps: [],
    ...overrides,
  };
}

function modelQuality(
  overrides: Partial<DecisionOpsModelQualityReport> = {},
): DecisionOpsModelQualityReport {
  return {
    schemaVersion: 1,
    generatedAt: "2026-05-19T01:30:00.000Z",
    status: "healthy",
    riskLevel: "low",
    primaryRisk: null,
    dimensions: {
      publicGuardrail: {
        status: "healthy",
        headline: "No public leak or duplicate-rationale risk is visible.",
        evidence: {},
      },
      evidenceDepth: {
        status: "healthy",
        headline: "Evidence citation depth is within the current guardrail.",
        evidence: {},
      },
      roleCoverage: {
        status: "healthy",
        headline: "Role coverage is within the current guardrail.",
        evidence: {},
      },
      providerMix: {
        status: "healthy",
        headline: "Provider mix is within the current guardrail.",
        evidence: {},
      },
      regression: {
        status: "healthy",
        headline: "Recent quality score trend is stable or improving.",
        evidence: {},
      },
    },
    issueCounts: {},
    recommendations: [],
    ...overrides,
  };
}

function lifecycle(
  overrides: Partial<DecisionOpsLifecycleDiagnostics> = {},
): DecisionOpsLifecycleDiagnostics {
  return {
    schemaVersion: 1,
    generatedAt: "2026-05-19T01:30:00.000Z",
    status: "healthy",
    primaryIssue: null,
    counts: {
      total: 2,
      open: 1,
      resolved: 1,
      staleOpen: 0,
      missingEvaluationWindow: 0,
      inconsistentResolution: 0,
    },
    outcomeCounts: { hit_tp: 1 },
    oldestOpenAgeMs: 30 * 60_000,
    latestResolvedAt: "2026-05-19T00:10:00.000Z",
    issues: [],
    actions: [],
    ...overrides,
  };
}

describe("buildDecisionOpsSummary", () => {
  it("stays healthy when chain, recovery, model quality, and lifecycle are healthy", () => {
    const summary = buildDecisionOpsSummary({
      runbook: runbook(),
      recoveryPolicy: recovery(),
      modelQuality: modelQuality(),
      lifecycle: lifecycle(),
      now,
    });

    expect(summary).toMatchObject({
      schemaVersion: 1,
      status: "healthy",
      primaryArea: null,
      publicBoardState: "has_recent_public_output",
      headline: "Ops chain, model quality, and decision lifecycle are healthy.",
      areas: [
        expect.objectContaining({ area: "public_chain", status: "healthy" }),
        expect.objectContaining({ area: "recovery_policy", status: "healthy" }),
        expect.objectContaining({ area: "model_quality", status: "healthy" }),
        expect.objectContaining({ area: "decision_lifecycle", status: "healthy" }),
      ],
      nextActions: [],
    });
  });

  it("prioritizes public-chain blockage and keeps operator steps read-only", () => {
    const summary = buildDecisionOpsSummary({
      runbook: runbook({
        status: "critical",
        rootCause: "cron_delivery_stalled",
        publicBoardState: "no_public_output",
        summary: "Cron delivery is stalled before PM jobs reach the queue.",
        runbookActions: [
          {
            title: "Verify Vercel cron delivery",
            description: "Check Vercel cron delivery and route authorization.",
            executable: false,
          },
        ],
      }),
      recoveryPolicy: recovery({
        status: "critical",
        mode: "manual_intervention",
        primaryAction: "Inspect exhausted cron jobs before any replay.",
      }),
      modelQuality: modelQuality(),
      lifecycle: lifecycle(),
      now,
    });

    expect(summary.status).toBe("critical");
    expect(summary.primaryArea).toBe("public_chain");
    expect(summary.publicBoardState).toBe("no_public_output");
    expect(summary.headline).toBe("Public decision output is blocked: cron_delivery_stalled.");
    expect(summary.nextActions).toEqual([
      expect.objectContaining({
        title: "Verify Vercel cron delivery",
        executable: false,
      }),
      expect.objectContaining({
        title: "Inspect exhausted cron jobs before any replay.",
        executable: false,
      }),
    ]);
  });

  it("surfaces model-quality risk ahead of lifecycle drift when the public chain is fresh", () => {
    const summary = buildDecisionOpsSummary({
      runbook: runbook(),
      recoveryPolicy: recovery(),
      modelQuality: modelQuality({
        status: "critical",
        riskLevel: "high",
        primaryRisk: "public_content_leak",
        recommendations: [
          {
            title: "Stop public release expansion until leak output is inspected",
            description: "Inspect prompts and public guardrail output first.",
            executable: false,
          },
        ],
      }),
      lifecycle: lifecycle({
        status: "degraded",
        primaryIssue: "missing_evaluation_window",
      }),
      now,
    });

    expect(summary.status).toBe("critical");
    expect(summary.primaryArea).toBe("model_quality");
    expect(summary.headline).toBe("Model quality risk requires review: public_content_leak.");
    expect(summary.nextActions[0]).toMatchObject({
      title: "Stop public release expansion until leak output is inspected",
      executable: false,
    });
  });

  it("uses lifecycle as the primary area when decision closure is the only failing layer", () => {
    const summary = buildDecisionOpsSummary({
      runbook: runbook(),
      recoveryPolicy: recovery(),
      modelQuality: modelQuality(),
      lifecycle: lifecycle({
        status: "critical",
        primaryIssue: "stale_open_decision",
        counts: {
          ...lifecycle().counts,
          staleOpen: 2,
        },
        actions: [
          {
            title: "Inspect resolution writer before adding more lifecycle UI",
            description: "Resolution appears overdue.",
            executable: false,
          },
        ],
      }),
      now,
    });

    expect(summary.status).toBe("critical");
    expect(summary.primaryArea).toBe("decision_lifecycle");
    expect(summary.headline).toBe("Decision lifecycle needs review: stale_open_decision.");
    expect(summary.areas.find((area) => area.area === "decision_lifecycle")).toMatchObject({
      status: "critical",
      evidence: {
        open: 1,
        resolved: 1,
        staleOpen: 2,
        inconsistentResolution: 0,
      },
    });
  });
});
