# ADR 0005: Recharts Bundle Impact

## Status

Accepted

## Context

Task-15 strategy cards need a compact price path visualization. A custom SVG chart would reduce dependencies but would increase component-specific chart logic.

## Decision

- Add `recharts` for `StrategyMiniChart`.
- Use it only inside debate cards, not in the landing hero.
- Revisit bundle impact when Lighthouse and size-limit are added.

## Consequences

**Benefits**:

- Faster implementation of a readable mini-chart.
- Keeps chart behavior accessible and maintainable.

**Costs**:

- Adds client bundle weight to the Watch page.
- Needs P1 bundle monitoring before production-scale expansion.

**Reversibility**: Medium. Replace `StrategyMiniChart` with a local SVG sparkline if bundle size becomes a blocker.

## Related

- task-15 news debate mode
- `src/modules/agent-watch/components/StrategyMiniChart.tsx`
