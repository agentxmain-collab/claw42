import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import zhCN from "@/i18n/dicts/zh_CN.json";
import type { Dict } from "@/i18n/types";
import { FlowPanel } from "../FlowPanel";
import { Hero } from "../Hero";
import { InlineAvatarSvg } from "../InlineAvatarSvg";
import { MarketAnalysisPanel } from "../MarketAnalysisPanel";
import { dispatchV10DemoTopics } from "../demoTopics";
import { heroAgents } from "../staticContent";

const dict = (zhCN as Dict).agentWatch.dispatchV10;
const css = readFileSync(new URL("../DispatchConsoleV10.module.css", import.meta.url), "utf8");
const globalCss = readFileSync(new URL("../../../../app/globals.css", import.meta.url), "utf8");

function countMatches(source: string, pattern: RegExp) {
  return (source.match(pattern) ?? []).length;
}

function selectorPattern(selector: string) {
  const escapedTokens = selector
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return escapedTokens.join("\\s+");
}

function cssBlock(selector: string) {
  const match = css.match(new RegExp(`${selectorPattern(selector)}\\s*\\{([\\s\\S]*?)\\}`));
  return match?.[1] ?? "";
}

function cssBlockContaining(selector: string, marker: string) {
  const pattern = new RegExp(`${selectorPattern(selector)}\\s*\\{([\\s\\S]*?)\\}`, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(css)) !== null) {
    const block = match[1] ?? "";
    if (block.includes(marker)) return block;
  }
  return "";
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
    expect(heroHtml).not.toContain('class="avatar-eye"');
    expect(countMatches(heroHtml, /class="avatar-eye avatar-eye-symbol"/g)).toBeGreaterThanOrEqual(
      11,
    );
    expect(countMatches(flowHtml, /data-inline-avatar="/g)).toBe(
      countMatches(flowHtml, /class="avatar-svg"/g),
    );
    expect(flowHtml).not.toContain("inline-avatar-eyes");
    expect(flowHtml).not.toContain('class="avatar-eye"');
    expect(countMatches(flowHtml, /class="avatar-eye avatar-eye-symbol"/g)).toBeGreaterThanOrEqual(
      11,
    );
    expect(countMatches(marketHtml, /class="market-panel-avatar-img"/g)).toBeGreaterThan(0);
    expect(marketHtml).toContain("workbench-core-robot");
    expect(marketHtml).toContain('class="eye right"');
  });

  test("keeps core bot ellipse eyes distinct from role-specific symbol eyes", () => {
    const coreHtml = renderToStaticMarkup(<InlineAvatarSvg className="avatar-svg" name="core" />);
    const roleHtml = renderToStaticMarkup(
      <InlineAvatarSvg className="avatar-svg" name="fundamental" />,
    );

    expect(coreHtml).not.toContain('class="avatar-eye"');
    expect(countMatches(coreHtml, /class="avatar-eye avatar-eye-ellipse"/g)).toBe(2);
    expect(roleHtml).not.toContain('class="avatar-eye"');
    expect(countMatches(roleHtml, /class="avatar-eye avatar-eye-symbol"/g)).toBe(2);
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

  test("matches the approved constellation tier sizing", () => {
    expect(css).toMatch(
      /\.anode\.tier-a\) \{[\s\S]*--size:\s*60px;[\s\S]*--bob:\s*8px;[\s\S]*--dur:\s*5s;/,
    );
    expect(css).toMatch(
      /\.anode\.tier-b\) \{[\s\S]*--size:\s*50px;[\s\S]*--bob:\s*5px;[\s\S]*--dur:\s*5\.6s;/,
    );
    expect(css).toMatch(
      /\.anode\.tier-c\) \{[\s\S]*--size:\s*45px;[\s\S]*--bob:\s*3px;[\s\S]*--dur:\s*6\.4s;[\s\S]*opacity:\s*0\.85;/,
    );
  });

  test("matches the approved constellation anode coordinates", () => {
    const positions = Object.fromEntries(heroAgents.map((agent) => [agent.id, agent.style]));

    expect(positions.news).toMatchObject({ left: "72%", top: "20%" });
    expect(positions.technical).toMatchObject({ left: "29%", top: "21%" });
    expect(positions.aggressive).toMatchObject({ left: "64%", top: "83%" });
    expect(positions.neutral).toMatchObject({ left: "9%", top: "29%" });
    expect(positions.fundamental).toMatchObject({ left: "73%", top: "40%" });
    expect(positions.onchain).toMatchObject({ left: "88%", top: "50%" });
    expect(positions.conservative).toMatchObject({ left: "21%", top: "71%" });
    expect(positions.portfolioManager).toMatchObject({ left: "50%", top: "28%" });
    expect(positions.bullish).toMatchObject({ left: "19%", top: "54%" });
    expect(positions.bearish).toMatchObject({ left: "71%", top: "66%" });
    expect(positions.trader).toMatchObject({ left: "43%", top: "77%" });
  });

  test("keeps Round 6 market list layout compact", () => {
    expect(css).toMatch(/\.fagent-avatar\) \{[\s\S]*align-self:\s*center;/);
    expect(css).not.toContain("max-width: 820px");
    expect(css).toMatch(/\.topic-head\) \{[\s\S]*padding:\s*12px 18px 10px;/);
    expect(css).toMatch(/\.topic-strategy\) \{[\s\S]*gap:\s*16px;[\s\S]*padding:\s*16px 20px;/);
    expect(css).not.toContain(".topic-eyebrow .topic-ranking-label");
  });

  test("keeps the hero copy below the fixed CoinW shell header", () => {
    expect(css).toContain("--coinw-shell-header-height: 72px");
    expect(css).toContain("--hero-header-breathing-room: 36px");
    expect(css).toMatch(
      /padding:\s*calc\(var\(--coinw-shell-header-height\) \+ var\(--hero-header-breathing-room\)\) 48px 60px;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 880px\)[\s\S]*padding:\s*calc\(var\(--coinw-shell-header-height\) \+ 28px\) 18px 48px;/,
    );
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

  test("keeps collapsed topic cards inside the natural shell gutters", () => {
    expect(css).not.toMatch(/topic\.collapsed:not\(\.expanded\)[\s\S]{0,120}max-width:\s*820px/);
    expect(css).not.toMatch(/topic\.collapsed:not\(\.expanded\)[\s\S]{0,120}margin-inline:\s*auto/);
    expect(css).not.toMatch(
      /topic\.collapsed:not\(\.expanded\)\) \{[\s\S]*width:\s*calc\(100% \+ 44px\);[\s\S]*margin-inline:\s*-22px;/,
    );
    expect(css).toMatch(/topic-head[\s\S]{0,160}padding:\s*12px 18px 10px/);
    expect(css).toMatch(/topic-news-summary[\s\S]{0,220}line-height:\s*1\.4/);
  });

  test("keeps topic card v3 on CoinW colors with compact bounded reasoning boxes", () => {
    const v3Css = css.slice(
      css.indexOf(".dispatchConsoleV10 :global(.topic-strategy.topic-card-v3)"),
    );

    expect(v3Css).toContain("#5227ff");
    expect(v3Css).toContain("rgb(82 39 255");
    expect(v3Css).not.toContain("#7c5cff");
    expect(v3Css).not.toContain("-webkit-line-clamp");
    expect(v3Css).not.toContain("text-overflow");
    expect(css).not.toContain("calc(100% + 44px)");
    expect(css).not.toContain("margin-inline: -22px");
    expect(css).not.toContain("topic-feedback");
    expect(v3Css).toMatch(
      /topic-strategy\.topic-card-v3\) \{[\s\S]*display:\s*block;[\s\S]*width:\s*100%;[\s\S]*margin:\s*0;/,
    );
    expect(v3Css).toMatch(/topic-card-v3 \.v3-topic\) \{[\s\S]*width:\s*100%;/);
    expect(v3Css).toMatch(
      /topic-card-v3 \.v3-news-hero\) \{[\s\S]*grid-template-columns:\s*auto minmax\(0, 1fr\) auto;/,
    );
    expect(v3Css).toMatch(
      /topic-card-v3 \.v3-body\) \{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(280px, 320px\);/,
    );
    expect(css).toMatch(
      /\.topic-card-v3 \.v3-reasoning\)[\s\S]*height:\s*64px;[\s\S]*overflow-y:\s*auto;[\s\S]*padding:\s*7px 12px;/,
    );
    expect(css).toMatch(
      /\.topic-card-v3 \.v3-secondary\)[\s\S]*min-height:\s*72px;[\s\S]*overflow-y:\s*auto;[\s\S]*padding:\s*10px 14px;/,
    );
  });

  test("pins the expanded realtime summary footer without clipping the scroll content", () => {
    const expandedTopic = cssBlock(".dispatchConsoleV10 :global(.topic.expanded)");
    const chatShell = cssBlock(".dispatchConsoleV10 :global(.chat-shell)");
    const shellBody = cssBlock(".dispatchConsoleV10 :global(.chat-shell-body)");
    const stickyBody = cssBlock(
      ".dispatchConsoleV10 :global(.chat-shell-body.has-scoped-sticky-summary)",
    );
    const scrollContent = cssBlock(
      ".dispatchConsoleV10 :global(.topic.expanded .topic-card-v3 .topic-scroll-content)",
    );
    const activeSummary = cssBlock(".dispatchConsoleV10 :global(.chat-shell-active-summary)");
    const stickyFooter = cssBlock(
      ".dispatchConsoleV10 :global(.chat-shell-active-summary .topic-realtime-sticky)",
    );

    expect(css).not.toContain(".chat-shell-body > .chat-shell-sticky-summary");
    expect(chatShell).toContain("position: relative");
    expect(chatShell).toContain("overflow: hidden");
    expect(shellBody).toContain("height: calc(100vh - 280px)");
    expect(shellBody).toContain("max-height: calc(100vh - 160px)");
    expect(shellBody).toContain("overflow-y: auto");
    expect(expandedTopic).toContain("overflow: visible");
    expect(activeSummary).toContain("position: absolute");
    expect(activeSummary).toContain("bottom:");
    expect(activeSummary).toContain("left: 22px");
    expect(activeSummary).toContain("right: 22px");
    expect(stickyBody).toContain("scroll-padding-bottom");
    expect(scrollContent).toContain("padding-bottom");
    expect(scrollContent).toContain("scroll-padding-bottom");
    expect(activeSummary).toContain("z-index");
    expect(activeSummary).toContain("env(safe-area-inset-bottom)");
    expect(stickyFooter).toContain("background:");
    expect(stickyFooter).toContain("var(--lime)");
  });

  test("uses the brand-green CTA treatment for source and expand links", () => {
    const originalLink = cssBlock(".dispatchConsoleV10 :global(.topic-card-v3 .v3-news-orig)");
    const secondary = cssBlockContaining(
      ".dispatchConsoleV10 :global(.topic-card-v3 .v3-secondary)",
      "display: flex",
    );
    const secondaryHover = cssBlock(
      ".dispatchConsoleV10 :global(.topic-card-v3 .v3-secondary:hover)",
    );
    const secondaryHead = cssBlock(".dispatchConsoleV10 :global(.topic-card-v3 .v3-sec-head)");
    const secondaryTitle = cssBlock(".dispatchConsoleV10 :global(.topic-card-v3 .v3-sec-title)");
    const secondaryFoot = cssBlock(".dispatchConsoleV10 :global(.topic-card-v3 .v3-sec-foot)");
    const secondaryCta = cssBlock(".dispatchConsoleV10 :global(.topic-card-v3 .v3-sec-cta)");

    expect(originalLink).toContain("color: var(--lime)");
    expect(originalLink).toContain("font-size: 14px");
    expect(originalLink).toContain("font-weight: 800");
    expect(originalLink).toContain("min-height: 32px");
    expect(originalLink).not.toContain("#5227ff");
    expect(secondary).toContain("min-height: 72px");
    expect(secondary).toContain("padding: 10px 14px");
    expect(secondary).toContain("rgb(209 255 85");
    expect(secondary).not.toContain("#5227ff");
    expect(secondaryHover).toContain("rgb(209 255 85");
    expect(secondaryHead).toContain("color: var(--lime)");
    expect(secondaryTitle).toContain("font-size: 14px");
    expect(secondaryTitle).toContain("font-weight: 800");
    expect(secondaryFoot).toContain("rgb(209 255 85");
    expect(secondaryCta).toContain("color: var(--lime)");
    expect(secondaryCta).toContain("font-size: 13px");
    expect(secondaryCta).toContain("font-weight: 800");
  });
});
