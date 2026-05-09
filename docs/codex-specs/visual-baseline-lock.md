# Visual Baseline Lock

Purpose: prevent preview, production, or PR merge work from drifting away from the user-approved visual baseline.

## Current Approved Baseline

- Approved production deployment: `dpl_E8dF348ZEU7F9dVXyRE71BbEuimB`
- Approved source preview deployment: `dpl_BTXDqJ5LNzac9o129tD5GWe1LSSC`
- Approved visual commit: `7ff6afc7eed3646d272dc312d565280ac2840568`
- Approval context: Phase 4 visual followups plus Phase 5 icon sizing, verified on `https://claw42.ai/zh_CN`.

## Required Gate

Before any Claw42 visual PR merge, staging deployment, production deployment, or production promotion, verify that the target base includes the approved visual commit:

```bash
git fetch origin main
git merge-base --is-ancestor 7ff6afc7eed3646d272dc312d565280ac2840568 origin/main
```

- Exit `0`: continue.
- Non-zero exit: stop. Do not deploy or merge followup visual work until the approved baseline has been merged into the target base.

## Reporting

Every visual deployment report must include:

- source branch and source commit
- target base commit
- whether the approved visual commit is an ancestor of the target base
- deployment id and URL
