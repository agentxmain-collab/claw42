# B48-B51 Ledger Stability Plan

Date: 2026-05-18

## Goal

Harden the private ledger and ops-health layer so long-running B-line analysis does not flap or
hide stuck runs.

## Scope

1. Stable ledger ordering
   - Add deterministic tie-breakers to PM job and decision-run ledger reads.
   - Prevent same-timestamp records from changing order based on local file or KV list iteration.

2. Run-level stale signal
   - Extend ops-health beyond queue stale detection.
   - Surface stale `running` decision-run records as critical, because a run can hang even when the
     queue job state is not the first visible symptom.

3. Quality trend fields
   - Add scored-run count, publishable count, and average quality score to the protected
     ops-health summary.
   - Keep the endpoint protected and no-store.

## Verification

- Red tests first for stable job ordering, stable run ordering, stale run signal, and quality trend
  fields.
- Targeted green tests for ledger and ops-health modules.
- Full B-line gate before PR:
  - `npm run test:watch-pipeline`
  - `npm run verify`
  - `npm run build`
  - `npm run verify:metrics`
  - `npm run verify:a11y`

## Production Boundary

No production deploy or Vercel CLI deploy. Changes are internal data ordering and protected
diagnostics only.
