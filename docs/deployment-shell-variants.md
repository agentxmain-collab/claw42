# Deployment Shell Variants

`SITE_SHELL_VARIANT` selects the registered inner/outer visual differences for Claw 42 deployments. Providers, analytics, trading/data flows, and watch-board behavior remain shared.

## Values

| Value    | Shell                         | Footer              | Agent hero right side                                               | Intended deployment           |
| -------- | ----------------------------- | ------------------- | ------------------------------------------------------------------- | ----------------------------- |
| `claw42` | Original Claw 42 `SiteHeader` | None                | Existing robot constellation                                        | `claw42.ai` production line   |
| `coinw`  | `CoinwGlobalHeader`           | `CoinwGlobalFooter` | Multi-agent analysis map registered in `docs/dual-site-contract.md` | CoinW-branded production line |

Default: `coinw`.

The default preserves the current feature-branch staging behavior when preview deployments do not explicitly set the variable. Each production project must set `SITE_SHELL_VARIANT` explicitly before release.

## Boundaries

- Codex may implement and verify the code path on staging/preview.
- Codex must not create a second Vercel project, bind a domain, promote production, or change production environment variables without Dan's explicit production instruction.
- `SiteHeader`, `CoinwGlobalHeader`, and `CoinwGlobalFooter` are shell components; this variant switch does not edit their contents.
- The only current page-body visual divergence is the agent page hero right-side illustration. The left hero copy, stats, tabs, CTAs, data routes, and realtime board behavior stay shared.
- Any future divergence must be registered in `docs/dual-site-contract.md` before implementation.
