import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CoinwGlobalFooter } from "./CoinwGlobalFooter";
import { CoinwGlobalHeader } from "./CoinwGlobalHeader";

describe("CoinW global shell", () => {
  test("renders the CoinW-style header links without internal routing", () => {
    const html = renderToStaticMarkup(<CoinwGlobalHeader />);

    expect(html).toContain("CoinW");
    expect(html).toContain("U本位合约");
    expect(html).toContain("跟单");
    expect(html).toContain("https://www.coinw.com/zh_CN/futures/usdt/btcusdt");
    expect(html).toContain('target="_blank"');
  });

  test("renders the CoinW-style footer and copyright block", () => {
    const html = renderToStaticMarkup(<CoinwGlobalFooter />);

    expect(html).toContain("CopyRight © 2017 - 2023 CoinW.com. All Rights Reserved.");
    expect(html).toContain("永续合约");
    expect(html).toContain("官方验证通道");
    expect(html).toContain("English");
  });
});
