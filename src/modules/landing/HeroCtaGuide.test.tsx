import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { HeroCtaGuide } from "./HeroCtaGuide";

describe("HeroCtaGuide", () => {
  test("points the first-visit guide to the live agent workspace", () => {
    const html = renderToStaticMarkup(<HeroCtaGuide locale="zh_CN" />);

    expect(html).toContain("点击查看实时分析");
    expect(html).toContain("/zh_CN/agent");
    expect(html).toContain("bg-black/28");
  });
});
