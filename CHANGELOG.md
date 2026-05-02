# Changelog

## [Unreleased]

### Added

- Engineering baseline (task-14): typecheck/format scripts, Prettier, .nvmrc, security headers, API rate limit, ARCHITECTURE.md, first ADR
- (task-12) Watch stream redesign with speechGuard + event cards
- (task-13) Hero daily brief realtime data integration

### Changed

- package.json name: `claw42-temp` -> `claw42`

### Security

- Added X-Frame-Options / X-Content-Type-Options / Referrer-Policy / HSTS / CSP-Report-Only headers
- API routes now rate-limited (30/min for LLM-backed, 60/min for cache-backed)

## Versioning

Following Conventional Commits + SemVer post-launch. Pre-launch: track changes here only.
