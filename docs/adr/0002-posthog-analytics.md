# ADR 0002: PostHog 客户端 SDK 接入

## Status

Accepted

## Context

2026-04-30 Dan 直接 directive：将原 task-16 P2 的 PostHog 接入提前到 task-14 P0 实施，理由是想立即获得 funnel + session replay 能力，task-16 P2 范围相应缩小。本接入未走 task-14 P0 spec 的纸面流程，以本 ADR 作为决策留痕。

## Decision

- 接入 posthog-js@^1.372.3 客户端 SDK
- 通过 NEXT_PUBLIC_POSTHOG_KEY / NEXT_PUBLIC_POSTHOG_HOST 配置
- 默认 host: https://app.posthog.com（可改 us.posthog.com / eu.posthog.com）
- 保留 /api/analytics route 作为服务端备份通道
- ANALYTICS_EVENTS 白名单继续作为唯一允许的事件 schema

## Consequences

**优点**：

- 客户端事件直达 PostHog dashboard
- session replay + funnel 立即可用
- task-16 P2 范围相应缩小（PostHog 项已落地）

**代价**：

- dependency-policy 11 步 sync 流程后置，墨菲扫描在 ADR 通过后由 Dan 跑
- CSP connect-src 需补 PostHog 域（已在 next.config.mjs 同步）
- ANALYTICS_EVENTS 白名单维护责任从 spec 走变成 ADR 走（每次加事件需更新 white list 并测试）

**不可逆性**：低。卸载 posthog-js + 还原 src/lib/analytics.ts 即可回滚。

## 关联

- task-14 P0 spec 未列此项
- engineering-standards.md v1.0.1 § 4 监控维度（A 级要求 PostHog）
- claude-codex-protocol.md v2.3 § 带外授权追溯（本 ADR 作为该流程的首个落地案例）
