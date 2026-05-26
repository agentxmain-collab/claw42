import React from "react";
import tokens from "../../design-tokens/coinw-shell.json";

const COINW_BASE = "https://www.coinw.com/zh_CN";

const navItems = [
  ["买币", `${COINW_BASE}/p2p-trading/personalized/buy`],
  ["行情", `${COINW_BASE}/market/futures/all`],
  ["U本位合约", `${COINW_BASE}/futures/usdt/btcusdt`],
  ["交易", `${COINW_BASE}/spot/btcusdt`],
  ["跟单", `${COINW_BASE}/copy-trading/futures`, "New"],
  ["策略", `${COINW_BASE}/trading-bots/all`],
  ["赚币", `${COINW_BASE}/earn`],
  ["Launch X", `${COINW_BASE}/launchpad`],
  ["更多", COINW_BASE],
] as const;

const utilityItems = [
  ["下载", `${COINW_BASE}/download`],
  ["简体中文", COINW_BASE],
] as const;

type TokenSection = (typeof tokens.header.sections)[number];
type TokenStyleKey =
  | "display"
  | "fontFamily"
  | "fontSize"
  | "fontWeight"
  | "lineHeight"
  | "letterSpacing"
  | "color"
  | "backgroundColor"
  | "borderColor"
  | "borderRadius"
  | "padding"
  | "margin"
  | "gap"
  | "height"
  | "width";

function headerToken(key: TokenSection["key"]) {
  const section = tokens.header.sections.find((item) => item.key === key);
  if (!section) throw new Error(`Missing CoinW header token: ${key}`);
  return section;
}

function styleFromToken(section: TokenSection, keys: TokenStyleKey[]): React.CSSProperties {
  return keys.reduce<React.CSSProperties>((style, key) => {
    const value = section.tokens[key];
    if (value && value !== "normal") return { ...style, [key]: value };
    return style;
  }, {});
}

function externalLinkProps(label: string) {
  return {
    "aria-label": label,
    target: "_blank",
    rel: "noopener noreferrer",
  };
}

export function CoinwGlobalHeader() {
  const shell = headerToken("shell");
  const shellFontFamily = tokens.header.sections[0].tokens.fontFamily;
  const logo = headerToken("logoLink");
  const nav = headerToken("nav");
  const navItem = headerToken("navItem");
  const navLink = headerToken("navLink");
  const rightCluster = headerToken("rightCluster");
  const buttonGroup = headerToken("buttonGroup");
  const loginButton = headerToken("loginButton");
  const registerButton = headerToken("registerButton");

  return (
    <nav
      data-coinw-shell="header"
      className="fixed inset-x-0 top-0 z-[80] flex items-center justify-between border-b"
      style={{
        ...styleFromToken(shell, [
          "fontFamily",
          "fontSize",
          "fontWeight",
          "lineHeight",
          "letterSpacing",
          "color",
          "backgroundColor",
          "borderColor",
          "height",
          "padding",
        ]),
        fontFamily: shellFontFamily,
      }}
    >
      <div className="flex w-full items-center justify-between">
        <a
          data-coinw-shell="header-logo"
          href={COINW_BASE}
          className="block shrink-0"
          style={styleFromToken(logo, ["width", "height"])}
          {...externalLinkProps("CoinW")}
          dangerouslySetInnerHTML={{ __html: tokens.assets.logoSvg }}
        />

        <div
          data-coinw-shell="header-nav"
          className="hidden min-w-0 flex-1 items-center lg:flex"
          style={styleFromToken(nav, ["margin", "gap", "height"])}
        >
          {navItems.map(([label, href, badge]) => (
            <a
              data-coinw-shell="header-nav-link"
              key={label}
              href={href}
              className="inline-flex items-center whitespace-nowrap transition-opacity hover:opacity-75"
              style={{
                ...styleFromToken(navItem, ["height", "padding", "gap"]),
                ...styleFromToken(navLink, [
                  "fontFamily",
                  "fontSize",
                  "fontWeight",
                  "lineHeight",
                  "letterSpacing",
                  "color",
                ]),
              }}
              {...externalLinkProps(label)}
            >
              {label}
              {badge ? (
                <span
                  className="rounded-full uppercase"
                  style={{
                    ...styleFromToken(registerButton, [
                      "fontFamily",
                      "fontWeight",
                      "color",
                      "backgroundColor",
                      "borderRadius",
                    ]),
                    fontSize: navLink.tokens.fontSize,
                    lineHeight: navLink.tokens.lineHeight,
                    padding: navLink.tokens.gap,
                  }}
                >
                  {badge}
                </span>
              ) : null}
            </a>
          ))}
        </div>

        <div
          data-coinw-shell="header-right"
          className="flex shrink-0 items-center"
          style={styleFromToken(rightCluster, ["height", "gap"])}
        >
          <div className="hidden items-center md:flex" style={styleFromToken(buttonGroup, ["gap"])}>
            {utilityItems.map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="grid place-items-center rounded-full transition-opacity hover:opacity-75"
                style={styleFromToken(navLink, [
                  "fontFamily",
                  "fontSize",
                  "fontWeight",
                  "lineHeight",
                  "letterSpacing",
                  "color",
                ])}
                {...externalLinkProps(label)}
              >
                {label}
              </a>
            ))}
          </div>
          <a
            href={`${COINW_BASE}/login`}
            data-coinw-shell="header-login"
            className="rounded-full transition-opacity hover:opacity-75"
            style={styleFromToken(loginButton, [
              "fontFamily",
              "fontSize",
              "fontWeight",
              "lineHeight",
              "letterSpacing",
              "color",
              "backgroundColor",
              "borderColor",
              "borderRadius",
              "padding",
            ])}
            {...externalLinkProps("登录")}
          >
            登录
          </a>
          <a
            href={`${COINW_BASE}/register`}
            data-coinw-shell="header-register"
            className="rounded-full transition-opacity hover:opacity-75"
            style={styleFromToken(registerButton, [
              "fontFamily",
              "fontSize",
              "fontWeight",
              "lineHeight",
              "letterSpacing",
              "color",
              "backgroundColor",
              "borderColor",
              "borderRadius",
              "padding",
            ])}
            {...externalLinkProps("注册")}
          >
            注册
          </a>
        </div>
      </div>
    </nav>
  );
}
