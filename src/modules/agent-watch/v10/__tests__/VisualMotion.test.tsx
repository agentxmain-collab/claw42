import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import zhCN from "@/i18n/dicts/zh_CN.json";
import type { Dict } from "@/i18n/types";
import { FlowPanel } from "../FlowPanel";
import { Hero } from "../Hero";
import { MarketAnalysisPanel } from "../MarketAnalysisPanel";
import { dispatchV10DemoTopics } from "../demoTopics";

const dict = (zhCN as Dict).agentWatch.dispatchV10;
const css = readFileSync(new URL("../DispatchConsoleV10.module.css", import.meta.url), "utf8");
const globalCss = readFileSync(new URL("../../../../app/globals.css", import.meta.url), "utf8");

function countMatches(source: string, pattern: RegExp) {
  return (source.match(pattern) ?? []).length;
}

describe("DispatchConsoleV10 visual motion", () => {
  test("adds blink-capable eyes to every inline bot avatar surface", () => {
    const heroHtml = renderToStaticMarkup(
      <Hero dict={dict} activeView="flow" onViewChange={() => undefined} />,
    );
    const flowHtml = renderToStaticMarkup(<FlowPanel dict={dict} onGotoMarket={() => undefined} />);
    const marketHtml = renderToStaticMarkup(
      <MarketAnalysisPanel
        topics={[dispatchV10DemoTopics[0]!]}
        dict={dict}
        onPlaceholder={() => undefined}
      />,
    );

    expect(countMatches(heroHtml, /data-inline-avatar="/g)).toBe(11);
    expect(heroHtml).not.toContain("inline-avatar-eyes");
    expect(countMatches(heroHtml, /class="avatar-eye"/g)).toBeGreaterThanOrEqual(11);
    expect(countMatches(flowHtml, /data-inline-avatar="/g)).toBe(
      countMatches(flowHtml, /class="avatar-svg"/g),
    );
    expect(flowHtml).not.toContain("inline-avatar-eyes");
    expect(countMatches(flowHtml, /class="avatar-eye"/g)).toBeGreaterThanOrEqual(11);
    expect(countMatches(marketHtml, /class="market-panel-avatar-img"/g)).toBeGreaterThan(0);
    expect(marketHtml).toContain("workbench-core-robot");
    expect(marketHtml).toContain('class="eye right"');
  });

  test("defines shared bot blink timing and hover acceleration", () => {
    expect(globalCss).toContain("@keyframes eyeBlink");
    expect(css).not.toContain("@keyframes eyeBlink");
    expect(css).not.toContain("@keyframes dispatch-v10-eye-blink");
    expect(css).toContain("--bot-eye-blink-name: eyeBlink");
    expect(css).toMatch(/avatar-eye[\s\S]+animation-name:\s*var\(--bot-eye-blink-name\)/);
    expect(css).toMatch(/avatar-eye[\s\S]+animation-duration:\s*4\.6s/);
    expect(css).toMatch(/core-robot \.eye[\s\S]+animation-name:\s*var\(--bot-eye-blink-name\)/);
    expect(css).toMatch(/core-robot \.eye[\s\S]+animation-duration:\s*4\.6s/);
    expect(css).toMatch(/anode:hover[\s\S]+animation-duration:\s*1\.2s/);
    expect(css).toMatch(/fagent:hover[\s\S]+animation-duration:\s*1\.2s/);
    expect(css).toMatch(/workbench-core-robot:hover[\s\S]+animation-duration:\s*1\.2s/);
  });

  test("makes six flow stage cards visibly react on hover", () => {
    const hoverBlock = css.match(
      /\.dispatchConsoleV10 :global\(\.fstage4:hover\) \{([\s\S]*?)\}/,
    )?.[1];

    expect(hoverBlock).toBeDefined();
    expect(hoverBlock).toContain("rgb(209 255 85 / 54%)");
    expect(hoverBlock).toContain("rgb(124 92 255 / 42%)");
    expect(hoverBlock).toContain("translateY(-4px) scale(1.01)");
    expect(css).toMatch(/fstage4:hover \.stage-watermark[\s\S]+text-shadow/);
    expect(css).toMatch(/fstage4:hover \.fstage4-detail[\s\S]+border-color/);
    expect(css).toMatch(/fstage4\.debate:hover[\s\S]+box-shadow/);
    expect(css).toMatch(/fstage4\.memory:hover[\s\S]+box-shadow/);
  });
});
