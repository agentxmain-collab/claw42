# spec-watch-B-master-pipeline-evolution (v1.0 · 2026-05-14)

> **B 模块 master 路线图 spec** — 把 watch dispatch console 后端从"7 角色 / 单 round / fixture-only / polling / no follow-trade"演进到"12 真角色 / multi-round trace / streaming / SSE / follow-trade mock+real / writer 全闭环"。
>
> **本 spec 设计意图**：让 Codex 拿到本文档可以**长时间按顺序运行 B.2-B.9 全部 8 phase**，phase 间通过自动 gate（CI + verify + spec 验收）切换，不需要 F/Dan 中间介入除非：[SPEC-FEEDBACK] >2 / writer 越界 / prod 越界 / B.8 等 Dan 解锁。
>
> **核心范围**：
>
> - **B.2** 11 角色 dispatch upgrade（memory_loop synthetic → real TeamMember + 11→12 真角色 + dispatchAgentMapping 重构）
> - **B.3** Multi-round debate trace（schema v2 + structured rounds array + 每 stage 多 round + analystInputs 扩展）
> - **B.4** Partial stage writes / streaming（writer 当前 stage 一次写全 → partial / in-progress 状态写入）
> - **B.5** Topic ranking + intensity v2（severity × confidence × news 综合 + ranking explanation）
> - **B.6** Polling → SSE（B.8 SSE 升级 + nextPollMs 退役 + graceful degradation）
> - **B.7** Follow stats wall + history（历史 decision wall + intensity heat map）
> - **B.8** Real CoinW execution / follow trade（**默认 disabled + 等 Dan 拍板 → 解锁后跑 mock execution mode；real CoinW API 留下轮独立 spec**）
> - **B.9** Post-trade review writeback（manual_close real writer，**显式解冻 B.1 冻结的 writer 文件**）
>
> **不在范围**：
>
> - real CoinW API live trading（B.8 解锁 mock，real 在下轮独立 legal/security/API spec）
> - A1 owned（v10 module / hero / constellation / flow / 视觉权威）
> - prod 双线部署（仅 staging / preview）
> - schema v3 + 之后的演进（B 模块完成后另立）
>
> **架构定位**：B 模块（底层逻辑 + 技术实现）剩余 phase 整合 master。base main HEAD = B.1 PR #86 squash merge 后的 main（Codex T000 commit 后实测拿 sha）。

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
- "B.9 解冻 writer 顺手优化 writer 逻辑" → ❌ B.9 仅加 manual_close 路径，不重构现有 writer
- "phase A merge 不等 CI 直接跑 phase B" → ❌ 每 phase merge 前 CI 必须绿；phase 间 gate 是硬纪律

### 0.4 Phase 间 gate（自动判定）

每 phase 结束后 Codex 自动判定能否进下一 phase：

- ✓ CI 全绿
- ✓ spec 验收 § 12 PR 所有 SC PASS
- ✓ writer 文件 zero diff（除非该 phase 显式声明解冻）
- ✓ A1 owned 文件 zero diff（仅允许该 phase § 9.4 显式声明的例外）
- ✓ prod 双线 zero touch
- ✓ Vercel preview READY + visual 没明显 regression

**任一不通过 → Codex 立即停 + 报 F，不擅自降级 / 不跳到下一 phase**。

### 0.5 A/B 并行 redline（vs A 模块）

**A1 owned（B master 全程不动）**：

- `src/modules/agent-watch/v10/**`
- `src/modules/agent-watch/AgentWatchBoard.tsx` 的 console seam + props bridge（B 可加 ctx 字段，不改 seam 结构）
- `src/app/[locale]/agent/page.tsx`
- Hero / Constellation / FlowPanel / 视觉

**B owned（master 全 phase 可改）**：

- `src/lib/watch/v9TopicAdapter.ts` + 所有 lib/watch/\* 文件
- `src/lib/team/**`（B.1 冻结的 `decisionResolution.ts` / `strategy-replay/route.ts` 仅 B.9 显式解冻）
- `src/lib/storage/**`（KV store / rate limiter）
- `src/app/api/watch/**` + `src/app/api/cron/**`
- `src/i18n/dicts/*.json` + `src/i18n/types.ts`（B 系列新 namespace）
- `src/modules/agent-watch/v9/types.ts`（数据契约，B 可改）

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

把 B 模块从 B.1 hardening 完成后的 main 状态推进到完整 12 角色 + multi-round + streaming + SSE + follow-trade mock 闭环。每 phase 独立 PR + 独立 verify gate + 自动 phase 切换。B.8 real CoinW execution 在 phase 开始时硬停等 Dan 拍板进入 mock execution mode。

**用户感知层（按 phase 累积）**：

- B.2 后：watch board 显示 12 真角色（memory_loop 含真实 agent stat + display name + avatar）
- B.3 后：每个决策 stage 可看多轮辩论历史（round 1 → 2 → 3 trace）
- B.4 后：决策 stage 进行中状态实时刷新（不再"突然全部就绪"）
- B.5 后：topic 卡片按 intensity 排序 + 给出 explanation（为什么这个 topic 排前）
- B.6 后：数据更新近实时（SSE，不再 5s polling）
- B.7 后：可点开 decision 看历史 wall（同 symbol 过往决策）
- B.8 后（解锁前）：UI 不变；（解锁后 mock）：Follow 按钮 click → 模拟下单 → 假成交回流 + 跟单记录
- B.9 后：人工平仓决策也能正常 writer 写入 + adapter 渲染 + memory_loop 真复盘

---

## 1.5 User Stories（按 phase）

### US-B2 — 12 真角色 dispatch（P1）

**作为** 看 watch board 的访客
**我希望** 看到完整 12 角色（含 memory_loop 真实 agent 不是 synthetic 占位）
**这样** 决策来源跟真实 team registry 对齐，不会有"幽灵角色"

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
**我希望** 点 topic 看过往同 symbol decision wall
**这样** 我能判断 AI 在这个 symbol 上的胜率 / 历史 pattern

### US-B8（解锁前） — Follow 按钮告知不可点（P0 safety）

**作为** 访客
**我希望** Follow 按钮明显 disabled + 文案告知"演示模式 / 不真实下单"
**这样** 我不会误以为点了就真下单

### US-B8（mock 解锁后） — Mock 跟单完整闭环（P1）

**作为** Dan 测试跟单 UX
**我希望** click Follow → 模拟 API call → 假成交回流 + 跟单 stats + memory loop 写假 outcome
**这样** 我能 review 整个跟单链路 UX 再决定是否接 real CoinW

### US-B9 — manual_close 真实闭环（P2）

**作为** Dan / 后续运营
**我希望** 人工平仓决策也能被 writer 处理 + memory_loop 显示对应 outcome
**这样** 4 种 outcome 都不再是"writer 不产 / 仅 UI 兼容"的 dead branch

---

## 2. Acceptance Scenarios（每 phase 1-2 AC，详细 AC 在 § 12 验收清单）

### AC-B2 — 12 角色完整渲染

**Given** main HEAD B.2 merge 后，public payload 含 `analystInputs` 12 角色版
**When** AgentWatchBoard render
**Then** hero constellation 显示 12 nodes（含 memory_loop a-mem node）+ flow stage 6 显示 memory_loop 真实 agent stat

### AC-B3 — Multi-round 显示

**Given** schema v2 含 `rounds[]` 数组，每 round 含 analyst rationale 演进
**When** Topic render
**Then** stage 内 message 按 round 分组 + 显示 round 编号 + agent 在不同 round 可有不同立场

### AC-B4 — Partial stage 进度

**Given** Public payload `stages[]` 含 `status: "in_progress" | "done" | "pending"`
**When** AgentWatchBoard 跑 SSE 接收 partial update
**Then** stage marker 从 pending → in_progress → done 流式切换 + UI 不闪烁

### AC-B5 — Topic 排序解释

**Given** Public payload 含 `topicRanking: { score, explanation }`
**When** TopicList render
**Then** topic 按 score desc 排序 + 卡片底部显示 explanation 短文案

### AC-B6 — SSE 实时

**Given** AgentWatchBoard 跑 SSE 端点
**When** 新 decision 进入 KV
**Then** 前端 ≤ 1s 收到 update + 渲染（不等下次 5s polling）
**And** SSE 失败 → graceful degrade 回 polling

### AC-B7 — History wall

**Given** Topic 卡片含 "查看历史" 链接
**When** 点击
**Then** 展开同 symbol 过去 N 条 decision + 每条含 outcome + 时间

### AC-B8a（解锁前）— Disabled 状态

**Given** B.8 phase 未 Dan 解锁
**When** AgentWatchBoard render Follow 按钮
**Then** 按钮 disabled + tooltip "演示模式" + click 无副作用

### AC-B8b（mock 解锁后）— Mock execution

**Given** Dan 解锁 mock execution mode（feature flag `FOLLOW_TRADE_MOCK_MODE=true`）
**When** 用户 click Follow
**Then** 触发 mock API call → 假成交回流（fake order id + filled price）→ 跟单 stats + memory_loop 写假 outcome

### AC-B9 — manual_close 闭环

**Given** Decision record 通过 admin API 设 manual_close
**When** strategy-replay cron 跑
**Then** writer 处理 manual_close 路径 + 写入 `resolvedOutcome="manual_close"` + adapter 渲染 + memory_loop msg 显示 i18n "人工关闭"

---

## 3. Edge Cases 4 轴（合并）

| 轴       | Edge Case                                                    | Phase | 处理                                                         |
| -------- | ------------------------------------------------------------ | ----- | ------------------------------------------------------------ |
| Input    | analystInputs 长度 = 12 但缺某角色                           | B.2   | 缺角色用 placeholder + dev warn，不抛错                      |
| Input    | rounds[] 长度 0 / 1（legacy single-round）                   | B.3   | 兼容渲染为单 round（不破现状）                               |
| Input    | stage status 顺序乱（done 在 pending 前）                    | B.4   | 用 stageIndex 强制排序 + 状态机校验                          |
| Input    | topicRanking.score 全相同                                    | B.5   | 按 createdAt desc 二级排序                                   |
| Input    | SSE message 乱序到达                                         | B.6   | 用 eventId 排序 + 丢重复                                     |
| Input    | 同 symbol 历史 decision > 100 条                             | B.7   | 分页 / 截断到最近 20 条 + "查看更多"链接                     |
| Input    | Follow click 重复（idempotency）                             | B.8   | mock idempotency key = anon_id + recordId + timestamp 分钟级 |
| Input    | manual_close 但 decision 已 hit_tp/hit_sl                    | B.9   | 已 resolved 不重写（writer 跳过 + dev warn）                 |
| State    | B.2 angel-id 重命名期间老 KV record 跨版本                   | B.2   | adapter 兼容老 agent id → 新 id 映射表                       |
| State    | B.3 schema v1 → v2 KV migration 中（一半 record 老 shape）   | B.3   | adapter dual-shape 兼容（v1 → 单 round v2 投影）             |
| State    | B.6 SSE 连接超时 / 服务端崩                                  | B.6   | 客户端 exponential backoff + 自动回 polling                  |
| State    | B.8 mock mode 切换时已有 active follow                       | B.8   | 切换前 confirm dialog + 清现有 follow state                  |
| Boundary | B.5 intensity 超 max value                                   | B.5   | clamp + log                                                  |
| Boundary | B.7 history wall 跨 24h+ render 性能                         | B.7   | 虚拟滚动 / 懒加载                                            |
| Boundary | B.9 manual_close 时间戳超 evaluation window                  | B.9   | writer 接受 + 标记 reason="manual_outside_window"            |
| Failure  | B.2 dispatchAgentMapping 重构期间老 message 找不到对应 agent | B.2   | fallback memory_loop synthetic 用 last-resort label          |
| Failure  | B.4 partial write 中断（cron timeout）                       | B.4   | 已写部分保留 status="in_progress"，下次 cron 续              |
| Failure  | B.6 SSE endpoint 502                                         | B.6   | 客户端立即回 polling + 静默重试 SSE                          |
| Failure  | B.8 mock API call 模拟失败响应                               | B.8   | 用 50% 概率成功 + 50% 失败（测试两种 UX）                    |
| Failure  | B.9 writer 跑 manual_close 后跑 cron 又跑一次                | B.9   | idempotency 检查 `resolvedAt != null` 跳过                   |

---

## 4. Assumptions（master 共用）

1. base main HEAD = B.1 PR #86 squash merge 后的 main（Codex T000 拿 sha 作 base）
2. B.1 i18n outcome / writer 冻结 audit 已 PASS（PR #86 verified）
3. A1 v10 module + AgentWatchBoard console seam 稳定（B 全程不动）
4. v9 视觉权威不变（B 全程不动 v9 组件树 CSS / layout）
5. 双 prod 双线锁定（Tier 1 ai.coinw.com / Tier 2 claw42.ai）—— B 全程仅 staging preview
6. CoinW API live trading 由独立 legal/security/API spec 处理（B.8 mock 解锁后下轮做）
7. i18n 10 locale + en_XA 全程维护（每 phase 新 namespace 全翻译）
8. team registry / TeamMember type / strategy decision schema 是 B owned，B 可改但每改一次 § 4 Assumptions 同步更新
9. KV store + rate limiter + cron 是 B owned
10. Codex 长时间运行期间 Vercel preview quota / GitHub Actions quota 充足
11. 任何 phase merge 后下一 phase rebase 用最新 main，不依赖 master spec 写的固定 sha
12. F session 不在 Codex 运行期间介入（除非 Codex 报停）

---

## 5. Measurable Success Criteria

### 跨 phase（master 共用）

| ID       | 指标                    | 测量方法                                                                                                                                           | 阈值                                                      |
| -------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| SC-M-001 | A1 owned 文件 zero diff | `git diff origin/main -- src/modules/agent-watch/v10/** src/modules/agent-watch/AgentWatchBoard.tsx src/app/[locale]/agent/page.tsx` 在每 phase PR | 0 改动（除 § 9.4 显式例外）                               |
| SC-M-002 | Prod 双线 zero touch    | 所有 deploy 命令 grep `--prod` / Jenkins 推送                                                                                                      | 0 命中                                                    |
| SC-M-003 | 每 phase verify gate    | typecheck / lint / format:check / vitest / build / verify:a11y / verify:metrics / verify:chat-v3-final / verify:agent-ip / verify:news             | 全 PASS                                                   |
| SC-M-004 | 主 worktree zero touch  | Codex 全程用 `/tmp/claw42-*` worktree                                                                                                              | 0 主 worktree write                                       |
| SC-M-005 | Phase 间 gate 自动判定  | § 0.4 五条 gate 全 PASS 才进下一 phase                                                                                                             | 0 越界进 phase                                            |
| SC-M-006 | Master spec 内部一致性  | § 9 变更范围 / § 13 不能做 / § 14 Constitution 三表互不矛盾                                                                                        | 0 矛盾                                                    |
| SC-M-007 | i18n 10 locale 完整     | 每 phase 新 namespace × 10 locale Node 脚本断言                                                                                                    | 0 missing key                                             |
| SC-M-008 | SPEC-FEEDBACK 收敛      | 每 phase ≤ 2 minor P2                                                                                                                              | >2 或含 P1+ → 立即停                                      |
| SC-M-009 | 工程量收敛              | 每 phase ≤ 5 commit / ≤ 3 AI 天                                                                                                                    | 超 → 立即停报 F                                           |
| SC-M-010 | 视觉零回归              | v9 视觉权威 vs B.1 baseline screenshot diff                                                                                                        | layout / spacing / class 严格 0 改动；text 因数据演进允许 |

### Phase 级 SC（每 phase 独立验收）

详见 § 12 各 phase 验收清单。

---

## 6. 现状盘点（B.1 PR #86 merge 后 main）

### 6.1 已实施（B master 不动除非显式）

- B.1 PR #86 squash merge 完成后的全部 B 144 commit + i18n outcome 10 locale + writer 冻结 audit
- `StrategyDecisionRecord` schema v1（含 5 resolution 字段）
- `PublicTimelineEvent.pm_decision.resolution` shape
- `publicTimelineProjection.resolutionFromRecord`
- `v9TopicAdapter` 全套（resolutionContent / makeStages / makeResolutionMessage / mapPublicTimelineEventsToTopics）
- `agentWatch.dispatchV10.*` i18n namespace（含 roles / flow / outcome / reason 子 namespace）
- v9 component tree（MessageBubble safe formatter / DispatchConsoleV9 / 等）
- v10 module（A1 owned）
- `src/lib/team/decisionResolution.ts` writer（B.1 冻结，B.9 解冻）
- `src/app/api/cron/strategy-replay/route.ts` cron call site
- KV store + rate limiter + follow stats
- AgentWatchBoard polling（5s interval，B.6 替换 SSE）
- Real CoinW API：不存在（B.8 解锁 mock 不接真 API）
- 11 角色 dispatch（synthetic memory_loop）+ `DispatchAgentId` union 12 个值

### 6.2 B master 工作（缺口）

- B.2: memory_loop synthetic → real TeamMember；dispatchAgentMapping 重构 11→12 真角色
- B.3: schema v1 → v2（含 rounds 数组）；adapter 兼容；i18n round labels
- B.4: writer partial stage write API + adapter in-progress 渲染
- B.5: topic ranking score + explanation algorithm + i18n explanation 文案
- B.6: SSE endpoint + 客户端切换 + graceful degrade
- B.7: history wall API + UI + intensity heat map
- B.8: Follow 按钮 mock execution path + feature flag gate + Dan 解锁机制
- B.9: writer manual_close 路径 + admin API 触发 + adapter / outcome i18n 兼容

### 6.3 不动

- 全 A1 资产
- prod 双线
- 主 worktree WIP
- 现有 schema v1（B.3 加 v2 兼容，不破 v1）
- B.1 已实施的 i18n / tests / writer 冻结状态（B.9 才解冻）

---

## 7. 技术上下文（每 phase 详细，长度有控）

### 7.1 B.2 — 11 角色升级为 12 真角色

**当前 state**：

- `DispatchAgentId = 12 个 union` 含 synthetic `memory_loop`
- `TeamMemberId = 11 个 union`（不含 memory_loop）
- `dispatchAgentMapping.ts`: 11 TeamMember → 11 DispatchAgent + memory_loop synthetic
- `DISPATCH_AGENT_NOT_IN_CURRENT = ["bullish_researcher", ...等 7 个 + memory_loop]`

**B.2 目标 state**：

- `TeamMemberId` 加 `memory_loop` 变 12 个 union
- `dispatchAgentMapping.ts` 12 → 12 真映射
- `DISPATCH_AGENT_NOT_IN_CURRENT` 减少（看哪些角色升级为真）
- team registry 加 memory_loop entry（含 display name / role / desc）
- `publicTimelineProjection` 处理 memory_loop 实际参与的 record（不是 synthetic）

**关键决策**：B.2 把 memory_loop **从 dispatch synthetic 升级为 team member real**，但仍保持 "策略复盘主管" 这个语义。real implementation 意味着 memory loop 会有真 prompt / 真 LLM call / 真 rationale 写入 record。

**关键约束**：

- 不能破 v9 hero 当前 11 anode（Codex 评估时 verified hero HTML 含 11 `.anode` no `a-mem`）→ B.2 必须同步加 a-mem node 进 v10 hero **OR** memory_loop 仅在 flow stage-6 + chat 渲染（hero 仍 11） — F 自决：**memory_loop 仅 flow + chat 渲染，hero 仍 11**（已在 A1 spec 立过这条边界）

### 7.2 B.3 — Multi-round debate trace schema v2

**当前 state**：

- `analystInputs: AnalystInputRecord[]` 每条 1 个 rationale（单 round）
- `stages: DispatchStage[]` 每 stage 1 message

**B.3 目标 state**：

- `StrategyDecisionRecord.schemaVersion: 2`
- `analystInputs[].rounds: AnalystInputRoundRecord[]`（每条 analyst 多轮）
- `AnalystInputRoundRecord = { roundIndex, direction, rationale, evidenceIds, createdAt }`
- `stages[].rounds: DispatchStageRoundRecord[]`（每 stage 多 round）
- `DispatchStageRoundRecord = { roundIndex, messages, status, createdAt }`
- adapter 渲染 round 编号 + round 间分隔
- i18n 新 namespace `agentWatch.dispatchV10.round.{label, separator}`

**dual-shape 兼容**：v1 record 投到 v2 = 单 round shape（roundIndex=1，rationale 直接放 round[0]）
adapter 用 `record.schemaVersion === 1 ? singleRoundShape(record) : record` 兼容

**LLM prompt 改动**：每 stage 跑 2 round 改 prompt（"based on round 1 results, refine your view"）
**writer 改动**：每 round 一次 KV write，最后整合 record

### 7.3 B.4 — Partial stage writes / streaming

**当前 state**：

- writer 跑 cron 一次性把整个 decision record 写完
- adapter 拿到 record 时所有 stage 都是 `status: "done"`
- UI 永远不会显示 "in_progress" 状态（除非 record 不存在）

**B.4 目标 state**：

- writer 分 stage 写入：stage 1 完成 → 立即 KV write 单 stage → cron 再跑 stage 2 → KV update
- public payload `stages[].status` 真实反映 "pending" | "in_progress" | "done"
- adapter 在收到 partial record 时正确渲染部分 stage
- SSE 推送 partial update（依赖 B.6，B.4 先 polling 接 partial）

**writer 重构**：

- `decisionResolution.ts` 不动（B.1 冻结，B.9 才解冻）
- 新文件 `src/lib/team/decisionStageWriter.ts` 处理 stage 级 KV write
- stage 间用 KV optimistic concurrency control（`If-Match` ETag / versioning）

### 7.4 B.5 — Topic ranking + intensity v2

**当前 state**：

- `intensityCalculator.ts`: news severity + agent direction 分歧 + tradeDecision confidence 综合
- topic 按 createdAt desc 排序
- 无 explanation 字段

**B.5 目标 state**：

- `topicRanking = { score, explanation }` 加进 PublicTimelineEvent 或 `mapPublicTimelineEventsToTopics` 输出
- `score` = `intensity × news_freshness_weight × decision_confidence × symbol_priority`
- `explanation` = i18n 模板 `"{symbol} 因 {news_count} 条新闻 + {confidence}% 置信度排第 {rank}"` 等
- i18n namespace `agentWatch.dispatchV10.topicRanking.*`

**算法决策**：

- intensity v2: `(severity_max × 0.4) + (confidence × 0.3) + (consensus_score × 0.2) + (news_count_log × 0.1)`
- explanation 模板按 outcome / rank / symbol 动态选 short / long 版本

### 7.5 B.6 — Polling → SSE

**当前 state**：

- AgentWatchBoard 5s polling `/api/watch/timeline`
- nextPollMs 字段服务端控制 interval

**B.6 目标 state**：

- 新端点 `/api/watch/sse`（GET stream）
- 客户端 EventSource + AbortController + visibility API
- KV broker：writer write 后 publish to SSE broker，broker push 给客户端
- Graceful degrade: SSE 失败 / Safari old / network error → 立即回 polling
- `nextPollMs` 字段保留作 polling fallback

**关键决策**：

- broker 用 KV poll-based（KV write 时附 timestamp，broker 每 100ms scan changes → push）—— 比真消息队列简单
- 或用 Vercel Edge functions + Server-Sent Events native support
- Codex 自决具体实现（看 Vercel Edge runtime 支持度）

### 7.6 B.7 — Follow stats wall + history

**当前 state**：

- Follow stats KV store + API（B 144 commit 已实施）
- 无 history wall UI / 无 intensity heat map

**B.7 目标 state**：

- 新 API `/api/watch/history?symbol=BTCUSDT&limit=20`
- AgentWatchBoard 顶部加 "历史决策" 入口（独立子区域 / 抽屉 / 模态，**不嵌入 v9 Topic.tsx**）
- HistoryWall 展开后显示同 symbol 过往 decision 列表 + symbol 切换器
- 每条 history 含 outcome / 时间 / intensity
- 历史 wall 加 intensity heat map（小型 sparkline / heatmap）

**性能约束**：

- 历史 wall 默认 lazy load（入口 click 后才 fetch）
- 单 symbol > 100 条 → 服务端分页

**视觉边界约束**：

- HistoryWall 是 B owned 新组件，不嵌入 v9 既存 Topic.tsx
- 入口在 AgentWatchBoard 顶部 / 侧栏 / 抽屉，不破 console 内部 layout
- 整体风格 follow v9 视觉语言（颜色 / 字体），不引入新设计系统

### 7.7 B.8 — Real CoinW execution / follow trade（**默认 disabled + Dan 解锁后 mock**）

**当前 state**：

- Follow 按钮 disabled / no-op tracking only（v3.7 + Phase B v2.1 立的 safety 约束）
- 无 execution endpoint / 无 mock 模式 / 无 real CoinW API

**B.8 目标 state（分两阶段）**：

**Stage 1: disabled → mock execution（需 Dan 拍板解锁）**：

- 新 feature flag `FOLLOW_TRADE_MOCK_MODE`（env var / runtime flag）
- 解锁前：按钮 disabled + tooltip "演示模式 / 不真实下单" + click 无副作用
- 解锁后 mock：
  - click → POST `/api/watch/follow-trade-mock` → 模拟 API call delay 500ms → 假成交回流（fake `orderId = "mock-${anonId}-${recordId}-${timestamp}"`, fake `filledPrice = decision.entryPrice`）
  - mock 假成交写入 follow stats KV（区分 `mockExecution` 和 `noOpClick`）
  - mock 触发 fake outcome writeback：60s 后 cron 把 decision mark `resolvedOutcome="hit_tp"` 假写回（仅 mock mode）
- UI 文案：按钮"模拟跟单"（mock 解锁）/"跟单"（real，未来）/"演示模式"（未解锁）

**Stage 2: mock → real CoinW（独立 spec，本 B-master 不实施）**：

- 留空 stub `/api/watch/follow-trade-real`（401 unauthorized 直到独立 spec 解锁）
- 不实施 real API key / signing / order placement / position monitoring

**硬停 gate**：

- B.8 phase 开始时 Codex 必须 verify `FOLLOW_TRADE_MOCK_MODE` env 是否 Dan 拍板设置
- 如未设 / env=false → Codex 仅实施 disabled UI + tooltip + safety copy，跳过 mock execution 实施
- Dan 解锁 = chat 明确说 "B.8 开 mock execution"，并由 F 把 `FOLLOW_TRADE_MOCK_MODE=true` 写进 Vercel preview env / .env.local
- B.8 不允许接 real CoinW API（即使 Dan 在 chat 说"也接 real"，必须等独立 spec）

### 7.8 B.9 — manual_close real writer writeback（**显式解冻 B.1 冻结的 writer 文件**）

**当前 state**：

- `DecisionResolutionResult` writer return union 不含 `manual_close`（writer 当前只产 hit_tp / hit_sl / expired）
- B.1 冻结 `decisionResolution.ts` + `strategy-replay/route.ts` writer 文件
- manual_close 仅 schema union + i18n 文案兼容，writer 不产

**B.9 目标 state**：

- **显式解冻 B.1 冻结**（master spec § 9.4 显式声明 B.9 phase 解冻 writer 文件）
- `decisionResolution.ts` 加 `manual_close` 路径：
  - 输入：admin API `/api/admin/decision/:id/manual-close` 调用（POST + auth header）
  - 处理：writer mark `resolvedAt: now() / resolvedOutcome: "manual_close" / resolutionReason: "manual" / resolutionPriceSource: "admin_manual" / resolvedPrice: currentMarketPrice`
  - idempotency: 如 `resolvedAt != null` → return 409 conflict，不重写
- `strategy-replay/route.ts` cron 跳过已 manual_close decision（不重新评估）
- 新 admin API endpoint `/api/admin/decision/[id]/manual-close`（auth = Dan-only token）
- adapter 已支持 manual_close 渲染（B.1 实施），B.9 仅触发真 writer 产出

**安全约束**：

- admin API 加 auth middleware（验证 X-Admin-Token header）
- token 在 env var `ADMIN_API_TOKEN`（Dan 配置）
- 不解锁前 endpoint return 401（即使 B.9 phase 完成）

---

## 8. 数据流（master 全景）

```
[base: B.1 PR #86 merge 后 main]
                                                                   ┌─ B.9 admin manual_close API ──→ writer
                                                                   │
StrategyDecisionRecord (B.3 schema v2 + rounds[])                  │
   ↑ writer (decisionResolution.ts B.1 冻结 / B.9 解冻 + manual_close)
   ↑ strategy-replay/route.ts cron (B.1 冻结 / B.9 加 manual_close skip)
   ↑ B.4 decisionStageWriter.ts (分 stage 写 + partial)
   ↑ B.2 team registry + 12 real members (含 memory_loop real)
   ↓
publicTimelineProjection.resolutionFromRecord (B.1 不动)
   ↓
PublicTimelineEvent.pm_decision (B.3 加 rounds[] / B.5 加 topicRanking)
   ↓
mapPublicTimelineEventsToTopics ctx { locale, outcomeDict, roundDict (B.3), topicRankingDict (B.5) }
   ↓
v9TopicAdapter (B.3 rounds 兼容 / B.4 in_progress 状态 / B.5 ranking explanation)
   ↓
AgentWatchBoard
   ├─ B.6 SSE EventSource (graceful degrade to polling)
   ├─ B.7 history wall API integration
   ├─ B.8 Follow button (disabled / mock click handler)
   └─ DispatchConsoleV9 (B.3 round display / B.4 in-progress UI)
       ↓
       v9 视觉权威 (A 模块 owned, B 不动)
```

---

## 9. 变更范围（全 phase 累积）

### 9.1 新建（按 phase）

**B.2**：

- 无新建（修改现有）

**B.3**：

- 无新建（schema 改在现有 type 文件，新 namespace 加在 dict 文件）

**B.4**：

- `src/lib/team/decisionStageWriter.ts`（partial stage write logic）
- `src/lib/storage/kv-optimistic-cc.ts`（ETag / versioning helper，如不存在）

**B.5**：

- `src/lib/watch/topicRanking.ts`（score + explanation algorithm）

**B.6**：

- `src/app/api/watch/sse/route.ts`（SSE endpoint）
- `src/lib/watch/sseBroker.ts`（KV poll-based broker）

**B.7**：

- `src/app/api/watch/history/route.ts`（history API）
- `src/modules/agent-watch/v9/HistoryWall.tsx`（history wall UI 组件，B owned）
- `src/modules/agent-watch/v9/IntensityHeatMap.tsx`（sparkline）

**B.8**：

- `src/app/api/watch/follow-trade-mock/route.ts`（mock execution endpoint）
- `src/app/api/watch/follow-trade-real/route.ts`（stub return 401，独立 spec 解锁）
- `src/lib/watch/followTradeMock.ts`（mock logic）

**B.9**：

- `src/app/api/admin/decision/[id]/manual-close/route.ts`（admin manual close endpoint）
- `src/lib/team/manualCloseHandler.ts`（manual close writer logic）

### 9.2 修改（按 phase）

**B.2**：

- `src/lib/team/teamRegistry.ts`（加 memory_loop entry）
- `src/lib/team/types.ts`（TeamMemberId union 加 memory_loop）
- `src/modules/agent-watch/v9/dispatchAgentMapping.ts`（重构 11→12 真映射）
- `src/lib/watch/publicTimelineProjection.ts`（处理 memory_loop 真参与 record）
- LLM prompt 文件（如有 memory_loop 真 prompt 路径）

**B.3**：

- `src/lib/team/strategyDecisionRecord.ts`（加 rounds 数组 + schemaVersion 2）
- `src/lib/watch/publicTimelineProjection.ts`（v2 projection + dual-shape 兼容）
- `src/lib/watch/v9TopicAdapter.ts`（round 显示 + 兼容 v1）
- `src/i18n/dicts/*.json`（10 locale + `dispatchV10.round.*` namespace）
- `src/i18n/types.ts`（dict 类型扩展）

**B.4**：

- `src/lib/team/decisionResolution.ts`（**仅 B.4 不动；B.9 才解冻**）
- `src/app/api/cron/strategy-replay/route.ts`（cron 改为支持 partial run）
- `src/lib/watch/v9TopicAdapter.ts`（in_progress 状态渲染）

**B.5**：

- `src/lib/watch/v9TopicAdapter.ts`（topicRanking 输出）
- `src/i18n/dicts/*.json`（10 locale + `dispatchV10.topicRanking.*` namespace）
- `src/i18n/types.ts`

**B.6**：

- `src/modules/agent-watch/AgentWatchBoard.tsx`（**仅加 SSE EventSource 切换逻辑 + ctx 字段，不动 console seam / props bridge**）
- `src/app/api/watch/timeline/route.ts`（保留 polling，加 nextPollMs 字段）

**B.7**：

- `src/modules/agent-watch/AgentWatchBoard.tsx`（history wall 容器渲染在 console 外，**仅 props / 容器布局，不动 console seam**）
- `src/i18n/dicts/*.json`（10 locale + `dispatchV10.history.*` namespace）
- **注**：B.7 不改 v9 Topic.tsx 等 v9 既存组件。HistoryWall 作为 AgentWatchBoard 子区域独立渲染（console 下方 / 侧边），用户从 board 顶部入口触发，不嵌入 Topic 卡片内。这样 B.7 完全不破 A1 视觉权威

**B.8**：

- `src/modules/agent-watch/v9/FollowButton.tsx`（disabled / mock mode 状态切换）
- `src/lib/watch/followStatsStore.ts`（区分 mockExecution / noOpClick）
- `src/i18n/dicts/*.json`（10 locale + `dispatchV10.followTrade.*` namespace）

**B.9**：

- `src/lib/team/decisionResolution.ts`（**B.9 解冻 + 加 manual_close 路径**）
- `src/app/api/cron/strategy-replay/route.ts`（cron 跳过已 manual_close decision）
- `src/i18n/dicts/*.json`（10 locale + admin error messages）

### 9.3 删除（按 phase）

- B.6 不删除 polling 路径（保留作 graceful degrade fallback）
- 其他 phase 无删除

### 9.4 不动（全 phase 共用，含 A1 owned）

- `src/modules/agent-watch/v10/**`（全程）
- `src/modules/agent-watch/AgentWatchBoard.tsx` 的 **console seam 结构 + props bridge type signature**（B 可加 ctx 字段，不改 seam）
- `src/app/[locale]/agent/page.tsx`（A1 owned）
- v9 视觉权威：DispatchConsoleV9 / MessageBubble / Hero / Constellation / FlowPanel 等的 CSS class / layout / spacing / 颜色 / 字体
- prod 双线 deploy 路径（无 `--prod` / 不推 CoinW GitLab / 不部署 Jenkins）
- 主 worktree 30+ WIP files
- `src/lib/team/decisionResolution.ts`（B.1-B.8 全程冻结，**仅 B.9 显式解冻**）
- `src/app/api/cron/strategy-replay/route.ts`（B.1-B.8 全程冻结，**仅 B.9 显式解冻**）

---

## 10. 依赖前置

- B.1 PR #86 squash merge 完成 + main HEAD 推进
- B.1 i18n outcome 10 locale 验证 PASS（SC-001 / SC-002 / SC-003 全过）
- B.1 writer 冻结 audit 验证 PASS（SC-006 zero diff）
- baseline verify gate 全过
- 干净 worktree 系列（每 phase 独立）：
  - `/tmp/claw42-b2-roles-upgrade`
  - `/tmp/claw42-b3-multi-round-trace`
  - `/tmp/claw42-b4-partial-stage-streaming`
  - `/tmp/claw42-b5-topic-ranking-v2`
  - `/tmp/claw42-b6-sse-realtime`
  - `/tmp/claw42-b7-history-wall`
  - `/tmp/claw42-b8-follow-trade-mock`
  - `/tmp/claw42-b9-manual-close-writer`

---

## 11. Tasks（按 phase 顺序，Codex 自动执行）

### Phase B.2 — 11→12 角色升级

- [ ] T-B2-000 base from B.1 PR #86 merged main HEAD（Codex T000 commit 完拿 sha）
- [ ] T-B2-001 创建 worktree `/tmp/claw42-b2-roles-upgrade` + branch `feature/spec-b-master-b2-roles-upgrade`
- [ ] T-B2-010 [P] grep team registry / dispatchAgentMapping / TeamMemberId union 当前 shape（双脑判断 Q-B2.1）
- [ ] T-B2-011 `src/lib/team/teamRegistry.ts` 加 memory_loop entry（id / displayName / role / desc / promptVersion）
- [ ] T-B2-012 `src/lib/team/types.ts` `TeamMemberId` union 加 `"memory_loop"`
- [ ] T-B2-013 `src/modules/agent-watch/v9/dispatchAgentMapping.ts` 12→12 真映射 + `DISPATCH_AGENT_NOT_IN_CURRENT` 移除 memory_loop
- [ ] T-B2-014 `src/lib/watch/publicTimelineProjection.ts` 处理 memory_loop 真参与 record
- [ ] T-B2-015 i18n 微调（dispatchV10.roles.memoryLoop 已有，仅校准 desc / stat）
- [ ] T-B2-020 测试：vitest unit `dispatchAgentMapping.test.ts` 加 12 角色覆盖 case
- [ ] T-B2-021 测试：publicTimelineProjection.test.ts 加 memory_loop record case
- [ ] T-B2-030 staging fixture 加 1 条含 memory_loop 真参与 record
- [ ] T-B2-040 verify gate 全过 + Vercel preview READY
- [ ] T-B2-041 视觉 verify：hero 仍 11 anode（v10 不动）+ flow stage-6 + chat memory_loop 渲染对
- [ ] T-B2-050 PR + squash merge + 自动 phase gate 判定（§ 0.4 五条 PASS）→ 进 B.3

### Phase B.3 — Multi-round debate trace schema v2

- [ ] T-B3-001 worktree `/tmp/claw42-b3-multi-round-trace` + branch `feature/spec-b-master-b3-multi-round`
- [ ] T-B3-010 [P] grep schema v1 当前 shape + LLM prompt 文件路径（双脑 Q-B3.1）
- [ ] T-B3-011 `src/lib/team/strategyDecisionRecord.ts` 加 `schemaVersion: 2` + `analystInputs[].rounds: AnalystInputRoundRecord[]` + `stages[].rounds: DispatchStageRoundRecord[]`
- [ ] T-B3-012 `src/lib/team/types.ts` 加 `AnalystInputRoundRecord` / `DispatchStageRoundRecord` types
- [ ] T-B3-013 LLM prompt 改动：analyst 每 stage 跑 2 round（"based on round 1 results, refine your view"）
- [ ] T-B3-014 writer 改动：每 round 一次 KV write，最后整合 record（**不动 decisionResolution.ts** —— 加新 helper `roundWriter.ts`）
- [ ] T-B3-015 `publicTimelineProjection` 加 rounds 投射 + dual-shape 兼容（v1 → 单 round v2）
- [ ] T-B3-016 `v9TopicAdapter` 渲染 round 编号 + round 间分隔
- [ ] T-B3-017 i18n: `agentWatch.dispatchV10.round.{label, separator, single, multi}` 10 locale 全翻
- [ ] T-B3-020 测试：schema v1 / v2 dual-shape 兼容 case
- [ ] T-B3-021 测试：adapter round 显示 multi-round + single-round 兼容
- [ ] T-B3-030 staging fixture: 加 1 条 v2 multi-round record + 保留 1 条 v1 legacy record
- [ ] T-B3-040 verify gate
- [ ] T-B3-041 视觉 verify：multi-round 显示 layout + 单 round legacy 兼容渲染
- [ ] T-B3-050 PR + squash merge + phase gate → 进 B.4

### Phase B.4 — Partial stage writes / streaming

- [ ] T-B4-001 worktree `/tmp/claw42-b4-partial-stage-streaming` + branch `feature/spec-b-master-b4-partial-streaming`
- [ ] T-B4-010 [P] grep KV API 当前 contract + cron 当前实现 + ETag/versioning 支持度（双脑 Q-B4.1）
- [ ] T-B4-011 新建 `src/lib/team/decisionStageWriter.ts` 分 stage 写入 logic
- [ ] T-B4-012 新建 `src/lib/storage/kv-optimistic-cc.ts` ETag / version 检查（如 KV 已有 → 复用）
- [ ] T-B4-013 cron `strategy-replay/route.ts` 改为支持 partial run（仍冻结 decisionResolution.ts；cron 仅调度，不动 resolution writer）
- [ ] T-B4-014 `publicTimelineProjection` 处理 partial record（部分 stage in_progress）
- [ ] T-B4-015 `v9TopicAdapter` `makeStages` 渲染 `in_progress` 状态（新 i18n key + 视觉占位）
- [ ] T-B4-016 i18n: `agentWatch.dispatchV10.stageStatus.{pending, in_progress, done}` 10 locale
- [ ] T-B4-020 测试：partial write → KV → adapter → UI 端到端
- [ ] T-B4-021 测试：concurrent partial write conflict（optimistic CC retry）
- [ ] T-B4-030 staging：fixture 加 1 条 partial record（stage 3 in_progress）
- [ ] T-B4-040 verify gate
- [ ] T-B4-041 视觉 verify：in_progress 渲染（动画 / spinner / 占位文字）
- [ ] T-B4-050 PR + squash merge + phase gate → 进 B.5

### Phase B.5 — Topic ranking + intensity v2

- [ ] T-B5-001 worktree `/tmp/claw42-b5-topic-ranking-v2` + branch `feature/spec-b-master-b5-topic-ranking`
- [ ] T-B5-010 [P] grep intensityCalculator 当前实现 + topic 排序逻辑（双脑 Q-B5.1）
- [ ] T-B5-011 新建 `src/lib/watch/topicRanking.ts` 实现 score + explanation algorithm
- [ ] T-B5-012 `publicTimelineProjection` 或 `mapPublicTimelineEventsToTopics` 输出 topicRanking 字段
- [ ] T-B5-013 `v9TopicAdapter` topic ranking 排序 + explanation 渲染
- [ ] T-B5-014 i18n: `agentWatch.dispatchV10.topicRanking.{explanation_template, rank_label}` 10 locale
- [ ] T-B5-020 测试：ranking score 计算 + tie-break + explanation 模板插值
- [ ] T-B5-030 staging：4 topic fixture 不同 score + explanation 显示
- [ ] T-B5-040 verify gate
- [ ] T-B5-041 视觉 verify：topic 排序 + explanation 文案 layout
- [ ] T-B5-050 PR + squash merge + phase gate → 进 B.6

### Phase B.6 — Polling → SSE

- [ ] T-B6-001 worktree `/tmp/claw42-b6-sse-realtime` + branch `feature/spec-b-master-b6-sse`
- [ ] T-B6-010 [P] grep AgentWatchBoard polling 当前实现 + Vercel Edge SSE 支持度（双脑 Q-B6.1）
- [ ] T-B6-011 新建 `src/app/api/watch/sse/route.ts` SSE endpoint（Edge runtime）
- [ ] T-B6-012 新建 `src/lib/watch/sseBroker.ts` KV poll-based broker
- [ ] T-B6-013 `AgentWatchBoard.tsx` 加 EventSource + AbortController + visibility API + graceful degrade to polling（**仅加 ctx 字段 + 切换逻辑，不动 console seam**）
- [ ] T-B6-014 timeline route 保留 polling + nextPollMs 字段（fallback）
- [ ] T-B6-020 测试：SSE 端到端 + degrade 路径
- [ ] T-B6-021 测试：SSE 失败 → 自动切 polling
- [ ] T-B6-030 staging：模拟 SSE 推送 + 验证客户端接收 < 1s
- [ ] T-B6-040 verify gate
- [ ] T-B6-041 视觉 verify：实时更新无闪烁
- [ ] T-B6-050 PR + squash merge + phase gate → 进 B.7

### Phase B.7 — Follow stats wall + history

- [ ] T-B7-001 worktree `/tmp/claw42-b7-history-wall` + branch `feature/spec-b-master-b7-history-wall`
- [ ] T-B7-010 [P] grep follow stats store + Topic.tsx 当前实现（双脑 Q-B7.1）
- [ ] T-B7-011 新建 `src/app/api/watch/history/route.ts` history API（按 symbol 查询，分页）
- [ ] T-B7-012 新建 `src/modules/agent-watch/v9/HistoryWall.tsx` history wall UI（B owned 不是 A1 v10）
- [ ] T-B7-013 新建 `src/modules/agent-watch/v9/IntensityHeatMap.tsx` sparkline 热力图
- [ ] T-B7-014 AgentWatchBoard 加 history wall 入口 + 容器渲染（**不嵌入 v9 Topic.tsx**，作为 board 独立子区域 / 抽屉 / 模态）
- [ ] T-B7-015 i18n: `agentWatch.dispatchV10.history.{wall_title, outcome_label, expand, collapse, more}` 10 locale
- [ ] T-B7-020 测试：history API 分页 + 单 symbol > 100 条
- [ ] T-B7-021 测试：HistoryWall render + IntensityHeatMap render
- [ ] T-B7-030 staging：seed 20 条 historical decision fixture（含不同 outcome）
- [ ] T-B7-040 verify gate
- [ ] T-B7-041 视觉 verify：history wall 展开 / 折叠 / heat map render
- [ ] T-B7-050 PR + squash merge + phase gate → 进 B.8

### Phase B.8 — Real CoinW execution / follow trade（**默认 disabled + Dan 解锁后 mock**）

- [ ] T-B8-000 **gate check**: `process.env.FOLLOW_TRADE_MOCK_MODE === "true"`?
  - 若否 → 仅实施 T-B8-010 / T-B8-011（disabled UI + safety copy），跳过 T-B8-012 之后 + 报 F + 等 Dan 解锁
  - 若是 → 完整跑 T-B8-010 ~ T-B8-050
- [ ] T-B8-001 worktree `/tmp/claw42-b8-follow-trade-mock` + branch `feature/spec-b-master-b8-follow-trade-mock`
- [ ] T-B8-010 [P] grep FollowButton 当前实现 + followStatsStore 当前 contract（双脑 Q-B8.1）
- [ ] T-B8-011 `src/modules/agent-watch/v9/FollowButton.tsx` disabled 状态 + tooltip + safety copy（无论是否解锁都加）
- [ ] T-B8-012 [仅 mock 解锁] 新建 `src/app/api/watch/follow-trade-mock/route.ts` mock endpoint
- [ ] T-B8-013 [仅 mock 解锁] 新建 `src/lib/watch/followTradeMock.ts` mock logic（500ms delay + fake order id + fake fill price）
- [ ] T-B8-014 [仅 mock 解锁] mock 假成交触发 follow stats KV write（区分 mockExecution / noOpClick）
- [ ] T-B8-015 [仅 mock 解锁] mock fake outcome writeback（60s 后 cron mark hit_tp，仅 mock mode）—— **不动 decisionResolution.ts 主路径**，加 mock-only `followTradeMockOutcome.ts` 独立 helper
- [ ] T-B8-016 [仅 mock 解锁] FollowButton click handler 切换：disabled / mock execution / real（real return 401 stub）
- [ ] T-B8-017 [仅 mock 解锁] 新建 `src/app/api/watch/follow-trade-real/route.ts` stub return 401 + auth header 检查（独立 spec 解锁）
- [ ] T-B8-018 i18n: `agentWatch.dispatchV10.followTrade.{disabled_tooltip, mock_label, mock_success, mock_fail, real_label_future}` 10 locale
- [ ] T-B8-020 测试：disabled state UX + mock execution success + mock fail（50% fail 概率）+ idempotency
- [ ] T-B8-030 staging：mock mode 开 + manual click 验证
- [ ] T-B8-040 verify gate
- [ ] T-B8-041 视觉 verify：disabled / mock execution states
- [ ] T-B8-050 PR + squash merge + phase gate → 进 B.9（即使 disabled-only 跑也 merge，记入 master spec 进度）

### Phase B.9 — manual_close real writer writeback（**显式解冻 B.1 冻结的 writer 文件**）

- [ ] T-B9-000 **解冻声明**: B.9 phase 唯一允许动 `src/lib/team/decisionResolution.ts` 和 `src/app/api/cron/strategy-replay/route.ts`；本 phase 内 git diff 这两个文件 ≠ 0 是 expected。其他 B phase 不能 carry over 这两个文件的改动
- [ ] T-B9-001 worktree `/tmp/claw42-b9-manual-close-writer` + branch `feature/spec-b-master-b9-manual-close`
- [ ] T-B9-010 [P] grep decisionResolution writer 当前 union + cron flow（双脑 Q-B9.1）
- [ ] T-B9-011 `src/lib/team/decisionResolution.ts` `DecisionResolutionResult` union 加 `manual_close` + writer 路径
- [ ] T-B9-012 新建 `src/lib/team/manualCloseHandler.ts` manual close 处理（idempotency + market price snapshot）
- [ ] T-B9-013 新建 `src/app/api/admin/decision/[id]/manual-close/route.ts` admin endpoint（auth = X-Admin-Token header）
- [ ] T-B9-014 `strategy-replay/route.ts` cron 跳过已 manual_close decision（不重新评估）
- [ ] T-B9-015 i18n: 不需新 key（B.1 已加 `outcome.manual_close`）；admin error messages 加 `agentWatch.admin.{unauthorized, idempotency_conflict}`
- [ ] T-B9-016 env var setup: `ADMIN_API_TOKEN`（Dan 配置 Vercel preview env）
- [ ] T-B9-020 测试：manual close → writer → record → adapter → memory_loop msg "人工关闭" 渲染（zh_CN + en_US）
- [ ] T-B9-021 测试：idempotency（已 resolved 不重写）+ admin auth（401 / 200）
- [ ] T-B9-030 staging：admin endpoint 测试（manual close 1 条 fixture decision）
- [ ] T-B9-040 verify gate
- [ ] T-B9-041 视觉 verify：manual_close outcome 渲染 + 多 locale
- [ ] T-B9-050 PR + squash merge + phase gate → B master 完成

### Master 总结报告（最后一步）

- [ ] T-M-FINAL Codex 在 `codex-to-claude.md` 写 master 完成报告：
  - 8 phase PR 列表 + squash commit sha
  - 全部 SC-M-001 ~ SC-M-010 跨 phase SC verify 结果
  - i18n 新 namespace 总数 + 10 locale 完整性
  - 每 phase verify gate 输出
  - 每 phase Vercel preview URL
  - decision-log 联动报告（待 F 追加 master 完成 entry）

---

## 12. 约束（master 共用）

- 全程不动 A1 owned（v10 module / page.tsx / hero / constellation 视觉）
- 全程不动 prod 双线（无 `--prod` / 无 CoinW GitLab / 无 Jenkins）
- 全程不动主 worktree WIP
- 每 phase 独立 worktree + branch + PR
- Phase 间 gate 自动判定（§ 0.4 五条 PASS 才进下一 phase）
- i18n 10 locale 默认全翻译（不向 Dan 问；en_XA 占位）
- 任何 schema mismatch / 接口不一致 → [SPEC-FEEDBACK]，不自行猜
- transient HTTP 502/503/504/timeout → retry 1-2 次（间隔 30s/90s/3min）；真阻塞（merge conflict / CI red / protected branch 等）→ 立即停 + 报告
- B.8 默认 disabled，仅在 `FOLLOW_TRADE_MOCK_MODE=true` 时跑 mock execution；real CoinW API 全程不接（独立 spec）
- B.9 显式解冻 writer 文件；其他 phase 全程冻结（B.4 cron 仅调度不动 resolution writer）
- 长时间运行期间如 Codex 自己 context 污染 / 不确定 → 立即停 + 报 F，不擅自硬推
- 每 phase ≤ 5 commit / ≤ 3 AI 天，超 → 停 + 报 F

---

## 13. 不能做清单

- ❌ 不能改 A1 owned 文件（v10 module / AgentWatchBoard console seam / page.tsx 注入 / hero / constellation 视觉）
- ❌ 不能改 prod 双线 deploy 任何配置
- ❌ 不能动主 worktree（每 phase 用独立 `/tmp/claw42-*` worktree）
- ❌ 不能在 B.1-B.8 期间动 `src/lib/team/decisionResolution.ts` / `src/app/api/cron/strategy-replay/route.ts`（仅 B.9 解冻）
- ❌ 不能接 real CoinW API（即使 Dan chat 说"也接 real"，必须等独立 spec）
- ❌ 不能跳过 phase gate（§ 0.4 五条任一不过 → 停）
- ❌ 不能在 phase 间 carry over 文件改动（每 phase PR 独立）
- ❌ 不能 hardcode 任何新中文（i18n 完整性纪律）
- ❌ 不能假装有 `t(key, vars)` API（B.1 已立 ctx + typed sub-dict 模式）
- ❌ 不能 force-push / rewrite history
- ❌ 不能用 Storybook / RTL（repo 无）
- ❌ 不能用 `--prod` / 不能推 CoinW GitLab / 不能动 Jenkins
- ❌ 不能 schemaVersion 跳变（B.3 仅 v1 → v2；不能直接 v2 → v3）
- ❌ B.9 解冻 writer 时不能"顺便重构 writer 现有逻辑"——仅加 manual_close 路径
- ❌ 不能跳过双脑判断点（§ 18 每 phase 必填）

---

## 14. Constitution 对照检查（v0.1.1 7 Rule，master 全程通用）

| Rule                       | 状态        | 评估                                                                                                                                                |
| -------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule 1 部署身份            | PASS        | 每 phase preview only / 不推 CoinW GitLab / 走 agentxmain-collab                                                                                    |
| Rule 2 生产保护（双 prod） | PASS        | 双 prod 全程不动；无 `--prod` / 不上 claw42.ai / 不上 ai.coinw.com                                                                                  |
| Rule 3 视觉品牌权威        | PASS        | 不动 v9 / v10 视觉权威；B 仅改数据 / 逻辑 / API；B.7 加 HistoryWall 是 v9 owned 新组件不破现有 layout                                               |
| Rule 4 数据 schema 纪律    | CONDITIONAL | B.3 升级 schema v1→v2 + B.4 加 partial state + B.9 writer union 加 manual_close —— 每个改动都在 spec 显式声明 + dual-shape 兼容 + decision-log 联动 |
| Rule 5 AI / 行情诚实性     | PASS        | B.8 mock mode 文案明示"演示模式"+ FOLLOW_TRADE_MOCK_MODE flag gate；real CoinW 独立 spec                                                            |
| Rule 6 协作闭环            | PASS        | 每 phase 走 Codex 双脑评估 + sync READ/writeback + phase gate 自动判定                                                                              |
| Rule 7 验证门槛            | PASS        | 每 phase 全 verify gate + Vercel preview + 视觉 verify + i18n 10 locale Node script                                                                 |

**Rule 4 CONDITIONAL 说明**：B.3 / B.4 / B.9 三 phase 改 schema，但都符合 schema 纪律——每个改动 spec 显式声明 + dual-shape 兼容 + decision-log 留痕。Codex 实施前必须 verify 每 phase schema 改动是否仍在本 spec § 9 范围内；超出 → [SPEC-FEEDBACK]，不自行猜。

---

## 15. Worktree

- **F 起草 worktree**: F session 沙箱
- **每 phase Codex 实施 worktree**: 独立 `/tmp/claw42-b{N}-{phase-name}`
- **base HEAD**: B.1 PR #86 squash merge 后的 main HEAD（Codex T000 拿）；之后每 phase base = 上一 phase merge 后的 main HEAD
- **branches**: `feature/spec-b-master-b{N}-{phase-name}`
- **PR base**: `main`（每 phase 独立 PR）
- **不动**: 主 worktree `/Users/dannybrown/Claude/职业规划/web-dev/claw42`（30+ WIP）
- **决策档案**: `/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md`（repo 外只读引用）
- **Constitution**: `docs/project-constitution.md` v0.1.1（worktree cwd 视角）

---

## 16. 老板简报

claw42 Watch 板未来一段时间会按顺序完成 8 件事。每件事独立测试通过才推下一件，全程只动迭代版预发，不上正式版。

按顺序：

1. 补齐 12 个真实 AI 角色（含"复盘主管"从占位升级为真角色）
2. 决策过程加入多轮辩论历史，用户能看到分析师"先这么想后来又改"的演进
3. 加进度条：决策跑到哪一步实时刷新，不再"突然全部完成"
4. 热点排序加解释："为什么 BTC 排第 1"
5. 数据更新提速到秒级（之前 5 秒一次）
6. 历史决策可点回看（同一个币种过往 AI 怎么分析的）
7. "跟单"按钮加 mock 演示模式（点了模拟下单，给 Dan review 整个 UX，但不真下单）
8. 人工平仓决策能正常写入系统并完整复盘

第 7 件（跟单 mock）需要 Dan 明确说"开 mock"才会跑。真接 CoinW 下单是后续独立项目，本批不接。

第 8 件涉及内核代码解冻（这次只动核心一处，不重写）。

---

## 17. Anti-Rationalization

| 逃逸路径                                                              | 为什么不行                                                                                                                                                         | 正确做法                                                              |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 觉得 master spec 太长 Codex 跑不完                                    | spec 长是因为覆盖 8 phase，每 phase Codex 实际只读 § 7.{N} / § 11.{N} / § 18.{N}，context 控制得住                                                                 | Codex 按 phase 读对应小段，不一次性读全文                             |
| 觉得 phase 间 gate 太严，CI 慢一点先跑下一 phase                      | gate 是硬纪律，跳 gate = phase 累积漏洞难定位                                                                                                                      | 严格按 § 0.4 五条 PASS 才进下一 phase                                 |
| 觉得 B.8 mock 反正没真 API 顺便也接 real CoinW                        | real CoinW 是 legal / security / auth 决策，独立 spec                                                                                                              | B.8 仅 disabled + mock；real return 401 stub                          |
| 觉得 B.9 解冻 writer 顺便 refactor 现有逻辑                           | refactor 引入风险 + 跨 scope；B.9 仅加 manual_close 路径                                                                                                           | 仅 minimal patch 加 manual_close，不动其他 writer code                |
| 觉得 B.3 schema v2 顺便上 v3                                          | schema 跳版破 dual-shape 兼容；下游消费方按 v2 实施                                                                                                                | 仅 v1 → v2，v3 留下轮独立 spec                                        |
| 觉得每 phase 都写完整 SPEC-FEEDBACK 报告太冗                          | SPEC-FEEDBACK + 双脑判断是 phase gate 必填                                                                                                                         | 每 phase 必写，不省                                                   |
| 觉得跨 phase carry over 一些 i18n key 一次性翻完省时间                | i18n 跨 phase carry = phase 边界混乱 + diff 难审                                                                                                                   | 每 phase 仅翻自己的 namespace                                         |
| 觉得 B.6 SSE 失败回 polling 是优雅降级所以也允许直接 polling 不上 SSE | SSE 是 B.6 主路径；degrade 是 fallback 不是替代                                                                                                                    | B.6 必须实施 SSE + degrade 双路径                                     |
| 觉得 B.4 partial write 触碰 cron 等于触碰 writer 应该停               | cron `strategy-replay/route.ts` 是 cron 调度入口，B.1 冻结的是 resolution 写入逻辑文件 + cron 文件；B.4 仅改 cron 调度（partial run），不改 resolution writer 逻辑 | B.4 改 cron 文件需在 § 9.2 显式说明仅调度改动 + decision-log 联动记录 |
| 觉得 A1 owned AgentWatchBoard 永远不能碰                              | B 可加 ctx 字段 + 接 SSE EventSource + 接 HistoryWall props，不动 console seam 结构 / props bridge type                                                            | B 仅加字段不改 seam，每改动在 § 9 § 9.4 显式说明                      |
| 觉得 Dan 长时间不 reply 我可以擅自降级 phase 范围                     | phase 范围 spec 写死；Dan 不 reply 是 expected（Codex 长时间自跑）；遇 [SPEC-FEEDBACK] 立即停 等 Dan 介入                                                          | 严格按 spec 跑，遇问题立即停 + 写 codex-to-claude.md 报 F             |
| 觉得 spec 留 audit trail 让 F/Dan 看到 v1.0 → v1.x 变化               | spec 是 single source of truth；audit trail 由 decision-log 维护                                                                                                   | spec 内不留 strike-through / "(v1.1 修订：...)" 注解                  |

---

## 18. 双脑判断点（每 phase 必填，Codex 实施前 cat 实测 + 写 codex-to-claude.md）

### Q-B2.1: team registry 当前 shape + memory_loop 升级是否破环

- `cat src/lib/team/teamRegistry.ts` 看 11 角色 entry 结构
- `cat src/lib/team/types.ts` 看 TeamMemberId union
- 加 memory_loop 是否影响 admin / debug 等其他 consumer
- 给出最小改动方案 + 风险点

### Q-B3.1: schema v1 → v2 dual-shape 兼容

- `cat src/lib/team/strategyDecisionRecord.ts` 看当前 shape
- v1 record 老 KV 数据如何投到 v2（单 round 默认）
- LLM prompt 改动是否影响现有 record（新老共存）

### Q-B4.1: KV optimistic CC + partial write 触发条件

- `cat src/app/api/cron/strategy-replay/route.ts` 看 cron 当前实现
- KV `If-Match` ETag 支持度（Vercel KV / Upstash Redis）
- partial run timeout 处理（cron 60s 内未跑完）

### Q-B5.1: intensity v2 算法 + explanation 模板

- `cat src/lib/watch/intensityCalculator.ts` 看当前实现
- v2 算法 4 个权重 (0.4/0.3/0.2/0.1) 是否合理（看历史 data 分布）
- explanation 模板按 rank / outcome 分情况

### Q-B6.1: SSE Vercel Edge 支持度 + broker 实现

- `cat src/modules/agent-watch/AgentWatchBoard.tsx` 看 polling 实现
- Vercel Edge Runtime 是否原生支持 SSE response stream
- KV poll-based broker vs Redis pub/sub vs Edge native（Codex 自决）

### Q-B7.1: history wall 性能 + heat map 渲染

- `cat src/lib/watch/followStatsStore.ts` 看 KV 结构
- 单 symbol > 100 条历史的分页策略
- sparkline 用 SVG vs Canvas vs Chart lib

### Q-B8.1: feature flag gate + mock idempotency

- `cat src/modules/agent-watch/v9/FollowButton.tsx` 看当前 disabled / no-op 实现
- `process.env.FOLLOW_TRADE_MOCK_MODE` Vercel preview env 注入路径
- mock idempotency key 设计（防重复 click 重复假成交）

### Q-B9.1: writer manual_close 路径 + admin auth

- `cat src/lib/team/decisionResolution.ts` 看 DecisionResolutionResult union + writer flow
- admin token X-Admin-Token 验证（中间件 / route handler）
- manual_close 触发时 market price 来源（live API vs 最新 record）

### 每 phase 必填实施前 grep check（共通）

- [ ] `cat src/lib/team/strategyDecisionRecord.ts` 当前 schema
- [ ] `cat src/i18n/types.ts | grep -A 30 dispatchV10` 当前 namespace
- [ ] `cat src/lib/watch/v9TopicAdapter.ts` 当前 adapter（每 phase 都可能改）
- [ ] `ls src/i18n/dicts/*.json | wc -l` 10 locale 全在
- [ ] `git diff origin/main -- src/lib/team/decisionResolution.ts src/app/api/cron/strategy-replay/route.ts` 应 = 0（除 B.9 phase）
- [ ] `cat docs/project-constitution.md` v0.1.1 7 Rule
- [ ] `cat /Users/dannybrown/Claude/职业规划/web-dev/decision-log.md | head -200` 最近 entry
- [ ] grep prod / Jenkins / CoinW GitLab 推送 keyword 在 phase 内 commits 应 = 0

如任一不一致 → [SPEC-FEEDBACK]，立即停 + 报 F。

---

## 19. decision-log 联动

spec 起草 + 每 phase 完成都触发追加 entry 到 `/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md`（repo 外部文件，只读引用，不进 git commit）：

- 2026-05-14（待 F 追加）: B-master spec v1.0 起草 + 8 phase 范围 + B.8 mock 解锁路径
- 每 phase merge 后（Codex 触发 F 追加）: B.{N} 完成 + commit sha + verify 输出
- B.8 phase 跑到 mock gate check 时（Codex 触发 F 追加）：B.8 gate 状态 + Dan 解锁 / 未解锁判定
- B.9 phase 解冻 writer 触发（Codex 触发 F 追加）：B.9 解冻范围声明 + manual_close 路径 commit sha
- Master 完成（Codex 触发 F 追加）: B 模块全 8 phase 完成总结

Codex 实施前 / 每 phase 开始时 / 任何拍板节点 / B.8 gate / B.9 解冻 都先读 decision-log。

---

## 工作量预估

| Phase                                                 | 时间（AI 天）                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| B.2 11→12 角色升级                                    | 1.5-2                                                              |
| B.3 Multi-round schema v2                             | 2-3                                                                |
| B.4 Partial stage streaming                           | 1.5-2                                                              |
| B.5 Topic ranking v2                                  | 1-1.5                                                              |
| B.6 Polling → SSE                                     | 2-3                                                                |
| B.7 History wall + heat map                           | 1.5-2                                                              |
| B.8 Follow trade mock（解锁前 0.5；解锁后完整 1.5-2） | 0.5-2                                                              |
| B.9 manual_close writer                               | 1-1.5                                                              |
| **总计**                                              | **11-16 AI 天**（双时钟规划：AI 时钟 A 可连续；真实时钟 B 1-2 周） |

每 phase merge 后下一 phase 自动开始（除 B.8 gate 等 Dan）。

---

## 关联资产

- 前置 spec：B.1 spec-watch-B1-memory-loop-hardening v1.1（PR #86 merge 后）
- 前置 spec：B v2.1 spec-watch-phase-b-real-agent-pipeline（B 144 commit base）
- 前置 spec：A1 spec-watch-A1-dispatch-console-v10（v9/v10 视觉权威 baseline）
- Constitution：`claw42/docs/project-constitution.md` v0.1.1
- Decision-log：`/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md`
- Codex sync：`claw42/claude-codex-sync/codex-to-claude.md`（B.1 evaluations + grep prep）

---

_v1.0 起草：2026-05-14 23:30 CST F session_
_起草前置：Dan 拍板"全 8 phase + B.8 硬停（Dan 拍板 + mock execution mode 先跑）"_
_下一动作：先等 B.1 PR #86 squash merge 完成 → Codex T000 commit master spec docs → Round 1 双脑评估_
