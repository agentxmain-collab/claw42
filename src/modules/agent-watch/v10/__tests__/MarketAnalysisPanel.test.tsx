import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import enUS from "@/i18n/dicts/en_US.json";
import zhCN from "@/i18n/dicts/zh_CN.json";
import type { Dict } from "@/i18n/types";
import type { TradingReadinessFailureKind } from "@/lib/coinw/tradeReadinessState";
import type { CandidateType } from "@/lib/watch/decisionCandidate";
import { mapPublicTimelineEventsToTopics } from "@/lib/watch/v9TopicAdapter";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import type { DispatchTopic } from "../../v9/types";
import { dispatchV10DemoTopics } from "../demoTopics";
import realTimelineZhCnPage1 from "./fixtures/real-timeline-zh-cn-page1.json";
import {
  collapseActiveTopicState,
  MarketAnalysisPanel,
  reconcileTopicCollapseState,
  topicDisplayIdentities,
  topicDisplayIdentity,
  toggleTopicCollapseState,
} from "../MarketAnalysisPanel";

const dict = (zhCN as Dict).agentWatch.dispatchV10;
const enDict = (enUS as Dict).agentWatch.dispatchV10;
const realTimelineEvents = (realTimelineZhCnPage1 as { events: PublicTimelineEvent[] }).events;

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
    newsItems: [
      {
        headline: `${title} headline`,
        source: "CoinDesk",
        observedAt: "12:00",
      },
    ],
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

function extractRealtimeStickyBlock(html: string) {
  const marker = 'data-realtime-analysis-sticky="true"';
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return "";
  const start = html.lastIndexOf("<section", markerIndex);
  const end = html.indexOf("</section>", markerIndex);
  return start === -1 || end === -1 ? "" : html.slice(start, end + "</section>".length);
}

function mapRealTimelineFixtureTopics() {
  return mapPublicTimelineEventsToTopics({
    events: realTimelineEvents,
    grouping: "raw",
    locale: "zh_CN",
    outcomeDict: dict.outcome,
    roundDict: dict.round,
    stageStatusDict: dict.stageStatus,
    topicRankingDict: dict.topicRanking,
    now: Date.parse("2026-06-03T00:00:00+08:00"),
  });
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

  test("renders normalized role titles for explicit topics", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={dispatchV10DemoTopics}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).toContain("技术策略主管");
    expect(html).toContain("宏观情报分析师");
    expect(html).toContain("交易策略总监");
  });

  test("renders upgraded avatars in chat shell and topic head", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[dispatchV10DemoTopics[0]!]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).toContain("workbench-core-robot");
    expect(html).toContain('class="ear-l"');
    expect(html).not.toContain("cs-icon-avatar");
    expect(html).not.toContain('data-inline-avatar="core"');
    expect(html).toContain('data-inline-avatar="technical"');
    expect((html.match(/market-panel-avatar/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });

  test("does not render the removed public feedback controls on topic cards", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[dispatchV10DemoTopics[0]!]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).not.toContain("这条分析有帮助吗");
    expect(html).not.toContain("有帮助");
    expect(html).not.toContain("没帮助");
    expect(html).not.toContain("topic-feedback");
    expect(html).not.toContain("data-feedback-topic");
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

  test("omits cached analysis age from the workbench header", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        dict={dict}
        freshness={{
          status: "idle",
          symbol: "BTC",
          lastDecisionAt: "2026-05-19T11:00:00.000Z",
          refreshSource: "records",
          residentStatus: {
            schemaVersion: 1,
            servedAt: Date.parse("2026-05-19T12:00:00.000Z"),
            overallState: "ready",
            slaState: "healthy",
            latestSucceededAt: "2026-05-19T11:00:00.000Z",
            marketOverview: {
              kind: "market_overview",
              state: "ready",
              slaState: "healthy",
              stale: false,
              ageMs: 60 * 60_000,
              expectedIntervalMs: 3 * 60 * 60_000,
              staleAfterMs: 6 * 60 * 60_000,
              lastSucceededAt: "2026-05-19T11:00:00.000Z",
              lastAttemptAt: null,
              nextRunAt: null,
              lastError: null,
              jobId: null,
              candidateKey: "market:zh_CN",
            },
            hotspot: {
              kind: "hotspot",
              state: "ready",
              slaState: "healthy",
              stale: false,
              ageMs: 90 * 60_000,
              expectedIntervalMs: 3 * 60 * 60_000,
              staleAfterMs: 6 * 60 * 60_000,
              lastSucceededAt: "2026-05-19T10:30:00.000Z",
              lastAttemptAt: null,
              nextRunAt: null,
              lastError: null,
              jobId: null,
              candidateKey: "hotspot:zh_CN",
            },
          },
        }}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).toContain("AI 团队工作台");
    expect(html).toContain("实时交易决策流");
    expect(html).not.toContain("cs-stat");
    expect(html).not.toContain("全局分析缓存");
    expect(html).not.toMatch(/分析于\s*\d+\s*分钟前/);
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
            slaState: "critical",
            latestSucceededAt: "2026-05-19T11:00:00.000Z",
            marketOverview: {
              kind: "market_overview",
              state: "ready",
              slaState: "healthy",
              stale: false,
              ageMs: 60 * 60_000,
              expectedIntervalMs: 3 * 60 * 60_000,
              staleAfterMs: 6 * 60 * 60_000,
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
              slaState: "critical",
              stale: true,
              ageMs: null,
              expectedIntervalMs: 3 * 60 * 60_000,
              staleAfterMs: 6 * 60 * 60_000,
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

  test("renders an explicit analysis-only badge for non-followable topics", () => {
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

    expect(html).toContain("去交易");
    expect(html).not.toContain("仅分析 / 不自动下单");
    expect(html).not.toContain("该币种暂不支持 CoinW 合约开单");
    expect(html).not.toContain("演示模式：当前不会真实下单");
  });

  test("bypasses freshness gating for stale executable decisions with a concrete direction", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          {
            ...topicFixture({
              id: "stale-btc",
              candidateType: "symbol",
              candidateKey: "BTC",
              title: "BTC 实时行情分析",
              symbol: "BTC",
              score: 1,
              lastUpdatedAt: 1,
              executable: true,
            }),
            strategy: {
              ...dispatchV10DemoTopics[0]!.strategy,
              action: "long",
              actionLabel: "做多",
              ticker: "$BTC",
            },
            freshnessStatus: {
              level: "stale",
              observedAt: "2026-05-21T00:00:00.000Z",
              ageMinutes: 500,
              staleAfterMinutes: 360,
              expiredAfterMinutes: 1440,
            },
          },
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).toContain("freshness-stale");
    expect(html).not.toContain("行情已过期，等待新分析后开放交易");
    expect(html).toContain("分析于 8 小时前");
    expect(html).toContain('target="_blank"');
    expect(html).toContain("去交易");
  });

  test("filters market and hotspot cards from the symbol-only market analysis list", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          {
            ...topicFixture({
              id: "market-overview-observation",
              candidateType: "market_overview",
              candidateKey: "market_overview:daily:zh_CN:2026-05-22",
              title: "今日大盘综述",
              symbol: "MARKET",
              score: 1,
              lastUpdatedAt: 1,
              executable: false,
            }),
          },
          topicFixture({
            id: "hotspot-observation",
            candidateType: "hotspot",
            candidateKey: "hotspot:stablecoin-flow:2026-05-22",
            title: "热点叙事追踪",
            symbol: "HOTSPOT",
            score: 2,
            lastUpdatedAt: 2,
            executable: false,
          }),
          topicFixture({
            id: "symbol-hype",
            candidateType: "symbol",
            candidateKey: "HYPE",
            title: "HYPE 实时行情分析",
            symbol: "HYPE",
            score: 3,
            lastUpdatedAt: 3,
            executable: true,
          }),
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).toContain("HYPE 实时行情分析");
    expect(html).not.toContain("今日大盘综述");
    expect(html).not.toContain("热点叙事追踪");
    expect(html).not.toContain("candidate-market-overview");
    expect(html).not.toContain("candidate-hotspot");
  });

  test("renders the first news item instead of repeating the topic explanation", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          {
            ...topicFixture({
              id: "symbol-hype-news",
              candidateType: "symbol",
              candidateKey: "HYPE",
              title: "HYPE 实时行情分析",
              symbol: "HYPE",
              score: 1,
              lastUpdatedAt: 1,
              executable: false,
            }),
            strategy: {
              ...topicFixture({
                id: "strategy-source",
                title: "HYPE 实时行情分析",
                symbol: "HYPE",
                score: 1,
                lastUpdatedAt: 1,
                executable: false,
              }).strategy,
              mode: "observation",
            },
            explanation: "旧解释不应该在头部重复出现",
            newsItems: [
              {
                headline: "BTC 与主流资产同步进入风险再定价",
                source: "CryptoCompare",
                observedAt: "13:20",
              },
            ],
          },
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).toContain('class="v3-news-headline"');
    expect(html).toContain("BTC 与主流资产同步进入风险再定价");
    expect(html).toContain("CryptoCompare");
    expect(html).toContain("13:20");
    expect(html).not.toContain("旧解释不应该在头部重复出现");
  });

  test("shows an explicit no-news placeholder instead of repeating the explanation", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          {
            ...topicFixture({
              id: "symbol-hype-no-news",
              candidateType: "symbol",
              candidateKey: "HYPE",
              title: "HYPE 实时行情分析",
              symbol: "HYPE",
              score: 1,
              lastUpdatedAt: 1,
              executable: false,
            }),
            strategy: {
              ...topicFixture({
                id: "strategy-source-no-news",
                title: "HYPE 实时行情分析",
                symbol: "HYPE",
                score: 1,
                lastUpdatedAt: 1,
                executable: false,
              }).strategy,
              mode: "observation",
            },
            explanation: "这段解释不应该伪装成新闻摘要",
            newsItems: [],
          },
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).toContain("暂无相关新闻");
    expect(html).not.toContain("这段解释不应该伪装成新闻摘要");
  });

  test("renders topic card v3 with the seven-block handoff structure and real data", () => {
    const longBull = "多头反驳：BTC 仍有 ETF 净流入和关键支撑，短线不能假设单边下跌。";
    const longBear =
      "空头主线：BTC 24 小时跌破关键区间，恐慌指数同步走弱，空方暂时占优但需要控制追空风险。";
    const longRisk =
      "风险审查：爆仓数据显示拥挤交易增加，若价格快速反抽，仓位需要保持轻量并等待确认。";
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          {
            ...topicFixture({
              id: "btc-v3",
              candidateType: "symbol",
              candidateKey: "BTC",
              title: "BTC 实时行情分析",
              symbol: "BTC",
              score: 1,
              lastUpdatedAt: 1,
              executable: true,
            }),
            defaultCollapsed: true,
            strategy: {
              ...dispatchV10DemoTopics[0]!.strategy,
              action: "short",
              actionLabel: "SHORT 25%",
              ticker: "$BTC",
              entry: "76,200 - 76,500",
              stopLoss: "77,200",
              takeProfit: "74,000",
              meta: "置信度 65% · intraday",
              follow: {
                ...dispatchV10DemoTopics[0]!.strategy.follow,
                watchCount: 0,
                followCount: 0,
              },
            },
            newsItems: [
              {
                headline: "BTC 跌破 76,000 USD 关键支撑位，24 小时跌幅扩大到 1.78%",
                source: "PANews",
                observedAt: "2026-05-28 07:14 · 4 分钟前",
                url: "https://example.com/btc-news",
              },
            ],
            messages: [
              {
                id: "bull-case",
                stageId: "v10-demo-btc-decision-flow-stage-2",
                agentId: "bullish_researcher",
                agentName: "多头研究员",
                roleViewpoint: "多头论证视角",
                time: "12:00",
                mentions: [],
                content: longBull,
                direction: "long",
                directionLabel: "做多",
                confidence: 35,
              },
              {
                id: "bear-case",
                stageId: "v10-demo-btc-decision-flow-stage-2",
                agentId: "bearish_researcher",
                agentName: "空头研究员",
                roleViewpoint: "空头论证视角",
                time: "12:00",
                mentions: [],
                content: longBear,
                direction: "short",
                directionLabel: "做空",
                confidence: 68,
              },
              {
                id: "risk-review",
                stageId: "v10-demo-btc-decision-flow-stage-4",
                agentId: "conservative_reviewer",
                agentName: "风险防御总监",
                roleViewpoint: "风险审查视角",
                time: "12:00",
                mentions: [],
                content: longRisk,
                direction: "wait",
                directionLabel: "中性",
                confidence: 55,
              },
            ],
          },
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).toContain('data-topic-card-v3="true"');
    expect(html).not.toContain('class="topic-head"');
    expect(html).not.toContain('class="topic-title-row"');
    expect(html).toContain('class="v3-topic short');
    expect(html).toContain('class="v3-news-tag"');
    expect(html).toContain("决策源");
    expect(html).toContain('class="v3-news-headline"');
    expect(html).toContain("<em>76,000 USD</em>");
    expect(html).toContain('class="v3-news-orig"');
    expect(html).toContain("原文");
    expect(html).toContain('class="v3-news-foot"');
    expect(html).toContain("PANews");
    expect(html).toContain('class="v3-title-ticker"');
    expect(html).toContain('class="v3-title-rest"');
    expect(html).toContain('class="v3-time-chip"');
    expect((html.match(/class="v3-cell"/g) ?? []).length).toBe(3);
    expect(html).toContain("入场区间");
    expect(html).not.toContain("当前围绕");
    expect(html).toContain("77,200");
    expect(html).toContain("74,000");
    expect(html).toContain('class="v3-mega-top"');
    expect(html).toContain('class="v3-mega-icon"');
    expect(html).toContain("SHORT");
    expect(html).toContain("25%");
    expect(html).toContain('class="v3-mega-bottom"');
    expect(html).toContain("去交易");
    expect(html).toContain('class="v3-reason-head"');
    expect(html).toContain('class="v3-reason-tag"');
    expect(html).toContain('class="v3-reason-byline"');
    expect((html.match(/class="v3-reason-p"/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('class="v3-reason-hl"');
    expect(html).toContain('class="v3-reason-code"');
    expect(html).toContain('class="v3-secondary"');
    expect(html).toContain('class="v3-sec-head"');
    expect(html).toContain('class="v3-sec-foot"');
    expect(html).not.toContain('class="v3-pulse"');
    expect(html).not.toContain("0 人在看 · 0 已跟单");
    expect(html).toContain("展开");
    expect(html).toContain("多空双向分析 · 空方占优");
    expect(html).toContain("核心推理");
    expect(html).toContain("查看完整推理链");
    expect(html).toContain('aria-controls="dispatch-v10-topic-btc-v3"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(longBull);
    expect(html).toContain(longBear);
    expect(html).toContain(longRisk);
    expect(html).not.toContain("4 Agent");
    expect(html).not.toContain("7 轮辩论");
  });

  test("pins only the realtime analysis summary inside the expanded strategy scope", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          {
            ...topicFixture({
              id: "btc-expanded-sticky",
              candidateType: "symbol",
              candidateKey: "BTC",
              title: "BTC 实时行情分析",
              symbol: "BTC",
              score: 1,
              lastUpdatedAt: 1,
              executable: true,
            }),
            defaultCollapsed: false,
            strategy: {
              ...dispatchV10DemoTopics[0]!.strategy,
              action: "short",
              actionLabel: "SHORT 25%",
              ticker: "$BTC",
              entry: "76,200 - 76,500",
              stopLoss: "77,200",
              takeProfit: "74,000",
            },
            newsItems: [
              {
                headline: "BTC 跌破 76,000 USD 关键支撑位",
                source: "PANews",
                observedAt: "2026-05-28 07:14",
                url: "https://example.com/btc-expanded",
              },
            ],
          },
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );
    const sticky = extractRealtimeStickyBlock(html);

    expect(sticky).toContain('data-realtime-analysis-sticky="true"');
    expect(sticky).toContain('class="v3-head"');
    expect(sticky).toContain("BTC");
    expect(sticky).toContain("实时行情分析");
    expect(sticky).toContain('class="v3-time-chip"');
    expect(sticky).toContain('class="v3-matrix"');
    expect(sticky).toContain("入场区间");
    expect(sticky).toContain("77,200");
    expect(sticky).toContain("74,000");
    expect(sticky).toContain('class="v3-mega-cta"');
    expect(sticky).toContain("SHORT");
    expect(sticky).toContain("25%");
    expect(sticky).not.toContain("决策源");
    expect(sticky).not.toContain("核心推理");
    expect(sticky).not.toContain("查看完整推理链");
    expect(sticky).not.toContain('class="v3-news-hero"');
    expect(sticky).not.toContain('class="v3-reasoning"');
    expect(sticky).not.toContain('class="v3-secondary"');
    expect(html).toMatch(/class="topic[^"]*expanded/);
    expect(html).toContain('class="topic-scroll-content"');
    expect(html).not.toContain('class="chat-shell-body has-sticky-summary"');
    expect(html).toContain('class="chat-shell-active-summary"');
    expect(html).toContain(
      'class="chat-shell-active-summary" data-active-topic-card-id="record:btc-expanded-sticky"',
    );
    expect(sticky).toContain('data-sticky-container="chat-shell"');
    expect(html).toContain('class="topic-realtime-summary topic-realtime-sticky topic-card-v3');
    expect(html.indexOf('data-realtime-analysis-sticky="true"')).toBeGreaterThan(
      html.indexOf('class="chat-shell-active-summary"'),
    );
  });

  test("normalizes initially open topics to a single expanded strategy", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          topicFixture({
            id: "btc-default-open",
            candidateType: "symbol",
            candidateKey: "BTC",
            title: "BTC 实时行情分析",
            symbol: "BTC",
            score: 1,
            lastUpdatedAt: 2,
            executable: true,
          }),
          topicFixture({
            id: "eth-default-open",
            candidateType: "symbol",
            candidateKey: "ETH",
            title: "ETH 实时行情分析",
            symbol: "ETH",
            score: 2,
            lastUpdatedAt: 1,
            executable: true,
          }),
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html.match(/class="topic[^"]*expanded/g) ?? []).toHaveLength(1);
    expect(html.match(/data-realtime-analysis-sticky="true"/g) ?? []).toHaveLength(1);
  });

  test("keeps real raw timeline records as separate collapse identities", () => {
    const topics = mapRealTimelineFixtureTopics();
    const repeatedSymbolCount = topics.filter((topic) => topic.symbol === "BTC").length;
    expect(topics.length).toBeGreaterThan(1);
    expect(repeatedSymbolCount).toBeGreaterThan(1);

    const identities = topicDisplayIdentities(topics);
    const initialCollapseState = reconcileTopicCollapseState(topics, {});
    const targetBtcIndex = topics.findIndex(
      (topic, index) =>
        topic.symbol === "BTC" && initialCollapseState[identities[index]!] !== false,
    );
    const targetBtcTopic = topics[targetBtcIndex];
    expect(targetBtcTopic).toBeDefined();
    expect(targetBtcIndex).toBeGreaterThanOrEqual(0);
    expect(new Set(identities).size).toBe(topics.length);

    const expandedFirstBtc = toggleTopicCollapseState(
      initialCollapseState,
      identities[targetBtcIndex]!,
      targetBtcTopic!.defaultCollapsed,
    );
    const expandedTopics = topics.filter(
      (_, index) => expandedFirstBtc[identities[index]!] === false,
    );
    expect(expandedTopics).toHaveLength(1);
    expect(expandedTopics[0]?.id).toBe(targetBtcTopic!.id);

    const html = renderToStaticMarkup(
      <MarketAnalysisPanel topics={topics} dict={dict} onPlaceholder={() => undefined} />,
    );
    const cardIds = Array.from(html.matchAll(/data-topic-card-id="([^"]+)"/g)).map(
      (match) => match[1]!,
    );

    expect(cardIds).toHaveLength(topics.length);
    expect(new Set(cardIds).size).toBe(cardIds.length);
    expect(cardIds.some((id) => id === "symbol:BTC")).toBe(false);
  });

  test("collapses the active strategy at the end without opening the next record", () => {
    const topicIds = ["record:btc-a", "record:btc-b", "record:eth-a"];
    const collapsed = collapseActiveTopicState(
      {
        "record:btc-a": false,
        "record:btc-b": true,
        "record:eth-a": true,
      },
      topicIds,
      "record:btc-a",
    );

    expect(collapsed).toEqual({
      "record:btc-a": true,
      "record:btc-b": true,
      "record:eth-a": true,
    });
  });

  test("keeps collapsed topic cards from rendering the sticky realtime footer", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          {
            ...topicFixture({
              id: "btc-collapsed-no-sticky",
              candidateType: "symbol",
              candidateKey: "BTC",
              title: "BTC 实时行情分析",
              symbol: "BTC",
              score: 1,
              lastUpdatedAt: 1,
              executable: true,
            }),
            defaultCollapsed: true,
          },
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).not.toContain('data-realtime-analysis-sticky="true"');
    expect(html).not.toContain('class="topic-realtime-sticky"');
    expect(html).toMatch(/class="topic[^"]*collapsed/);
    expect(html).toContain('class="v3-news-hero"');
    expect(html).toContain('class="v3-secondary"');
  });

  test("renders the localized position size label inside the visible trade CTA", () => {
    const zhHtml = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          {
            ...topicFixture({
              id: "symbol-btc-cta-size-zh",
              candidateType: "symbol",
              candidateKey: "BTC",
              title: "BTC 实时行情分析",
              symbol: "BTC",
              score: 1,
              lastUpdatedAt: 1,
              executable: true,
            }),
            strategy: {
              ...dispatchV10DemoTopics[0]!.strategy,
              action: "long",
              actionLabel: "LONG 10%",
              ticker: "$BTC",
            },
          },
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );
    const enHtml = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          {
            ...topicFixture({
              id: "symbol-btc-cta-size-en",
              candidateType: "symbol",
              candidateKey: "BTC",
              title: "BTC live market analysis",
              symbol: "BTC",
              score: 1,
              lastUpdatedAt: 1,
              executable: true,
            }),
            strategy: {
              ...dispatchV10DemoTopics[0]!.strategy,
              action: "long",
              actionLabel: "LONG 10%",
              ticker: "$BTC",
            },
          },
        ]}
        dict={enDict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(zhHtml).toContain('<span class="v3-mega-size">建议仓位 10%</span>');
    expect(enHtml).toContain('<span class="v3-mega-size">Suggested size 10%</span>');
    expect(zhHtml).not.toContain('<span class="v3-mega-size">10%</span>');
    expect(enHtml).not.toContain('<span class="v3-mega-size">10%</span>');
  });

  test("renders accumulated server-loaded pages and final infinite-scroll state", () => {
    const topics = Array.from({ length: 16 }, (_, index) =>
      topicFixture({
        id: `symbol-${index + 1}`,
        candidateType: "symbol",
        candidateKey: `SYM${index + 1}`,
        title: `SYM${index + 1} 实时行情分析`,
        symbol: `SYM${index + 1}`,
        score: 100 - index,
        lastUpdatedAt: 100 - index,
        executable: true,
      }),
    );
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={topics}
        dict={dict}
        onPlaceholder={() => undefined}
        pagination={{
          hasMore: false,
          loading: false,
          loadedCount: topics.length,
          onLoadMore: () => undefined,
        }}
      />,
    );

    expect(html).not.toContain("topic-pagination");
    expect(html).toContain('data-topic-card-id="record:symbol-15"');
    expect(html).toContain('data-topic-card-id="record:symbol-16"');
    expect(html).toContain("已加载全部 16 张");
  });

  test("omits the header counter block from the symbol-only visible list", () => {
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
    const symbolHtml = renderToStaticMarkup(
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
            id: "symbol-1",
            candidateType: "symbol",
            candidateKey: "BTC",
            title: "BTC 实时行情分析",
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

    expect(marketOnlyHtml).not.toContain("cs-head-right");
    expect(symbolHtml).not.toContain("cs-head-right");
    expect(symbolHtml).not.toContain("cs-stat");
  });

  test("marks unresolved public strategies as tracking and resolved strategies as completed", () => {
    const trackingHtml = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          topicFixture({
            id: "tracking-btc",
            candidateType: "symbol",
            candidateKey: "BTC",
            title: "BTC 实时行情分析",
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
    const completedHtml = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          {
            ...topicFixture({
              id: "completed-btc",
              candidateType: "symbol",
              candidateKey: "BTC",
              title: "BTC 实时行情分析",
              symbol: "BTC",
              score: 1,
              lastUpdatedAt: 1,
              executable: true,
            }),
            resolvedAt: "2026-05-28T07:30:00.000Z",
          } as DispatchTopic & { resolvedAt: string },
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(trackingHtml).toContain("strategy-lifecycle-badge tracking");
    expect(trackingHtml).toContain("追踪");
    expect(completedHtml).toContain("strategy-lifecycle-badge completed");
    expect(completedHtml).toContain("完成");
  });

  test("uses ranking order for visible symbol topics instead of render index", () => {
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
            id: "symbol-eth",
            candidateType: "symbol",
            candidateKey: "ETH",
            title: "ETH 实时行情分析",
            symbol: "ETH",
            score: 100,
            lastUpdatedAt: 200,
            executable: true,
          }),
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html.indexOf("ETH 实时行情分析")).toBeLessThan(html.indexOf("BTC 决策流"));
  });

  test("uses ranking rank as the final rendered card order", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          {
            ...topicFixture({
              id: "old-rank-4",
              candidateType: "symbol",
              candidateKey: "news-driven:BTC:old",
              title: "Older BTC card",
              symbol: "BTC",
              score: 60,
              lastUpdatedAt: 100,
              executable: true,
            }),
            topicRanking: {
              score: 60,
              intensity: 4,
              rank: 4,
              rankLabel: "排序 #4",
              explanation: "Older BTC",
            },
          },
          {
            ...topicFixture({
              id: "fresh-rank-1",
              candidateType: "symbol",
              candidateKey: "news-driven:BTC:fresh",
              title: "Fresh BTC card",
              symbol: "BTC",
              score: 50,
              lastUpdatedAt: 300,
              executable: true,
            }),
            topicRanking: {
              score: 50,
              intensity: 3,
              rank: 1,
              rankLabel: "排序 #1",
              explanation: "Fresh BTC",
            },
          },
          {
            ...topicFixture({
              id: "fresh-rank-3",
              candidateType: "symbol",
              candidateKey: "news-driven:SOL:fresh",
              title: "Fresh SOL card",
              symbol: "SOL",
              score: 90,
              lastUpdatedAt: 200,
              executable: true,
            }),
            topicRanking: {
              score: 90,
              intensity: 5,
              rank: 3,
              rankLabel: "排序 #3",
              explanation: "Fresh SOL",
            },
          },
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html.indexOf("Fresh BTC card")).toBeLessThan(html.indexOf("Fresh SOL card"));
    expect(html.indexOf("Fresh SOL card")).toBeLessThan(html.indexOf("Older BTC card"));
    expect(html).not.toContain("排序 #");
    expect(html).not.toContain("topic-ranking-label");
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
    expect(marketHtml).not.toContain("仅分析 / 不自动下单");
    expect(marketHtml).not.toContain("今日大盘综述");
    expect(symbolHtml).not.toContain("演示模式");
    expect(symbolHtml).toContain("去交易");
  });

  test("renders CoinW futures navigation only for visible symbol topics", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          topicFixture({
            id: "market-daily",
            candidateType: "market_overview",
            candidateKey: "market_overview:daily:zh_CN:2026-05-17",
            title: "今日大盘综述",
            symbol: "MARKET",
            score: 3,
            lastUpdatedAt: 3,
            executable: false,
          }),
          topicFixture({
            id: "symbol-hype",
            candidateType: "symbol",
            candidateKey: "HYPE",
            title: "HYPE 实时行情分析",
            symbol: "HYPE",
            score: 2,
            lastUpdatedAt: 2,
            executable: true,
          }),
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).toContain("去交易");
    expect(html).toContain('href="https://www.coinw.com/zh_CN/futures/usdt/hypeusdt"');
    expect(html).not.toContain("去 CoinW 看合约");
    expect(html).not.toContain("今日大盘综述");
    expect(html.match(/去交易/g)).toHaveLength(1);
    expect(html).not.toContain("仅分析 / 不自动下单");
  });

  test("uses pair-specific CoinW links only for executable symbol topics", () => {
    const previousTemplate = process.env.NEXT_PUBLIC_COINW_FUTURES_TRADE_URL_TEMPLATE;
    process.env.NEXT_PUBLIC_COINW_FUTURES_TRADE_URL_TEMPLATE =
      "https://www.coinw.com/futures/{pairCompactLower}";

    try {
      const html = renderToStaticMarkup(
        <MarketAnalysisPanel
          topics={[
            topicFixture({
              id: "market-daily",
              candidateType: "market_overview",
              candidateKey: "market_overview:daily:zh_CN:2026-05-17",
              title: "今日大盘综述",
              symbol: "MARKET",
              score: 3,
              lastUpdatedAt: 3,
              executable: false,
            }),
            topicFixture({
              id: "symbol-hype",
              candidateType: "symbol",
              candidateKey: "HYPE",
              title: "HYPE 实时行情分析",
              symbol: "HYPE",
              score: 2,
              lastUpdatedAt: 2,
              executable: true,
            }),
          ]}
          dict={dict}
          onPlaceholder={() => undefined}
        />,
      );

      expect(html).toContain('href="https://www.coinw.com/futures/hypeusdt"');
      expect(html).not.toContain('href="https://www.coinw.com/market/futures"');
      expect(html).not.toContain('data-trade-readiness-kind="instrument_unavailable"');
    } finally {
      if (previousTemplate === undefined) {
        delete process.env.NEXT_PUBLIC_COINW_FUTURES_TRADE_URL_TEMPLATE;
      } else {
        process.env.NEXT_PUBLIC_COINW_FUTURES_TRADE_URL_TEMPLATE = previousTemplate;
      }
    }
  });

  test("builds a symbol-specific CoinW link when execution coinwPair is missing", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[
          {
            ...topicFixture({
              id: "symbol-genius",
              candidateType: "symbol",
              candidateKey: "GENIUS",
              title: "GENIUS 实时行情分析",
              symbol: "GENIUS",
              score: 2,
              lastUpdatedAt: 2,
              executable: true,
            }),
            execution: {
              executable: true,
              coinwPair: null,
              watchOnly: false,
            },
          },
        ]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).toContain('href="https://www.coinw.com/zh_CN/futures/usdt/geniususdt"');
    expect(html).not.toContain('href="https://www.coinw.com/zh_CN/futures/usdt"');
  });

  test("renders non-public trade readiness slots for all failure kinds", () => {
    const failureKinds: TradingReadinessFailureKind[] = [
      "analysis_data_degraded",
      "instrument_unavailable",
      "auth_account_not_ready",
      "user_risk_confirmation_required",
      "submission_mode_blocked",
      "exchange_network_or_result_failed",
    ];

    for (const kind of failureKinds) {
      const html = renderToStaticMarkup(
        <MarketAnalysisPanel
          topics={[
            {
              ...topicFixture({
                id: `topic-${kind}`,
                candidateType: "symbol",
                candidateKey: "BILL",
                title: "BILL 实时行情分析",
                symbol: "BILL",
                score: 1,
                lastUpdatedAt: 1,
                executable: false,
              }),
              execution: {
                executable: false,
                coinwPair: null,
                watchOnly: true,
                tradeReadiness: {
                  stateVersion: 1,
                  blocking: true,
                  states: [
                    {
                      kind,
                      severity: "blocked",
                      blocking: true,
                      retryable: false,
                      source: "order_submission",
                      code: `test_${kind}`,
                      i18nKey: `agentWatch.tradeReadiness.states.${kind}`,
                      observedAt: "2026-05-21T00:00:00.000Z",
                    },
                  ],
                },
              },
            },
          ]}
          dict={dict}
          onPlaceholder={() => undefined}
        />,
      );

      expect(html).toContain(`data-trade-readiness-kind="${kind}"`);
      expect(html).toContain('data-trade-readiness-slot="cta-disabled-reason"');
    }
  });

  test("keeps collapse state attached to record id after reorder while enforcing one expanded topic", () => {
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
    expect(reordered[topicDisplayIdentity(topicA)]).toBe(true);
    expect(Object.values(reordered).filter((collapsed) => collapsed === false)).toHaveLength(1);
  });

  test("expanding a topic collapses any previously expanded topic", () => {
    const topicA = {
      ...topicFixture({
        id: "single-a",
        candidateType: "symbol",
        candidateKey: "BTC",
        title: "BTC 决策流",
        symbol: "BTC",
        score: 1,
        lastUpdatedAt: 1,
        executable: true,
      }),
      defaultCollapsed: false,
    };
    const topicB = {
      ...topicFixture({
        id: "single-b",
        candidateType: "symbol",
        candidateKey: "ETH",
        title: "ETH 决策流",
        symbol: "ETH",
        score: 2,
        lastUpdatedAt: 2,
        executable: true,
      }),
      defaultCollapsed: true,
    };
    const initial = reconcileTopicCollapseState([topicA, topicB], {});
    const expandedB = toggleTopicCollapseState(
      initial,
      topicDisplayIdentity(topicB),
      topicB.defaultCollapsed,
    );

    expect(expandedB[topicDisplayIdentity(topicA)]).toBe(true);
    expect(expandedB[topicDisplayIdentity(topicB)]).toBe(false);
    expect(Object.values(expandedB).filter((collapsed) => collapsed === false)).toHaveLength(1);
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
