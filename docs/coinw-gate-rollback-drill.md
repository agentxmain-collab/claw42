# CoinW Trade Gate Rollback Drill

This drill is for staging / preview verification only unless Dan explicitly authorizes a production
Gate change.

## Gate 1 rollback

Goal: keep Claw42 in external navigation mode with no hosted confirmation and no API submission.

Expected config:

- `COINW_FUTURES_ORDER_MODE=disabled`
- `COINW_TRADE_GATE=gate1`

Mechanical verification:

- `/api/watch/follow-intents/status` returns `realSubmissionEnabled=false`
- `tradeGate.externalNavigationEnabled=true`
- `tradeGate.hostedConfirmationEnabled=false`
- `tradeGate.directSubmitEnabled=false`

## Gate 2 rollback

Goal: turn off hosted confirmation test mode and return to Gate 1.

Rollback config:

- set `COINW_TRADE_GATE=gate1`
- set `COINW_FUTURES_ORDER_MODE=disabled`

Mechanical verification:

- `/api/watch/follow-intents/status` returns `orderSubmissionMode=disabled`
- `/api/watch/follow-intents/status` returns `realSubmissionEnabled=false`
- hosted confirmation callback routes may still read old audit rows, but no new submit-capable
  handoff should be created.

## Production guard

Do not apply Gate 2 / Gate 3 / Gate 4 in production without Dan's explicit release instruction.
