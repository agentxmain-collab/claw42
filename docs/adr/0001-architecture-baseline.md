# ADR 0001: 工程化基线建立路径

## Status

Accepted

## Context

2026-04-30 Dan directive：claw42 是 A 级项目，按 engineering-standards.md v1.0.1 评审基线达成度仅 27%。直接全面整改会阻塞产品功能迭代（task-12 stream redesign / task-13 hero daily brief 在跑），需要分阶段方案。

## Decision

分 3 阶段补：

- P0（立即）：scripts / Prettier / .nvmrc / 安全头 / API 限流 / ARCHITECTURE.md / ADR 目录 — task-14
- P1（产品功能稳定后）：Vitest + Playwright + Lighthouse CI + size-limit — task-15
- P2（上线评审前）：Sentry + PostHog + GitHub Actions CI + Release checklist — task-16

P0 不阻塞当前在跑 task，独立 PR 推。P1/P2 等当前 task 落地后启动。

## Consequences

**收益**：

- AI 协作有"禁止路径"明文（ARCHITECTURE.md § 9），降低 Codex 失控风险
- 安全头 + API 限流，立即降低成本/拒绝服务漏洞
- typecheck script + Prettier，提供 CI 接入前提

**代价**：

- 当前 PR review 流程不变（仍靠 Dan 手测），直到 P1 测试套件落地
- CSP 用 Report-Only 起步可能需要后续调整放行域名

**不可逆性**：低。每个改动都可独立 revert。

## 关联

- engineering-standards.md v1.0.1
- task-14（本任务）
- task-15 / task-16（待启动）
