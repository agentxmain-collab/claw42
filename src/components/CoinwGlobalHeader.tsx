import React from "react";
import Image from "next/image";

const COINW_BASE = "https://www.coinw.com/zh_CN";
const COINW_LOGO_ICON = "/images/coinw/coinw-logo.svg";

const navLinks = [
  ["买币", `${COINW_BASE}/p2p-trading/personalized/buy`],
  ["行情", `${COINW_BASE}/market/futures/all`],
  ["U本位合约", `${COINW_BASE}/futures/usdt/btcusdt`],
  ["交易", `${COINW_BASE}/spot/btcusdt`],
  ["跟单", `${COINW_BASE}/copy-trading/futures`, "New"],
  ["策略", `${COINW_BASE}/trading-bots/all`],
  ["赚币", `${COINW_BASE}/earn/crypto-savings`],
  ["Launch X", `${COINW_BASE}/launch-x/lucky-hodl`],
  ["更多", `${COINW_BASE}/`],
] as const;

const utilityItems = [
  ["下载", `${COINW_BASE}/download`],
  ["简体中文", COINW_BASE],
] as const;

// Round 6 rebuild ground truth from coinw.com/zh_CN rendered header:
// header height 64px / padding 0 24px / nav 14px 700 20px / real SVG logo icon.

function externalLinkProps(label: string) {
  return {
    "aria-label": label,
    target: "_blank",
    rel: "noopener noreferrer",
  };
}

export function CoinwGlobalHeader() {
  return (
    <header
      data-coinw-shell="header"
      className="fixed inset-x-0 top-0 z-[80] flex h-16 items-center bg-[#1A1A1A] px-6 text-white"
      style={{
        color: "#FFFFFF",
      }}
    >
      <div className="flex h-16 w-full min-w-0 items-center">
        <a
          data-coinw-shell="header-logo"
          href={COINW_BASE}
          className="flex h-[38px] w-[141px] shrink-0 items-center gap-2 transition-opacity hover:opacity-80"
          style={{
            fontFamily: "var(--font-satoshi), var(--font-language)",
          }}
          {...externalLinkProps("CoinW")}
        >
          <Image
            src={COINW_LOGO_ICON}
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 shrink-0"
            aria-hidden="true"
            priority
            unoptimized
          />
          <span
            className="text-[29px] font-black leading-[1.08] tracking-[-0.06px]"
            style={{
              color: "#FFFFFF",
            }}
          >
            CoinW
          </span>
        </a>

        <nav
          data-coinw-shell="header-nav"
          className="ml-5 hidden min-w-0 flex-1 items-center lg:flex"
          aria-label="CoinW"
        >
          <ul className="flex h-16 items-center">
            {navLinks.map(([label, href, badge]) => (
              <li key={label} className="flex h-16 items-center px-3">
                <a
                  data-coinw-shell="header-nav-link"
                  href={href}
                  className="inline-flex items-center whitespace-nowrap text-sm font-bold leading-5 tracking-[0.1px] text-white transition-opacity hover:opacity-75"
                  style={{ fontFamily: "var(--font-satoshi), var(--font-language)" }}
                  {...externalLinkProps(label)}
                >
                  {label}
                  {badge ? (
                    <span className="ml-1.5 inline-flex h-5 items-center justify-center rounded-full bg-[#D1FF55] px-2 text-xs font-bold leading-5 text-black">
                      {badge}
                    </span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div
          data-coinw-shell="header-right"
          className="ml-auto flex h-16 shrink-0 items-center gap-5"
          style={{ fontFamily: "var(--font-satoshi), var(--font-language)" }}
        >
          <div className="hidden h-16 items-center gap-5 md:flex">
            {utilityItems.map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="inline-flex h-16 items-center justify-center text-sm font-bold leading-5 tracking-[0.1px] text-white transition-opacity hover:opacity-75"
                {...externalLinkProps(label)}
              >
                {label}
              </a>
            ))}
          </div>
          <a
            href={`${COINW_BASE}/login`}
            data-coinw-shell="header-login"
            className="inline-flex h-10 items-center justify-center px-2 text-sm font-bold leading-5 tracking-[0.1px] text-white transition-opacity hover:opacity-75"
            {...externalLinkProps("登录")}
          >
            登录
          </a>
          <a
            href={`${COINW_BASE}/register`}
            data-coinw-shell="header-register"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[#5227FF] px-4 text-sm font-bold leading-5 tracking-[0.1px] text-white transition-opacity hover:opacity-85"
            {...externalLinkProps("注册")}
          >
            注册
          </a>
        </div>
      </div>
    </header>
  );
}
