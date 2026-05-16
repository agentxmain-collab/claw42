# Spec: Watch B.13 Hotfix 3 — Timeline 投影修复 + Watch-only 显示

> **版本**：v1.0（2026-05-16 紧急 hotfix 3）
> **作者**：F (Claude session)
> **状态**：Hotfix Draft，立即派 Codex 双 task
> **协议**：claude-codex-protocol v2.5
> **触发**：hotfix-2（PR #101）诊断结论 — BILL 真 PM record 在 KV 但 timeline API 返回 `events=[]`。F 推测 candidate selector 跑 watch-only 但 timeline projection 又过滤 watch-only → 两端不一致。Dan 2026-05-16 chat 拍 X 方案：watch-only PM record 显示 + 加"不可跟单"badge

---

## § 1 Overview

### 1.1 hotfix-2 关键发现（PR #101 已 merged）

| 发现                                                            | 含义                                                                  |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| KV 已有 1 条 BILL 真 PM record，14 角色 DeepSeek telemetry 成功 | LLM 实际跑通                                                          |
| `/api/watch/timeline` 仍返回 `events=[]`                        | 投影路径**断裂**                                                      |
| Vercel preview cron 不自动跑（官方规则）                        | 不是关键阻塞——user-trigger refresh 链路如能跑通，preview 也能拿真数据 |

### 1.2 hotfix-3 双 task 范围

**Task A — 调研 + 修 timeline 投影断裂**：

F 推测最可能根因（Codex first-hand 验证）：

- Stage 3 加 CoinW Execution filter 时 candidate selector **允许** watch-only symbol 进 PM pipeline（BILL 跑出真 record）
- 但 `/api/watch/timeline` projection / `buildWatchTimelinePayload` 又**过滤** watch-only record
- 两端不对称 → 跑了不显示

**首先调研确认根因**（first-hand 查 timeline projection / publicTimelinePayload / watch-only filter 实际逻辑），再 fix。

**Dan 拍板（chat 选项 X）**：watch-only PM record 应该显示 + 加"不可跟单"badge。Fix 策略：

1. timeline projection 允许 watch-only record 通过（不再过滤掉）
2. record payload 携带 `executable: false` flag
3. UI 在 V10 record 卡片上显示"watch-only / 不可跟单" badge
4. follow-trade 按钮（Stage 3 T308 已实装）严格不渲染（确认 watch-only flag 流到 button render 条件）

**Task B — Preview-safe refresh trigger 强化**（P1）：

Vercel preview cron 不跑是事实，user-trigger refresh 必须是 preview 模式下唯一可靠路径。强化：

- 确认 `/api/watch/refresh` POST 在 preview 模式下 waitUntil 真跑 PM pipeline（不是 silently no-op）
- visible-session trigger 在 preview 模式触发率 ≥ 99%（grep 触发条件 + 实测）
- 如发现 preview-specific issue（如 KV scope / env var 缺失）报告 F

### 1.3 完成 hotfix-3 后预期

Dan 打开 preview → 工作台 → user-trigger refresh → PM pipeline 跑（waitUntil）→ KV 写入新 record → public timeline projection 通过 → UI 显示真分析（executable 加 follow 按钮 / watch-only 加 "不可跟单" badge）。

Empty state 仅在**真的零 record 时**显示，而非"有 record 但被 filter 吞掉"。

---

## § 2 In-Scope / Out-of-Scope

### 2.1 Task A In-Scope

**调研**（first-hand 必查）：

1. 当前 `/api/watch/timeline` projection 逻辑（`buildWatchTimelinePayload` 或类似）— 看是否过滤 watch-only / executable: false record
2. KV 中 BILL record 的实际 schema — `executable` flag 是否写入，timeline projection 怎么读
3. UI 端 follow-trade 按钮 render 条件 — 是否真依赖 record-level `executable` flag

**修改**：

- timeline projection 允许 watch-only record 进 events 列表
- record payload 携带 `executable: boolean` 字段（如未有）
- V10 record 卡片显示 "watch-only / 不可跟单" badge（10 locale 文案，含 en_XA）
- follow-trade 按钮 strict gate：`record.executable === true` 才渲染（grep + 测试覆盖）

### 2.2 Task B In-Scope

- 实测 / grep 确认 `/api/watch/refresh` POST 在 preview env 下 waitUntil 真触发 PM pipeline
- 实测 visible-session trigger 在 preview 模式触发链路完整（sessionStorage / refresh POST / waitUntil / KV / projection）
- 如发现 preview-specific issue 报告 F + 不擅自 fix

### 2.3 Out-of-Scope

- 不动 PM pipeline 逻辑（Stage 1-4 改动保留）
- 不动 evidenceDispatcher / memoryLoopEvidence backend
- 不撤 hotfix-1 / hotfix-2 已 merge 改动（demo fallback 仍关 / empty state 仍在）
- 不擅自改 Vercel cron 配置（layer 1 preview cron 不跑是平台限制，不在本 hotfix 修）
- 不上 prod（Constitution Rule 2 v0.1.2）
- B.14 / B.15 继续暂停

---

## § 3 Edge Cases

### 3.1 投影 fix

- record schema 在 KV 中是否有 `executable` 字段？如未有，需 Codex 决定从 `symbolMapping.ts` 反查 / 还是 record 写入时补字段
- 历史 record（hotfix-1 之前）可能没 `executable` 字段 → 投影时默认 fallback 到 `symbolMapping` 查询
- watch-only record 加入 timeline 后，flow / ranking 是否需要调整？Task A 不改 ranking，仅修过滤——如果 ranking 把 watch-only 排太前 Dan 反馈再调

### 3.2 UI badge

- 多 locale 文案统一："watch-only / 不可跟单"（中）/ "Watch only · Not followable"（英）/ 其他 locale 同标
- badge 视觉与 executable 卡片**区分明显**（如灰色 + icon）
- badge 不抢主决策视觉

### 3.3 Task B preview trigger

- 如 Codex 发现 preview env 的 `@vercel/functions` waitUntil 行为与 prod 不同（如 worker 跑不全）→ 必须报告 F，不擅自调整 timeout
- 如发现 KV 在 preview 写入但生产域无法读取（cross-env 数据隔离） → 报告 F

---

## § 4 Assumptions

1. timeline projection 断裂根因在过滤层（F 推测 candidate filter 两端不一致），但 Codex 必须 first-hand 验证不假设
2. UI follow-trade 按钮已在 Stage 3 T308 实装"watch-only 不渲染"逻辑（hotfix-3 是补 badge + 确认 gate 流通）
3. record 加 `executable` 字段对其他模块（v9 layout / stream API）无 backward break
4. 10 locale i18n 加 1 个 badge key 不破坏现有翻译 schema

---

## § 5 Measurable Success Criteria

### 5.1 Task A 验收

- ✅ Codex 报告含 timeline 投影断裂**真根因**（first-hand 代码行号 + KV 实测 + 投影逻辑确认）
- ✅ Vercel preview 打开工作台 → user 触发 refresh → 等 PM pipeline 跑完（约 30-60s）→ timeline 显示真 record（不再空）
- ✅ Watch-only record（如 BILL）显示 "watch-only / 不可跟单" badge（视觉明显）
- ✅ Watch-only record 上 follow-trade 按钮**不渲染**（grep + 实测）
- ✅ Executable record（如 BTC/ETH/SOL/HYPE）正常显示 follow-trade 按钮
- ✅ 10 locale i18n 含 en_XA
- ✅ build / typecheck / lint / test 全过

### 5.2 Task B 验收

- ✅ Codex 报告含 preview-trigger 链路实测结果（visible-session trigger → POST refresh → waitUntil → PM run → KV write → projection 显示）
- ✅ 实测在 preview 模式 user-trigger 链路完整闭环
- ✅ 如有 preview-specific issue 在报告中列明 + 给 fix 方向（不实施）

---

## § 6 实施流程

### 6.1 单 PR，双 task 串行

1. Codex 拉新 worktree `feature/b13-hotfix3-timeline-projection-watch-only`
2. **Task A 先调研**：first-hand 查 timeline projection 断裂根因 → 报告写到 codex-to-claude.md（同 PR commit）
3. **Task A 再 fix**：基于调研结论修投影 + 补 record `executable` 字段 + UI badge + 10 locale i18n + follow gate 测试
4. **Task B 调研报告**：实测 preview-trigger 链路，发现问题报告（不 fix）
5. PR 推 → preview → 给 F → F 给 Dan 验收

### 6.2 关键纪律

- 报告必须 commit 进 PR（hotfix-1 教训 / hotfix-2 已遵守）
- Task A 调研未确认根因前不要硬实施 fix（避免修错地方）
- Task B 仅诊断不 fix

---

## § 13 不能做

1. 不动 PM pipeline / evidenceDispatcher / memoryLoopEvidence backend
2. 不撤 hotfix-1 / hotfix-2 改动（demo fallback 不复活）
3. 不擅自改 Vercel cron 配置
4. 不上 prod
5. Task B 不实施任何 fix（仅诊断）
6. 不擅自改 candidate ranking（仅修过滤，ranking 不动）
7. follow-trade 按钮在 watch-only record 上 strict gate 不渲染（Stage 3 T308 + 本 hotfix 再确认）
8. badge 不能模糊 watch-only 含义（必须明确"不可跟单" / "Watch only"）
9. record `executable` 字段对老 record 必须 graceful fallback（默认从 symbolMapping 查）

---

## § 14 Constitution 对照检查

| Rule                 | Check                                                               | 答   |
| -------------------- | ------------------------------------------------------------------- | ---- |
| Rule 1 部署身份      | 全 preview                                                          | PASS |
| Rule 2 v0.1.2        | preview 自由 / prod 不动                                            | PASS |
| Rule 3 视觉与品牌    | UI badge = 微调已有 record 卡片视觉，Dan chat 选 X 已授权           | PASS |
| Rule 4 数据与 schema | record 加 `executable` 字段属 active schema 扩展，graceful fallback | PASS |
| Rule 5 AI 诚实性     | 修投影断裂 = 让真分析真显示，符合诚实性                             | PASS |
| Rule 6 协作闭环      | 单 PR + 调研 + fix + F 双脑接力                                     | PASS |
| Rule 7 验证门槛      | § 5 含 measurable                                                   | PASS |

---

## § 16 老板简报

claw42 工作台修复继续。本次做了啥：之前 AI 团队对长尾币种（如 BILL/IRYS）做了真实分析，但因为系统过滤逻辑两端不一致，分析结果写到了存储但没显示在工作台。这次修通展示链路，长尾分析也能让用户看到，每条卡片明确标"不可跟单"，让用户知道哪些可以一键跟、哪些只能参考。同时验证用户进站触发新分析的链路在预发环境是否稳定跑通。后续规划：链路通了之后，多 Agent 戏剧化和决策仪式感工作恢复推进。

---

## § 17 Anti-Rationalization

| 逃逸路径                                   | 为什么不行                                          | 正确做法                          |
| ------------------------------------------ | --------------------------------------------------- | --------------------------------- |
| 未调研直接改投影                           | 可能修错地方（根因不一定是 F 推测的 filter 不一致） | 必须 Task A 先调研确认根因再 fix  |
| follow-trade 按钮 gate 用 boolean 但不测试 | safety critical，watch-only 不能让用户错点跟单      | 测试覆盖 + grep render 条件       |
| Badge 文案译成"长尾" / "实验性"等模糊词    | 用户需要明确"不可跟单"动作信号                      | 严格按 "watch-only / 不可跟单" 译 |
| Task B 顺手 fix 发现的 preview issue       | 仅诊断不 fix（避免 task 边界蔓延）                  | 报告 + fix 方向，等 F + Dan 拍    |

---

## § 18 Decision-Log 联动

完成后追加：

```
[2026-05-16 晚 ++] [架构] B.13 hotfix-3：timeline 投影修复 + watch-only 显示 + 不可跟单 badge
[2026-05-16 晚 ++] [产品] Dan 拍 X 方案：watch-only PM record 显示 + 加 badge（vs Y 只跑 4 币）
[2026-05-16 晚 ++] [架构] Codex preview-trigger 链路实测结果
```

---

## § 19 Tasks 索引

| Task  | Priority | Story                                                                                                   |
| ----- | -------- | ------------------------------------------------------------------------------------------------------- |
| T-A.1 | P0       | first-hand 查 timeline projection 断裂真根因（buildWatchTimelinePayload / 过滤逻辑 / KV record schema） |
| T-A.2 | P0       | 调研报告 commit 进 PR                                                                                   |
| T-A.3 | P0       | 修投影逻辑允许 watch-only record 通过                                                                   |
| T-A.4 | P0       | record payload 加 `executable: boolean` 字段（含老 record graceful fallback）                           |
| T-A.5 | P0       | V10 record 卡片显示 "watch-only / 不可跟单" badge（视觉明显）                                           |
| T-A.6 | P0       | 10 locale i18n badge 文案（含 en_XA）                                                                   |
| T-A.7 | P0       | follow-trade 按钮 strict gate：仅 executable record 渲染（grep + 测试）                                 |
| T-A.8 | P0       | build / typecheck / lint / test 全过                                                                    |
| T-B.1 | P0       | 实测 preview-trigger 链路（visible-session → refresh POST → waitUntil → PM run → KV → timeline）        |
| T-B.2 | P0       | 报告链路实测结果 + 任何 preview-specific issue（不 fix）                                                |

P0 = 10 / 总 10。

---

_版本：v1.0 (2026-05-16 紧急 hotfix-3)_
