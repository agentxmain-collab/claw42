# Dual Shell Reference

This document archives the two supported outer-shell variants after the 2026-05-29
cron/deeplink production release. It is a reference snapshot only. The shared page
body, watch pipeline, public cards, analytics, and CoinW trade gates are outside this
document.

Current production source:

- Main commit: `7d7106f36031146cc799997a77536ff16cc76823`
- Snapshot tag: `prod-snapshot-2026-05-29-cron-deeplink-shipped`
- Production deployment: `dpl_DqC6yiagiiJr8rKbQMWYW76idKG7`

## Build Recipes

Both shells are built from the same commit. The selected shell is controlled only by
`SITE_SHELL_VARIANT`.

| Variant | `SITE_SHELL_VARIANT` | Deployment reference               | Intended surface                     |
| ------- | -------------------- | ---------------------------------- | ------------------------------------ |
| A       | `claw42`             | `dpl_DqC6yiagiiJr8rKbQMWYW76idKG7` | current `claw42.ai` production shell |
| B       | `coinw`              | `dpl_EccJpn2HyFiGRJEFhVF396FEN3J5` | CoinW-branded preview shell          |

To rebuild either shell from the preserved snapshot:

1. Check out `prod-snapshot-2026-05-29-cron-deeplink-shipped`.
2. Set `SITE_SHELL_VARIANT=claw42` for Variant A or `SITE_SHELL_VARIANT=coinw`
   for Variant B.
3. Build/deploy through the existing `claw42-site` Vercel project. Do not create or
   link a new Vercel project.

Rollback chain:

- Use Vercel rollback/promote only after Dan character-level production approval.
- If the shell variant is wrong, first confirm `SITE_SHELL_VARIANT` on the target
  environment, then roll back to the approved deployment or rebuild from the snapshot
  tag above.
- Earlier snapshots remain available as:
  - `prod-snapshot-2026-05-25-pre-ui-v1`
  - `prod-snapshot-2026-05-24-pre-v12-coverage`
  - `prod-snapshot-2026-05-24-pre-v11-fix`
  - `prod-snapshot-2026-05-23-pre-phase1`

## Runtime Switch

`src/app/[locale]/layout.tsx` selects the shell with `SITE_SHELL_VARIANT`.

| Value    | Header              | Footer              | Intended line                                       |
| -------- | ------------------- | ------------------- | --------------------------------------------------- |
| `claw42` | `SiteHeader`        | none                | `claw42.ai`                                         |
| `coinw`  | `CoinwGlobalHeader` | `CoinwGlobalFooter` | CoinW-branded line, including future `ai.coinw.com` |

Current code treats any value other than `claw42` as `coinw`. Production projects must
set `SITE_SHELL_VARIANT` explicitly before release so preview defaults do not decide a
public shell.

## Variant A: Claw 42 Shell

Source: `src/components/SiteHeader.tsx`.

Purpose: original Claw 42 public shell for `claw42.ai`.

Structure:

- Fixed top header, `72px` height, black translucent background, bottom hairline border.
- Inner width constrained to `1440px`, with responsive horizontal padding.
- Logo link points to `/${locale}` through `withBasePath`.
- Logo assets:
  - `/images/brand/claw42-horizontal.png`
  - `/images/brand/claw42-horizontal-blue.png`
- Right side:
  - Realtime agent link to `/${locale}/agent`, hidden below `md`.
  - Active route state uses `aria-current="page"` and the existing subtle white panel style.
  - Green live dot beside `t.nav.agentLiveMenuItem`.
  - `LocaleDropdown`.
- Footer: none. `src/app/[locale]/layout.tsx` renders `null` for the footer when
  `SITE_SHELL_VARIANT=claw42`.

Keep this variant free of CoinW global navigation and footer chrome unless Dan explicitly
changes the public `claw42.ai` positioning.

## Variant B: CoinW Global Shell

Sources:

- `src/components/CoinwGlobalHeader.tsx`
- `src/components/CoinwGlobalFooter.tsx`
- `design-tokens/coinw-shell.json`
- `public/images/coinw/*.svg`

Purpose: CoinW-branded outer shell for the CoinW line. It is selected by
`SITE_SHELL_VARIANT=coinw`.

### Header Snapshot

Base URL: `https://www.coinw.com/en_US`.

Container:

- Fixed top header, `72px` height.
- Background `#1A1A1A`.
- Text color white.
- Font stack starts with `var(--font-satoshi)`.

Logo:

- `/images/coinw/coinw-logo-wordmark.svg`
- Rendered as a `140px x 36px` wordmark link to CoinW.

Navigation, in order:

1. `Buy crypto` -> `/p2p-trading/personalized/buy`, with submenu:
   `Quick trade`, `Block trade`, `C2C`.
2. `Trade` -> `/futures/usdt/btcusdt`, with submenu:
   `Spot trading`, `Futures`, `ETF trading`.
3. `Markets` -> `/market/futures/all`.
4. `Copy trading` -> `/copy-trading/futures`, with submenu:
   `Futures copy trading`, `Elite traders`.
5. `Bots` -> `/trading-bots/all`, with green `New` badge.
6. `Finance` -> `/earn/crypto-savings`, with submenu:
   `CoinW earn`, `Rocket Plan`, `Lucky HODL`.
7. `Lucky HODL` -> `/launch-x/lucky-hodl`.
8. `More` -> CoinW root, with submenu:
   `Download`, `API`, `Help Center`.

Header right side:

- `Wallet` link with chevron.
- `Deposit` button, `83px x 40px`, background `#5227FF`, radius `12px`.
- Four utility icon links:
  - `/images/coinw/header-account.svg`
  - `/images/coinw/header-bell.svg`
  - `/images/coinw/header-globe.svg`
  - `/images/coinw/header-moon.svg`

### Footer Snapshot

Container:

- Minimum height `650px`.
- Background `#1A1A1A`.
- Main content horizontal padding `90px` on desktop.

Left block:

- Logo: `/images/coinw/coinw-logo-wordmark.svg`.
- `Download app` label.
- Dual download buttons:
  - `/images/coinw/btn-appstore.svg`
  - `/images/coinw/btn-googleplay.svg`

Footer columns, in order:

1. `Company`
   - `About us`
   - `News`
   - `CoinW verity`
   - `Fee rate`
   - `Risk statement`
2. `Products`
   - `Buy crypto`
   - `Spot trading`
   - `ETF trading`
   - `Futures`
   - `Copy-trading` with `New` badge
   - `CoinW earn`
   - `CoinW ventures`
3. `Services`
   - `Listing application`
   - `T&C of Listing`
   - `Become the merchant`
   - `VIP Program`
   - `APIs`
   - `Invite Friends`
   - `Bug Bounty`
4. `Learn`
   - `Novice Camp`
   - `Futures Academy`
   - `Help Center`
   - `Crypto Introduction`

Footer disclaimer:

- Prefix `Disclaimer:` in purple.
- Two short lines about cryptocurrency market risk and responsible trading.

Footer bottom:

- Copyright string:
  `CopyRight © 2013 - 2026 CoinW.com. All Rights Reserved.`
- Social vector icons:
  - `/images/coinw/social-facebook.svg`
  - `/images/coinw/social-x.svg`
  - `/images/coinw/social-instagram.svg`
  - `/images/coinw/social-youtube.svg`
  - `/images/coinw/social-google.svg`
  - `/images/coinw/social-linkedin.svg`
  - `/images/coinw/social-tiktok.svg`
- Language pill:
  - `/images/coinw/lang-english.svg`

### Color Snapshot

Use these values when comparing the shell to the Figma-derived Stage 4 target:

| Token                    | Value     |
| ------------------------ | --------- |
| Shell background         | `#1A1A1A` |
| CoinW purple             | `#5227FF` |
| New badge green          | `#D1FF55` |
| Secondary gray           | `#A6A6A6` |
| Footer disclaimer purple | `#6C4FFF` |

### Vector Asset List

The current shell uses SVG assets for the clean CoinW logo and UI icons. These files
must stay vector-only; tests assert they start with `<svg` and do not embed `<image` or
`data:image`.

- `coinw-logo-wordmark.svg`
- `coinw-logo.svg`
- `header-account.svg`
- `header-bell.svg`
- `header-globe.svg`
- `header-moon.svg`
- `btn-appstore.svg`
- `btn-googleplay.svg`
- `lang-english.svg`
- `social-facebook.svg`
- `social-x.svg`
- `social-instagram.svg`
- `social-youtube.svg`
- `social-google.svg`
- `social-linkedin.svg`
- `social-tiktok.svg`

## Switching Checklist

Use this checklist before switching public shell ownership:

1. Confirm target domain and intended shell:
   - `claw42.ai` -> `SITE_SHELL_VARIANT=claw42`
   - `ai.coinw.com` -> `SITE_SHELL_VARIANT=coinw`
2. Confirm the Vercel project identity is still `claw42-site` under
   `agentxmain-collabs-projects`.
3. Confirm the selected shell in the production environment before promotion.
4. Verify `/zh_CN` and `/zh_CN/agent` visually after deployment.
5. Roll back with the approved deployment rollback path if the public domain shows the
   wrong shell.

Do not create a second Vercel project, bind a new domain, change production environment
variables, or promote production from this reference document alone. Those actions require
Dan character-level production approval.
