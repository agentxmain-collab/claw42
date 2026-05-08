# Spec: Hot Pursuit Repo Archive (T36 + T37)

## 目标

Hot Pursuit 项目终止，工程能力 + 部分内容形态融合到 claw42 v2.0。本 spec 完成两件归档动作：

- **T36**：在 Hotpursuit `README.md` 顶部加归档 banner
- **T37**：v1.4 Batch 1 的 9 个 worktree 分支加 deprecation note，物理保留不删除

归档动作完成后 Hot Pursuit repo **不再接收任何新 PR**，仅作历史 reference。

## 变更范围

### 修改

- `Hotpursuit/README.md`（在顶部 frontmatter 之后插入归档 banner）

### 新建

- `Hotpursuit/docs/superpowers/specs/2026-05-07-v1-4-batch1-deprecated.md`（v1.4 Batch 1 worktree 终止说明）

### 不动

- 任何 Hotpursuit 现有源代码（`src/`）
- v1.4 Batch 1 的 9 个 codex/v1-4-batch1-\* worktree（**物理保留**，仅加 deprecation note 说明状态，不删除）
- v1.3.0-rc3 tag 或封版 commit
- 其他 Hotpursuit specs / docs

## 当前状态快照

```bash
$ ls /Users/dannybrown/Claude/职业规划/academy/Ai生态项目/Hotpursuit
README.md
package.json
src/
docs/
...

$ cd /Users/dannybrown/Claude/职业规划/academy/Ai生态项目/Hotpursuit
$ git remote -v
# 实际 remote 状态由 Codex 检查，不假设具体值

$ git branch -a | grep "codex/v1-4-batch1"
# 应当看到 9 个 v1.4 Batch 1 worktree 分支
```

## 技术上下文

- Hotpursuit 已停止演进，本 spec 之后**不再接 PR**
- Banner 必须用人类可读的 markdown，不要塞 HTML/JSON
- v1.4 Batch 1 中 5/9 资产复用到 claw42 v2.0：F (Web Vitals) → claw42 T28 / G (Anthropic Provider) → claw42 T2 / H (i18n) → claw42 T27 / L (OpenAI live) → claw42 T2 verify / O (Error Boundary) → claw42 T31 / P (a11y) → claw42 T29
- 其他 4/9 worktree（A/B/D 等 dashboard 相关）作废
- Hotpursuit git remote 当前状态由 Codex 自行 audit 决定 push 路径

## 具体要求

### 部分 A：T36 README 归档 banner

在 `Hotpursuit/README.md` 顶部（如有 frontmatter 在其后；否则在第一个 `# 标题` 之后）插入以下 banner：

```markdown
> ## ⚠️ ARCHIVED — 项目已终止演进
>
> **本仓库的工程能力 + 部分内容形态已融合到 [claw42 v2.0](https://github.com/agentxmain-collab/claw42)**，本仓库**不再接收新 PR**，仅作历史 reference 保留。
>
> - 归档日期：2026-05-07
> - 最后封版：v1.3.0-rc3
> - 详细决策：见 `docs/superpowers/specs/2026-04-27-handoff-to-session-c.md`
> - claw42 v2.0 主 spec：[v2-master-plan-locked-v2.md](https://github.com/agentxmain-collab/claw42/blob/main/docs/v2-master-plan-locked-v2.md)
>
> 资产去向（5/9 v1.4 Batch 1 复用到 claw42）：
>
> - F (Web Vitals) → claw42 T28
> - G (Anthropic Provider) → claw42 T2
> - H (i18n bilingual) → claw42 T27
> - L (OpenAI Responses live) → claw42 T2 verify
> - O (Error Boundary) → claw42 T31
> - P (a11y) → claw42 T29
```

注意 banner 末尾保留一个空白行 + `---`（如果原 README 后续有内容）作为视觉分隔。

### 部分 B：T37 Batch 1 deprecation note

新建文件 `Hotpursuit/docs/superpowers/specs/2026-05-07-v1-4-batch1-deprecated.md`：

```markdown
# v1.4 Batch 1 Worktree Deprecated

日期：2026-05-07
状态：**所有 9 个 codex/v1-4-batch1-\* worktree 不再合并**

## 决策

Hot Pursuit 项目整体归档（见 README banner），v1.4 Batch 1 的 9 个 worktree 分支：

| Worktree                    | 内容           | 命运                                           |
| --------------------------- | -------------- | ---------------------------------------------- |
| A Hero + Dynamic Headline   | dashboard hero | 作废（dashboard 砍）                           |
| B 信任与合规                | 合规 banner    | 作废                                           |
| D API for Developers + JSON | API 文档       | 作废（claw42 T14 重做，但 v2.0 不开 /docs UI） |
| F Web Vitals                | 性能上报       | **资产复用 → claw42 T28**                      |
| G Anthropic Provider        | LLM provider   | **资产复用 → claw42 T2**                       |
| H i18n 双语                 | 中英文 dict    | **资产复用 → claw42 T27**                      |
| L OpenAI Responses live     | LLM provider   | **资产复用 → claw42 T2 verify**                |
| O Error Boundary            | 客户端错误     | **资产复用 → claw42 T31**                      |
| P a11y                      | WCAG           | **资产复用 → claw42 T29**                      |

## 处置

- **物理保留**：9 个 worktree 分支不删除，作历史 reference
- **不再合并**：本仓库永久不接收来自这些分支的合并 PR
- **资产复用方式**：claw42 在内化时**重写**而非直接 cherry-pick（HP 是 Next 15 / React 19，claw42 是 Next 14 / React 18，版本不兼容）

## 关联

- 主归档说明：见 README.md banner
- claw42 v2.0 主 spec：claw42 repo `docs/v2-master-plan-locked-v2.md`
- Hot Pursuit → Session C 交接包：`docs/superpowers/specs/2026-04-27-handoff-to-session-c.md`
- claw42 v2.0 fusion task list（已被 content-ops 评分否决，仅作 reference）：`docs/superpowers/specs/2026-04-27-claw42-v2-fusion-task-list.md`

---
```

### 部分 C：Commit + Push（按 remote 状态决定）

```bash
cd /Users/dannybrown/Claude/职业规划/academy/Ai生态项目/Hotpursuit

# Audit remote 状态
git remote -v

# 决策树：
# 1. 如果 origin 指向可写的 agentxmain-collab 或类似 Dan 控制的 remote
#    → 临时切到 agentxmain-collab gh 账号 → push + 不开 PR（直接 commit 到 main，因为已归档）
# 2. 如果 origin 是 read-only（如 Caliboy6/Hotpursuit）
#    → 仅 local commit，不 push，并在最后报告中说明 origin 不可写
# 3. 任何不确定的情况 → local commit 不 push，报告

# Commit
git checkout main || git checkout master
git add README.md docs/superpowers/specs/2026-05-07-v1-4-batch1-deprecated.md
git commit -m "chore: archive hot pursuit repo, merged into claw42 v2.0

- T36: README banner with archive notice + claw42 v2.0 link
- T37: v1.4 Batch 1 deprecation note (5/9 assets reused in claw42)

Project terminated 2026-05-07. Last release: v1.3.0-rc3.
No new PRs accepted. Reference only."

# Push 决策（按上面决策树）
# 如果可写：
ORIGINAL_GH_USER=$(gh auth status 2>&1 | awk '/Active account: true/{found=1} found && /account /{print $NF; exit}')
gh auth switch --user agentxmain-collab 2>/dev/null || true
git push origin main || git push origin master
gh auth switch --user "$ORIGINAL_GH_USER" 2>/dev/null || true

# 如果只 local：
echo "INFO: origin not writable, commit kept local. See report below for hash."
git log --oneline -1
```

### 部分 D：归档不开 PR

**不需要 PR**——归档是单方面动作，无需 review。直接 commit 到 main（如果可写就 push）。

如果 Hotpursuit 有 main 分支保护规则禁止直接 push，则改为：

- 创建分支 `chore/archive-2026-05-07`
- push 该分支
- 开 PR 但**立刻 self-merge**（或留给 Dan merge）

## 验收标准

- [ ] `Hotpursuit/README.md` 顶部含归档 banner（带日期、claw42 v2.0 链接、5/9 资产去向）
- [ ] `Hotpursuit/docs/superpowers/specs/2026-05-07-v1-4-batch1-deprecated.md` 已创建
- [ ] 9 个 codex/v1-4-batch1-\* worktree 分支**仍然存在**（git branch -a 可见）
- [ ] commit message 含归档说明 + 关联到 claw42 v2.0
- [ ] 不修改 Hotpursuit 任何源代码
- [ ] 不删除任何分支
- [ ] 如 push 成功 → 报告 commit hash + remote 状态
- [ ] 如 push 失败（read-only origin）→ 报告 local commit hash + 解释为何未 push

## 约束

- ❌ 不要删除任何 worktree 分支
- ❌ 不要 force push
- ❌ 不要修改 Hotpursuit 源代码（仅 README + 新增 deprecation note）
- ❌ 不要 commit 到 v1.3.0-rc3 tag 或往前的 commit（只在 main HEAD 上加）
- ❌ 不要把 claw42 working tree 的 dirty state 带进来
- ❌ 不要用真名 Mike（用 Dan）
- ✅ 允许临时切到 `agentxmain-collab` gh 账号 push（如 origin 可写），cleanup 时切回原账号

## 完成后输出

```
T36/T37 archive: done
Commit hash: <hash>
Remote: <origin URL> (writable: yes/no)
Push: pushed / local-only (reason: ...)
README banner: present (verify with head -25 README.md)
Deprecation note: created (path: docs/superpowers/specs/2026-05-07-v1-4-batch1-deprecated.md)
Worktree branches preserved: yes (9 branches still exist)
GitHub account: restored to <ORIGINAL_GH_USER> (or unchanged if no switch)
```

## 失败处理

- **README.md 顶部已有其他 banner**：插入位置改在那个 banner 之后
- **main 分支保护**：开 PR 而非直接 push（按部分 D fallback）
- **gh auth switch 失败**：不切，只 local commit 不 push，报回
- **deprecation note 文件已存在**：停下报回，不覆盖

---
