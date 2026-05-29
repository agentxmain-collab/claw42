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
    expect(html).toContain("/images/coinw/coinw-logo-wordmark.svg");
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
    expect(html).toContain("Deposit");
    expect(html).toContain("/images/coinw/header-account.svg");
    expect(html).toContain("https://www.coinw.com/en_US/futures/usdt/btcusdt");
    expect(html).toContain("h-[72px]");
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain("var(--font-language)");
  });

  test("renders the CoinW-style footer truth and image slots", () => {
    const html = renderToStaticMarkup(<CoinwGlobalFooter />);

    expect(html).toContain("CopyRight © 2013 - 2026 CoinW.com. All Rights Reserved.");
    expect(html).toContain("/images/coinw/coinw-logo-wordmark.svg");
    expect(html).toContain('data-coinw-shell="footer"');
    expect(html).toContain("Company");
    expect(html).toContain("Products");
    expect(html).toContain("Services");
    expect(html).toContain("Learn");
    expect(html).toContain("Copy-trading");
    expect(html).toContain("Disclaimer:");
    expect(html).toContain("Download app");
    expect(html).toContain('data-coinw-shell="footer-download-appstore"');
    expect(html).toContain('data-coinw-shell="footer-download-googleplay"');
    expect(html).toContain("/images/coinw/btn-appstore.svg");
    expect(html).toContain("/images/coinw/btn-googleplay.svg");
    expect(html.indexOf("footer-download-appstore")).toBeLessThan(
      html.indexOf("footer-download-googleplay"),
    );
    expect(html).not.toContain(">Download</a>");
    expect(html).toContain("/images/coinw/social-tiktok.svg");
    expect(html).toContain("/images/coinw/lang-english.svg");
    expect(html).not.toContain("CopyRight © 2017 - 2023");
  });

  test("keeps Figma-derived CoinW shell vector assets present as real SVG files", () => {
    const assets = [
      "coinw-logo-wordmark.svg",
      "social-facebook.svg",
      "social-x.svg",
      "social-instagram.svg",
      "social-youtube.svg",
      "social-google.svg",
      "social-linkedin.svg",
      "social-tiktok.svg",
      "lang-english.svg",
      "btn-appstore.svg",
      "btn-googleplay.svg",
      "header-account.svg",
      "header-bell.svg",
      "header-globe.svg",
      "header-moon.svg",
    ];

    for (const asset of assets) {
      const path = join(root, "public/images/coinw", asset);
      expect(existsSync(path)).toBe(true);
      const svg = readFileSync(path, "utf8");
      expect(svg.trimStart()).toMatch(/^<svg\b/);
      expect(svg).not.toContain("<image");
      expect(svg).not.toContain("data:image");
    }
  });
});
