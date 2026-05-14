import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { SiteHeader } from "./SiteHeader";

vi.mock("next/navigation", () => ({
  usePathname: () => "/zh_CN/agent",
}));

vi.mock("next/image", () => ({
  default({ alt, src, className }: { alt?: string; src: string; className?: string }) {
    return React.createElement("img", { alt: alt ?? "", src, className });
  },
}));

vi.mock("./LocaleDropdown", () => ({
  LocaleDropdown() {
    return React.createElement("button", { type: "button" }, "简体中文");
  },
}));

vi.mock("@/i18n/I18nProvider", () => ({
  useI18n: () => ({
    locale: "zh_CN",
    t: {
      nav: {
        agentLiveMenuItem: "实时分析",
      },
    },
  }),
}));

describe("SiteHeader", () => {
  test("renders the shared homepage header on the agent route", () => {
    const html = renderToStaticMarkup(<SiteHeader />);

    expect(html).toContain('href="/zh_CN"');
    expect(html).toContain('href="/zh_CN/agent"');
    expect(html).toContain("实时分析");
    expect(html).toContain("简体中文");
    expect(html).toContain("claw42-horizontal.png");
  });

  test("marks the realtime analysis nav item as current on the agent route", () => {
    const html = renderToStaticMarkup(<SiteHeader />);

    expect(html).toContain('aria-current="page"');
    expect(html).toContain("bg-white/[0.08]");
  });
});
