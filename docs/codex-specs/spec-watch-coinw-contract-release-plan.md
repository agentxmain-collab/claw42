# CoinW Contract Release Plan

## Goal

Build a publishable Claw42 analysis beta focused on CoinW futures conversion:
global market overview, hotspot narrative, daily CoinW futures coin analysis, and a controlled path toward one-click futures order submission.

## Product Rules

- CoinW futures is the only executable market for this release.
- Symbols that are not confirmed CoinW futures instruments must not enter the public main analysis card list.
- Market overview and hotspot cards are analysis-only and can link to CoinW, but they must not render follow-trade/order buttons.
- Symbol cards can become executable only when the symbol is confirmed by the CoinW futures instrument universe.
- Real order submission stays behind explicit user confirmation, server-side API handling, idempotency, audit logs, and beta gating.

## Phase A — Futures Universe

- Add a CoinW futures instrument parser and fetcher for `/v1/perpum/instruments`.
- Add a conservative static fallback for core symbols when the public endpoint is unavailable.
- Filter candidate pools to confirmed futures symbols only.
- Preserve market data fallback behavior without letting unknown symbols become executable.

## Phase B — Public Analysis Stability

- Keep the public board composed of one market overview, one hotspot, and three to five futures symbol analyses.
- Keep deterministic sorting and dedupe by public lane.
- Keep UTC resident prewarm policy for market and hotspot.
- Extend public beta gates to flag missing futures symbol coverage.

## Phase C — CoinW Navigation

- Add a futures deeplink builder for confirmed symbols.
- Market and hotspot link to CoinW futures entry points.
- Symbol cards link directly to the symbol futures page when the URL pattern is confirmed; otherwise use a safe futures market landing URL.

## Phase D — Controlled Futures Order Path

- Add trade intent and confirmation contracts for futures orders.
- Use `thirdOrderId` with `claw42_` prefix for source tracking and duplicate protection.
- Keep real submission disabled unless test-account credentials and idempotency behavior are verified.
- Store local audit summaries without writing secrets or raw API credentials.

## Open CoinW Confirmations

- Confirm `thirdOrderId` duplicate behavior.
- Confirm precision and minimum order fields as the final source of truth.
- Confirm stable futures trading deeplink pattern.
- Confirm whether CoinW supports an additional internal source field beyond `thirdOrderId`.
