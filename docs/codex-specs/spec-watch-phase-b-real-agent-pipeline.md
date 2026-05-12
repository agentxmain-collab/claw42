# spec-watch-phase-b-real-agent-pipeline (v2.1 · 2026-05-13 二修)

> **目的**：把 v3.7 落地的 v9 行情分析板块从 fixture-only 切换为接入真 agent 工作流输出。**UI 视觉零变化**——v9 是视觉权威，本 spec 只换数据来源。
>
> **核心约束**（Dan 拍板，硬性）：
> 1. UI 不能变（v9 视觉权威，无论后端怎么改前端组件树/CSS/交互都不动）
> 2. 数据来源从 `v9/fixtureData.ts` 切到真 pipeline 输出
> 3. 当前 staging 跟 prod 行为按双轨规则：staging 跑真 pipeline，prod 不动（claw42.ai 仍 Act1）
>
> **设计源**：`/Users/dannybrown/Claude/职业规划/web-dev/dispatch-console-v9.html` 仍是视觉权威；`v9/types.ts` 是数据契约权威；`v9/fixtureData.ts` 是数据语义参考（什么字段填什么）
>
> **依赖**：patch v3.7 已 merge main（feature/patch-v37-dispatch-v9 → main）
>
> **v2 修订原因（2026-05-13 上午）**：Codex 双脑评估第 1 轮发现 6 个 [SPEC-FEEDBACK]：v9 contract 用 sentiment_analyst 不是 onchain / TradeDecision 字段名错（entryRange/entryPrice/takeProfit 不是 entryZone/takeProfits）/ direction 是 `wait` 不是 `neutral` / pm_decision payload 没 symbol / AgentWatchBoard 当前无 polling / MessageBubble 用 dangerouslySetInnerHTML（XSS 风险）。本版本全部修正 + 新增 B.0 schema alignment + B.1 safe formatter，原 B.1-B.8 顺延为 B.2-B.9。
>
> **v2.1 二修原因（2026-05-13 下午）**：Codex 双脑评估第 2 轮针对 v2 §13 Q3-Q9 给出工程建议 + 2 个新 [SPEC-FEEDBACK]：
> 1. `TradeDecision.entryRange` 类型 `{ low: number; high: number } | null`（**对象，不是 tuple `[number, number]`**） → 修 §1.1 / §7.7 / §2.3
> 2. `DispatchTopic` 没有 `source` 字段 → 移除 §1.2 类型 / §7.2 adapter 输出
> 3. clock-induced render churn（DispatchConsoleV9 每秒 tick clock 会导致整树重 render） → B.1 加 React.memo + useMemo / B.8 加 Clock 子组件拆分
> 4. follow stats 隐私（不存原 anon id，用 hash + server salt） → B.7 + §7.8 修
> 5. API contract test（B.0 加 payload.symbol 后同 commit 更新 projection test + adapter pre-B.0 兜底 test） → B.0 验收新增
> 6. Q3 polling guidance（server nextPollMs + setTimeout + AbortController + visibility API + BroadcastChannel） → B.8 修
> 7. Q4 rate limit guidance（用 `src/lib/storage/kv-rate-limiter.ts` + Node runtime + IP+anon 双 key + 幂等） → B.7 修
> 8. Q5 aggregation guidance（30min 同 symbol 窗口 + 不跨 locale + follow stats 绑 recordId 不绑 symbol） → §7.5 + B.4 修
> 9. Q6 parser 容错（未闭合 `**` 保留 literal / 不递归嵌套 / RTL 不注 dir） → B.1 加约束
> 10. Q8 visual threshold caveat（text-only delta 允许超阈，CSS/class/layout 严格 0 改动） → §9 修

---

## 0. 必读纪律

### 0.1 三层防御（每个阶段强制）
- **层 1 跨域刷新**：每个 sub-phase 开始前重新 `cat` 当前 main HEAD 的 `strategyDecisionRecord.ts` / `publicTimelineEvent.ts` / `publicTimelineProjection.ts` / `teamRegistry.ts`，不依赖本 spec 写的字段名记忆
- **层 2 首件检验**：每个 adapter / mapper 函数实现后先用 1 条真实 fixture record 跑端到端，验证 v9 UI 渲染对，再批量
- **层 3 同根因熔断**：同类 schema 命名错误连续出现 2 次 → 立即停 + 退到 schema 对照表重做，不逐条修

### 0.2 双脑诊断（每个判断点）
凡看 first-hand data 做工程决策：Codex 必须自己下判断 + 写到 codex-to-claude.md，不只是报数据。本 spec §13 列了必填判断点。

### 0.3 Anti-rationalization
- "改 UI 让数据更好接" → ❌ UI 是权威，改 adapter 不改 UI
- "schema 不一致先 mock 兜底" → ❌ 触发 [SPEC-FEEDBACK]，不自行猜
- "fixture 没有的字段先注释掉 UI" → ❌ UI 字段必填，缺数据时 adapter 给合理 fallback 但保留 UI

---

## 1. 现状盘点（F 已 grep 调研）

### 1.1 main HEAD 实际 schema（v3.5 立的）

**`src/lib/team/strategyDecisionRecord.ts`**：
```ts
interface AnalystInputRecord {
  memberId: TeamMemberId;
  direction: "long" | "short" | "neutral";
  confidence: number;          // 0-1
  rationale: string;            // 单条 final rationale
  evidenceIds: string[];        // 新闻引用
}

interface StrategyDecisionRecord {
  id: string;
  schemaVersion: 1;
  recordSource: "live" | "paper" | "legacy" | "backtest";
  symbol: string;
  locale: Locale;
  decisionOwnerId: TeamMemberId | "legacy";
  contributorIds: TeamMemberId[];
  analystInputs: AnalystInputRecord[];   // 6 row（4 analyst + research_lead + risk_lead）
  sourceThreadId: string | null;
  tradeDecision: TradeDecision | null;
  createdAt: string;
  evaluationWindowEndsAt: string | null;
  resolvedAt: string | null;
  resolvedOutcome: "hit_tp" | "hit_sl" | "expired" | "manual_close" | null;
  promptVersion: string;
  modelProvider: string;
  legacyFactionId?: FactionId | null;
}
```

**`src/lib/watch/publicTimelineEvent.ts`** payload kinds（Codex 实测确认）：
```ts
type PublicTimelinePayload =
  | { kind: "market_signal"; symbol; signalType; severity; ... }
  | { kind: "news"; evidenceId; symbols[] }
  | {
      kind: "pm_decision";
      recordId;
      tradeDecision?: TradeDecision | null;
      rationaleByMember: Partial<Record<TeamMemberId, string>>;   // 6 key (4 analyst + research_lead + risk_lead)
      citationsByMember?: Partial<Record<TeamMemberId, string[]>>;
      // ⚠️ 注意：当前 payload NO 顶层 symbol / NO evaluationWindowEndsAt / NO resolvedAt / NO resolvedOutcome
      // symbol 只能从 tradeDecision.symbol 拿；tradeDecision=null 时无法可靠推断
    }
  | {
      kind: "team_discussion";
      recordId;
      turns: Array<{ memberId: TeamMemberId; text: string; citations: string[] }>;
    };
```

**TradeDecision schema**（`src/lib/team/tradeDecision.ts` 实际字段，Codex grep 两轮确认）：
- `symbol: string`（validateTradeDecision 内 normalize 去 `$` + uppercase）
- `direction: "long" | "short" | "wait"`（**不是 neutral**）
- `entryRange: { low: number; high: number } | null`（**v2.1 修订：对象，不是 tuple `[number, number]`**）
- `entryPrice?: number`
- `stopLoss?: number`
- `takeProfit?: number[]`（**不是 takeProfits 复数**）
- `confidence?: number`（0-1）

**TeamMemberId**（v3.5 立的 7 角色，来自 `src/lib/team/teamRegistry.ts`）：
- `fundamental_analyst` / `news_analyst` / `chart_analyst` / `onchain_analyst` / `research_lead` / `risk_lead` / `pm`

**publicTimelineProjection.ts**：
- 实际函数名 `derivePmDecisionProcess()`（不是 `deriveRationaleByMember`，行为相同）
- 从 `record.analystInputs[]` 派生
- 每 row.memberId → key，每 row.rationale → value（单条 final）
- 6 个 key 派生：4 analyst + research_lead + risk_lead（PM 不进 rationaleByMember，PM 的输出在 tradeDecision）

**StrategyDecisionRecord 上有但 public payload 没暴露的字段**（Codex 标记）：
- `evaluationWindowEndsAt`：当前 public payload 没有 → adapter 算 expiryNote 时只能用 `event.ts + 默认窗口` 近似 / 或暂时跳过
- `resolvedAt / resolvedOutcome`：当前 public payload 没有 → adapter 算 stage-6 memory_loop 永远 pending
- `record.symbol`：当前 public payload 没有 → 见下方 0.4 拍板

### 1.2 v3.7 v9 fixture data 契约（feature/patch-v37-dispatch-v9）

**`src/modules/agent-watch/v9/types.ts`**：

```ts
// v9 实际 DispatchAgentId（Codex grep types.ts 确认 — **没有 onchain_analyst**）
type DispatchAgentId =
  | "fundamental_analyst"      // ✓ 与 current 一致
  | "sentiment_analyst"         // ⚠️ current 没有！v9 fixture 实际用这个（不是 onchain）
  | "news_analyst"              // ✓ 与 current 一致
  | "technical_analyst"         // ⚠️ current 叫 chart_analyst（命名 mismatch）
  | "bullish_researcher"        // ✗ current 是 research_lead（不分多空）
  | "bearish_researcher"        // ✗ current 是 research_lead
  | "trader"                    // ✗ current 没有（rationale 走 research_lead，决策走 PM）
  | "aggressive_reviewer"       // ✗ current 是 risk_lead（不分三派）
  | "neutral_reviewer"          // ✗ current 是 risk_lead
  | "conservative_reviewer"     // ✗ current 是 risk_lead
  | "portfolio_manager"         // ⚠️ current 叫 pm（命名 mismatch）
  | "memory_loop";              // ✗ current 没有（机制不是 agent）

// ⚠️ 关键 mismatch：
// - v9 contract 用 sentiment_analyst（4 analyst 第 2 位）
// - current pipeline 用 onchain_analyst（4 analyst 第 4 位）
// - v9 fixture data 实际填的是 sentiment_analyst（不是 spec v1 假设的 onchain）
// 见 0.4 拍板（onchain ↔ sentiment 视觉 slot 决策）

interface DispatchMessage {
  id: string;
  stageId: string;              // 属于哪个 stage marker
  agentId: DispatchAgentId;
  agentName: string;
  time: string;
  dataAge?: string;             // "数据 526 秒前"
  mentions: string[];           // ["@看空"]
  quote?: { agentName: string; text: string };  // 引用上一条
  content: string;              // 气泡 HTML（可含 <b>）
  typing?: boolean;
}

interface DispatchStageMarker {
  id: string;
  label: string;                // "阶段 2 · 多空辩论 · 第一轮"
  status: "done" | "active" | "pending" | "final";
  note?: string;
}

interface DispatchStrategy {
  action: "wait" | "long" | "short" | "pending";
  actionLabel: string;          // "WAIT 等待" / "SHORT 6%" / "PENDING"
  name: string;                 // "本次决策" / "已开仓" / "尚未决策"
  ticker: string;               // "$BTC"
  meta: string;                 // "3 个阶段已完成 · 交易员正在出方案..."
  metaHighlight?: { text; tone: "ok" | "warn" | "lime" };
  entry: string;
  stopLoss: string;
  takeProfit: string;
  follow: {
    primaryLabel: string;       // "我跟了" / "已跟单" / "等待方案"
    primaryDisabled: boolean;
    secondaryLabel: string;     // "我没跟" / "查看详情" / "提醒我"
    watchCount: number;
    followCount: number;
    expiryNote?: string;        // "30m 后失效"
  };
}

interface DispatchTopic {
  id: string;
  symbol: string;               // "BTC" / "ETH" / "SOL"
  status: "active" | "done" | "pending";
  title: string;                // "🔥 BTC live market check..."
  originalUrl: string;
  // ⚠️ v2.1 修订（Codex Q9 [SPEC-FEEDBACK]）：v9 当前 DispatchTopic **没有 source 字段**
  // 之前 spec 列了 source: string，是错的。Adapter 不输出该字段
  startedAt: string;            // "19:22"
  progress: string;             // "当前进行到阶段 3" / "28 分钟闭环"
  intensity: number;            // 1-5
  trigger: { ticker: string; text: string };
  stages: DispatchStageMarker[];
  messages: DispatchMessage[];
  strategy: DispatchStrategy;
  defaultCollapsed: boolean;
}
```

### 1.3 当前 staging 跑的真数据流

```
[real LLM provider]
   ↓
pmDecisionPipeline.ts (4 analyst + 2 lead + PM 7 个 LLM 调用)
   ↓
runPmDecisionPipeline() → StrategyDecisionRecord
   ↓
decisionRecordStore (KV per locale)
   ↓
makePublicTimelineEntry() → PublicTimelineEvent
   ↓
KV: claw42:watch:history:v1:<locale>
   ↓
publicTimelineProjection.ts deriveRationaleByMember/deriveCitations
   ↓
/api/watch/timeline route
   ↓
AgentWatchBoard fetch (v3.7 实测：仅 initial load，无 polling — B.8 首次添加)
   ↓
（v3.7 当前）DispatchConsoleV9 用 fixture，不消费 events 数据
```

---

## 2. 数据契约 Gap 表（核心）

### 2.1 角色 ID 映射（v2 修订，Codex 评估对齐）

| v9 DispatchAgentId | current TeamMemberId | 状态 | Phase B 处理 |
|---|---|---|---|
| `fundamental_analyst` | `fundamental_analyst` | ✓ 一致 | 直通 |
| `news_analyst` | `news_analyst` | ✓ 一致 | 直通 |
| `technical_analyst` | `chart_analyst` | ⚠️ 命名 mismatch | **adapter 映射**（v9 显示用 technical，schema 内部仍 chart） |
| `sentiment_analyst` ↔ `onchain_analyst` | `onchain_analyst` | ⚠️ 双向冲突 | **见 0.4 拍板**（推荐选 B：v9 contract 加 onchain_analyst slot；不用 sentiment） |
| `bullish_researcher` | `research_lead` | ⚠️ current 不分多空 | adapter 把 research_lead 单条 rationale 渲染为 1 条 bullish_researcher message（视觉上偏多视角） |
| `bearish_researcher` | （同上） | （同上） | adapter 不生成 bearish_researcher message |
| `trader` | ✗ 不存在 | ⚠️ current 没 trader（rationale 走 research_lead，决策走 PM tradeDecision） | **adapter 把 tradeDecision 派生为 trader message**（综合输出） |
| `aggressive_reviewer` | `risk_lead` | ⚠️ current 不分三派 | adapter 把 risk_lead 单条 rationale 渲染为 1 条 neutral_reviewer message |
| `neutral_reviewer` | （同上） | （同上） | 用 risk_lead rationale 渲染（中立视角） |
| `conservative_reviewer` | （同上） | （同上） | adapter 不生成 |
| `portfolio_manager` | `pm` | ⚠️ 命名 mismatch | adapter 映射（v9 显示 portfolio_manager，schema 内部 pm） |
| `memory_loop` | ✗ 不存在（机制） | ⚠️ reflection 持久化机制 | adapter stage-6 永远 pending（current public payload 没暴露 resolvedAt） |

### 2.2 Message granularity

| v9 需求 | current schema | Gap |
|---|---|---|
| 多 round messages（看多 R1 立论 + 看空 R1 反驳 + 看多 R2 反驳 + 看空 R2 让步） | 每 agent 1 条 final rationale | **不够**——pipeline 当前不输出 round trace |
| `mentions[]`（@看空） | 无 | adapter 推断（启发式：研究员之间默认 @对方，三派默认 @PM）或暂留空 |
| `quote.text`（引用上一条） | 无 | adapter 推断（按 stage 顺序前一条 message） |
| `typing: true`（LLM 调用中） | 无 | 需 pipeline 状态暴露（in-progress event）或 polling 临时态 |
| `dataAge`（"数据 526 秒前"） | record.createdAt vs 当前时间 | adapter 计算 |
| `stageId` 多轮（"stage-2-r1" / "stage-2-r2"） | analystInputs 没有 round | **Phase B.1 取消多轮**——每 stage 1 round，message 数 = current rationale 数 |

### 2.3 Strategy（v2 修订 — Codex 实测字段名）

| v9 需求 | current schema 实际 | Gap |
|---|---|---|
| `action: wait/long/short/pending` | `tradeDecision.direction: "long" \| "short" \| "wait"` | direction 直通（long/short/wait 一致）；tradeDecision=null → action="pending" |
| `entry` | `tradeDecision.entryRange: { low; high } \| null` 或 `entryPrice?: number` | adapter 格式化（range 用 "low - high" / price 用单值；v2.1 修订：是对象不是 tuple） |
| `stopLoss` | `tradeDecision.stopLoss?: number` | 直通格式化 |
| `takeProfit` | `tradeDecision.takeProfit?: number[]`（**单数** + 数组） | adapter 格式化（多档用 "X / Y / Z"） |
| `follow.watchCount / followCount` | ✗ 不存在 | **新建 follow stats KV**（B.5） |
| `expiryNote: "30m 后失效"` | `record.evaluationWindowEndsAt` 在 record 不在 payload | **当前无法真算**——见 0.4 拍板（adapter 用 event.ts + 默认窗口近似 / 或跳过 expiryNote） |

---

## 0.4 v2 新增拍板项

### Q-A: onchain ↔ sentiment 视觉 slot 冲突
- (a) v9 contract 加 `onchain_analyst`（types.ts 加 + fixture data 改 onchain）—— **F 推荐**
- (b) UI 标 sentiment 但 schema 映射 onchain（视觉骗用户）
- (c) Phase B 不渲染第 4 个 analyst（丢真数据）

**推荐 (a)**：改 v9 types.ts + fixture，UI 视觉相同（只是 avatar class 同一套，agent name 改）—— scope 仍是 UI 不变（class 不变，只换文字），不破坏 Dan 约束。

### Q-B: pm_decision payload 是否补 symbol 字段
- (a) 是 — projection payload 加 symbol 字段（不是 pipeline schema 升级，只是 projection 补完整）
- (b) 否 — adapter 用 tradeDecision.symbol 兜底，tradeDecision=null 时 skip 该 event

**Codex 推荐 (a)** —— payload 补 symbol 是小升级（projection 已有 record，直接读 record.symbol），让 adapter 不需要 guess。F 同意 (a)。

### Q-C: expiryNote 怎么处理
- (a) 跳过 expiryNote（不显示）
- (b) 用 event.ts + 默认 30min 窗口近似
- (c) projection payload 补 evaluationWindowEndsAt 字段

**推荐 (a) + (c) 二选一拍板**：
- 短期 (a) 跳过 — Phase B 不显示 expiryNote
- 长期 (c) 后续 spec 补 — 跟随 memory_loop / resolvedOutcome 一起暴露

F 推荐短期 (a)，后续 B.6 独立 spec 处理。

### 2.4 Topic 粒度

| v9 需求 | current 数据 | Gap |
|---|---|---|
| 1 个 topic = 1 个热点（含触发新闻 + 多 PM decision round） | 1 个 PublicTimelineEvent.pm_decision = 1 次决策 | **当前 1 PM decision = 1 topic**（B.3 决策点：聚合规则） |
| `intensity 1-5` | ✗ 不存在 | **algorithm**：news severity + agent direction 分歧度 + tradeDecision confidence 综合（B.4 决策点） |
| `trigger.text`（触发新闻摘要） | 关联 news evidence | adapter 取 record.analystInputs[].evidenceIds 中 highest severity news 的 description |
| `originalUrl` | news evidence.url | adapter 直通 |
| `status: active/done/pending` | record.resolvedAt + tradeDecision | adapter 派生（resolved → done / unresolved + recent → active / unresolved + 老 → pending）|
| `progress: "当前进行到阶段 3"` | record.analystInputs 完整度 | adapter 计算（count(analystInputs) vs 6） |

---

## 3. 实施路径选择

### 3.1 三条路径

**路径 A：纯 adapter（渐进，不动 pipeline）**
- 不改 pipeline，不改 record schema
- 写 adapter `mapPublicTimelineEventsToTopics(events, evidenceMap)`
- 缺的 v9 字段（multi-round / typing / mentions / quote / intensity / follow count）adapter 内 fallback / 推断 / mock
- UI 完全保持 v9 视觉
- 真数据驱动 v9，但**多轮辩论降级为单轮**（visual 上保留 stage marker 但每 stage 只有 final round）
- **5-8 AI 天**

**路径 B：完整升级**
- pipeline 升级输出 multi-round debate trace
- record schema 加 `rounds: []` 字段
- 11 角色架构重设（Phase 6a 范围）
- intensity / topic 触发机制 / 实时 SSE
- **20-35 AI 天 + 依赖 Phase 6a 启动**

**路径 C：A + 选择性 B 升级**
- 路径 A 范围全做
- 选择性升级：trader 角色补（让 PM tradeDecision 派生 trader message）+ intensity 算法基础版 + follow count KV
- 不动 pipeline / 不升级 11 角色 / 不做 multi-round trace
- **8-12 AI 天**

### 3.2 F 推荐：路径 C

**理由**：
- 满足 Dan "接入真 agent 工作流" 的核心需求（数据来源切真 pipeline）
- 保持 UI 不变（v9 视觉权威）
- 不依赖 Phase 6a（独立可推进）
- 工作量可控（8-12 AI 天 vs 20-35 AI 天）
- 真升级 11 角色 + multi-round 留给 Phase B.2 / Phase 6a（独立 spec）

**降级 trade-off**（UI 不变下接受的妥协）：
- 多轮辩论 → 单轮（看多/看空 各 1 条 message，从同一 research_lead rationale 派生）
- typing indicator → 仅展示当前未完成 stage 的占位（基于 polling 估算）
- @mention / quote → 启发式推断（不是真 prompt 输出）
- 三派 reviewer → 折叠为 1 条 neutral_reviewer message（隐藏 aggressive / conservative）
- memory_loop → 已 resolved 决策派生 reflection message（占位机制）

---

## 4. 变更范围

### 4.1 新建

- `src/lib/watch/v9TopicAdapter.ts` — 核心 adapter
- `src/lib/watch/v9TopicAdapter.test.ts` — 单测
- `src/lib/watch/intensityCalculator.ts` + test
- `src/lib/watch/topicAggregator.ts` + test — 含 30min 窗口同 symbol 聚合规则
- `src/lib/watch/dispatchAgentMapping.ts` — DispatchAgentId ↔ TeamMemberId + i18n display names
- `src/lib/watch/safeMessageFormatter.ts` + test — **XSS 防护**：escape LLM/news 原文 + 仅 adapter-owned tokens 生成允许的加粗等富文本
- `src/app/api/watch/follow-stats/route.ts` — follow stats GET+POST
- `src/lib/watch/followStatsStore.ts` — KV wrapper：counter key / set key 分离设计（避免单 JSON 热 key 竞态）
- 测试 fixture：`src/lib/watch/__fixtures__/realPmDecisionSample.json`（从真 KV snapshot 一条 PM decision 作为 adapter 黄金参考）

### 4.2 修改（v2 整合 — 含 B.0 schema 升级 + B.1 XSS 修复 + B.8 集成）

**B.0 schema 升级**
- `src/lib/watch/publicTimelineEvent.ts` — `pm_decision` payload 加 `symbol: string`（projection 时从 record.symbol 直读，非 pipeline 升级）
- `src/lib/watch/publicTimelineProjection.ts` — `derivePmDecisionProcess`（或等价函数）set `payload.symbol = record.symbol`
- `src/modules/agent-watch/v9/types.ts` — `DispatchAgentId` union 把 `sentiment_analyst` **切换为** `onchain_analyst`（Q-A 拍板 (a)；不是新增，是替换）
- `src/modules/agent-watch/v9/fixtureData.ts` — 所有 `sentiment_analyst` 引用切到 `onchain_analyst`（含 agentId / agentName / 任何含 sentiment 字样的 message content）

**B.1 XSS 修复**
- `src/modules/agent-watch/v9/MessageBubble.tsx` — 删除 `dangerouslySetInnerHTML`，改用 safeMessageFormatter 返回的 React 节点树
- `src/modules/agent-watch/v9/fixtureData.ts` — 同步把 fixture content 中的 `<b>` 标签改为 adapter-owned `**bold**` token（B.0 改 onchain 时一起处理）

**B.8 集成**
- `src/modules/agent-watch/AgentWatchBoard.tsx`
  - 当前 v3.7 实测**没有 polling**（只有 initial load）。本节**新增** `/api/watch/timeline` polling（沿用 v3.5 nextPollMs 默认 90s）
  - **新增** `/api/watch/follow-stats` polling（独立频率，见 §13 Q3 双脑判断）
  - 传 adapter 输出 `topics: DispatchTopic[]` 给 DispatchConsoleV9
- `src/modules/agent-watch/v9/DispatchConsoleV9.tsx`
  - 添加 `topics?: DispatchTopic[]` prop（可选，未传时 fallback v9 fixture）
  - prop 传递给 MarketAnalysisView
- `src/modules/agent-watch/v9/MarketAnalysisView.tsx`
  - 接 topics prop，渲染真数据
  - fallback: topics 为空 → 渲染"暂无热点辩论"占位（保持 chat-shell 容器视觉）
- `src/modules/agent-watch/v9/fixtureData.ts`
  - 重命名 const `FIXTURE_TOPICS_V9` → `FIXTURE_TOPICS_V9_DEV` + 文档注释（dev 用，prod adapter 不消费）

### 4.3 不动

- v3.7 立的 v9 组件树（除 B.8 props 接收 + B.1 MessageBubble XSS 修复外）
- v3.7 立的 scoped CSS（一字不改 — screenshot diff 是硬 gate）
- pipeline 实施（不升级 pmDecisionPipeline / strategyDecisionRecord schema）
- 11 角色架构（不升级，沿用 v3.5 7 角色 schema）
- v3.5 立的 STAGING_USE_FIXTURE env 开关（保留，但本 spec 在 STAGING_USE_FIXTURE=false 时跑真 pipeline）
- 备注：`publicTimelineEvent.ts` schema 本 spec 做**小升级**（payload 加 symbol），不算 pipeline 升级（projection 层补字段）

### 4.4 删除（无）

本 spec 不删任何文件。

---

## 5. 依赖前置

- main HEAD 含 patch v3.7 merge（feature/patch-v37-dispatch-v9 → main）
- baseline gate `7ff6afc7eed3646d272dc312d565280ac2840568` 是 main HEAD 的 ancestor
- 主 worktree 30+ 未提交文件状态 → **走独立 feature worktree** `/tmp/claw42-patch-phase-b-real-pipeline-01`
- staging KV (`claw42-spec1-main-staging` Vercel project) 有真 record 数据（或继续用 STAGING_USE_FIXTURE seed）
- 当前 `/api/watch/timeline` route 返回 `PublicTimelineEvent[]` + `evidenceMap` 结构（不需要新建 route，只新建 `/api/watch/follow-stats`）

---

## 6. 当前状态快照（Codex 实施前必须确认）

执行前 `git fetch origin && git checkout origin/main` 后跑：

- [ ] `cat src/lib/team/strategyDecisionRecord.ts` 含 `AnalystInputRecord { memberId / direction / confidence / rationale / evidenceIds }` 字段
- [ ] `cat src/lib/watch/publicTimelineEvent.ts` 含 `pm_decision` payload + `team_discussion` payload schema
- [ ] `cat src/lib/team/teamRegistry.ts` 列出 7 个 TeamMemberId（fundamental/news/chart/onchain/research_lead/risk_lead/pm）
- [ ] `cat src/modules/agent-watch/v9/types.ts` 含 12 个 DispatchAgentId（**含 sentiment_analyst**——B.0 切到 onchain_analyst）
- [ ] `cat src/modules/agent-watch/v9/fixtureData.ts` 含 N 个 fixture topic 作为数据语义参考（Codex 实测确认 topic 数量 + 哪几个 symbol）
- [ ] `cat src/modules/agent-watch/AgentWatchBoard.tsx` 确认 v3.7 实测状态（initial fetch / 是否有 polling / 是否有 effect cleanup）
- [ ] `cat src/app/api/watch/timeline/route.ts` route schema 含 `events / evidenceMap / locale / nextPollMs`
- [ ] `cat src/modules/agent-watch/v9/MessageBubble.tsx` 确认当前用 `dangerouslySetInnerHTML`（B.1 改造目标）
- [ ] `cat src/modules/agent-watch/v9/DispatchConsoleV9.tsx` 当前 props（确认是否接受 topics 注入点）
- [ ] `cat src/modules/agent-watch/v9/MarketAnalysisView.tsx` 当前接收 fixture topics 的位置
- [ ] 一条 staging KV 真 entry：跑 `vercel curl /api/watch/timeline?mode=public&locale=zh_CN&windowMinutes=720` inspect events.length + payload.kind 分布

如有 schema 字段名 / 文件路径不一致 → 立即 [SPEC-FEEDBACK]，不自行猜。

---

## 7. 技术上下文（详细）

### 7.1 DispatchAgentId ↔ TeamMemberId 映射

**`src/lib/watch/dispatchAgentMapping.ts`**：

```ts
export const TEAM_MEMBER_TO_DISPATCH_AGENT: Record<TeamMemberId, DispatchAgentId> = {
  fundamental_analyst: "fundamental_analyst",
  news_analyst: "news_analyst",
  chart_analyst: "technical_analyst",          // 命名 mismatch
  onchain_analyst: "onchain_analyst",
  research_lead: "bullish_researcher",         // 单一 research_lead → 渲染为 bullish_researcher（看多视角）
  risk_lead: "neutral_reviewer",                // 单一 risk_lead → 渲染为 neutral_reviewer（折中视角）
  pm: "portfolio_manager",
};

// 反映 v9 中没有 current schema 的角色（fallback 不生成 message）
export const DISPATCH_AGENT_NOT_IN_CURRENT: DispatchAgentId[] = [
  "sentiment_analyst",       // current 没有
  "bearish_researcher",      // current research_lead 单一，不拆多空
  "aggressive_reviewer",     // current risk_lead 单一，不拆三派
  "conservative_reviewer",
  "trader",                   // 由 tradeDecision 派生
  "memory_loop",              // 由 resolvedOutcome 派生
];
```

**注意（v2 修订）**：Codex 实测 v9 当前 contract 用 `sentiment_analyst`，**不是** onchain。Q-A 拍板 (a) → B.0 schema alignment 把 v9 types + fixture 从 sentiment 切到 onchain（这样 adapter 不需要造假数据，且和 current pipeline 的 onchain_analyst 直通映射）。**Phase B.0 完成前，本节映射假设 v9 已切到 onchain**。

如 Codex 跑 B.0 前发现 v9 types 切换有其他下游 import 依赖（如 stage marker label / display name dict / icon assignment 还引用 sentiment）→ [SPEC-FEEDBACK]，不自行猜。

### 7.2 Adapter 主流程

**`src/lib/watch/v9TopicAdapter.ts`**：

```ts
export interface V9AdapterContext {
  events: PublicTimelineEvent[];
  evidenceMap: Record<string, NewsEvidence>;
  marketSnapshot?: MarketTickerPayload;
  followStats: Record<string, { watchCount: number; followCount: number; userFollowed: boolean }>;
  now: number;
  locale: Locale;
}

export function mapPublicTimelineEventsToTopics(ctx: V9AdapterContext): DispatchTopic[] {
  // 1. 聚合：events filter kind="pm_decision" → 按 symbol 聚合（用 topicAggregator）
  const grouped = groupByTopic(ctx.events);

  // 2. 每组生成 1 个 DispatchTopic
  return grouped.map(({ symbol, decisions, latestDecision }) => ({
    id: makeTopicId(symbol, latestDecision.id),
    symbol,
    status: deriveTopicStatus(latestDecision, ctx.now),
    title: makeTitle(symbol, latestDecision, ctx.evidenceMap),
    originalUrl: pickOriginalUrl(latestDecision, ctx.evidenceMap),
    // ⚠️ v2.1：DispatchTopic 没有 source 字段，adapter 不输出
    startedAt: formatTime(latestDecision.ts, ctx.locale),
    progress: makeProgress(latestDecision, ctx.now),
    intensity: calculateIntensity(latestDecision, ctx.evidenceMap),
    trigger: makeTrigger(symbol, latestDecision, ctx.evidenceMap),
    stages: makeStages(latestDecision),
    messages: makeMessages(latestDecision, ctx),
    strategy: makeStrategy(latestDecision, ctx),
    defaultCollapsed: deriveTopicStatus(latestDecision, ctx.now) !== "active",
  }));
}
```

### 7.3 makeMessages 子流程

```ts
function makeMessages(rec: PublicTimelineEvent, ctx: V9AdapterContext): DispatchMessage[] {
  if (rec.payload.kind !== "pm_decision") return [];
  const { rationaleByMember, citationsByMember, recordId } = rec.payload;
  const result: DispatchMessage[] = [];

  // Stage 1: 4 analyst → 4 messages
  const stage1Agents: TeamMemberId[] = ["fundamental_analyst", "news_analyst", "chart_analyst", "onchain_analyst"];
  stage1Agents.forEach((memberId, idx) => {
    const rationale = rationaleByMember[memberId];
    if (!rationale) return;  // 不 fake
    result.push({
      id: `${recordId}:stage-1:${memberId}`,
      stageId: "stage-1",
      agentId: TEAM_MEMBER_TO_DISPATCH_AGENT[memberId],
      agentName: getAgentDisplayName(memberId, ctx.locale),
      time: formatTime(rec.ts + idx * 1000, ctx.locale),  // 加 idx*1s 让顺序自然
      dataAge: formatDataAge(rec.ts, ctx.now),
      mentions: [],
      quote: undefined,
      content: rationale,
    });
  });

  // Stage 2: research_lead → 1 message（不拆多空）
  if (rationaleByMember.research_lead) {
    result.push({
      id: `${recordId}:stage-2:research_lead`,
      stageId: "stage-2",
      agentId: "bullish_researcher",  // 用 bullish 渲染（视觉上有差异，但语义保持中立）
      agentName: getAgentDisplayName("research_lead", ctx.locale),
      time: formatTime(rec.ts + 4000, ctx.locale),
      mentions: [],
      content: rationaleByMember.research_lead,
    });
  }

  // Stage 3: trader（从 tradeDecision 派生）
  if (rec.payload.tradeDecision) {
    result.push({
      id: `${recordId}:stage-3:trader`,
      stageId: "stage-3",
      agentId: "trader",
      agentName: getAgentDisplayName("trader_synthesized", ctx.locale),
      time: formatTime(rec.ts + 5000, ctx.locale),
      mentions: [],
      content: makeTraderContent(rec.payload.tradeDecision, ctx.locale),
    });
  }

  // Stage 4: risk_lead → 1 message（不拆三派）
  if (rationaleByMember.risk_lead) {
    result.push({
      id: `${recordId}:stage-4:risk_lead`,
      stageId: "stage-4",
      agentId: "neutral_reviewer",
      agentName: getAgentDisplayName("risk_lead", ctx.locale),
      time: formatTime(rec.ts + 6000, ctx.locale),
      mentions: [],
      content: rationaleByMember.risk_lead,
    });
  }

  // Stage 5: PM final（如 tradeDecision 已确定）
  if (rec.payload.tradeDecision && rec.payload.tradeDecision.direction) {
    result.push({
      id: `${recordId}:stage-5:pm`,
      stageId: "stage-5",
      agentId: "portfolio_manager",
      agentName: getAgentDisplayName("pm", ctx.locale),
      time: formatTime(rec.ts + 7000, ctx.locale),
      mentions: [],
      content: makePmContent(rec.payload.tradeDecision, ctx.locale),
    });
  }

  // Stage 6: memory_loop（如 resolvedAt 不为 null）
  // - 这层目前 publicTimelineEvent 没暴露 resolvedAt → adapter 暂时跳过 stage-6
  // - 或从 evidenceMap 推断（如果 recent similar symbol decision 有 hit_tp / hit_sl 历史）

  return result;
}
```

### 7.4 makeStages

```ts
function makeStages(rec: PublicTimelineEvent): DispatchStageMarker[] {
  if (rec.payload.kind !== "pm_decision") return [];
  const { rationaleByMember, tradeDecision } = rec.payload;
  const has = (k: TeamMemberId) => Boolean(rationaleByMember[k]);

  const stages: DispatchStageMarker[] = [
    { id: "stage-1", label: "阶段 1 · 信息收集", status: hasAllAnalysts(rationaleByMember) ? "done" : (hasAnyAnalyst(rationaleByMember) ? "active" : "pending") },
    { id: "stage-2", label: "阶段 2 · 多空辩论", status: has("research_lead") ? "done" : "pending" },
    { id: "stage-3", label: "阶段 3 · 交易方案", status: tradeDecision ? "done" : "pending" },
    { id: "stage-4", label: "阶段 4 · 风险审查", status: has("risk_lead") ? "done" : "pending" },
    { id: "stage-5", label: "阶段 5 · 最终决策", status: tradeDecision?.direction ? "final" : "pending" },
    { id: "stage-6", label: "阶段 6 · 复盘沉淀", status: "pending" },  // current schema 不暴露 resolution，永远 pending
  ];

  return stages;
}
```

### 7.5 Topic 聚合规则（B.4 关键设计点）

**`src/lib/watch/topicAggregator.ts`**：

```ts
export function groupByTopic(events: PublicTimelineEvent[]): Array<{
  symbol: string;
  decisions: PublicTimelineEvent[];
  latestDecision: PublicTimelineEvent;
}> {
  // 当前简化规则：1 个 symbol = 1 个 topic
  // 取该 symbol 最新 pm_decision event 作为 latestDecision
  // 同 symbol 多个 PM decision 时，旧的归 "decisions" 历史（暂时不在 v9 渲染历史，保留为 Phase B.7 扩展）

  // v2.1（Codex Q5 guidance）：30min 窗口同 symbol 合并 + 不跨 locale（adapter 接收的已是 per-locale events）
  const bySymbol = new Map<string, PublicTimelineEvent[]>();
  for (const ev of events) {
    if (ev.payload.kind !== "pm_decision") continue;
    // 兜底链：payload.symbol → tradeDecision.symbol → SKIP（dev 环境 log warn，prod 静默）
    const sym = ev.payload.symbol ?? ev.payload.tradeDecision?.symbol ?? null;
    if (!sym) continue;
    const arr = bySymbol.get(sym) ?? [];
    arr.push(ev);
    bySymbol.set(sym, arr);
  }

  return Array.from(bySymbol.entries()).map(([symbol, decisions]) => {
    const sorted = decisions.sort((a, b) => b.ts - a.ts);
    const latest = sorted[0];
    // v2.1：30min 窗口内同 symbol 的旧 decision 视为同一 active topic 的历史，不渲染独立卡片
    // 窗口外的旧 decision 也保留在 decisions 数组中（备 B.7 后续历史 wall 用），但 Phase B 只渲染 latest
    const THIRTY_MIN = 30 * 60 * 1000;
    const withinWindow = sorted.filter((d) => Math.abs(latest.ts - d.ts) <= THIRTY_MIN);
    return {
      symbol,
      decisions: sorted,                    // 完整历史，供后续 history wall
      decisionsInWindow: withinWindow,      // 30min 同 active topic 内的 round
      latestDecision: latest,               // 唯一渲染为 DispatchTopic 的 decision
    };
  });
}
```

**Follow stats 绑定纪律（Q5）**：follow stats key 用 `latestDecision.payload.recordId`，**不用** symbol 聚合。新 PM decision 触发新 recordId → follow stats 从 0 开始，不继承旧值。否则会"老决策的关注度继承到新决策"。

**不跨 locale 合并**：adapter 接收的 events 已是 per-locale（v3 立的 per-locale KV）；adapter 层不做 cross-locale merge。

**未来扩展**：30min 窗口内的多 decision 渲染为同 topic 的多 round（Phase B 暂不做，B.5 stage-6 留 TODO）。

### 7.6 Intensity 算法（B.3 关键设计点 — v2 修订，依赖 grep 校准）

**`src/lib/watch/intensityCalculator.ts`**：

> **Codex 实施前 Q（双脑必答）**：`PublicTimelineEvent` 顶层是否有 `importance` 字段？`evidenceIds` 字段在 event 顶层还是 payload 内？`evidenceMap[id]` 返回的 NewsEvidence 是否有 `severity` 字段（low/medium/high/critical 或类似）？三个字段名以 main HEAD `src/lib/watch/publicTimelineEvent.ts` 实测为准。下面伪代码用占位字段名，Codex grep 后用实际字段名替换 + 写到 codex-to-claude.md。

```ts
export function calculateIntensity(
  rec: PublicTimelineEvent,
  evidenceMap: Record<string, NewsEvidence>,
): number {  // 输出 1-5
  if (rec.payload.kind !== "pm_decision") return 1;

  let score = 0;

  // 因素 1: 事件本身 importance（如 event 顶层有 importance 字段）
  // ⚠️ Codex grep 确认：rec.importance 是否真存在
  // 如不存在：从关联 newsEvidence 取 max severity 折算
  // const importanceScore = { low: 0, medium: 1, high: 2, critical: 3 }[rec.importance ?? "low"];
  // score += importanceScore;
  const evidenceList = (rec.evidenceIds ?? rec.payload.citationsByMember ? collectEvidenceIds(rec) : []);
  const maxSeverity = evidenceList
    .map((id) => evidenceMap[id]?.severity)
    .filter(Boolean)
    .reduce((max, cur) => severityScore(cur) > severityScore(max) ? cur : max, "low");
  score += severityScore(maxSeverity);

  // 因素 2: confidence 反映共识度（低 confidence = 辩论激烈 = intensity 高）
  if (rec.payload.tradeDecision) {
    const conf = rec.payload.tradeDecision.confidence ?? 0.5;
    if (conf < 0.5) score += 1;
  }

  // 因素 3: 关联 news evidence 数量
  if (evidenceList.length >= 3) score += 1;

  // clamp to 1-5
  return Math.max(1, Math.min(5, Math.round(score + 1)));
}

function severityScore(s: string | undefined): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[s ?? "low"] ?? 0;
}

function collectEvidenceIds(rec: PublicTimelineEvent): string[] {
  // Codex grep 后确认正确路径：评估顶层 evidenceIds vs payload.citationsByMember 拍扁
  if (rec.payload.kind !== "pm_decision") return [];
  const fromCitations = Object.values(rec.payload.citationsByMember ?? {}).flat();
  return Array.from(new Set(fromCitations));
}
```

**Codex 责任**：实施前用 1 条真 pm_decision event 跑出 score 看是否落在 1-5 合理区间；如算法严重偏向 1 或 5 → 调权重并报告。

### 7.7 makeStrategy（v2 修订 — 用真实 TradeDecision 字段名）

```ts
function makeStrategy(rec: PublicTimelineEvent, ctx: V9AdapterContext): DispatchStrategy {
  if (rec.payload.kind !== "pm_decision" || !rec.payload.tradeDecision) {
    return makePendingStrategy(rec, ctx);
  }
  const td = rec.payload.tradeDecision;
  // ⚠️ v2.1 修订（Codex Q9 [SPEC-FEEDBACK]）：以下字段类型必须严格匹配 main HEAD 实际定义
  // ⚠️ td.direction 只能是 "long" | "short" | "wait"（不是 "neutral"）
  // ⚠️ td.entryRange 是 **`{ low: number; high: number } | null`**（**对象，不是 tuple [number, number]**）
  // ⚠️ td.entryPrice 是 number（可选）
  // ⚠️ td.takeProfit 是 number[]（**单数 + 数组**，不是 takeProfits）
  // ⚠️ td.stopLoss 是 number（可选）
  // ⚠️ td.confidence 是 number 0-1（可选）
  // ⚠️ evaluationWindowEndsAt 不在 payload —— 按 Q-C 拍板 (a)，Phase B 跳过 expiryNote
  const followStat = ctx.followStats[rec.payload.recordId] ?? { watchCount: 0, followCount: 0, userFollowed: false };

  return {
    action: deriveAction(td.direction),  // "long" | "short" | "wait" → 同名直通；tradeDecision=null 时 makePendingStrategy 返回 "pending"
    actionLabel: makeActionLabel(td.direction, td.confidence ?? null, ctx.locale),
    name: followStat.userFollowed ? "已开仓" : "本次决策",
    // symbol 从 payload.symbol 直读（B.0 升级 publicTimelineProjection 后 payload 含 symbol）
    // 兜底 tradeDecision.symbol —— B.0 落地前的过渡期（兜底链见 Q7 contract test 要求）
    ticker: `$${rec.payload.symbol ?? td.symbol ?? "??"}`,
    meta: makeStrategyMeta(td, rec, ctx),
    entry: formatEntry(td.entryRange ?? null, td.entryPrice ?? null) ?? "待定",
    stopLoss: td.stopLoss != null ? formatPrice(td.stopLoss) : "待定",
    takeProfit: formatTakeProfitArray(td.takeProfit ?? null) ?? "待定",
    follow: {
      primaryLabel: followStat.userFollowed ? "已跟单" : "我跟了",
      primaryDisabled: followStat.userFollowed,
      secondaryLabel: followStat.userFollowed ? "查看详情" : "我没跟",
      watchCount: followStat.watchCount,
      followCount: followStat.followCount,
      // expiryNote 暂时不输出（Q-C 拍板 (a)）；后续 spec 暴露 evaluationWindowEndsAt 后再补
      expiryNote: undefined,
    },
  };
}

// helper：entryRange 对象 OR entryPrice 单数 → display string
// v2.1：entryRange 是 { low, high } 对象，不是 tuple
function formatEntry(range: { low: number; high: number } | null, single: number | null): string | null {
  if (range) {
    return `${formatPrice(range.low)} - ${formatPrice(range.high)}`;
  }
  if (single != null) return formatPrice(single);
  return null;
}

// helper：takeProfit number[] → "X / Y / Z" display
function formatTakeProfitArray(arr: number[] | null): string | null {
  if (!arr || arr.length === 0) return null;
  return arr.map(formatPrice).join(" / ");
}
```

### 7.8 Follow stats KV store（B.7 关键设计点）

**KV key 结构**（v2.1 — counter key / set key 分离 + anon id 哈希）：
- counter key: `claw42:watch:follow-stats:counter:v1:<recordId>` → `{ watchCount, followCount, updatedAt }`
- set key: `claw42:watch:follow-stats:set:v1:<recordId>` → Set of `hash(anonId + serverSalt)` （Redis SADD / ZADD）
- 分离原因：避免单 JSON 热 key 竞态；counter 用 atomic INCR；set 用 SADD 幂等

**value** 示例（counter）:
```json
{
  "watchCount": 77,
  "followCount": 18,
  "updatedAt": 1747100000000
}
```

**幂等链路**：
1. POST `{recordId, action:"follow"}` → 服务端 hash anonId + salt
2. SADD set key → return 0 表示已存在（不递增 counter）/ 1 表示新增（INCR counter）
3. 不存原始 anon id（隐私），不暴露 set 内容（API 只返回 counts + 当前 user followed boolean）

**API**:
- `GET /api/watch/follow-stats?recordIds=id1,id2,id3` → 返回 `{ [recordId]: { watchCount, followCount, userFollowed } }`
- `POST /api/watch/follow-stats` body `{ recordId, action: "follow" }` → 增加 followCount，给 anon userId 标记 followed
- `userFollowed` 基于 anon userId cookie 判断（不强制登录）

**注意**：跟单按钮当前 Q4 拍板 = 占位（不真执行交易），但 follow count 是真增加（**社交证明数据**，让用户看到"已有 X 人跟单"提升信任）。

### 7.9 fallback 行为

如 `events` 为空（KV 没数据 / pipeline 没触发）：
- adapter 返回 `[]`
- MarketAnalysisView 渲染"暂无热点辩论"占位（**新增组件**：保持 chat-shell 容器视觉 + 内容区一个友好提示）
- **不**回退到 fixture data（避免 prod 误显示 fixture）

如 `STAGING_USE_FIXTURE === "true"`（staging 环境）：
- 加载 fixture KV record（v3.5 立的机制）→ events 含 fixture pm_decision
- adapter 正常跑，渲染 fixture 数据驱动 v9 UI
- 这样 staging 即使 KV 没真 record 也能展示 demo

---

## 8. 具体要求（B.0-B.9 拆分）

### B.0 Schema 契约对齐（必须最先做，v2 新增 — Codex 评估硬要求）

**目的**：把 spec v1 隐含的 6 个 schema 假设跟 main HEAD 实际状态对齐。**所有后续 sub-phase 都基于本节落盘后的状态**。

**0.1 publicTimelineEvent payload 加 symbol（Q-B 拍板 (a)）**
- 改 `src/lib/watch/publicTimelineEvent.ts`：`pm_decision` payload 加 `symbol: string`（非 optional —— projection 永远能从 record.symbol 直读）
- 加 schemaVersion bump 或 backward-compat 处理（旧 KV 数据没 symbol 字段 → adapter 兜底链 `payload.symbol ?? tradeDecision.symbol ?? null`，老数据 graceful skip）

**0.2 publicTimelineProjection 写入 symbol**
- 改 `src/lib/watch/publicTimelineProjection.ts`：`derivePmDecisionProcess()`（或等价函数）里 `payload.symbol = record.symbol`
- 测：写入路径 + 读出路径都覆盖 symbol 字段

**0.3 v9 contract 切 sentiment → onchain（Q-A 拍板 (a)）**
- 改 `src/modules/agent-watch/v9/types.ts`：`DispatchAgentId` union 把 `sentiment_analyst` 改为 `onchain_analyst`
- 改 `src/modules/agent-watch/v9/fixtureData.ts`：4 个 fixture topic 中所有 `sentiment_analyst` 引用切到 `onchain_analyst`（含 agentId / agentName / 任何 stage label 文字暗示 sentiment 的内容）
- grep 验证：`grep -rn "sentiment_analyst" src/modules/agent-watch/v9/` 应返回空
- 视觉验证：v9 fixture 模式下 screenshot diff vs v3.7 baseline → mean_abs_rgb < 5（**只换 agent 名称不换 avatar / 颜色 / 布局**，所以视觉应几乎不变；如 sentiment 有独立 icon class → 一起切到 onchain icon）

**0.4 evaluationWindowEndsAt / resolvedAt / resolvedOutcome（Q-C 拍板 (a) — 短期跳过）**
- Phase B 不暴露这三个字段到 payload
- 加 TODO 注释指向 future spec
- adapter 内 expiryNote = undefined / memory_loop stage 永 pending

**验收**：
- [ ] `payload.symbol` 在 pm_decision payload 上是 required string（tsc 通过）
- [ ] projection 写入 symbol 后，curl `/api/watch/timeline` 返回的 pm_decision events 含 symbol 字段
- [ ] v9 fixture grep 无 sentiment_analyst 残留
- [ ] v9 fixture class / CSS / layout 0 改动；text-only delta 允许（Q8 visual threshold caveat）
- [ ] 老 KV 数据（v3.7 写的 fixture KV 没 symbol）adapter 兜底链能 graceful skip 不抛错
- [ ] **v2.1 新增（Codex Q9.5）**：`src/lib/watch/publicTimelineProjection.test.ts`（或同等 test 文件）的所有 pm_decision 用例都更新，验证输出 payload 含 symbol；任何 saved fixture snapshot 同 commit 更新，避免 TypeScript 过但 API shape 静默 regress
- [ ] **v2.1 新增（Codex Q7）**：adapter 加一条 contract test：模拟 pre-B.0 event（无 `payload.symbol` 但含 `tradeDecision.symbol`）→ 验证 adapter 兜底到 tradeDecision.symbol 正常输出 topic；再模拟 payload.symbol + tradeDecision 都缺失 → 验证 graceful skip + dev warn

**约束**：B.0 是 schema 升级，**单独 commit**，后续 B.1+ 都 rebase 在 B.0 之上。

---

### B.1 Safe message formatter + MessageBubble XSS 修复（v2 新增 — Codex 评估硬要求）

**目的**：v9 当前 `MessageBubble.tsx` 用 `dangerouslySetInnerHTML` 渲染 fixture 的预定义 HTML。Phase B 数据切到真 LLM 输出后，rationale 字段可能包含用户可控（或 LLM 注入）的 `<script>` / `<img onerror>` / `<iframe>` 等 → **XSS 高危**。必须在接 adapter 真数据前先修。

**1.1 新建 `src/lib/watch/safeMessageFormatter.ts`**

```ts
// 输入：LLM 原始 rationale 文本（不可信）
// 输出：React.ReactNode（仅含允许的 inline 标签：strong / em）

import React from "react";

// 极简 markdown-lite：仅识别 **bold** 和 _italic_（adapter-owned token）
// 所有 HTML 标签字符（<>&"'）全 escape，禁止 raw HTML
export function formatSafeContent(raw: string): React.ReactNode {
  if (!raw) return null;
  // 先 escape 所有 HTML 危险字符
  const escaped = escapeHtml(raw);
  // 再 parse adapter-owned token（**bold** / _italic_）
  // 返回 ReactNode 数组
  return parseInlineTokens(escaped);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// parseInlineTokens 把 escaped 字符串切片 + 包 React strong / em 节点
function parseInlineTokens(escaped: string): React.ReactNode[] {
  // 实现细节：正则匹配 \*\*(.+?)\*\* 和 _(.+?)_，切片后 map 成 ReactNode
  // 详细实现 Codex 写；单测覆盖：纯文本 / 含 ** / 含 < / 含 <script> / 含 emoji / RTL 字符
  // 关键约束：返回的 React 树不允许任何 dangerouslySetInnerHTML
  return [];  // Codex 实施
}
```

**1.2 改 `src/modules/agent-watch/v9/MessageBubble.tsx`**
- 删除 `dangerouslySetInnerHTML` 用法
- import + 调用 `formatSafeContent(message.content)` → 渲染返回的 ReactNode
- **v2.1 性能要求（Codex Q9.3）**：`MessageBubble` 用 `React.memo` 包裹；`formatSafeContent(message.content)` 用 `useMemo([message.content])` 缓存。原因：父组件 DispatchConsoleV9 有 topbar clock state 每秒 tick，不 memo 会导致整个消息树每秒重 parse
- fixture 兼容：fixture 当前用 `<b>` 标签 → B.1 同 commit 把 fixture 的 `<b>foo</b>` 全切到 `**foo**` token（Codex 确认当前 fixture 无 token 边界，必须显式转换）

**1.3 Parser 行为约束（Codex Q6）**
- 不做递归 / 嵌套解析（v1 简化）：`**foo _bar_ baz**` 渲染为单个 strong 节点 + 内部 `_bar_` 当字面值
- 未闭合 `**` 保留为字面字符（不抛错）
- HTML 字符**始终** escape，永远不接受 raw `<b>` / `<script>` / `<img onerror>` / `iframe` / 任何 attributes
- newline 处理：用 React `<br />` 或 CSS `white-space: pre-wrap`，**不**注入 raw HTML
- RTL / Arabic：React text + `<strong>` 节点天然 OK，**不**注入 `dir` span（除非真观察到 bidi bug）

**1.4 单测**
- `safeMessageFormatter.test.ts` 覆盖：
  - `<script>alert(1)</script>` 输入 → 输出 escaped 文本，无 <script> DOM 节点
  - `**bold**` 输入 → 输出 React `<strong>` 节点
  - `<img src=x onerror=alert(1)>` 输入 → escaped
  - 未闭合 `**foo bar`（无 closing）→ 输出 `**foo bar` literal
  - 嵌套 `**foo _bar_ baz**` 边界 → strong wraps literal `_bar_`
  - emoji / RTL / 中文 / 长文本（>500 char）
  - 性能：连续 100 条 message 渲染时 parse 总时延 < 50ms（间接测 memo 有效）

**1.5 视觉验证**
- screenshot diff vs v3.7 baseline 同 chat 区块 → 文本内容只有 token 切换（`<b>` → `**`）+ B.0 sentiment→onchain 切换，class/CSS 不变
- 允许阈值放宽：text-only delta 即使 mean_abs_rgb 超阈也算通过（文字差异本来就会变 pixel）—— **但 class/CSS/layout 必须 0 改动**

**验收**：
- [ ] `MessageBubble.tsx` grep `dangerouslySetInnerHTML` 为空
- [ ] safeMessageFormatter 单测全过（含 XSS payload 6+ 条 + 未闭合 ** + 嵌套 + RTL）
- [ ] `MessageBubble` 用 React.memo（grep 验证）
- [ ] `formatSafeContent` 调用点用 useMemo（grep 验证）
- [ ] v9 fixture 视觉 baseline：class diff = 0、CSS diff = 0、layout shift = 0（文字 delta 允许）

---

### B.2 角色映射 + 字典
- 实施 `src/lib/watch/dispatchAgentMapping.ts`（按 §7.1）
- 加 i18n display name（10 locale 全覆盖，v3 立的 dict path）
- 单测：每个映射 round-trip 一致

### B.3 Intensity 算法
- 实施 `src/lib/watch/intensityCalculator.ts`（按 §7.6）
- **前置**：Codex grep 确认 `PublicTimelineEvent.importance` / `evidenceIds` / `NewsEvidence.severity` 真实字段名，写到 codex-to-claude.md
- 单测：边界（critical news → 4-5 / low importance → 1 / 高 confidence → 偏低 等）

### B.4 Topic 聚合（v2.1 — Codex Q5）
- 实施 `src/lib/watch/topicAggregator.ts`（按 §7.5）
- B.0 落地后 `inferSymbol = ev.payload.symbol`（兜底 tradeDecision.symbol，再兜底 skip）
- 30min 窗口内同 symbol 的多 decision → 同一 active topic（只渲染 latest，旧的入 `decisionsInWindow`）
- 跨 locale 不合并（adapter 接收的已是 per-locale events）
- Follow stats key 用 `latestDecision.recordId`（不用 symbol，避免老决策关注度继承）
- 单测：
  - 多 symbol → 多 topic
  - 同 symbol 同 30min 窗口多 decision → 1 topic，rendered = latest
  - 同 symbol 跨 30min 窗口 → 仍只渲染最新（旧的进 `decisions` 历史数组）
  - 无 symbol（payload.symbol 缺失 + tradeDecision=null）→ skip + dev warn
  - 跨 locale events 混入（不应发生，但加防御测）→ adapter 不做合并

### B.5 Adapter 主流程
- 实施 `src/lib/watch/v9TopicAdapter.ts` 主 `mapPublicTimelineEventsToTopics`（按 §7.2-§7.7）
- 子函数：`makeStages` / `makeMessages` / `makeStrategy` / `makeTrigger` / `deriveTopicStatus`
- `makeStrategy` 内用 §7.7 v2 修订版字段名（entryRange / entryPrice / takeProfit / direction wait）
- `makeMessages` 内 stage-6 永远不输出 message（Q-C 拍板）
- **首件检验**：跑 1 条真 staging KV 的 pm_decision event → adapter 输出 1 个 DispatchTopic → 用 v9 fixture 视觉对照（不要求像素一致，看结构对不对：6 stages / 4-5 messages / strategy 字段都有值）
- 单测：fixture record → fixture topic round-trip

### B.6 Memory loop 派生（暂时跳过 stage-6 message）
- adapter `makeMessages` 中 stage-6 永远不输出 message
- `makeStages` 中 stage-6 永远 status="pending"
- 加 TODO 注释指向后续 spec（依赖 publicTimelineEvent payload 暴露 resolvedAt / resolvedOutcome）

### B.7 Follow stats KV + API（v2.1 修订 — Codex Q4 + Q9.4 guidance）
- 实施 `src/lib/watch/followStatsStore.ts`（KV wrapper：counter key / set key 分离避免单 JSON 热 key 竞态）
- 实施 `/api/watch/follow-stats/route.ts` GET + POST：
  - `export const runtime = "nodejs"`（不用 Edge，对齐 timeline / KV helpers / cookie 处理）
  - rate limit 用现有 `src/lib/storage/kv-rate-limiter.ts` 的 `checkRateLimit()`，**不用** `src/lib/auth/rate-limiter.ts`（stub，永远返回 `{ ok: true }`）
  - 不引入 `@upstash/ratelimit` 等新依赖（@vercel/kv helpers 已够）
  - rate key 同时含 IP + anon id：
    - `watch-follow:ip:<ip>`
    - `watch-follow:anon:<anonId>`
    - 可选 `watch-follow:record:<recordId>:anon:<anonId>`（per-record 幂等）
- userFollowed cookie 名 `claw42-anon-id`，7 天 TTL
- **幂等性**：同一 anonId 对同一 recordId 第二次 POST 不增加 followCount（不只是 rate limit，是 storage 层去重）
- **隐私**：不存原始 anon id；存 `hash(anonId + 服务端 stable salt)`，set key 内只存 hash。API 返回只含 counts + 当前用户 followed boolean，不暴露 set 内容
- 单测：concurrent update / cookie missing / rate limit / 同 anonId 二次点击不递增 / hash 一致性

### B.8 AgentWatchBoard 集成（v2.1 修订 — Codex Q3 polling guidance）
- `AgentWatchBoard.tsx` 改：
  - **新增** `/api/watch/timeline` polling：
    - 用 `setTimeout` 循环（每次成功 fetch 后用返回的 `nextPollMs` 调度下一次），**不用** `setInterval`
    - 服务端 `nextPollMs` 当前是 30_000 或 90_000，客户端尊重服务端
    - 每次 fetch 用 `AbortController` 包裹，locale 切换 / 组件卸载 时 abort，避免 state 竞态
  - **新增** `/api/watch/follow-stats` polling：
    - 默认 60s（不是 30s）—— 30s only 在 market tab 可见 + 有可见 topics 时启用
    - 用 `document.visibilityState`：tab 隐藏时暂停 / 降为 5min；`visibilitychange` 回可见 → 立即 refetch
    - POST 后做 optimistic local update + 立即 refetch（不等下一个 poll cycle）
    - 多 tab：用 `BroadcastChannel`（或 `localStorage` event）跨 tab 同步 POST 结果，避免每个 tab 都打 30s 请求；不用做完整 leader election
  - 调用 `mapPublicTimelineEventsToTopics()` 生成 topics
  - 传 topics 给 `<DispatchConsoleV9 topics={topics} />`
- `DispatchConsoleV9.tsx` 改：
  - 添加 `topics?: DispatchTopic[]` prop
  - 未传 / 空数组 → fallback 渲染"暂无热点"占位（**保持 chat-shell 容器视觉**）
  - 传 topics → 传给 MarketAnalysisView
  - **v2.1 性能要求（Codex Q9.3）**：当前 DispatchConsoleV9 有 `clock` state 每秒 tick → 把 clock 拆出为独立 `<Clock />` 子组件，或对 MarketAnalysisView/ChatShell/MessageBubble 加 React.memo。目的：clock tick 不应导致 topics 树重 render（真 LLM 长文本 rationale 重 parse 代价大）
- `MarketAnalysisView.tsx` 改：
  - 接 topics prop，渲染 topic 列表
  - 空数组 → 友好占位（chat-shell 内一句"AI 团队正在等待新热点..."+ 灰色 icon）
  - 用 React.memo 包裹（Codex Q9.3 — clock 隔离的兜底）
- `fixtureData.ts` 重命名 const 为 `FIXTURE_TOPICS_V9_DEV` + 加文档注释（dev 用，prod adapter 不消费）

### B.9 verify + staging
- 全 gate 通过（tsc / lint / build / verify:a11y / verify:metrics / vitest）
- screenshot diff vs v3.7 标杆（确保 UI 像素不变）
- staging deploy（**不带 STAGING_USE_FIXTURE**，跑真 KV record）—— 验证真 pipeline 接通
- 第二次 staging deploy（**带 STAGING_USE_FIXTURE**）→ 验证 fixture 模式仍正常工作（B.0 切 onchain 后视觉不裂）
- vercel curl 验证 `/api/watch/timeline` + `/api/watch/follow-stats` 返回正确 schema
- 如真 staging KV 没真 record → 跑 `trigger=now` 手动产 1 条 pm decision，验证 adapter 能渲染

---

## 9. 验收标准

### 编译 / Lint / Build
- [ ] `npx tsc --noEmit` PASS
- [ ] `npm run lint` PASS
- [ ] `MINIMAX_API_KEY=dummy DEEPSEEK_API_KEY=dummy npm run build` PASS
- [ ] `npm run verify:a11y` PASS（v9 a11y 标准不破坏）
- [ ] `npm run verify:metrics` PASS
- [ ] `npx vitest run` PASS（新加单测全过 + 现有测试不破坏）

### UI 零变化验证（关键约束 — v2.1 修订 per Codex Q8）
- [ ] screenshot diff vs v3.7 staging（claw42-site-dbx12thnj）desktop 1440×1000 / 1280×800
  - **硬阈值**：CSS / class / layout 0 改动（grep / 渲染 DOM tree diff = 0）
  - **软阈值**：mean_abs_rgb < 8、pixels_over_16 < 10%
  - **caveat**：B.0 sentiment→onchain 文字内容会变（"链上"vs"情感"），text-only delta 即使 mean_abs_rgb 超阈也算通过；icon / 颜色 / class / layout 必须严格 0 改动。如 Codex 发现 sentiment 有独立 avatar class（如 `a-sent`）→ B.0 必须把 onchain 复用同 class（除非 F 明确给出新 onchain 视觉 brief，否则视为 [SPEC-FEEDBACK]）
- [ ] v9 scoped CSS 一字不改（grep diff dispatchConsoleV9.module.css 改动 = 0 行）
- [ ] v9 组件树 export 接口不变（除 props 新增 topics + B.8 拆 Clock 子组件）

### 数据流验证
- [ ] staging（不带 STAGING_USE_FIXTURE）pull 真 pm_decision record → adapter 输出 topics → v9 渲染含真 rationale 内容
- [ ] staging（带 STAGING_USE_FIXTURE）跑 fixture record → adapter 输出 topics → 渲染与 fixture 语义一致
- [ ] follow stats POST → KV 增加 followCount → 下次 GET 返回新值
- [ ] userFollowed cookie 持久 7 天 → 二次访问看到"已跟单"状态

### Fallback / 错误处理
- [ ] events 为空 → "暂无热点"友好占位（不 crash / 不显示 fixture）
- [ ] adapter 内 schema mismatch → console.warn + skip 该条（不抛错）
- [ ] follow stats POST 网络错 → toast 提示 + 跟单状态不变

### 不破坏既有 gate
- [ ] v3.5 立的 `verify:chat-v3-final` PASS（Chat Authenticity Boundary 不破坏）
- [ ] v3.7 v9 a11y semantics 保留（aria-selected / aria-expanded / 键盘）

### Staging
- [ ] 自己跑 `npx vercel` 不带 --prod
- [ ] 自己跑 vercel curl 双 API 验证
- [ ] 自己跑 screenshot 对照 v9 mockup
- [ ] 报告 preview URL + diff 数据 + 真 vs fixture 切换验证

---

## 10. 约束

- **UI 视觉零变化**（screenshot diff 是硬 gate）
- **不动 v9 scoped CSS**（dispatchConsoleV9.module.css 一字不改）
- **不动 v3.7 立的 v9 组件树**（除 B.8 props 新增 topics + B.1 MessageBubble XSS 修复）
- **不升级 pipeline 后端**（pmDecisionPipeline / strategyDecisionRecord schema 不动）
- **publicTimelineEvent payload 允许小升级**（B.0 加 symbol 字段，projection 层补；不视为 pipeline 升级）
- **不升级 11 角色架构**（沿用 v3.5 7 角色）
- **不动 prod claw42.ai**
- **不动主 worktree**（30+ WIP 未清理，独立 feature worktree 跑）
- **跟单按钮不真执行交易**（点击 = follow stats POST + placeholder dialog，Q4 拍板不变）
- **任何 schema 字段名 / 文件路径不一致** → [SPEC-FEEDBACK]，不自行猜
- **任何冲突 / push 失败 / API 异常** → 立即停 + 报告

---

## 11. 拆 commit 顺序建议（v2 修订）

**顺序必须 B.0 → B.1 → ... 不可乱序**（B.0 是 schema 升级，B.1 是 XSS 修复，两者都是后续基础）。

1. **B.0**: schema 契约对齐 — publicTimelineEvent payload symbol / projection / v9 types & fixture sentiment→onchain（**单独 commit，后续 rebase 基础**）
2. **B.1**: safeMessageFormatter + MessageBubble 改 React 节点 + fixture `<b>`→`**bold**` token 同步 + 单测
3. **B.2**: dispatchAgentMapping + i18n display names + 单测
4. **B.3**: intensityCalculator + 单测（Codex grep 字段名前置确认）
5. **B.4**: topicAggregator + inferSymbol（用 B.0 后的 payload.symbol）+ 单测
6. **B.5**: v9TopicAdapter 主流程 + makeStages/makeMessages/makeStrategy（v2 字段名）/makeTrigger + 首件检验 + 单测
7. **B.6**: stage-6 memory_loop 占位 + TODO 注释
8. **B.7**: followStatsStore + /api/watch/follow-stats route + rate limit + 单测
9. **B.8**: AgentWatchBoard 加双 polling + DispatchConsoleV9 props + MarketAnalysisView topics + 占位组件 + fixtureData 重命名
10. **B.9**: verify gate + 双 staging deploy（带 / 不带 STAGING_USE_FIXTURE）+ 双 API curl + screenshot diff

每 commit 跑 `tsc --noEmit` + `npm run build` PASS（B.8 集成 commit 后跑 a11y）。
B.0 commit 后**必须**跑一次完整 vercel staging deploy 验证 schema 升级没破坏 v3.7 现有渲染。

---

## 12. 工作量预估（v2 修订）

| sub | 时间 |
|---|---|
| B.0 schema 契约对齐（payload symbol + projection + v9 types/fixture sentiment→onchain）| 1-1.5 |
| B.1 safeMessageFormatter + MessageBubble + fixture token 同步 | 1-1.5 |
| B.2 角色映射 + i18n | 0.5-1 |
| B.3 intensity（含 grep 校准）| 0.5-1 |
| B.4 topic aggregator | 0.5-1 |
| B.5 adapter 主流程 + 首件检验 | 2-3 |
| B.6 memory_loop 占位 | 0.25 |
| B.7 follow stats KV + API | 1-1.5 |
| B.8 集成 + 双 polling + 占位组件 + fixture 重命名 | 1.5-2 |
| B.9 verify + 双 staging + screenshot diff | 1-1.5 |
| **总计** | **9.25-14.25 AI 天**（取整 **10-14**）|

v2 比 v1 多 2 AI 天（B.0 schema 升级 + B.1 XSS 修复），这是 Codex 评估对齐的必要工作量，不是返工。
v2.1 在 v2 基础上加约 0.5-1 AI 天（B.1 memo 化 + B.7 anon id hash + B.0 contract test + B.8 Clock 拆分 + BroadcastChannel）—— 这些是工程细节，不改主流程。**总计 10-15 AI 天**。

---

## 13. 给 Codex 的双脑判断点（v2.1 状态）

**第 1 轮（v1 → v2）**：Q1 / Q2 resolved by Q-B 拍板 (a)。
**第 2 轮（v2 → v2.1）**：Q3 / Q4 / Q5 / Q6 / Q7 / Q8 / Q9 全部 Codex 评估完毕，建议已并入对应 sub-phase + §7。下方保留原 Q 供历史索引；实施时直接看 B.0-B.9 + §7 即可。

按 CLAUDE.md 双脑诊断纪律，Codex 实施前必须自己下判断 + 写到 codex-to-claude.md：

### ✅ Q1（已 resolved by Q-B 拍板 (a)）
~~PM tradeDecision.symbol 字段是否真存在~~ — Codex 评估确认存在；且 Q-B 拍板 publicTimelineEvent payload 加 symbol 字段。adapter 用 `payload.symbol ?? tradeDecision.symbol`。

### ✅ Q2（已 resolved by Q-B 拍板 (a)）
~~pm_decision payload 怎么关联 symbol~~ — B.0 升级 publicTimelineProjection 直接写 `payload.symbol = record.symbol`。

### ✅ Q3（resolved v2.1，guidance 进 B.8）
timeline 用 `setTimeout` 循环 + 服务端 `nextPollMs` + `AbortController`；follow-stats 60s 默认，可见 + 有 topics 时 30s，hidden tab 暂停/5min，`visibilitychange` 立即 refetch；多 tab 用 `BroadcastChannel`。

### ✅ Q4（resolved v2.1，guidance 进 B.7）
用现有 `src/lib/storage/kv-rate-limiter.ts` 的 `checkRateLimit()`，**不用** `src/lib/auth/rate-limiter.ts`（stub）。`/api/watch/follow-stats/route.ts` 设 `runtime = "nodejs"`，rate key 含 IP + anon id 双维度。不引入 `@upstash/ratelimit`。

### ✅ Q5（resolved v2.1，guidance 进 §7.5 + B.4）
30min 窗口内同 symbol 视为同 active topic（渲染 latest，旧 decision 入 `decisionsInWindow`）。不跨 locale 合并（adapter 接收 per-locale events）。Follow stats key 用 `latestDecision.recordId`，**不用** symbol（避免老决策关注度继承到新决策）。

### ✅ Q6（resolved v2.1，guidance 进 B.1）
fixture 当前用 `<b>` 标签，无 `**bold**` token boundary —— B.1 显式转换。Parser 容错：未闭合 `**` 保留 literal、不递归嵌套、HTML 字符始终 escape、newline 用 `<br />`/`white-space: pre-wrap`、RTL 不注入 `dir` span。性能：`MessageBubble` 用 `React.memo` + `formatSafeContent()` 用 `useMemo`。

### ✅ Q7（resolved v2.1，guidance 进 B.0）
不需要 migration script。adapter 兜底链 `payload.symbol ?? tradeDecision.symbol ?? null` 保留；null 时 skip + dev warn。Public payload type 在 B.0 后可标 required，但 adapter 运行时仍兼容老 JSON / 测试快照 / preview。加 contract test（pre-B.0 event 含 tradeDecision.symbol 但无 payload.symbol → 兜底成功）。

### ✅ Q8（resolved v2.1，caveat 进 §9）
sentiment → onchain 必须复用同 avatar class / size / spacing / grid（如当前 sentiment 用 `a-sent`，onchain 复用同 class）。Text-only delta 即使 mean_abs_rgb 超阈也算通过，但 CSS / class / layout 严格 0 改动。如发现 sentiment 有独立 icon / 色 / class → [SPEC-FEEDBACK]（除非 F 给新 onchain 视觉 brief）。

### ✅ Q9（resolved v2.1，F missed angle 全部并入）
Codex 在 v2.1 第 2 轮评估中识别的 5 个 angle：
1. [SPEC-FEEDBACK] `entryRange` 类型对象 vs tuple → §1.1 / §7.7 / §2.3 修
2. [SPEC-FEEDBACK] `DispatchTopic` 无 `source` 字段 → §1.2 / §7.2 修
3. Clock-induced render churn → B.1 + B.8 加 memo / Clock 拆分要求
4. Follow stats 隐私 → §7.8 + B.7 改 hash(anonId + salt)
5. API contract test → B.0 验收新增 `publicTimelineProjection.test.ts` 更新 + adapter pre-B.0 兜底 test

### 实施前最后一道 Codex check（v2.1 新增）
Codex 实施前最后一次跑：
- [ ] `cat src/lib/team/tradeDecision.ts` 确认 `entryRange` 是对象不是 tuple（spec §1.1 / §7.7 一致）
- [ ] `cat src/modules/agent-watch/v9/types.ts` 确认 `DispatchTopic` 没有 `source` 字段
- [ ] `cat src/lib/storage/kv-rate-limiter.ts` 确认 `checkRateLimit()` 签名（B.7 引用对齐）
- [ ] `cat src/modules/agent-watch/v9/DispatchConsoleV9.tsx` 确认 clock 是组件级 state（B.8 拆 Clock 子组件能切到独立 render scope）

如任一项与 spec 不一致 → 写 [SPEC-FEEDBACK] 到 codex-to-claude.md，**不**自行猜。

---

## 14. Phase B 之后剩余 work（独立 spec）

本 spec 不实施但需要后续推进：

- **Phase B.2（独立 spec）**：pipeline 升级输出 multi-round debate trace + record schema 加 `rounds: []` → v9 多轮辩论真升级
- **Phase 6a**：11 角色架构重设（sentiment / 多空 researcher / 三派 reviewer / trader 拆出）+ 翻译模式
- **Phase B.3（独立 spec）**：跟单按钮真接 CoinW API（合规 + 用户授权 + 法律 review）
- **Phase B.4（独立 spec）**：mobile responsive（v9 当前 desktop-only）
- **Phase B.5（独立 spec）**：实时更新升级（polling → SSE / WebSocket）+ typing 真信号
- **Phase B.6（独立 spec）**：memory_loop 真实施（record resolvedAt / resolvedOutcome 暴露到 event payload）

---

## 老板简报

这次把"AI 团队工作台"从演示数据切换为真实运转：每个热点卡片里的分析师发言、综合判断、风险审查、最终决策，都换成系统真在跑的 AI 输出。视觉一个像素都不变（之前定的 v9 设计不动），用户感觉跟之前一样，只是数据从"样本"换成"实时"。

同时做了两件用户能感觉到的事：第一，给"我跟了"按钮加跟单计数，点了之后能看到"已有 X 人跟单"（先做社交证明，真实交易接入留给后续接 CoinW API 的法务流程做）；第二，给真实 AI 输出加了一层内容安全过滤，确保 LLM 写出来的内容不会破坏页面或被恶意构造文本利用——这是切换到真实数据流的前提。

下一步是把团队内部多轮辩论也接进来（看多 vs 看空多轮反驳、激进 vs 保守的真实分歧），那个需要后端 AI 流水线本身升级，独立推进。
