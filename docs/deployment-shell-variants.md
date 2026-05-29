# Deployment Shell Variants

`SITE_SHELL_VARIANT` selects only the outer header/footer shell for Claw 42 deployments. The page body, providers, analytics, agent watch board, and trading/data flows remain shared.

## Values

| Value    | Shell                         | Footer              | Intended deployment           |
| -------- | ----------------------------- | ------------------- | ----------------------------- |
| `claw42` | Original Claw 42 `SiteHeader` | None                | `claw42.ai` production line   |
| `coinw`  | `CoinwGlobalHeader`           | `CoinwGlobalFooter` | CoinW-branded production line |

Default: `coinw`.

The default preserves the current feature-branch staging behavior when preview deployments do not explicitly set the variable. Each production project must set `SITE_SHELL_VARIANT` explicitly before release.

## Boundaries

- Codex may implement and verify the code path on staging/preview.
- Codex must not create a second Vercel project, bind a domain, promote production, or change production environment variables without Dan's explicit production instruction.
- `SiteHeader`, `CoinwGlobalHeader`, and `CoinwGlobalFooter` are shell components; this variant switch does not edit their contents.
