import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  __decisionJudgeTestUtils,
  recordDecisionJudgeMetric,
  runDecisionJudge,
  summarizeDecisionJudgeMetrics,
} from "@/lib/llm/decisionJudge";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";

function record(): StrategyDecisionRecord {
  return {
    id: "pm:BTC:1",
    schemaVersion: 2,
    recordSource: "live",
    symbol: "BTC",
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["chart_analyst", "bullish_researcher", "bearish_researcher", "pm"],
    analystInputs: [
      {
        memberId: "chart_analyst",
        direction: "long",
        confidence: 0.7,
        rationale: "BTC holds the range with clean momentum confirmation.",
        evidenceIds: ["ev_1"],
      },
      {
        memberId: "bullish_researcher",
        direction: "long",
        confidence: 0.66,
        rationale: "Bullish flow is improving but entry still needs discipline.",
        evidenceIds: ["ev_1"],
      },
      {
        memberId: "bearish_researcher",
        direction: "short",
        confidence: 0.55,
        rationale: "A failed reclaim would pressure the setup quickly.",
        evidenceIds: ["ev_1"],
      },
      {
        memberId: "pm",
        direction: "long",
        confidence: 0.7,
        rationale: "Risk is bounded and the setup is valid.",
        evidenceIds: ["ev_1"],
      },
    ],
    createdAt: "2026-05-22T12:00:00.000Z",
    sourceThreadId: null,
    evaluationWindowEndsAt: null,
    resolvedAt: null,
    resolvedOutcome: null,
    tradeDecision: null,
    promptVersion: "test",
    modelProvider: "stub",
  };
}

describe("runDecisionJudge", () => {
  beforeEach(() => {
    __decisionJudgeTestUtils.clearMetrics();
  });

  it("passes clean records", async () => {
    const generate = vi.fn(async () =>
      JSON.stringify({
        verdict: "pass",
        fail_reason: null,
        fail_detail: null,
        confidence: 0.8,
      }),
    );

    const result = await runDecisionJudge(record(), { generate });

    expect(result).toMatchObject({
      verdict: "pass",
      fail_reason: null,
      status: "ok",
      callCount: 1,
    });
    expect(generate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ providerOverride: "claude-haiku" }),
    );
  });

  it.each(["semantic_duplicate", "viewpoint_missing", "stage_leak", "keyword_stuffing"] as const)(
    "fails on %s",
    async (failReason) => {
      const generate = vi.fn(async () =>
        JSON.stringify({
          verdict: "fail",
          fail_reason: failReason,
          fail_detail: "clear issue",
          confidence: 0.74,
        }),
      );

      const result = await runDecisionJudge(record(), { generate });

      expect(result).toMatchObject({
        verdict: "fail",
        fail_reason: failReason,
        fail_detail: "clear issue",
        confidence: 0.74,
        status: "ok",
      });
    },
  );

  it("treats low-confidence fail as pass", async () => {
    const generate = vi.fn(async () =>
      JSON.stringify({
        verdict: "fail",
        fail_reason: "semantic_duplicate",
        fail_detail: "uncertain",
        confidence: 0.4,
      }),
    );

    await expect(runDecisionJudge(record(), { generate })).resolves.toMatchObject({
      verdict: "pass",
      fail_reason: null,
      confidence: 0.4,
    });
  });

  it("retries malformed JSON once before falling back to pass", async () => {
    const generate = vi.fn(async () => "not-json");

    const result = await runDecisionJudge(record(), { generate });

    expect(result).toMatchObject({
      verdict: "pass",
      status: "malformed",
      callCount: 4,
    });
  });

  it("falls back to pass when providers are unavailable", async () => {
    const generate = vi.fn(async () => {
      throw new Error("provider down");
    });

    await expect(runDecisionJudge(record(), { generate })).resolves.toMatchObject({
      verdict: "pass",
      status: "unavailable",
      callCount: 4,
    });
  });

  it("summarizes in-memory judge metrics", () => {
    recordDecisionJudgeMetric({
      verdict: "fail",
      fail_reason: "stage_leak",
      fail_detail: "stage leak",
      confidence: 0.8,
      status: "ok",
      callCount: 2,
      inputTokenEstimate: 120,
      outputTokenEstimate: 24,
    });
    recordDecisionJudgeMetric({
      verdict: "pass",
      fail_reason: null,
      fail_detail: null,
      confidence: 0,
      status: "unavailable",
      callCount: 4,
      inputTokenEstimate: 240,
      outputTokenEstimate: 0,
    });

    expect(summarizeDecisionJudgeMetrics()).toMatchObject({
      judge_call_count: 6,
      judge_pass_count: 1,
      judge_fail_count: 1,
      judge_unavailable_count: 1,
      judge_estimated_input_tokens: 360,
      judge_estimated_output_tokens: 24,
      judge_fail_reasons: { stage_leak: 1 },
    });
  });
});
