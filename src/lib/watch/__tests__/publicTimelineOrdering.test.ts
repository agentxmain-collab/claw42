import { describe, expect, it } from "vitest";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import { compareDecisionCandidateOrder } from "@/lib/watch/decisionCandidate";
import {
  mergePublicTimelineEvents,
  publicTimelinePmCandidateKey,
} from "@/lib/watch/publicTimelineOrdering";

const now = Date.UTC(2026, 4, 16, 9, 0, 0);

function pmDecision({
  recordId,
  symbol,
  ts = now,
  id = `pm-decision:${recordId}`,
  candidateType,
  candidateKey,
  displayTitle,
}: {
  recordId: string;
  symbol: string;
  ts?: number;
  id?: string;
  candidateType?: "symbol" | "market_overview" | "hotspot";
  candidateKey?: string;
  displayTitle?: string;
}): PublicTimelineEvent {
  return {
    id,
    ts,
    visibility: "public",
    importance: "high",
    sourceTrigger: "pm_decision",
    evidenceIds: [],
    locale: "zh_CN",
    payload: {
      kind: "pm_decision",
      recordId,
      symbol,
      ...(candidateType ? { candidateType } : {}),
      ...(candidateKey ? { candidateKey } : {}),
      ...(displayTitle ? { displayTitle } : {}),
      tradeDecision: null,
      rationaleByMember: {},
    },
  };
}

function newsEvent(id: string, ts = now): PublicTimelineEvent {
  return {
    id,
    ts,
    visibility: "public",
    importance: "high",
    sourceTrigger: "news",
    evidenceIds: [id],
    locale: "zh_CN",
    payload: {
      kind: "news",
      evidenceId: id,
      symbols: ["BTC"],
    },
  };
}

describe("mergePublicTimelineEvents", () => {
  it("handles empty and single event inputs", () => {
    expect(mergePublicTimelineEvents([])).toEqual([]);
    const [single] = mergePublicTimelineEvents([
      pmDecision({ recordId: "pm:BILL:latest", symbol: "BILL" }),
    ]);

    expect(single?.payload.kind).toBe("pm_decision");
    expect(single?.payload.kind === "pm_decision" ? single.payload.recordId : null).toBe(
      "pm:BILL:latest",
    );
  });

  it("dedupes duplicate event ids while keeping deterministic order", () => {
    const first = newsEvent("news-1", now);
    const duplicate = newsEvent("news-1", now - 1);

    expect(mergePublicTimelineEvents([duplicate, first]).map((event) => event.id)).toEqual([
      "news-1",
    ]);
  });

  it("keeps only the latest public PM decision per locale and symbol", () => {
    const latest = pmDecision({
      recordId: "pm:BILL:1778923198583",
      symbol: "BILL",
      ts: now,
    });
    const stale = pmDecision({
      recordId: "pm:BILL:1778902920550",
      symbol: "BILL",
      ts: now - 6 * 60 * 60 * 1000,
    });
    const hype = pmDecision({
      recordId: "pm:HYPE:1778908242659",
      symbol: "HYPE",
      ts: now - 2 * 60 * 60 * 1000,
    });

    expect(
      mergePublicTimelineEvents([stale, hype, latest]).map((event) =>
        event.payload.kind === "pm_decision" ? event.payload.recordId : event.id,
      ),
    ).toEqual(["pm:BILL:1778923198583", "pm:HYPE:1778908242659"]);
  });

  it("uses record id as a stable tie-breaker for same-timestamp PM decisions", () => {
    const beta = pmDecision({ recordId: "pm:ETH:beta", symbol: "ETH", ts: now });
    const alpha = pmDecision({ recordId: "pm:BTC:alpha", symbol: "BTC", ts: now });

    expect(
      mergePublicTimelineEvents([beta, alpha]).map((event) =>
        event.payload.kind === "pm_decision" ? event.payload.recordId : event.id,
      ),
    ).toEqual(["pm:BTC:alpha", "pm:ETH:beta"]);
  });

  it("uses candidate type priority before score and timestamp for PM ordering", () => {
    const symbol = pmDecision({
      recordId: "pm:BTC:latest",
      symbol: "BTC",
      ts: now,
      candidateType: "symbol",
      candidateKey: "BTC",
    });
    const hotspot = pmDecision({
      recordId: "pm:hotspot:latest",
      symbol: "BTC",
      ts: now - 1,
      candidateType: "hotspot",
      candidateKey: "hotspot:btc-etf:2026-05-16",
    });
    const market = pmDecision({
      recordId: "pm:market:latest",
      symbol: "MARKET",
      ts: now - 2,
      candidateType: "market_overview",
      candidateKey: "market_overview:daily:zh_CN:2026-05-16",
    });

    expect(
      mergePublicTimelineEvents([symbol, hotspot, market]).map((event) =>
        event.payload.kind === "pm_decision" ? event.payload.recordId : event.id,
      ),
    ).toEqual(["pm:market:latest", "pm:hotspot:latest", "pm:BTC:latest"]);
  });

  it("dedupes PM events by public card lane keys", () => {
    const market = pmDecision({
      recordId: "pm:market:latest",
      symbol: "MARKET",
      ts: now,
      candidateType: "market_overview",
      candidateKey: "market_overview:daily:zh_CN:2026-05-16",
    });
    const hotspot = pmDecision({
      recordId: "pm:hotspot:latest",
      symbol: "BTC",
      ts: now,
      candidateType: "hotspot",
      candidateKey: "hotspot:btc-etf:window-2026-05-16T09",
    });
    const legacy = pmDecision({ recordId: "pm:BTC:latest", symbol: "BTC", ts: now });

    expect(publicTimelinePmCandidateKey(market)).toBe("zh_CN:market_overview");
    expect(publicTimelinePmCandidateKey(hotspot)).toBe("zh_CN:hotspot");
    expect(publicTimelinePmCandidateKey(legacy)).toBe("zh_CN:BTC");
  });

  it("keeps only the latest market overview public card across candidate windows", () => {
    const stale = pmDecision({
      recordId: "pm:market:morning",
      symbol: "MARKET",
      ts: Date.parse("2026-05-17T23:48:00.000Z"),
      candidateType: "market_overview",
      candidateKey: "market_overview:zh_CN:2026-05-18",
      displayTitle: "今日大盘综述",
    });
    const latest = pmDecision({
      recordId: "pm:market:afternoon",
      symbol: "MARKET",
      ts: Date.parse("2026-05-18T05:18:00.000Z"),
      candidateType: "market_overview",
      candidateKey: "market_overview:zh_CN:2026-05-18",
      displayTitle: "今日大盘综述",
    });

    expect(publicTimelinePmCandidateKey(stale)).toBe(publicTimelinePmCandidateKey(latest));
    expect(
      mergePublicTimelineEvents([stale, latest]).map((event) =>
        event.payload.kind === "pm_decision" ? event.payload.recordId : event.id,
      ),
    ).toEqual(["pm:market:afternoon"]);
  });

  it("keeps only the latest hotspot public card across candidate windows", () => {
    const stale = pmDecision({
      recordId: "pm:hotspot:older",
      symbol: "HOTSPOT",
      ts: Date.parse("2026-05-20T04:47:00.000Z"),
      candidateType: "hotspot",
      candidateKey: "hotspot:utc:zh_CN:2026-05-20T03:market",
      displayTitle: "热点叙事追踪",
    });
    const latest = pmDecision({
      recordId: "pm:hotspot:latest",
      symbol: "HOTSPOT",
      ts: Date.parse("2026-05-20T10:12:00.000Z"),
      candidateType: "hotspot",
      candidateKey: "hotspot:utc:zh_CN:2026-05-20T09:market",
      displayTitle: "热点叙事追踪",
    });

    expect(publicTimelinePmCandidateKey(stale)).toBe(publicTimelinePmCandidateKey(latest));
    expect(
      mergePublicTimelineEvents([stale, latest]).map((event) =>
        event.payload.kind === "pm_decision" ? event.payload.recordId : event.id,
      ),
    ).toEqual(["pm:hotspot:latest"]);
  });
});

describe("compareDecisionCandidateOrder", () => {
  it("orders three candidate types by canonical priority", () => {
    const sorted = [
      { candidateType: "symbol" as const, candidateKey: "BTC", lastUpdatedAt: now },
      { candidateType: "hotspot" as const, candidateKey: "hotspot:btc", lastUpdatedAt: now },
      {
        candidateType: "market_overview" as const,
        candidateKey: "market_overview:daily",
        lastUpdatedAt: now,
      },
    ].sort(compareDecisionCandidateOrder);

    expect(sorted.map((item) => item.candidateType)).toEqual([
      "market_overview",
      "hotspot",
      "symbol",
    ]);
  });

  it("uses score desc before lastUpdatedAt within the same type", () => {
    const sorted = [
      {
        candidateType: "symbol" as const,
        candidateKey: "BTC",
        score: 1,
        lastUpdatedAt: now,
      },
      {
        candidateType: "symbol" as const,
        candidateKey: "ETH",
        score: 9,
        lastUpdatedAt: now - 1,
      },
    ].sort(compareDecisionCandidateOrder);

    expect(sorted.map((item) => item.candidateKey)).toEqual(["ETH", "BTC"]);
  });

  it("uses lastUpdatedAt desc and then candidateKey/recordId lexicographic ties", () => {
    const sortedByTime = [
      {
        candidateType: "symbol" as const,
        candidateKey: "BTC",
        score: 1,
        lastUpdatedAt: now - 1,
      },
      {
        candidateType: "symbol" as const,
        candidateKey: "ETH",
        score: 1,
        lastUpdatedAt: now,
      },
    ].sort(compareDecisionCandidateOrder);
    const sortedById = [
      {
        candidateType: "symbol" as const,
        candidateKey: "ETH",
        recordId: "pm:ETH:beta",
        score: 1,
        lastUpdatedAt: now,
      },
      {
        candidateType: "symbol" as const,
        candidateKey: "BTC",
        recordId: "pm:BTC:alpha",
        score: 1,
        lastUpdatedAt: now,
      },
    ].sort(compareDecisionCandidateOrder);

    expect(sortedByTime.map((item) => item.candidateKey)).toEqual(["ETH", "BTC"]);
    expect(sortedById.map((item) => item.recordId)).toEqual(["pm:BTC:alpha", "pm:ETH:beta"]);
  });
});
