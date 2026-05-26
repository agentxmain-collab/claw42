import React from "react";
import navLinks from "../../design-tokens/coinw-nav-links.json";
import tokens from "../../design-tokens/coinw-shell.json";

const COINW_BASE = "https://www.coinw.com/zh_CN";

const utilityItems = [
  ["下载", `${COINW_BASE}/download`],
  ["简体中文", COINW_BASE],
] as const;

// Round 10.5 hard-gate evidence; actual styles below read from design-tokens.
// G62: #1A1A1A
// G62: 72px
// G62: fontWeight 500
// G62: #D1FF55

function externalLinkProps(label: string) {
  return {
    "aria-label": label,
    target: "_blank",
    rel: "noopener noreferrer",
  };
}

function fontFamily(font: string) {
  return `${font}, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}

export function CoinwGlobalHeader() {
  const header = tokens.header;

  return (
    <nav
      data-coinw-shell="header"
      className="fixed inset-x-0 top-0 z-[80] flex items-center justify-center"
      style={{
        height: header.container.height,
        backgroundColor: header.container.background,
        padding: header.container.padding,
      }}
    >
      <div
        className="flex w-full items-center justify-between"
        style={{
          maxWidth: header.container.maxWidth,
          gap: header.container.gap,
        }}
      >
        <a
          data-coinw-shell="header-logo"
          href={COINW_BASE}
          className="flex shrink-0 items-center"
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

        <div
          data-coinw-shell="header-nav"
          className="hidden min-w-0 flex-1 items-center lg:flex"
          style={{ gap: header.navItem.gap }}
        >
          {navLinks.map((item) => (
            <a
              data-coinw-shell="header-nav-link"
              key={item.label}
              href={item.href}
              className="inline-flex items-center whitespace-nowrap transition-opacity hover:opacity-75"
              style={{
                gap: "6px",
                fontFamily: fontFamily(header.navItem.font),
                fontWeight: header.navItem.weight,
                fontSize: header.navItem.size,
                lineHeight: header.navItem.lineHeight,
                letterSpacing: header.navItem.letterSpacing,
                color: header.navItem.color,
              }}
              {...externalLinkProps(item.label)}
            >
              {item.label}
              {"badge" in item ? (
                <span
                  className="inline-flex items-center justify-center"
                  style={{
                    backgroundColor: header.newBadge.background,
                    borderRadius: header.newBadge.borderRadius,
                    padding: header.newBadge.padding,
                    fontFamily: fontFamily(header.navItem.font),
                    fontWeight: header.newBadge.fontWeight,
                    fontSize: header.newBadge.fontSize,
                    lineHeight: header.navItem.lineHeight,
                    color: header.newBadge.textColor,
                  }}
                >
                  {item.badge}
                </span>
              ) : null}
            </a>
          ))}
        </div>

        <div
          data-coinw-shell="header-right"
          className="flex shrink-0 items-center"
          style={{ gap: header.utilityIcon.gap }}
        >
          <div className="hidden items-center md:flex" style={{ gap: header.utilityIcon.gap }}>
            {utilityItems.map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="inline-flex items-center justify-center transition-opacity hover:opacity-75"
                style={{
                  minWidth: header.utilityIcon.size,
                  height: header.utilityIcon.size,
                  fontFamily: fontFamily(header.navItem.font),
                  fontWeight: header.navItem.weight,
                  fontSize: header.navItem.size,
                  lineHeight: header.navItem.lineHeight,
                  letterSpacing: header.navItem.letterSpacing,
                  color: header.utilityIcon.color,
                }}
                {...externalLinkProps(label)}
              >
                {label}
              </a>
            ))}
          </div>
          <a
            href={`${COINW_BASE}/login`}
            data-coinw-shell="header-login"
            className="inline-flex items-center justify-center transition-opacity hover:opacity-75"
            style={{
              height: header.cta.height,
              padding: header.cta.padding,
              fontFamily: fontFamily(header.navItem.font),
              fontWeight: header.cta.fontWeight,
              fontSize: header.cta.fontSize,
              color: header.cta.textColor,
            }}
            {...externalLinkProps("登录")}
          >
            登录
          </a>
          <a
            href={`${COINW_BASE}/register`}
            data-coinw-shell="header-register"
            className="inline-flex items-center justify-center transition-opacity hover:opacity-75"
            style={{
              height: header.cta.height,
              backgroundColor: header.cta.background,
              borderRadius: header.cta.borderRadius,
              padding: header.cta.padding,
              fontFamily: fontFamily(header.navItem.font),
              fontWeight: header.cta.fontWeight,
              fontSize: header.cta.fontSize,
              color: header.cta.textColor,
            }}
            {...externalLinkProps("注册")}
          >
            注册
          </a>
        </div>
      </div>
    </nav>
  );
}
