import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import zhCN from "@/i18n/dicts/zh_CN.json";
import type { Dict } from "@/i18n/types";
import { Hero } from "../Hero";

const dict = (zhCN as Dict).agentWatch.dispatchV10;

describe("Hero v10", () => {
  test("renders hero headline, tabs, and 11 visible agents", () => {
    const html = renderToStaticMarkup(
      <Hero dict={dict} activeView="flow" onViewChange={() => undefined} />,
    );

    expect(html).toContain("11 个角色");
    expect(html).toContain("6 个阶段");
    expect(html).toContain("协同产出");
    expect(html).toContain("流程介绍");
    expect(html).toContain("行情分析");
    expect((html.match(/class="anode /g) ?? []).length).toBe(11);
    expect((html.match(/class="anode-avatar"/g) ?? []).length).toBe(11);
    expect(html).not.toContain('class="screen"');
    expect(html).not.toContain('class="e"');
    expect(html).toContain('class="ear-l"');
    expect(html).toContain('class="face"');
    expect(html).toContain('class="eye right"');
    expect(html).not.toContain("core-indicator");
    expect(html).not.toContain("core-avatar");
    expect(html).not.toContain("tip-card");
    expect(html).not.toContain(">ID<");
    expect(html).not.toContain(">角色<");
    expect(html).not.toContain(">状态<");
    expect(html).toContain('data-inline-avatar="portfolioManager"');
    expect(html).toContain("首席投资官");
  });

  test("keeps the hero constellation stable between flow and market tabs", () => {
    const flowHtml = renderToStaticMarkup(
      <Hero dict={dict} activeView="flow" onViewChange={() => undefined} />,
    );
    const marketHtml = renderToStaticMarkup(
      <Hero dict={dict} activeView="mkt" onViewChange={() => undefined} />,
    );

    const flowConstellation = flowHtml.match(/<div class="hero-right"[\s\S]+<\/section>/)?.[0];
    const marketConstellation = marketHtml.match(/<div class="hero-right"[\s\S]+<\/section>/)?.[0];
    expect(marketConstellation).toBe(flowConstellation);
  });
});
