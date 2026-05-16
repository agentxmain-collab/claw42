# Bot Avatar v1

Canonical Claw 42 dispatch-console robot head asset. This archive is source-only metadata plus exported rasters for future F / Codex use. It does not replace or integrate any site UI.

## Files

- `source/bot-base.svg` — canonical editable SVG source. Main shapes are vector paths; no embedded raster image.
- `source/bot-base@1024-transparent.png` — 1024 x 1024 PNG export with transparent background.
- `source/bot-base@1024-bg.png` — 1024 x 1024 PNG export with the dark purple background included.
- `source/figma-link.txt` — Figma source status. No Figma link exists for this intake.
- `color-tokens.json` — machine-readable color tokens for future variants.

## Visual Spec

ViewBox:

- `0 0 1024 1024`

Geometry:

- Background plate: rounded square path approximating `rx=82`, inset 16 px from canvas.
- Bot shell: rounded head/body path, x `263`, y `204`, width about `498`, height about `571`.
- Screen: enlarged rounded rectangle path, x `310`, y `304`, width about `404`, height about `374`.
- Eyes: two vertical ellipses, left center `430,493`, right center `594,493`, radius `31 x 47`.
- Side modules: slim rounded blue side pods at x `240-304` and `720-784`.
- Antenna: intentionally absent.
- Mouth: intentionally absent.

Core colors:

- Purple body: `#6d4be8`, `#4320a8`, `#2d1578`, `#1a0b45`
- Lime/yellow outline: `#bfff32`
- Blue side module stroke: `#4a83d8`
- Screen black: `#111421`, `#050812`, `#02040a`
- Blue eyes: `#97ecff`, `#63d8ff`, `#1597d4`
- Deep purple/black background: `#24124f`, `#12091f`, `#080610`
- Ambient purple: `#5030c8`

Effects:

- Outer glow filter: lime drop shadow `stdDeviation=6`, opacity `0.92`; purple drop shadow `stdDeviation=18`, opacity `0.46`; black depth shadow `dy=26`, `stdDeviation=28`, opacity `0.55`.
- Screen glow filter: blue glow `stdDeviation=14`, opacity `0.24`; black lower shadow `dy=12`, `stdDeviation=20`, opacity `0.62`.
- Eye glow filter: cyan glow `stdDeviation=10`, opacity `0.74`; blue outer glow `stdDeviation=22`, opacity `0.26`.
- Screen scanlines: cyan `#5ee2ff`, stroke width `2-3`, opacity `0.22`, clipped to screen.
- Shell stroke: `#bfff32`, stroke width `12`.
- Side module stroke: `#4a83d8`, stroke width `10`.

Typography:

- None. This is an icon/mascot element and contains no text.

## Design Intent

Inspiration:

- The asset comes from the Claw 42 dispatch-console visual direction: black-purple trading console, radar/network glow, compact agent avatar, and high-contrast neon status language.
- It intentionally keeps the original purple console robot family instead of adopting the separate glossy 3D main-page robot.

Role feel:

- Calm command-room agent.
- Lightweight, intelligent, and system-native rather than cute consumer mascot.
- The enlarged face screen makes it read better at small UI sizes and gives future states more room.

Claw 42 brand relation:

- Uses the dispatch-console palette: purple system shell, lime signal outline, cyan AI eyes, deep black-violet background.
- The lime outline links the bot to Claw 42's live/status accents.
- Public naming should remain `Claw 42`; technical asset naming may use `claw42` / `bot-avatar-v1`.

Single image vs variants:

- This file is the canonical base avatar.
- Expected variants can derive from this base for role, expression, state, or placement, but should preserve the enlarged screen, no-antenna silhouette, and purple/lime/cyan console identity.

## Derivative Permission

F and future Codex sessions may create variants from `source/bot-base.svg`.

Allowed:

- Color variants for role/state, as long as the base Claw 42 console palette remains recognizable.
- Eye expression variants, including idle, thinking, warning, success, and offline.
- State badges or small status indicators.
- Cropping for avatar, card, hero, favicon-like preview, and social image use.
- Transparent, background, monochrome, and reduced-detail exports.

Not allowed without Dan review:

- Replacing the public site UI with this asset.
- Merging it into the glossy main-page 3D robot style as the canonical brand mascot.
- Adding antennae back to the base silhouette.
- Changing the public brand name split between `Claw 42` and `Claw42`.
- Using it for production release decisions without the normal claw42 deployment gate.

Commercial scope:

- Cleared for Claw 42 owned product, marketing, internal docs, and product UI derivatives.
- Not cleared as a standalone marketplace asset, stock asset, or third-party brand mascot without separate approval.

## Existing Derivatives

Canonical:

- `bot-base` — no-antenna purple robot head with enlarged screen face and two cyan eyes. This is the canonical v1 source.

Exports:

- `bot-base@1024-transparent` — transparent PNG export for overlays, UI composition, and Figma import.
- `bot-base@1024-bg` — PNG export with the dark purple background, for quick preview or docs.

Non-canonical context from exploration:

- Earlier conversation generated a full hero/network composition and a single-element preview. Those informed this base asset but are not archived here as canonical derivatives.

## Open Notes

- No Figma source exists yet. If F imports this SVG, write the resulting Figma URL back to `source/figma-link.txt`.
- The SVG includes the background as a named `background` path so the same source can export both background and transparent variants. For transparent use, hide `background`, `ambient-glow`, and `ground-shadow`.
- The asset is optimized for dark Claw 42 console surfaces. A light-background adaptation should add a darker keyline or shadow pass before use.
- At very small sizes below 40 px, the screen scanlines should be hidden and the eye glow reduced to avoid blur.
- Variant naming should follow `bot-{state}-{size}` or `bot-{role}-{state}` and should identify one canonical base per generation.
