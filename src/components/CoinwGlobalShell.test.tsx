import React from "react";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CoinwGlobalFooter } from "./CoinwGlobalFooter";
import { CoinwGlobalHeader } from "./CoinwGlobalHeader";

describe("CoinW global shell", () => {
  const root = process.cwd();

  test("renders the CoinW-style header truth without internal routing", () => {
    const html = renderToStaticMarkup(<CoinwGlobalHeader />);

    expect(html).toContain("CoinW");
    expect(html).toContain("/images/coinw/logo-white.png");
    expect(html).toContain('data-coinw-shell="header"');
    expect(html).toContain("Buy crypto");
    expect(html).toContain("Trade");
    expect(html).toContain("Markets");
    expect(html).toContain("Copy trading");
    expect(html).toContain("Bots");
    expect(html).toContain("Finance");
    expect(html).toContain("Lucky HODL");
    expect(html).toContain("More");
    expect(html).toContain("Wallet");
    expect(html).toContain("/images/coinw/cta-deposit.png");
    expect(html).toContain("/images/coinw/header-avatar.png");
    expect(html).toContain("https://www.coinw.com/en_US/futures/usdt/btcusdt");
    expect(html).toContain("h-16");
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain("var(--font-language)");
  });

  test("renders the CoinW-style footer truth and image slots", () => {
    const html = renderToStaticMarkup(<CoinwGlobalFooter />);

    expect(html).toContain("CopyRight © 2017 - 2023 CoinW.com. All Rights Reserved.");
    expect(html).toContain("/images/coinw/logo-white.png");
    expect(html).toContain('data-coinw-shell="footer"');
    expect(html).toContain("Company");
    expect(html).toContain("Products");
    expect(html).toContain("Services");
    expect(html).toContain("Learn");
    expect(html).toContain("Copy-trading");
    expect(html).toContain("Disclaimer:");
    expect(html).toContain("/images/coinw/badge-appstore.png");
    expect(html).toContain("/images/coinw/social-tiktok.png");
    expect(html).toContain("/images/coinw/lang-english.png");
    expect(html).not.toContain("© 2013-2026");
  });

  test("keeps Dan-provided CoinW shell image assets present as real PNG files", () => {
    const assets = [
      "logo-white.png",
      "badge-appstore.png",
      "badge-googleplay.png",
      "social-facebook.png",
      "social-x.png",
      "social-instagram.png",
      "social-youtube.png",
      "social-google.png",
      "social-linkedin.png",
      "social-tiktok.png",
      "lang-english.png",
      "cta-deposit.png",
      "header-avatar.png",
      "header-bell.png",
      "header-globe.png",
      "header-moon.png",
    ];

    for (const asset of assets) {
      const path = join(root, "public/images/coinw", asset);
      expect(existsSync(path)).toBe(true);
      expect(readFileSync(path).subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    }
  });
});
