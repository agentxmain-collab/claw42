# Watch Ops Health Runbook

Date: 2026-05-18

Scope: B-line watch decision operations only. This runbook is for preview/main diagnostics and does not change production routing.

## Protected Endpoint

- Route: `GET /api/watch/ops-health?locale=zh_CN&limit=100`
- Auth: `Authorization: Bearer <OPS_HEALTH_SECRET>` or `x-claw42-ops-secret: <OPS_HEALTH_SECRET>`
- Fallback auth: `CRON_SECRET` is also accepted for server-side smoke checks.
- Cache: `no-store`

Do not expose the response in public UI. It includes queue and run health intended for operators.

## Status Model

- `healthy`: no active alerts.
- `degraded`: retry backlog, overdue retry, or public quality blocking needs attention but does not prove the pipeline is stuck.
- `critical`: stale running jobs, exhausted failed jobs, or failed decision runs need immediate inspection before increasing cadence or widening candidate count.

## First Checks

1. Confirm production is still locked to `release-locked` before any deploy-related action.
2. Check `status` and `alertDetails`.
3. If `queue_stale_running` appears, inspect the queue consumer and job lease timing before replaying jobs.
4. If `queue_exhausted` appears, inspect `lastError` in the job record before manual replay.
5. If `quality_blocking` appears, inspect `quality.warningCounts`; do not weaken prompts or guardrails until the blocker type is clear.

## B-line Regression Gates

The quality corpus is part of `npm run test:watch-pipeline`:

```bash
npx vitest run src/lib/team/__tests__/decisionQualityRegressionCorpus.test.ts
```

It specifically guards against:

- backend status wording leaking into public payloads;
- internal `TeamMemberId` strings leaking into public payloads;
- public stage traces skipping earlier required stages;
- watch-only market records being blocked only because they have no trade card.

## Non-goals

- No production promotion.
- No Vercel project relink.
- No public UI mount for ops diagnostics.
- No automatic replay from the diagnostics route.
