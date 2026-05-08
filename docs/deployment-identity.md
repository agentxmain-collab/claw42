# claw42 Deployment Identity

> Status: ACTIVE
>
> This file is the project-local identity card for GitHub and Vercel deployment work.
>
> Do not deploy, relink Vercel, or claim a remote preview until this card matches the current session.

---

## Identity Card

| Field                     | Value                                                                       |
| ------------------------- | --------------------------------------------------------------------------- |
| workspace                 | `/Users/dannybrown/Claude/职业规划/web-dev/claw42`                          |
| GitHub remote             | `https://github.com/agentxmain-collab/claw42.git`                           |
| expected GitHub owner     | `agentxmain-collab`                                                         |
| observed local `gh` login | `xxcryptoofficial-collab` on 2026-05-07                                     |
| Vercel projectName        | `claw42-site`                                                               |
| Vercel projectId          | `prj_UjubflJkr8XJFUm36cUmoLCl3NrH`                                          |
| Vercel orgId              | `team_URED5oO6s2OI5bakH3FJUQpC`                                             |
| expected Vercel team      | `agentxmain-collab` from 2026-05-07 incident note; Dan confirmation pending |
| preferred preview mode    | GitHub PR / push webhook                                                    |
| local Vercel CLI deploy   | Do not use unless `vercel whoami` / team scope matches this card            |

---

## Required Preflight

Before any deployment-related action:

```bash
git remote -v
git branch --show-current
cat .vercel/project.json
gh api user --jq .login
vercel whoami
```

If Vercel CLI is unavailable or logged into a different team, do not use `vercel deploy` as fallback.

If remote Vercel preview is missing but Git push/PR succeeded, treat it as a webhook/team authorization issue until proven otherwise.

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
- Do not silently switch from GitHub webhook preview to Vercel CLI deploy.
