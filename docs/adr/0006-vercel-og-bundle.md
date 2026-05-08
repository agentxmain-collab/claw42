# ADR 0006: Vercel OG Bundle

## Status

Accepted

## Context

Debate cards need shareable images for social distribution. Generating static PNG files for every debate would require storage and cleanup logic that is outside the current preview scope.

## Decision

- Add `@vercel/og` and implement dynamic OG generation through `next/og`.
- Keep the share image server-side only.
- Use a simple branded layout that does not depend on external image fetches.

## Consequences

**Benefits**:

- Debate links can produce share images without pre-rendered assets.
- No Blob storage or image cleanup job is required.

**Costs**:

- Adds server-side rendering bundle surface.
- The first request for an OG image may have generation latency.

**Reversibility**: Medium. Remove the OG route and dependency if share images move to a separate service.

## Related

- task-15 news debate mode
- `src/app/api/og/debate/[id]/route.tsx`
