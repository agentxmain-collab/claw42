# Round 6 Header/Footer Asset Gap List

Scope: `§ 3.94.header-footer-rebuild`

## Assets Applied

- `public/images/coinw/coinw-logo.svg`
  - Source: `https://cdn.yumltd.com/static/_home/_nuxt/coinw-logo.B-rij_iY.svg`
  - Verified reachable by `curl -I` on 2026-05-28.
  - Used in `CoinwGlobalHeader` and `CoinwGlobalFooter` instead of the previous CSS-drawn logo mark.

## Chrome First-Hand DOM Notes

Chrome user session loaded `https://www.coinw.com/zh_CN` on 2026-05-28 and exposed the rendered accessibility tree. Values applied from that pass:

- Header public navigation labels and right-side actions.
- Footer column link labels and destination URLs.
- Footer copyright text: `© 2013-2026 coinw.com ALL Rights Reserved`.
- Footer language control label: `简体中文`.

## Deferred Asset Gaps

CoinW home page returned Cloudflare "Just a moment..." to local headless and curl requests, and Chrome has JavaScript-from-Apple-Events disabled, so the following visual assets could not be first-hand downloaded from the live DOM in this run:

- Header dropdown chevron / iconpark glyphs.
- Footer social network SVG icons.
- Footer App Store / Google Play badge artwork, if the live footer uses image badges instead of text buttons.

Temporary handling:

- Header keeps the live-site public navigation labels, links, 64px bar, 14px/700 nav typography, and real SVG logo mark.
- Footer keeps the live-site public link structure and sizing, while social/download assets remain text-based placeholders pending a Dan/Figma export batch.

Request for final asset pass:

- Export footer social icons and app store badges from CoinW source/Figma if visual parity requires replacing the current text placeholders.
