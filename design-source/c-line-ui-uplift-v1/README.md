# C-Line UI Uplift v1 · Design Source

C-line UI 优化设计稿。基于 `bot-avatar-v1`（PR #110），按 teamRegistry.ts Stage 2 顺序为 14 个角色 + PM 3 状态 + (即将)Hero 视觉细节 + 6 步交互序列做差异化设计。

This archive is design-source only — final integration decisions belong to F and the deployment gate.

## Files

```
c-line-ui-uplift-v1/
├── README.md                  (this file)
├── canonical-base.html        Canonical base preview (head / ears / feet locked)
├── 14-symbol-eyes.html        14 + 3 variants preview (HTML, animated)
├── avatars-gallery.html       SVG export preview gallery
└── avatars/                   16 standalone SVG files
    ├── fundamental_analyst.svg     01
    ├── news_analyst.svg            02
    ├── chart_analyst.svg           03
    ├── onchain_analyst.svg         04
    ├── research_lead.svg           05
    ├── risk_lead.svg               06
    ├── pm-approve.svg              07a
    ├── pm-caution.svg              07b
    ├── pm-reject.svg               07c
    ├── bullish_researcher.svg      08
    ├── bearish_researcher.svg      09
    ├── trader.svg                  10
    ├── aggressive_reviewer.svg     11
    ├── neutral_reviewer.svg        12
    ├── conservative_reviewer.svg   13
    └── memory_loop.svg             14
```

## Visual Spec

ViewBox per SVG:

- `0 0 220 190` (landscape, ~1.16:1)

Canonical head geometry (locked, identical across all variants):

- Shell: x=10 y=20 w=200 h=148 rx=54 — purple gradient `#4a2f8c → #2d1664 → #170a3f`, accent stroke width 2.5 (3.5 for PM)
- Face screen: x=24 y=34 w=172 h=120 rx=42 — dark radial `#060a1c → #02030a`
- Ears (2): x=4 / x=208, y=73, w=8, h=42, rx=4 — half-rounded (outer side rounded, inner side flat) — fill `#5a3aa8 → #2d1664` with accent-colored cyan center bar
- Feet (2): x=54 / x=138, y=161, w=28, h=14, rounded bottom only (`rx 0 0 14 14` equivalent path) — `#3a2275 → #1c0e4a`
- Outer glow: dual-layer drop shadow (4px / 10px) in accent color

NO antenna, NO mouth. Symbol-eyes carry all role identity.

Per-role accents (stroke + glow + symbol):

| ID                       | Role         | Hex       | Symbol                     |
| ------------------------ | ------------ | --------- | -------------------------- |
| 01 fundamental_analyst   | 基本面研究员 | `#6ba3d4` | $ dollar                   |
| 02 news_analyst          | 宏观新闻员   | `#e89464` | radar ping ((●))           |
| 03 chart_analyst         | 图表分析员   | `#d4b482` | K-line candle              |
| 04 onchain_analyst       | 链上数据员   | `#7dc488` | multi-node chain (4 nodes) |
| 05 research_lead         | 研究主管     | `#b59ee0` | magnifier 🔍               |
| 06 risk_lead             | 风险主管     | `#d47a92` | warning triangle ⚠         |
| 07a pm-approve           | PM · 批准    | `#6dd49a` | check ✓                    |
| 07b pm-caution           | PM · 警示    | `#fed500` | exclaim !                  |
| 07c pm-reject            | PM · 否决    | `#e87a76` | cross ✗                    |
| 08 bullish_researcher    | 多头研究员   | `#6dd49a` | caret-up ^ (raised)        |
| 09 bearish_researcher    | 空头研究员   | `#e87a76` | caret-down v               |
| 10 trader                | 交易员       | `#6dc4d4` | swap arrows ⇄              |
| 11 aggressive_reviewer   | 进攻审视员   | `#e89464` | bolt ⚡                    |
| 12 neutral_reviewer      | 中性审视员   | `#a8a8b8` | equal =                    |
| 13 conservative_reviewer | 保守审视员   | `#7aa8d4` | shield 🛡                  |
| 14 memory_loop           | 记忆回路     | `#9d8ed4` | loop ⟲                     |

Persona dimension mapping (teamRegistry.ts B.13 Stage 2):

| ID                    | riskBias     | focusStyle  | voiceTone  |
| --------------------- | ------------ | ----------- | ---------- |
| fundamental_analyst   | balanced     | data-heavy  | analytical |
| news_analyst          | balanced     | story-heavy | dramatic   |
| chart_analyst         | balanced     | data-heavy  | terse      |
| onchain_analyst       | balanced     | data-heavy  | analytical |
| research_lead         | balanced     | data-heavy  | analytical |
| risk_lead             | conservative | data-heavy  | skeptical  |
| pm (all states)       | balanced     | data-heavy  | terse      |
| bullish_researcher    | aggressive   | story-heavy | dramatic   |
| bearish_researcher    | conservative | contrarian  | dramatic   |
| trader                | aggressive   | data-heavy  | terse      |
| aggressive_reviewer   | aggressive   | contrarian  | dramatic   |
| neutral_reviewer      | balanced     | data-heavy  | terse      |
| conservative_reviewer | conservative | data-heavy  | skeptical  |
| memory_loop           | balanced     | data-heavy  | analytical |

Animation:

- Static SVGs use SMIL only for the news radar ping (continuous expansion).
- All other animations (eye blink 4.6s, idle float, ring expand, talking-state burst) are surfaced via wrapper CSS classes in HTML hosts, not baked into the SVG.

Typography:

- None. Identity carries through symbol-eye only.

## Design Intent

Inspiration / role feel:

- 14 角色 share the same calm command-room body so they read as one team; the symbol-eye is the entire identity surface.
- "符号即眼睛" — eyes ARE the function symbol. Two-eye layout is preserved for most variants; `onchain_analyst` uses a single full-width chain so the connection metaphor reads.
- PM intentionally fragments into 3 visible states (approve / caution / reject) so its decision moment carries weight in flow visualizations.

Claw 42 brand relation:

- All variants stay within the dispatch-console palette (purple shell + accent stroke + dark face screen).
- The accent is the agent's "voice color"; reusing it for the outer-glow halo gives constellations a clear team-color readability when zoomed out.

Single avatar vs variants:

- `bot-avatar-v1` remains the canonical base (PR #110).
- This v1 introduces a **landscape adaptation** with tiny ears + feet (locked in canonical-base.html). The portrait base from PR #110 is still authoritative; the landscape adaptation is layered on top for the dispatch-console UI and is the surface these 14 variants extend.

## Derivative Permission

Inherits from `bot-avatar-v1/README.md`.

Allowed:

- Color variants for role / state, as long as canonical purple shell + dark face + bright eye is recognizable.
- Symbol-eye replacements for new state (warning / success / offline / typing / etc.).
- State badges or small status indicators outside the head.
- Cropping for avatar, card, hero, favicon-like preview.

Not allowed without Dan review:

- Replacing the public site UI with these assets (this is design source; deployment goes through F + claw42 gate).
- Merging into the glossy main-page 3D robot style.
- Adding antennae back to the silhouette.
- Changing the public brand name split (`Claw 42` vs `claw42`).

Commercial scope:

- Cleared for Claw 42 owned product, marketing, internal docs, product UI derivatives.
- Not cleared as a standalone marketplace asset.

## Existing Derivatives

Canonical:

- `canonical-base.html` — the locked head/ears/feet shape that all 14 variants share. Pure CSS (no SVG body — the SVG export approximates it).

Variants:

- 16 `avatars/*.svg` exported above.
- `14-symbol-eyes.html` — animated HTML preview with full motion (eye blink, ring expand, float, radar ping, bolt flicker, memory spin).
- `avatars-gallery.html` — static SVG gallery for verification.

Non-canonical context:

- Earlier exploration files (`variants-batch1.html`, `variants-batch2.html`, `symbol-eyes-tryout.html`) are kept for traceability but superseded by `14-symbol-eyes.html`.

## Open Notes

- The SVGs do not include the canonical 3-ring breathing aura or the podium glow; both are CSS-only effects handled by the host page. SVGs are intended to be drop-in head avatars; the constellation halo is layered around them.
- For very small UI sizes (<40px), the dark face's radial gradient compresses to near-solid `#020308` — verify legibility of the symbol-eye stroke in that band.
- `onchain_analyst` uses one full-width chain rather than two separate symbol-eyes. This is the only variant that breaks the two-eye convention; reason: connection-metaphor needs to span. If this conflicts with downstream constellation layout, fall back to 2 hex-nodes (1 per eye position) instead.
- PM's 3 states are visually distinct enough to be used as instant decision indicators in flow sequences. Color also drives the surrounding ring/glow tint, not just the symbol fill.
- For Hero/Flow CSS integration (B 选项): the CSS `.core` system in `canonical-base.html` is the source of truth. Variant translation = swap inside-face symbol DOM + override `--accent` / `--accent-rgb` custom properties. No need to fork the head CSS.
- Animation timing budget (per-role default):
  - eyeBlink 4.6s (or radarPing 2.2s for news)
  - coreFloat 5.4s (bob -8px)
  - ringExpand 4s (3 staggered)
  - Talking burst: 1.2s overlay (TBD in §3 Hero details)

Next sections of this design spec:

- ② Hero/Flow CSS-vs-SVG decision (recommendation pending)
- ③ Hero focus-frame / typing-dots / expression-switch spec
- ④ 6-step interaction sequence timing
