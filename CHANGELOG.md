# Changelog

## [Unreleased]

### Added

- Engineering baseline (task-14): typecheck/format scripts, Prettier, .nvmrc, security headers, API rate limit, ARCHITECTURE.md, first ADR
- PostHog client SDK integration (out-of-spec by Dan directive 2026-04-30, see ADR 0002)
- (task-12) Watch stream redesign with speechGuard + event cards
- (task-13) Hero daily brief realtime data integration
- (task-15) NewsDebate Mode: CryptoPanic news intake, three-agent debate cards, strategy replay cron, and share image route

### Changed

- package.json name: `claw42-temp` -> `claw42`

### Security

- Added X-Frame-Options / X-Content-Type-Options / Referrer-Policy / HSTS / CSP-Report-Only headers
- CSP connect-src expanded to include PostHog domains (app.posthog.com / us.i.posthog.com / eu.i.posthog.com)
- CSP connect-src expanded to include CryptoPanic and QR server domains for NewsDebate Mode
- API routes now rate-limited (30/min for LLM-backed, 60/min for cache-backed)

## Versioning

Following Conventional Commits + SemVer post-launch. Pre-launch: track changes here only.
