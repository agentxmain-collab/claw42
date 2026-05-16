import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import zhCN from "@/i18n/dicts/zh_CN.json";
import type { Dict } from "@/i18n/types";
import { dispatchV10DemoTopics } from "../demoTopics";
import { MarketAnalysisPanel } from "../MarketAnalysisPanel";

const dict = (zhCN as Dict).agentWatch.dispatchV10;

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
});
