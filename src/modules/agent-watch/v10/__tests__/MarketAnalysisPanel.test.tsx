import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import zhCN from "@/i18n/dicts/zh_CN.json";
import type { Dict } from "@/i18n/types";
import { MarketAnalysisPanel } from "../MarketAnalysisPanel";

const dict = (zhCN as Dict).agentWatch.dispatchV10;

describe("MarketAnalysisPanel v10", () => {
  test("renders three demo decision flows when real topics are empty", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel topics={[]} dict={dict} onPlaceholder={() => undefined} />,
    );

    expect(html).not.toContain("暂无决策更新");
    expect(html).toContain("BTC 决策流");
    expect(html).toContain("ETH 决策流");
    expect(html).toContain("SOL 决策流");
    expect(html).toContain("阶段 6 · 复盘沉淀");
  });

  test("renders latest strategy and normalized role titles for demo topics", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel dict={dict} onPlaceholder={() => undefined} />,
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

  test("renders compact team track record with sparse sample caution", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel
        dict={dict}
        teamTrackRecord={{
          generatedAt: "2026-05-15T12:00:00.000Z",
          winrates: [
            {
              memberId: "pm",
              totalDecisions: 1,
              wins: 1,
              winRate: 1,
              lastFiveWinRate: 1,
              netReturn7d: 3.2,
              recordSourceMix: {
                live: 1,
                paper: 0,
                legacy: 0,
                backtest: 0,
              },
              sampleSizeWarning: true,
            },
          ],
        }}
        onPlaceholder={() => undefined}
      />,
    );

    expect(html).toContain("团队战绩速览");
    expect(html).toContain("首周样本不足");
    expect(html).toContain("首席投资官");
  });
});
