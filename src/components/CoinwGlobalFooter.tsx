/* eslint-disable @next/next/no-img-element */
import React from "react";

const COINW_BASE = "https://www.coinw.com/en_US";
const COINW_ROOT = "https://www.coinw.com";
const FOOTER_COPYRIGHT = "CopyRight © 2013 - 2026 CoinW.com. All Rights Reserved.";

const coinwFontFamily =
  'var(--font-satoshi), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const footerColumns = [
  {
    title: "Company",
    links: [
      ["About us", `${COINW_BASE}/about-us`],
      ["News", `${COINW_BASE}/news`],
      ["CoinW verity", `${COINW_BASE}/verification`],
      ["Fee rate", `${COINW_BASE}/fees`],
      ["Risk statement", `${COINW_BASE}/risk`],
    ],
  },
  {
    title: "Products",
    links: [
      ["Buy crypto", `${COINW_BASE}/p2p-trading/personalized/buy`],
      ["Spot trading", `${COINW_BASE}/spot/btcusdt`],
      ["ETF trading", `${COINW_BASE}/spot?type=etf`],
      ["Futures", `${COINW_BASE}/futures/usdt/btcusdt`],
      ["Copy-trading", `${COINW_BASE}/copy-trading/futures`, "New"],
      ["CoinW earn", `${COINW_BASE}/earn/crypto-savings`],
      ["CoinW ventures", `${COINW_BASE}/ventures`],
    ],
  },
  {
    title: "Services",
    links: [
      ["Listing application", `${COINW_BASE}/listing`],
      ["T&C of Listing", `${COINW_BASE}/listing-terms`],
      ["Become the merchant", `${COINW_BASE}/merchant`],
      ["VIP Program", `${COINW_BASE}/vip`],
      ["APIs", `${COINW_ROOT}/api-doc/common/introduction`],
      ["Invite Friends", `${COINW_BASE}/referral`],
      ["Bug Bounty", "https://hackenproof.com/coinw/coinw-web-and-mobile"],
    ],
  },
  {
    title: "Learn",
    links: [
      ["Novice Camp", `${COINW_BASE}/academy`],
      ["Futures Academy", `${COINW_BASE}/academy/futures`],
      ["Help Center", `${COINW_BASE}/support`],
      ["Crypto Introduction", `${COINW_BASE}/markets`],
    ],
  },
] as const;

const socialItems = [
  ["Facebook", "/images/coinw/social-facebook.svg", `${COINW_ROOT}/connect?activeId=2`],
  ["X", "/images/coinw/social-x.svg", `${COINW_ROOT}/connect?activeId=0`],
  ["Instagram", "/images/coinw/social-instagram.svg", `${COINW_ROOT}/connect?activeId=4`],
  ["YouTube", "/images/coinw/social-youtube.svg", `${COINW_ROOT}/connect?activeId=5`],
  ["Google", "/images/coinw/social-google.svg", `${COINW_ROOT}/connect?activeId=6`],
  ["LinkedIn", "/images/coinw/social-linkedin.svg", `${COINW_ROOT}/connect?activeId=7`],
  ["TikTok", "/images/coinw/social-tiktok.svg", `${COINW_ROOT}/connect?activeId=8`],
] as const;

function externalLinkProps(label: string) {
  return {
    "aria-label": label,
    target: "_blank",
    rel: "noopener noreferrer",
  };
}

function NewBadge() {
  return (
    <span className="ml-2 inline-flex h-5 items-center justify-center rounded-full bg-[#D1FF55] px-2 text-[12px] font-medium leading-5 text-black">
      New
    </span>
  );
}

export function CoinwGlobalFooter() {
  return (
    <footer
      data-coinw-shell="footer"
      className="flex min-h-[650px] flex-col bg-[#1A1A1A] text-white"
      style={{ fontFamily: coinwFontFamily }}
    >
      <div className="flex w-full flex-col gap-12 px-6 py-16 md:px-[90px]">
        <div
          data-coinw-shell="footer-columns"
          className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.15fr_repeat(4,1fr)]"
        >
          <div className="flex flex-col gap-7">
            <a
              data-coinw-shell="footer-logo"
              href={COINW_BASE}
              className="flex h-9 w-[140px] items-center transition-opacity hover:opacity-80"
              {...externalLinkProps("CoinW")}
            >
              <img
                src="/images/coinw/coinw-logo-wordmark.svg"
                alt="CoinW"
                width={140}
                height={36}
                className="h-9 w-[140px] object-contain"
              />
            </a>

            <div className="flex flex-col gap-3">
              <p className="text-base font-bold leading-6 tracking-[0.15px] text-white">
                Download app
              </p>
              <a
                href={`${COINW_BASE}/download`}
                data-coinw-shell="footer-download-appstore"
                className="inline-flex h-12 w-40 items-center justify-center transition-opacity hover:opacity-85"
                {...externalLinkProps("Download on the App Store")}
              >
                <img
                  src="/images/coinw/btn-appstore.svg"
                  alt="App Store"
                  width={160}
                  height={48}
                  className="h-12 w-40 object-contain"
                />
              </a>
              <a
                href={`${COINW_BASE}/download`}
                data-coinw-shell="footer-download-googleplay"
                className="inline-flex h-12 w-40 items-center justify-center transition-opacity hover:opacity-85"
                {...externalLinkProps("Get it on Google Play")}
              >
                <img
                  src="/images/coinw/btn-googleplay.svg"
                  alt="Google Play"
                  width={160}
                  height={48}
                  className="h-12 w-40 object-contain"
                />
              </a>
            </div>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <h2
                data-coinw-shell="footer-title"
                className="mb-6 text-base font-bold leading-6 tracking-[0.15px] text-white"
                style={{ fontFamily: coinwFontFamily }}
              >
                {column.title}
              </h2>
              <ul className="flex flex-col gap-3">
                {column.links.map(([label, href, badge]) => (
                  <li key={label}>
                    <a
                      data-coinw-shell="footer-link"
                      href={href}
                      className="inline-flex items-center text-base font-normal leading-6 tracking-[0.15px] text-[#A6A6A6] transition-opacity hover:opacity-75"
                      style={{ fontFamily: coinwFontFamily }}
                      {...externalLinkProps(label)}
                    >
                      {label}
                      {badge ? <NewBadge /> : null}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          data-coinw-shell="footer-disclaimer"
          className="mx-auto max-w-[760px] text-center text-sm leading-5 tracking-[0.1px]"
        >
          <p className="text-[#A6A6A6]">
            <span className="font-medium text-[#6C4FFF]">Disclaimer:</span> Cryptocurrency trading
            is subject to market risks.
          </p>
          <p className="mt-2 text-[#A6A6A6]">
            Please trade responsibly and ensure you fully understand the risks before making any
            investment decisions.
          </p>
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
            {socialItems.map(([label, src, href]) => (
              <a
                key={label}
                href={href}
                className="inline-flex h-[46px] w-[46px] items-center justify-center rounded-full border border-white transition-opacity hover:opacity-75"
                {...externalLinkProps(label)}
              >
                <img
                  src={src}
                  alt={label}
                  width={46}
                  height={46}
                  className="h-[46px] w-[46px] object-contain"
                />
              </a>
            ))}
            <a
              href={COINW_BASE}
              data-coinw-shell="footer-language"
              className="inline-flex h-12 w-[124px] items-center justify-center transition-opacity hover:opacity-75"
              {...externalLinkProps("English")}
            >
              <img
                src="/images/coinw/lang-english.svg"
                alt="English"
                width={124}
                height={48}
                className="h-12 w-[124px] rounded-xl object-contain"
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
