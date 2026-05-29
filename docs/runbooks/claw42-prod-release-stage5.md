# Claw42 Stage 5 Production Release Runbook

This is a draft production runbook for releasing the Stage 4/5 UI shell work to
`https://claw42.ai`. It follows the safety posture of
`docs/runbooks/prod-release-2026-05-23-v11.md`: merge by the approved path, do not print
secrets, do not clear KV, and keep rollback explicit.

## Scope

- Target production domain: `https://claw42.ai`
- Vercel project: `agentxmain-collabs-projects/claw42-site`
- Public shell for this domain: `SITE_SHELL_VARIANT=claw42`
- CoinW-branded shell remains available behind `SITE_SHELL_VARIANT=coinw`, but is not the
  `claw42.ai` production shell.

## Non-Goals

- Do not promote production from this runbook unless Dan gives character-level production
  approval.
- Do not change production environment variables unless Dan explicitly approves the exact
  variable and value.
- Do not create or relink a Vercel project.
- Do not bind or move domains.
- Do not clear KV or rotate secrets.
- Do not modify the shared watch pipeline, cron, or CoinW trade gates as part of shell
  release.

## Pre-Release Identity Check

Run these checks from the repository before any production action:

```bash
git remote -v
git status --short --branch
cat .vercel/project.json
npx vercel whoami
npx vercel teams ls
npx vercel project inspect claw42-site --scope agentxmain-collabs-projects
```

Expected:

- GitHub remote points to `agentxmain-collab/claw42`.
- Vercel project is `claw42-site`.
- Vercel scope is `agentxmain-collabs-projects`.
- No unrelated working-tree changes are present.

Stop if any identity check disagrees with `docs/deployment-identity.md` or the global
deployment identity registry.

## Merge Path

1. Confirm the Stage 5 branch has only documentation changes for this prep batch:

   ```bash
   git diff --name-only origin/feature/stage4_fix_batch3...HEAD
   ```

2. Merge the approved feature stack by the project-approved route. Current stack context:
   - `feature/stage4_fix_batch3` is the Stage 4 verified base.
   - `feature/stage5_prep` contains only shell archive and runbook documentation.

3. Do not merge to `main` or production-target branches until Dan approves the release
   timing.

## Production Environment Gate

Before promoting a production deployment for `claw42.ai`, confirm production has:

```text
SITE_SHELL_VARIANT=claw42
```

This value is production-visible. Setting or changing it is a Dan-approved production
operation. Codex must not set it silently.

The future CoinW-branded line, including `ai.coinw.com`, should use:

```text
SITE_SHELL_VARIANT=coinw
```

That is a separate release decision and is not part of the `claw42.ai` release.

## Deployment Validation

After the approved production deployment is ready, validate:

```bash
npx vercel inspect https://claw42.ai --scope agentxmain-collabs-projects
```

Then check the public pages in a browser:

- `https://claw42.ai/zh_CN`
- `https://claw42.ai/zh_CN/agent`

Expected visible results for `claw42.ai`:

- Original Claw 42 header is visible.
- CoinW global header is not visible.
- CoinW global footer is not visible.
- Agent board still renders fresh cards and the public decision stream.
- Trade CTA behavior is unchanged from the verified pre-release branch.

Optional command-line smoke checks after production is ready:

```bash
curl -I https://claw42.ai/zh_CN
curl -I https://claw42.ai/zh_CN/agent
```

Expected:

- HTTP success response.
- No redirect to an unintended preview URL.
- No Vercel protection page.

## Rollback Triggers

Rollback immediately if any of these are observed on `claw42.ai`:

- Wrong shell appears: CoinW global header/footer shows on `claw42.ai`.
- Header or footer blocks first-screen content.
- `/zh_CN` or `/zh_CN/agent` returns an error.
- Agent board fails to render cards that were visible in staging.
- Trade CTA safety changes unexpectedly.

## Rollback Path

Use the last known-good production deployment recorded by Vercel before this release.
Do not guess a deployment id. Inspect first:

```bash
npx vercel inspect https://claw42.ai --scope agentxmain-collabs-projects
```

Then promote the approved rollback deployment:

```bash
npx vercel promote <last-known-good-deployment-id> --scope agentxmain-collabs-projects
```

After rollback, re-check:

```bash
npx vercel inspect https://claw42.ai --scope agentxmain-collabs-projects
```

Confirm the public pages return to the known-good shell and board state.

## Audit Notes

- Record the release branch, merge commit, production deployment id, and rollback
  deployment id in the release thread.
- Keep screenshots for `/zh_CN` and `/zh_CN/agent`.
- If the environment value was changed, record only the variable name and target value
  (`SITE_SHELL_VARIANT=claw42`); do not expose unrelated environment values.
