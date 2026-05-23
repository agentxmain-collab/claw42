# Claw42 Phase 1 Production Rollback - 2026-05-23

## Snapshot

- Production alias: `https://claw42.ai`
- Pre-release deployment id: `dpl_E8dF348ZEU7F9dVXyRE71BbEuimB`
- Pre-release deployment URL: `https://claw42-site-65efzkqoa-agentxmain-collabs-projects.vercel.app`
- Pre-release git commit: `8753f2ce40b197ba86e0d5d98766f02320c019d3`
- Pre-release git tag: `prod-snapshot-2026-05-23-pre-phase1`
- Vercel scope: `agentxmain-collabs-projects`

## Fast Rollback

Promote the known-good deployment artifact back to production:

```bash
npx vercel promote dpl_E8dF348ZEU7F9dVXyRE71BbEuimB --scope agentxmain-collabs-projects
```

If the deployment id lookup fails, promote the deployment URL:

```bash
npx vercel promote https://claw42-site-65efzkqoa-agentxmain-collabs-projects.vercel.app --scope agentxmain-collabs-projects
```

## Verify

```bash
npx vercel inspect https://claw42.ai --scope agentxmain-collabs-projects
curl -sI https://claw42.ai | head -20
```

Expected production deployment id after rollback:

```text
dpl_E8dF348ZEU7F9dVXyRE71BbEuimB
```

## Git Fallback

Only use this if the deployment artifact cannot be promoted:

```bash
git fetch origin --tags
git checkout prod-snapshot-2026-05-23-pre-phase1
npx vercel deploy --prod --scope agentxmain-collabs-projects --yes
```

## Notes

- This runbook only targets `claw42.ai`.
- Do not touch `ai.coinw.com` or CoinW GitLab from this rollback path.
- Do not rotate or expose secrets in rollback logs.
