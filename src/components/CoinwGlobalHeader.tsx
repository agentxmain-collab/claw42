import React from "react";

const COINW_BASE = "https://www.coinw.com/zh_CN";

const navItems = [
  ["买币", `${COINW_BASE}/crypto-buy`],
  ["行情", `${COINW_BASE}/markets`],
  ["U本位合约", `${COINW_BASE}/futures`],
  ["交易", `${COINW_BASE}/spot`],
  ["跟单", `${COINW_BASE}/copy-trading`, "New"],
  ["策略", `${COINW_BASE}/strategy`],
  ["赚币", `${COINW_BASE}/earn`],
  ["Launch X", `${COINW_BASE}/launchpad`],
  ["更多", COINW_BASE],
] as const;

const utilityItems = [
  ["下载", `${COINW_BASE}/download`],
  ["🌐", COINW_BASE],
  ["☾", COINW_BASE],
  ["🔔", `${COINW_BASE}/notifications`],
] as const;

function externalLinkProps(label: string) {
  return {
    "aria-label": label,
    target: "_blank",
    rel: "noopener noreferrer",
  };
}

export function CoinwGlobalHeader() {
  return (
    <nav className="fixed inset-x-0 top-0 z-[80] h-[64px] border-b border-white/[0.06] bg-[#1A1A1A] font-[Satoshi,-apple-system,system-ui,sans-serif]">
      <div className="mx-auto flex h-[64px] max-w-[1440px] items-center justify-between gap-5 px-6 md:px-10 lg:px-16">
        <a
          href={COINW_BASE}
          className="flex shrink-0 items-center gap-2 text-[24px] font-black tracking-[-0.02em] text-white"
          {...externalLinkProps("CoinW")}
        >
          <span className="grid size-8 place-items-center rounded-full bg-[#6C4FFF] text-[13px] font-black text-white">
            W
          </span>
          <span>CoinW</span>
        </a>

        <div className="hidden min-w-0 flex-1 items-center justify-center gap-5 lg:flex">
          {navItems.map(([label, href, badge]) => (
            <a
              key={label}
              href={href}
              className="hover:text-white/72 inline-flex items-center gap-1.5 whitespace-nowrap text-[14px] font-bold leading-none text-white transition-colors"
              {...externalLinkProps(label)}
            >
              {label}
              {badge ? (
                <span className="rounded-full bg-[#6C4FFF] px-1.5 py-0.5 text-[10px] font-black uppercase text-white">
                  {badge}
                </span>
              ) : null}
            </a>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-1 md:flex">
            {utilityItems.map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="text-white/82 grid h-9 min-w-9 place-items-center rounded-full px-2 text-[13px] font-bold transition-colors hover:bg-white/[0.08] hover:text-white"
                {...externalLinkProps(label)}
              >
                {label}
              </a>
            ))}
          </div>
          <a
            href={`${COINW_BASE}/login`}
            className="rounded-full bg-white/[0.1] px-4 py-2 text-[14px] font-bold text-white transition-colors hover:bg-white/[0.16]"
            {...externalLinkProps("登录")}
          >
            登录
          </a>
          <a
            href={`${COINW_BASE}/register`}
            className="rounded-full bg-[#6C4FFF] px-4 py-2 text-[14px] font-bold text-white transition-colors hover:bg-[#7a61ff]"
            {...externalLinkProps("注册")}
          >
            注册
          </a>
        </div>
      </div>
    </nav>
  );
}
