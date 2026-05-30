import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { HeroRobotGuide } from "./HeroRobotGuide";
import { RobotLayer } from "./RobotLayer";

vi.mock("@/i18n/I18nProvider", () => ({
  useI18n: () => ({
    locale: "zh_CN",
    t: {
      hero: {
        robotGuide: "点击查看AI分析行情",
        speechBubble: ["AI 正在读取市场"],
        speechBubbleAriaLabel: "点击查看 AI 分析行情",
      },
    },
  }),
}));

vi.mock("@/modules/agent-watch/hooks/useAgentAnalysis", () => ({
  useAgentAnalysis: () => ({ data: null }),
}));

describe("Hero robot CTA guidance render behavior", () => {
  test("renders the one-load guidance as an integrated halo, pulse, ripple, and benefit chip", () => {
    const html = renderToStaticMarkup(
      <HeroRobotGuide label="点击查看AI分析行情" visible reduceMotion={false} side="right" />,
    );

    expect(html).toContain('data-hero-robot-guide="one-load"');
    expect(html).toContain('data-motion-mode="animated"');
    expect(html).toContain("claw42-hero-robot-guide-halo");
    expect(html).toContain("claw42-hero-robot-guide-ring");
    expect(html).toContain("claw42-hero-robot-guide-tap-ripple");
    expect(html).toContain("claw42-hero-robot-guide-chip");
    expect(html).toContain("点击查看AI分析行情");
    expect(html).not.toContain("fixed");
  });

  test("renders no guidance when the one-load guide has been dismissed", () => {
    const html = renderToStaticMarkup(
      <HeroRobotGuide
        label="点击查看AI分析行情"
        visible={false}
        reduceMotion={false}
        side="right"
      />,
    );

    expect(html).toBe("");
  });

  test("reduced motion renders the static benefit chip without animated pulse or ripple layers", () => {
    const html = renderToStaticMarkup(
      <HeroRobotGuide label="点击查看AI分析行情" visible reduceMotion side="right" />,
    );

    expect(html).toContain('data-motion-mode="static"');
    expect(html).toContain("claw42-hero-robot-guide-chip");
    expect(html).toContain("点击查看AI分析行情");
    expect(html).not.toContain("claw42-hero-robot-guide-tap-ripple");
    expect(html).not.toContain("claw42-hero-robot-guide-ring");
  });

  test("renders the robot as a large clickable target with hover affordance and mobile tap hint", () => {
    const html = renderToStaticMarkup(
      <RobotLayer
        robotRef={{ current: null }}
        pose="center"
        mouseX={0}
        mouseY={0}
        reduceMotion={false}
        onOpenWatch={() => undefined}
      />,
    );

    expect(html).toContain('data-robot-affordance="clickable-watch-entry"');
    expect(html).toContain("min-h-11");
    expect(html).toContain("min-w-11");
    expect(html).toContain("cursor-pointer");
    expect(html).toContain("claw42-hero-robot-hover-glow");
    expect(html).toContain("claw42-hero-robot-mobile-tap-ripple");
  });
});
