# spec-watch-B-master-pipeline-evolution (v1.2 · 2026-05-15)

> **B 模块 master 路线图 spec** — 把 watch dispatch console 后端从"7 real TeamMember + 12 DispatchAgent (5 mapped + 7 synthetic) / 单 round / fixture-only / polling / no follow-trade"演进到"14 real TeamMember + 12 DispatchAgent 全 mapped real（含 memory_loop） / multi-round trace / streaming / SSE / follow-trade mock+real / writer 全闭环"。
>
> **本 spec 设计意图**：让 Codex 拿到本文档可以**长时间按顺序运行 B.2-B.9 全部 8 phase**，phase 间通过自动 gate（CI + verify + spec 验收）切换，不需要 F/Dan 中间介入除非：[SPEC-FEEDBACK] >2 / writer 越界 / prod 越界 / B.8 等 Dan 解锁。
>
> **核心范围**：
> - **B.2** 14 真 TeamMember dispatch upgrade（**7→14 真升级**：升级所有 7 个 synthetic 为 real TeamMember——6 dispatch synthetic role + memory_loop，含 LLM prompt / role / desc / provider；dispatch 12 全 mapped real，0 synthetic）
> - **B.3** Multi-round debate trace（schema v2 + structured rounds array + 每 stage 多 round；types in `strategyDecisionRecord.ts`）
> - **B.4** Partial stage writes / streaming（**narrow cron exception** 改 cron 调度部分，不动 resolution writer 逻辑）
> - **B.5** Topic ranking + intensity v2（severity × confidence × news 综合 + ranking explanation）
> - **B.6** Polling → SSE（**复用现有 `/api/watch/stream` 不新建** + 客户端切换 + graceful degrade）
> - **B.7** Decision history wall（**新建 `/api/watch/decision-history` 不动现有 history** + history wall UI）
> - **B.8** Real CoinW execution / follow trade（**默认 disabled + 等 Dan 拍板 → 解锁后跑 mock；narrow v10 exception** 允许改 MarketAnalysisPanel.tsx 跟单文案 / state；real CoinW API 留下轮独立 spec）
> - **B.9** Post-trade review writeback（manual_close real writer + **加 `manual_close_requested` reason union + 加 `admin_manual` MarketDataSource union**；types in `strategyDecisionRecord.ts` / writer return union in `decisionResolution.ts`；显式解冻 B.1 冻结的 writer 文件）
>
> **不在范围**：
> - real CoinW API live trading（B.8 解锁 mock，real 在下轮独立 legal/security/API spec）
> - A1 owned 视觉权威（v10 hero / constellation / flow / layout / class —— 仅 B.8 narrow exception 允许改 MarketAnalysisPanel.tsx 跟单按钮文案 / state）
> - prod 双线部署（仅 staging / preview）
> - schema v3+ 演进
>
> **架构定位**：B 模块（底层逻辑 + 技术实现）剩余 phase 整合 master。base main HEAD = `2bf2c48e7569875dd625a622115f6657925dd1f3`（v1.1 spec docs `3773fbe` + format fix `2bf2c48`）。v1.2 docs commit 由 Codex T000 推进。
>
> **v1.2 修订原因**：v1.1 第 2 轮评估 3 条 P1：(1) B.2 数学冲突（5 + memory_loop ≠ 12，Dan 重拍板 = 14 真升级 + dispatch 12 全 mapped real）/ (2) B.3 / B.9 schema 与 writer types 文件归属错（schema in `strategyDecisionRecord.ts`，writer return in `decisionResolution.ts`，不是 `teamRegistry.ts`）/ (3) B.9 `admin_manual` 不在当前 `MarketDataSource` union（`"coinw-kline" | "coingecko-ticker" | "fallback"`）—— 显式加 union 值。

---

## 0. 必读纪律

### 0.1 三层防御
- **层 1 跨域刷新**：每 phase 开始前 cat 实测对应主 schema / API / fixture 文件（不靠记忆 / 不靠 master spec 文字）
- **层 2 首件检验**：每 phase 第一个产物落地后跑 1 个端到端 case（adapter test + staging preview snapshot），通过后再批量
- **层 3 同根因熔断**：同类 schema 命名错连续出现 2 次 → 立即停 + 退到 schema 对照表重做

### 0.2 双脑诊断
Codex 每 phase 实施前必须自己下判断 + 写到 codex-to-claude.md（§ 18 列每 phase 的必填判断点）。

### 0.3 Anti-rationalization
- "B.x 工作量大不如拆小" → ❌ master spec 已按依赖图划 phase，phase 内进一步拆是 trivial 自决
- "B.8 mock 模式简单顺便接 real CoinW API" → ❌ real CoinW 是独立 legal/security 决策，硬停
- "B.9 解冻 writer 顺手优化 writer 逻辑" → ❌ B.9 仅加 manual_close 路径 + reason union，不重构现有 writer
- "phase A merge 不等 CI 直接跑 phase B" → ❌ 每 phase merge 前 CI 必须绿；phase 间 gate 是硬纪律
- "B.4 narrow exception = cron 文件全开放" → ❌ B.4 仅改 cron 调度逻辑，零行涉及 resolution writer 调用（grep gate 验证）
- "B.8 narrow v10 exception = v10 module 全开放" → ❌ B.8 仅改 MarketAnalysisPanel.tsx 跟单按钮文案 + state，不动 layout / class / hero / constellation

### 0.4 Phase 间 gate（自动判定）

每 phase 结束后 Codex 自动判定能否进下一 phase：
- ✓ CI 全绿
- ✓ spec 验收 § 11 PR 所有 SC PASS
- ✓ Writer 冻结 grep gate：`git diff origin/main -- src/lib/team/decisionResolution.ts` = 0（**B.9 唯一例外**）
- ✓ Cron narrow gate：`git diff origin/main -- src/app/api/cron/strategy-replay/route.ts` 涉及 `resolveOpenPmDecisions|resolveDecisionRecordFromPrice|decisionResolution` 行数 = 0（**B.4 narrow exception 允许改其他调度行 + B.9 解冻**）
- ✓ A1 owned zero diff：`git diff origin/main -- src/modules/agent-watch/v10/** src/app/[locale]/agent/page.tsx` 应为 0（**B.8 narrow exception 仅允许 `MarketAnalysisPanel.tsx` 跟单按钮文案 / state 改动**）
- ✓ Prod 双线 zero touch：无 `--prod` / 无 CoinW GitLab / 无 Jenkins
- ✓ Vercel preview READY + visual 没明显 regression

**任一不通过 → Codex 立即停 + 报 F，不擅自降级 / 不跳到下一 phase**。

### 0.5 A/B 并行 redline（vs A 模块）

**A1 owned（B master 全程不动，除显式 narrow exception）**：
- `src/modules/agent-watch/v10/**`
- `src/modules/agent-watch/AgentWatchBoard.tsx` 的 console seam + props bridge（B 可加 ctx 字段，不改 seam 结构）
- `src/app/[locale]/agent/page.tsx`
- Hero / Constellation / FlowPanel / 视觉

**A1 owned narrow exception（B.8 phase 唯一允许）**：
- `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx`：仅 follow-related button 文案 / disabled state / mock execution click handler；不动 layout / class / hero / constellation 视觉
- 所有 B.8 改动 grep `git diff -- src/modules/agent-watch/v10/MarketAnalysisPanel.tsx` 必须仅涉及 follow-related 行

**B owned（master 全 phase 可改）**：
- `src/lib/watch/v9TopicAdapter.ts` + 所有 lib/watch/* 文件
- `src/lib/team/**`（B.1 冻结的 `decisionResolution.ts` 仅 B.9 显式解冻）
- `src/lib/storage/**`（KV store / rate limiter）
- `src/app/api/watch/**` + `src/app/api/cron/**`（cron narrow exception 见 § 0.4）
- `src/i18n/dicts/*.json` + `src/i18n/types.ts`（B 系列新 namespace）
- `src/modules/agent-watch/v9/types.ts`（数据契约，B 可改）
- `src/modules/agent-watch/v9/TopicStrategy.tsx`（**v9 内含跟单 UI** —— B 可改 follow-related 部分；不破 layout / class / v9 视觉权威）

**Codex 自决但不可越界**：
- 任何新 lib 文件命名 / 文件位置 → B owned 自决
- test fixture 增减 → B owned 自决
- i18n key 命名表 → 按 § 7.x 给的 namespace 设计

**完全不动**：
- prod 双线（Tier 1 ai.coinw.com / Tier 2 claw42.ai）
- 主 worktree WIP files
- 双 prod CI / Jenkins / Vercel prod env

---

## 1. Summary

把 B 模块从 B.1 hardening 完成后的 main 状态推进到 12 真 TeamMember + multi-round + streaming + SSE + follow-trade mock 闭环。每 phase 独立 PR + 独立 verify gate + 自动 phase 切换。B.8 real CoinW execution 在 phase 开始时硬停等 Dan 拍板进入 mock execution mode。

**用户感知层（按 phase 累积）**：
- B.2 后：watch board 决策由 14 真 AI 角色产出（7 个 synthetic 升级为真 LLM call + 真 prompt + 真 rationale —— 6 个 dispatch role + memory_loop 真复盘主管；dispatch 12 全真，无 synthetic 占位）
- B.3 后：每个决策 stage 可看多轮辩论历史（round 1 → 2 → 3 trace）
- B.4 后：决策 stage 进行中状态实时刷新（不再"突然全部就绪"）
- B.5 后：topic 卡片按 intensity 排序 + 给出 explanation
- B.6 后：数据更新近实时（SSE，不再 5s polling）
- B.7 后：可点开 decision 看历史 wall（同 symbol 过往决策）
- B.8 后（解锁前）：UI 不变；（解锁后 mock）：Follow 按钮 click → 模拟下单 → 假成交回流 + 跟单记录
- B.9 后：人工平仓决策也能正常 writer 写入 + adapter 渲染 + memory_loop 真复盘

---

## 1.5 User Stories（按 phase）

### US-B2 — 14 真 AI 角色决策（P1）
**作为** 看 watch board 的访客
**我希望** 看到完整 14 真 AI 角色（7 个之前 synthetic 角色升级为真 LLM call + 真 rationale —— 6 个 dispatch role + memory_loop 真复盘主管；dispatch 12 全真 mapped）
**这样** 决策来源跟真实 team registry 对齐，不是"幽灵 7 个角色"

### US-B3 — Multi-round 辩论历史（P1）
**作为** 决策 reader
**我希望** 看到每个 stage 多轮辩论 trace（如 analyst 第 1 轮看 a / 第 2 轮看 b）
**这样** 我能判断决策是经过深度讨论的，不是单轮拍板

### US-B4 — 实时 progress 反馈（P2）
**作为** 看 watch board 的访客
**我希望** stage 进行中能看到 in-progress 状态（不是突然全 done）
**这样** 我感受到 AI 真在工作不是预生成

### US-B5 — Topic ranking 透明（P2）
**作为** 看多个 topic 的 reader
**我希望** topic 卡片有排序理由（"为什么 BTC 排第 1"）
**这样** 我理解为什么这个 topic 优先

### US-B6 — 实时数据更新（P3）
**作为** 长时间停在 watch board 的访客
**我希望** 新数据近实时推送（不是等下次 polling）
**这样** 体验跟交易终端一致

### US-B7 — 历史 decision 回看（P2）
**作为** 想看同 symbol 历史的 reader
**我希望** AgentWatchBoard 加 "决策历史" 入口 → 展开 decision wall
**这样** 我能判断 AI 在这个 symbol 上的胜率 / 历史 pattern

### US-B8（解锁前） — Follow 按钮告知不可点（P0 safety）
**作为** 访客
**我希望** 跟单按钮（v9 TopicStrategy + v10 MarketAnalysisPanel 两处）明显 disabled + 文案告知"演示模式 / 不真实下单"
**这样** 我不会误以为点了就真下单

### US-B8（mock 解锁后） — Mock 跟单完整闭环（P1）
**作为** Dan 测试跟单 UX
**我希望** click Follow（v9 / v10 任一）→ 模拟 API call → 假成交回流 + 跟单 stats + memory loop 写假 outcome
**这样** 我能 review 整个跟单链路 UX 再决定是否接 real CoinW

### US-B9 — manual_close 真实闭环（P2）
**作为** Dan / 后续运营
**我希望** 人工平仓决策（admin API 触发）也能被 writer 处理 + memory_loop 显示对应 outcome + reason 文案
**这样** 4 种 outcome 都不再是"writer 不产 / 仅 UI 兼容"的 dead branch

---

## 2. Acceptance Scenarios

### AC-B2 — 14 真 AI 角色 + dispatch 12 全 mapped
**Given** B.2 merge 后，7 个 synthetic 角色全部升级 real（6 dispatch role + memory_loop，含 LLM prompt / role / desc / provider）
**When** pmDecisionPipeline 跑一次完整 decision
**Then** TeamMemberId union = 14 + `contributorIds` 含相应 real TeamMemberId + dispatchAgentMapping 12 全 mapped real（`DISPATCH_AGENT_NOT_IN_CURRENT = []` 空数组）+ memory_loop 真参与 + UI flow stage-6 显示 memory_loop 真 reflection

### AC-B3 — Multi-round 显示
**Given** schema v2 含 `rounds[]` 数组
**When** Topic render
**Then** stage 内 message 按 round 分组 + 显示 round 编号 + agent 在不同 round 可有不同立场

### AC-B4 — Partial stage 进度
**Given** Public payload `stages[]` 含 `status: "in_progress" | "done" | "pending"`
**When** AgentWatchBoard 轮询接收 partial update
**Then** stage marker 从 pending → in_progress → done 流式切换 + UI 不闪烁

### AC-B5 — Topic 排序解释
**Given** Public payload 含 `topicRanking: { score, explanation }`
**When** TopicList render
**Then** topic 按 score desc 排序 + 卡片底部显示 explanation 短文案

### AC-B6 — SSE 实时
**Given** AgentWatchBoard 跑现有 `/api/watch/stream` SSE 端点
**When** 新 decision 进入 KV
**Then** 前端 ≤ 1s 收到 update + 渲染（不等下次 5s polling）
**And** SSE 失败 → graceful degrade 回 polling

### AC-B7 — Decision history wall
**Given** AgentWatchBoard 含 "决策历史" 入口
**When** 点击 → select symbol
**Then** 调 `/api/watch/decision-history?symbol=BTCUSDT&limit=20` + 展开同 symbol 过去 decision wall + 每条含 outcome / 时间 / intensity

### AC-B8a（解锁前）— Disabled 状态
**Given** B.8 phase 未 Dan 解锁
**When** AgentWatchBoard render（含 v9 TopicStrategy + v10 MarketAnalysisPanel 跟单按钮）
**Then** 两处按钮 disabled + tooltip "演示模式" + click 无副作用

### AC-B8b（mock 解锁后）— Mock execution
**Given** Dan 解锁 mock execution mode（feature flag `FOLLOW_TRADE_MOCK_MODE=true`）
**When** 用户 click Follow（v9 或 v10）
**Then** 触发 mock API call → 假成交回流 → 跟单 stats + memory_loop 写假 outcome

### AC-B9 — manual_close 闭环
**Given** Admin API `/api/admin/decision/[id]/manual-close` 调用 + reason 写 `manual_close_requested`
**When** writer 处理
**Then** record `resolvedOutcome: "manual_close" / resolutionReason: "manual_close_requested"` + adapter 渲染 + memory_loop msg "人工关闭（manual_close_requested 文案）" i18n 10 locale

---

## 3. Edge Cases 4 轴（合并）

| 轴 | Edge Case | Phase | 处理 |
|---|---|---|---|
| Input | 5 个新角色 LLM provider 失败 | B.2 | fallback 到 synthetic mock + dev warn；不破 decision flow |
| Input | analystInputs 长度 = 12 但缺某角色 | B.2 | 缺角色用 placeholder + dev warn，不抛错 |
| Input | rounds[] 长度 0 / 1（legacy single-round） | B.3 | 兼容渲染为单 round（不破现状） |
| Input | stage status 顺序乱（done 在 pending 前） | B.4 | 用 stageIndex 强制排序 + 状态机校验 |
| Input | topicRanking.score 全相同 | B.5 | 按 createdAt desc 二级排序 |
| Input | SSE message 乱序到达 | B.6 | 用 eventId 排序 + 丢重复 |
| Input | 同 symbol 历史 decision > 100 条 | B.7 | 分页 / 截断到最近 20 条 + "查看更多"链接 |
| Input | Follow click 重复（idempotency） | B.8 | mock idempotency key = anon_id + recordId + timestamp 分钟级 |
| Input | manual_close 但 decision 已 hit_tp/hit_sl | B.9 | 已 resolved 不重写（writer 跳过 + dev warn） |
| State | B.2 新 5 真角色 LLM cost / latency 上升 | B.2 | parallel 5 LLM call + timeout 30s + retry 2x；超 → fallback partial decision |
| State | B.3 schema v1 → v2 KV migration 中（一半 record 老 shape） | B.3 | adapter dual-shape 兼容（v1 → 单 round v2 投影） |
| State | B.6 SSE 连接超时 / 服务端崩 | B.6 | 客户端 exponential backoff + 自动回 polling |
| State | B.8 mock mode 切换时已有 active follow | B.8 | 切换前 confirm dialog + 清现有 follow state |
| Boundary | B.2 12 角色 prompt 总 token 超 LLM context limit | B.2 | analystInputs 分批 → 单 stage 一次 |
| Boundary | B.5 intensity 超 max value | B.5 | clamp + log |
| Boundary | B.7 history wall 跨 24h+ render 性能 | B.7 | 虚拟滚动 / 懒加载 |
| Boundary | B.9 manual_close 时间戳超 evaluation window | B.9 | writer 接受 + 标记 reason="manual_close_requested" |
| Failure | B.2 dispatchAgentMapping 重构期间老 message 找不到对应 agent | B.2 | fallback memory_loop synthetic 用 last-resort label |
| Failure | B.4 partial write 中断（cron timeout） | B.4 | 已写部分保留 status="in_progress"，下次 cron 续 |
| Failure | B.6 SSE endpoint 502 | B.6 | 客户端立即回 polling + 静默重试 SSE |
| Failure | B.8 mock API call 模拟失败响应 | B.8 | 用 50% 概率成功 + 50% 失败（测试两种 UX） |
| Failure | B.9 writer 跑 manual_close 后跑 cron 又跑一次 | B.9 | idempotency 检查 `resolvedAt != null` 跳过 |

---

## 4. Assumptions（master 共用）

1. base main HEAD = `2bf2c48e7569875dd625a622115f6657925dd1f3`（v1.1 spec docs `3773fbe` + format fix `2bf2c48`）；v1.2 spec docs commit 由 Codex T000 推进
2. **TeamMemberId 当前是 7 个**（`fundamental / news / chart / onchain / research_lead / risk_lead / pm`），文件在 `src/lib/team/teamRegistry.ts`
3. **DispatchAgentId 当前是 12 个**，文件在 `src/modules/agent-watch/v9/types.ts`
4. **当前 dispatchAgentMapping**：5 mapped real + 7 synthetic（在 `DISPATCH_AGENT_NOT_IN_CURRENT`）—— synthetic 列表：`bullish_researcher / bearish_researcher / trader / aggressive_reviewer / neutral_reviewer / conservative_reviewer / memory_loop`
5. **跟单 UI 实际在两处**：`src/modules/agent-watch/v9/TopicStrategy.tsx`（B owned）+ `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx`（A1 owned，B.8 narrow exception 允许）
6. **Schema types 文件归属（v1.2 实测修正）**：
   - `StrategyDecisionRecord` / `AnalystInputRecord` / `DecisionResolutionReason` / `DecisionOutcome` 在 **`src/lib/team/strategyDecisionRecord.ts`**（不是 `teamRegistry.ts`）
   - `DecisionResolutionResult` writer return union 在 **`src/lib/team/decisionResolution.ts`**
   - `MarketDataSource` 当前 union 在相关 schema 文件（Codex 实施时 grep 确认具体位置），当前值 = `"coinw-kline" | "coingecko-ticker" | "fallback"`
7. `DecisionOutcome` schema 已含 `manual_close`，但 writer 当前不产；`DecisionResolutionReason` 当前 3 个值（`take_profit_reached / stop_loss_reached / evaluation_window_elapsed`），B.9 加 `manual_close_requested`
8. `MarketDataSource` 当前 3 个值，B.9 加 `"admin_manual"`（admin API 手动平仓 价格来源标签）
9. `/api/watch/history/route.ts` 已存在（返 public timeline），B.7 不动它；新建 `/api/watch/decision-history`
10. `/api/watch/stream/route.ts` 已存在（debug SSE，`runtime = "nodejs"`），B.6 复用扩展而非新建；Edge SSE 升级 Codex 实施时 verify Vercel 支持度自决
11. KV 是 Vercel `@vercel/kv` / Upstash Redis 风格，**不支持 `If-Match` / ETag**；B.4 CAS 用 version field + atomic ops（参考 `src/lib/storage/kv-lock.ts` 现有 KV `eval` pattern）
12. `pmDecisionPipeline.ts` 当前直接生成 `schemaVersion: 1` record + `analystInputs` + `stageTrace`；B.3 改这里 + B.2 加 7 个新 LLM call
13. B.1 i18n outcome / writer 冻结 audit 已 PASS（PR #86 merge `8b17901f`）
14. A1 v10 module + AgentWatchBoard console seam 稳定（B 全程不动除 B.8 narrow exception）
15. v9 视觉权威不变（B 全程不动 v9 组件树 CSS / layout）
16. 双 prod 双线锁定（Tier 1 ai.coinw.com / Tier 2 claw42.ai）—— B 全程仅 staging preview
17. CoinW API live trading 由独立 legal/security/API spec 处理（B.8 mock 解锁后下轮做）
18. i18n 10 locale + en_XA 全程维护（每 phase 新 namespace 全翻译）
19. team registry / TeamMember type 在 `src/lib/team/teamRegistry.ts`；`src/lib/team/types.ts` 不存在
20. dispatchAgentMapping 在 `src/lib/watch/dispatchAgentMapping.ts`（不是 v9/）
21. Codex 长时间运行期间 Vercel preview quota / GitHub Actions quota 充足
22. F session 不在 Codex 运行期间介入（除非 Codex 报停）

---

## 5. Measurable Success Criteria

### 跨 phase（master 共用）

| ID | 指标 | 测量方法 | 阈值 |
|---|---|---|---|
| SC-M-001 | A1 owned zero diff（除 B.8 narrow exception） | `git diff origin/main -- src/modules/agent-watch/v10/** src/app/[locale]/agent/page.tsx` + B.8 phase 仅允许 `v10/MarketAnalysisPanel.tsx` follow-related 改动 | 非 B.8 phase 严格 0；B.8 phase 仅 follow-related |
| SC-M-002 | Prod 双线 zero touch | 所有 deploy 命令 grep `--prod` / Jenkins 推送 | 0 命中 |
| SC-M-003 | 每 phase verify gate | typecheck / lint / format:check / vitest / build / verify:a11y / verify:metrics / verify:chat-v3-final / verify:agent-ip / verify:news | 全 PASS |
| SC-M-004 | 主 worktree zero touch | Codex 全程用 `/tmp/claw42-*` worktree | 0 主 worktree write |
| SC-M-005 | Phase 间 gate 自动判定 | § 0.4 七条 gate 全 PASS 才进下一 phase | 0 越界进 phase |
| SC-M-006 | Master spec 内部一致性 | § 9 变更范围 / § 13 不能做 / § 14 Constitution 三表互不矛盾 | 0 矛盾 |
| SC-M-007 | i18n 10 locale 完整 | 每 phase 新 namespace × 10 locale Node 脚本断言 | 0 missing key |
| SC-M-008 | SPEC-FEEDBACK 收敛 | 每 phase ≤ 2 minor P2 | >2 或含 P1+ → 立即停 |
| SC-M-009 | 工程量收敛 | 每 phase ≤ 5 commit / ≤ 3 AI 天（B.2 例外 ≤ 5 AI 天） | 超 → 立即停报 F |
| SC-M-010 | 视觉零回归 | v9 视觉权威 vs B.1 baseline screenshot diff | layout / spacing / class 严格 0 改动；text 因数据演进允许 |
| SC-M-011 | Writer 冻结 grep gate | `git diff origin/main -- src/lib/team/decisionResolution.ts` （B.1-B.8 phase）+ cron narrow gate `grep -E "resolveOpenPmDecisions\|resolveDecisionRecordFromPrice\|decisionResolution" diff` 行数 | B.1-B.8 = 0；B.9 解冻 |

---

## 6. 现状盘点（B.1 PR #86 merge 后 main HEAD `34019c24`）

### 6.1 已实施（B master 不动除非显式）

**Schema / Type**（v1.2 修正：types 文件归属）：
- `StrategyDecisionRecord` schema v1（含 5 resolution 字段）—— **type in `src/lib/team/strategyDecisionRecord.ts`**
- `AnalystInputRecord` —— **type in `src/lib/team/strategyDecisionRecord.ts`**
- `DecisionOutcome = "hit_tp" | "hit_sl" | "expired" | "manual_close" | null` —— **in `strategyDecisionRecord.ts`**
- `DecisionResolutionReason = "take_profit_reached" | "stop_loss_reached" | "evaluation_window_elapsed"` —— **in `strategyDecisionRecord.ts`**
- `MarketDataSource = "coinw-kline" | "coingecko-ticker" | "fallback"` —— B.9 加 `"admin_manual"`
- `DecisionResolutionResult = Exclude<DecisionOutcome, null | "manual_close">`（writer return 不含 manual_close）—— **type in `src/lib/team/decisionResolution.ts`**
- `PublicTimelineEvent.pm_decision.resolution` 5 子字段
- `publicTimelineProjection.resolutionFromRecord`
- `TeamMemberId = "fundamental" | "news" | "chart" | "onchain" | "research_lead" | "risk_lead" | "pm"`（**7 个**）—— in `src/lib/team/teamRegistry.ts`
- `DispatchAgentId = 12 个` —— in `src/modules/agent-watch/v9/types.ts`
- `DISPATCH_AGENT_NOT_IN_CURRENT = ["bullish_researcher", "bearish_researcher", "trader", "aggressive_reviewer", "neutral_reviewer", "conservative_reviewer", "memory_loop"]`（7 synthetic）—— in `src/lib/watch/dispatchAgentMapping.ts`

**文件位置（v1.0 → v1.1 → v1.2 实测累积修正）**：
- TeamMemberId / team registry：`src/lib/team/teamRegistry.ts`（**不是 `src/lib/team/types.ts`**）
- Schema types（StrategyDecisionRecord / AnalystInputRecord / DecisionResolutionReason / DecisionOutcome / MarketDataSource）：`src/lib/team/strategyDecisionRecord.ts`（**不是 `teamRegistry.ts`**）
- Writer return union（DecisionResolutionResult）：`src/lib/team/decisionResolution.ts`（**不是 `teamRegistry.ts`**）
- DispatchAgentId union：`src/modules/agent-watch/v9/types.ts`
- dispatchAgentMapping：`src/lib/watch/dispatchAgentMapping.ts`（**不是 `src/modules/agent-watch/v9/`**）

**Adapter / UI**：
- `v9TopicAdapter` 全套（resolutionContent / makeStages / makeResolutionMessage / mapPublicTimelineEventsToTopics）
- `agentWatch.dispatchV10.*` i18n namespace（含 roles / flow / outcome / reason 子 namespace / market / placeholder）
- v9 component tree（MessageBubble safe formatter / DispatchConsoleV9 / 跟单 UI 在 TopicStrategy.tsx）
- v10 module（A1 owned，含 MarketAnalysisPanel.tsx 跟单 UI）

**Writer / cron**：
- `src/lib/team/decisionResolution.ts` writer（B.1 冻结，B.9 解冻）
- `src/app/api/cron/strategy-replay/route.ts` cron call site
- B.4 narrow cron exception 允许改 cron 调度，零行 resolution writer 调用

**API endpoints 已存在**：
- `/api/watch/timeline/route.ts`（polling）
- `/api/watch/history/route.ts`（返 public timeline 历史，**B.7 不动**）
- `/api/watch/stream/route.ts`（debug SSE，**B.6 复用扩展**）

**LLM pipeline**：
- `pmDecisionPipeline.ts` 直接生成 `schemaVersion: 1` record + analystInputs + stageTrace（B.3 改这里）

**KV / storage**：
- Vercel `@vercel/kv` / Upstash Redis（**不支持 If-Match/ETag**，B.4 用 version field + atomic CAS）
- Follow stats KV + rate limiter

**Polling**：
- AgentWatchBoard 5s polling `/api/watch/timeline`
- nextPollMs 字段服务端控制

**Real CoinW API**：不存在（B.8 解锁 mock 不接真 API）

### 6.2 B master 工作（缺口）

- **B.2**: 7 TeamMember → **14 真升级**（7 个新 TeamMember = 6 dispatch role + memory_loop，全部加 LLM prompt / role / desc / provider）；dispatchAgentMapping 12 dispatch 全 mapped real（`DISPATCH_AGENT_NOT_IN_CURRENT = []`）；teamRegistry 加 7 个 entry；TeamMemberId union 升级到 14
- **B.3**: schema v1 → v2（含 rounds 数组）；adapter 兼容；i18n round labels；`pmDecisionPipeline.ts` 改为多 round
- **B.4**: 新 `decisionStageWriter.ts` partial 写 + cron `strategy-replay/route.ts` narrow exception 改调度（grep gate 验证零 writer 调用行）+ adapter in-progress 渲染 + KV version field CAS
- **B.5**: topic ranking score + explanation algorithm + i18n explanation 文案
- **B.6**: 复用 `/api/watch/stream/route.ts` 扩展（不新建 sse 路由）+ KV broker 200-500ms 轮询（不是 100ms）+ 客户端切换 + graceful degrade
- **B.7**: 新建 `/api/watch/decision-history/route.ts`（不动现有 history）+ HistoryWall UI + intensity heat map
- **B.8**: 跟单按钮 mock execution path（v9 TopicStrategy + v10 MarketAnalysisPanel narrow exception）+ feature flag gate + Dan 解锁机制
- **B.9**: writer manual_close 路径 + `DecisionResolutionReason` 加 `manual_close_requested` + `MarketDataSource` 加 `"admin_manual"` + admin API + adapter / outcome i18n 兼容

### 6.3 不动

- 全 A1 资产（除 B.8 MarketAnalysisPanel.tsx narrow exception）
- prod 双线
- 主 worktree WIP
- 现有 schema v1（B.3 加 v2 兼容，不破 v1）
- B.1 已实施的 i18n / tests / writer 冻结状态（B.9 才解冻）
- 现有 `/api/watch/history/route.ts`（B.7 不动）

---

## 7. 技术上下文

### 7.1 B.2 — 7 TeamMember → 14 真升级（dispatch 12 全 mapped real）

**当前 state**：
- `TeamMemberId` 7 个真实 union（`fundamental / news / chart / onchain / research_lead / risk_lead / pm`）—— in `teamRegistry.ts`
- `DispatchAgentId` 12 个 union —— in `src/modules/agent-watch/v9/types.ts`
- `dispatchAgentMapping.ts`: 5 mapped real + 7 synthetic（在 `DISPATCH_AGENT_NOT_IN_CURRENT`）
- `DISPATCH_AGENT_NOT_IN_CURRENT = ["bullish_researcher", "bearish_researcher", "trader", "aggressive_reviewer", "neutral_reviewer", "conservative_reviewer", "memory_loop"]`（7 个 synthetic）

**B.2 目标 state（Dan 拍板 14 真升级 + dispatch 12 全 mapped real）**：
- `TeamMemberId` 升级为 **14 个 union**：原 7 + 7 新真 TeamMember = `fundamental / news / chart / onchain / research_lead / risk_lead / pm / bullish_researcher / bearish_researcher / trader / aggressive_reviewer / neutral_reviewer / conservative_reviewer / memory_loop`
- `dispatchAgentMapping` 12 dispatch 全 mapped real，`DISPATCH_AGENT_NOT_IN_CURRENT = []`（空数组）
- team registry 加 **7 个新 entry**（6 dispatch role + memory_loop，含 display name / role / desc / promptVersion / provider）
- LLM prompt 文件：7 个新角色 prompt（含 memory_loop 复盘 prompt）
- `pmDecisionPipeline.ts` 加 7 个新 LLM provider call（parallel + timeout 30s + retry 2x + fallback partial decision）
- `publicTimelineProjection` 处理 14 角色 record（memory_loop 真参与，不再 synthetic placeholder）

**数学口径**：
- Dan label 写 "Team 13"，但意图 = "升 6 dispatch synthetic + memory_loop 升真"——实际 team = 7 + 7 = **14**
- F 按意图（dispatch 12 全 mapped real + memory_loop 升真）走，team 总数 **14**，不是 13

**v9 / v10 hero 边界**：
- v9 hero constellation 当前 11 anode 无 a-mem node → B.2 不改 v9 视觉权威（hero 仍 11 anode）+ memory_loop 仅 flow stage-6 + chat 渲染（v9 已 a-mem CSS ready）；hero 中 memory_loop 不显示为 anode
- v10 hero 自决（A1 owned，B 不动）—— v10 hero 是否加 memory_loop node 由 A1 后续决定，B.2 不动

**LLM 成本警告**：
- 当前每 decision 跑 7 TeamMember LLM call；B.2 后跑 14（加倍）+ B.3 multi-round 加倍 = 4x cost
- Codex 实施 B.2 时要在 cost ledger 报告预估 + Vercel preview quota check

### 7.2 B.3 — Multi-round debate trace schema v2

**当前 state**：
- `StrategyDecisionRecord.schemaVersion: 1` —— **type in `src/lib/team/strategyDecisionRecord.ts`**
- `analystInputs: AnalystInputRecord[]` 每条 1 个 rationale（单 round）—— **type in `strategyDecisionRecord.ts`**
- `stages: DispatchStage[]` 每 stage 1 message
- `pmDecisionPipeline.ts` 直接生成 v1 record

**B.3 目标 state**：
- `StrategyDecisionRecord.schemaVersion: 2` —— 改 `strategyDecisionRecord.ts`
- `analystInputs[].rounds: AnalystInputRoundRecord[]`（每条 analyst 多轮）
- `AnalystInputRoundRecord = { roundIndex, direction, rationale, evidenceIds, createdAt }` —— 新 type 加在 `strategyDecisionRecord.ts`
- `stages[].rounds: DispatchStageRoundRecord[]`（每 stage 多 round）
- `DispatchStageRoundRecord = { roundIndex, messages, status, createdAt }` —— 新 type 加在 `strategyDecisionRecord.ts`
- adapter 渲染 round 编号 + round 间分隔
- i18n 新 namespace `agentWatch.dispatchV10.round.{label, separator}`
- `pmDecisionPipeline.ts` 每 stage 跑 2 round（"based on round 1 results, refine your view"）+ 整合 record

**dual-shape 兼容**：v1 record 投到 v2 = 单 round shape（roundIndex=1，rationale 直接放 round[0]）

**LLM prompt 改动**：每 stage 跑 2 round 改 prompt；total LLM call cost 翻倍要在 § 12 工作量预估反映

**writer 改动**：
- `pmDecisionPipeline.ts` 重构为多 round（不动 `decisionResolution.ts` —— B.1 冻结）
- 新 helper `src/lib/team/multiRoundPipeline.ts` 处理多 round 整合

### 7.3 B.4 — Partial stage writes / streaming（**narrow cron exception**）

**当前 state**：
- writer 跑 cron 一次性把整个 decision record 写完
- adapter 拿到 record 时所有 stage 都是 `status: "done"`
- UI 永远不会显示 "in_progress" 状态（除非 record 不存在）

**B.4 目标 state**：
- writer 分 stage 写入：stage 1 完成 → 立即 KV write 单 stage → cron 再跑 stage 2 → KV update
- public payload `stages[].status` 真实反映 "pending" | "in_progress" | "done"
- adapter 在收到 partial record 时正确渲染部分 stage

**narrow cron exception 实施**：
- `decisionResolution.ts` 不动（B.1 冻结，B.9 才解冻）
- 新文件 `src/lib/team/decisionStageWriter.ts` 处理 stage 级 KV write
- **`src/app/api/cron/strategy-replay/route.ts` narrow exception**：仅改 cron 调度逻辑（"判断跑哪个 stage / partial run timeout 处理"），**零行涉及 `resolveOpenPmDecisions / resolveDecisionRecordFromPrice / decisionResolution` 等 resolution writer 调用**
- grep gate：`git diff origin/main -- src/app/api/cron/strategy-replay/route.ts | grep -E "resolveOpenPmDecisions|resolveDecisionRecordFromPrice|decisionResolution"` 行数 = 0

**KV optimistic CC**：
- Vercel `@vercel/kv` / Upstash 不支持 `If-Match` / ETag
- 用 KV record 内嵌 `version: number` 字段 + atomic CAS（pseudo：`set { ...rec, version: rec.version + 1 } if-version-equals rec.version`）
- 用 Upstash atomic Lua script 或 multi-key Redis transaction（Codex 自决具体实现，按 main 现有 KV usage pattern）

### 7.4 B.5 — Topic ranking + intensity v2

**当前 state**：
- `intensityCalculator.ts`: 简单 1-4 score（importance / evidence severity / count / confidence）
- topic 按 createdAt desc 排序
- 无 explanation 字段

**B.5 目标 state**：
- `topicRanking = { score, explanation }` 加进 PublicTimelineEvent 或 `mapPublicTimelineEventsToTopics` 输出
- `score` v2 = `(severity_max × 0.4) + (confidence × 0.3) + (consensus_score × 0.2) + (news_count_log × 0.1)`
- `explanation` = i18n 模板 `"{symbol} 因 {news_count} 条新闻 + {confidence}% 置信度排第 {rank}"` 等
- i18n namespace `agentWatch.dispatchV10.topicRanking.*`

**F 自决**：topicRanking 放 adapter 输出（不放 PublicTimelineEvent payload），减少 schema 变化

### 7.5 B.6 — Polling → SSE（**复用现有 stream endpoint**）

**当前 state**：
- AgentWatchBoard 5s polling `/api/watch/timeline`
- nextPollMs 字段服务端控制 interval
- **`/api/watch/stream/route.ts` 已存在**（debug SSE，emits `text/event-stream`）

**B.6 目标 state**：
- **复用 `/api/watch/stream/route.ts` 扩展为 production-grade SSE**（不新建 `/api/watch/sse`）
- 添加：auth / rate limit / KV broker integration
- 客户端 EventSource + AbortController + visibility API
- KV broker 200-500ms 轮询（不是 100ms，避免 KV scan cost）
- Graceful degrade: SSE 失败 / Safari old / network error → 立即回 polling
- `nextPollMs` 字段保留作 polling fallback

**关键决策**：
- broker 用 KV poll-based（KV write 时附 timestamp，broker 每 200-500ms scan changes → push）—— 比真消息队列简单
- 200-500ms 轮询：avoid 100ms KV scan cost（Codex 实施时 verify Vercel KV / Upstash 实际 cost / latency tradeoff，自决具体 interval）
- Codex Edge runtime 实际 SSE 支持度 verify（Vercel docs）

### 7.6 B.7 — Decision history wall（**新建 decision-history endpoint**）

**当前 state**：
- `/api/watch/history/route.ts` 已存在，返 public timeline 历史（**B.7 不动**）
- Follow stats KV store + API（B 144 commit 已实施）
- 无 decision wall UI / 无 intensity heat map

**B.7 目标 state**：
- **新建 `/api/watch/decision-history/route.ts`**（命名不撞 history）—— 返 symbol-keyed decision wall 数据
- AgentWatchBoard 加 "决策历史" 入口 → 抽屉 / 模态展开
- HistoryWall UI（独立子区域，**不嵌入 v9 Topic.tsx / v9 TopicStrategy.tsx 等既存组件**）
- 每条 history 含 outcome / 时间 / intensity
- 历史 wall 加 intensity heat map（小型 sparkline / heatmap）

**性能约束**：
- 历史 wall 默认 lazy load（入口 click 后才 fetch）
- 单 symbol > 100 条 → 服务端分页

**视觉边界约束**：
- HistoryWall 是 B owned 新组件，不嵌入 v9 既存 Topic.tsx / TopicStrategy.tsx
- 入口在 AgentWatchBoard 顶部 / 侧栏 / 抽屉，不破 console 内部 layout
- 整体风格 follow v9 视觉语言（颜色 / 字体），不引入新设计系统

### 7.7 B.8 — Real CoinW execution / follow trade（**默认 disabled + Dan 解锁后 mock + narrow v10 exception**）

**当前 state**：
- 跟单 UI 实际**两处**：
  - `src/modules/agent-watch/v9/TopicStrategy.tsx`（v9 owned，B 可改 follow-related 行）
  - `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx`（A1 owned，**B.8 narrow exception** 允许改 follow-related 行）
- 当前两处都是 disabled / no-op tracking only（v3.7 + Phase B v2.1 立的 safety 约束）
- 无 execution endpoint / 无 mock 模式 / 无 real CoinW API

**B.8 目标 state（分两阶段）**：

**Stage 1: disabled → mock execution（需 Dan 拍板解锁）**：
- 新 feature flag `FOLLOW_TRADE_MOCK_MODE`（env var）
- 解锁前：两处按钮 disabled + tooltip "演示模式 / 不真实下单" + click 无副作用
- 解锁后 mock：
  - click → POST `/api/watch/follow-trade-mock` → 模拟 API call delay 500ms → 假成交回流（fake `orderId = "mock-${anonId}-${recordId}-${timestamp}"`, fake `filledPrice = decision.entryPrice`）
  - mock 假成交写入 follow stats KV（区分 `mockExecution` 和 `noOpClick`）
  - mock 触发 fake outcome writeback：60s 后 cron 把 decision mark `resolvedOutcome="hit_tp"` 假写回（仅 mock mode，独立 helper 不动 decisionResolution.ts）
- UI 文案：按钮"模拟跟单"（mock 解锁）/"跟单"（real，未来）/"演示模式"（未解锁）

**v10 narrow exception 边界（v10/MarketAnalysisPanel.tsx）**：
- 允许改：button 文案 / disabled state / click handler 切换 mock / real / disabled
- 不允许改：layout / class / hero / constellation / 其他 panel 视觉
- grep gate：`git diff origin/main -- src/modules/agent-watch/v10/MarketAnalysisPanel.tsx` 必须仅涉及 follow-related 行

**Stage 2: mock → real CoinW（独立 spec，本 B-master 不实施）**：
- 留空 stub `/api/watch/follow-trade-real`（401 unauthorized 直到独立 spec 解锁）
- 不实施 real API key / signing / order placement / position monitoring

**硬停 gate**：
- B.8 phase 开始时 Codex 必须 verify `FOLLOW_TRADE_MOCK_MODE` env 是否 Dan 拍板设置
- 如未设 / env=false → Codex 仅实施 disabled UI + tooltip + safety copy（两处 UI），跳过 mock execution 实施
- Dan 解锁 = chat 明确说 "B.8 开 mock execution"，并由 F 把 `FOLLOW_TRADE_MOCK_MODE=true` 写进 Vercel preview env / .env.local
- B.8 不允许接 real CoinW API（即使 Dan 在 chat 说"也接 real"，必须等独立 spec）

### 7.8 B.9 — manual_close real writer writeback（**显式解冻 B.1 冻结的 writer 文件 + 加 reason union + 加 MarketDataSource union**）

**当前 state**：
- `DecisionResolutionResult` writer return union 不含 `manual_close`（writer 当前只产 hit_tp / hit_sl / expired）—— **type in `src/lib/team/decisionResolution.ts`**
- `DecisionResolutionReason` 当前 3 个值（不含 manual reason）—— **type in `src/lib/team/strategyDecisionRecord.ts`**
- `MarketDataSource` 当前 union = `"coinw-kline" | "coingecko-ticker" | "fallback"`（不含 admin_manual）—— **type in `strategyDecisionRecord.ts` 或同等位置，Codex 实测确认**
- B.1 冻结 `decisionResolution.ts` + `strategy-replay/route.ts` writer 文件
- manual_close 仅 schema union + i18n 文案兼容，writer 不产

**B.9 目标 state**：
- **显式解冻 B.1 冻结**（master spec § 9.4 显式声明 B.9 phase 解冻 writer 文件）
- `DecisionResolutionResult` 加 `manual_close` —— 改 **`decisionResolution.ts`**
- `DecisionResolutionReason` 加 `"manual_close_requested"`（新 union 值）—— 改 **`strategyDecisionRecord.ts`**
- `MarketDataSource` 加 `"admin_manual"`（admin API 手动平仓 价格来源）—— 改 **`strategyDecisionRecord.ts`**
- `decisionResolution.ts` 加 `manual_close` 路径：
  - 输入：admin API `/api/admin/decision/:id/manual-close` 调用（POST + auth header）
  - 处理：writer mark `resolvedAt: now() / resolvedOutcome: "manual_close" / resolutionReason: "manual_close_requested" / resolutionPriceSource: "admin_manual" / resolvedPrice: currentMarketPrice`
  - idempotency: 如 `resolvedAt != null` → return 409 conflict，不重写
- `strategy-replay/route.ts` cron 跳过已 manual_close decision（不重新评估）
- 新 admin API endpoint `/api/admin/decision/[id]/manual-close`（auth = Dan-only token）
- adapter 已支持 manual_close 渲染（B.1 实施）；B.9 加 reason `manual_close_requested` 的 i18n key
- i18n: `agentWatch.dispatchV10.outcome.reason.manual_close_requested` 新 key 10 locale
- 下游影响：所有 consumer 处理 MarketDataSource union 的代码（如 publicTimelineProjection / adapter price source display）必须兼容新 `"admin_manual"` 值；Codex 实施时 grep 所有 MarketDataSource consumer 加 case

**安全约束**：
- admin API 加 auth middleware（验证 X-Admin-Token header）
- token 在 env var `ADMIN_API_TOKEN`（Dan 配置）
- 不解锁前 endpoint return 401（即使 B.9 phase 完成）

---

## 8. 数据流（master 全景）

```
[base: B.1 PR #86 merge + master spec docs commit + format fix = 34019c24]
                                                                              ┌─ B.9 admin manual_close API ──→ writer
                                                                              │
StrategyDecisionRecord (B.3 schema v2 + rounds[])                             │
   ↑ writer (decisionResolution.ts B.1 冻结 / B.9 解冻 + manual_close + manual_close_requested reason)
   ↑ strategy-replay/route.ts cron (B.4 narrow exception 改调度 / B.9 解冻 manual_close skip)
   ↑ B.4 decisionStageWriter.ts (分 stage 写 + partial)
   ↑ B.3 multiRoundPipeline.ts (多 round 整合)
   ↑ B.2 team registry 12 real members + 5-6 个新 LLM provider call
   ↓
publicTimelineProjection.resolutionFromRecord (B.1 不动)
   ↓
PublicTimelineEvent.pm_decision (B.3 加 rounds[])
   ↓
mapPublicTimelineEventsToTopics ctx { locale, outcomeDict, roundDict (B.3), topicRankingDict (B.5), stageStatusDict (B.4) }
   ↓
v9TopicAdapter (B.3 rounds 兼容 / B.4 in_progress 状态 / B.5 ranking explanation)
   + B.5 topicRanking (adapter-only output, 不进 payload)
   ↓
AgentWatchBoard
   ├─ B.6 EventSource → /api/watch/stream (复用 debug endpoint 扩展, graceful degrade to polling)
   ├─ B.7 HistoryWall 入口 → /api/watch/decision-history?symbol=
   ├─ B.8 Follow click handler → /api/watch/follow-trade-mock (解锁后) / disabled (未解锁)
   └─ DispatchConsoleV9 (B.3 round display / B.4 in-progress UI)
       ↓
       v9 视觉权威 (A 模块 owned, B 不动除 B.8 narrow exception 到 v10/MarketAnalysisPanel.tsx)
```

---

## 9. 变更范围（全 phase 累积，文件路径基于 main 实测）

### 9.1 新建（按 phase）

**B.2**：
- `src/lib/team/prompts/{bullishResearcher,bearishResearcher,trader,aggressiveReviewer,neutralReviewer,memoryLoop}.ts` 或同等位置（Codex 按 main `src/lib/team/` 现有 prompt 文件结构自决）
- LLM provider config 文件（如 main 已有 / 否则按 main 模式新建）

**B.3**：
- `src/lib/team/multiRoundPipeline.ts`（多 round 整合 helper，不动 decisionResolution.ts）
- 无新 schema 文件（schema 直接改在 strategyDecisionRecord.ts）

**B.4**：
- `src/lib/team/decisionStageWriter.ts`（partial stage write logic）
- `src/lib/storage/kv-version-cas.ts`（version field + atomic CAS helper，如已有 → 复用）

**B.5**：
- `src/lib/watch/topicRanking.ts`（score + explanation algorithm）

**B.6**：
- 无新 route（复用 `/api/watch/stream/route.ts`）
- `src/lib/watch/sseBroker.ts`（KV poll-based broker）

**B.7**：
- `src/app/api/watch/decision-history/route.ts`（新 endpoint，命名不撞现有 history）
- `src/modules/agent-watch/v9/HistoryWall.tsx`（B owned，独立组件不嵌入 v9 既存）
- `src/modules/agent-watch/v9/IntensityHeatMap.tsx`（sparkline）

**B.8**：
- `src/app/api/watch/follow-trade-mock/route.ts`（mock execution endpoint）
- `src/app/api/watch/follow-trade-real/route.ts`（stub return 401，独立 spec 解锁）
- `src/lib/watch/followTradeMock.ts`（mock logic）
- `src/lib/watch/followTradeMockOutcome.ts`（mock-only fake outcome writeback，不动 decisionResolution.ts）

**B.9**：
- `src/app/api/admin/decision/[id]/manual-close/route.ts`（admin manual close endpoint）
- `src/lib/team/manualCloseHandler.ts`（manual close writer logic helper）

### 9.2 修改（按 phase，路径基于 main 实测）

**B.2**：
- `src/lib/team/teamRegistry.ts`（**TeamMemberId union + team registry 都在这里**，加 7 个新 TeamMember entry：6 dispatch role + memory_loop，TeamMemberId union 升级到 14）
- `src/lib/watch/dispatchAgentMapping.ts`（**不在 v9/** —— 重构 12 dispatch 全 mapped real + `DISPATCH_AGENT_NOT_IN_CURRENT = []`）
- `src/lib/watch/publicTimelineProjection.ts`（处理 14 角色 record）
- `pmDecisionPipeline.ts`（含 7 个新 LLM provider call）
- LLM prompt 文件 7 个：6 dispatch role + memory_loop（按 main `src/lib/team/` prompt 结构）

**B.3**：
- `src/lib/team/strategyDecisionRecord.ts`（**schema types 在这里，不是 teamRegistry.ts** —— 加 `schemaVersion: 2` + `AnalystInputRoundRecord` / `DispatchStageRoundRecord` + analystInputs[].rounds / stages[].rounds 字段）
- `src/lib/watch/publicTimelineProjection.ts`（v2 projection + dual-shape 兼容）
- `src/lib/watch/v9TopicAdapter.ts`（round 显示 + 兼容 v1）
- `pmDecisionPipeline.ts`（每 stage 跑 2 round + 整合）
- `src/i18n/dicts/*.json`（10 locale + `dispatchV10.round.*` namespace）
- `src/i18n/types.ts`（dict 类型扩展）

**B.4**：
- `src/app/api/cron/strategy-replay/route.ts`（**narrow exception** —— 仅改 cron 调度部分，零行涉及 resolution writer 调用；grep gate 验证）
- `src/lib/watch/publicTimelineProjection.ts`（处理 partial record）
- `src/lib/watch/v9TopicAdapter.ts`（in_progress 状态渲染）
- `src/i18n/dicts/*.json`（10 locale + `dispatchV10.stageStatus.*` namespace）

**B.5**：
- `src/lib/watch/v9TopicAdapter.ts`（topicRanking 输出）
- `src/i18n/dicts/*.json`（10 locale + `dispatchV10.topicRanking.*` namespace）
- `src/i18n/types.ts`

**B.6**：
- `src/app/api/watch/stream/route.ts`（**复用扩展** —— 加 auth / rate limit / KV broker integration）
- `src/modules/agent-watch/AgentWatchBoard.tsx`（**仅加 SSE EventSource 切换逻辑 + ctx 字段，不动 console seam / props bridge**）
- `src/app/api/watch/timeline/route.ts`（保留 polling，加 nextPollMs 字段如已有则 keep）

**B.7**：
- `src/modules/agent-watch/AgentWatchBoard.tsx`（history wall 容器渲染在 console 外，**仅 props / 容器布局，不动 console seam**）
- `src/i18n/dicts/*.json`（10 locale + `dispatchV10.history.*` namespace）
- **注**：B.7 不改 v9 既存组件（Topic / TopicStrategy 等）

**B.8**：
- `src/modules/agent-watch/v9/TopicStrategy.tsx`（**B owned** —— follow-related disabled / mock state + tooltip + safety copy）
- `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx`（**A1 owned narrow exception** —— 仅 follow-related button 文案 / disabled state / click handler；grep gate 验证仅 follow-related 行）
- `src/lib/watch/followStatsStore.ts`（区分 mockExecution / noOpClick）
- `src/i18n/dicts/*.json`（10 locale + `dispatchV10.followTrade.*` namespace）

**B.9**（types 文件归属 v1.2 实测修正）：
- `src/lib/team/decisionResolution.ts`（**B.9 解冻 + `DecisionResolutionResult` 加 `manual_close` + 加 manual_close writer 路径** —— writer return union 在这里）
- `src/lib/team/strategyDecisionRecord.ts`（`DecisionResolutionReason` 加 `manual_close_requested` + `MarketDataSource` 加 `"admin_manual"` —— schema types 在这里）
- `src/app/api/cron/strategy-replay/route.ts`（**B.9 进一步解冻** —— cron 跳过已 manual_close decision）
- 所有 MarketDataSource consumer 文件（grep 实测 + 加 `"admin_manual"` case，如 publicTimelineProjection / adapter price source display 等）
- `src/i18n/dicts/*.json`（10 locale + `dispatchV10.outcome.reason.manual_close_requested` + admin error keys）

### 9.3 删除（按 phase）

- B.6 不删除 polling 路径（保留作 graceful degrade fallback）
- 其他 phase 无删除

### 9.4 不动（全 phase 共用，含 A1 owned）

- `src/modules/agent-watch/v10/**`（除 `MarketAnalysisPanel.tsx` B.8 narrow exception）
- `src/modules/agent-watch/AgentWatchBoard.tsx` 的 **console seam 结构 + props bridge type signature**（B 可加 ctx 字段，不改 seam）
- `src/app/[locale]/agent/page.tsx`（A1 owned）
- v9 视觉权威：DispatchConsoleV9 / MessageBubble / Hero / Constellation / FlowPanel / Topic / TopicStrategy 等的 CSS class / layout / spacing / 颜色 / 字体（B.8 narrow exception 仅 follow-related 行）
- v9 既存组件（Topic / TopicStrategy 主体）—— 仅 B.8 改 TopicStrategy follow-related，其他 B phase 不动 v9 既存
- prod 双线 deploy 路径（无 `--prod` / 不推 CoinW GitLab / 不部署 Jenkins）
- 主 worktree 30+ WIP files
- `src/lib/team/decisionResolution.ts`（B.1-B.8 全程冻结，**仅 B.9 显式解冻**）
- `src/app/api/cron/strategy-replay/route.ts`（B.1-B.3 / B.5-B.8 全程冻结 / **B.4 narrow exception 改调度（grep gate）/ B.9 解冻 manual_close skip**）
- 现有 `/api/watch/history/route.ts`（B.7 不动；B.7 新建 decision-history）

---

## 10. 依赖前置

- B.1 PR #86 squash merge 完成 + main HEAD `8b17901f` ✓
- Master spec docs commit `7b849e68` + format fix `34019c24` 已推 origin/main ✓
- B.1 i18n outcome 10 locale 验证 PASS（SC-001 / SC-002 / SC-003 全过）✓
- B.1 writer 冻结 audit 验证 PASS（SC-006 zero diff）✓
- baseline verify gate 全过 ✓
- 干净 worktree 系列（每 phase 独立）：
  - `/tmp/claw42-b2-roles-upgrade`
  - `/tmp/claw42-b3-multi-round-trace`
  - `/tmp/claw42-b4-partial-stage-streaming`
  - `/tmp/claw42-b5-topic-ranking-v2`
  - `/tmp/claw42-b6-sse-stream-extend`
  - `/tmp/claw42-b7-decision-history-wall`
  - `/tmp/claw42-b8-follow-trade-mock`
  - `/tmp/claw42-b9-manual-close-writer`

---

## 11. Tasks（按 phase 顺序，Codex 自动执行）

### Phase B.2 — 7→12 真升级

- [ ] T-B2-001 worktree `/tmp/claw42-b2-roles-upgrade` + branch `feature/spec-b-master-b2-roles-upgrade` base `34019c24`
- [ ] T-B2-010 [P] grep 实测：teamRegistry / dispatchAgentMapping / pmDecisionPipeline / DISPATCH_AGENT_NOT_IN_CURRENT 当前 shape（双脑 Q-B2.1）
- [ ] T-B2-011 **F 已拍板升级范围**：7 个 synthetic 全部升真（`bullish_researcher / bearish_researcher / trader / aggressive_reviewer / neutral_reviewer / conservative_reviewer / memory_loop`），Codex 实施时仅 verify grep 结果一致后直接执行
- [ ] T-B2-012 `src/lib/team/teamRegistry.ts` 加 7 个新 TeamMember entry（6 dispatch role + memory_loop，display name / role / desc / promptVersion / provider）+ TeamMemberId union 升级到 14
- [ ] T-B2-013 LLM prompt 文件：7 个新角色 prompt（按 main `src/lib/team/` prompt 结构）
- [ ] T-B2-014 `src/lib/watch/dispatchAgentMapping.ts` 12 dispatch 全 mapped real + `DISPATCH_AGENT_NOT_IN_CURRENT = []`
- [ ] T-B2-015 `pmDecisionPipeline.ts` 加 7 个新 LLM provider call（parallel + timeout 30s + retry 2x + fallback partial decision）
- [ ] T-B2-016 `src/lib/watch/publicTimelineProjection.ts` 处理 14 角色 record
- [ ] T-B2-017 i18n 微调（已有 dispatchV10.roles.* 12 个；仅校准新 7 个角色 desc / stat 准确性）
- [ ] T-B2-018 LLM cost ledger 报告：B.2 后 7 → 14 角色，单 decision LLM call 翻倍；Codex 在 codex-to-claude.md 报告预估 cost / latency + Vercel preview quota check
- [ ] T-B2-020 测试：vitest unit `dispatchAgentMapping.test.ts` 12 角色覆盖
- [ ] T-B2-021 测试：publicTimelineProjection.test.ts 12 角色 record case
- [ ] T-B2-022 测试：pmDecisionPipeline mock 12 角色 LLM call + fallback case
- [ ] T-B2-030 staging fixture 加 1 条 12 角色完整 record
- [ ] T-B2-040 verify gate 全过 + Vercel preview READY
- [ ] T-B2-041 视觉 verify：hero 仍 11 anode（v10 不动）+ flow stage-6 + chat 12 角色完整渲染
- [ ] T-B2-042 grep gate：`git diff origin/main -- src/lib/team/decisionResolution.ts src/app/api/cron/strategy-replay/route.ts src/modules/agent-watch/v10/**` = 0
- [ ] T-B2-050 PR + squash merge + 自动 phase gate 判定（§ 0.4 七条 PASS）→ 进 B.3

### Phase B.3 — Multi-round debate trace schema v2

- [ ] T-B3-001 worktree `/tmp/claw42-b3-multi-round-trace` + branch base = B.2 merge 后 main HEAD
- [ ] T-B3-010 [P] grep `pmDecisionPipeline.ts` 当前 v1 record 生成 flow + LLM call 结构（双脑 Q-B3.1）
- [ ] T-B3-011 `src/lib/team/strategyDecisionRecord.ts`（**不是 teamRegistry.ts** —— schema types 在这里）加 `schemaVersion: 2` types + `AnalystInputRoundRecord` / `DispatchStageRoundRecord` + analystInputs[].rounds / stages[].rounds 字段
- [ ] T-B3-012 schemaVersion union 从 `1` → `1 | 2`（同样在 strategyDecisionRecord.ts）
- [ ] T-B3-013 LLM prompt 改动：analyst 每 stage 跑 2 round（"based on round 1 results, refine your view"）
- [ ] T-B3-014 新建 `src/lib/team/multiRoundPipeline.ts` 多 round 整合 helper（**不动 decisionResolution.ts** —— B.1 冻结）
- [ ] T-B3-015 `pmDecisionPipeline.ts` 重构为多 round 整合
- [ ] T-B3-016 `publicTimelineProjection` 加 rounds 投射 + dual-shape 兼容（v1 → 单 round v2）
- [ ] T-B3-017 `v9TopicAdapter` 渲染 round 编号 + round 间分隔
- [ ] T-B3-018 i18n: `agentWatch.dispatchV10.round.{label, separator, single, multi}` 10 locale 全翻
- [ ] T-B3-020 测试：schema v1 / v2 dual-shape 兼容 case
- [ ] T-B3-021 测试：adapter round 显示 multi-round + single-round 兼容
- [ ] T-B3-022 测试：multiRoundPipeline 整合 + LLM provider call 2 round
- [ ] T-B3-030 staging fixture: 加 1 条 v2 multi-round record + 保留 1 条 v1 legacy record
- [ ] T-B3-040 verify gate
- [ ] T-B3-041 视觉 verify：multi-round 显示 layout + 单 round legacy 兼容渲染
- [ ] T-B3-042 grep gate：writer + cron 文件 0 diff（除 schema type 加在 teamRegistry，cron 不动）
- [ ] T-B3-050 PR + squash merge + phase gate → 进 B.4

### Phase B.4 — Partial stage writes / streaming（narrow cron exception）

- [ ] T-B4-001 worktree `/tmp/claw42-b4-partial-stage-streaming` + branch base = B.3 merge 后 main HEAD
- [ ] T-B4-010 [P] grep KV API 当前 contract + cron 当前实现 + Upstash version field 支持度（双脑 Q-B4.1）
- [ ] T-B4-011 新建 `src/lib/team/decisionStageWriter.ts` 分 stage 写入 logic
- [ ] T-B4-012 新建 `src/lib/storage/kv-version-cas.ts` version field + atomic CAS helper（按 main `@vercel/kv` / Upstash 实际能力实现）
- [ ] T-B4-013 **narrow cron exception**：`src/app/api/cron/strategy-replay/route.ts` 改为支持 partial run 调度（仅调度逻辑，零行涉及 `resolveOpenPmDecisions / resolveDecisionRecordFromPrice / decisionResolution`）
- [ ] T-B4-014 `publicTimelineProjection` 处理 partial record（部分 stage in_progress）
- [ ] T-B4-015 `v9TopicAdapter` `makeStages` 渲染 `in_progress` 状态（新 i18n key + 视觉占位）
- [ ] T-B4-016 i18n: `agentWatch.dispatchV10.stageStatus.{pending, in_progress, done}` 10 locale
- [ ] T-B4-020 测试：partial write → KV → adapter → UI 端到端
- [ ] T-B4-021 测试：concurrent partial write conflict（version CAS retry）
- [ ] T-B4-030 staging：fixture 加 1 条 partial record（stage 3 in_progress）
- [ ] T-B4-040 verify gate
- [ ] T-B4-041 视觉 verify：in_progress 渲染（动画 / spinner / 占位文字）
- [ ] T-B4-042 cron narrow gate：`git diff origin/main -- src/app/api/cron/strategy-replay/route.ts | grep -E "resolveOpenPmDecisions\|resolveDecisionRecordFromPrice\|decisionResolution"` 行数 = 0
- [ ] T-B4-043 writer 冻结 gate：`git diff origin/main -- src/lib/team/decisionResolution.ts` = 0
- [ ] T-B4-050 PR + squash merge + phase gate → 进 B.5

### Phase B.5 — Topic ranking + intensity v2

- [ ] T-B5-001 worktree `/tmp/claw42-b5-topic-ranking-v2` + branch base = B.4 merge 后 main HEAD
- [ ] T-B5-010 [P] grep intensityCalculator 当前实现 + topic 排序逻辑（双脑 Q-B5.1）
- [ ] T-B5-011 新建 `src/lib/watch/topicRanking.ts` 实现 score + explanation algorithm（adapter-only output，不进 payload）
- [ ] T-B5-012 `mapPublicTimelineEventsToTopics` 输出 topicRanking 字段
- [ ] T-B5-013 `v9TopicAdapter` topic ranking 排序 + explanation 渲染
- [ ] T-B5-014 i18n: `agentWatch.dispatchV10.topicRanking.{explanation_template, rank_label}` 10 locale
- [ ] T-B5-020 测试：ranking score 计算 + tie-break + explanation 模板插值
- [ ] T-B5-030 staging：4 topic fixture 不同 score + explanation 显示
- [ ] T-B5-040 verify gate
- [ ] T-B5-041 视觉 verify：topic 排序 + explanation 文案 layout
- [ ] T-B5-042 grep gate：writer + cron + v10 0 diff
- [ ] T-B5-050 PR + squash merge + phase gate → 进 B.6

### Phase B.6 — Polling → SSE（复用 stream endpoint）

- [ ] T-B6-001 worktree `/tmp/claw42-b6-sse-stream-extend` + branch base = B.5 merge 后 main HEAD
- [ ] T-B6-010 [P] grep `/api/watch/stream/route.ts` 当前 debug 实现 + AgentWatchBoard polling + Vercel Edge SSE 支持度（双脑 Q-B6.1）
- [ ] T-B6-011 扩展 `src/app/api/watch/stream/route.ts`（**复用，不新建**）：加 auth / rate limit / KV broker integration
- [ ] T-B6-012 新建 `src/lib/watch/sseBroker.ts` KV poll-based broker（200-500ms 轮询，Codex 自决具体 interval）
- [ ] T-B6-013 `AgentWatchBoard.tsx` 加 EventSource + AbortController + visibility API + graceful degrade to polling（**仅加 ctx 字段 + 切换逻辑，不动 console seam**）
- [ ] T-B6-014 timeline route 保留 polling + nextPollMs 字段（fallback）
- [ ] T-B6-020 测试：SSE 端到端 + degrade 路径
- [ ] T-B6-021 测试：SSE 失败 → 自动切 polling
- [ ] T-B6-030 staging：模拟 SSE 推送 + 验证客户端接收 < 1s
- [ ] T-B6-040 verify gate
- [ ] T-B6-041 视觉 verify：实时更新无闪烁
- [ ] T-B6-042 grep gate：writer + cron + v10 0 diff
- [ ] T-B6-050 PR + squash merge + phase gate → 进 B.7

### Phase B.7 — Decision history wall（新建 decision-history endpoint）

- [ ] T-B7-001 worktree `/tmp/claw42-b7-decision-history-wall` + branch base = B.6 merge 后 main HEAD
- [ ] T-B7-010 [P] grep follow stats store + 现有 history route 实现（双脑 Q-B7.1）
- [ ] T-B7-011 新建 `src/app/api/watch/decision-history/route.ts` decision history API（按 symbol 查询，分页）—— **不动现有 `/api/watch/history`**
- [ ] T-B7-012 新建 `src/modules/agent-watch/v9/HistoryWall.tsx` history wall UI（B owned，独立组件不嵌入 v9 既存）
- [ ] T-B7-013 新建 `src/modules/agent-watch/v9/IntensityHeatMap.tsx` sparkline 热力图
- [ ] T-B7-014 AgentWatchBoard 加 history wall 入口 + 容器渲染（**不嵌入 v9 Topic.tsx / TopicStrategy.tsx**，作为 board 独立子区域 / 抽屉 / 模态）
- [ ] T-B7-015 i18n: `agentWatch.dispatchV10.history.{wall_title, outcome_label, expand, collapse, more}` 10 locale
- [ ] T-B7-020 测试：decision-history API 分页 + 单 symbol > 100 条
- [ ] T-B7-021 测试：HistoryWall render + IntensityHeatMap render
- [ ] T-B7-030 staging：seed 20 条 historical decision fixture（含不同 outcome）
- [ ] T-B7-040 verify gate
- [ ] T-B7-041 视觉 verify：history wall 展开 / 折叠 / heat map render
- [ ] T-B7-042 grep gate：现有 `/api/watch/history/route.ts` 0 diff + writer + cron + v10 0 diff
- [ ] T-B7-050 PR + squash merge + phase gate → 进 B.8

### Phase B.8 — Real CoinW execution / follow trade（**默认 disabled + Dan 解锁后 mock + narrow v10 exception**）

- [ ] T-B8-000 **gate check**: `process.env.FOLLOW_TRADE_MOCK_MODE === "true"`?
  - 若否 → 仅实施 T-B8-010 / T-B8-011 / T-B8-018（disabled UI 两处 + safety copy + i18n），跳过 T-B8-012 之后 + 报 F + 等 Dan 解锁
  - 若是 → 完整跑 T-B8-010 ~ T-B8-050
- [ ] T-B8-001 worktree `/tmp/claw42-b8-follow-trade-mock` + branch base = B.7 merge 后 main HEAD
- [ ] T-B8-010 [P] grep TopicStrategy.tsx + MarketAnalysisPanel.tsx 当前 follow-related 实现 + followStatsStore contract（双脑 Q-B8.1）
- [ ] T-B8-011 `src/modules/agent-watch/v9/TopicStrategy.tsx`（B owned）disabled 状态 + tooltip + safety copy
- [ ] T-B8-011b `src/modules/agent-watch/v10/MarketAnalysisPanel.tsx`（**A1 owned narrow exception**）disabled 状态 + tooltip + safety copy
- [ ] T-B8-012 [仅 mock 解锁] 新建 `src/app/api/watch/follow-trade-mock/route.ts` mock endpoint
- [ ] T-B8-013 [仅 mock 解锁] 新建 `src/lib/watch/followTradeMock.ts` mock logic（500ms delay + fake order id + fake fill price）
- [ ] T-B8-014 [仅 mock 解锁] mock 假成交触发 follow stats KV write（区分 mockExecution / noOpClick）
- [ ] T-B8-015 [仅 mock 解锁] 新建 `src/lib/watch/followTradeMockOutcome.ts` mock-only fake outcome writeback（60s 后 mark hit_tp，仅 mock mode）—— **不动 decisionResolution.ts 主路径**
- [ ] T-B8-016 [仅 mock 解锁] TopicStrategy.tsx + MarketAnalysisPanel.tsx click handler 切换：disabled / mock execution / real（real return 401 stub）
- [ ] T-B8-017 [仅 mock 解锁] 新建 `src/app/api/watch/follow-trade-real/route.ts` stub return 401 + auth header 检查（独立 spec 解锁）
- [ ] T-B8-018 i18n: `agentWatch.dispatchV10.followTrade.{disabled_tooltip, mock_label, mock_success, mock_fail, real_label_future}` 10 locale
- [ ] T-B8-020 测试：disabled state UX 两处 UI + mock execution success + mock fail（50% fail 概率）+ idempotency
- [ ] T-B8-030 staging：mock mode 开 + manual click 验证两处 UI
- [ ] T-B8-040 verify gate
- [ ] T-B8-041 视觉 verify：disabled / mock execution states 两处 UI
- [ ] T-B8-042 narrow v10 exception gate：`git diff origin/main -- src/modules/agent-watch/v10/MarketAnalysisPanel.tsx` 必须仅涉及 follow-related 行（grep 验证零 layout / class / hero 改动）
- [ ] T-B8-043 v10 其他 zero diff：`git diff origin/main -- src/modules/agent-watch/v10/** ':!src/modules/agent-watch/v10/MarketAnalysisPanel.tsx'` = 0
- [ ] T-B8-044 writer + cron 0 diff
- [ ] T-B8-050 PR + squash merge + phase gate → 进 B.9（即使 disabled-only 跑也 merge）

### Phase B.9 — manual_close real writer writeback（**显式解冻 + reason union 扩展**）

- [ ] T-B9-000 **解冻声明**: B.9 phase 唯一允许动 `src/lib/team/decisionResolution.ts` 和 `src/app/api/cron/strategy-replay/route.ts` resolution writer 部分（cron 在 B.4 已 narrow exception，B.9 进一步解冻 resolution writer 调用）；本 phase 内 git diff 这两个文件 ≠ 0 是 expected
- [ ] T-B9-001 worktree `/tmp/claw42-b9-manual-close-writer` + branch base = B.8 merge 后 main HEAD
- [ ] T-B9-010 [P] grep decisionResolution writer 当前 union + cron flow + DecisionResolutionReason（双脑 Q-B9.1）
- [ ] T-B9-011a `src/lib/team/decisionResolution.ts` 加 `DecisionResolutionResult` union `manual_close`（writer return union 在这里，**不是 teamRegistry.ts**）
- [ ] T-B9-011b `src/lib/team/strategyDecisionRecord.ts` 加 `DecisionResolutionReason` `manual_close_requested` + `MarketDataSource` 加 `"admin_manual"`（schema types 在这里）
- [ ] T-B9-011c grep 所有 MarketDataSource consumer 文件（publicTimelineProjection / adapter price source display 等）加 `"admin_manual"` case
- [ ] T-B9-012 `src/lib/team/decisionResolution.ts` 加 manual_close 路径（idempotency + market price snapshot）
- [ ] T-B9-013 新建 `src/lib/team/manualCloseHandler.ts` manual close 处理 helper
- [ ] T-B9-014 新建 `src/app/api/admin/decision/[id]/manual-close/route.ts` admin endpoint（auth = X-Admin-Token header）
- [ ] T-B9-015 `strategy-replay/route.ts` cron 跳过已 manual_close decision（不重新评估）
- [ ] T-B9-016 i18n: `agentWatch.dispatchV10.outcome.reason.manual_close_requested` 新 key + `agentWatch.admin.{unauthorized, idempotency_conflict}` 10 locale
- [ ] T-B9-017 env var setup: `ADMIN_API_TOKEN`（Dan 配置 Vercel preview env）
- [ ] T-B9-020 测试：manual close → writer → record → adapter → memory_loop msg "人工关闭（manual_close_requested）" 渲染（zh_CN + en_US）
- [ ] T-B9-021 测试：idempotency（已 resolved 不重写）+ admin auth（401 / 200）
- [ ] T-B9-030 staging：admin endpoint 测试（manual close 1 条 fixture decision）
- [ ] T-B9-040 verify gate
- [ ] T-B9-041 视觉 verify：manual_close outcome + manual_close_requested reason 文案多 locale
- [ ] T-B9-042 grep gate：writer 解冻 expected diff > 0；A1 owned + v10 + history endpoint 0 diff
- [ ] T-B9-050 PR + squash merge + phase gate → B master 完成

### Master 总结报告（最后一步）

- [ ] T-M-FINAL Codex 在 `codex-to-claude.md` 写 master 完成报告：
  - 8 phase PR 列表 + squash commit sha
  - 全部 SC-M-001 ~ SC-M-011 跨 phase SC verify 结果
  - i18n 新 namespace 总数 + 10 locale 完整性
  - 每 phase verify gate 输出
  - 每 phase Vercel preview URL
  - decision-log 联动报告（待 F 追加 master 完成 entry）

---

## 12. 约束（master 共用）

- 全程不动 A1 owned（v10 module / page.tsx / hero / constellation 视觉）**除 B.8 narrow exception**：`MarketAnalysisPanel.tsx` 仅 follow-related 行
- 全程不动 prod 双线（无 `--prod` / 无 CoinW GitLab / 无 Jenkins）
- 全程不动主 worktree WIP
- 每 phase 独立 worktree + branch + PR
- Phase 间 gate 自动判定（§ 0.4 七条 PASS 才进下一 phase）
- i18n 10 locale 默认全翻译（不向 Dan 问；en_XA 占位）
- 任何 schema mismatch / 接口不一致 → [SPEC-FEEDBACK]，不自行猜
- transient HTTP 502/503/504/timeout → retry 1-2 次（间隔 30s/90s/3min）；真阻塞（merge conflict / CI red / protected branch 等）→ 立即停 + 报告
- B.8 默认 disabled，仅在 `FOLLOW_TRADE_MOCK_MODE=true` 时跑 mock execution；real CoinW API 全程不接（独立 spec）
- B.4 narrow cron exception：仅改 cron 调度，零行 resolution writer 调用（grep gate 验证）
- B.9 显式解冻 writer / cron resolution writer 调用；其他 phase 全程冻结
- 长时间运行期间如 Codex 自己 context 污染 / 不确定 → 立即停 + 报 F，不擅自硬推
- 每 phase ≤ 5 commit / ≤ 3 AI 天（B.2 例外 ≤ 5 AI 天因为 5-6 个新 LLM 角色），超 → 停 + 报 F

---

## 13. 不能做清单

- ❌ 不能改 A1 owned 文件（v10 module / AgentWatchBoard console seam / page.tsx 注入 / hero / constellation 视觉）**除 B.8 narrow exception `MarketAnalysisPanel.tsx` follow-related 行**
- ❌ 不能改 prod 双线 deploy 任何配置
- ❌ 不能动主 worktree（每 phase 用独立 `/tmp/claw42-*` worktree）
- ❌ 不能在 B.1-B.8 期间动 `src/lib/team/decisionResolution.ts`（仅 B.9 解冻）
- ❌ 不能在 B.1-B.3 / B.5-B.8 期间改 `src/app/api/cron/strategy-replay/route.ts`（B.4 narrow exception 仅改调度部分零行 resolution writer 调用 / B.9 解冻 manual_close skip）
- ❌ 不能接 real CoinW API（即使 Dan chat 说"也接 real"，必须等独立 spec）
- ❌ 不能跳过 phase gate（§ 0.4 七条任一不过 → 停）
- ❌ 不能在 phase 间 carry over 文件改动（每 phase PR 独立）
- ❌ 不能 hardcode 任何新中文（i18n 完整性纪律）
- ❌ 不能假装有 `t(key, vars)` API（B.1 已立 ctx + typed sub-dict 模式）
- ❌ 不能 force-push / rewrite history
- ❌ 不能用 Storybook / RTL（repo 无）
- ❌ 不能用 `--prod` / 不能推 CoinW GitLab / 不能动 Jenkins
- ❌ 不能 schemaVersion 跳变（B.3 仅 v1 → v2；不能直接 v2 → v3）
- ❌ B.9 解冻 writer 时不能"顺便重构 writer 现有逻辑"——仅加 manual_close 路径 + reason union
- ❌ 不能跳过双脑判断点（§ 18 每 phase 必填）
- ❌ 不能用 If-Match / ETag CAS（Upstash 不支持，用 version field + atomic ops）
- ❌ 不能新建 `/api/watch/sse` 路由（复用现有 `/api/watch/stream`）
- ❌ 不能新建 `/api/watch/history` 别名 / 改现有 history（B.7 新建 `/api/watch/decision-history`）
- ❌ 不能在 B.7 改 v9 既存组件（Topic / TopicStrategy 等）—— HistoryWall 独立组件
- ❌ 不能在 B.8 narrow v10 exception 中改 layout / class / hero / 其他 panel（仅 follow-related 行）
- ❌ 不能把 schema types（StrategyDecisionRecord / AnalystInputRecord / DecisionResolutionReason / DecisionOutcome / MarketDataSource）放在 `teamRegistry.ts` —— 这些都在 `strategyDecisionRecord.ts`
- ❌ 不能把 writer return union（DecisionResolutionResult）放在 `teamRegistry.ts` —— 在 `decisionResolution.ts`
- ❌ B.9 不能不加 `MarketDataSource` 的 `"admin_manual"` union 值（admin 手动平仓必须有 price source 来源标签）
- ❌ B.2 不能升级数 ≠ 7（synthetic 全升 = 7 个：6 dispatch + memory_loop；少 1 个 = dispatch 仍 synthetic = 违 Dan 拍板）

---

## 14. Constitution 对照检查（v0.1.1 7 Rule，master 全程通用）

| Rule | 状态 | 评估 |
|---|---|---|
| Rule 1 部署身份 | PASS | 每 phase preview only / 不推 CoinW GitLab / 走 agentxmain-collab |
| Rule 2 生产保护（双 prod）| PASS | 双 prod 全程不动；无 `--prod` / 不上 claw42.ai / 不上 ai.coinw.com |
| Rule 3 视觉品牌权威 | CONDITIONAL | v9 视觉权威全程不动；A1/v10 仅 B.8 narrow exception 改 MarketAnalysisPanel.tsx follow-related 行（不动 layout / class / hero）；B.7 HistoryWall 独立组件不嵌入 v9 既存 —— 三个 narrow boundary 都有 grep gate 验证 |
| Rule 4 数据 schema 纪律 | CONDITIONAL | B.3 升级 schema v1→v2 + B.4 加 partial state + B.9 writer union 加 manual_close + reason union 加 manual_close_requested + MarketDataSource union 加 admin_manual —— 每个改动都在 spec 显式声明 + dual-shape 兼容 + decision-log 联动 + 所有 union consumer 必须 verify 加新 case |
| Rule 5 AI / 行情诚实性 | PASS | B.8 mock mode 文案明示"演示模式"+ FOLLOW_TRADE_MOCK_MODE flag gate；real CoinW 独立 spec |
| Rule 6 协作闭环 | PASS | 每 phase 走 Codex 双脑评估 + sync READ/writeback + phase gate 自动判定 |
| Rule 7 验证门槛 | PASS | 每 phase 全 verify gate + Vercel preview + 视觉 verify + i18n 10 locale Node script + grep gate（cron narrow / v10 narrow / writer 冻结）|

**Rule 3 + Rule 4 CONDITIONAL 说明**：本 spec 含 3 个 narrow exception（B.4 cron / B.8 v10 / B.9 writer）+ 2 个 schema 演进（B.3 v2 / B.9 reason union）。每个都在 spec 显式声明 + grep gate 验证 + decision-log 留痕。Codex 实施前必须 verify 每 phase 边界是否仍在本 spec § 0.5 / § 9 范围内；超出 → [SPEC-FEEDBACK]，不自行猜。

---

## 15. Worktree

- **F 起草 worktree**: F session 沙箱
- **每 phase Codex 实施 worktree**: 独立 `/tmp/claw42-b{N}-{phase-name}`
- **base HEAD**: master spec docs `34019c2464ed2461cc1b359cd78ad50769730abc`（B.1 PR #86 squash `8b17901f` + master spec v1.0 docs `7b849e68` + format fix `34019c24`）；v1.1 spec docs commit 由 Codex T000 推进时拿新 sha
- **branches**: `feature/spec-b-master-b{N}-{phase-name}`
- **PR base**: `main`（每 phase 独立 PR）
- **不动**: 主 worktree `/Users/dannybrown/Claude/职业规划/web-dev/claw42`（30+ WIP）
- **决策档案**: `/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md`（repo 外只读引用）
- **Constitution**: `docs/project-constitution.md` v0.1.1（worktree cwd 视角）

---

## 16. 老板简报

claw42 Watch 板未来一段时间会按顺序完成 8 件事。每件事独立测试通过才推下一件，全程只动迭代版预发，不上正式版。

按顺序：
1. 补齐 12 个真实 AI 角色（之前 5-6 个是占位）—— 决策由真团队产出，不再有"幽灵角色"
2. 决策过程加入多轮辩论历史，用户看到分析师"先这么想后来又改"的演进
3. 加进度条：决策跑到哪一步实时刷新，不再"突然全部完成"
4. 热点排序加解释："为什么 BTC 排第 1"
5. 数据更新提速到秒级（之前 5 秒一次）
6. 历史决策可点回看（同一个币种过往 AI 怎么分析的）
7. "跟单"按钮加 mock 演示模式（点了模拟下单给 Dan review UX，但不真下单）
8. 人工平仓决策能正常写入系统并完整复盘

第 7 件需要 Dan 明确说"开 mock"才会跑。真接 CoinW 下单是后续独立项目，本批不接。

第 8 件涉及内核代码解冻（这次只动核心一处，不重写）。

---

## 17. Anti-Rationalization

| 逃逸路径 | 为什么不行 | 正确做法 |
|---|---|---|
| 觉得 master spec 太长 Codex 跑不完 | spec 长是因为覆盖 8 phase，每 phase Codex 实际只读 § 7.{N} / § 11.{N} / § 18.{N}，context 控制得住 | Codex 按 phase 读对应小段，不一次性读全文 |
| 觉得 phase 间 gate 太严，CI 慢一点先跑下一 phase | gate 是硬纪律，跳 gate = phase 累积漏洞难定位 | 严格按 § 0.4 七条 PASS 才进下一 phase |
| 觉得 B.2 升级 12 真角色 5-6 个 LLM call 太贵 顺便砍 1-2 个 | spec 立 12 真升级是 Dan 拍板 + dispatch 12 与 team 12 一致；砍角色 = scope 越界 | 严格按 12 真升级；如 cost / latency 真不可行 → [SPEC-FEEDBACK] |
| 觉得 B.8 mock 反正没真 API 顺便也接 real CoinW | real CoinW 是 legal / security / auth 决策，独立 spec | B.8 仅 disabled + mock；real return 401 stub |
| 觉得 B.4 narrow cron exception 等于 cron 全开放 | narrow 是仅调度部分，零行 resolution writer 调用 | grep gate 验证；超 → [SPEC-FEEDBACK] |
| 觉得 B.8 narrow v10 exception 等于 v10 全开放 | narrow 是仅 MarketAnalysisPanel.tsx 的 follow-related 行 | grep gate 验证；超 → [SPEC-FEEDBACK] |
| 觉得 B.9 解冻 writer 顺便 refactor 现有逻辑 | refactor 引入风险 + 跨 scope；B.9 仅加 manual_close 路径 + reason union | 仅 minimal patch 加 manual_close + manual_close_requested，不动其他 writer code |
| 觉得 B.3 schema v2 顺便上 v3 | schema 跳版破 dual-shape 兼容；下游消费方按 v2 实施 | 仅 v1 → v2，v3 留下轮独立 spec |
| 觉得每 phase 都写完整 SPEC-FEEDBACK 报告太冗 | SPEC-FEEDBACK + 双脑判断是 phase gate 必填 | 每 phase 必写，不省 |
| 觉得跨 phase carry over 一些 i18n key 一次性翻完省时间 | i18n 跨 phase carry = phase 边界混乱 + diff 难审 | 每 phase 仅翻自己的 namespace |
| 觉得 B.6 SSE 失败回 polling 是优雅降级所以也允许直接 polling 不上 SSE | SSE 是 B.6 主路径；degrade 是 fallback 不是替代 | B.6 必须实施 SSE + degrade 双路径 |
| 觉得 B.6 复用 stream endpoint 等于"它已经差不多了我不动它" | 复用是命名复用，B.6 必须扩展加 auth / rate limit / KV broker；现有 debug endpoint 是 minimal placeholder | B.6 实质性扩展 stream endpoint，不是 trivial reuse |
| 觉得 B.7 新建 decision-history 等于"我也可以改 history" | F 自决避免 schema 变化 mix —— B.7 不动现有 history | 严格新建 decision-history，0 行触碰 history endpoint |
| 觉得 A1 owned AgentWatchBoard 永远不能碰 | B 可加 ctx 字段 + 接 SSE EventSource + 接 HistoryWall props，不动 console seam 结构 / props bridge type | B 仅加字段不改 seam，每改动在 § 9 § 9.4 显式说明 |
| 觉得 Dan 长时间不 reply 我可以擅自降级 phase 范围 | phase 范围 spec 写死；Dan 不 reply 是 expected（Codex 长时间自跑）；遇 [SPEC-FEEDBACK] 立即停 等 Dan 介入 | 严格按 spec 跑，遇问题立即停 + 写 codex-to-claude.md 报 F |
| 觉得 spec 留 audit trail 让 F/Dan 看到 v1.0 → v1.x 变化 | spec 是 single source of truth；audit trail 由 decision-log 维护 | spec 内不留 strike-through / "(v1.1 修订：...)" 注解 |
| 觉得 v1.0 → v1.1 → v1.2 修正了路径 / 命名 / 范围 / 数学，实施时凭记忆继续用旧 spec 数字 / 路径 | v1.2 是新基准，v1.0 / v1.1 旧文字作废 | Codex 实施前 cat 实测 + 按 v1.2 § 18 共通 grep check 走完 |
| 觉得 schema types 应该在 teamRegistry.ts 因为名字像"team type" | schema types（StrategyDecisionRecord / AnalystInputRecord / DecisionResolutionReason / DecisionOutcome / MarketDataSource）实际在 `strategyDecisionRecord.ts`；writer return（DecisionResolutionResult）在 `decisionResolution.ts`；teamRegistry.ts 只放 TeamMemberId + registry | Codex 实施前 `cat src/lib/team/*.ts` 实测 + 按文件归属改对应 type |
| 觉得 B.2 升级 7 个 LLM 角色 cost 太高顺便砍 1-2 个 | Dan 拍板 7 全升（synthetic 7 = 6 dispatch + memory_loop）；砍 = dispatch 仍 synthetic = 违 Dan 拍板 + violates dispatch 12 全 mapped real | 严格 7 升；如 cost 真不可行 → [SPEC-FEEDBACK]，不擅自砍 |
| 觉得 B.9 加 manual_close 只动 writer 不用扩 MarketDataSource union | admin 手动平仓必须有 price source 标签；当前 union 无合适值；用 `"fallback"` 会和真 fallback 混淆 | 严格加 `"admin_manual"` 到 MarketDataSource union + 加所有 consumer case |

---

## 18. 双脑判断点（每 phase 必填，Codex 实施前 cat 实测 + 写 codex-to-claude.md）

### Q-B2.1: team registry 当前 shape + 7 个 synthetic 升级（F + Dan 已拍板）
- `cat src/lib/team/teamRegistry.ts` 看 7 当前 TeamMember entry 结构
- `cat src/lib/watch/dispatchAgentMapping.ts` 看 5 mapped + 7 synthetic 列表实测
- grep `DISPATCH_AGENT_NOT_IN_CURRENT` 实际 list 是否仍 7 个（如不一致 → [SPEC-FEEDBACK]）
- **F 已拍板 7 全升**（6 dispatch role + memory_loop），Codex 仅 verify grep 一致 + 给最小改动方案 + LLM provider 配置（按 main 现有 provider 结构）+ 加哪些 prompt 文件 + cost ledger 报告

### Q-B3.1: schema v1 → v2 dual-shape 兼容 + pmDecisionPipeline 改造
- `cat src/lib/team/strategyDecisionRecord.ts` 看当前 schema（**不是 teamRegistry.ts**）
- `cat src/lib/team/pmDecisionPipeline.ts` 看当前 v1 生成 flow（如文件在别处 grep）
- v1 record 老 KV 数据如何投到 v2（单 round 默认）
- LLM prompt 改动是否影响现有 record（新老共存）

### Q-B4.1: cron narrow exception 边界 + KV version CAS 设计
- `cat src/app/api/cron/strategy-replay/route.ts` 看 cron 当前实现
- 识别 cron 调度部分 vs resolution writer 调用部分（明确 narrow exception 边界）
- Vercel KV / Upstash 实际 atomic command 能力（version field + CAS）
- partial run timeout 处理（cron 60s 内未跑完）

### Q-B5.1: intensity v2 算法 + explanation 模板
- `cat src/lib/watch/intensityCalculator.ts` 看当前实现
- v2 算法 4 个权重 (0.4/0.3/0.2/0.1) 是否合理（看历史 data 分布）
- explanation 模板按 rank / outcome 分情况

### Q-B6.1: stream endpoint 现状 + Edge SSE 支持度 + broker 实现
- `cat src/app/api/watch/stream/route.ts` 看 debug SSE 当前实现
- `cat src/modules/agent-watch/AgentWatchBoard.tsx` 看 polling 实现
- Vercel Edge Runtime SSE 实际支持度
- KV broker 200-500ms 轮询 vs Redis pub/sub vs Edge native（Codex 自决，给出 cost / latency tradeoff 数据）

### Q-B7.1: decision-history 性能 + heat map 渲染
- `cat src/lib/watch/followStatsStore.ts` 看 KV 结构
- 单 symbol > 100 条历史的分页策略
- sparkline 用 SVG vs Canvas vs Chart lib

### Q-B8.1: feature flag gate + mock idempotency + narrow v10 边界
- `cat src/modules/agent-watch/v9/TopicStrategy.tsx` 看 v9 跟单 UI 当前实现
- `cat src/modules/agent-watch/v10/MarketAnalysisPanel.tsx` 看 v10 跟单 UI 当前实现（A1 owned，narrow exception 明确边界）
- `process.env.FOLLOW_TRADE_MOCK_MODE` Vercel preview env 注入路径
- mock idempotency key 设计（防重复 click 重复假成交）
- 共享 follow data 是否通过 props / context / 各自独立（Codex 自决）

### Q-B9.1: writer manual_close 路径 + reason union + MarketDataSource union 扩展 + admin auth
- `cat src/lib/team/decisionResolution.ts` 看 DecisionResolutionResult union + writer flow（**writer return union 在这里**）
- `cat src/lib/team/strategyDecisionRecord.ts` 看 DecisionResolutionReason union + MarketDataSource union（**schema types 在这里，不是 teamRegistry.ts**）
- grep 所有 `MarketDataSource` consumer 文件（如 publicTimelineProjection 等）—— 加 `"admin_manual"` case 影响范围
- admin token X-Admin-Token 验证（中间件 / route handler）
- manual_close 触发时 market price 来源（live API vs 最新 record）

### 每 phase 必填实施前 grep check（共通）

- [ ] `cat src/lib/team/teamRegistry.ts | grep -A 20 TeamMemberId` 当前 union（**TeamMemberId + registry 在这里；schema types 不在这里**）
- [ ] `cat src/lib/team/strategyDecisionRecord.ts` 看 schema types：StrategyDecisionRecord / AnalystInputRecord / DecisionResolutionReason / DecisionOutcome / MarketDataSource（**schema types 在这里**）
- [ ] `cat src/lib/team/decisionResolution.ts` 看 DecisionResolutionResult writer return union（**writer return 在这里**）
- [ ] `cat src/lib/watch/dispatchAgentMapping.ts | grep -A 5 DISPATCH_AGENT_NOT_IN_CURRENT` 当前 synthetic 列表（**不是 `src/modules/agent-watch/v9/`**）
- [ ] `cat src/i18n/types.ts | grep -A 30 dispatchV10` 当前 namespace
- [ ] `cat src/lib/watch/v9TopicAdapter.ts` 当前 adapter（每 phase 都可能改）
- [ ] `ls src/i18n/dicts/*.json | wc -l` 10 locale 全在
- [ ] `git diff origin/main -- src/lib/team/decisionResolution.ts` 应 = 0（除 B.9 phase）
- [ ] `git diff origin/main -- src/app/api/cron/strategy-replay/route.ts | grep -E "resolveOpenPmDecisions|resolveDecisionRecordFromPrice|decisionResolution"` 应 = 0（除 B.9 解冻 / B.4 narrow exception 仅调度部分）
- [ ] `git diff origin/main -- src/modules/agent-watch/v10/**` 应 = 0（除 B.8 narrow exception 仅 MarketAnalysisPanel.tsx follow-related 行）
- [ ] `cat docs/project-constitution.md` v0.1.1 7 Rule
- [ ] `cat /Users/dannybrown/Claude/职业规划/web-dev/decision-log.md | head -200` 最近 entry
- [ ] grep prod / Jenkins / CoinW GitLab 推送 keyword 在 phase 内 commits 应 = 0
- [ ] `ls src/app/api/watch/` 确认现有 endpoint：`timeline/route.ts` + `history/route.ts` + `stream/route.ts`（B.7 不动 history / B.6 复用 stream）

如任一不一致 → [SPEC-FEEDBACK]，立即停 + 报 F。

---

## 19. decision-log 联动

spec 起草 + 每 phase 完成都触发追加 entry 到 `/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md`（repo 外部文件，只读引用，不进 git commit）：

- 2026-05-14（待 F 追加）: B-master spec v1.0 起草 + 8 phase 范围
- 2026-05-15（待 F 追加）: B-master spec v1.1 修订 + 5 类 P1 修正 + Dan 拍 7→12 + F 自决 cron / history / v10 narrow exception
- 2026-05-15（待 F 追加）: B-master spec v1.2 修订 + 3 条 P1 修正（B.2 数学冲突 Dan 重拍 7→14 真 + dispatch 12 全 mapped real / schema types 文件归属 strategyDecisionRecord.ts + writer return decisionResolution.ts / MarketDataSource 加 admin_manual union）
- 每 phase merge 后（Codex 触发 F 追加）: B.{N} 完成 + commit sha + verify 输出
- B.8 phase 跑到 mock gate check 时（Codex 触发 F 追加）：B.8 gate 状态 + Dan 解锁 / 未解锁判定
- B.9 phase 解冻 writer 触发（Codex 触发 F 追加）：B.9 解冻范围声明 + manual_close 路径 commit sha
- Master 完成（Codex 触发 F 追加）: B 模块全 8 phase 完成总结

Codex 实施前 / 每 phase 开始时 / 任何拍板节点 / B.8 gate / B.9 解冻 都先读 decision-log。

---

## 工作量预估

| Phase | 时间（AI 天）|
|---|---|
| B.2 7→12 真升级（5-6 个新 LLM 角色 + prompt + provider + tests）| **3-5** |
| B.3 Multi-round schema v2 | 2-3 |
| B.4 Partial stage streaming（narrow cron exception + KV version CAS）| 1.5-2 |
| B.5 Topic ranking v2 | 1-1.5 |
| B.6 Polling → SSE（复用 stream + broker）| 2-3 |
| B.7 Decision history wall（新 endpoint + UI）| 1.5-2 |
| B.8 Follow trade mock（解锁前 0.5；解锁后完整 2-2.5，含 narrow v10 exception）| 0.5-2.5 |
| B.9 manual_close writer + reason union | 1.5-2 |
| **总计** | **13-19 AI 天**（双时钟规划：AI 时钟 A 可连续；真实时钟 B 1.5-2.5 周）|

每 phase merge 后下一 phase 自动开始（除 B.8 gate 等 Dan）。

---

## 关联资产

- 前置 spec：B.1 spec-watch-B1-memory-loop-hardening v1.1（PR #86 merge `8b17901f`）
- 前置 spec：B v2.1 spec-watch-phase-b-real-agent-pipeline（B 144 commit base）
- 前置 spec：A1 spec-watch-A1-dispatch-console-v10（v9/v10 视觉权威 baseline）
- Constitution：`claw42/docs/project-constitution.md` v0.1.1
- Decision-log：`/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md`
- Codex sync：`claw42/claude-codex-sync/codex-to-claude.md`（B-master v1.0 Round 1 评估 + 5 类 P1 mismatch 实测数据）

---

*v1.2 起草：2026-05-15 00:50 CST F session*
*起草前置：Codex v1.1 Round 2 3 条 P1 修正（B.2 数学冲突 / schema types 文件归属 / MarketDataSource union 缺 admin_manual）+ Dan 重拍 7→14 真升级 + dispatch 12 全 mapped real + F 自决 schema types 文件归属 + F 自决加 admin_manual union*
*下一动作：派 Codex 第 3 轮双脑评估（目标 ≤ 2 minor → 自动串行进入 B.2 → ... → B.9）*
