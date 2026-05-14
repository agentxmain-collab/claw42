# ADR 0009: Watch Follow Stats Privacy Boundary

## Status

Accepted

## Context

Watch V9 has a placeholder follow interaction for public proof-of-interest. It is not true trade execution and does not require login yet, but it still needs stable idempotency so one anonymous browser cannot inflate follow counts by repeated clicks.

## Decision

- Use an HTTP-only `claw42-anon-id` cookie for anonymous idempotency.
- Set cookie max age to 7 days, `SameSite=Lax`, and `Secure` in production.
- Never store the raw anonymous id in KV.
- Store follower membership as `sha256(serverSalt + ":" + anonId)` in the record-specific follower set.
- Use the same salted hash for anonymous-id mutation rate-limit keys; do not put the raw cookie value in KV keys.
- Use the same salted hash for IP mutation rate-limit keys; do not put the raw IP address in KV keys.
- Expire the follower set after 7 days to align storage retention with the anonymous cookie lifetime.
- Keep public API responses limited to `watchCount`, `followCount`, and the current browser's `userFollowed` boolean.
- Apply mutation rate limits on both IP and anonymous id before writing follow stats.

## Consequences

**Benefits**:

- Follow clicks are idempotent per anonymous browser.
- Stored membership values are salted hashes rather than raw identifiers.
- Retention is short and aligned with the current placeholder interaction.

**Costs**:

- The browser cookie is still a user-facing tracking surface and needs public copy before external release.
- Counts are interest signals only; they are not trading execution, account identity, or conversion metrics.

**Reversibility**: High. Replace the anonymous cookie with signed user identity when true follow execution is designed and approved.

## Related

- `src/app/api/watch/follow-stats/route.ts`
- `src/lib/watch/followStatsStore.ts`
- `docs/codex-specs/spec-watch-phase-b-real-agent-pipeline.md`
