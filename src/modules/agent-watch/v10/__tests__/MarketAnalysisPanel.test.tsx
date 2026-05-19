import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import zhCN from "@/i18n/dicts/zh_CN.json";
import type { Dict } from "@/i18n/types";
import type { CandidateType } from "@/lib/watch/decisionCandidate";
import type { DispatchTopic } from "../../v9/types";
import { dispatchV10DemoTopics } from "../demoTopics";
import {
  MarketAnalysisPanel,
  reconcileTopicCollapseState,
  topicDisplayIdentity,
  toggleTopicCollapseState,
} from "../MarketAnalysisPanel";

const dict = (zhCN as Dict).agentWatch.dispatchV10;

function topicFixture({
  id,
  candidateType = "symbol",
  candidateKey = id,
  title,
  symbol,
  score,
  lastUpdatedAt,
  executable,
}: {
  id: string;
  candidateType?: CandidateType;
  candidateKey?: string;
  title: string;
  symbol: string;
  score: number;
  lastUpdatedAt: number;
  executable: boolean;
}): DispatchTopic {
  const base = dispatchV10DemoTopics[0]!;
  return {
    ...base,
    id,
    candidateType,
    candidateKey,
    displayTitle: title,
    symbol,
    title,
    lastUpdatedAt,
    trigger: {
      ticker: `$${symbol}`,
      text: title,
    },
    execution: {
      executable,
      coinwPair: executable ? `${symbol}USDT` : null,
      watchOnly: !executable,
      ...(!executable ? { watchOnlyReason: "not_listed_on_coinw" as const } : {}),
    },
    strategy: {
      ...base.strategy,
      ticker: `$${symbol}`,
    },
    topicRanking: {
      score,
      intensity: score,
      rank: 1,
      rankLabel: `排序 #${score}`,
      explanation: `${title} score ${score}`,
    },
  };
}

describe("MarketAnalysisPanel v10", () => {
  test("renders a no-data empty state when real topics are empty", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel topics={[]} dict={dict} onPlaceholder={() => undefined} />,
    );

    expect(html).toContain("NO DATA");
    expect(html).toContain("工作台启动中，暂无最近决策");
    expect(html).not.toContain("BTC 决策流");
    expect(html).not.toContain("ETH 决策流");
    expect(html).not.toContain("SOL 决策流");
  });

  test("renders latest strategy and normalized role titles for explicit topics", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={dispatchV10DemoTopics}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).toContain("最新策略");
    expect(html).toContain("技术策略主管");
    expect(html).toContain("宏观情报分析师");
    expect(html).toContain("交易策略总监");
  });

  test("renders visible-session freshness state", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        dict={dict}
        freshness={{
          status: "refreshing",
          symbol: "BTC",
          refreshStarted: true,
          refreshSource: "records",
        }}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).toContain("新分析进行中");
    expect(html).toContain("完成后自动刷新");
  });

  test("renders resident prewarm status ahead of user-trigger freshness copy", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        dict={dict}
        freshness={{
          status: "idle",
          symbol: "SYMBOL",
          lastDecisionAt: "2026-05-19T02:00:00.000Z",
          refreshSource: "records",
          residentStatus: {
            schemaVersion: 1,
            servedAt: Date.parse("2026-05-19T12:00:00.000Z"),
            overallState: "failed",
            latestSucceededAt: "2026-05-19T11:00:00.000Z",
            marketOverview: {
              kind: "market_overview",
              state: "ready",
              stale: false,
              lastSucceededAt: "2026-05-19T11:00:00.000Z",
              lastAttemptAt: null,
              nextRunAt: null,
              lastError: null,
              jobId: null,
              candidateKey: null,
            },
            hotspot: {
              kind: "hotspot",
              state: "failed",
              stale: true,
              lastSucceededAt: null,
              lastAttemptAt: "2026-05-19T11:50:00.000Z",
              nextRunAt: "2026-05-19T11:55:00.000Z",
              lastError: "provider timeout",
              jobId: "pm-job:hotspot",
              candidateKey: "hotspot:utc:zh_CN:2026-05-19T12:market",
            },
          },
        }}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).toContain("后台更新异常");
    expect(html).toContain("仍显示缓存数据");
    expect(html).not.toContain("分析于 600 分钟前");
  });

  test("renders an explicit non-followable badge for watch-only topics", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          {
            ...dispatchV10DemoTopics[0]!,
            symbol: "BILL",
            execution: {
              executable: false,
              coinwPair: null,
              watchOnly: true,
              watchOnlyReason: "not_listed_on_coinw",
            },
          },
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).toContain("watch-only / 不可跟单");
    expect(html).toContain("该币种暂不支持 CoinW 跟单");
    expect(html).not.toContain("演示模式：当前不会真实下单");
  });

  test("renders market and hotspot candidate badges with type-specific card classes", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          topicFixture({
            id: "market-overview-1",
            candidateType: "market_overview",
            candidateKey: "market_overview:daily:zh_CN:2026-05-17",
            title: "今日大盘综述",
            symbol: "MARKET",
            score: 1,
            lastUpdatedAt: 1,
            executable: false,
          }),
          topicFixture({
            id: "hotspot-1",
            candidateType: "hotspot",
            candidateKey: "hotspot:stablecoin-flow:2026-05-17",
            title: "稳定币资金流热点",
            symbol: "USDT",
            score: 1,
            lastUpdatedAt: 1,
            executable: false,
          }),
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).toContain("大盘");
    expect(html).toContain("热点");
    expect(html).toContain("candidate-market-overview");
    expect(html).toContain("candidate-hotspot");
  });

  test("counts hotspot stats from hotspot cards, not total cards", () => {
    const marketOnlyHtml = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          topicFixture({
            id: "market-overview-1",
            candidateType: "market_overview",
            candidateKey: "market_overview:daily:zh_CN:2026-05-17",
            title: "今日大盘综述",
            symbol: "MARKET",
            score: 1,
            lastUpdatedAt: 1,
            executable: false,
          }),
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );
    const marketAndHotspotHtml = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          topicFixture({
            id: "market-overview-1",
            candidateType: "market_overview",
            candidateKey: "market_overview:daily:zh_CN:2026-05-17",
            title: "今日大盘综述",
            symbol: "MARKET",
            score: 1,
            lastUpdatedAt: 1,
            executable: false,
          }),
          topicFixture({
            id: "hotspot-1",
            candidateType: "hotspot",
            candidateKey: "hotspot:stablecoin-flow:2026-05-17",
            title: "稳定币资金流热点",
            symbol: "USDT",
            score: 1,
            lastUpdatedAt: 1,
            executable: false,
          }),
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(marketOnlyHtml).toContain("<span>热点</span><b>0</b>");
    expect(marketAndHotspotHtml).toContain("<span>热点</span><b>1</b>");
  });

  test("uses canonical candidate ordering instead of render index", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          topicFixture({
            id: "symbol-btc",
            candidateType: "symbol",
            candidateKey: "BTC",
            title: "BTC 决策流",
            symbol: "BTC",
            score: 99,
            lastUpdatedAt: 300,
            executable: true,
          }),
          topicFixture({
            id: "hotspot-btc-etf",
            candidateType: "hotspot",
            candidateKey: "hotspot:btc-etf:2026-05-17",
            title: "ETF 资金热点",
            symbol: "BTC",
            score: 10,
            lastUpdatedAt: 200,
            executable: false,
          }),
          topicFixture({
            id: "market-daily",
            candidateType: "market_overview",
            candidateKey: "market_overview:daily:zh_CN:2026-05-17",
            title: "今日大盘综述",
            symbol: "MARKET",
            score: 1,
            lastUpdatedAt: 100,
            executable: false,
          }),
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html.indexOf("今日大盘综述")).toBeLessThan(html.indexOf("ETF 资金热点"));
    expect(html.indexOf("ETF 资金热点")).toBeLessThan(html.indexOf("BTC 决策流"));
  });

  test("renders the follow-trade primary action only for executable symbol topics", () => {
    const marketHtml = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          topicFixture({
            id: "market-overview-executable-edge",
            candidateType: "market_overview",
            candidateKey: "market_overview:daily:zh_CN:2026-05-17",
            title: "今日大盘综述",
            symbol: "MARKET",
            score: 1,
            lastUpdatedAt: 1,
            executable: true,
          }),
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );
    const symbolHtml = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          topicFixture({
            id: "symbol-btc-executable",
            candidateType: "symbol",
            candidateKey: "BTC",
            title: "BTC 决策流",
            symbol: "BTC",
            score: 1,
            lastUpdatedAt: 1,
            executable: true,
          }),
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(marketHtml).not.toContain("演示模式");
    expect(marketHtml).toContain("watch-only / 不可跟单");
    expect(marketHtml).toContain("仅用于观察分析");
    expect(symbolHtml).toContain("演示模式");
  });

  test("keeps collapse state attached to record id after reorder", () => {
    const topicA = topicFixture({
      id: "record-a",
      candidateType: "symbol",
      candidateKey: "BTC",
      title: "BTC 决策流",
      symbol: "BTC",
      score: 1,
      lastUpdatedAt: 1,
      executable: true,
    });
    const topicB = {
      ...topicFixture({
        id: "record-b",
        candidateType: "hotspot",
        candidateKey: "hotspot:btc-etf:2026-05-17",
        title: "ETF 资金热点",
        symbol: "BTC",
        score: 2,
        lastUpdatedAt: 2,
        executable: false,
      }),
      defaultCollapsed: true,
    };
    const topicC = {
      ...topicFixture({
        id: "record-c",
        candidateType: "market_overview",
        candidateKey: "market_overview:daily:zh_CN:2026-05-17",
        title: "今日大盘综述",
        symbol: "MARKET",
        score: 3,
        lastUpdatedAt: 3,
        executable: false,
      }),
      defaultCollapsed: true,
    };

    const initial = reconcileTopicCollapseState([topicA, topicB, topicC], {});
    const expandedB = toggleTopicCollapseState(
      initial,
      topicDisplayIdentity(topicB),
      topicB.defaultCollapsed,
    );
    const reordered = reconcileTopicCollapseState([topicC, topicA, topicB], expandedB);

    expect(reordered[topicDisplayIdentity(topicB)]).toBe(false);
    expect(reordered[topicDisplayIdentity(topicC)]).toBe(true);
    expect(reordered[topicDisplayIdentity(topicA)]).toBe(topicA.defaultCollapsed);
  });

  test("keeps collapse state attached to candidate identity when a newer record replaces the card", () => {
    const firstRecord = {
      ...topicFixture({
        id: "record-old",
        candidateType: "hotspot",
        candidateKey: "hotspot:btc-etf:2026-05-17",
        title: "ETF 资金热点",
        symbol: "BTC",
        score: 2,
        lastUpdatedAt: 2,
        executable: false,
      }),
      defaultCollapsed: true,
    };
    const nextRecord = {
      ...firstRecord,
      id: "record-new",
      lastUpdatedAt: 3,
      title: "ETF 资金热点更新",
    };

    const initial = reconcileTopicCollapseState([firstRecord], {});
    const expanded = toggleTopicCollapseState(
      initial,
      topicDisplayIdentity(firstRecord),
      firstRecord.defaultCollapsed,
    );
    const reconciled = reconcileTopicCollapseState([nextRecord], expanded);

    expect(topicDisplayIdentity(firstRecord)).toBe(topicDisplayIdentity(nextRecord));
    expect(reconciled[topicDisplayIdentity(nextRecord)]).toBe(false);
  });
});
