# Color Token Migration

Phase 1 only establishes the CoinW v2 token system. Section-level className
migration happens in later visual-alignment tasks.

| Old value                                                   | New token                                             | Notes                                                         |
| ----------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| `#7c5cff`                                                   | `brand.purple-bright` / `--color-brand-purple-bright` | Historical CTA and accent purple.                             |
| `#7650ff` / `--coinw-brand-hex`                             | `brand.purple-bright` / `--color-brand-purple-bright` | Historical CoinW brand value used in glow helpers.            |
| `#6a4be0`                                                   | `brand.purple` / `--color-brand-purple`               | Darker purple from contrast fixes; Figma target is `#5227ff`. |
| `#111`                                                      | `bg.primary` or `bg.fill-card1`                       | Choose by context in section tasks.                           |
| `#0a0a0a` / `brand.dark`                                    | `bg.primary` / `--color-bg-primary`                   | Deprecated dark alias.                                        |
| `gray-400`                                                  | `fg.secondary` / `--color-fg-secondary`               | Secondary body copy.                                          |
| `gray-500`                                                  | `fg.tertiary` / `--color-fg-tertiary`                 | Tertiary or footer copy.                                      |
| `white/10`                                                  | `border-token.primary` / `--color-border-primary`     | Default card and control borders.                             |
| `white/5`                                                   | `border-token.secondary` or `bg.fill-card2`           | Decide by border vs fill context.                             |
| `white/20`, `white/30`                                      | Context-specific token                                | Resolve during section migration.                             |
| `navy`, `blue`, `#0000ff`, `rgba(0,0,255,*)`, `deepskyblue` | Remove                                                | Known Quick Start Terminal error values for Phase 2.          |
