# Spec: Codex Sweep — Batch 0 + 1 Finalization

## 目标

一次性收口当前 v2.0 工程基础所有未完成 ops 工作，让 main 干净落定 + 9 PR 全 merge + T29 contrast 修订成功 push。完成后 main 含 Batch 0 + 1A + 1B 全部产出，为 Batch 2（LLM provider 合并 + /api/agents/analysis 改造）派发铺路。

**本 spec 是 ops sweep，不是 new feature**。Codex 跑这份 spec 期间不写新代码（除 T29 contrast 修订那 5 处 hex 替换），仅做 git ops + verify。

## 任务清单（5 部分）

| Part   | 内容                                                         |
| ------ | ------------------------------------------------------------ |
| Part 1 | T29 contrast 修订 + push + 开 PR                             |
| Part 2 | 按依赖顺序 merge 9 个现有 PR + 1 个新开的 T29 PR             |
| Part 3 | 每次 merge 后跑 main 健康检查（tsc + lint + build + vitest） |
| Part 4 | Stacked PR #39 (T4-core) rebase main 后 merge                |
| Part 5 | 最终 main 全套 verify + 状态报告                             |

## 共同约束

继承 `spec-batch1a-signalengine-internalization.md` 的共同约束（不动主 worktree dirty / 临时账号切换 + 还原 / Branch reality audit / Worktree 模式）。

### 主工作区现状（不动）

- 路径：`/Users/dannybrown/Claude/职业规划/web-dev/claw42`
- 当前分支：`feature/v2-master-plan-codex-review`（dirty）
- 残留旧 worktree（不要清理，本 spec 不管）：`feature/act1-5-watch-page-01` / `feature/news-source-multi-chain-01` / `feature/watch-chat-immersive-01` 等

### Remote vs Local Hash 警告

远端 PR 分支由 GitHub API 创建，远端 commit hash 和本地临时分支不一致。**所有操作必须从 `origin/feature/...` 开始**，不要拿本地旧 ref。

---

## Part 1: T29 Contrast 修订 + push + 开 PR

### 当前状态

T29 work 在 local branch `feature/v2-t29-a11y` at `0f50fd1`（含 `docs/a11y-audit.md` 4 个违规说明）。需要修订 5 处颜色 hex + 重跑 verify:a11y + push + 开 PR。

### 修订内容（5 处）

| #   | 文件                                                  | 行  | 当前                      | 改为      |
| --- | ----------------------------------------------------- | --- | ------------------------- | --------- |
| 1   | `src/modules/landing/HeroScene/HeroScene.tsx`         | 193 | `#7c5cff`（CTA 按钮背景） | `#6a4be0` |
| 2   | `src/modules/agent-watch/components/AgentRowCard.tsx` | 77  | `#848484`（灰色文字）     | `#8b8b8b` |
| 3   | `src/modules/agent-watch/components/AgentRowCard.tsx` | 93  | `#7a7a7a`（灰色文字）     | `#828282` |

### 实施

```bash
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42

# 切账号
ORIGINAL_GH_USER=$(gh auth status 2>&1 | awk '/Active account: true/{found=1} found && /account /{print $NF; exit}')
gh auth switch --user agentxmain-collab

# 用 worktree 隔离
git fetch origin

# 假设本地分支 feature/v2-t29-a11y 还在
git worktree add /tmp/claw42-t29-fix feature/v2-t29-a11y
cd /tmp/claw42-t29-fix

# Step 1: grep 验证 #7c5cff 在 HeroScene.tsx:193 是 CTA 按钮（非 hover/icon/装饰）
grep -n "7c5cff" src/modules/landing/HeroScene/HeroScene.tsx
# 如果第 193 行附近有 hover/icon/border 等用途的 #7c5cff，停下报回

# Step 2: 替换 5 处颜色（如确认是 CTA 按钮）
# 用 sed 或手动 edit:
#   HeroScene.tsx:193 #7c5cff → #6a4be0
#   AgentRowCard.tsx:77 #848484 → #8b8b8b
#   AgentRowCard.tsx:93 #7a7a7a → #828282

# Step 3: 重跑 verify:a11y
npm install
npm run verify:a11y
# 全绿 → 继续；红 → 报回错误（可能新违规出现）

# Step 4: 更新 docs/a11y-audit.md 标记 4 violations resolved
# 在原 audit 文档加 "## Resolution (2026-05-07)" 段，列改动 hex + 新 ratio

# Step 5: tsc + lint + build
npx tsc --noEmit
npm run lint
npm run build

# Step 6: commit
git add src/modules/landing/HeroScene/HeroScene.tsx \
        src/modules/agent-watch/components/AgentRowCard.tsx \
        docs/a11y-audit.md

git commit -m "fix(a11y): bump contrast for CTA button and AgentRowCard labels

Resolves 4 serious color-contrast violations from verify:a11y:
- HeroScene CTA button: #7c5cff → #6a4be0 (4.34 → 5.0:1)
- AgentRowCard label 1: #848484 → #8b8b8b (4.40 → 4.6:1)
- AgentRowCard label 2: #7a7a7a → #828282 (4.49 → 4.55:1)

Brand color #7c5cff retained globally (icons / decorative elements).
Only CTA button background changed to satisfy WCAG AA 4.5:1 normal text.

Refs: docs/a11y-audit.md"

# Step 7: push（已是 agentxmain-collab）
git push -u origin feature/v2-t29-a11y

# Step 8: 开 PR（如果还没开）
gh pr view feature/v2-t29-a11y 2>/dev/null || gh pr create \
  --base main --head feature/v2-t29-a11y \
  --title "fix(a11y): T29 contrast violations resolved" \
  --body "T29 a11y WCAG AA pass. 4 serious color-contrast violations fixed.

Refs: docs/a11y-audit.md"
```

### 失败处理

- **Step 1 grep 显示 #7c5cff 在 line 193 是 hover/icon/border 等非 CTA 用途**：停下报回，**不要替换**。Session C 重新决定修复位置。
- **Step 3 verify:a11y 仍有违规**：报回所有违规细节，**不要继续 push**。
- **Step 7 push 权限拒绝**：检查 gh auth status active 账号。

---

## Part 2: PR Merge 按依赖顺序

### Merge 顺序（严格按此顺序）

```
Phase A: 文档 PR（无代码影响，最先）
  1. PR #29 (codex review doc)
  2. PR #30 (locked-v2 doc)

Phase B: 工程基础 + KV 抽象（任意顺序，但 #33 优先以避免 @vercel/kv 多次冲突）
  3. PR #33 (T32 metrics + vitest + @vercel/kv) ← 优先
  4. PR #31 (T28 web-vitals)
  5. PR #32 (T31 error-boundary)
  6. PR #35 (T1-auth-projection stub)
  7. PR #36 (T1-observability)
  8. PR #37 (T1.1 KV lock，复用 #33 已加的 @vercel/kv)
  9. PR #38 (T1.2 KV rate-limiter，复用 @vercel/kv)

Phase C: 核心
  10. PR #34 (T1-core SignalEngine 内化，30+ 文件)

Phase D: Stacked + 修订
  11. PR #39 (T4-core，rebase main 后 merge — 见 Part 4)
  12. PR T29 修订（Part 1 创建的，最后 merge 等 main 稳定）
```

### 每个 PR Merge 流程（脚本化）

```bash
# 通用 merge 流程（每个 PR 都跑这套）
PR_NUM=$1

cd /Users/dannybrown/Claude/职业规划/web-dev/claw42

# 1. fetch 最新
git fetch origin

# 2. 检查 PR mergeable 状态（GitHub API）
gh pr view $PR_NUM --json mergeable,mergeStateStatus,statusCheckRollup
# 如果 mergeable = false → 报回 conflict（不要自动解 conflict，停下让 Session C 决定）
# 如果 mergeStateStatus = BLOCKED（branch protection）→ 报回
# 如果 statusCheckRollup 含 FAILURE → 报回

# 3. Merge（用 squash 模式保 main 历史干净；如 PR 已有详细 commit 也可 rebase）
gh pr merge $PR_NUM --squash --delete-branch

# 4. 等 GitHub 确认 merge（poll 5s）
sleep 5

# 5. 跑 main 健康检查（见 Part 3）
```

### Conflict 处理

如果某 PR 报 conflict（多半在 `package.json` / `package-lock.json` 因为多个 PR 加 `@vercel/kv` 或 `vitest`）：

```bash
# 解决方案：在 worktree 里 rebase
git worktree add /tmp/claw42-merge-fix-$PR_NUM origin/main
cd /tmp/claw42-merge-fix-$PR_NUM
git fetch origin feature/<branch>
git checkout origin/feature/<branch> -B feature/<branch>-rebased
git rebase main

# 如果是 package.json conflict：
#   保留 main 已有的 deps + PR 引入的新 deps（合并两个 dependencies object）
#   然后 npm install 重新生成 lockfile
git add package.json package-lock.json
git rebase --continue

# 验证
npx tsc --noEmit && npm run lint && npm run build

# Force push 到原 PR 分支
git push --force-with-lease origin feature/<branch>-rebased:feature/<branch>

# 重新 merge
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
gh pr merge $PR_NUM --squash --delete-branch

# Cleanup
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git worktree remove /tmp/claw42-merge-fix-$PR_NUM
```

**严禁**：

- 直接 commit 到 main（必须走 PR）
- force push 到 main
- 跳过 conflict 验证

---

## Part 3: Main 健康检查（每次 merge 后跑）

```bash
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git fetch origin
git checkout main 2>/dev/null || true
git pull origin main

# 用 worktree 跑（不污染主 worktree dirty）
git worktree add /tmp/claw42-main-check origin/main
cd /tmp/claw42-main-check

npm install

# 必跑（任何 PR 都要过）
npx tsc --noEmit || { echo "FAIL tsc"; exit 1; }
npm run lint || { echo "FAIL lint"; exit 1; }
npm run build || { echo "FAIL build"; exit 1; }

# 按 main 上已 merge 的 PR 决定跑哪些 verify
# T32 (PR #33) merge 后：跑 verify:metrics
# T1-core (PR #34) merge 后：跑 test:signal-engine
# T1.1 (PR #37) merge 后：跑 test:kv-lock
# T1.2 (PR #38) merge 后：跑 test:kv-rate-limiter + test:kv-quota
# T4-core (PR #39) merge 后：再跑一次 test:signal-engine 确认
# T29 (修订 PR) merge 后：跑 verify:a11y

# 全绿 → continue 下个 PR
# 红 → 停下报回（main 已被破坏，需 Session C 介入）

cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git worktree remove /tmp/claw42-main-check
```

### Main 红 → 紧急回滚

如果 merge 后 main 跑 verify 红：

```bash
# 找到刚 merge 的 PR commit
git log --oneline -1 main

# Revert 该 commit
git revert <hash>
git push origin main

# 报回：main 已 revert <hash>，PR #X 需要修复后重新提交
```

**严禁**：force push 到 main 来"撤销"merge。

---

## Part 4: Stacked PR #39 (T4-core) 处理

### 当前状态

PR #39 base = `feature/v2-t1-core`（不是 main）。在 PR #34 merge 后，PR #39 的 GitHub UI 会自动检测 base 还是删除的旧分支，需要 rebase 到 main。

### Rebase 流程

```bash
# 等 PR #34 已 merge 到 main 后再跑

cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git fetch origin

# Worktree 隔离
git worktree add /tmp/claw42-t4-rebase origin/feature/v2-t4-core
cd /tmp/claw42-t4-rebase

# Rebase 到 main
git rebase origin/main

# 如果 conflict → 解决（应该不会有，因为 T4 只新增 test 文件）
# 如果 conflict 真的出现 → 停下报回

# 改 PR #39 的 base 到 main（GitHub API）
gh pr edit 39 --base main

# Force push 新分支
git push --force-with-lease origin feature/v2-t4-core

# 验证
gh pr view 39 --json mergeable,mergeStateStatus

# Merge
gh pr merge 39 --squash --delete-branch

# Cleanup
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git worktree remove /tmp/claw42-t4-rebase
```

---

## Part 5: 最终 Main 全套 Verify + 状态报告

### 全套验证（main 上 9 PR + T29 全 merge 后跑一次）

```bash
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git fetch origin

git worktree add /tmp/claw42-final-verify origin/main
cd /tmp/claw42-final-verify

npm install

# 全绿要求：
npx tsc --noEmit && \
  npm run lint && \
  npm run build && \
  npm run test:signal-engine && \
  npm run test:kv-lock && \
  npm run test:kv-rate-limiter && \
  npm run test:kv-quota && \
  npm run verify:metrics && \
  npm run verify:a11y

# (T28 web-vitals 是浏览器 beacon，无 CLI verify，跳过)
# (T31 error-boundary 是 React 组件，无独立 verify，跳过)

cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git worktree remove /tmp/claw42-final-verify
```

### Cleanup

```bash
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42

# 列出所有临时 worktree（不动旧的 act1-5 / news-source / watch-chat-immersive 等）
git worktree list

# 移除本 spec 创建的（如还有遗留）：
git worktree remove /tmp/claw42-t29-fix 2>/dev/null || true
git worktree remove /tmp/claw42-main-check 2>/dev/null || true
git worktree remove /tmp/claw42-t4-rebase 2>/dev/null || true
git worktree remove /tmp/claw42-final-verify 2>/dev/null || true

# 切回原账号
gh auth switch --user "$ORIGINAL_GH_USER"
```

### 状态报告（必填）

```
## Codex Sweep Batch 0+1 Finalization Report

### Part 1: T29 contrast 修订
- Branch: feature/v2-t29-a11y
- New commit: <hash>
- PR: #X (status: merged / open / failed)
- verify:a11y: pass / fail (details)
- 5 hex 修订: confirmed (HeroScene CTA / AgentRowCard×2)

### Part 2: 9 PR + T29 PR Merge 状态
| PR | Branch | Phase | Status | Conflict | Main verify after merge |
|---|---|---|---|---|---|
| #29 | codex-review-clean | A | merged | no | pass |
| #30 | locked-v2 | A | merged | no | pass |
| #33 | t32-metrics | B | merged | no | pass |
| #31 | t28-web-vitals | B | merged | no | pass |
| #32 | t31-error-boundary | B | merged | no | pass |
| #35 | t1-auth-projection | B | merged | no | pass |
| #36 | t1-observability | B | merged | no | pass |
| #37 | t1-1-kv-lock | B | merged | rebase | pass |
| #38 | t1-2-kv-ratelimit | B | merged | rebase | pass |
| #34 | t1-core | C | merged | no | pass |
| #39 | t4-core | D | merged (rebased) | no | pass |
| T29 | t29-a11y | D | merged | no | pass |

### Part 5: 最终 main verify
- tsc: pass
- lint: pass
- build: pass
- test:signal-engine: pass (23 cases)
- test:kv-lock: pass (11 cases)
- test:kv-rate-limiter: pass (7 cases)
- test:kv-quota: pass (8 cases)
- verify:metrics: pass (5 cases)
- verify:a11y: pass

### Cleanup
- 本 spec 创建的临时 worktree: removed
- 主 worktree dirty state: unchanged (count before/after: 81 / 81)
- GitHub account restored: <ORIGINAL_GH_USER>

### Issues encountered（如有）
- 列出每个 conflict / 红 verify / 重试
```

---

## 全局约束（重申）

- ❌ 不要 commit 到 main（必须走 PR）
- ❌ 不要 force push 到 main
- ❌ 不要清理旧 worktree（act1-5 / news-source / watch-chat-immersive 等不属于本 spec）
- ❌ 不要修改主 worktree dirty state
- ❌ 不要跳过 main 健康检查
- ❌ 不要解决 conflict 时随意丢弃任何 deps（package.json conflict 时必须保留所有 PR 引入的 deps）
- ❌ 不要 merge 失败的 PR（statusCheckRollup FAILURE 时停下报回）
- ❌ 不要用真名 Mike
- ✅ 允许临时切到 `agentxmain-collab` push/merge / cleanup 时切回

## 失败终止条件（任一发生则停下报回）

- T29 verify:a11y 修订后仍有 violation
- 任一 PR merge 后 main 红（tsc/lint/build/vitest/verify 任一失败）
- 任一 PR conflict 无法用本 spec 的 rebase 流程解决
- GitHub PR merge 被 branch protection 拒绝
- 主 worktree dirty state 改变（数量变化）
- 账号切换失败

---
