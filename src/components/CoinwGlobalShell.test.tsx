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
    expect(html).toContain("https://www.coinw.com/zh_CN/futures");
    expect(html).toContain('target="_blank"');
  });

  test("renders the CoinW-style footer and copyright block", () => {
    const html = renderToStaticMarkup(<CoinwGlobalFooter />);

    expect(html).toContain("© 2013-2026 coinw.com ALL Rights Reserved");
    expect(html).toContain("永续合约");
    expect(html).toContain("官方验证通道");
    expect(html).toContain("简体中文");
  });
});
