# spec-watch-B1-memory-loop-hardening (v1.1 · 2026-05-14)

> **B 模块第一个 spec** — `claw42` watch dispatch console 决策 resolution / memory_loop reflection 闭环 hardening。
>
> **核心范围**：
>
> - i18n: 把 `v9TopicAdapter` 内 hardcoded 中文 outcome / pending note 文案搬到 i18n dict 10 locale
> - 测试: 用现有 vitest 补 resolved / unresolved / legacy / 4 outcome 覆盖
> - Audit: 冻结现有 writer 路径（`decisionResolution.ts` + `strategy-replay/route.ts`），verify writer 不被改动 + manual_close 当前不会被 writer 产出
>
> **不在范围**：
>
> - 实施 / 修改任何 writer 逻辑（writer 已存在 + 稳定运行，B.1 只 audit 不动）
> - `memory_loop` 从 synthetic dispatch agent 升级为 real `TeamMemberId`（Phase 6a 处理）
> - `PublicTimelineEvent` payload `schemaVersion` 字段引入
> - price formatting locale-aware（当前 `Intl.NumberFormat("en-US")` 固定，列 known limit，B.3/B.4 处理）
> - 给 writer 加 manual_close 产出路径（schema union 有 / writer 不产出 是 by-design）
>
> **架构定位**：A/B 拆分中的 B 模块（底层逻辑 + 技术实现）。base main HEAD `567897944ccede30ef547ddfcab5618aaab037de`（T000 docs commit + format:check 修正后；业务代码同 `89f1f0e`）。Grep 实测见 Codex `codex-to-claude.md` 2026-05-14 21:56 / 22:31 两个 entry。

---

## 0. 必读纪律

### 0.1 三层防御

- **层 1 跨域刷新**：每 sub-phase 开始前 cat 实测主 schema 文件（不靠记忆）—— 尤其是 `src/i18n/I18nProvider.tsx` / `src/i18n/types.ts` / `src/lib/watch/v9TopicAdapter.ts` 三件
- **层 2 首件检验**：每个 outcome i18n key 落地后跑 1 个 outcome 跑通 zh_CN + en_US 渲染对，再批量
- **层 3 同根因熔断**：同类 i18n key 命名错连续出现 2 次 → 停 + 退回 namespace 命名表重做

### 0.2 双脑诊断

Codex 实施前必须自己下判断 + 写到 codex-to-claude.md。本 spec § 18 列必填判断点。

### 0.3 Anti-rationalization

- "memory_loop 渲染已实施，B.1 没东西做" → ❌ adapter `resolutionContent` 中文 hardcoded 是 i18n 缺口，10 locale 不均=用户体验断裂
- "outcome 文案小事跳过 i18n 直接 hardcode 翻译" → ❌ adapter 跟 i18n 系统脱钩破坏 i18n 完整性 + 后续维护成本指数级增加
- "writer 没找到所以补一个" → ❌ writer 已存在于 `decisionResolution.ts` + `strategy-replay/route.ts`；B.1 只 audit 不动 writer

---

### 0.5 A/B 并行 redline

**A1 持有（B.1 不动）**：

- `src/modules/agent-watch/v10/**`（A1 owned）
- `src/modules/agent-watch/AgentWatchBoard.tsx` 的 console prop seam
- `src/app/[locale]/agent/page.tsx` 的 `<AgentWatchBoard console={DispatchConsoleV10} />`
- Hero / Constellation / FlowPanel / 视觉调整等

**B 模块持有（B.1 可改）**：

- `src/lib/watch/v9TopicAdapter.ts`（`resolutionContent` 函数 + `makeResolutionMessage` + `makeStages` 内 pending note）
- `src/i18n/dicts/*.json` 10 locale（添加 `agentWatch.dispatchV10.outcome.*` namespace）
- `src/i18n/types.ts`（dispatchV10 namespace 加 outcome 类型）
- Adapter 上游注入点：`src/modules/agent-watch/AgentWatchBoard.tsx` 中调用 `mapPublicTimelineEventsToTopics` 的 ctx 构造段（只加 outcome dict 字段，不动 console seam）
- Test files: `src/lib/watch/__tests__/v9TopicAdapter*.test.ts`

**完全不动**：

- v9 / v10 page-level 组件（A1 已 freeze）
- prod（双 prod 都不碰）
- `StrategyDecisionRecord` schema（main 已含 5 个 resolution 字段）
- `PublicTimelineEvent.pm_decision.resolution` schema（main 已含 5 字段映射）
- `publicTimelineProjection.resolutionFromRecord`（main 已实施）
- `src/lib/team/decisionResolution.ts`（writer，B.1 只读不写）
- `src/app/api/cron/strategy-replay/route.ts`（cron writer call site，B.1 只读不写）
- `DecisionResolutionResult` union（writer 当前不产出 manual_close 是 by-design）

---

## 1. Summary

把 `v9TopicAdapter` 内 hardcoded 中文 outcome 文案 + makeStages pending note 搬到 i18n dict（10 locale × 4 outcome key + 1 pending key + 3 reason key），补全 memory_loop 渲染的 vitest 单测覆盖，并 audit 冻结现有 writer 路径（`decisionResolution.ts` + `strategy-replay/route.ts`）。

**用户感知层**：

- 切到非中文 locale（en / ja / es 等）→ memory_loop msg + stage-6 pending note 显示对应语言（当前是中文 hardcoded）
- 4 outcome（止盈达成 / 止损触发 / 到期未触发 / 人工关闭）文案统一管理 + 后续修改不需要碰 adapter

---

## 1.5 User Stories（v2.5 § 1.5）

### US1 — i18n 用户看完整本地化 memory_loop（P1, MVP）

**作为** 切到 en_US / ja_JP 等非中文 locale 的访客
**我希望** memory_loop msg（hit_tp / hit_sl / expired / manual_close）+ stage-6 pending note 显示对应语言文案
**这样** 我看完整产品体验，不是中英文混杂

**Why P1**：当前 hardcoded 中文 → 其他 locale 用户看到中文 memory_loop = i18n 完整性破口

### US2 — 测试覆盖给后续维护信心（P2）

**作为** 后续维护 B 模块的 dev
**我希望** resolved / unresolved / legacy / 4 outcome 全部有 vitest unit + adapter locale matrix test
**这样** 改 `resolutionFromRecord` / `makeResolutionMessage` 不会 regress

**Why P2**：当前 makeResolutionMessage 是 B 144 commit 新加，测试覆盖度不明，加测覆盖防回归

### US3 — F audit writer 冻结状态（P1, gate）

**作为** F session / Dan
**我希望** 确认 `decisionResolution.ts` + `strategy-replay/route.ts` writer 路径 B.1 不被改动 + manual_close 不会被 writer 产出
**这样** B.1 实施完后能信心 prod 走真实 cron 时 memory_loop 真闭环 + manual_close 的 schema vs writer 缺口写进 known limit

**Why P1**：writer 已存在但 B.1 必须确认零改动 + manual_close 状态写进 spec known limit，否则下游 reader 会误以为 prod 必出现 manual_close

---

## 2. Acceptance Scenarios

### AC1（US1）— i18n 切换 outcome 文案

**Given** Adapter 输出 memory_loop msg 含 4 outcome 之一
**When** 用户在 `/en_US/agent` 路由
**Then** memory_loop msg.content 显示对应英文（如 "Take profit hit at 67432.18 (take_profit_reached)"）
**And** zh_CN/zh_TW/ja_JP/ru_RU/uk_UA/fr_FR/es_ES/ar_SA 同理本地化

### AC2（US2）— resolved decision 渲染

**Given** Public payload 含 `resolution: { outcome: "hit_tp", resolvedAt: ISO, observedPrice: 67432.18, observedPriceSource: "binance", reason: "take_profit_reached" }`
**When** adapter 跑 `mapPublicTimelineEventsToTopics`（locale = en_US）
**Then** stage-6 status="done" + memory_loop msg 生成 + content 显示 i18n 本地化 outcome

### AC3（US1+US2）— unresolved decision pending note i18n

**Given** Public payload **没** resolution 字段
**When** adapter 跑（locale = en_US）
**Then** stage-6 status="pending" + note 显示英文 pending 文案（从 i18n dict 取，**不**生成 memory_loop msg

### AC4（US2）— legacy decision graceful（兼容性轴）

**Given** Public payload `resolution` 字段缺失（B 144 commit 前的老 KV record）
**When** adapter 跑
**Then** 同 AC3 渲染 pending，不抛错

### AC5（US3）— writer 冻结 + manual_close known limit

**Given** Codex 跑 T000 audit
**When** grep `src/lib/team/decisionResolution.ts` + `src/app/api/cron/strategy-replay/route.ts`
**Then** 报告 codex-to-claude.md 含：

- writer 文件 zero git diff 确认（cherry-check）
- `DecisionResolutionResult` union 确认不包含 `manual_close`（grep + 类型断言）
- 明示：B.1 不改 writer / cron / scheduled task；manual_close i18n 文案存在但 prod 现状下不会被自然触发（schema 兼容 + 未来 manual flow 预留）

---

## 3. Edge Cases 4 轴

| 轴       | Edge Case                                                                      | 处理                                                                                |
| -------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Input    | `resolution.outcome` 是 union 之外的值（数据脏）                               | adapter graceful fallback 到 pending 占位 + dev warn                                |
| Input    | `resolution.outcome` 存在但 `observedPrice` 缺失（hit_tp/hit_sl 必须有 price） | fallback 到 outcome 文案无价格变体 / 或退到 pending（实施时按 Codex grep 现状决定） |
| Input    | `resolution.outcome === "manual_close"` 出现（writer 当前不产 但 schema 允许） | adapter 正常用 i18n 文案渲染（不区分来源）                                          |
| State    | locale dict 缺某个 outcome key（如 ja_JP.hit_tp 漏）                           | typed Dict 强制类型 → typecheck 阶段失败拦截（不进入 runtime）                      |
| State    | adapter 跑期间 locale 切换                                                     | 重 render 时新 locale ctx 立即生效（React 标准行为）                                |
| Boundary | outcome 文案在某 locale 特别长（如阿语 ar_SA）                                 | chat-shell msg-bubble 自动 wrap，不破坏 layout                                      |
| Boundary | 同 topic 多个 resolution 事件（不应发生但防御）                                | 用 latest resolution（main 已有逻辑），旧的丢弃                                     |
| Boundary | RTL locale (ar_SA) 下 outcome 文案含数字                                       | 数字方向由 unicode bidi 处理，price 用 Intl.NumberFormat 保留 LTR isolation         |
| Failure  | i18n dict 加载失败 / namespace 缺失                                            | typed Dict 编译期校验 + runtime 类型 narrow → 缺 key = 编译错，不会进入 runtime     |
| Failure  | T000 audit 发现 writer 有 diff（不应发生）                                     | Codex 立即停 + 报 F，不擅自修复                                                     |

---

## 4. Assumptions

1. main HEAD base：`567897944ccede30ef547ddfcab5618aaab037de`（T000 docs commit + Prettier format 修正）；业务代码同 `89f1f0e`
2. `StrategyDecisionRecord` schema 5 个 resolution 字段稳定不动（不在 B.1 scope）
3. `PublicTimelineEvent.pm_decision.resolution` shape 稳定（5 子字段：outcome / resolvedAt / observedPrice / observedPriceSource / reason）
4. `resolutionFromRecord` 映射逻辑稳定（不动）
5. v9 `MessageBubble` + `a-mem` CSS + display name 都 ready（不动）
6. i18n dict 实际是 `src/i18n/dicts/*.json`（A1 grep 已确认）
7. `agentWatch.dispatchV10` namespace + `roles.memoryLoop` 已存在（A1 创建）
8. `I18nProvider` 暴露的是 **typed `Dict` 对象**（不是 `t(key, vars)` helper）—— 故 adapter 接入方式选 **ctx 注入 typed sub-dict**
9. `resolutionContent` 当前 hardcoded 4 outcome 中文实际字符串是 `止盈达成 / 止损触发 / 到期未触发 / 人工关闭`（Codex 22:31 grep 实测确认）
10. real writer 路径 **已存在**：`src/lib/team/decisionResolution.ts` 负责 evaluate/apply/write；`src/app/api/cron/strategy-replay/route.ts` 的 `resolveOpenPmDecisions` 调用写回
11. `DecisionResolutionResult` union **不包含 `manual_close`**（writer 当前不产出，schema union 含 `manual_close` 是 UI/未来兼容预留）
12. repo 测试基础是 **vitest**（不是 Storybook / RTL），所有测试用 vitest unit + adapter locale matrix 模式
13. memory_loop 在 dispatchAgentMapping 是 synthetic（不动；Phase 6a 11 角色升级再考虑）
14. price formatting 当前 `Intl.NumberFormat("en-US")` 固定 → 列 known limit（不在 B.1 范围）

---

## 5. Measurable Success Criteria

| ID     | 指标                                     | 测量方法                                                                                                                                                                                                         | 阈值                                                                      |
| ------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| SC-001 | i18n outcome namespace 完整              | Node 脚本读 10 个 dict，断言 `agentWatch.dispatchV10.outcome` 含 4 outcome key + 1 pending + 3 reason key                                                                                                        | 10 dict × 8 key = 80 全覆盖，0 missing                                    |
| SC-002 | adapter hardcoded 中文清除               | `rg "止盈达成\|止损触发\|到期未触发\|人工关闭\|暂无复盘沉淀" src/lib/watch/v9TopicAdapter.ts`                                                                                                                    | 0 命中                                                                    |
| SC-003 | 非 zh locale runtime 不含中文 outcome    | adapter test 跑 4 outcome × `en_US/ja_JP/ar_SA` 共 12 次，断言 returned content 不含 `止/损/盈/平` 等中文 character set                                                                                          | 0 中文残留                                                                |
| SC-004 | vitest unit + adapter locale matrix 覆盖 | `v9TopicAdapter.test.ts` 含 9 case：resolved (4 outcome × en_US locale) / unresolved pending / legacy missing-resolution / makeStages with/without resolution / dirty outcome fallback                           | 全 PASS                                                                   |
| SC-005 | Backward compat                          | 老 KV record（无 resolution 字段）graceful fallback 不抛错                                                                                                                                                       | adapter throw 0 次 + 类型 narrow 正确触发                                 |
| SC-006 | T000 writer 冻结审计                     | Codex 报告含 writer 路径 git diff = 0 + `DecisionResolutionResult` union 不含 `manual_close` 类型断言                                                                                                            | 报告 PASS（含 grep / diff 命令输出）                                      |
| SC-007 | Verify gate                              | `pnpm typecheck` / `pnpm lint` / `pnpm format:check` / `pnpm vitest run` / `pnpm build` / `pnpm verify:a11y` / `pnpm verify:metrics` / `pnpm verify:chat-v3-final` / `pnpm verify:agent-ip` / `pnpm verify:news` | 全 PASS                                                                   |
| SC-008 | 工程量收敛                               | git commit 数 / AI 天                                                                                                                                                                                            | ≤ 5 commit / ≤ 3 AI 天                                                    |
| SC-009 | SPEC-FEEDBACK 收敛轮数                   | 第 2 轮评估 [SPEC-FEEDBACK] 数                                                                                                                                                                                   | ≤ 2 项 minor（v1.1 目标 2 轮收敛）                                        |
| SC-010 | 视觉零回归                               | Vercel preview 4 outcome 渲染 layout / spacing 一致                                                                                                                                                              | 4 outcome 渲染 layout / spacing 同 main；文字差异允许（不同 locale 必然） |

---

## 6. 现状盘点（Codex grep 实测 main `89f1f0e` / `5678979`）

### 6.1 已实施（B.1 不动）

- `StrategyDecisionRecord`: 5 resolution 字段（`resolvedAt: string | null` / `resolvedOutcome: DecisionOutcome` / `resolvedPrice?: number | null` / `resolutionReason?` / `resolutionPriceSource?`）
- `DecisionOutcome = "hit_tp" | "hit_sl" | "expired" | "manual_close" | null`
- `DecisionResolutionResult` writer return union **不含 `manual_close`**（only `hit_tp` / `hit_sl` / `expired`）
- `PublicTimelineEvent.pm_decision.resolution` 子对象（5 子字段：outcome / resolvedAt / observedPrice / observedPriceSource / reason）
- `publicTimelineProjection.resolutionFromRecord`: 5 字段映射 record → payload
- `v9TopicAdapter.makeStages(_, hasTradeDecision, hasResolution)`: stage-6 status 推导 + pending note 中文 hardcoded
- `v9TopicAdapter.makeResolutionMessage`: 当 resolution 非空生成 memory_loop msg
- `v9TopicAdapter.resolutionContent`: 4 outcome **hardcoded 中文** 文案（B.1 重构目标，实际字符串 `止盈达成 / 止损触发 / 到期未触发 / 人工关闭`）
- `MessageBubble` + `a-mem` CSS + display name（zh "策略复盘主管" / en "Strategy Review Lead"）
- `DispatchAgentId` union 含 `memory_loop`（synthetic dispatch）
- `agentWatch.dispatchV10.roles.memoryLoop` i18n 已有（name/role/desc/readoutRole/stat）
- `agentWatch.dispatchV10.flow.stages[5]` 6 阶段最后段 i18n 已有
- **Real writer**：`src/lib/team/decisionResolution.ts` + `src/app/api/cron/strategy-replay/route.ts` 的 `resolveOpenPmDecisions`（B.1 冻结不动）
- **i18n runtime**：`src/i18n/I18nProvider.tsx` 暴露 typed `Dict` 对象（不是 `t(key, vars)`）

### 6.2 B.1 工作（缺口）

- ⚠️ `resolutionContent` 4 outcome 文案 hardcoded 中文 → 搬 i18n（namespace `agentWatch.dispatchV10.outcome.*`）
- ⚠️ `makeStages` pending note 中文 hardcoded → 搬 i18n
- ⚠️ outcome 专用 i18n namespace 缺失（`agentWatch.dispatchV10.outcome.*` 不存在）
- ⚠️ adapter ctx 当前只有 `{ locale }` → 需扩展为 `{ locale, outcomeDict }` typed
- ⚠️ 测试覆盖度未确认（resolved / unresolved / legacy 是否覆盖未确认）
- ⚠️ T000 audit：writer 文件 git diff = 0 verify + `DecisionResolutionResult` union 不含 `manual_close` 断言

### 6.3 不动

- 全 A1 资产（v10 module / AgentWatchBoard console seam / page.tsx 注入 / hero 视觉等）
- main 已实施的 schema / projection / makeStages 主体逻辑（仅替换 pending note 文案 lookup）
- `decisionResolution.ts` writer（冻结）
- `strategy-replay/route.ts` cron call site（冻结）
- prod 双线（Tier 1 ai.coinw.com / Tier 2 claw42.ai）
- price formatting（仍 `en-US` 固定，B.3/B.4 处理）

---

## 7. 技术上下文

### 7.1 i18n outcome namespace 设计

**新增 namespace**: `agentWatch.dispatchV10.outcome.*`

**Key 列表**（在 `src/i18n/types.ts` `DispatchV10Dict` 内加）：

```ts
outcome: {
  hit_tp: string; // 4 outcome 主文案，含 {price} 与 {reason} 插值占位
  hit_sl: string;
  expired: string;
  manual_close: string;
  pending: string; // makeStages stage-6 pending note + 老 KV legacy fallback
  reason: {
    take_profit_reached: string;
    stop_loss_reached: string;
    evaluation_window_elapsed: string;
  }
}
```

**zh_CN（保持 main 当前 hardcoded 文案不变）**：

```json
"outcome": {
  "hit_tp": "止盈达成 {price}（{reason}）",
  "hit_sl": "止损触发 {price}（{reason}）",
  "expired": "到期未触发",
  "manual_close": "人工关闭",
  "pending": "暂无复盘沉淀，等待结果回写",
  "reason": {
    "take_profit_reached": "止盈条件达成",
    "stop_loss_reached": "止损条件触发",
    "evaluation_window_elapsed": "评估窗口结束"
  }
}
```

**en_US**：

```json
"outcome": {
  "hit_tp": "Take profit hit at {price} ({reason})",
  "hit_sl": "Stop loss hit at {price} ({reason})",
  "expired": "Evaluation window ended without trigger",
  "manual_close": "Manually closed",
  "pending": "No reflection yet — awaiting outcome writeback",
  "reason": {
    "take_profit_reached": "take-profit threshold reached",
    "stop_loss_reached": "stop-loss threshold reached",
    "evaluation_window_elapsed": "evaluation window elapsed"
  }
}
```

其他 8 locale 翻译（zh_TW / ja_JP / ru_RU / uk_UA / fr_FR / es_ES / ar_SA / en_XA）由实施时 Codex 用 dispatchAgentMapping 立的 i18n display name 模式扩展。en_XA 走 pseudo placeholder（按 v3 立的伪本地化机制）。

### 7.2 Adapter 重构（i18n 接入：ctx 注入 typed sub-dict）

**F 自决方案 A（不留二选一）**：扩展现有 `V9AdapterContext` 加 `outcomeDict` typed 字段。理由：

- adapter 已有 ctx 模式（`{ locale }`），同模式扩展最少改动
- 避免 adapter 在 lib 层 import 全量 dict JSON 造成 bundle 边界污染
- typed Dict 编译期校验，dict 缺 key = typecheck fail，不会进 runtime

**插值实现**：用简单 `replaceVars` helper（不假装有 i18next）：

```ts
function replaceVars(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
```

**Before**（main 当前 hardcoded）：

```ts
function resolutionContent(resolution: PublicResolution): string {
  switch (resolution.outcome) {
    case "hit_tp":
      return `止盈达成 ${formatPrice(resolution.observedPrice)}（${reasonText(resolution.reason)}）`;
    case "hit_sl":
      return `止损触发 ${formatPrice(resolution.observedPrice)}（${reasonText(resolution.reason)}）`;
    case "expired":
      return "到期未触发";
    case "manual_close":
      return "人工关闭";
  }
}
```

（注：上述 Before 是 spec 推断 + Codex grep 实测组合；T000 实施前必须 Codex re-cat `v9TopicAdapter.ts` 拿真 source 作 base，spec 推断错误以实际 source 为准）

**After**（B.1，ctx 注入 typed dict）：

```ts
function resolutionContent(
  resolution: PublicResolution,
  outcomeDict: DispatchV10Dict["outcome"],
): string {
  const reasonKey = resolution.reason as keyof DispatchV10Dict["outcome"]["reason"] | undefined;
  const reasonText =
    reasonKey && outcomeDict.reason[reasonKey] ? outcomeDict.reason[reasonKey] : "";
  const priceText = resolution.observedPrice != null ? formatPrice(resolution.observedPrice) : "";

  switch (resolution.outcome) {
    case "hit_tp":
      return replaceVars(outcomeDict.hit_tp, { price: priceText, reason: reasonText });
    case "hit_sl":
      return replaceVars(outcomeDict.hit_sl, { price: priceText, reason: reasonText });
    case "expired":
      return outcomeDict.expired;
    case "manual_close":
      return outcomeDict.manual_close;
  }
}
```

**makeStages pending note 同模式**：

```ts
// Before:
note: hasResolution ? null : "暂无复盘沉淀，等待结果回写";

// After:
note: hasResolution ? null : outcomeDict.pending;
```

**ctx 流水**（AgentWatchBoard → adapter）：

```ts
// AgentWatchBoard.tsx
const dict = useI18n(); // 现有 hook，返回 typed Dict
const topics = mapPublicTimelineEventsToTopics(events, evidenceMap, marketSnapshot, {
  locale,
  outcomeDict: dict.agentWatch.dispatchV10.outcome,
});
```

### 7.3 测试覆盖（vitest，不用 Storybook / RTL）

**vitest unit + adapter locale matrix**（`src/lib/watch/__tests__/v9TopicAdapter.test.ts`，如不存在则新建）：

- `makeResolutionMessage_hit_tp_zh_CN_returns_localized_content`
- `makeResolutionMessage_hit_tp_en_US_returns_localized_content`
- `makeResolutionMessage_hit_sl_en_US_returns_localized_content`
- `makeResolutionMessage_expired_en_US_returns_localized_content`
- `makeResolutionMessage_manual_close_en_US_returns_localized_content`
- `makeResolutionMessage_no_resolution_returns_null`
- `makeStages_with_resolution_marks_stage_6_done_no_pending_note`
- `makeStages_without_resolution_marks_stage_6_pending_with_localized_note`
- `makeStages_legacy_payload_no_resolution_field_graceful`
- `resolutionContent_dirty_outcome_value_falls_back_to_pending`（防御 outcome 是 union 之外字符串）

**locale matrix 断言**：4 outcome × `zh_CN / en_US / ja_JP / ar_SA` 4 locale = 16 个 returned content snapshot，断言 non-zh locale 不含 `止/损/盈/平` 中文字符（SC-003）。

---

## 8. 数据流（不动 schema）

```
[已立 by Phase B v2.1 + B 144 commit]
StrategyDecisionRecord.resolved* fields (writer 在 decisionResolution.ts / strategy-replay/route.ts，B.1 冻结)
   ↓
publicTimelineProjection.resolutionFromRecord (不动)
   ↓
publicTimelineEvent.payload.resolution { outcome / resolvedAt / observedPrice / observedPriceSource / reason }

[B.1 工作点]
AgentWatchBoard.tsx 调用 useI18n() → 取 dict.agentWatch.dispatchV10.outcome typed sub-dict
   ↓
ctx { locale, outcomeDict } 传给 mapPublicTimelineEventsToTopics
   ↓
v9TopicAdapter.resolutionContent(resolution, outcomeDict) → replaceVars 插值
v9TopicAdapter.makeStages(_, _, hasResolution) → pending note 从 outcomeDict.pending 取
   ↓
DispatchMessage.content / DispatchStage.note (localized)
   ↓
MessageBubble.render（不动，已 i18n-ready）
```

---

## 9. 变更范围

### 9.1 新建

- 无新建文件（所有改动叠加现有文件）
- 如 `src/lib/watch/__tests__/v9TopicAdapter.test.ts` 不存在 → 新建

### 9.2 修改（最小化）

- `src/i18n/types.ts`：`DispatchV10Dict` 加 `outcome` 子类型（4 outcome key + pending + 3 reason key）
- `src/i18n/dicts/zh_CN.json` + 9 个其他 locale：添加 `agentWatch.dispatchV10.outcome.*` namespace
- `src/lib/watch/v9TopicAdapter.ts`：
  - `resolutionContent` 重构为 ctx outcomeDict lookup + replaceVars 插值
  - `makeStages` pending note 改 outcomeDict.pending lookup
  - adapter ctx type 加 `outcomeDict: DispatchV10Dict["outcome"]`
  - 加 `replaceVars` helper（如不存在）
  - 删除所有 hardcoded 中文 outcome / pending 文案
- `src/modules/agent-watch/AgentWatchBoard.tsx`：调用 `mapPublicTimelineEventsToTopics` 时，从 `useI18n()` 取 outcome dict 并加进 ctx（**仅 ctx 构造段，不动 console seam / data path / props bridge**）
- `src/lib/watch/__tests__/v9TopicAdapter.test.ts`：补 10 个 test case（§ 7.3）

### 9.3 删除

- 无

### 9.4 不动

- A1 owned：v10 module / AgentWatchBoard 的 console seam / data path / props bridge / page.tsx 注入 / hero 视觉
- B 144 commit owned：lib/watch 其他逻辑 / lib/team / api/watch / lib/storage / news 系列
- StrategyDecisionRecord / DecisionOutcome / DecisionResolutionResult union
- PublicTimelineEvent schema / publicTimelineProjection.resolutionFromRecord
- `src/lib/team/decisionResolution.ts`（writer，冻结）
- `src/app/api/cron/strategy-replay/route.ts`（cron writer call site，冻结）
- 双 prod（ai.coinw.com + claw42.ai）
- price formatting（仍 `en-US` 固定）

---

## 10. 依赖前置

- main HEAD `567897944ccede30ef547ddfcab5618aaab037de` 含 A1 + B 144 + PR #85 全部 merge + B.1 spec docs commit ✓
- 业务代码同 `89f1f0e`（T000 docs commit 仅加 spec 文件 + Prettier 修正，无 src/ 改动）✓
- baseline verify gate 全过（Codex 2026-05-14 21:56 / 22:31 已确认）✓
- 干净 worktree（`/tmp/claw42-b1-implement` 或类似）从 origin/main checkout
- 不动主 worktree 30+ WIP

---

## 11. Tasks

### Phase 0 — Setup + Writer 冻结审计

- [ ] T000 [P] **Writer 冻结审计**（不再是 "is writer missing" audit）：
  - cherry-check `git diff origin/main -- src/lib/team/decisionResolution.ts src/app/api/cron/strategy-replay/route.ts` 在 feature 分支应 = 0
  - 类型断言：`DecisionResolutionResult` union 不含 `manual_close`（用 ts-expect-error 验证 / 或 grep `manual_close` 在 writer 文件 = 0 命中）
  - 报告 codex-to-claude.md：writer 路径文件 zero diff 确认 + manual_close 状态明示
  - 任何 diff > 0 → 立即停 + raise F
- [ ] T001 创建 feature worktree `/tmp/claw42-b1-memory-loop-hardening`，branch `feature/spec-b1-memory-loop-hardening`，base = origin/main `5678979`
- [ ] T002 跑 baseline verify gate（typecheck / lint / format:check / vitest / build / verify:a11y / verify:metrics）确认起点干净

### Phase 1 — i18n 落地

- [ ] T010 [P] [US1] `src/i18n/types.ts`：`DispatchV10Dict` 加 `outcome` 子类型（4 outcome key + pending + 3 reason key）
- [ ] T011 [US1] zh_CN.json：保持 main 当前文案不变，搬到 outcome namespace（§ 7.1）
- [ ] T012 [US1] en_US.json：完整英文翻译（§ 7.1）
- [ ] T013 [P] [US1] zh_TW / ja_JP / ru_RU / uk_UA / fr_FR / es_ES / ar_SA 各 locale 翻译（按 dispatchAgentMapping 已有 i18n display name 翻译模式）
- [ ] T014 en_XA.json：pseudo placeholder（v3 立的伪本地化机制）

### Phase 2 — Adapter 重构

- [ ] T020 [US1] adapter ctx type 扩展：在 `v9TopicAdapter.ts` 把 `V9AdapterContext` 加 `outcomeDict: DispatchV10Dict["outcome"]`（如不存在 ctx type 则同步新建）
- [ ] T021 [US1] 重构 `resolutionContent`：用 ctx outcomeDict + replaceVars 插值替换 hardcoded 中文 switch；加 `replaceVars` helper（如不存在）
- [ ] T022 [US1] 重构 `makeStages` pending note：从 outcomeDict.pending 取，删 hardcoded `"暂无复盘沉淀，等待结果回写"`
- [ ] T023 [US1] `AgentWatchBoard.tsx` ctx 构造段：从 `useI18n()` 取 `dict.agentWatch.dispatchV10.outcome` 并加进 ctx 传给 adapter（**仅 ctx 段，不动 console seam / props bridge**）

### Phase 3 — 测试覆盖（vitest only）

- [ ] T030 [P] [US2] 加 10 个 vitest unit test case in `v9TopicAdapter.test.ts`（§ 7.3 清单）
- [ ] T031 [US2] adapter locale matrix snapshot：4 outcome × 4 locale = 16 个 returned content，断言 non-zh locale 不含 `止/损/盈/平` 中文字符

### Phase 4 — Verify + Staging + 报告

- [ ] T040 跑全 verify gate（typecheck / lint / format:check / vitest run / build / verify:a11y / verify:metrics / verify:chat-v3-final / verify:agent-ip / verify:news）
- [ ] T041 跑 hardcoded 中文 grep 验证 SC-002：`rg "止盈达成|止损触发|到期未触发|人工关闭|暂无复盘沉淀" src/lib/watch/v9TopicAdapter.ts` 应 0 命中
- [ ] T042 跑 i18n 完整性 Node 脚本验证 SC-001：读 10 个 dict，断言 `agentWatch.dispatchV10.outcome` 含 8 key (4 outcome + 1 pending + 3 reason)，10 dict × 8 = 80 全覆盖
- [ ] T043 跑 staging（带 `STAGING_USE_FIXTURE=true`，加 4 outcome fixture 各一条到现有 staging fixture 数据集）确认 memory_loop msg + stage-6 pending note 在 zh_CN + en_US 切换正确渲染 —— fixture 为 **test fixture only**，不写真实 staging KV
- [ ] T044 push feature branch + 开 PR base main + Vercel preview deploy（**不带 --prod**）
- [ ] T045 报告 codex-to-claude.md：commit list / verify gate 输出 / writer 冻结 audit 结果 / staging preview URL + bypass

---

## 12. 约束

- **B.1 仅 i18n / tests + writer 冻结 audit**（writer 实施 / 修改 不在范围）
- 不动 A1 owned（v10 module / AgentWatchBoard 的 console seam + data path + props bridge / page.tsx 注入 / hero 视觉）
- 不动 main 已实施 schema（StrategyDecisionRecord / PublicTimelineEvent / projection）
- 不动 writer（`decisionResolution.ts` / `strategy-replay/route.ts`）
- 不动双 prod（Tier 1 ai.coinw.com / Tier 2 claw42.ai）— 不 --prod / 不推 CoinW GitLab
- 不动主 worktree 30+ WIP
- i18n 10 locale 默认全翻译（不向 Dan 问；en_XA 占位）
- 任何 schema mismatch / 接口不一致 → [SPEC-FEEDBACK]，不自行猜
- transient HTTP 502/503/504/timeout → retry 1-2 次（间隔 30s/90s/3min）；真阻塞（merge conflict / CI red / protected branch 等）→ 立即停 + 报告
- T000 writer 文件 diff > 0 → 立即停 + raise F

---

## 13. 不能做清单

- ❌ 不能修改 `src/lib/team/decisionResolution.ts` writer 任何字节
- ❌ 不能修改 `src/app/api/cron/strategy-replay/route.ts` cron call site 任何字节
- ❌ 不能给 `DecisionResolutionResult` writer return union 加 `manual_close`（schema 兼容但 writer 不产 是 by-design）
- ❌ 不能动 `StrategyDecisionRecord` schema（增字段 / 改 union / 改命名）
- ❌ 不能动 `PublicTimelineEvent.pm_decision.resolution` shape
- ❌ 不能动 `publicTimelineProjection.resolutionFromRecord` 映射
- ❌ 不能动 `DispatchAgentId` union 或 dispatchAgentMapping（memory_loop 保持 synthetic）
- ❌ 不能给 PublicTimelineEvent 加 schemaVersion（独立决策）
- ❌ 不能 hardcode 任何新中文（i18n 完整性纪律）
- ❌ 不能用顶层 `payload.resolvedAt` 路径（实际 shape 是 `payload.resolution.resolvedAt`）
- ❌ 不能改 AgentWatchBoard.tsx 的 console seam / data path / props bridge（A1 owned）
- ❌ 不能改 price formatting locale（`en-US` 固定 known limit，B.3/B.4 处理）
- ❌ 不能用 Storybook / RTL（repo 不存在这套工具）
- ❌ 不能假装 i18n 有 `t(key, vars)` API（实际是 typed Dict 对象）

---

## 14. Constitution 对照检查（v0.1.1 7 Rule）

| Rule                       | 状态 | 评估                                                                                 |
| -------------------------- | ---- | ------------------------------------------------------------------------------------ |
| Rule 1 部署身份            | PASS | preview only / 不推 CoinW GitLab / 走 agentxmain-collab registry                     |
| Rule 2 生产保护（双 prod） | PASS | 双 prod 都不动；不 --prod / 不上 claw42.ai / 不上 ai.coinw.com                       |
| Rule 3 视觉品牌权威        | PASS | 不动 v9 / v10 视觉权威，仅改 adapter 内部文案 lookup + i18n                          |
| Rule 4 数据 schema 纪律    | PASS | 不动 StrategyDecisionRecord / PublicTimelineEvent / projection / writer return union |
| Rule 5 AI / 行情诚实性     | PASS | 不引入 mock outcome；i18n 文案只对应真 outcome 值；writer 冻结                       |
| Rule 6 协作闭环            | PASS | 走 Codex 双脑评估 + sync READ/writeback + 实施前 grep check                          |
| Rule 7 验证门槛            | PASS | 全 verify gate + adapter locale matrix vitest test                                   |

无 Violation。

---

## 15. Worktree

- **F 起草 worktree**: F session 沙箱 outputs/（不动主 worktree）
- **Codex 评估 worktree**: `/tmp/claw42-b1-spec-eval`（已用，T000 docs commit 推 origin/main 后 close）
- **Codex 实施 worktree**: `/tmp/claw42-b1-memory-loop-hardening`（新建，base = origin/main `5678979`）
- **base HEAD**: `567897944ccede30ef547ddfcab5618aaab037de`（业务代码同 `89f1f0e`）
- **branch**: `feature/spec-b1-memory-loop-hardening`
- **PR base**: `main`
- **不动**: 主 worktree `/Users/dannybrown/Claude/职业规划/web-dev/claw42`（含 30+ WIP files）

---

## 16. 老板简报

claw42 Watch 板"决策复盘"模块当前已能展示真实的 AI 决策结果（止盈达成 / 止损触发 / 到期未触发 / 人工关闭），但文案只有中文，切到英文 / 日文等其他语言时还会看到中文。这次把 4 种结果加上等待状态的提示文字搬到多语言系统里，让 10 个语种用户都看到本地化版本。

同时给这块功能补完整测试（4 种结果 × 多个语种），避免后续迭代时改坏。

另外确认一下"真实结果"写入系统的那段代码不被改动 —— 它已经在线上稳定跑了，这次只动展示层，不碰内核。

不上正式版，迭代版预发演示。

---

## 17. Anti-Rationalization

| 逃逸路径                                                            | 为什么不行                                                                                                    | 正确做法                                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 觉得 4 outcome 文案小事直接 hardcode 翻译 10 locale 嵌入 adapter    | i18n 系统是 single source of truth，绕过 = 后续维护改文案要碰代码 + i18n 一致性破口                           | 全部走 `agentWatch.dispatchV10.outcome.*` namespace lookup                        |
| 觉得 reason 文本（take_profit_reached 等）一起塞 outcome 文案里就行 | reason 是独立 union 类型可能扩展，应当独立 i18n key 化便于后续加 outcome 不影响 reason                        | reason 用子 namespace `outcome.reason.*` 独立 key                                 |
| 觉得测试覆盖只跑 happy path 不跑 legacy 兼容                        | B 144 commit 前老 KV record 无 resolution 字段，graceful fallback 必测                                        | AC4 + T030 legacy test case 必跑                                                  |
| 觉得 writer 已存在所以 B.1 还应"完善" writer 让它产出 manual_close  | writer 不产 manual_close 是 by-design（schema 兼容 + 未来 manual flow 预留），改 writer 越界 + 影响 prod 行为 | T000 仅 audit writer 文件 git diff = 0；manual_close 当前不会触发但 i18n 文案必有 |
| 觉得 spec § 7.7 旧版用 payload.resolvedAt 顶层路径 OK               | 实际 main HEAD shape 是 `payload.resolution.resolvedAt` 子对象                                                | 用 grep 实测的 shape（`payload.resolution.*`）                                    |
| 觉得 adapter 直接 import 全量 dict JSON 简单                        | 把 i18n 数据引入 lib 层造成 bundle 边界污染 + lib 不再纯函数                                                  | ctx 注入 typed sub-dict（§ 7.2 决策）                                             |
| 觉得 i18n 假装有 `t(key, vars)` helper                              | repo 实际 i18n runtime 是 typed Dict 对象，没有通用插值层                                                     | adapter 接 typed dict + replaceVars helper                                        |
| 觉得 memory_loop synthetic vs real TeamMember 顺便升级              | 升级牵涉 dispatchAgentMapping / team registry / pipeline 等多处，是 Phase 6a 11 角色升级范围                  | B.1 保持 memory_loop synthetic 不动                                               |
| 觉得 price formatting 顺便 locale-aware                             | locale-aware price formatting 影响 chart / market snapshot / 所有数字渲染，cross-cutting，独立 spec           | B.1 保留 `Intl.NumberFormat("en-US")` known limit                                 |
| 觉得 schemaVersion 顺便加                                           | schemaVersion 引入是 cross-cutting 决策（影响所有消费方 / migration / backward compat），不属 B.1             | 独立 spec 决定                                                                    |
| 觉得 zh_CN 翻译完后其他 9 locale 推迟                               | A1 立的 i18n 默认翻全 9 locale 纪律 + en_XA 占位                                                              | T013-T014 实施期间一次翻完                                                        |
| 觉得 spec 留 audit trail 让 Codex 知道 v0 → v1 变化                 | spec 是 single source of truth，audit trail 由 decision-log 维护                                              | spec 内不留 strike-through / 不留 "(v1.1 修订：...)" 注解                         |
| 觉得 Storybook / RTL 项目应该有，直接跑了                           | repo 实际只有 vitest，没 Storybook / RTL 基础                                                                 | 仅用 vitest unit + adapter locale matrix                                          |

---

## 18. 双脑判断点

按 CLAUDE.md 双脑诊断纪律，Codex 实施前必须自己下判断 + 写到 codex-to-claude.md：

### Q1: V9AdapterContext 当前 shape

- main HEAD `5678979` adapter ctx type 实际叫什么 / 有没有 ctx type / locale 是怎么传的
- 如已有 ctx type → 加 outcomeDict 字段（preferred）
- 如没有 ctx type → 新建 typed ctx interface，最少改动加 outcomeDict + locale
- Codex grep `mapPublicTimelineEventsToTopics` 签名 + 上游 `AgentWatchBoard.tsx` 调用点 → 自决最少改动方式

### Q2: replaceVars helper 是否已存在

- main HEAD 有没有现成的字符串插值 helper（i18n 系统内 / 工具函数）
- 如已有 → 复用，不重复造
- 如没有 → 在 `v9TopicAdapter.ts` 内或 `src/i18n/replaceVars.ts` 新建（Codex 自决放哪个文件）

### Q3: reason key 是否还有更多 union 值

- 当前已知 reason union: `"take_profit_reached" | "stop_loss_reached" | "evaluation_window_elapsed"`
- 实测 main HEAD type / writer 看 reason union 是否还有其他值
- 如有 → 同步加进 i18n outcome.reason 子 namespace；如没有 → 保持 3 个 key

### Q4: vitest locale fixture 怎么准备

- adapter test 需要 4 outcome × 4 locale 的 outcomeDict typed fixture
- main HEAD 有没有现成的 test i18n fixture / mock pattern
- Codex 自决：直接 import 10 个真 dict 取 outcome / 还是手写 minimal typed fixture

### Q5: T043 staging fixture 注入方式

- 当前 staging 走 `STAGING_USE_FIXTURE=true` 模式
- main HEAD 看 fixture 数据集在哪文件，是否已有 resolution 样本
- 如已有 → 验证 4 outcome 覆盖；如缺 → Codex 加 4 outcome fixture（仅 test fixture，不写真实 staging KV）

### Q6: F 没看到的 angle

Codex 至少给 1 个 F 没考虑的工程 / 数据 / 性能 / a11y / 安全 angle。可能方向：

- adapter ctx 加 outcomeDict 后 memoization 影响（每次 dict ref 变化触发 re-compute）
- ar_SA RTL 下 outcome 文案含数字（price）方向 / unicode bidi 处理
- typed Dict 编译期校验是否真覆盖 dict 缺 key 场景（runtime fallback 设计是否冗余）
- 任何其他你看 first-hand data 想到的

### 实施前 grep check（v2.5 立的）

- [ ] `cat src/lib/watch/v9TopicAdapter.ts` 确认 resolutionContent / makeStages / ctx 当前实现
- [ ] `cat src/i18n/types.ts | grep -A 30 dispatchV10` 确认 namespace 类型当前 shape
- [ ] `cat src/i18n/I18nProvider.tsx` 确认 useI18n() 返回 typed Dict 对象
- [ ] `ls src/i18n/dicts/*.json | wc -l` 确认 10 locale dict 全在（应为 10）
- [ ] `cat src/modules/agent-watch/AgentWatchBoard.tsx` 看 mapPublicTimelineEventsToTopics 调用点 + useI18n 是否已 import
- [ ] `cat src/lib/team/decisionResolution.ts | grep -A 5 DecisionResolutionResult` 确认 writer return union 不含 manual_close
- [ ] `git diff origin/main -- src/lib/team/decisionResolution.ts src/app/api/cron/strategy-replay/route.ts` 应 = 0（T000 冻结校验）
- [ ] `ls src/lib/watch/__tests__/v9TopicAdapter*.test.ts 2>/dev/null` 看现有 test 覆盖（如不存在则新建）
- [ ] `cat docs/project-constitution.md` 重读 v0.1.1 7 Rule（worktree cwd 路径）
- [ ] `cat /Users/dannybrown/Claude/职业规划/web-dev/decision-log.md | head -150` 看最近 entry（B.1 范围重定义 / B.1 v1.0→v1.1 等）—— decision-log 是 repo 外部文件，只读引用

如任一不一致 → [SPEC-FEEDBACK]，不自行猜。

---

## 19. decision-log 联动

spec 起草触发追加 entry 到 `/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md`（repo 外部文件，只读引用，不进 git commit）：

- 2026-05-14 22:00 CST B.1 范围重定义（已加）
- 2026-05-14 22:31 CST Codex 第 1 轮评估结论 + 8 条 SPEC-FEEDBACK（待 F 追加）
- 2026-05-14 22:50 CST B.1 spec v1.1 出（待 F 追加）
- 实施完成后追加：B.1 implement complete entry（commit list / staging URL / writer 冻结 audit 结果）

Codex 实施前 / 任何拍板节点都先读 decision-log（按 CLAUDE.md ★ 决策档案先行硬性规则）。

---

## 工作量预估

| Phase                                                    | 时间（AI 天）   |
| -------------------------------------------------------- | --------------- |
| 0 Setup + T000 writer 冻结 audit                         | 0.3             |
| 1 i18n 10 locale                                         | 0.5-1           |
| 2 Adapter 重构（ctx + adapter + AgentWatchBoard ctx 段） | 0.5             |
| 3 vitest 测试覆盖                                        | 0.5-1           |
| 4 Verify + staging + 报告                                | 0.5             |
| **总计**                                                 | **2-3.3 AI 天** |

---

## 关联资产

- Codex grep 实测报告：`codex-to-claude.md` 2026-05-14 21:56 entry（pre-spec grep）+ 22:31 entry（v1.0 评估 + 8 条 SPEC-FEEDBACK）
- A1 spec：`claw42/docs/codex-specs/spec-watch-A1-dispatch-console-v10.md`（已 merge main）
- Constitution：`claw42/docs/project-constitution.md` v0.1.1（worktree cwd `docs/project-constitution.md`）
- Decision-log：`/Users/dannybrown/Claude/职业规划/web-dev/decision-log.md`（2026-05-14 多 entry，repo 外部只读）
- 前置 spec：A1 + Phase B v2.1（已 merge）

---

_v1.1 起草：2026-05-14 22:50 CST F session_
_起草前置：Codex 22:31 8 条 SPEC-FEEDBACK 收敛 + i18n API 路径切到 ctx 注入 typed sub-dict + writer 冻结改为 audit 不动_
_下一动作：派 Codex 第 2 轮双脑评估（目标 ≤ 2 minor → implement 合并）_
