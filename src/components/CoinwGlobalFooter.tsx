import React from "react";

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

const socialItems = [
  ["X", "https://x.com/CoinWOfficial"],
  ["TG", "https://t.me/CoinWExchange"],
  ["FB", "https://www.facebook.com/CoinWExchange"],
  ["DC", "https://discord.com"],
  ["IG", "https://www.instagram.com/coinw_exchange"],
  ["LT", `${COINW_BASE}`],
] as const;

function externalLinkProps(label: string) {
  return {
    "aria-label": label,
    target: "_blank",
    rel: "noopener noreferrer",
  };
}

export function CoinwGlobalFooter() {
  return (
    <footer className="border-t border-white/[0.1] bg-[#1A1A1A] font-[Satoshi,-apple-system,system-ui,sans-serif]">
      <div className="mx-auto max-w-[1440px] px-6 py-16 md:px-10 lg:px-16">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_repeat(4,1fr)]">
          <div className="flex flex-col gap-5">
            <a
              href={COINW_BASE}
              className="flex items-center gap-2 text-[28px] font-black tracking-[-0.02em] text-white"
              {...externalLinkProps("CoinW")}
            >
              <span className="grid size-9 place-items-center rounded-full bg-[#6C4FFF] text-[14px] font-black text-white">
                W
              </span>
              <span>CoinW</span>
            </a>
            <a
              href={`${COINW_BASE}/download`}
              className="text-white/86 hover:border-white/22 w-fit rounded-xl border border-white/10 px-4 py-3 text-[14px] font-bold transition-colors hover:text-white"
              {...externalLinkProps("App Store")}
            >
              App Store
            </a>
            <a
              href={`${COINW_BASE}/download`}
              className="text-white/86 hover:border-white/22 w-fit rounded-xl border border-white/10 px-4 py-3 text-[14px] font-bold transition-colors hover:text-white"
              {...externalLinkProps("Google Play")}
            >
              Google Play
            </a>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <h2 className="mb-5 text-[18px] font-bold text-white">{column.title}</h2>
              <ul className="space-y-3">
                {column.links.map(([label, href]) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-[14px] font-normal text-white/70 transition-colors hover:text-white"
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

        <div className="mt-14 flex flex-col gap-6 border-t border-white/[0.08] pt-8 text-[13px] text-white/55 md:flex-row md:items-center md:justify-between">
          <p>© 2013-2026 coinw.com ALL Rights Reserved</p>
          <div className="flex flex-wrap items-center gap-2">
            {socialItems.map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="hover:border-white/24 grid size-9 place-items-center rounded-full border border-white/10 text-[11px] font-black text-white/70 transition-colors hover:text-white"
                {...externalLinkProps(label)}
              >
                {label}
              </a>
            ))}
            <a
              href={COINW_BASE}
              className="hover:border-white/24 ml-2 rounded-full border border-white/10 px-4 py-2 text-[13px] font-bold text-white/70 transition-colors hover:text-white"
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
