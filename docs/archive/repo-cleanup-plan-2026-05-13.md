# Claw42 仓库整理计划

> 盘点时间：2026-05-13
>
> 当前目标：把开发心智收敛到两条核心线，同时避免历史后端资产丢失。

## 目标状态

长期只保留两条核心线：

1. `main`
   - 正式环境基线。
   - 同时支持 `claw42.ai` root deployment 和 `ai.coinw.com/claw42` path deployment。
   - CoinW path 不应长期维护成独立分支。
2. `feature/watch-real-topic-content`
   - 当前 V9 / 真实 topic 推进线。
   - 保持当前版式和视觉结构，只继续改内容、数据、pipeline。

## 当前风险

- 主 worktree `/Users/dannybrown/Claude/职业规划/web-dev/claw42` 有大量未提交 WIP，不能用于整理。
- `/tmp/claw42-basepath` 包含生产路径部署补丁，但仍是 dirty 状态，不能作为正式来源。
- 远端保留了大量已合并或已被替代的历史分支。
- 多个老 PR 仍 open，会误导后续判断。

## 分支分组

### 保留

| 分支                                      | 用途           |
| ----------------------------------------- | -------------- |
| `origin/main`                             | 正式基线       |
| `origin/feature/watch-real-topic-content` | 当前 V9 推进线 |

### 临时保留

| 分支/worktree                                                          | 用途                | 后续动作                      |
| ---------------------------------------------------------------------- | ------------------- | ----------------------------- |
| `feature/coinw-claw42-basepath` / `/tmp/claw42-basepath`               | CoinW path 补丁来源 | 整理成 commit 后删除 worktree |
| `docs/backend-assets-audit-01` / `/tmp/claw42-backend-assets-audit-01` | 本次整理文档        | 合并/归档后删除               |

### 可归档后删除

这些分支已经 merged into `origin/main`，或被当前 V9/Phase B 替代。删除前先导出 bundle/patch。

- `origin/assets/hero-scene`
- `origin/feature/act1-5-watch-sedimentation-01`
- `origin/feature/act1-5-watch-stream-redesign-01`
- `origin/feature/claw42-hero-scene-04`
- `origin/feature/claw42-i18n-layout`
- `origin/feature/claw42-polish-trail-logo-icons`
- `origin/feature/hover-card-glow-refresh`
- `origin/fix/disclaimer-width-align`
- `origin/fix/hero-scene-revision-01`
- `origin/fix/quickstart-terminal-font`
- `origin/fix/robot-pose-switch-flicker`
- `origin/fix/three-step-icon-restore-01`
- `origin/feature/patch-v3-i18n-citations-trigger-01`
- `origin/feature/kv-import-hotfix-01`
- `origin/feature/watch-mini-cta-loading-01`
- `origin/feature/spec4-patch-staging-fixes-01`
- `origin/fix/watch-zero-state-live-snapshot-01`
- `origin/fix/watch-timeline-fallback-before-02`
- `origin/feature/watch-news-citations-timeline-01`
- `origin/feature/watch-track-record-wall-01`
- `origin/feature/watch-trade-card-01`
- `origin/feature/watch-team-contract-records-01`

### 需要人工关闭的老 PR

这些 PR 仍 open，但已不是当前主线。建议归档说明后关闭。

- PR #28 `preview/watch-chat-immersive-01 -> feature/act1-5-watch-page-01`
- PR #17 `feature/act1-5-watch-stage-mode-01 -> feature/act1-5-watch-page-01`
- PR #13 `docs/task-06-v2-cross-review-01 -> main`
- PR #12 `docs/task-06-cross-review-01 -> main`
- PR #11 `feature/act1-5-watch-page-01 -> main`
- PR #10 `docs/architecture-review-cross-check-01 -> main`

PR #25 `fix/prod-hero-particle-brand-01 -> main` 需要单独确认是否已经被生产版本吸收，再决定关闭或 cherry-pick。

## 执行顺序

1. 导出归档：
   - 全仓 bundle。
   - 远端分支清单。
   - open PR 清单。
   - 主 worktree dirty patch。
   - `/tmp/claw42-basepath` dirty patch。
2. 固化 CoinW path 支持：
   - 新建干净分支，基于 `origin/main` 或当前 V9 基线手工移植 basePath。
   - 验证 root mode 和 path mode。
3. 同步 V9：
   - 让 `feature/watch-real-topic-content` 吸收 basePath 支持。
   - 保留 V9 当前视觉和职能命名。
4. 后端资产抽取：
   - 优先 topic selector/ranker。
   - 再评估 stage/focus detector 规则重写。
5. 分支清理：
   - 关闭老 PR。
   - 删除已归档远端分支。
   - 删除本地临时 worktree。

## 不做的事

- 不直接 merge 老分支。
- 不删除主 worktree WIP。
- 不把 `/tmp/claw42-basepath` dirty 状态当成正式版本。
- 不改 V9 页面板式。
- 不碰 production deploy。
