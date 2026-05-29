# Parked Features Registry

This registry preserves feature lines that were simplified, bypassed, or folded into a
newer product path during the 2026-05 round-12/Phase-X work. It is intentionally broad:
if Dan later wants to restore a richer behavior, the tag gives a stable starting point.

Current production snapshot:

- Commit: `7d7106f36031146cc799997a77536ff16cc76823`
- Tag: `prod-snapshot-2026-05-29-cron-deeplink-shipped`

## Registry

| Feature                                     | Product behavior preserved                                                                                                                            | Tag                                         | Commit    | Why it was simplified or parked                                                                                                                                                                   | Re-add path                                                                                                                                                                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full resident multi-agent lanes             | Global market overview and hotspot resident lanes, resident prewarm candidates, and the fuller PM job path before the simple pipeline became default. | `parked/full-resident-multi-agent-pre-slim` | `dc91ba1` | Dan redirected the public feed toward news-driven single-card output and away from global market/hotspot cards. Current code still keeps full-mode files, but production defaults to simple mode. | Start from this tag, compare `src/app/api/cron/strategy-replay/route.ts`, `src/lib/watch/residentPrewarm.ts`, and `src/lib/team/pmDecisionJobRunner.ts`; restore behind an explicit product gate, not as the default feed. |
| Simple three-track transition               | First simple pipeline cut that still coexisted with resident/full behavior in a transition shape.                                                     | `parked/simple-three-track-transition`      | `3684d30` | Later v5 work removed the three-track framing and made the simple path news-driven.                                                                                                               | Use for diffing how simple/full routing was introduced; cherry-pick only routing or test scaffolding that still matches current product intent.                                                                            |
| News-driven card v5 baseline                | First v5 news-driven single-card implementation with `SIMPLE_PIPELINE_CARDS_PER_RUN=5`, bounded LLM batches, and canonical news dedupe helpers.       | `parked/news-driven-card-v5-baseline`       | `5500955` | This behavior became the active direction, then received follow-up fixes for model output, staging, public-card storage, shell, and deeplink issues.                                              | Use as the baseline when investigating regressions in news-driven candidate generation or canonical dedupe. Prefer current main for production fixes.                                                                      |
| Round-12 architecture slim final branch tip | Public card index persistence, rebackfill route, and storage failure surfacing from the branch that replaced the earlier architecture plan.           | `parked/round12-architecture-slim-final`    | `6b82033` | Branch is now merged into main and can be deleted, but the branch tip is useful as an audit anchor for the round-12 pivot.                                                                        | Use this tag when debugging public-card index/rebackfill behavior or reconstructing the exact branch tip after branch cleanup.                                                                                             |
| Open strategy cards                         | Public cards that expose open strategy state before later closure/directional filters and deeplink consolidation.                                     | `parked/phase1-strategic-open-cards`        | `0f31caa` | Later product direction prioritized closed directional cards and safer public trade surfaces.                                                                                                     | Compare `src/modules/agent-watch` and strategy card tests from this tag if Dan wants an explicit open-strategy lane again.                                                                                                 |
| Cron health diagnostics                     | Cron health and replay diagnostics added before later production freshness fixes.                                                                     | `parked/phase1-5-cron-health-diagnostics`   | `cb3ca59` | The diagnostics were merged, while branch ownership can be cleaned up.                                                                                                                            | Use as the stable restore point for cron health report behavior if current ops reporting drifts.                                                                                                                           |
| CoinW price resolution for open strategies  | Resolution of open strategies with CoinW prices before the later direct futures deeplink consolidation.                                               | `parked/phase2-coinw-price-resolution`      | `a5a94c7` | Current product moved to symbol-derived CoinW futures links and simpler public CTA behavior.                                                                                                      | Use for price-resolution logic archaeology, especially if CoinW execution validation returns to a richer strategy state.                                                                                                   |
| CoinW shell fidelity branch                 | CoinW shell header/footer fidelity before Stage 4 vector asset and spacing follow-up batches.                                                         | `parked/coinw-shell-fidelity`               | `88ed387` | Later commits refined the shell and shipped the dual-shell setup.                                                                                                                                 | Use this tag to compare the final Stage 4 shell against the earlier fidelity pass. Current shell rebuild instructions live in `docs/dual-shell-reference.md`.                                                              |
| UI round 4 animation/anode experiment       | Earlier robot/anode animation work that remains on an unmerged preserved branch.                                                                      | `feature/c-line-ui-uplift-v1-round4`        | `71b88c8` | The branch is intentionally not deleted because it is not merged to main and may contain visual experiments Dan still wants to inspect.                                                           | Keep the branch. If revived, rebase separately and verify against the current shell and hero structure.                                                                                                                    |

## Current Simplification Contract

- Production defaults to the simple pipeline unless `PIPELINE_MODE=full` is explicitly set.
- The public card feed is news-driven: one card should be anchored to one canonical news
  item, with CoinW futures links derived mechanically from symbol codes.
- The older resident market/hotspot lanes are preserved as history and partial code paths,
  but are not the current public feed contract.
- Branch deletion is safe only after the tags above are pushed and this registry is present
  on the cleanup branch/main history.

## Do Not Delete Without Dan Approval

Keep these branches until Dan explicitly approves their cleanup:

- `feature/c-line-ui-research`
- `feature/c-line-ui-uplift-v1-round4`
- `feature/c-series-4-spec-round1-eval`
- `feature/prod-v12-coverage-backfill-hardening`
- `feature/stage5_prep`
