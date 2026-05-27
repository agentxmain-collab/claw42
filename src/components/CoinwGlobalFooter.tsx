import React from "react";
import Image from "next/image";

const COINW_BASE = "https://www.coinw.com/zh_CN";
const COINW_ROOT = "https://www.coinw.com";
const COINW_LOGO_ICON = "/images/coinw/coinw-logo.svg";
const FOOTER_COPYRIGHT = "© 2013-2026 coinw.com ALL Rights Reserved";

const footerColumns = [
  {
    title: "学习",
    links: [
      ["学院", `${COINW_BASE}/academy`],
      ["帮助中心", `${COINW_BASE}/help-center/`],
      ["比特币价格", `${COINW_BASE}/price/btc`],
      ["加密货币今日价格", `${COINW_BASE}/price`],
    ],
  },
  {
    title: "服务",
    links: [
      ["免费上币申请", `${COINW_ROOT}/coin-apply`],
      [
        "上币条款",
        `${COINW_BASE}/help-center/faq/official-updates/2025-10-13/terms-and-conditions-of-token-listing/7032`,
      ],
      ["成为商家", `${COINW_ROOT}/p2p-trading/merchant-program`],
      [
        "VIP权益",
        `${COINW_BASE}/announcement/maintenance-updates/2025-07-03/coinw-launches-new-spot-trading-fee-stru/6178`,
      ],
      ["API支持", `${COINW_ROOT}/api-doc/common/introduction`],
      ["邀请好友", `${COINW_ROOT}/referral`],
      ["赏金计划", "https://hackenproof.com/coinw/coinw-web-and-mobile"],
      ["加盟商计划", `${COINW_BASE}/affiliate`],
      ["建议与反馈", `${COINW_ROOT}/submit-feedback`],
    ],
  },
  {
    title: "产品",
    links: [
      ["买币", `${COINW_ROOT}/p2p-trading/personalized/buy`],
      ["币币交易", `${COINW_ROOT}/spot`],
      ["ETF交易", `${COINW_ROOT}/spot?type=etf`],
      ["永续合约", `${COINW_ROOT}/futures/usdt`],
      ["跟单交易", `${COINW_ROOT}/followup`],
      ["赚币", `${COINW_ROOT}/earn/crypto-savings`],
      ["APP下载", `${COINW_ROOT}/install-app`],
      ["大宗交易", `${COINW_ROOT}/p2p-trading/otc`],
      ["Launchpad", `${COINW_ROOT}/earn/launchdiscount`],
      ["PropW", "https://www.propw.com/zh_CN"],
      ["CoinW Card", `${COINW_BASE}/crypto-card`],
    ],
  },
  {
    title: "我们",
    links: [
      ["关于我们", `${COINW_BASE}/about-us`],
      ["官方验证通道", `${COINW_ROOT}/verification`],
      ["费率说明", `${COINW_ROOT}/fees`],
      [
        "法律声明",
        `${COINW_BASE}/help-center/faq/official-updates/2025-09-15/legal-statement/6585`,
      ],
      [
        "风险告知书",
        `${COINW_BASE}/help-center/announcement-center/product-updates/productupdates/2022-11-13/risk-disclosure-statement/2560`,
      ],
      ["隐私保护", `${COINW_BASE}/announcement/product-updates/2022-08-10/隐私政策和声明/2559`],
      ["安全能力", `${COINW_BASE}/about-us/security-and-protection`],
      ["用户协议", `${COINW_BASE}/help-center/faq/official-updates/2020-04-15/user-agreement/6912`],
      ["储备金证明", `${COINW_ROOT}/proof-of-reserves`],
    ],
  },
] as const;

const storeItems = [
  ["App Store", `${COINW_ROOT}/install-app`],
  ["Google Play", `${COINW_ROOT}/install-app`],
] as const;

const socialItems = [
  ["推特", `${COINW_ROOT}/connect?activeId=0`],
  ["电报", `${COINW_ROOT}/connect?activeId=1`],
  ["脸书", `${COINW_ROOT}/connect?activeId=2`],
  ["Discord", `${COINW_ROOT}/connect?activeId=3`],
  ["Instagram", `${COINW_ROOT}/connect?activeId=4`],
  ["•••", `${COINW_ROOT}/connect?activeId=2`],
] as const;

// Round 6 rebuild: footer keeps CoinW live-site structure and public links,
// but social/app-store vector assets remain in evidence/round6-asset-gap-list.md.

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
  return (
    <footer
      data-coinw-shell="footer"
      className="flex min-h-[600px] flex-col bg-[#1A1A1A] text-white"
      style={{ fontFamily: fontFamily() }}
    >
      <div className="flex w-full flex-col gap-8 px-6 py-12 md:px-[90px] md:py-16">
        <div
          data-coinw-shell="footer-columns"
          className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.15fr_repeat(4,1fr)]"
        >
          <div className="flex flex-col gap-6">
            <a
              data-coinw-shell="footer-logo"
              href={COINW_BASE}
              className="flex h-[38px] w-[141px] items-center gap-2 transition-opacity hover:opacity-80"
              {...externalLinkProps("CoinW")}
            >
              <Image
                src={COINW_LOGO_ICON}
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 shrink-0"
                aria-hidden="true"
                unoptimized
              />
              <span
                className="text-[29px] font-black leading-[1.08] tracking-[-0.06px] text-white"
                style={{
                  fontFamily: fontFamily(),
                }}
              >
                CoinW
              </span>
            </a>

            <div className="flex flex-col gap-3">
              {storeItems.map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  className="inline-flex h-12 w-40 items-center justify-center rounded-2xl bg-[#5227FF] px-5 text-sm font-bold leading-5 tracking-[0.1px] text-white transition-opacity hover:opacity-85"
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
                className="mb-6 text-base font-bold leading-6 tracking-[0.15px] text-white"
                style={{ fontFamily: fontFamily() }}
              >
                {column.title}
              </h2>
              <ul className="flex flex-col gap-3">
                {column.links.map(([label, href]) => (
                  <li key={label}>
                    <a
                      data-coinw-shell="footer-link"
                      href={href}
                      className="text-base font-normal leading-6 tracking-[0.15px] text-[#A6A6A6] transition-opacity hover:opacity-75"
                      style={{ fontFamily: fontFamily() }}
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

        <div aria-hidden="true" className="h-px bg-white/10" />

        <div
          data-coinw-shell="footer-bottom"
          className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between"
        >
          <p className="text-sm font-normal leading-5 tracking-[0.25px] text-[#A6A6A6]">
            {FOOTER_COPYRIGHT}
          </p>
          <div className="flex flex-wrap items-center gap-6">
            {socialItems.map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="inline-flex h-[46px] w-[46px] items-center justify-center rounded-full border border-white text-xs font-bold leading-none text-white transition-opacity hover:opacity-75"
                {...externalLinkProps(label)}
              >
                {label}
              </a>
            ))}
            <a
              href={COINW_BASE}
              data-coinw-shell="footer-language"
              className="inline-flex h-12 min-w-[124px] items-center justify-center rounded-xl bg-white/10 px-6 text-sm font-bold leading-5 tracking-[0.1px] text-white transition-opacity hover:opacity-75"
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
