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
      <Hero
        dict={dict}
        activeView="flow"
        onViewChange={() => undefined}
        siteShellVariant="claw42"
      />,
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
      <Hero
        dict={dict}
        activeView="flow"
        onViewChange={() => undefined}
        siteShellVariant="claw42"
      />,
    );
    const marketHtml = renderToStaticMarkup(
      <Hero
        dict={dict}
        activeView="mkt"
        onViewChange={() => undefined}
        siteShellVariant="claw42"
      />,
    );

    const flowConstellation = flowHtml.match(/<div class="hero-right"[\s\S]+<\/section>/)?.[0];
    const marketConstellation = marketHtml.match(/<div class="hero-right"[\s\S]+<\/section>/)?.[0];
    expect(marketConstellation).toBe(flowConstellation);
  });

  test("renders the CoinW-only multi-agent hero map without changing the left hero copy", () => {
    const claw42Html = renderToStaticMarkup(
      <Hero
        dict={dict}
        activeView="flow"
        onViewChange={() => undefined}
        siteShellVariant="claw42"
      />,
    );
    const coinwHtml = renderToStaticMarkup(
      <Hero
        dict={dict}
        activeView="flow"
        onViewChange={() => undefined}
        siteShellVariant="coinw"
      />,
    );

    const claw42Left = claw42Html.match(
      /<div class="hero-left"[\s\S]*?<\/div><div class="hero-right"/,
    )?.[0];
    const coinwLeft = coinwHtml.match(
      /<div class="hero-left"[\s\S]*?<\/div><div class="hero-right"/,
    )?.[0];
    expect(coinwLeft).toBe(claw42Left);

    expect(claw42Html).toContain('class="constellation');
    expect(claw42Html).not.toContain('data-testid="coinw-agent-map"');

    expect(coinwHtml).toContain('data-testid="coinw-agent-map"');
    expect(coinwHtml).not.toContain('class="constellation');
    expect((coinwHtml.match(/data-testid="coinw-agent-stage"/g) ?? []).length).toBe(6);
    expect((coinwHtml.match(/data-testid="coinw-agent-face"/g) ?? []).length).toBe(11);
    expect(coinwHtml).toContain(">01<");
    expect(coinwHtml).toContain(">06<");
    expect(coinwHtml).toContain("情报收集");
    expect(coinwHtml).toContain("最终决策");
    expect(coinwHtml).toContain("输出交易结论");
  });
});
