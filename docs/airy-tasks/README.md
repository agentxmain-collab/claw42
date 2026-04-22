# claw42 / Airy 任务包索引

> F（总调度）→ Airy（执行）。Airy 从 `main` 拉 `feature/claw42-<task>-<n>` 分支，按 spec 实现，PR 到 `main` 等 F 审核。

## 技术栈基线（硬约束）

- Next.js **14.2.35**（App Router）
- React **18**
- Tailwind CSS **3.4.1**
- TypeScript **5.x**

**禁用清单**（各任务 spec 里也会重申）：
- ❌ Tailwind v4-only 语法（`@theme` / `@utility` / inline theme config 等）
- ❌ React 19-only Server Component 模式（async client component / use() hook 等）
- ❌ next-intl / next-i18next（用自建 Context）
- ❌ 无许可的新依赖（每个 task 允许的依赖在 spec 里白名单列出）

## 任务列表

| # | 任务 | 分支 | 状态 | 依赖 |
|---|------|------|------|------|
| 01 | i18n 双语切换 + 排版收敛 | `feature/claw42-i18n-layout` | 已合并 @ 14616a2 | 无 |
| 02 | v1.1 Polish：Header + Hero 稳定 + AI Skills 生态 + Scenarios 布局重构 + 全站动效 | `feature/claw42-v1-1-polish` | 在途 | Task 01（已合并） |
| 03 | 真实 URL 替换 + QuickStart 命令更新 | `feature/claw42-v1-1-polish`（同 Task 02 分支） | 待认领 | Task 02（合并到同一 PR） |
| 04 | Hero 交互场景：Robot Pose State Machine + Eye Tracking + 轮播气泡 | `feature/claw42-hero-scene-04` | 待认领 | Task 02（已合并），hero 资源已在 `public/images/hero/`（assets/hero-scene 已合 main） |

## 工作流

1. Airy `git pull` 拉最新 `main`
2. 读 `docs/airy-tasks/task-<n>-*.md`
3. `git checkout -b feature/claw42-<task>-<n>`
4. 实现 + commit（commit message 写清楚变更点）
5. `git push origin feature/claw42-<task>-<n>`
6. 开 PR → 等 F 审核
7. F 审核通过后由 Dan 合并

## 审核流程（F 侧）

1. 变更范围核实（`git diff --name-only` 对照 spec 允许的文件）
2. 逐条验收标准检查
3. 架构一致性（命名规范、设计模式、和现有代码的一致性）
4. 通过 → push / 微调 → F 直接改 / 重做 → 出修正 spec

## 沟通协议

- 有歧义 → 不要猜，直接问 F（通过 Dan 中转）
- 发现 spec 有坑 → 先停手，标记问题，等 F 修正 spec
- 产出不对 → 按 F 的反馈改，不辩论

---

*维护者: F（总调度）*
*创建: 2026-04-20*
