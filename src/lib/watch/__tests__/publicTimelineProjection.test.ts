import { describe, expect, it } from "vitest";
import {
  filterPublicTimelineEvents,
  projectStreamEntryToPublic,
} from "@/lib/watch/publicTimelineProjection";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { StreamEntry } from "@/modules/agent-watch/types";

const now = Date.now();

const tradeDecision: TradeDecision = {
  id: "trade-1",
  schemaVersion: 1,
  symbol: "BTC",
  generatedBy: "pm",
  generatedAt: new Date(now).toISOString(),
  direction: "long",
  entryType: "market",
  entryPrice: 76000,
  entryRange: { low: 75500, high: 76500 },
  stopLoss: 74800,
  takeProfit: [78000],
  positionSizing: 0.1,
  timeHorizon: "intraday",
  rating: 4,
  confidence: 0.72,
  evidenceIds: ["ev_1"],
  riskNote: "Risk can fade",
  invalidatesIf: "BTC loses 74800",
  promptVersion: "test",
  modelProvider: "stub",
  severity: "high",
};

const decisionRecord: StrategyDecisionRecord = {
  id: "record-1",
  schemaVersion: 1,
  recordSource: "live",
  symbol: "BTC",
  locale: "zh_CN",
  decisionOwnerId: "pm",
  contributorIds: ["fundamental_analyst", "research_lead", "risk_lead"],
  analystInputs: [
    {
      memberId: "fundamental_analyst",
      direction: "long",
      confidence: 0.7,
      rationale: "BTC spot demand is improving near 76000.",
      evidenceIds: ["ev_1"],
    },
    {
      memberId: "research_lead",
      direction: "long",
      confidence: 0.68,
      rationale: "Research lead keeps the long thesis unless 74800 breaks.",
      evidenceIds: ["ev_2"],
    },
    {
      memberId: "risk_lead",
      direction: "neutral",
      confidence: 0.54,
      rationale: "Risk lead wants confirmation above 76500.",
      evidenceIds: [],
    },
  ],
  sourceThreadId: "thread-2",
  tradeDecision,
  createdAt: new Date(now).toISOString(),
  evaluationWindowEndsAt: null,
  resolvedAt: null,
  resolvedOutcome: null,
  promptVersion: "test",
  modelProvider: "stub",
  legacyFactionId: null,
};

function focusEntry(overrides: Partial<StreamEntry> = {}): StreamEntry {
  return {
    kind: "focus_event",
    id: "focus-1",
    ts: now,
    symbol: "BTC",
    signalType: "breakout",
    severity: "alert",
    description: "BTC breakout",
    primaryResponse: { agentId: "alpha", content: "legacy", symbol: "BTC" },
    ...overrides,
  } as StreamEntry;
}

describe("publicTimelineProjection", () => {
  it("projects public high market signals", () => {
    const event = projectStreamEntryToPublic(focusEntry());
    expect(event?.payload.kind).toBe("market_signal");
    expect(event?.visibility).toBe("public");
    expect(event?.importance).toBe("high");
  });

  it("filters debug entries from public mode", () => {
    const event = projectStreamEntryToPublic(
      focusEntry({
        meta: {
          visibility: "debug",
          importance: "critical",
          sourceTrigger: "market_signal",
          evidenceIds: [],
          locale: "zh_CN",
        },
      }),
    );
    expect(event).toBeNull();
  });

  it("filters low and medium entries from public mode", () => {
    const low = focusEntry({
      id: "low",
      meta: {
        visibility: "public",
        importance: "low",
        sourceTrigger: "market_signal",
        evidenceIds: [],
        locale: "zh_CN",
      },
    });
    const medium = focusEntry({
      id: "medium",
      meta: {
        visibility: "public",
        importance: "medium",
        sourceTrigger: "market_signal",
        evidenceIds: [],
        locale: "zh_CN",
      },
    });
    expect(filterPublicTimelineEvents([low, medium], { mode: "public" })).toHaveLength(0);
  });

  it("filters public entries by requested locale", () => {
    const zh = focusEntry({
      id: "zh",
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "market_signal",
        evidenceIds: [],
        locale: "zh_CN",
      },
    });
    const en = focusEntry({
      id: "en",
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "market_signal",
        evidenceIds: [],
        locale: "en_US",
      },
    });

    expect(
      filterPublicTimelineEvents([zh, en], { mode: "public", locale: "en_US" }).map(
        (event) => event.id,
      ),
    ).toEqual(["en"]);
  });

  it("does not project ambient chat-like entries", () => {
    const entry: StreamEntry = {
      kind: "watch_update",
      id: "watch-1",
      ts: now,
      updateType: "quiet_observation",
      title: "Quiet",
      content: "wait",
      dedupeKey: "quiet",
      severity: "neutral",
      meta: {
        visibility: "public",
        importance: "critical",
        sourceTrigger: "fallback",
        evidenceIds: [],
        locale: "zh_CN",
      },
    };
    expect(projectStreamEntryToPublic(entry)).toBeNull();
  });

  it("does not project chat_thread without pm decision provenance", () => {
    const entry: StreamEntry = {
      kind: "chat_thread",
      id: "thread-1",
      ts: now,
      thread: {
        id: "thread-1",
        seed: {
          id: "seed",
          type: "market",
          title: "Market",
          description: "Market",
          symbols: ["BTC"],
          sentiment: "neutral",
          createdAt: now,
        },
        messages: [],
        strategy: null,
        status: "completed",
        createdAt: now,
      },
      meta: {
        visibility: "public",
        importance: "critical",
        sourceTrigger: "pm_decision",
        evidenceIds: [],
        locale: "zh_CN",
      },
    };
    expect(projectStreamEntryToPublic(entry)).toBeNull();
  });

  it("projects pm decision threads with record provenance", () => {
    const entry: StreamEntry = {
      kind: "chat_thread",
      id: "thread-2",
      ts: now,
      thread: {
        id: "thread-2",
        seed: {
          id: "seed",
          type: "market",
          title: "Market",
          description: "Market",
          symbols: ["BTC"],
          sentiment: "neutral",
          createdAt: now,
        },
        messages: [],
        strategy: null,
        status: "completed",
        createdAt: now,
      },
      meta: {
        visibility: "public",
        importance: "high",
        sourceTrigger: "pm_decision",
        evidenceIds: ["ev_1"],
        locale: "zh_CN",
        recordId: "record-1",
        tradeDecision,
      },
    };
    const event = projectStreamEntryToPublic(entry, {
      mode: "public",
      decisionRecordsById: new Map([[decisionRecord.id, decisionRecord]]),
    });
    expect(event?.payload.kind).toBe("pm_decision");
    expect(event?.payload.kind === "pm_decision" ? event.payload.tradeDecision?.id : null).toBe(
      "trade-1",
    );
    expect(event?.evidenceIds).toEqual(["ev_1"]);
    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(event.payload.rationaleByMember.fundamental_analyst).toContain("spot demand");
    expect(event.payload.rationaleByMember.research_lead).toContain("long thesis");
    expect(event.payload.rationaleByMember.risk_lead).toContain("Risk lead");
    expect(event.payload.citationsByMember?.fundamental_analyst).toEqual(["ev_1"]);
    expect(event.payload.citationsByMember?.research_lead).toEqual(["ev_2"]);
    expect(event.payload.citationsByMember?.risk_lead).toBeUndefined();
  });
});
