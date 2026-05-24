# Claw42 Phase 1 Production Release v11 - Update Loop Hotfix

## Scope

- Target: `https://claw42.ai`
- PR: `#194`
- Branch: `feature/prod-v10-llm-provider-hotfix`
- Vercel scope: `agentxmain-collabs-projects`
- Purpose: restore the update loop so production cron and visit-triggered refresh can write fresh watch records.

## Release

Merge PR `#194` by the approved production path. Do not change production environment variables, KV records, or aliases as part of this hotfix.

## Manual Cron Run

Use the Vercel dashboard instead of a browser URL with a secret:

1. Open Vercel project `claw42-site`.
2. Open Cron Jobs.
3. Run `/api/cron/strategy-replay`.

Expected result:

- The request returns 200.
- Response includes `ok: true`.
- Response includes `generatedPmDecisions > 0` or `residentPrewarmGenerated > 0`.
- `/api/watch/timeline?locale=zh_CN` shows a fresh market, hotspot, or symbol decision.

## Five-Minute Verify

After merge and deployment are ready:

```bash
npx vercel inspect https://claw42.ai --scope agentxmain-collabs-projects
npx vercel logs https://claw42.ai --scope agentxmain-collabs-projects --since 30m
```

Then verify in the dashboard:

- Cron no longer returns 504.
- DeepSeek failures, if any, are per-model logs and do not end the whole provider chain before the stable `deepseek-chat` fallback.
- New watch records appear in the public timeline after cron or page refresh.

## Rollback Trigger

Rollback if the first post-release cron run still returns 504 or no fresh watch record can be observed after the run completes.

Rollback path:

```bash
npx vercel promote dpl_E8dF348ZEU7F9dVXyRE71BbEuimB --scope agentxmain-collabs-projects
```

See `docs/runbooks/prod-rollback-2026-05-23-phase1.md` for the full rollback runbook.

## Non-Goals

- Do not improve model quality in this release.
- Do not rotate or print secrets.
- Do not clear KV.
- Do not change CoinW trade gates.
