# Spec — Codex 对 Task 06（历史沉淀 + 轮播）的副审

## 目标

不写代码，只对 F 的设计 spec 做 meta-review。两层：

1. **逐节挑刺**：对 Task 06 spec（`docs/airy-tasks/task-06-history-buffer-and-replay.md`）每个 Section 找设计漏洞 / 遗漏 / 性能风险 / 一致性问题
2. **独立补**：F 没想到的边界场景、生产事故风险、和 Task 05 / PR #11 现有代码的潜在冲突

输出一份 markdown review，落到 `docs/reviews/task-06-cross-review-by-codex.md`。

## 输入文件（必读，按顺序）

1. `docs/codex-specs/spec-act1-5-watch-page-and-hero-injection.md` — Act 1.5 主 spec（PR #11 实现依据）
2. `docs/airy-tasks/task-05-cache-strategy-and-deepseek.md` — Task 05 stale-while-revalidate spec（即将合并）
3. `docs/airy-tasks/task-06-history-buffer-and-replay.md` — **本副审目标**
4. `src/lib/llmFallbackChain.ts`（PR #11 已落地）— 现有 cache + provider chain 实现
5. `src/modules/agent-watch/hooks/useAgentAnalysis.ts`（PR #11 已落地）— 现有 polling hook
6. `src/modules/agent-watch/AgentWatchBoard.tsx`（PR #11 已落地）— 主容器
7. `src/modules/agent-watch/components/MessageStream.tsx`（PR #11 已落地）

读完再动手写。**不要凭记忆**——每条评审回到具体代码或 spec 行号。

## 输出文件

唯一产出：

```
docs/reviews/task-06-cross-review-by-codex.md
```

不修改其他文件。**不要动** 任何 spec / 任何 src/ 代码。

## 分支策略

```
git fetch origin
git checkout main  # 注意：从 main 拉，不从 PR #11 分支拉，避免污染
git pull origin main
git checkout -b docs/task-06-cross-review-01
# 实现
git push origin docs/task-06-cross-review-01
# 开 PR 到 main
```

PR 目标 main，纯文档 PR，无 staging preview 需求。

## 输出文件结构

```markdown
# Codex 对 Task 06 的副审

> 评审者：Codex（OpenAI Codex）
> 评审日期：YYYY-MM-DD
> 评审输入：
>
> - docs/airy-tasks/task-06-history-buffer-and-replay.md（主对象）
> - docs/airy-tasks/task-05-cache-strategy-and-deepseek.md（依赖）
> - docs/codex-specs/spec-act1-5-watch-page-and-hero-injection.md（基础 spec）
> - PR #11 已落地代码

---

## Part A — Task 06 逐节挑刺

按 task-06 的 Section 1-12 顺序，每节给出：

- **该节核心设计**：一句话复述
- **风险 / 漏洞**：发现的问题（明确点出，不模糊）
- **F 的实现路径是否最优**：是 / 部分 / 否 + 替代方案
- **改进建议**：具体到代码层面（行号 / 函数名 / 数据结构）

每个 Section 至少 1 条具体反馈，不允许 "看起来 OK" 这种水帖。

---

## Part B — 独立补充（F 漏掉的边界）

每条按 P0 / P1 / P2 分级，标注：

- 位置（涉及 task-06 哪节 / 涉及现有代码哪个文件）
- 问题
- 建议
- 为什么 F 可能漏掉

### B-Z. Codex 必扫的角度（spec 里 F 自检之外）

至少回应这 8 个角度（可证明无问题，但必须扫过）：

1. **PR #11 现有 keepFivePerAgent 和 task-06 的预灌历史会冲突吗？**
   - keepFivePerAgent 在前端 state 里只保留每 Agent 5 条
   - 预灌 60 条历史会被这个限制截断到 15 条吗？
   - 如果是，预灌价值大幅缩水，需要决策：放宽 keepFivePerAgent 上限 vs 区分"历史 stream" 和 "live stream" 两个数据源
2. **task-05 stale-while-revalidate 和 task-06 pushHistory 的时序耦合**
   - stale 命中时不调 LLM → 不进 pushHistory → 历史档案空窗
   - 实际 LLM 调用频率 = 全站 5 分钟 1 次（fresh 期）+ 30 分钟后台 refresh（stale 期）
   - 用户在低活跃期访问，历史 buffer 累积速度可能远低于 spec 估计的"5 min/batch"
   - 这影响 Section 11 的 "{minutes} / 5min × 3" 估算公式准确性
3. **Vercel serverless 实例 lifecycle vs ring buffer 持久性**
   - 实例可能因为 idle 被 spin down（具体阈值）
   - spin down 后 ring buffer 全部清零
   - 用户访问触发 cold start → buffer 空 → first batch 才开始累积
   - 这个体验是否 acceptable？还是应该至少在 cold start 时返回一份"启动种子"内容？
4. **`/api/agents/history` 路由的 runtime: nodejs 强制要求**
   - F 写了 `export const runtime = "nodejs"` —— 但 Vercel free tier 的 nodejs 函数比 edge 慢且贵
   - 是否可以用 edge runtime + 全局 `Map` 跨函数实例共享？（不能，edge runtime 是真正 isolated）
   - 推荐方案：保持 nodejs，但加 `revalidate` 让 history API 走 ISR cache
5. **IntersectionObserver load more 在移动端 Safari 的行为**
   - IntersectionObserver 在 iOS Safari 14+ 才稳定
   - rootMargin 在 sticky 容器内可能行为异常
   - 有兼容性 fallback 吗？或 sentinel 高度 1px 在 mobile 是否真触发？
6. **新内容 banner 的 race condition**
   - 用户切走 tab 时 `lastSeenTsRef.current = data.ts`
   - 切回时如果 `data` 还没更新（polling 没跑），对比 ts 还是相同
   - 应该等切回后 polling 完成再对比，不是 visible event 触发瞬间
   - 这是设计 race condition，前端实现要处理
7. **历史 entries 的 timezone / locale 显示**
   - entries 带 `ts: epoch ms`
   - 前端展示时间戳要按用户 locale 格式化（"14:07" vs "2:07 PM"）
   - 现有 PR #11 MessageBubble 时间戳是怎么处理的？需要扩展吗？
8. **buffer 序列化 / GC 风险**
   - `historyBuffer.push()` + `slice(-200)` 每次创建新数组
   - 高频 LLM 调用时（理论极端：每秒 1 次），可能产生 GC 压力
   - 现实上 Task 05 后是 5min/次，没问题——但 spec 里要明确这个边界

每条至少给：是否成立 / 严重程度 / 修复建议 / 是否阻塞 task-06 落地。

---

## Part C — 最终建议（Codex 给 Dan）

- task-06 现状评估：**直接落地 / 微调后落地 / 重新设计**
- 3-5 条最高优先级修订（按编号引用 Part A / Part B）
- 是否建议把 task-05 和 task-06 顺序调换（先做沉淀再做 cache 优化，或反之）
```

## 评审纪律（最重要）

**禁止附和**。F 是有偏见的（曾在前几轮 cross-review 被 Codex 找出多个漏洞）。Codex 对每条意见必须独立判断。

具体反 anti-rationalization：

- F 写"P0 必须解决"——如果 Codex 看完原文觉得不至于 P0，改判 P1 + 解释为什么不至于 P0
- F 写"实现路径推荐 X"——如果 X 在生产环境有性能 / 成本 / 兼容性问题，给替代方案
- F 提的"风险"在 PR #11 现有代码中其实有 mitigation——明确指出 F 漏读了哪行代码
- 即使 Codex 觉得整体设计合理，也必须找出至少 3 条具体问题（spec 复杂度高，零问题不可能）

**禁止泛泛肯定**。"这个设计合理" / "考虑得很周到" 是无效评审。要给出具体的：

- 这条决策生效后会改变什么具体行为
- 不修订的代价是什么
- 修订成本（改几行代码 / 改几个文件 / 不改）

## 输出验收

- [ ] `docs/reviews/task-06-cross-review-by-codex.md` 文件存在
- [ ] Part A 覆盖 task-06 spec 的所有 13 个 Section（每节至少 1 条具体反馈）
- [ ] Part B "Codex 必扫 8 个角度" 每个都有回应（可证明无问题，但必须扫过）
- [ ] Part B 至少 5 条独立补充（不重复 F 已提）
- [ ] Part C 给出明确的"直接落地 / 微调 / 重设" 三选一判断
- [ ] 不修改 task-06 原文档 / 任何 spec / 任何 src/ 代码
- [ ] `git diff --name-only main..HEAD` 只显示 1 个新文件

## 写作纪律

- 用中文（评审输入是中文，输出对齐）
- 短句 + 长句交替，节奏感
- 下判断要明确——"成立 / 部分成立 / 不成立"三选一
- 禁用词：值得注意的是 / 综上所述 / 赋能 / leverage 等 AI 味词全部禁用
- 禁止给名词加引号 / 书名号做强调

## 约束

- 不修改 task-06 / 任何 spec / 任何 src/ 代码
- 不写代码
- 不引用外部资料（评审只基于上述输入文件 + PR #11 现有代码）
- 文件名严格：`task-06-cross-review-by-codex.md`

## 提交与 PR

1. 从 main 拉 `docs/task-06-cross-review-01`
2. 写完 cross-review 文件
3. Commit message：

   ```
   docs(review): cross-check task-06 history buffer + replay design

   - Part A: section-by-section review of F's task-06 spec
   - Part B: 8 mandatory angles + independent additions
   - Part C: top 3-5 priority revisions + go/no-go judgment
   ```

4. Push + 开 PR 到 `main`

## 有疑问不要猜

- task-06 某条 section 引用的 spec 字段在主 spec 里找不到 → Part A 写明 "spec 引用断链，需 F 补具体位置"
- Codex 不确定 Vercel serverless lifecycle 具体 timeout → 标注为 "需 Dan 确认 Vercel 计划下的实例 idle threshold"
- 评审到一半发现 task-05 和 task-06 的 cache 行为耦合产生新问题 → 在 Part B 单独立一条，不在 Part A 重复

---

_维护者: F_
_创建: 2026-04-26_
_执行者: Codex_
_基于: main + PR #11 已落地_
_副审目标: docs/airy-tasks/task-06-history-buffer-and-replay.md_
