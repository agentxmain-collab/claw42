# Watch V9 Internal Verification Checklist

Use this checklist for B-line engineering validation only. It is not an external preview checklist and it does not imply a production release.

## Scope Labels

- **B local**: local worktree validation for real topic, news, PM decision, replay, and V9 adapter behavior.
- **B preview**: non-production Vercel preview for internal validation with real data paths.
- **A preview**: external showcase preview with approved UI/interaction and curated demo data.
- **Production**: `claw42.ai`, released only after a separate Dan approval.

## Hard Stops

- Do not deploy with `--prod`.
- Do not share a B preview URL as an external demo.
- Do not enable true follow execution.
- Do not print secrets or API keys while checking news-source readiness.
- If Vercel project identity, branch, or scope is unclear, stop and verify deployment identity before deploying.

## Local Gate

Run before any B-line merge candidate:

```bash
npm run format:check
npm run typecheck
npm run lint
npm run verify:news
npm run test:news
npm run test:watch-pipeline
npm run verify:chat-v3-final
npm run build
```

Expected local caveats:

- `verify:news` may warn about missing local API keys.
- RSS live checks may be skipped locally.
- CoinW announcements remain pending until an official endpoint/feed is provided.

## Internal Preview Gate

Use this only after local gates pass and deployment identity is clean:

```bash
npx vercel
```

Do not pass `--prod`.

Verify the preview API shape:

```bash
curl "<preview-url>/api/watch/timeline?mode=public&locale=zh_CN&windowMinutes=720"
```

Expected shape:

- top-level `events`
- top-level `evidenceMap`
- top-level `servedAt`
- top-level `nextPollMs`
- locale matches the request
- at least one `pm_decision` event when staging has a real record

If staging has no PM decision record and Dan has allowed an internal trigger, run:

```bash
curl "<preview-url>/api/cron/strategy-replay?trigger=now"
```

Check only safe fields:

- `pmDecisionGenerated`
- `generatedPmDecisions`
- `pmDecisionAudit`
- `newsSourceHealth`
- `resolvedPmDecisions`
- `servedBy`
- `fellBackFrom`

`servedBy: "mock"` is valid only when every configured real source is unavailable and mock fallback is serving the chain.

Do not repeat `trigger=now` to force output; the route has a short lock by design.

## Browser Gate

Open the internal preview page and verify structure, not public polish:

- V9 layout still uses the approved two-tab structure.
- `行情分析` renders real `pm_decision` topics when available.
- Missing source URLs hide the source link.
- Stage 6 shows a pending message for unresolved decisions.
- Stage 6 shows resolved memory when `resolution` exists.
- Follow button remains a placeholder/social-proof interaction only.

## Report Template

Record this in `codex-to-claude.md` or the active handoff file when requested:

- branch and commit range
- local gate result
- preview URL, if one was created
- timeline API: `events.length`, `pm_decision` count, first PM payload fields
- trigger API: whether used, `generatedPmDecisions`, `resolvedPmDecisions`, safe source-health summary
- visual/browser notes
- known caveats and open Dan decisions
