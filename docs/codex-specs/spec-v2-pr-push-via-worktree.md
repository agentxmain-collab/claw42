# Spec: v2 Master Plan + Codex Review PR Push via Worktree

## 目标

把两份文档以两个独立的、干净的 PR push 到 `origin/main`：

1. `docs/codex-specs/v2-master-plan-codex-review.md`（Codex 副审产出，已 commit 在 origin 的 `feature/v2-master-plan-codex-review` 分支上的 commit `28e12d7`）
2. `docs/v2-master-plan-locked-v2.md`（Session C 整合 Codex 副审后的 locked-v2，已写在 claw42 当前 working tree，untracked 状态）

两个 PR 都必须 base 是 `main`、diff 干净（只含目标文档），且**不动 claw42 当前 working tree 的其他 dirty state**（其他 dirty 文件是别的 task 的活，不在本 spec 范围）。

## 变更范围

### 新建（在 origin remote）

- 分支 `feature/v2-master-plan-codex-review-clean`
- 分支 `feature/v2-master-plan-locked-v2`
- PR #A: codex review（base main）
- PR #B: locked-v2（base main）

### 修改

无

### 不动

- claw42 当前 working tree 的所有 dirty state（不要 stash、不要 commit）
- `main` 分支（不直接 commit）
- 任何其他现有分支历史

### 临时切换 + 还原（GitHub 账号）

- 操作前：记录当前 active 账号 → `gh auth switch --user agentxmain-collab`
- 操作期间：`agentxmain-collab` active（有 write 权限）
- 操作后（cleanup 阶段）：切回原 active 账号

## 当前状态快照

```bash
$ git status
# (assume) On branch <whatever-current>, with multiple modified/untracked files
# 已知 dirty 项（不要碰）：
#   modified: src/modules/landing/HeroScene/SpeechBubble.tsx
#   untracked: public/images/agents/{alpha,beta,gamma}-{72,120,256}.png
#   untracked: public/images/agents/{alpha,beta,gamma}-color-token.json
#   untracked: public/images/agents/hero-background-glow-1920x1080.png
#   untracked: docs/v2-master-plan-locked-v2.md  ← 本 spec 要 push 的目标 #2

$ git log --oneline -3 origin/feature/v2-master-plan-codex-review
28e12d7 docs: add v2 master plan codex review
<earlier commits>

$ ls docs/v2-master-plan-locked-v2.md
docs/v2-master-plan-locked-v2.md  # exists in working tree, untracked

$ gh auth status
# active account: agentxmain-collab（已切，对 agentxmain-collab/claw42 有 write 权限）
```

## 技术上下文

- 用 `git worktree` 隔离两个 PR 操作，不影响 claw42 主 working tree
- worktree 路径：`/tmp/claw42-cr-clean`（PR A）+ `/tmp/claw42-locked-v2`（PR B）
- locked-v2.md 当前在主 working tree（untracked），需要 `cp` 到 worktree B 里 add+commit
- 28e12d7 cherry-pick 后会产生新 hash（cherry-pick 不保留原 hash），这是预期行为

## 具体要求

### 部分 A：Codex Review PR

```bash
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42

# 记录当前 active 账号，操作完恢复
ORIGINAL_GH_USER=$(gh auth status 2>&1 | awk '/Active account: true/{found=1} found && /account /{print $NF; exit}')
echo "Original active: $ORIGINAL_GH_USER"

# 切到有 write 权限的账号
gh auth switch --user agentxmain-collab
gh auth status | grep -A1 "agentxmain-collab" | grep "Active account: true" || { echo "FAIL: agentxmain-collab not active"; exit 1; }

git fetch origin
git fetch origin feature/v2-master-plan-codex-review:refs/remotes/origin/feature/v2-master-plan-codex-review

# worktree 1
git worktree add /tmp/claw42-cr-clean -b feature/v2-master-plan-codex-review-clean origin/main
cd /tmp/claw42-cr-clean
git cherry-pick 28e12d7

# verify: log 应显示 cherry-pick commit + main 历史
git log --oneline -3

# 应当显示：
#   xxxxxxx docs: add v2 master plan codex review   ← cherry-pick 新 hash
#   yyyyyyy <main HEAD>
#   zzzzzzz <earlier main>

# verify: diff 应当只含一个文件
git diff --name-only HEAD~1 HEAD
# 应输出：docs/codex-specs/v2-master-plan-codex-review.md

# push + PR
git push -u origin feature/v2-master-plan-codex-review-clean
gh pr create --base main --head feature/v2-master-plan-codex-review-clean \
  --title "docs: codex review of v2 master plan" \
  --body "Codex 副审 v2-master-plan.md，判断 GO after patch。详见 docs/codex-specs/v2-master-plan-codex-review.md。

整合到 docs/v2-master-plan-locked-v2.md（sibling PR）。"
```

### 部分 B：locked-v2 PR

```bash
# worktree 2
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git worktree add /tmp/claw42-locked-v2 -b feature/v2-master-plan-locked-v2 origin/main

# locked-v2.md 在主 working tree（untracked），需要复制过去
cp docs/v2-master-plan-locked-v2.md /tmp/claw42-locked-v2/docs/v2-master-plan-locked-v2.md

cd /tmp/claw42-locked-v2
git add docs/v2-master-plan-locked-v2.md
git commit -m "docs: v2 master plan locked-v2 (codex patches applied)

Codex review (28e12d7) found 5 factual errors and 6 must-do patches.
All applied. Task list re-split from 29 to 41 subtasks.

Key changes from v1:
- Fix chatHistoryStore branch fact (feature branch, not main)
- Add 6th collision dimension (Codex implementation reality)
- Split T1/T2/T24.1/T13/A1 per Codex § 5
- Add T2b generateText adapter (generic text bridge)
- Mark A1 implementation NO-GO until CoinW provides real trade URL
- Mark official backfilled win-rate NO-GO until provenance mechanism
- Add v2.0 dependency policy waiver for 6 packages
- Backfill data does not enter K-line UI (Q-Patch-3 A)"

# verify: diff 应当只含 locked-v2.md
git diff --name-only HEAD~1 HEAD
# 应输出：docs/v2-master-plan-locked-v2.md

git push -u origin feature/v2-master-plan-locked-v2
gh pr create --base main --head feature/v2-master-plan-locked-v2 \
  --title "docs: v2 master plan locked-v2 (codex patches applied)" \
  --body "Codex 副审通过 (GO after patch)。5 事实修正 + 6 patch 全部应用。task 拆分 29 → 41 subtask。

详见 docs/v2-master-plan-locked-v2.md。

关联：codex review PR (feature/v2-master-plan-codex-review-clean)"
```

### 部分 C：Cleanup

```bash
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git worktree remove /tmp/claw42-cr-clean
git worktree remove /tmp/claw42-locked-v2

# verify
git worktree list
# 应当只剩主 worktree

# 切回原账号
if [ -n "$ORIGINAL_GH_USER" ] && [ "$ORIGINAL_GH_USER" != "agentxmain-collab" ]; then
  gh auth switch --user "$ORIGINAL_GH_USER"
  echo "Restored active: $ORIGINAL_GH_USER"
else
  echo "Original active was agentxmain-collab or unknown, no switch back"
fi
```

## 验收标准

- [ ] PR `feature/v2-master-plan-codex-review-clean` 在 GitHub 创建成功
  - base = `main`
  - diff 只含 `docs/codex-specs/v2-master-plan-codex-review.md`
  - 1 个 commit
- [ ] PR `feature/v2-master-plan-locked-v2` 在 GitHub 创建成功
  - base = `main`
  - diff 只含 `docs/v2-master-plan-locked-v2.md`
  - 1 个 commit
  - commit message 见上（不要简化或改写）
- [ ] claw42 主 worktree 当前 dirty state **保持不变**
  - SpeechBubble.tsx 修改还在
  - 13 个 agent images 还在
  - `docs/v2-master-plan-locked-v2.md` 还在主 worktree（untracked）
- [ ] `/tmp` 下没有遗留 worktree（cleanup 完成）
- [ ] 不修改任何现有分支历史（**严禁** `--force` push）
- [ ] cleanup 阶段切回原 active 账号（不能让账号永久停在 `agentxmain-collab`，除非原本就是它）

## 约束

- ❌ 不要 stash claw42 主 worktree 的 dirty 改动
- ❌ 不要 commit 到 main
- ❌ 不要 force push
- ✅ **允许且要求**临时切到 `agentxmain-collab` 跑 push/PR，cleanup 时切回原账号
- ❌ 不要修改 `v2-master-plan-locked-v2.md` 内容（即使发现 typo 也不改，本 spec 不含修订权限）
- ❌ 不要修改 `v2-master-plan-codex-review.md` 内容（同上）
- ❌ 不要在 PR 描述里加业务背景叙述（spec 给的 body 文本就用那个，不要展开）
- ❌ 不要把当前 working tree 的其他 dirty 改动带进任何 PR
- ❌ 不要用真名 Mike（用 Dan）

## 完成后输出

两个 PR 号 + worktree 清理确认：

```
PR A (codex review): #<NUMBER> https://github.com/agentxmain-collab/claw42/pull/<NUMBER>
PR B (locked-v2):    #<NUMBER> https://github.com/agentxmain-collab/claw42/pull/<NUMBER>

Worktree cleanup: done (git worktree list 输出贴这里)
Main worktree dirty state: unchanged (verify with git status, count of dirty files unchanged)
```

## 失败处理

- **cherry-pick 冲突**：spec 假设 28e12d7 cherry-pick 干净（review 是 docs-only commit，与 main 无冲突）。如果有冲突 → 停下，不要乱解，把冲突文件路径报回来
- **push 权限失败**：检查 `gh auth status` active 账号是否还是 `agentxmain-collab`。如果意外被切走 → 重新跑 `gh auth switch --user agentxmain-collab` 后重试一次；仍失败 → 停下报回
- **worktree add 失败**：检查 `/tmp/claw42-cr-clean` 或 `/tmp/claw42-locked-v2` 是否已存在，是 → 先 `git worktree remove`
- **gh pr create 失败**：检查是否已有同名分支的 PR，是 → 报 PR 号回来不重新开
- **任何意外**：停下报回，**不要 force 操作**

---
