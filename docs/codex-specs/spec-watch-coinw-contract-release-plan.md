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

## 2026-05-20 Beta1 Completion Criteria

Beta1 is the public analysis beta for CoinW futures traffic. It must be usable for outside review
without implying real order submission.

Completed scope:

- Public symbol cards are restricted to confirmed CoinW futures instruments.
- Unsupported symbol records are dropped from the public beta timeline and board instead of being
  rendered as watch-only cards.
- Market overview and hotspot cards remain visible because they are product-level analysis, not
  symbol execution opportunities.
- Market overview and hotspot cards render as analysis-only: no automatic order claim and no
  follow-trade button.
- Public labels now say "analysis only / no automatic order" instead of watch-only phrasing.
- CoinW futures navigation is present; exact pair-level URL still waits for CoinW confirmation and
  falls back to a safe futures market landing URL.
- Existing UTC resident prewarm posture remains the source for global market/hotspot freshness.

Beta1 still requires an operations-level preview access decision before sharing broadly if Vercel
preview protection blocks external reviewers. This is outside application code.

## 2026-05-20 Beta2 Partial Foundation

Beta2 is the one-click futures order path. Real submission remains disabled, but the safe foundation
is now in place:

- `/api/watch/follow-intents` validates a CoinW futures order draft and returns a disabled intent
  without calling CoinW.
- `thirdOrderId` uses the `claw42_<intent_id>_<attempt>` source-marking pattern.
- `COINW_FUTURES_BETA_MAX_LEVERAGE` caps beta leverage; default is 3x.
- `/api/watch/follow-intents/status` reports whether OAuth/test-account/order-mode prerequisites
  are configured, without exposing secret values.
- Live mode remains blocked until a separate release decision.

Beta2 external information still needed:

1. OAuth authorization URL, token URL, exact callback registration, and required scope names.
2. Confirmation that the first release can use futures-trade-only scope with no withdrawal
   capability.
3. Test OAuth app and test futures account details.
4. Stable CoinW futures deep-link template for pair-specific contract pages.
5. `thirdOrderId` duplicate behavior on retry.
6. Whether take-profit / stop-loss can be submitted with the order or require separate calls.
7. Instrument precision, minimum quantity, minimum notional, and max leverage field source.
8. Whether margin mode, position mode, or leverage must be set before order placement, plus exact
   endpoints.
9. Order status query response, accepted-vs-filled semantics, and receipt fields.
10. OAuth revoke / token invalidation / optional webhook behavior.
11. Rate limits for OAuth and futures order APIs.
12. Emergency disable process for the Claw 42 OAuth app.
