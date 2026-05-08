# Spec: Codex Sweep 2 — Merge task-18 + Hero Stage 1 + Push 累积 Specs

## 目标

3 件事一次性跑完：

1. **Merge PR #27**（task-18 v3.1 minimal patch）到 main
2. **Merge PR #42**（Hero Stage 1）到 main
3. **新开 docs-only PR** 把主 worktree 累积的 spec 文件 push 到 main（dirty count 回基线）

每步含 main 健康检查。继承 `spec-codex-sweep-batch01-finalization.md` 的所有 ops 模式（worktree / 临时账号切换 / 失败终止）。

---

## Part 1: Merge PR #27（task-18 minimal patch）

### Pre-check

```bash
gh pr view 27 --json mergeable,mergeStateStatus,statusCheckRollup
```

如果 mergeable = false → 报回 conflict 类型 + 文件，停下让 Session C 决定（task-18 PR #27 含较大代码改动，conflict 不轻易自决）。

### Merge

```bash
gh pr merge 27 --squash --delete-branch
sleep 5
```

### Main 健康检查（必跑）

```bash
git worktree add /tmp/claw42-sweep2-check origin/main
cd /tmp/claw42-sweep2-check
npm install
npx tsc --noEmit && npm run lint && npm run build
npm run test:signal-engine
npm run test:kv-lock && npm run test:kv-rate-limiter && npm run test:kv-quota
npm run verify:metrics
npm run verify:a11y
# task-18 引入的新 verify
npm run verify:chat-v3-final  # 50 条 synthetic thread
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git worktree remove /tmp/claw42-sweep2-check
```

任一红 → 停下报回（**不要 revert**，Session C 介入）。

---

## Part 2: Merge PR #42（Hero Stage 1）

### Pre-check + Merge + 健康检查

同 Part 1 流程，PR 号 42。

健康检查多跑一项：Hero 相关（如有 verify:hero）。如果 spec 里没定义独立 hero verify，跑 `npm run verify:a11y` 含 hero 路由即可。

注意：PR #42 引入 `HERO_INTERACTIVE_ENABLED` env flag 默认 false，所以默认主页仍是老 HeroScene。**不会影响 main 上的产品行为**。

---

## Part 3: Docs-only PR（push 累积 spec 文件）

### 目标

把主 worktree 中 `docs/` 目录下的 untracked / new files push 到 main，让 dirty count 从 87 回到基线（主要剩 SpeechBubble.tsx 修改 + 13 agent images，那些不属于本 spec）。

### 范围

仅 push **`docs/` 目录下的 untracked 或 modified 文件**。**不动**：

- `src/modules/landing/HeroScene/SpeechBubble.tsx`（其他 task 的活）
- `public/images/agents/*`（其他 task 的活）
- 任何其他 dirty file

### 实施

```bash
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42

# 切账号
ORIGINAL_GH_USER=$(gh auth status 2>&1 | awk '/Active account: true/{found=1} found && /account /{print $NF; exit}')
gh auth switch --user agentxmain-collab

git fetch origin

# 列出 docs/ 下 main 没有的文件
git status --porcelain docs/ | grep -E '^\?\? ' | awk '{print $2}'
git status --porcelain docs/ | grep -E '^.M ' | awk '{print $2}'

# 创建 worktree base main
git worktree add /tmp/claw42-docs-pr -b feature/docs-v2-cumulative origin/main
cd /tmp/claw42-docs-pr

# 把主 worktree 的 docs 新文件 cp 过来
# Codex 自行决定哪些文件需要：
# - 任何 docs/ 下 main 上不存在的 .md 文件 → cp 过来 add
# - docs/ 下 modified 的 .md 文件（如有）→ cp 过来 add（覆盖 main 版本）
# 不复制 docs 之外的 dirty 文件

# 例如（Codex 按实际 git status 决定文件清单）：
MAIN_WT="/Users/dannybrown/Claude/职业规划/web-dev/claw42"
DOCS_FILES=$(cd $MAIN_WT && git status --porcelain docs/ | awk '{print $NF}')
for f in $DOCS_FILES; do
  mkdir -p $(dirname "$f")
  cp "$MAIN_WT/$f" "$f"
done

git add docs/
git commit -m "docs: cumulative v2.0 master plan + spec docs

Pushes accumulated planning + spec documentation produced during v2.0 strategic
review and Batch 0/1 implementation. Documents include:

- v2 master plan (locked-v1 historical, locked-v3 final)
- Codex review docs for v2 master plan
- All Batch 0/1 specs (engineering foundation, signal engine, KV abstractions)
- Codex sweep 1 spec (PR merge sequence)
- Hot Pursuit archive spec
- task-18 v3.1 minimal patch spec
- Hero Stage 1 spec + Codex stage-1 review
- Codex sweep 2 spec (this current sweep)

No code changes. Pure documentation push for repo history alignment.

Refs: docs/v2-master-plan-locked-v3.md as current decision source."

git push -u origin feature/docs-v2-cumulative
gh pr create --base main --head feature/docs-v2-cumulative \
  --title "docs: cumulative v2.0 master plan + spec docs" \
  --body "Pushes accumulated v2.0 planning + spec docs from Sessions C work. No code changes."

# Auto-merge 可选（doc 改动安全）
gh pr merge --squash --delete-branch
```

### 健康检查

doc-only 改动不会破坏代码，仅跑 tsc + lint + build 防意外（万一某 spec 里有 markdown 嵌套 ts code block 误连接到 src）：

```bash
git worktree add /tmp/claw42-docs-pr-check origin/main
cd /tmp/claw42-docs-pr-check
npm install
npx tsc --noEmit && npm run lint && npm run build
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git worktree remove /tmp/claw42-docs-pr-check
```

### Cleanup

```bash
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git worktree remove /tmp/claw42-docs-pr 2>/dev/null || true
git worktree list
```

---

## Final Cleanup（全部完成后）

```bash
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git worktree remove /tmp/claw42-sweep2-check 2>/dev/null || true
git worktree remove /tmp/claw42-docs-pr 2>/dev/null || true
git worktree remove /tmp/claw42-docs-pr-check 2>/dev/null || true
git worktree list

# 切回原账号
gh auth switch --user "$ORIGINAL_GH_USER"
```

---

## 状态报告（必填）

```
## Codex Sweep 2 Report

### Part 1: PR #27 (task-18 minimal patch)
- Mergeable pre-check: <pass | conflict>
- Merged: <yes | no>
- Main health post-merge: <all pass | red on X>
- New main HEAD: <hash>

### Part 2: PR #42 (Hero Stage 1)
- Mergeable pre-check: <pass | conflict>
- Merged: <yes | no>
- Main health post-merge: <all pass | red on X>
- New main HEAD: <hash>
- Hero env flag: HERO_INTERACTIVE_ENABLED=false (default, no behavior change)

### Part 3: Docs-only PR
- PR: #<NUMBER>
- Files pushed: <list of docs/*.md files>
- Merged: <yes | no>
- tsc/lint/build: pass

### Cleanup
- Worktrees removed: <list>
- GitHub account restored: <ORIGINAL_GH_USER>
- Main worktree dirty state: before <87> / after <should be 14: SpeechBubble.tsx + 13 agent images>
```

---

## 全局约束

- ❌ 不要 commit 到 main 直接（必须走 PR）
- ❌ 不要 force push
- ❌ 不要把 SpeechBubble.tsx / agent images 带进 docs PR（那是其他 task 的活）
- ❌ 不要 revert（任何红 main 报回 Session C）
- ❌ 不要用真名 Mike
- ✅ 允许临时切到 `agentxmain-collab` push/merge / cleanup 时切回

## 失败终止条件

- PR #27 / #42 conflict 无法 trivially merge → 报回
- Main 健康检查任一项红 → 报回（不 revert）
- docs PR push 时发现意外含 docs 之外的文件 → 停下，让 Session C 看
- `agentxmain-collab` 账号切换失败 → 报回

---
