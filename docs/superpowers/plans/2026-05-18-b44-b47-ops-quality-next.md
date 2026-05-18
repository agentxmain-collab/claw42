# B44-B47 Ops Quality Next Plan

Date: 2026-05-18

## Goal

Continue the B-line internal quality layer without touching production, public layout, candidate
ranking, PM pipeline execution, or A-line preview work.

## Scope

1. B44 queue readiness
   - Expose whether PM decision jobs are running inline or through the durable queue.
   - Keep queue execution opt-in only through `PM_DECISION_QUEUE_ENABLED=true`.

2. B45 protected ops details
   - Extend the protected `/api/watch/ops-health` endpoint with optional bounded recent job/run
     details.
   - Preserve authorization and `no-store` behavior.

3. B46 low-output alert foundation
   - Surface succeeded jobs that produced zero public records as a degraded ops signal.
   - Do not auto-retry or change PM execution semantics in this batch.

4. B47 memory loop quantification
   - Add a compact learning signal to memory-loop context.
   - Keep no-history and KV-unavailable public-output guardrails intact.

## Verification

- Red tests first for queue readiness, ops details, zero-output alert, and memory learning signal.
- Targeted green tests for changed modules.
- Full B-line gate before PR:
  - `npm run test:watch-pipeline`
  - `npm run verify`
  - `npm run build`
  - `npm run verify:metrics`
  - `npm run verify:a11y`

## Production Boundary

Production is not touched. Remote preview/deploy actions use GitHub/Vercel webhook only; local Vercel
CLI is not used because the current CLI identity is not the Claw42 project identity.
