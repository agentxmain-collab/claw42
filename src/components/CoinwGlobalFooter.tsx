import React from "react";
import tokens from "../../design-tokens/coinw-shell.json";

const COINW_BASE = "https://www.coinw.com/zh_CN";

const footerColumns = [
  {
    title: "学习",
    links: [
      ["学院", `${COINW_BASE}/academy`],
      ["帮助中心", `${COINW_BASE}/support`],
      ["比特币价格", `${COINW_BASE}/price/btc`],
      ["加密货币今日价格", `${COINW_BASE}/markets`],
    ],
  },
  {
    title: "服务",
    links: [
      ["免费上币申请", `${COINW_BASE}/listing`],
      ["上币条款", `${COINW_BASE}/listing-terms`],
      ["成为商家", `${COINW_BASE}/merchant`],
      ["VIP权益", `${COINW_BASE}/vip`],
      ["API支持", `${COINW_BASE}/api`],
      ["邀请好友", `${COINW_BASE}/referral`],
      ["资金计划", `${COINW_BASE}/fund`],
      ["加盟商计划", `${COINW_BASE}/affiliate`],
      ["建议与反馈", `${COINW_BASE}/feedback`],
    ],
  },
  {
    title: "产品",
    links: [
      ["买币", `${COINW_BASE}/crypto-buy`],
      ["币币交易", `${COINW_BASE}/spot`],
      ["ETF交易", `${COINW_BASE}/etf`],
      ["永续合约", `${COINW_BASE}/futures`],
      ["跟单交易", `${COINW_BASE}/copy-trading`],
      ["赚币", `${COINW_BASE}/earn`],
      ["APP下载", `${COINW_BASE}/download`],
      ["大宗交易", `${COINW_BASE}/block-trade`],
      ["Launchpad", `${COINW_BASE}/launchpad`],
      ["PropW", `${COINW_BASE}/propw`],
      ["CoinW Card", `${COINW_BASE}/card`],
    ],
  },
  {
    title: "我们",
    links: [
      ["关于我们", `${COINW_BASE}/about`],
      ["官方验证通道", `${COINW_BASE}/verification`],
      ["费率说明", `${COINW_BASE}/fees`],
      ["法律声明", `${COINW_BASE}/legal`],
      ["风险告知书", `${COINW_BASE}/risk`],
      ["隐私保护", `${COINW_BASE}/privacy`],
      ["安全能力", `${COINW_BASE}/security`],
      ["用户协议", `${COINW_BASE}/terms`],
      ["储备金证明", `${COINW_BASE}/proof-of-reserves`],
    ],
  },
] as const;

const storeItems = [
  ["App Store", `${COINW_BASE}/download`],
  ["Google Play", `${COINW_BASE}/download`],
] as const;

const socialItems = [
  ["X", "https://x.com/CoinWOfficial"],
  ["TG", "https://t.me/CoinWExchange"],
  ["FB", "https://www.facebook.com/CoinWExchange"],
  ["DC", "https://discord.com"],
  ["IG", "https://www.instagram.com/coinw_exchange"],
  ["•••", COINW_BASE],
] as const;

function externalLinkProps(label: string) {
  return {
    "aria-label": label,
    target: "_blank",
    rel: "noopener noreferrer",
  };
}

type TokenSection = (typeof tokens.footer.sections)[number];
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

function footerToken(key: TokenSection["key"]) {
  const section = tokens.footer.sections.find((item) => item.key === key);
  if (!section) throw new Error(`Missing CoinW footer token: ${key}`);
  return section;
}

function headerToken(key: (typeof tokens.header.sections)[number]["key"]) {
  const section = tokens.header.sections.find((item) => item.key === key);
  if (!section) throw new Error(`Missing CoinW header token: ${key}`);
  return section;
}

function styleFromToken(
  section: TokenSection | (typeof tokens.header.sections)[number],
  keys: TokenStyleKey[],
) {
  return keys.reduce<React.CSSProperties>((style, key) => {
    const value = section.tokens[key];
    if (value && value !== "normal") return { ...style, [key]: value };
    return style;
  }, {});
}

export function CoinwGlobalFooter() {
  const wrapper = footerToken("wrapper");
  const wrapperFontFamily = tokens.footer.sections[0].tokens.fontFamily;
  const shell = footerToken("shell");
  const columns = footerToken("columns");
  const columnTitle = footerToken("columnTitle");
  const footerLink = footerToken("link");
  const bottomBar = footerToken("bottomBar");
  const copyright = footerToken("copyright");
  const languageButton = footerToken("languageButton");
  const logo = headerToken("logoLink");
  const registerButton = headerToken("registerButton");

  return (
    <footer
      data-coinw-shell="footer"
      className="border-t"
      style={{
        ...styleFromToken(wrapper, [
          "fontFamily",
          "fontSize",
          "fontWeight",
          "lineHeight",
          "letterSpacing",
          "color",
          "backgroundColor",
          "borderColor",
        ]),
        fontFamily: wrapperFontFamily,
      }}
    >
      <div className="w-full" style={styleFromToken(shell, ["margin", "padding"])}>
        <div
          data-coinw-shell="footer-columns"
          className="grid lg:grid-cols-[1.2fr_repeat(4,1fr)]"
          style={styleFromToken(columns, ["gap"])}
        >
          <div className="flex flex-col" style={styleFromToken(columns, ["gap"])}>
            <a
              data-coinw-shell="footer-logo"
              href={COINW_BASE}
              className="block"
              style={styleFromToken(logo, ["width", "height"])}
              {...externalLinkProps("CoinW")}
              dangerouslySetInnerHTML={{ __html: tokens.assets.logoSvg }}
            />
            <div className="flex flex-col" style={styleFromToken(columns, ["gap"])}>
              {storeItems.map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  className="w-fit rounded-xl transition-opacity hover:opacity-75"
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
                  {...externalLinkProps(label)}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <h2
                data-coinw-shell="footer-title"
                style={styleFromToken(columnTitle, [
                  "fontFamily",
                  "fontSize",
                  "fontWeight",
                  "lineHeight",
                  "letterSpacing",
                  "color",
                  "margin",
                ])}
              >
                {column.title}
              </h2>
              <ul className="flex flex-col" style={styleFromToken(columns, ["gap"])}>
                {column.links.map(([label, href]) => (
                  <li key={label}>
                    <a
                      data-coinw-shell="footer-link"
                      href={href}
                      className="transition-opacity hover:opacity-75"
                      style={styleFromToken(footerLink, [
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
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          data-coinw-shell="footer-bottom"
          className="flex flex-col border-t md:flex-row md:items-center md:justify-between"
          style={styleFromToken(bottomBar, ["padding", "margin", "gap", "borderColor"])}
        >
          <p
            style={styleFromToken(copyright, [
              "fontFamily",
              "fontSize",
              "fontWeight",
              "lineHeight",
              "letterSpacing",
              "color",
            ])}
          >
            © 2013-2026 coinw.com ALL Rights Reserved
          </p>
          <div className="flex flex-wrap items-center" style={styleFromToken(bottomBar, ["gap"])}>
            {socialItems.map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="grid place-items-center rounded-full transition-opacity hover:opacity-75"
                style={{
                  ...styleFromToken(languageButton, [
                    "fontFamily",
                    "fontSize",
                    "fontWeight",
                    "lineHeight",
                    "letterSpacing",
                    "color",
                    "backgroundColor",
                    "borderColor",
                    "borderRadius",
                  ]),
                  width: languageButton.tokens.height,
                  height: languageButton.tokens.height,
                }}
                {...externalLinkProps(label)}
              >
                {label}
              </a>
            ))}
            <a
              href={COINW_BASE}
              data-coinw-shell="footer-language"
              className="rounded-xl transition-opacity hover:opacity-75"
              style={styleFromToken(languageButton, [
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
              {...externalLinkProps("简体中文")}
            >
              简体中文
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
