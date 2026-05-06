# ADR 0008: CryptoPanic Standby Mode

## Status

Accepted

## Context

Task 15 used CryptoPanic as the single news intake source. Task 16 research found that relying on one provider is the product fragility, regardless of whether CryptoPanic's free/developer API discontinuation notice is verified. Dan will separately verify the notice wording before deciding whether CryptoPanic should be removed entirely.

## Decision

- Keep the CryptoPanic adapter.
- Move CryptoPanic to `status: "standby"` in `NEWS_SOURCE_REGISTRY`.
- Do not include standby sources in the default SourceChain.
- Allow standby activation only through `NEWS_ENABLE_STANDBY_SOURCES=1`.
- Delete the legacy direct `src/lib/api/cryptopanic.ts` entrypoint so production code consumes SourceChain consistently.

## Consequences

**Benefits**

- Removes single-provider dependency from the debate pipeline.
- Keeps a fast rollback path if primary/fallback providers underperform.
- Avoids prematurely deleting integration code before Dan verifies the external notice.

**Costs**

- Requires one extra env var and verify checks for standby behavior.
- CryptoPanic-specific fields are no longer part of the default mock path.

**Rollback**

Set `NEWS_ENABLE_STANDBY_SOURCES=1`, or promote CryptoPanic back to `active` in `NEWS_SOURCE_REGISTRY` if Dan explicitly decides to use it again.

## References

- `docs/airy-tasks/task-17-news-source-multi-chain.md`
- `docs/research/news-source-evaluation-by-claude.md`
