# Spec — Codex 对 task-06 v3 的三次副审

## 目标

对 `task-06-history-buffer-and-replay.md` v3 版本做**收口型** meta-review：

1. **V1-V8 是否真改了**：v3 顶部"v3 修订记录"列了 V1-V8 共 8 条（来自二次副审 PR #13 反馈），逐条验证 v3 spec 里是否真改到位
2. **是否引入新问题**：v3 改动覆盖类型名、字段语义、hook 签名、forwardRef 保留、i18n 替换点等，是否带来 v2 不存在的新边界
3. **v2 已改的 R1-R12 是否被 v3 覆盖时撞坏**：r 修订和 V 修订之间是否有冲突
4. **落地 go/no-go**：明确判断，**不再无限副审**

输出一份 markdown review，落到 `docs/reviews/task-06-v3-cross-review-by-codex.md`。

## 输入文件（必读）

1. `docs/airy-tasks/task-06-history-buffer-and-replay.md`（v3，**主对象**）
2. `docs/reviews/task-06-cross-review-by-codex.md`（一次副审）
3. `docs/reviews/task-06-v2-cross-review-by-codex.md`（二次副审，**V1-V8 来源**）
4. `docs/airy-tasks/task-05-cache-strategy-and-deepseek.md`
5. `docs/codex-specs/spec-act1-5-watch-page-and-hero-injection.md`
6. PR #11 现有代码：
   - `src/lib/llmFallbackChain.ts`
   - `src/modules/agent-watch/types.ts`
   - `src/modules/agent-watch/hooks/useAgentAnalysis.ts`
   - `src/modules/agent-watch/AgentWatchBoard.tsx`
   - `src/modules/agent-watch/components/MessageStream.tsx`（**特别注意**：v3 V6 修订要求保留现有 autoScroll 逻辑，副审要确认 v3 spec 对这部分描述准确）
   - `src/modules/agent-watch/components/MessageBubble.tsx`

## 输出文件

唯一产出：

```
docs/reviews/task-06-v3-cross-review-by-codex.md
```

## 分支策略

```
git fetch origin
git checkout main
git pull origin main
git checkout -b docs/task-06-v3-cross-review-01
git push origin docs/task-06-v3-cross-review-01
# 开 PR 到 main
```

纯文档 PR，无 staging preview。

## 输出文件结构

```markdown
# Codex 对 task-06 v3 的三次副审

> 评审者：Codex
> 评审日期：YYYY-MM-DD
> v1 副审：docs/reviews/task-06-cross-review-by-codex.md
> v2 副审：docs/reviews/task-06-v2-cross-review-by-codex.md
> 收口判断：本次为最后一轮副审，结论必须明确 go/no-go

---

## Part A — V1-V8 修订收口验收

逐条检查 v3 顶部"v3 修订记录"里的 V1 到 V8，输出：

### V1 — 类型名对齐（TickerMap / StreamMessage）

- v2 副审来源：B1 / D1（P0 编译挂）
- v3 体现位置：spec 全文哪些 Section 引用了正确的 `TickerMap` / `StreamMessage`
- 验收结论：完全修 / 部分修 / 未修
- 证据（v3 行号 + 现有代码 types.ts 行号交叉对照）：
- 还有遗漏：

### V2 — locale 解构

- v2 副审来源：B6 / D4（P0 编译挂）
- v3 体现位置：Section 8 AgentWatchBoard snippet
- 验收结论：
- 证据：
- 还有遗漏：

（按相同格式继续 V3 / V4 / V5 / V6 / V7 / V8）

---

## Part B — V 修订有没有撞坏 R1-R12

V 修订是基于 v2 副审的反馈。但 v2 副审本身基于 R1-R12（v1 副审）。可能存在：

- V 修订改 X 时不小心破坏了 R 修订
- V 修订写法和 R 修订风格不一致

至少扫描 R1 / R2 / R3 / R6 / R8 / R9 / R10 / R11（核心修订）是否仍然成立。

---

## Part C — V3 引入的新问题（regression 检查）

v3 相对 v2 引入的新设计：

- `useAgentHistory` 暴露 `refreshHistory()` 函数
- `AgentWatchBoard` 加 `useEffect(hasNewContent → refreshHistory)`
- banner 点击 onClick 改 async 函数
- liveQueue id 规则强制 `${latest.generatedAt}-...`
- `MessageStream` `useImperativeHandle` 增补 + 保留现有 autoScroll
- grep gate 改 `set -e + grep -q + exit 1`

每个新设计点至少扫一次：是否引入了 v2 不存在的新风险？

至少 3 条 regression candidate（无问题也要列出来证明扫过）。

---

## Part D — 落地评估（最终 go/no-go）

**注意：本次为最后一轮副审。结论必须是 go 或 no-go 二选一**，不能再"微调后落地"——如果还需要微调，明确列出来 Dan 自行判断是否走第四轮。

### 选项

(A) **GO**：v3 已 ready，可以直接交 Codex 实现 PR #11 同分支三段拆分。

- 列出 v3 落地最大风险（仍然 acceptable 的）

(B) **NO-GO**：v3 仍存在阻塞性问题，必须修。

- 列出阻塞清单（每条标 P0/P1）
- 给修订指引（具体到代码 / spec 片段）

### 实现执行建议

不论 A 还是 B，给：

- Codex 实现工时估算
- 三段 commit 拆分细化（每段必须能独立编译通过）
- 哪些自动化校验必须在 PR 里跑（tsc / build / grep gate / lint）
```

## 评审纪律

**这是最后一轮副审，没有第四次。**

具体：

- 每条 V 修订的验收结论必须是"完全修 / 部分修 / 未修"三选一
- Part D 必须是"GO"或"NO-GO"二选一，不要 "微调后落地" 的中间态
- 找问题要找会真实导致编译失败 / 用户可见 bug / 上线风险的——不要钻纸面措辞的牛角尖
- 即使 Codex 觉得 v3 完美，也要给 Part D 风险清单（任何方案都有风险）

## 输出验收

- [ ] `docs/reviews/task-06-v3-cross-review-by-codex.md` 文件存在
- [ ] Part A 覆盖 V1-V8 所有 8 条修订（逐条结论 + 证据）
- [ ] Part B 至少扫描 R1 / R2 / R3 / R6 / R8 / R9 / R10 / R11
- [ ] Part C 至少 3 条 regression 检查
- [ ] Part D 明确 GO 或 NO-GO（不要中间态）
- [ ] 不修改 task-06 v3 / 任何 spec / 任何 src/ 代码
- [ ] `git diff --name-only main..HEAD` 只显示 1 个新文件

## 写作纪律

- 用中文
- 短句长句交替
- 下判断明确：完全修 / 部分修 / 未修；GO / NO-GO
- 禁用词：值得注意的是 / 综上所述 / 赋能 / leverage 等

## 约束

- 不修改 task-06 v3 / 任何 spec / 任何 src/ 代码
- 不写代码
- 不引用外部资料
- 文件名严格：`task-06-v3-cross-review-by-codex.md`

## 提交与 PR

1. 从 main 拉 `docs/task-06-v3-cross-review-01`
2. 写完三次副审文件
3. Commit message：

   ```
   docs(review): final cross-check of task-06 v3 — go/no-go verdict

   - Part A: V1-V8 verification (verdict: 完全修/部分修/未修)
   - Part B: V修订 vs R修订 collision check
   - Part C: regression candidates from v3 new design
   - Part D: final GO or NO-GO + implementation guidance
   ```

4. Push + 开 PR 到 `main`

---

_维护者: F_
_创建: 2026-04-26_
_执行者: Codex_
_副审目标: docs/airy-tasks/task-06-history-buffer-and-replay.md（v3）_
_这是最后一轮副审，Codex 必须给明确 GO 或 NO-GO_
