# claw42 a11y Audit

Date: 2026-05-07
Scope: `/zh_CN`, `/en_US`, `/ar_SA`, `/agent`, `/zh_CN/agent`

## Color Contrast

`scripts/verify-a11y.mjs` runs axe-core with WCAG 2.0/2.1 A + AA tags and fails the run on `critical` or `serious` violations, including color contrast. Generated JSON reports are written to `reports/a11y/YYYY-MM-DD.json`.

Current run found 4 route-level serious `color-contrast` violations. WCAG AA requires `4.5:1` for normal text and `3:1` for large text; all reported elements are normal-size text, so the applicable threshold is `4.5:1`.

| # | Page / locale | File + line | Element text | Current foreground | Current background | Current ratio | WCAG AA requirement |
|---|---|---|---|---|---|---:|---|
| 1 | `/zh_CN` / `zh_CN` | `src/modules/landing/HeroScene/HeroScene.tsx:193` | `立即开始` | `#ffffff` | `#7c5cff` | `4.34:1` | `4.5:1` normal text (`3:1` large text) |
| 2 | `/en_US` / `en_US` | `src/modules/landing/HeroScene/HeroScene.tsx:193` | `Get Started` | `#ffffff` | `#7c5cff` | `4.34:1` | `4.5:1` normal text (`3:1` large text) |
| 3 | `/agent` -> `/en_US/agent` / `en_US` | `src/modules/agent-watch/components/AgentRowCard.tsx:77`; `src/modules/agent-watch/components/AgentRowCard.tsx:93` | `Watching now`; `Invalidation` | `#848484`; `#7a7a7a` | `#1f1f1f`; `#0e0e0e` | `4.40:1`; `4.49:1` | `4.5:1` normal text (`3:1` large text) |
| 4 | `/zh_CN/agent` / `zh_CN` | `src/modules/agent-watch/components/AgentRowCard.tsx:77`; `src/modules/agent-watch/components/AgentRowCard.tsx:93` | `当前关注`; `失效条件` | `#848484`; `#7a7a7a` | `#1f1f1f`; `#0e0e0e` | `4.40:1`; `4.49:1` | `4.5:1` normal text (`3:1` large text) |

Raw axe details came from `reports/a11y/2026-05-07.json`. No brand color changes were made in this branch.

## Focus Management

Global focus-visible styling is applied to links, buttons, inputs, selects, textareas, and focusable custom elements. The coin modal already moves focus into the dialog on open and restores focus to the trigger on close.

The verifier focuses visible interactive elements on each checked route and records whether a visible outline, ring, or border treatment is present.

## aria-label

Icon-only and compact controls were audited. The quick-start copy control now exposes an `aria-label`; existing coin, modal close, language, dismiss, and back-to-top controls already carry accessible labels or visible text.

Decorative images remain hidden from assistive technology with empty alt text and/or `aria-hidden="true"`.

Status dots use `role="img"` with an accessible label so the label is valid for assistive technology.
