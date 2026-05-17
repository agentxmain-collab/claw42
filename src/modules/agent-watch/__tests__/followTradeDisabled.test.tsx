import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import zhCN from "@/i18n/dicts/zh_CN.json";
import type { Dict } from "@/i18n/types";
import { DispatchConsoleV9 } from "../v9/DispatchConsoleV9";
import { TopicStrategy } from "../v9/TopicStrategy";
import { MarketAnalysisPanel } from "../v10/MarketAnalysisPanel";
import { dispatchV10DemoTopics } from "../v10/demoTopics";

const dispatchV10Dict = (zhCN as Dict).agentWatch.dispatchV10;

describe("follow trade disabled safety state", () => {
  test("renders disabled safety copy in the v9 market console", () => {
    const html = renderToStaticMarkup(
      <DispatchConsoleV9 initialView="mkt" followTradeDict={dispatchV10Dict.followTrade} />,
    );

    expect(html).toContain("演示模式");
    expect(html).toContain("不真实下单 · 后续接入授权和风险确认");
    expect(html).toContain('title="演示模式：当前不会真实下单"');
    expect(html).toContain('disabled=""');
  });

  test("renders disabled safety copy in the v10 market panel", () => {
    const executableSymbolTopics = dispatchV10DemoTopics.map((topic) => ({
      ...topic,
      candidateType: "symbol" as const,
      candidateKey: topic.symbol,
      execution: {
        executable: true,
        coinwPair: `${topic.symbol}USDT`,
        watchOnly: false,
      },
    }));
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={executableSymbolTopics}
        dict={dispatchV10Dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).toContain("演示模式");
    expect(html).toContain("不真实下单 · 后续接入授权和风险确认");
    expect(html).toContain('title="演示模式：当前不会真实下单"');
    expect(html).toContain('disabled=""');
  });

  test("does not render follow-trade affordance for watch-only topics", () => {
    const watchOnlyTopic = {
      ...dispatchV10DemoTopics[0]!,
      candidateType: "symbol",
      candidateKey: "BILL",
      symbol: "BILL",
      execution: {
        executable: false,
        coinwPair: null,
        watchOnly: true,
        watchOnlyReason: "not_listed_on_coinw",
      },
    } as const;

    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[watchOnlyTopic]}
        dict={dispatchV10Dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).toContain("watch-only / 不可跟单");
    expect(html).toContain("该币种暂不支持 CoinW 跟单");
    expect(html).not.toContain("演示模式：当前不会真实下单");
    expect(html).not.toContain('disabled=""');
  });

  test("does not render follow-trade affordance for non-symbol topics even if executable is true", () => {
    const residentTopic = {
      ...dispatchV10DemoTopics[0]!,
      candidateType: "market_overview",
      candidateKey: "market_overview:zh_CN:2026-05-17",
      symbol: "MARKET",
      execution: {
        executable: true,
        coinwPair: "BTC_USDT",
        watchOnly: false,
      },
    } as const;

    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[residentTopic]}
        dict={dispatchV10Dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).toContain("watch-only / 不可跟单");
    expect(html).toContain("该卡片仅用于观察分析，不提供跟单操作");
    expect(html).not.toContain("演示模式：当前不会真实下单");
    expect(html).not.toContain('disabled=""');
  });

  test("keeps v9 topic strategy non-symbol topics non-followable", () => {
    const residentTopic = {
      ...dispatchV10DemoTopics[0]!,
      candidateType: "hotspot",
      candidateKey: "hotspot:macro",
      symbol: "HOTSPOT",
      execution: {
        executable: true,
        coinwPair: "BTC_USDT",
        watchOnly: false,
      },
    } as const;

    const html = renderToStaticMarkup(
      <TopicStrategy
        topic={residentTopic}
        followTradeDict={dispatchV10Dict.followTrade}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).toContain("watch-only / 不可跟单");
    expect(html).not.toContain("演示模式：当前不会真实下单");
    expect(html).not.toContain('disabled=""');
  });
});
