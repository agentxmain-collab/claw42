import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { MessageBubble } from "../MessageBubble";
import type { DispatchMessage } from "../types";

const baseMessage: DispatchMessage = {
  id: "msg-1",
  stageId: "stage-1",
  agentId: "portfolio_manager",
  agentName: "组合平衡总监",
  time: "10:41",
  mentions: [],
  content: "完整正文保留在消息体内，用户可以展开查看全部分析，不再依赖被压短的一句话摘要。",
  direction: "neutral",
  directionLabel: "中性",
  confidence: 0.72,
  roleViewpoint: "防守审查视角",
};

describe("MessageBubble", () => {
  test("hides visibly truncated one-line summaries and keeps full body content", () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        message={{
          ...baseMessage,
          oneLineSummary: "核心失效模式是BTC 76.5K支撑位若被跌破，将触发高贝塔资产的补跌，若...",
        }}
      />,
    );

    expect(html).not.toContain("msg-summary");
    expect(html).not.toContain("若...");
    expect(html).toContain("完整正文保留在消息体内");
  });

  test("keeps complete one-line summaries visible", () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        message={{
          ...baseMessage,
          oneLineSummary: "BTC 回落但风险资产仍有轮动条件。",
        }}
      />,
    );

    expect(html).toContain("msg-summary");
    expect(html).toContain("BTC 回落但风险资产仍有轮动条件。");
  });
});
