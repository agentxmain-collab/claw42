import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicTimelineEvent, PublicTradeDecision } from "@/lib/watch/publicTimelineEvent";
import { describe, expect, test, vi } from "vitest";
import { buildHeroAnalysisBriefFromEvents } from "./heroAnalysisBrief";
import { SpeechBubble } from "./SpeechBubble";

vi.mock("@/i18n/I18nProvider", () => ({
  useI18n: () => ({
    t: {
      hero: {
        speechBubble: ["Agent 正在读取市场"],
        speechBubbleAriaLabel: "机器人行情提示",
      },
    },
  }),
}));

const completeSummary = "BTC 成交与新闻共振，短线偏多；若跌回前低，Agent 会撤销这次观察。";

const publicDecisionEvent: PublicTimelineEvent = {
  id: "pm-decision:btc-brief",
  ts: Date.parse("2026-05-30T12:00:00.000Z"),
  visibility: "public",
  importance: "high",
  sourceTrigger: "pm_decision",
  evidenceIds: [],
  locale: "zh_CN",
  payload: {
    kind: "pm_decision",
    recordId: "decision-btc-brief",
    symbol: "BTC",
    analysisSummary: completeSummary,
    tradeDecision: {
      direction: "long",
      confidence: 0.72,
      positionSizing: 0.1,
    } as PublicTradeDecision,
  },
};

describe("SpeechBubble analysis summary rendering", () => {
  test("hover render shows the watch timeline analysis summary instead of random speech", () => {
    const brief = buildHeroAnalysisBriefFromEvents({
      events: [publicDecisionEvent],
      evidenceMap: {},
      locale: "zh_CN",
    });

    const html = renderToStaticMarkup(
      <SpeechBubble
        visible
        reduceMotion
        side="right"
        lines={["随机话术，不应该覆盖行情摘要"]}
        analysisLine={brief?.line}
      />,
    );

    expect(html).toContain('data-bubble-mode="analysis-summary"');
    expect(html).toContain('data-analysis-summary-source="watch-timeline"');
    expect(html).toContain("$BTC");
    expect(html).toContain("LONG 10%");
    expect(html).toContain(completeSummary);
    expect(html).not.toContain("随机话术");
    expect(html).not.toMatch(/\.{3}|…/);
  });

  test("random speech behavior stays available when no analysis summary has loaded", () => {
    const html = renderToStaticMarkup(
      <SpeechBubble visible reduceMotion side="right" lines={["随机话术仍然保留"]} />,
    );

    expect(html).toContain('data-bubble-mode="random-speech"');
    expect(html).toContain("随机话术仍然保留");
  });
});
