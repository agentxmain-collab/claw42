# spec-watch-B1-memory-loop-hardening (v1.0 · 2026-05-14)

> **B 模块第一个 spec** — `claw42` watch dispatch console 决策 resolution / memory_loop reflection 闭环 hardening。
>
> **核心范围**：
>
> - i18n: 把 `v9TopicAdapter.resolutionContent` 4 outcome hardcoded 中文搬到 i18n dict 10 locale
> - 测试: 补 resolved / unresolved / legacy / 4 outcome 覆盖（单测 + integration）
> - Audit: T000 grep main HEAD 看 `record.resolvedAt` / `resolvedOutcome` 真实写入路径在哪
>
> **不在范围**（写 audit 后如发现缺失，立 B.2）：
>
> - Real writer（market outcome evaluation cron / mechanism）实施
> - `memory_loop` 从 synthetic dispatch agent 升级为 real `TeamMemberId`
> - `PublicTimelineEvent` payload `schemaVersion` 字段引入
>
> **架构定位**：A/B 拆分中的 B 模块（底层逻辑 + 技术实现）。基于 main HEAD `89f1f0e`（A1 + B 144 commit + PR #85 全 merge 后）。Grep 实测见 Codex `codex-to-claude.md` 2026-05-14 21:56 entry。

---

## 0. 必读纪律

### 0.1 三层防御

- **层 1 跨域刷新**：每 sub-phase 开始前 cat 实测主 schema 文件（不靠记忆）
- **层 2 首件检验**：每个 outcome i18n key 落地后跑 1 个 outcome 跑通 zh_CN + en_US 渲染对，再批量
- **层 3 同根因熔断**：同类 i18n key 命名错连续出现 2 次 → 停 + 退回 namespace 命名表重做

### 0.2 双脑诊断

Codex 实施前必须自己下判断 + 写到 codex-to-claude.md。本 spec § 18 列必填判断点。

### 0.3 Anti-rationalization

- "memory_loop 渲染已实施，B.1 没东西做" → ❌ adapter `resolutionContent` 中文 hardcoded 是 i18n 缺口，10 locale 不均=用户体验断裂
- "outcome 文案小事跳过 i18n 直接 hardcode 翻译" → ❌ adapter 跟 i18n 系统脱钩破坏 i18n 完整性 + 后续维护成本指数级增加
- "T000 audit 是可选" → ❌ writer 真实路径是 B.1 完成度的核心，缺失 = memory_loop 永远 fallback "等待结果回写" = 真实 prod 状态不可知

---

### 0.5 A/B 并行 redline

**A1 持有（B.1 不动）**：

- `src/modules/agent-watch/v10/**`（A1 owned）
- `src/modules/agent-watch/AgentWatchBoard.tsx` 的 console prop seam
- `src/app/[locale]/agent/page.tsx` 的 `<AgentWatchBoard console={DispatchConsoleV10} />`
- Hero / Constellation / FlowPanel / 视觉调整等

**B 模块持有（B.1 可改）**：

- `src/lib/watch/v9TopicAdapter.ts`（`resolutionContent` 函数 + makeResolutionMessage）
- `src/i18n/dicts/*.json` 10 locale（添加 `agentWatch.dispatchV10.outcome.*` namespace）
- `src/i18n/types.ts`（dispatchV10 namespace 加 outcome 类型）
- Test files: `src/lib/watch/__tests__/v9TopicAdapter.test.ts` + 相关 integration test

**完全不动**：

- v9 page-level 组件（A1 已 freeze）
- prod（双 prod 都不碰）
- `StrategyDecisionRecord` schema（main 已含 5 个 resolution 字段）
- `PublicTimelineEvent.pm_decision.resolution` schema（main 已含 5 字段映射）
- `publicTimelineProjection.resolutionFromRecord`（main 已实施）

---

## 1. Summary

把 v9TopicAdapter 内 hardcoded 中文 outcome 文案搬到 i18n dict（10 locale × 4 outcome key），补全 memory_loop 渲染的测试覆盖，并 audit 真实 writer 路径。如 audit 发现 writer 缺失 → 立 B.2 spec 单独处理。

**用户感知层**：

- 切到非中文 locale（en / ja / es 等）→ memory_loop msg 显示对应语言（当前是中文 hardcoded）
- 4 outcome（命中 TP / 命中 SL / 过期 / 手动平仓）文案统一管理 + 后续修改不需要碰 adapter

---

## 1.5 User Stories（v2.5 § 1.5）

### US1 — i18n 用户看完整本地化 memory_loop（P1, MVP）

**作为** 切到 en_US / ja_JP 等非中文 locale 的访客
**我希望** memory_loop msg（hit_tp / hit_sl / expired / manual_close）显示对应语言文案
**这样** 我看完整产品体验，不是中英文混杂

**Why P1**：当前 hardcoded 中文 → 其他 locale 用户看到中文 memory_loop = i18n 完整性破口

### US2 — 测试覆盖给后续维护信心（P2）

**作为** 后续维护 B 模块的 dev
**我希望** resolved / unresolved / legacy / 4 outcome 全部有 unit + integration test
**这样** 改 resolutionFromRecord / makeResolutionMessage 不会 regress

**Why P2**：当前 makeResolutionMessage 是 B 144 commit 新加，测试覆盖度不明，加测覆盖防回归

### US3 — F audit writer 路径给 Dan 决策依据（P1，blocker for closing loop）

**作为** F session / Dan
**我希望** 知道 `record.resolvedAt` 实际由什么 cron / mechanism 写入
**这样** 能判断 memory_loop 在 prod 上是否真闭环（还是永远 fallback "等待结果回写"）

**Why P1**：如果没 writer，memory_loop 在 prod 永远不会显示真实 outcome，spec hardening 等于 polishing 一个永远空的 surface

---

## 2. Acceptance Scenarios

### AC1（US1）— i18n 切换 outcome 文案

**Given** Adapter 输出 memory_loop msg 含 4 outcome 之一
**When** 用户在 `/en_US/agent` 路由
**Then** memory_loop msg.content 显示对应英文（如 "Take profit hit at X"）
**And** zh_CN/zh_TW/ja_JP/ru_RU/uk_UA/fr_FR/es_ES/ar_SA 同理本地化

### AC2（US2）— resolved decision 渲染

**Given** Public payload 含 `resolution: { outcome: "hit_tp", resolvedAt: ISO, observedPrice: 67000, ... }`
**When** adapter 跑 `mapPublicTimelineEventsToTopics`
**Then** stage-6 status="done" + memory_loop msg 生成 + content 显示 i18n 本地化 outcome

### AC3（US2）— unresolved decision 渲染

**Given** Public payload **没** resolution 字段
**When** adapter 跑
**Then** stage-6 status="pending" + note "暂无复盘沉淀，等待结果回写"（已 i18n key 化）+ **不**生成 memory_loop msg

### AC4（US2）— legacy decision graceful（兼容性轴）

**Given** Public payload `resolution` 字段缺失（B 144 commit 前的老 KV record）
**When** adapter 跑
**Then** 同 AC3 渲染 pending，不抛错

### AC5（US3）— writer audit 完成

**Given** Codex 跑 T000 audit
**When** grep `record.resolvedAt = ` / `record.resolvedOutcome = ` 在 lib/team / lib/watch / cron / api 全 codebase
**Then** 报告 codex-to-claude.md 含：

- 实际写入路径在哪文件 / cron / mechanism
- 写入触发条件是什么（market price 达到 TP/SL / evaluation window 过期 / manual close 等）
- 如**未找到 writer** → 明示 + raise F + 立 B.2

---

## 3. Edge Cases 4 轴

| 轴       | Edge Case                                            | 处理                                                                                    |
| -------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Input    | `resolution.outcome` 是 union 之外的值（数据脏）     | adapter graceful fallback 到"暂无复盘沉淀"占位 + dev warn                               |
| Input    | `resolution.outcome` 存在但 `resolvedAt` 缺失        | 同上 fallback，不渲染 memory_loop msg                                                   |
| State    | locale dict 缺某个 outcome key（如 ja_JP.hit_tp 漏） | 用 zh_CN fallback + dev warn console                                                    |
| State    | adapter 跑期间 locale 切换                           | 重 render 时新 locale 文案立即生效（React 标准行为）                                    |
| Boundary | outcome 文案在某 locale 特别长（如阿语 ar_SA）       | chat-shell msg-bubble 自动 wrap，不破坏 layout                                          |
| Boundary | 同 topic 多个 resolution 事件（不应发生但防御）      | 用 latest resolution，旧的丢弃                                                          |
| Failure  | i18n dict 加载失败 / namespace 缺失                  | adapter fallback 到中文 hardcoded（保留现有 resolutionContent 作 last-resort fallback） |
| Failure  | T000 audit 跑挂 / writer 找不到                      | Codex 立即报 F + raise Dan，不擅自实施 writer                                           |

---

## 4. Assumptions

1. main HEAD `89f1f0e` 已 merge A1 + B 144 commit + PR #85（grep 实测确认）
2. `StrategyDecisionRecord` schema 5 个 resolution 字段稳定不动（不在 B.1 scope）
3. `PublicTimelineEvent.pm_decision.resolution` shape 稳定（5 子字段）
4. `resolutionFromRecord` 映射逻辑稳定（不动）
5. v9 `MessageBubble` + `a-mem` CSS + display name 都 ready（不动）
6. i18n dict 实际是 `src/i18n/dicts/*.json`（A1 grep 已确认）
7. `agentWatch.dispatchV10` namespace 在 i18n dict 已存在（A1 创建）
8. `resolutionContent` 是 adapter 内函数（B 144 commit 加的），可重构为 i18n key lookup
9. Real writer 不在 B.1 scope；如 audit 发现缺失 → B.2 处理
10. memory_loop 在 dispatchAgentMapping 是 synthetic（不动；Phase 6a 11 角色升级再考虑）

---

## 5. Measurable Success Criteria

| ID     | 指标                                           | 测量方法                                                                                                                               | 阈值                                                                                |
| ------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| SC-001 | i18n outcome 4 key × 10 locale 完整            | grep `agentWatch.dispatchV10.outcome.*` in 10 dicts                                                                                    | 40 key 全覆盖，0 missing                                                            |
| SC-002 | adapter `resolutionContent` 重构为 i18n lookup | grep adapter 不含 "命中" / "止盈" / "止损" 等 hardcoded 中文                                                                           | 0 命中 hardcoded 中文                                                               |
| SC-003 | Unit test 覆盖                                 | `v9TopicAdapter.test.ts` 含 resolved (4 outcome) / unresolved / legacy 7 个 test case                                                  | 全 PASS                                                                             |
| SC-004 | Integration test 覆盖                          | 跑 storybook / RTL 渲染 memory_loop msg 在 10 locale 各一次（snapshot）                                                                | 0 locale missing key warn                                                           |
| SC-005 | Backward compat                                | 老 KV record（无 resolution 字段）graceful fallback 不抛错                                                                             | adapter throw 0 次 + dev warn 正确触发                                              |
| SC-006 | T000 writer audit 完成度                       | Codex 报告含 grep 实际路径 / 缺失明示                                                                                                  | 报告完整（不留"暂无/待定"）                                                         |
| SC-007 | Verify gate                                    | typecheck / lint / format:check / vitest / build / verify:a11y / verify:metrics / verify:chat-v3-final / verify:agent-ip / verify:news | 全 PASS                                                                             |
| SC-008 | 工程量收敛                                     | git commit 数 / AI 天                                                                                                                  | ≤ 5 commit / ≤ 3 AI 天                                                              |
| SC-009 | SPEC-FEEDBACK 收敛轮数                         | 第 1 轮评估 [SPEC-FEEDBACK] 数                                                                                                         | ≤ 2 项 minor（目标 2 轮收敛 vs A1 5 轮）                                            |
| SC-010 | 视觉零回归                                     | Playwright screenshot vs A1 完整版 baseline                                                                                            | 4 outcome 渲染 layout / spacing 一致；文字差异允许（i18n 不同 locale 文字必然不同） |

---

## 6. 现状盘点（Codex grep 实测 main `89f1f0e`）

### 6.1 已实施（B.1 不动）

- `StrategyDecisionRecord`: 5 resolution 字段（`resolvedAt: string | null` / `resolvedOutcome: DecisionOutcome` / `resolvedPrice?: number | null` / `resolutionReason?` / `resolutionPriceSource?`）
- `DecisionOutcome = "hit_tp" | "hit_sl" | "expired" | "manual_close" | null`
- `PublicTimelineEvent.pm_decision.resolution` 子对象（5 子字段：outcome / resolvedAt / observedPrice / observedPriceSource / reason）
- `publicTimelineProjection.resolutionFromRecord`: 5 字段映射 record → payload
- `v9TopicAdapter.makeStages(_, hasTradeDecision, hasResolution)`: stage-6 status 推导
- `v9TopicAdapter.makeResolutionMessage`: 当 resolution 非空生成 memory_loop msg
- `v9TopicAdapter.resolutionContent`: 4 outcome **hardcoded 中文** 文案（B.1 重构目标）
- `MessageBubble` + `a-mem` CSS + display name（zh "策略复盘主管" / en "Strategy Review Lead"）
- `DispatchAgentId` union 含 `memory_loop`（synthetic dispatch）
- `agentWatch.dispatchV10.roles.memoryLoop` i18n 已有（name/role/desc/readoutRole/stat）
- `agentWatch.dispatchV10.flow.stages[5]` 6 阶段最后段 i18n 已有

### 6.2 B.1 工作（缺口）

- ⚠️ `resolutionContent` 4 outcome 文案 hardcoded 中文 → 搬 i18n
- ⚠️ outcome 专用 i18n namespace 缺失（`agentWatch.dispatchV10.outcome.*` 不存在）
- ⚠️ 测试覆盖度未知（resolved / unresolved / legacy 是否覆盖未确认）
- ❓ Real writer 路径未知（T000 audit）

### 6.3 不动

- 全 A1 资产（v10 module / AgentWatchBoard seam / page.tsx 注入 / hero 视觉等）
- main 已实施的 schema / projection / makeStages 等
- prod 双线（Tier 1 ai.coinw.com / Tier 2 claw42.ai）

---

## 7. 技术上下文

### 7.1 i18n outcome namespace 设计

**新增 namespace**: `agentWatch.dispatchV10.outcome.*`

**Key 列表**（4 outcome × 各 locale）：

```
agentWatch.dispatchV10.outcome.hit_tp
agentWatch.dispatchV10.outcome.hit_sl
agentWatch.dispatchV10.outcome.expired
agentWatch.dispatchV10.outcome.manual_close
agentWatch.dispatchV10.outcome.pending  // "暂无复盘沉淀，等待结果回写" 兜底
```

**zh_CN（参考 adapter 当前 hardcoded）**：

```json
"outcome": {
  "hit_tp": "命中止盈 {{price}}（{{reasonText}}）",
  "hit_sl": "命中止损 {{price}}（{{reasonText}}）",
  "expired": "评估窗口结束未触发，决策过期",
  "manual_close": "手动平仓",
  "pending": "暂无复盘沉淀，等待结果回写"
}
```

**en_US**:

```json
"outcome": {
  "hit_tp": "Take profit hit at {{price}} ({{reasonText}})",
  "hit_sl": "Stop loss hit at {{price}} ({{reasonText}})",
  "expired": "Evaluation window ended without trigger; decision expired",
  "manual_close": "Manually closed",
  "pending": "No reflection yet — awaiting outcome writeback"
}
```

其他 8 locale 翻译由实施时 Codex 用 dispatchAgentMapping 立的 i18n display name 模式扩展（en_XA 占位 pseudo）。

### 7.2 Adapter 重构

**Before**（main 当前）：

```ts
function resolutionContent(resolution: PublicResolution): string {
  switch (resolution.outcome) {
    case "hit_tp": return `命中止盈 ${resolution.observedPrice}（${...}）`;
    case "hit_sl": return `命中止损 ${resolution.observedPrice}（${...}）`;
    case "expired": return "评估窗口结束未触发，决策过期";
    case "manual_close": return "手动平仓";
  }
}
```

**After**（B.1）：

```ts
function resolutionContent(
  resolution: PublicResolution,
  t: (key: string, vars?: Record<string, any>) => string, // i18n function
): string {
  const baseKey = `agentWatch.dispatchV10.outcome.${resolution.outcome}`;
  const vars = {
    price: resolution.observedPrice ?? "",
    reasonText: resolution.reason
      ? t(`agentWatch.dispatchV10.outcome.reason.${resolution.reason}`)
      : "",
  };
  return t(baseKey, vars);
}
```

调用 site 在 `makeResolutionMessage` 内（adapter 已有 locale 参数 / 或通过 ctx 拿 i18n function）。

### 7.3 测试覆盖

**Unit test 加入**（`v9TopicAdapter.test.ts`）：

- `makeResolutionMessage_hit_tp_returns_memory_loop_msg`
- `makeResolutionMessage_hit_sl_returns_memory_loop_msg`
- `makeResolutionMessage_expired_returns_memory_loop_msg`
- `makeResolutionMessage_manual_close_returns_memory_loop_msg`
- `makeResolutionMessage_no_resolution_returns_null`
- `makeStages_with_resolution_marks_stage_6_done`
- `makeStages_without_resolution_marks_stage_6_pending`
- `makeStages_legacy_payload_no_resolution_field_graceful`
- `resolutionContent_uses_i18n_key_lookup`（确认 hardcoded 中文清除）

**Integration test**（Storybook / RTL）：

- Mount Topic with 4 outcome resolution 各一次 → 渲染 memory_loop msg → 切 5 个 locale（zh_CN / en_US / ja_JP / es_ES / ar_SA）→ snapshot 验证文字符合 dict

---

## 8. 数据流（不动 schema）

```
[Phase B v2.1 + B 144 commit 已立]
record.resolvedOutcome → record.resolvedAt
   ↓
publicTimelineProjection.resolutionFromRecord
   ↓
publicTimelineEvent.payload.resolution { outcome / resolvedAt / observedPrice / observedPriceSource / reason }
   ↓
[B.1 工作点]
v9TopicAdapter.makeResolutionMessage(payload, ctx)
   ↓ (用 t() lookup)
agentWatch.dispatchV10.outcome.{outcome} key in i18n dict (10 locale)
   ↓
memory_loop DispatchMessage.content (localized)
   ↓
MessageBubble.render（不动，已 i18n-ready）
```

---

## 9. 变更范围

### 9.1 新建

- **无新建文件**（所有改动叠加现有文件）
- 可选：`src/lib/watch/__tests__/v9TopicAdapter.resolution.test.ts`（如 main 已有 `v9TopicAdapter.test.ts` 则补 case；如没有则新建）

### 9.2 修改（最小化）

- `src/lib/watch/v9TopicAdapter.ts`：`resolutionContent` 函数重构为 i18n key lookup（依赖 t/ctx.t 注入）；删除 hardcoded 中文
- `src/i18n/dicts/zh_CN.json` + 9 个其他 locale：添加 `agentWatch.dispatchV10.outcome.*` namespace（4 outcome key + pending fallback + reason 子 key 如有）
- `src/i18n/types.ts`：dispatchV10 namespace 扩展 outcome 类型
- `src/lib/watch/__tests__/v9TopicAdapter*.test.ts`：补 9 个 test case（§ 7.3）

### 9.3 删除

- 无

### 9.4 不动

- A1 owned：v10 module / AgentWatchBoard console seam / page.tsx 注入
- B 144 commit owned：lib/watch 其他逻辑 / lib/team / api/watch / lib/storage / news 系列
- StrategyDecisionRecord schema / PublicTimelineEvent schema / projection 映射
- publicTimelineProjection.resolutionFromRecord（不重构映射，只动 adapter 文案 lookup）
- 双 prod（ai.coinw.com + claw42.ai）

---

## 10. 依赖前置

- main HEAD `89f1f0e` 含 A1 + B 144 + PR #85 全部 merge ✓
- main HEAD `89f1f0e` 基线 verify gate 全过（Codex 2026-05-14 21:56 已确认）✓
- 干净 worktree（`/tmp/claw42-b1-implement` 或类似）从 origin/main checkout
- 不动主 worktree 30+ WIP

---

## 11. Tasks

### Phase 0 — Setup + T000 Audit

- [ ] T000 [P] **Writer audit** — grep main HEAD 全 codebase（lib/team / lib/watch / api/watch / cron / scheduled-tasks 等）：
  - 找 `record.resolvedAt = ` / `record.resolvedOutcome = ` 真实赋值点
  - 找 `decisionRecordStore.update*` / `recordStore.set*` 含 resolution 字段的 call site
  - 找 cron / scheduled task / api route handlers 含 outcome 评估逻辑
  - 报告 codex-to-claude.md：实际 writer 路径（如有）/ 缺失明示（如无）
  - **如缺失** → 立即停 + raise F + F 立 B.2 spec 处理 writer；B.1 余下任务暂停或仅完成 i18n + tests
- [ ] T001 创建 feature worktree `/tmp/claw42-b1-memory-loop-hardening`，branch `feature/spec-b1-memory-loop-hardening`，base = origin/main `89f1f0e`
- [ ] T002 跑 baseline verify gate（typecheck / lint / format:check / vitest / build / verify:a11y / verify:metrics）确认起点干净

### Phase 1 — i18n 落地

- [ ] T010 [P] `src/i18n/types.ts`：dispatchV10 namespace 加 outcome 子类型（4 outcome key + pending fallback + 可选 reason 子 key）
- [ ] T011 zh_CN.json：写完整 outcome namespace（4 outcome 含 price / reason 变量插值；reason 子 key 如适用）
- [ ] T012 en_US.json：英文翻译完整
- [ ] T013 [P] zh_TW / ja_JP / ru_RU / uk_UA / fr_FR / es_ES / ar_SA 各 locale 翻译（Codex 用 dispatchAgentMapping 已有 i18n display name 翻译模式参考）
- [ ] T014 en_XA.json：pseudo placeholder（按 v3 立的伪本地化机制）

### Phase 2 — Adapter 重构

- [ ] T020 重构 `v9TopicAdapter.resolutionContent`：
  - 输入 signature 加 `t` 函数（i18n lookup）或 ctx
  - 切到 namespace key lookup（4 outcome + pending）
  - 删除 hardcoded 中文
  - 保留 fallback 路径：如 i18n dict 加载失败 → 用 zh_CN 字符串作 last-resort
- [ ] T021 `makeResolutionMessage` 调用 site 同步注入 t / ctx

### Phase 3 — 测试覆盖

- [ ] T030 [P] [US2] 加 9 个 unit test case in `v9TopicAdapter.test.ts`（§ 7.3 清单）
- [ ] T031 [P] [US2] 加 integration test 5 locale × 4 outcome snapshot（如 RTL / storybook 已立）

### Phase 4 — Verify + 报告

- [ ] T040 跑全 verify gate（typecheck / lint / format:check / vitest / build / verify:a11y / verify:metrics / verify:chat-v3-final / verify:agent-ip / verify:news）
- [ ] T041 跑 hardcoded 中文 grep 验证 SC-002（`rg "命中止盈|命中止损|评估窗口结束|手动平仓" src/lib/watch/v9TopicAdapter.ts` 应 0 命中）
- [ ] T042 跑 i18n 完整性 grep 验证 SC-001（`agentWatch.dispatchV10.outcome.*` key 在 10 dict 全覆盖）
- [ ] T043 跑现有 staging（带 STAGING_USE_FIXTURE=true，加 1 条 resolved fixture record 各 4 outcome）确认 memory_loop msg 4 outcome 都正确渲染（zh_CN + en_US 切换）
- [ ] T044 push feature branch + 开 PR base main + Vercel preview deploy（不带 --prod）
- [ ] T045 报告 codex-to-claude.md：commit list / verify gate / writer audit 结果 / staging preview URL + bypass

---

## 12. 约束

- **B.1 仅 hardening / i18n / tests + audit**（writer 实施不在范围）
- 不动 A1 owned（v10 module / AgentWatchBoard seam / page.tsx 注入 / hero 视觉）
- 不动 main 已实施 schema（StrategyDecisionRecord / PublicTimelineEvent / projection）
- 不动双 prod（Tier 1 ai.coinw.com / Tier 2 claw42.ai）— 不 --prod / 不推 CoinW GitLab
- 不动主 worktree 30+ WIP
- i18n 10 locale 默认全翻译（不向 Dan 问；en_XA 占位）
- 任何 schema mismatch / 接口不一致 → [SPEC-FEEDBACK]，不自行猜
- transient HTTP 502/503/504/timeout → retry 1-2 次（间隔 30s/90s/3min）；真阻塞（merge conflict / CI red / protected branch 等）→ 立即停 + 报告
- T000 audit 发现 writer 缺失 → 停 + raise F + 不擅自实施 writer

---

## 13. 不能做清单

- ❌ 不能实施 real writer（cron / market outcome eval / 时序逻辑）— B.2 处理
- ❌ 不能动 `StrategyDecisionRecord` schema（增字段 / 改 union / 改命名）
- ❌ 不能动 `PublicTimelineEvent.pm_decision.resolution` shape
- ❌ 不能动 `publicTimelineProjection.resolutionFromRecord` 映射
- ❌ 不能动 `DispatchAgentId` union 或 dispatchAgentMapping（memory_loop 保持 synthetic）
- ❌ 不能给 PublicTimelineEvent 加 schemaVersion（独立决策）
- ❌ 不能 hardcode 任何新中文（i18n 完整性纪律）
- ❌ 不能用顶层 `payload.resolvedAt` 路径（实际 shape 是 `payload.resolution.resolvedAt`）

---

## 14. Constitution 对照检查（v0.1.1 7 Rule）

| Rule                       | 状态 | 评估                                                                    |
| -------------------------- | ---- | ----------------------------------------------------------------------- |
| Rule 1 部署身份            | PASS | preview only / 不推 CoinW GitLab / 走 agentxmain-collab registry        |
| Rule 2 生产保护（双 prod） | PASS | 双 prod 都不动；不 --prod / 不上 claw42.ai / 不上 ai.coinw.com          |
| Rule 3 视觉品牌权威        | PASS | 不动 v9 / v10 视觉权威，仅改 adapter 内部文案 lookup + i18n             |
| Rule 4 数据 schema 纪律    | PASS | 不动 StrategyDecisionRecord / PublicTimelineEvent / projection schema   |
| Rule 5 AI / 行情诚实性     | PASS | 不引入 mock outcome；i18n 文案只对应真 outcome 值；safety fallback 保留 |
| Rule 6 协作闭环            | PASS | 走 Codex 双脑评估 + sync READ/writeback + 实施前 grep check             |
| Rule 7 验证门槛            | PASS | 全 verify gate + Playwright snapshot / RTL integration test             |

无 Violation。

---

## 16. 老板简报

claw42 Watch 板"决策复盘"模块当前已能展示真实的 AI 决策结果（命中止盈 / 止损 / 过期 / 手动平仓），但文案只有中文，切到英文 / 日文等其他语言时还会看到中文。这次把 4 种结果的文案搬到多语言系统里，让 10 个语种用户都看到本地化版本。

同时给这块功能补完整测试（4 种结果 × 多个语种），避免后续迭代时改坏。

另外检查一下"真实结果"是不是真的会被自动填进系统（如果系统只是接口准备好但没有自动写入机制，单独提一份方案给老板拍板）。

不上正式版，迭代版预发演示。

---

## 17. Anti-Rationalization

| 逃逸路径                                                            | 为什么不行                                                                                                       | 正确做法                                                                        |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 觉得 4 outcome 文案小事直接 hardcode 翻译 10 locale 嵌入 adapter    | i18n 系统是 single source of truth，绕过 = 后续维护改文案要碰代码 + i18n 一致性破口                              | 全部走 `agentWatch.dispatchV10.outcome.*` namespace lookup                      |
| 觉得 reason 文本（take_profit_reached 等）一起塞 outcome 文案里就行 | reason 是独立 union 类型可能扩展，应当独立 i18n key 化便于后续加 outcome 不影响 reason                           | reason 用子 namespace `agentWatch.dispatchV10.outcome.reason.*` 或独立 key 路径 |
| 觉得测试覆盖只跑 happy path 不跑 legacy 兼容                        | B 144 commit 前老 KV record 无 resolution 字段，graceful fallback 必测                                           | AC4 + T030 legacy test case 必跑                                                |
| 觉得 T000 writer audit 可推迟到实施后                               | audit 是 spec 完成度的核心，缺失代表 prod 上 memory_loop 永远 fallback，spec hardening 等于 polishing 空 surface | T000 是 Phase 0 强制 task，audit 出来才能判断 B.1 范围是否需要调整              |
| 觉得 spec § 7.7 写 payload.resolvedAt 顶层路径 OK                   | 实际 main HEAD shape 是 `payload.resolution.resolvedAt` 子对象，写顶层路径 = spec 跟代码错位                     | 用 grep 实测的 shape（`payload.resolution.*`）                                  |
| 觉得 memory_loop synthetic vs real TeamMember 顺便升级              | 升级牵涉 dispatchAgentMapping / team registry / pipeline 等多处，是 Phase 6a 11 角色升级范围                     | B.1 保持 memory_loop synthetic 不动                                             |
| 觉得 schemaVersion 顺便加                                           | schemaVersion 引入是 cross-cutting 决策（影响所有消费方 / migration / backward compat），不属 B.1                | 独立 spec 决定                                                                  |
| 觉得 spec 留 audit trail 让 Codex 知道 v0 → v1 变化                 | spec 是 single source of truth，audit trail 由 decision-log 维护                                                 | spec 内不留 strike-through / 不留 "(v1 修订：...)" 注解                         |
| 觉得 zh_CN 翻译完后其他 9 locale 推迟                               | A1 立的 i18n 默认翻全 9 locale 纪律 + en_XA 占位                                                                 | T013-T014 实施期间一次翻完                                                      |

---

## 18. 双脑判断点

按 CLAUDE.md 双脑诊断纪律，Codex 实施前必须自己下判断 + 写到 codex-to-claude.md：

### Q1: T000 writer audit grep 范围

- 单 grep `record.resolvedAt = ` 不够，可能需要：
  - grep `decisionRecordStore` / `recordStore.set` 等 call site
  - grep cron / scheduled-tasks 目录的所有 task prompts
  - grep api routes 含 outcome 评估
- Codex 自决 grep pattern 集合 + 报告完整 audit 范围

### Q2: i18n t 函数注入方式

- adapter `resolutionContent` 加 `t` 函数参数 vs 改 `ctx.t` 通过现有 ctx 注入
- main HEAD 上 adapter 已有 `V9AdapterContext`？如有 → 通过 ctx；如没有 → 加新参数
- Codex grep `mapPublicTimelineEventsToTopics` 签名 → 选最少改动方式

### Q3: reason 文本独立 i18n vs 嵌入 outcome

- reason union: `"take_profit_reached" | "stop_loss_reached" | "evaluation_window_elapsed"`
- 独立 i18n key (`agentWatch.dispatchV10.outcome.reason.*`)：清晰可扩展
- 嵌入 outcome 文案 (`hit_tp` 含 reason)：简单但不灵活
- Codex 看实际 reason union 长度 + 未来扩展概率 → 自决

### Q4: integration test 5 locale 选哪 5 个

- zh_CN（base）/ en_US（en）/ ja_JP（亚太）/ es_ES（拉丁）/ ar_SA（RTL 边界）— F 默认
- Codex 看 RTL / 长文 / 字符集差异等真实风险 → 调整 locale 选择
- 注意 ar_SA 是 RTL，验 layout 完整

### Q5: hardcoded 中文 grep gate 规则

- SC-002 要求 adapter 0 hardcoded 中文 outcome 文字
- grep pattern: `命中止盈|命中止损|评估窗口结束|手动平仓` in `src/lib/watch/v9TopicAdapter.ts`
- 如 pattern 命中 → SC-002 fail
- Codex 实施完后必跑此 grep 验证

### Q6: F 没看到的 angle

Codex 至少给 1 个 F 没考虑的工程 / 数据 / 性能 / a11y / 安全 angle。可以是：

- adapter 跑期间 i18n dict 异步加载时 outcome 文案先空白 / 闪烁
- ar_SA RTL 下 outcome 文案含数字（price）方向
- price 单位 / 千分位 / 小数位 跨 locale 一致性
- 任何其他你看 first-hand data 想到的

### 实施前 grep check（v2.5 立的）

- [ ] `cat src/lib/watch/v9TopicAdapter.ts | grep -A 20 resolutionContent` 确认当前实现
- [ ] `cat src/i18n/types.ts | grep -A 5 dispatchV10` 确认 namespace 类型当前 shape
- [ ] `ls src/i18n/dicts/*.json | wc -l` 确认 10 locale dict 全在
- [ ] `cat src/lib/watch/__tests__/v9TopicAdapter*.test.ts 2>/dev/null` 看现有 test 覆盖（如不存在则新建）
- [ ] `cat claw42/docs/project-constitution.md` 重读 v0.1.1 7 Rule
- [ ] `cat /Users/dannybrown/Claude/职业规划/web-dev/decision-log.md | head -100` 看最近 5 个 entry（A 固化 / B merge / PR #85 / B.1 grep prep / B.1 范围重定义）
- [ ] grep 是否真存在 writer 路径：`rg "resolvedAt\s*[:=]" src/ --type ts`

如任一不一致 → [SPEC-FEEDBACK]，不自行猜。

---

## 19. decision-log 联动

spec 起草触发追加 entry 到 `/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md`：

- 2026-05-14 22:00 CST B.1 范围重定义（已加）
- 实施完成后追加：B.1 implement complete entry（commit list / staging URL / writer audit 结果）

Codex 实施前 / 任何拍板节点都先读 decision-log（按 CLAUDE.md ★ 决策档案先行硬性规则）。

---

## 工作量预估

| Phase                     | 时间（AI 天）   |
| ------------------------- | --------------- |
| 0 Setup + T000 audit      | 0.5             |
| 1 i18n 10 locale          | 0.5-1           |
| 2 Adapter 重构            | 0.5             |
| 3 测试覆盖                | 0.5-1           |
| 4 Verify + staging + 报告 | 0.5             |
| **总计**                  | **2-3.5 AI 天** |

如 T000 audit 发现 writer 缺失 → B.1 范围降至仅 i18n + tests（writer 部分立 B.2）→ 1.5-2 AI 天

---

## 关联资产

- Codex grep 实测报告：`codex-to-claude.md` 2026-05-14 21:56 entry
- A1 spec：`claw42/docs/codex-specs/spec-watch-A1-dispatch-console-v10.md`（已 merge main）
- Constitution：`claw42/docs/project-constitution.md` v0.1.1
- Decision-log：`/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md`（2026-05-14 多 entry）
- 前置 spec：A1 + Phase B v2.1（已 merge）

---

_v1.0 起草：2026-05-14 22:30 CST F session_
_起草前置：Codex grep 实测 7 文件完成 / spec 不留 audit trail / 字段名实测准确_
_下一动作：派 Codex 第 1 轮双脑评估 + implement 合并_
