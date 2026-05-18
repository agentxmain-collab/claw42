# B39-B42 Quality Ops Next Plan

Goal: continue B-line cleanup and stability without touching A-line public preview or production.

## Scope

- B39: make ops-health directly actionable with `status`, severity, and remediation hints.
- B40: add a public payload quality regression corpus for the exact leak and stage-gap classes that caused recent hotfixes.
- B41: document the operator runbook for queue/cron health without adding a public UI surface.
- B42: wire the new regression corpus into `npm run test:watch-pipeline` so it is part of the normal B-line gate.

## Guardrails

- No `--prod`, no production promote, no `claw42.ai` alias change.
- No A-line preview work.
- No V10 layout or hero changes.
- No pipeline behavior change beyond health summary shape and tests.
- Ops endpoint remains protected and read-only.

## Checklist

- [x] Add health status and alert details to `decisionOpsHealth`.
- [x] Extend ops-health summary tests.
- [x] Add decision quality regression corpus.
- [x] Add corpus test to `npm run test:watch-pipeline`.
- [x] Add watch ops health runbook.
- [ ] Run targeted tests.
- [ ] Run full verify gates.
- [ ] PR, checks, merge, preview smoke.
