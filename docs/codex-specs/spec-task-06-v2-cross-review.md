# Spec — Codex 对 task-06 v2 的二次副审

## 目标

对 `task-06-history-buffer-and-replay.md` v2 版本做**验收型** meta-review：

1. **R 项是否真修了**：v2 顶部"修订记录"列了 R1-R12 共 12 条修订，**逐条验证** v2 spec 里是否真的体现了修订（不是嘴上说改了，正文还是老的）
2. **是否引入新问题**：v2 改动数据模型 + 字段拆分 + 数据流分层，是否带来 v1 不存在的新风险（regression）
3. **砍掉的部分是否干净**：v2 显式砍了 load more / IntersectionObserver / banner 数量 / since 参数 / archive 页——验证 spec 里没有遗留这些内容的死片段
4. **落地 go/no-go**：验收完给明确判断

输出一份 markdown review，落到 `docs/reviews/task-06-v2-cross-review-by-codex.md`。

## 输入文件（必读，按顺序）

1. `docs/airy-tasks/task-06-history-buffer-and-replay.md`（v2，**主对象**）
2. `docs/reviews/task-06-cross-review-by-codex.md`（一次副审，作为对照）
3. `docs/airy-tasks/task-05-cache-strategy-and-deepseek.md`（依赖）
4. `docs/codex-specs/spec-act1-5-watch-page-and-hero-injection.md`（基础 spec）
5. `src/lib/llmFallbackChain.ts`（PR #11 已落地）
6. `src/modules/agent-watch/hooks/useAgentAnalysis.ts`（PR #11 已落地）
7. `src/modules/agent-watch/AgentWatchBoard.tsx`（PR #11 已落地）
8. `src/modules/agent-watch/components/MessageStream.tsx`（PR #11 已落地）
9. `src/modules/agent-watch/components/MessageBubble.tsx`（PR #11 已落地）
10. `src/modules/agent-watch/types.ts`（PR #11 已落地）

读完再动手写。

## 输出文件

唯一产出：

```
docs/reviews/task-06-v2-cross-review-by-codex.md
```

不修改其他文件。

## 分支策略

```
git fetch origin
git checkout main
git pull origin main
git checkout -b docs/task-06-v2-cross-review-01
# 实现
git push origin docs/task-06-v2-cross-review-01
# 开 PR 到 main
```

PR 目标 main，纯文档 PR，无 staging preview。

## 输出文件结构

```markdown
# Codex 对 task-06 v2 的二次副审

> 评审者：Codex
> 评审日期：YYYY-MM-DD
> 评审输入：v2 spec + 一次副审 + PR #11 现有代码
> v1 副审：docs/reviews/task-06-cross-review-by-codex.md

---

## Part A — R1-R12 修订验收（核心）

逐条对 v2 顶部修订记录里的 R1 到 R12，输出：

### R1 — 数据模型消息级

- v1 副审来源：Part A §1/§3/§6 + Part B1
- v2 spec 体现位置：Section 2.1 `HistoryMessageEntry` 类型 + Section 4.1 `pushHistoryFromBatch` flatten + Section 5/6 API 返回 entries
- 验收结论：完全修 / 部分修 / 未修
- 证据（spec 行号）：
- 还有遗漏：

### R2 — generatedAt / servedAt 拆分

- v1 副审来源：Part B9 + Part A §5
- v2 spec 体现位置：Section 2.2 字段拆分 + Section 4.2 cache hit 只更新 servedAt
- 验收结论：
- 证据：
- 还有遗漏：

（按相同格式继续 R3 到 R12）

---

## Part B — 是否引入新问题（regression 检查）

v2 相对 v1 引入的新设计点：

- 数据流分层（historyMessages / liveQueue）
- forwardRef + useImperativeHandle 暴露 scrollToLatest
- mergeHistoryAndLive 函数
- formatAgentMessageTime 替换现有 formatTime
- visibility 切回时强制 fetch（不用旧 data）

每个新设计点扫一次：是否有 v1 不存在的新边界 / 性能 / 兼容性问题？

至少 5 条 regression candidate（无问题也要列出来证明扫过）。

---

## Part C — 砍掉部分是否干净

v2 显式砍掉：

- load more / hasMore
- IntersectionObserver
- Banner 显示数量（{count} 占位符）
- API since 参数
- /agent/archive 页面
- v2 文案占位符 {count} / {minutes}

逐项扫描 v2 spec 全文，确认：

- 是否有遗漏未删的引用（比如 i18n 字段还留 dismissAriaLabel 但 banner 实际使用了？这条是 OK 的因为 v2 banner 有关闭按钮——但要确认）
- 是否有错引（比如 grep 验收里仍要求 IntersectionObserver 出现）

每条给"清干净 / 残留 / 错引"判断。

---

## Part D — 漏掉的修订（v1 副审没覆盖但 v2 应该考虑）

v1 副审关注的角度有限。v2 重写后 Codex 用更全的视角再扫一遍：

至少 3 条 v1 副审没提到、但 v2 spec 暗藏的问题。

如果真的没有，明确说"v1 副审已覆盖所有重要风险"。不要硬凑。

---

## Part E — 实现可行性

假设 Airy / Codex 现在拿 v2 spec 开工，按 task 13 grep gate 顺序走：

1. task-05 已合并的 grep gate 是否真能挡住意外（FRESH_TTL_MS / STALE_TTL_MS / backgroundRefreshInFlight / visibilitychange）
2. v2 的 8 个改动点是否互相独立（可拆 commit）还是高耦合（必须一次性 push 才能编译通过）
3. 实现工时估算（小时 / 半天 / 天）

---

## Part F — 最终建议

- v2 落地评估：**直接落地 / 微调后落地 / 重设**
- 必须修复的清单（如有）
- Airy 接 vs Codex 接 的建议（基于改动复杂度）
```

## 评审纪律

**禁止附和**。v2 是 F 应用一次副审反馈后写的——但这不代表 v2 没有新问题。F 在重构时可能引入新错误。

具体：

- v2 顶部说"R1 修了"，要看 spec 正文是不是真改了，还是只在修订记录里写了一句
- 砍掉部分要扫全文，不能只看砍掉宣言不验证残留
- v1 没问题不代表 v2 没问题，反之亦然

每条评审必须给具体证据（spec 行号 / 代码引用）。

## 输出验收

- [ ] `docs/reviews/task-06-v2-cross-review-by-codex.md` 文件存在
- [ ] Part A 覆盖 R1-R12 所有 12 条修订（逐条结论 + 证据）
- [ ] Part B 至少 5 条 regression 检查
- [ ] Part C 每个砍掉项都验证（至少 6 项）
- [ ] Part D 至少 3 条新问题或明确说"无新问题"
- [ ] Part E 工时估算 + commit 拆分判断
- [ ] Part F 明确 go/no-go
- [ ] 不修改 task-06 v2 / 任何 spec / 任何 src/ 代码
- [ ] `git diff --name-only main..HEAD` 只显示 1 个新文件

## 写作纪律

- 用中文
- 短句长句交替
- 下判断明确：完全修 / 部分修 / 未修；清干净 / 残留 / 错引；直接落地 / 微调 / 重设
- 禁用词：值得注意的是 / 综上所述 / 赋能 / leverage 等
- 不附和，但也不为了找问题硬凑

## 约束

- 不修改 task-06 v2 / 任何 spec / 任何 src/ 代码
- 不写代码
- 不引用外部资料
- 文件名严格：`task-06-v2-cross-review-by-codex.md`

## 提交与 PR

1. 从 main 拉 `docs/task-06-v2-cross-review-01`
2. 写完二次副审文件
3. Commit message：

   ```
   docs(review): cross-check task-06 v2 (post-revision verification)

   - Part A: R1-R12 revision verification with spec line evidence
   - Part B: regression candidates from v2's new design
   - Part C: confirm v2-cut items have no residue
   - Part D: new findings v1 review missed
   - Part E: implementation feasibility + commit-split judgment
   - Part F: final go/no-go
   ```

4. Push + 开 PR 到 `main`

## 有疑问不要猜

- 某条 R 修订在 v2 spec 里找不到对应位置 → Part A 标记"未在正文找到"，给修订记录的位置
- 砍掉项有遗漏残留 → Part C 给具体行号
- 实现工时估算不确定 → 给区间（"3-6 小时"）+ 不确定性来源

---

_维护者: F_
_创建: 2026-04-26_
_执行者: Codex_
_副审目标: docs/airy-tasks/task-06-history-buffer-and-replay.md（v2）_
