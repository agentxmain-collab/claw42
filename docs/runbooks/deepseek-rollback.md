# DeepSeek V4 Pro Rollback

Status: ACTIVE

## Current default

Claw42 now defaults the DeepSeek provider to `deepseek-v4-pro` when `DEEPSEEK_MODEL`
is unset. The provider id remains `deepseek-chat` inside Claw42 because that is the
existing provider chain contract.

If V4 Pro returns a transient model/server failure, the same provider first retries
with `DEEPSEEK_FALLBACK_MODEL` (`deepseek-v4-flash` by default), then lets the
existing provider chain continue to Minimax / Claude / stub as configured.

Official DeepSeek API documentation verified on 2026-05-23:

- Model id: `deepseek-v4-pro`
- Context length: 1M
- API base URL: `https://api.deepseek.com`
- Current listed price per 1M tokens: `$0.435` cache-miss input / `$0.87` output
- Legacy names `deepseek-chat` and `deepseek-reasoner` are future-deprecated aliases
  for V4 Flash modes.

## Required Vercel environment change

Dan must set this environment variable in the `agentxmain-collab` Vercel team:

```text
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_FALLBACK_MODEL=deepseek-v4-flash
```

Apply it to both Preview and Production environments for the `claw42-site` project.
Do not paste API keys into source files, sync docs, issue comments, screenshots, or
PR descriptions.

Recommended budget guard while V4 Pro is active:

```text
LLM_MONTHLY_BUDGET_USD=800
LLM_BUDGET_ALARM_THRESHOLD=0.8
LLM_BUDGET_AUTOPAUSE_THRESHOLD=0.95
```

## Rollback path before legacy alias removal

If V4 Pro quality, latency, quota, or cost becomes unacceptable before DeepSeek
removes the legacy alias compatibility:

1. Open Vercel project `claw42-site`.
2. Change `DEEPSEEK_MODEL` to `deepseek-chat`.
   - If the explicit rollback should avoid V4 Flash retry behavior, clear
     `DEEPSEEK_FALLBACK_MODEL` or leave it unused; the automatic fallback only runs
     when the primary model is `deepseek-v4-pro`.
3. Save for the same environment scope that is failing.
4. Trigger a new PM run or wait for the next runtime request.
5. Check provider telemetry and ops-health.

No code change is required for the rollback. Runtime API calls read
`process.env.DEEPSEEK_MODEL` when each request is generated.

## After legacy alias removal

The legacy alias compatibility is documented as temporary. If `deepseek-chat` stops
working, rollback must use `deepseek-v4-flash` or another currently supported
DeepSeek model id from the official pricing page, then re-run provider-chain tests
and ops-health checks.
