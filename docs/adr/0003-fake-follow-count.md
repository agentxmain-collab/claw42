# ADR 0003: Fake Follow Count for Debate Strategies

## Status

Accepted

## Context

Task-15 needs visible social proof for generated strategy cards before a real user account system and order-following data exist. Showing empty counters makes the debate mode feel unfinished, while storing fabricated user actions would create audit risk.

## Decision

- Use a deterministic pseudo-count derived from strategy id and creation time.
- Label it as presentation metadata only; do not persist it as user behavior.
- Replace this algorithm when real account and follow data are available.

## Consequences

**Benefits**:

- Strategy cards feel alive in preview without a database dependency.
- The value is reproducible, so screenshots and replays remain stable.

**Costs**:

- The count is not a real adoption metric.
- Product copy must avoid claiming real users followed the strategy.

**Reversibility**: High. Remove `fakeFollowCount.ts` and read counts from the future user event table.

## Related

- task-15 news debate mode
- `src/lib/fakeFollowCount.ts`
