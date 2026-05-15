import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { DispatchConsoleV9 } from "../DispatchConsoleV9";
import { dispatchTopics } from "../fixtureData";
import { resolveDispatchInitialView } from "../initialView";
import { isTopicToggleKey } from "../TopicHead";
import { resolveDispatchTabKey } from "../WatchTabs";

describe("DispatchConsoleV9", () => {
  test("renders the v9 tab shell with accessible tab semantics", () => {
    const html = renderToStaticMarkup(<DispatchConsoleV9 />);

    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-controls="dispatch-panel-flow"');
    expect(html).toContain('aria-controls="dispatch-panel-mkt"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("CLAW 42 · DISPATCH CONSOLE");
  });

  test("leaves global page navigation to the shared site header", () => {
    const html = renderToStaticMarkup(<DispatchConsoleV9 />);

    expect(html).not.toContain('class="topbar"');
    expect(html).not.toContain("DISPATCH · 调度台");
  });

  test("renders market topics with the v9 default collapse contract", () => {
    const html = renderToStaticMarkup(<DispatchConsoleV9 initialView="mkt" />);

    expect(html).toContain("实时交易决策流 · 自动更新");
    expect(html).not.toContain("TopicGenerator");
    expect(html).not.toContain("session #");
    expect(html).toContain("BTC live market check");
    expect(html).toContain("ETH live market check");
    expect(html).toContain("SOL live market check");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("topic active");
    expect(html).toContain("topic active latest");
    expect(html).toContain("topic-strategy latest");
    expect(html).toContain("最新策略");
    expect(html).toContain("topic done collapsed");
    expect(html).toContain("topic pending collapsed");
    expect(html).toContain("stage-marker done");
    expect(html).toContain("stage-marker active");
    expect(html).toContain("stage-marker pending");
    expect(html).toContain("分析中");
    expect(html).not.toContain("PENDING");
  });

  test("keeps follow trading disabled with explicit safety copy", () => {
    const html = renderToStaticMarkup(<DispatchConsoleV9 initialView="mkt" />);

    expect(html).toContain("演示模式");
    expect(html).toContain("不真实下单 · 后续接入授权和风险确认");
    expect(html).toContain('title="演示模式：当前不会真实下单"');
  });

  test("uses senior functional titles instead of persona names in the public console", () => {
    const html = renderToStaticMarkup(<DispatchConsoleV9 initialView="flow" />);

    expect(html).toContain("技术策略主管");
    expect(html).toContain("宏观情报分析师");
    expect(html).toContain("交易策略总监");
    expect(html).toContain("收益进攻官");
    expect(html).toContain("首席投资官");
    expect(html).not.toContain("技术分析师");
    expect(html).not.toContain("新闻分析师");
    expect(html).not.toContain("组合经理");
    expect(html).not.toContain("K 哥");
    expect(html).not.toContain("技术助理");
  });

  test("renders an empty real-topic state without falling back to fixtures", () => {
    const html = renderToStaticMarkup(<DispatchConsoleV9 initialView="mkt" topics={[]} />);

    expect(html).toContain("暂无决策更新");
    expect(html).not.toContain("暂无符合公开展示条件的真实 PM 决策");
    expect(html).not.toContain("BTC live market check");
  });

  test("omits the source link when a topic has no original url", () => {
    const [topic] = dispatchTopics;
    const html = renderToStaticMarkup(
      <DispatchConsoleV9
        initialView="mkt"
        topics={[
          {
            ...topic,
            originalUrl: undefined,
          },
        ]}
      />,
    );

    expect(html).not.toContain("原文 →");
    expect(html).not.toContain("topic-original");
  });

  test("labels the source link when a topic has an original source", () => {
    const [topic] = dispatchTopics;
    const html = renderToStaticMarkup(
      <DispatchConsoleV9
        initialView="mkt"
        topics={[
          {
            ...topic,
            originalUrl: "https://example.com/btc",
            sourceLabel: "CoinDesk",
          },
        ]}
      />,
    );

    expect(html).toContain("原文 · CoinDesk");
  });

  test("keeps keyboard helpers deterministic for tabs and topic toggles", () => {
    expect(resolveDispatchTabKey("flow", "ArrowRight")).toBe("mkt");
    expect(resolveDispatchTabKey("mkt", "ArrowRight")).toBe("flow");
    expect(resolveDispatchTabKey("mkt", "ArrowLeft")).toBe("flow");
    expect(resolveDispatchTabKey("flow", "Home")).toBe("flow");
    expect(isTopicToggleKey("Enter")).toBe(true);
    expect(isTopicToggleKey(" ")).toBe(true);
    expect(isTopicToggleKey("Escape")).toBe(false);
  });

  test("defaults the agent route to market analysis unless flow is requested", () => {
    expect(resolveDispatchInitialView()).toBe("mkt");
    expect(resolveDispatchInitialView("mkt")).toBe("mkt");
    expect(resolveDispatchInitialView("flow")).toBe("flow");
    expect(resolveDispatchInitialView(["flow", "mkt"])).toBe("flow");
    expect(resolveDispatchInitialView("unknown")).toBe("mkt");
  });
});
