# claw42 Deployment Identity

> Status: ACTIVE
>
> This file is the project-local identity card for GitHub and Vercel deployment work.
>
> Do not deploy, relink Vercel, or claim a remote preview until this card matches the current session.

---

## Identity Card

| Field                        | Value                                                            |
| ---------------------------- | ---------------------------------------------------------------- |
| workspace                    | `/Users/dannybrown/Claude/职业规划/web-dev/claw42`               |
| GitHub remote                | `https://github.com/agentxmain-collab/claw42.git`                |
| expected GitHub owner        | `agentxmain-collab`                                              |
| Vercel projectName           | `claw42-site`                                                    |
| Vercel projectId             | `prj_UjubflJkr8XJFUm36cUmoLCl3NrH`                               |
| Vercel orgId                 | `team_URED5oO6s2OI5bakH3FJUQpC`                                  |
| expected Vercel team slug    | `agentxmain-collabs-projects`                                    |
| expected Vercel team display | `agentxmain-collab's projects`                                   |
| preferred preview mode       | GitHub Actions `Vercel Preview` workflow                         |
| production deploy mode       | GitHub Actions `Vercel Production` manual workflow only          |
| local Vercel CLI deploy      | Do not use unless `vercel whoami` / team scope matches this card |

---

## Required Preflight

Before any deployment-related action:

```bash
git remote -v
git branch --show-current
cat .vercel/project.json
gh api user --jq .login
vercel whoami
vercel teams ls
```

If Vercel CLI is unavailable or logged into a different team, do not use `vercel deploy` as fallback.

If GitHub push / PR checks succeed but Vercel preview is missing, check the `Vercel Preview` GitHub Actions run first. Do not assume Vercel Git webhook is active.

---

## GitHub Actions Deployment

Required repository secrets:

| Secret              | Value                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| `VERCEL_TOKEN`      | Token generated from the `agentxmain-collabs-projects` Vercel account/team |
| `VERCEL_ORG_ID`     | `team_URED5oO6s2OI5bakH3FJUQpC`                                            |
| `VERCEL_PROJECT_ID` | `prj_UjubflJkr8XJFUm36cUmoLCl3NrH`                                         |

Deployment rules:

- Pull request / feature branch preview: automatic via `.github/workflows/vercel-preview.yml`.
- Production: manual only via `.github/workflows/vercel-production.yml`, from `main`, with `confirm=DEPLOY`.

---

## Allowed Fallback

Local preview is allowed while remote Vercel is unclear:

```bash
npm run dev -- -p <port>
```

But it must be described as local-only. Do not call it a Vercel preview.

---

## Do Not

- Do not relink `.vercel/project.json` without Dan approval.
- Do not create a new Vercel project to "fix" missing preview.
- Do not deploy from a Vercel team that cannot see `claw42-site`.
- Do not silently switch from GitHub Actions preview to local Vercel CLI deploy.
