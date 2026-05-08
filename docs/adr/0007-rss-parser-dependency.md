# ADR 0007: rss-parser Dependency for News SourceChain

## Status

Accepted

## Context

Task 17 replaces a single news source with a multi-source chain. Three fallback sources are RSS feeds (CoinDesk, Cointelegraph, Decrypt). Hand-written RSS parsing would add fragile XML handling and inconsistent feed edge cases.

The project dependency policy requires explicit tracking for new dependencies. Dan pre-approved this dependency path in task-17, with the Murphy SCA scan to be run after the Stage 1 dependency-change sync block.

## Decision

- Add `rss-parser@^3.13.0`.
- Use one parameterized RSS adapter for all RSS endpoints.
- Keep RSS usage server-side only.
- Display only title, source, URL, and short derived metadata; do not ingest or render full article bodies.

## Consequences

**Benefits**

- Avoids custom XML/RSS parsing.
- Keeps three RSS fallbacks on the same adapter contract.
- Reduces maintenance cost when adding new RSS sources.

**Costs**

- Adds one runtime dependency and lockfile churn.
- Requires dependency-policy tracking and Murphy SCA scan before mainline release.

**Rollback**

Remove `rss-parser`, disable RSS source configs in `NEWS_SOURCE_REGISTRY`, and let SourceChain fall back to API sources plus mock.

## References

- `dependency-policy.md`
- `docs/airy-tasks/task-17-news-source-multi-chain.md`
