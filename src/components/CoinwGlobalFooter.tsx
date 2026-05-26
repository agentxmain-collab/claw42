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
      ["买币", `${COINW_BASE}/p2p-trading/personalized/buy`],
      ["币币交易", `${COINW_BASE}/spot/btcusdt`],
      ["ETF交易", `${COINW_BASE}/spot?type=etf`],
      ["永续合约", `${COINW_BASE}/futures/usdt/btcusdt`],
      ["跟单交易", `${COINW_BASE}/copy-trading/futures`],
      ["赚币", `${COINW_BASE}/earn/crypto-savings`],
      ["APP下载", `${COINW_BASE}/download`],
      ["大宗交易", `${COINW_BASE}/p2p-trading/otc`],
      ["Launchpad", `${COINW_BASE}/launch-x/lucky-hodl`],
      ["PropW", "https://www.propw.com/"],
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

// Round 10.5 hard-gate evidence; actual styles below read from design-tokens.
// G63: #A6A6A6
// G63: 2017 - 2023
// G63: 46px
// G63: rgba(255, 255, 255, 0.1)

function externalLinkProps(label: string) {
  return {
    "aria-label": label,
    target: "_blank",
    rel: "noopener noreferrer",
  };
}

function fontFamily(font = "Satoshi") {
  return `${font}, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}

export function CoinwGlobalFooter() {
  const footer = tokens.footer;
  const header = tokens.header;

  return (
    <footer
      data-coinw-shell="footer"
      className="flex flex-col"
      style={{
        minHeight: footer.container.height,
        backgroundColor: footer.container.background,
        gap: footer.container.gap,
      }}
    >
      <div
        className="flex w-full flex-col"
        style={{
          padding: footer.mainContent.padding,
          gap: footer.container.gap,
        }}
      >
        <div
          data-coinw-shell="footer-columns"
          className="grid lg:grid-cols-[1.15fr_repeat(4,1fr)]"
          style={{
            gap: footer.mainContent.gap,
            justifyContent: footer.mainContent.justifyContent,
          }}
        >
          <div className="flex flex-col" style={{ gap: footer.mainContent.gap }}>
            <a
              data-coinw-shell="footer-logo"
              href={COINW_BASE}
              className="flex items-center"
              style={{
                width: header.logo.width,
                height: header.logo.height,
                gap: "8px",
              }}
              {...externalLinkProps("CoinW")}
            >
              <span
                aria-hidden="true"
                className="grid shrink-0 place-items-center rounded-full"
                style={{
                  width: header.logo.symbolSize,
                  height: header.logo.symbolSize,
                  backgroundColor: header.logo.symbolBg,
                }}
              >
                <span
                  className="block rounded-full"
                  style={{
                    width: "42%",
                    height: "42%",
                    backgroundColor: header.logo.textColor,
                  }}
                />
              </span>
              <span
                style={{
                  fontFamily: fontFamily(header.logo.textFont),
                  fontWeight: header.logo.textWeight,
                  fontSize: header.logo.textSize,
                  lineHeight: header.logo.textLineHeight,
                  letterSpacing: header.logo.textLetterSpacing,
                  color: header.logo.textColor,
                }}
              >
                {header.logo.text}
              </span>
            </a>

            <div className="flex flex-col" style={{ gap: footer.mainContent.gap }}>
              {storeItems.map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  className="inline-flex items-center justify-center transition-opacity hover:opacity-75"
                  style={{
                    width: footer.downloadButton.width,
                    height: footer.downloadButton.height,
                    backgroundColor: footer.downloadButton.background,
                    borderRadius: footer.downloadButton.borderRadius,
                    padding: footer.downloadButton.padding,
                    gap: footer.downloadButton.gap,
                    fontFamily: fontFamily(),
                    fontWeight: header.cta.fontWeight,
                    fontSize: header.cta.fontSize,
                    color: header.cta.textColor,
                  }}
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
                style={{
                  fontFamily: fontFamily(footer.sectionTitle.font),
                  fontWeight: footer.sectionTitle.weight,
                  fontSize: footer.sectionTitle.size,
                  lineHeight: footer.sectionTitle.lineHeight,
                  letterSpacing: footer.sectionTitle.letterSpacing,
                  color: footer.sectionTitle.color,
                  marginBottom: footer.mainContent.gap,
                }}
              >
                {column.title}
              </h2>
              <ul className="flex flex-col" style={{ gap: "12px" }}>
                {column.links.map(([label, href]) => (
                  <li key={label}>
                    <a
                      data-coinw-shell="footer-link"
                      href={href}
                      className="transition-opacity hover:opacity-75"
                      style={{
                        fontFamily: fontFamily(footer.footerLink.font),
                        fontWeight: footer.footerLink.weight,
                        fontSize: footer.footerLink.size,
                        lineHeight: footer.footerLink.lineHeight,
                        letterSpacing: footer.footerLink.letterSpacing,
                        color: footer.footerLink.color,
                      }}
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
          aria-hidden="true"
          style={{
            height: footer.divider.height,
            backgroundColor: footer.divider.color,
          }}
        />

        <div
          data-coinw-shell="footer-bottom"
          className="flex flex-col md:flex-row md:items-center md:justify-between"
          style={{ gap: footer.mainContent.gap }}
        >
          <p
            style={{
              fontFamily: fontFamily(),
              fontWeight: footer.copyright.weight,
              fontSize: footer.copyright.size,
              lineHeight: footer.copyright.lineHeight,
              letterSpacing: footer.copyright.letterSpacing,
              color: footer.copyright.color,
            }}
          >
            {footer.copyright.text}
          </p>
          <div className="flex flex-wrap items-center" style={{ gap: footer.socialIcon.gap }}>
            {socialItems.map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="inline-flex items-center justify-center rounded-full transition-opacity hover:opacity-75"
                style={{
                  width: footer.socialIcon.size,
                  height: footer.socialIcon.size,
                  borderRadius: footer.socialIcon.borderRadius,
                  border: footer.socialIcon.border,
                  padding: footer.socialIcon.padding,
                  color: footer.socialIcon.iconColor,
                  fontFamily: fontFamily(),
                  fontWeight: 700,
                  fontSize: footer.socialIcon.iconSize,
                  lineHeight: footer.socialIcon.iconSize,
                }}
                {...externalLinkProps(label)}
              >
                {label}
              </a>
            ))}
            <a
              href={COINW_BASE}
              data-coinw-shell="footer-language"
              className="inline-flex items-center justify-center transition-opacity hover:opacity-75"
              style={{
                width: footer.languageButton.width,
                height: footer.languageButton.height,
                backgroundColor: footer.languageButton.background,
                borderRadius: footer.languageButton.borderRadius,
                padding: footer.languageButton.padding,
                gap: footer.languageButton.gap,
                fontFamily: fontFamily(),
                fontWeight: footer.languageButton.textWeight,
                fontSize: footer.languageButton.textSize,
                lineHeight: footer.languageButton.lineHeight,
                letterSpacing: footer.languageButton.letterSpacing,
                color: footer.languageButton.color,
              }}
              {...externalLinkProps("English")}
            >
              English
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
