import { describe, expect, it } from "vitest";
import type { PublicDecisionStageTraceEntry } from "@/lib/watch/publicTimelineEvent";
import {
  normalizePublicDecisionStageStatuses,
  normalizePublicDecisionStageTrace,
  publicDecisionVisibleStageLimit,
} from "@/lib/watch/publicDecisionStageContract";

const observedAt = new Date(Date.UTC(2026, 4, 17, 6, 0, 0)).toISOString();

function stage(
  stageId: PublicDecisionStageTraceEntry["stageId"],
  status: PublicDecisionStageTraceEntry["status"],
): PublicDecisionStageTraceEntry {
  return { stageId, status, observedAt };
}

describe("public decision stage contract", () => {
  it("caps public progress at trade plan while no renderable trade decision exists", () => {
    const trace = [
      stage("analyst_inputs", "done"),
      stage("research_lead", "done"),
      stage("risk_lead", "in_progress"),
      stage("trade_decision", "pending"),
    ];

    const statuses = normalizePublicDecisionStageStatuses(trace, {
      hasRenderableTradeDecision: false,
    });

    expect(statuses).toMatchObject({
      analyst_inputs: "done",
      research_lead: "done",
      trade_decision: "in_progress",
      risk_lead: "pending",
    });
    expect(publicDecisionVisibleStageLimit(trace, { hasRenderableTradeDecision: false })).toBe(3);
    expect(
      normalizePublicDecisionStageTrace(trace, { hasRenderableTradeDecision: false })?.map(
        (entry) => `${entry.stageId}:${entry.status}`,
      ),
    ).toEqual([
      "analyst_inputs:done",
      "research_lead:done",
      "risk_lead:pending",
      "trade_decision:in_progress",
    ]);
  });

  it("does not let later trace progress skip an earlier public stage", () => {
    const trace = [
      stage("analyst_inputs", "pending"),
      stage("research_lead", "done"),
      stage("trade_decision", "pending"),
      stage("risk_lead", "pending"),
    ];

    expect(
      normalizePublicDecisionStageStatuses(trace, { hasRenderableTradeDecision: false }),
    ).toMatchObject({
      analyst_inputs: "in_progress",
      research_lead: "pending",
      trade_decision: "pending",
      risk_lead: "pending",
    });
    expect(publicDecisionVisibleStageLimit(trace, { hasRenderableTradeDecision: false })).toBe(1);
  });

  it("treats a renderable trade decision as the public final decision gate", () => {
    const trace = [
      stage("analyst_inputs", "done"),
      stage("research_lead", "done"),
      stage("risk_lead", "done"),
      stage("trade_decision", "done"),
      stage("record_write", "done"),
      stage("public_timeline", "done"),
    ];

    expect(
      normalizePublicDecisionStageStatuses(trace, { hasRenderableTradeDecision: true }),
    ).toMatchObject({
      analyst_inputs: "done",
      research_lead: "done",
      trade_decision: "done",
      risk_lead: "done",
      record_write: "done",
      public_timeline: "done",
    });
    expect(publicDecisionVisibleStageLimit(trace, { hasRenderableTradeDecision: true })).toBe(6);
  });

  it("preserves record write and timeline completion as audit facts before trade renders", () => {
    const trace = [
      stage("analyst_inputs", "done"),
      stage("research_lead", "done"),
      stage("trade_decision", "done"),
      stage("record_write", "done"),
      stage("public_timeline", "done"),
    ];

    const statuses = normalizePublicDecisionStageStatuses(trace, {
      hasRenderableTradeDecision: false,
    });

    expect(statuses.trade_decision).toBe("in_progress");
    expect(statuses.record_write).toBe("done");
    expect(statuses.public_timeline).toBe("done");
    expect(publicDecisionVisibleStageLimit(trace, { hasRenderableTradeDecision: false })).toBe(3);
  });

  it("lets completed analysis-only candidates advance without a renderable trade card", () => {
    const trace = [
      stage("analyst_inputs", "done"),
      stage("research_lead", "done"),
      stage("trade_decision", "done"),
      stage("risk_lead", "done"),
      stage("record_write", "done"),
      stage("public_timeline", "done"),
    ];

    const options = {
      hasRenderableTradeDecision: false,
      analysisOnlyCandidate: true,
    };

    expect(normalizePublicDecisionStageStatuses(trace, options)).toMatchObject({
      analyst_inputs: "done",
      research_lead: "done",
      trade_decision: "done",
      risk_lead: "done",
      record_write: "done",
      public_timeline: "done",
    });
    expect(publicDecisionVisibleStageLimit(trace, options)).toBe(6);
  });

  it("does not expose later analysis-only stages before the public current stage reaches them", () => {
    const trace = [
      stage("analyst_inputs", "done"),
      stage("research_lead", "done"),
      stage("trade_decision", "pending"),
      stage("risk_lead", "done"),
    ];
    const options = {
      hasRenderableTradeDecision: false,
      analysisOnlyCandidate: true,
    };

    expect(normalizePublicDecisionStageStatuses(trace, options)).toMatchObject({
      analyst_inputs: "done",
      research_lead: "done",
      trade_decision: "in_progress",
      risk_lead: "pending",
    });
    expect(publicDecisionVisibleStageLimit(trace, options)).toBe(3);
  });

  it("does not let record-write completion expose analysis-only later stages when an earlier stage has a gap", () => {
    const trace = [
      stage("analyst_inputs", "done"),
      stage("research_lead", "done"),
      stage("trade_decision", "pending"),
      stage("risk_lead", "done"),
      stage("record_write", "done"),
      stage("public_timeline", "done"),
    ];
    const options = {
      hasRenderableTradeDecision: false,
      analysisOnlyCandidate: true,
    };

    expect(normalizePublicDecisionStageStatuses(trace, options)).toMatchObject({
      analyst_inputs: "done",
      research_lead: "done",
      trade_decision: "in_progress",
      risk_lead: "pending",
      record_write: "done",
      public_timeline: "done",
    });
    expect(publicDecisionVisibleStageLimit(trace, options)).toBe(3);
  });
});
