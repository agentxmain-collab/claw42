# ADR 0004: Strategy Replay Cron

## Status

Accepted

## Context

News debate mode creates short-lived strategy suggestions. A daily replay job is needed to evaluate prior suggestions and show whether the Agent views held up after the market moved.

## Decision

- Add `vercel.json` with one Vercel Cron entry for `/api/cron/strategy-replay`.
- Protect the route with `CRON_SECRET` when the secret is configured.
- Keep the replay store in memory for preview scope; persistent storage is deferred.

## Consequences

**Benefits**:

- Gives the Watch page a lightweight feedback loop.
- Keeps task-15 deployable without adding a database.

**Costs**:

- In-memory replay data resets on function cold start and deploy.
- Production-quality statistics require persistence in a later task.

**Reversibility**: Medium. Removing the cron stops replay updates but does not affect the landing page or live watch feed.

## Related

- task-15 news debate mode
- `vercel.json`
- `src/app/api/cron/strategy-replay/route.ts`
