import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HistoryWall } from "../HistoryWall";
import { IntensityHeatMap } from "../IntensityHeatMap";

const dict = {
  wall_title: "决策历史",
  outcome_label: "结果",
  expand: "查看决策历史",
  collapse: "收起",
  more: "加载更多",
  empty: "暂无历史决策",
  loading: "加载中",
  error: "决策历史加载失败",
  symbols_label: "决策历史币种",
  heatmap_label: "决策强度热力图",
  intensity: "强度",
  confidence: "置信度",
  entry: "入场",
  stop_loss: "止损",
  take_profit: "止盈",
  pending: "待复盘",
  hit_tp: "止盈达成",
  hit_sl: "止损触发",
  expired: "到期未触发",
  manual_close: "人工关闭",
};

describe("HistoryWall", () => {
  it("renders a lazy decision history drawer with outcome and intensity", () => {
    const html = renderToStaticMarkup(
      <HistoryWall
        open
        symbols={["BTC", "ETH"]}
        selectedSymbol="BTC"
        locale="zh_CN"
        dict={dict}
        items={[
          {
            recordId: "record-1",
            symbol: "BTC",
            createdAt: "2026-05-15T00:00:00.000Z",
            resolvedAt: "2026-05-15T01:00:00.000Z",
            outcome: "hit_tp",
            direction: "long",
            intensity: 82,
            confidence: 0.72,
            entry: "100",
            stopLoss: "94",
            takeProfit: "106 / 112",
          },
        ]}
        hasMore
        loading={false}
        onClose={() => undefined}
        onMore={() => undefined}
        onSelectSymbol={() => undefined}
      />,
    );

    expect(html).toContain("决策历史");
    expect(html).toContain("BTC");
    expect(html).toContain("止盈达成");
    expect(html).toContain("82");
    expect(html).toContain("加载更多");
    expect(html).toContain('aria-label="决策历史"');
  });

  it("renders intensity heat map bars without a chart dependency", () => {
    const html = renderToStaticMarkup(
      <IntensityHeatMap values={[10, 50, 90]} ariaLabel="决策强度热力图" />,
    );

    expect(html).toContain("<svg");
    expect(html.match(/<rect/g)?.length).toBe(3);
  });
});
