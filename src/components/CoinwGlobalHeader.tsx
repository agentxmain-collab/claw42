/* eslint-disable @next/next/no-img-element */
import React from "react";

const COINW_BASE = "https://www.coinw.com/en_US";

const coinwFontFamily =
  'var(--font-satoshi), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const navItems = [
  {
    label: "Buy crypto",
    href: `${COINW_BASE}/p2p-trading/personalized/buy`,
    items: [
      ["Quick trade", `${COINW_BASE}/p2p-trading/personalized/buy`],
      ["Block trade", `${COINW_BASE}/p2p-trading/otc`],
      ["C2C", `${COINW_BASE}/p2p-trading`],
    ],
  },
  {
    label: "Trade",
    href: `${COINW_BASE}/futures/usdt/btcusdt`,
    items: [
      ["Spot trading", `${COINW_BASE}/spot/btcusdt`],
      ["Futures", `${COINW_BASE}/futures/usdt/btcusdt`],
      ["ETF trading", `${COINW_BASE}/spot?type=etf`],
    ],
  },
  { label: "Markets", href: `${COINW_BASE}/market/futures/all` },
  {
    label: "Copy trading",
    href: `${COINW_BASE}/copy-trading/futures`,
    items: [
      ["Futures copy trading", `${COINW_BASE}/copy-trading/futures`],
      ["Elite traders", `${COINW_BASE}/copy-trading/futures`],
    ],
  },
  { label: "Bots", href: `${COINW_BASE}/trading-bots/all`, badge: "New" },
  {
    label: "Finance",
    href: `${COINW_BASE}/earn/crypto-savings`,
    items: [
      ["CoinW earn", `${COINW_BASE}/earn/crypto-savings`],
      ["Rocket Plan", `${COINW_BASE}/launch-x/lucky-hodl`],
      ["Lucky HODL", `${COINW_BASE}/launch-x/lucky-hodl`],
    ],
  },
  { label: "Lucky HODL", href: `${COINW_BASE}/launch-x/lucky-hodl` },
  {
    label: "More",
    href: COINW_BASE,
    items: [
      ["Download", `${COINW_BASE}/download`],
      ["API", `${COINW_BASE}/api`],
      ["Help Center", `${COINW_BASE}/support`],
    ],
  },
] as const;

const utilityIcons = [
  ["Account", "/images/coinw/header-avatar.png", `${COINW_BASE}/user`],
  ["Notifications", "/images/coinw/header-bell.png", `${COINW_BASE}/notifications`],
  ["Language", "/images/coinw/header-globe.png", COINW_BASE],
  ["Dark mode", "/images/coinw/header-moon.png", COINW_BASE],
] as const;

function externalLinkProps(label: string) {
  return {
    "aria-label": label,
    target: "_blank",
    rel: "noopener noreferrer",
  };
}

function Chevron() {
  return (
    <span aria-hidden="true" className="ml-1 text-[10px] leading-none text-white">
      ▼
    </span>
  );
}

function NewBadge() {
  return (
    <span className="ml-1.5 inline-flex h-5 items-center justify-center rounded-full bg-[#D1FF55] px-2 text-[12px] font-medium leading-5 text-black">
      New
    </span>
  );
}

export function CoinwGlobalHeader() {
  return (
    <header
      data-coinw-shell="header"
      className="fixed inset-x-0 top-0 z-[80] flex h-16 items-center bg-[#1A1A1A] px-6 text-white"
      style={{ fontFamily: coinwFontFamily }}
    >
      <div className="flex h-16 w-full min-w-0 items-center">
        <a
          data-coinw-shell="header-logo"
          href={COINW_BASE}
          className="flex h-[38px] w-[141px] shrink-0 items-center transition-opacity hover:opacity-80"
          {...externalLinkProps("CoinW")}
        >
          <img
            src="/images/coinw/logo-white.png"
            alt="CoinW"
            width={141}
            height={38}
            className="h-[38px] w-[141px] object-contain"
          />
        </a>

        <nav
          data-coinw-shell="header-nav"
          className="ml-5 hidden min-w-0 flex-1 items-center lg:flex"
          aria-label="CoinW"
          style={{ fontFamily: coinwFontFamily }}
        >
          <ul className="flex h-16 items-center">
            {navItems.map((item) => (
              <li key={item.label} className="group relative flex h-16 items-center px-3">
                <a
                  data-coinw-shell="header-nav-link"
                  href={item.href}
                  className="inline-flex items-center whitespace-nowrap text-sm font-bold leading-5 tracking-[0.1px] text-white transition-opacity hover:opacity-75"
                  style={{ fontFamily: coinwFontFamily }}
                  {...externalLinkProps(item.label)}
                >
                  {item.label}
                  {"items" in item ? <Chevron /> : null}
                  {"badge" in item ? <NewBadge /> : null}
                </a>

                {"items" in item ? (
                  <div className="pointer-events-none absolute left-2 top-14 min-w-[180px] translate-y-1 rounded-xl border border-white/10 bg-[#1A1A1A] p-2 opacity-0 shadow-2xl shadow-black/30 transition-all duration-150 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
                    <ul className="flex flex-col">
                      {item.items.map(([label, href]) => (
                        <li key={label}>
                          <a
                            href={href}
                            className="block rounded-lg px-3 py-2 text-sm font-bold leading-5 tracking-[0.1px] text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                            style={{ fontFamily: coinwFontFamily }}
                            {...externalLinkProps(label)}
                          >
                            {label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>

        <div
          data-coinw-shell="header-right"
          className="ml-auto flex h-16 shrink-0 items-center gap-5"
          style={{ fontFamily: coinwFontFamily }}
        >
          <a
            href={`${COINW_BASE}/assets`}
            className="hidden h-16 items-center justify-center text-sm font-bold leading-5 tracking-[0.1px] text-white transition-opacity hover:opacity-75 md:inline-flex"
            {...externalLinkProps("Wallet")}
          >
            Wallet
            <Chevron />
          </a>
          <a
            href={`${COINW_BASE}/assets/deposit`}
            data-coinw-shell="header-deposit"
            className="inline-flex h-10 items-center justify-center transition-opacity hover:opacity-85"
            {...externalLinkProps("Deposit")}
          >
            <img
              src="/images/coinw/cta-deposit.png"
              alt="Deposit"
              width={83}
              height={40}
              className="h-10 w-[83px] rounded-xl object-contain"
            />
          </a>
          <div className="hidden items-center gap-5 md:flex">
            {utilityIcons.map(([label, src, href]) => (
              <a
                key={label}
                href={href}
                className="inline-flex h-10 w-10 items-center justify-center transition-opacity hover:opacity-75"
                {...externalLinkProps(label)}
              >
                <img
                  src={src}
                  alt={label}
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
