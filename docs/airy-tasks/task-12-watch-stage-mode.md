# [DEPRECATED] Task 12 v1 — Watch 页面舞台模式重构（Stream → Stage）

> ⚠️⚠️⚠️ **本方案已废止，不实施**。Dan 在 2026-04-29 下午二次拍板"还是恢复 stream，但要重新设计"。
>
> **当前生效方案**：`task-12-watch-stream-redesign.md`（v2）
>
> **本文件保留作为决策路径历史档案**，让后续 session 知道"为什么没走 stage mode 这条路"。Codex 实施时**不要看本文件**，只看 v2。
>
> 以下原始 v1 spec 内容保留，仅供回溯参考。

---

## ~~原始内容（已废止）~~

> **核心决策（2026-04-29 Dan 拍板）**：watch 页面从"消息日志流"改成"实时舞台"。task-11 v1.4 中围绕 stream 设计的 M11/M14/M18/M19/M21 整体作废，task-09 落地的 sedimentation 数据继续用（作为折叠历史数据源）。
>
> **执行者**：Codex
>
> **基于**：task-11 v1.3 中**非 stream 项**已落地（M7 涨绿跌红 / M8 头像 / M9 当前关注 / M10 severity 高亮 / M12 文案 / M13 USDT 取消 / M15 hero 回归 / M16 hover / M17 click）+ task-09 v1.1 信号沉淀
>
> **新分支**：从 `feature/act1-5-watch-sedimentation-01` 分出 `feature/act1-5-watch-stage-mode-01`
>
> **PR target**：`feature/act1-5-watch-page-01`（不变）
>
> **作废**：task-11 中 M11（撤 stream system msg，因为 stream 整个删）/ M18（消息流 accent bar，转用到焦点卡副响应）/ M19（删 LIVE chip，新设计本不需要）/ M21（信号→派别路由用途变更，从 stream 触发变 currentView 触发）

---

## 1. 设计原理：从"日志"到"舞台"

**旧模式（stream）**：消息按时间顺序流式追加，3 个 Agent 对每个信号同步发言，stream 越滚越长。问题：节奏均匀，无重心，3 派内容同质化。

**新模式（stage）**：watch 页变成"3 派当前在做什么判断"的实时舞台。

- 顶部：3 张实时观点卡（覆盖式更新，每派只显示当前最新观点）
- 中部：焦点事件卡（仅在集体信号/高 severity/派别冲突时出现）
- 底部：折叠历史按钮（默认折叠，展开看 stream 历史）

**类比**：交易室不是 3 个交易员一直说话，是大部分时间盯屏，关键时刻一个人开口，其他人补两句。stage 模式就是把"盯屏"和"开口"两个状态在 UI 上做出区分。

---

## 2. 页面布局

```
┌─────────────────────────────────────────────────┐
│ Hero · Live · 加密市场 · subtitle               │  ← task-11 v1.1 M2 落地，不动
├─────────────────────────────────────────────────┤
│ Ticker（主流 BTC/ETH/SOL + 热门 + 机会）         │  ← v1.3 M13 落地
├─────────────────────────────────────────────────┤
│ 跑马灯（市场信号，severity 分级高亮）             │  ← v1.4 M10 落地
├─────────────────────────────────────────────────┤
│ ┌─AgentCardStage─┐ ┌─AgentCardStage─┐ ┌────┐    │  ← 新组件
│ │ Alpha 突破派    │ │ Beta 趋势派     │ │... │    │
│ │ [发言中]        │ │ [观察中]        │ │    │    │
│ │ 当前关注 PUMP   │ │ 当前关注 ETH    │ │    │    │
│ │ "PUMP 先看..."  │ │ "ETH 暂时..."   │ │    │    │
│ │ 触发: ...       │ │ 触发: ...       │ │    │    │
│ │ ▸ 失效         │ │ ▸ 失效          │ │    │    │
│ │ 16:21 更新      │ │ 16:23 更新      │ │    │    │
│ └────────────────┘ └────────────────┘ └────┘    │
├─────────────────────────────────────────────────┤
│ ┌─FocusEventCard（条件出现）────────────────────┐ │  ← 新组件
│ │ ⚡ 集体信号 · 16:26                            │ │
│ │ BTC/ETH/SOL 同时测压前高                       │ │
│ │ ────────────────                              │ │
│ │ Alpha 主响应（大气泡，3-5 句）                  │ │
│ │ Beta · 1-2 句副响应                            │ │
│ │ Gamma · 1-2 句副响应                           │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ [展开历史 (12)] ─ 折叠按钮                       │  ← 新组件
└─────────────────────────────────────────────────┘
```

---

## 3. 三个核心组件

### 3.1 AgentCardStage（3 张实时观点卡）

**数据模型**：

```ts
// src/lib/types.ts 新增
export type AgentCardView = {
  agentId: "alpha" | "beta" | "gamma";
  status: "silent" | "observing" | "speaking" | "alert";
  currentSymbol: string; // 当前关注 symbol
  judgment: string; // 主判断 1-2 句
  trigger: string; // 触发条件
  invalidation: string; // 失效条件
  lastUpdateAt: number; // unix ms
  evidenceSignalIds: string[]; // 关联的信号 ids
};
```

**状态 chip 逻辑**：

| status      | 触发条件                                             | 视觉                    |
| ----------- | ---------------------------------------------------- | ----------------------- |
| `silent`    | 60min 内无信号触发更新                               | 灰色 dot + "静默"       |
| `observing` | 5min 内有 low severity 信号但未触发 currentView 更新 | 橙 dot + "观察中"       |
| `speaking`  | 60s 内刚完成 currentView 更新                        | 派别色 dot + "发言中"   |
| `alert`     | 5min 内 high severity 信号 ≥ 3 条                    | 红 dot pulse + "高警戒" |

**更新触发机制**：

```ts
// src/lib/agentViewGenerator.ts 新建
async function maybeUpdateCardView(
  agentId: AgentId,
  newSignal: SignalRecord,
  prevView: AgentCardView,
): Promise<AgentCardView | null> {
  // 1. 派别路由匹配（task-11 M21 的路由表）
  if (!matchesFaction(agentId, newSignal.type)) return null;

  // 2. severity 门槛（low 不触发）
  if (newSignal.severity === "low") return null;

  // 3. 60s 限频
  if (Date.now() - prevView.lastUpdateAt < 60_000) return null;

  // 4. LLM 生成新 currentView（Prompt A）
  const newView = await llmGenerateCardView({
    agent: AGENT_PROFILES[agentId],
    signal: newSignal,
    previousView: prevView,
    marketContext: getMarketContext(),
  });

  return { ...newView, lastUpdateAt: Date.now() };
}
```

**UI 结构**：

```tsx
// src/modules/agent-watch/components/AgentCardStage.tsx 新建
<div
  className={clsx(
    "relative rounded-2xl border bg-white/[0.02] p-4",
    "border-white/[0.08] hover:border-[var(--agent-color-faint)]",
    "transition-all duration-300",
    isJustUpdated && "animate-pulse-border", // 边框 pulse 派别色 150ms
  )}
>
  {/* 左侧 2px accent bar 派别色 */}
  <span
    className="absolute bottom-3 left-0 top-3 w-[2px] rounded-full"
    style={{ background: AGENT_COLOR_TOKEN[agentId] }}
  />

  <header className="mb-2 flex items-center gap-2">
    <AgentAvatar agentId={agentId} className="h-14 w-14" />
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <span className="font-semibold">{agent.name}</span>
        <span className="text-xs text-white/50">{agent.faction}</span>
        <StatusChip status={view.status} />
      </div>
      <div className="text-xs text-white/40">
        {t.watch.agentCard.focusLabel}{" "}
        <span className="font-mono text-white/85">{view.currentSymbol}</span>
        <span className="ml-2">{formatTime(view.lastUpdateAt)} 更新</span>
      </div>
    </div>
  </header>

  <p className="mb-2 text-sm text-white/85">{view.judgment}</p>

  <div className="text-xs">
    <div className="mb-1 flex gap-2">
      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-white/60">触发</span>
      <span className="text-white/70">{view.trigger}</span>
    </div>
    <details className="text-white/40">
      <summary className="cursor-pointer">▸ 失效条件</summary>
      <p className="ml-2 mt-1">{view.invalidation}</p>
    </details>
  </div>
</div>
```

**过渡动画**（CSS keyframes）：

```css
/* globals.css 新增 */
@keyframes pulse-border {
  0% {
    border-color: var(--agent-color-faint);
  }
  50% {
    border-color: var(--agent-color);
    box-shadow: 0 0 8px var(--agent-color-glow);
  }
  100% {
    border-color: var(--agent-color-faint);
  }
}
.animate-pulse-border {
  animation: pulse-border 600ms ease-out;
}
```

### 3.2 FocusEventCard（焦点事件卡）

**触发条件**（`src/lib/focusEventDetector.ts` 新建）：

```ts
type FocusEventType = "collective" | "high_severity" | "faction_conflict";

function detectFocusEvent(
  signals: SignalRecord[],
  cardViews: Record<AgentId, AgentCardView>,
): FocusEvent | null {
  // 1. 集体信号：≥3 个 symbol 同向异动 30s 内
  const recent = signals.filter((s) => Date.now() - s.ts < 30_000);
  const symbols = uniqBy(recent, "s.symbol");
  if (symbols.length >= 3 && allSameDirection(symbols)) {
    return { type: "collective", signals: recent };
  }

  // 2. 单点 high severity（仅主流 BTC/ETH/SOL）
  const highSev = recent.find((s) => s.severity === "high" && MAJOR_SYMBOLS.includes(s.symbol));
  if (highSev) return { type: "high_severity", signals: [highSev] };

  // 3. 派别冲突：≥2 派对同一 symbol 给出方向相反判断
  const conflict = detectFactionConflict(cardViews);
  if (conflict) return { type: "faction_conflict", conflict };

  return null;
}
```

**生命周期**：

| 阶段     | 持续                | 行为                                                 |
| -------- | ------------------- | ---------------------------------------------------- |
| 出现     | 触发即显示          | fade-in 300ms                                        |
| 持续     | 3min 内有新焦点事件 | 切换到新焦点（旧 fade-out 200ms → 新 fade-in 300ms） |
| 折叠     | 3min 无新事件       | 高度 → 32px，显示 "暂无焦点 · 静默 5min"             |
| 重新展开 | 折叠后再有事件      | 折叠条 → 完整卡，300ms ease                          |

**主/副响应派别选择**：

| 焦点 type          | 主派别                                                        | 副派别                          |
| ------------------ | ------------------------------------------------------------- | ------------------------------- |
| `collective`       | 信号 type 路由表选主（多个信号 type 时按 high severity 优先） | 其他 2 派                       |
| `high_severity`    | 按信号 type 路由                                              | 其他 2 派                       |
| `faction_conflict` | 意见最强烈的派别（用 LLM 评估）                               | 冲突的另 1 派 + 第 3 派中立观察 |

**UI 结构**：

```tsx
// src/modules/agent-watch/components/FocusEventCard.tsx 新建
<div className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.03] p-4">
  <header className="mb-3 flex items-center gap-2">
    <span className="text-amber-400">⚡</span>
    <span className="text-sm font-semibold">{focusTypeLabel(event.type)}</span>
    <span className="font-mono text-xs text-white/40">{formatTime(event.ts)}</span>
  </header>

  <p className="mb-3 text-sm text-white/85">{event.summary}</p>

  <div className="space-y-2">
    {/* 主响应：大气泡 */}
    <PrimaryResponse agentId={event.primaryAgent} content={event.primaryContent} />

    {/* 副响应：1-2 行短评 */}
    {event.echoes.map((echo) => (
      <EchoResponse key={echo.agentId} agentId={echo.agentId} content={echo.content} />
    ))}
  </div>
</div>
```

`PrimaryResponse` 用派别色 accent bar + 正常气泡（task-11 v1.4 M18 设计转用到这里）。`EchoResponse` 是 1-2 行 chip，淡色，前缀派别名 + dot：`Beta · 趋势没破，认同 Alpha 等回踩`。

### 3.3 CollapsedHistory（折叠历史）

```tsx
// src/modules/agent-watch/components/CollapsedHistory.tsx 新建
<div className="mt-6 border-t border-white/[0.06] pt-4">
  <button
    onClick={() => setExpanded(!expanded)}
    className="text-sm text-white/50 hover:text-white/70"
  >
    {expanded ? t.watch.history.collapseLabel : `${t.watch.history.expandLabel} (${historyCount})`}
  </button>

  {expanded && (
    <div className="mt-4 max-h-[480px] overflow-y-auto">
      <Tabs
        tabs={[
          { id: "timeline", label: t.watch.history.tabTimeline },
          { id: "faction", label: t.watch.history.tabFaction },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {tab === "timeline" && <TimelineView messages={messages} />}
      {tab === "faction" && <FactionAggregateView aggregates={aggregates} />}
    </div>
  )}
</div>
```

**Tab 1（时间流）**：复用 task-09 sedimentation buffer 的原文消息，倒序排列。每条用简化版 MessageBubble（删派别色 glow，应用 v1.4 M18 accent bar 样式）。

**Tab 2（派别聚合）**：每 5min 1 条派别综合判断，3 列布局（Alpha / Beta / Gamma），每列内时间倒序。聚合数据来自 task-09 `llmHistorySummary.ts`（已落地）。

---

## 4. 数据流

```
信号源（marketSignals.ts，已落地）
   │
   ├─ 跑马灯（已落地，task-11 M10）
   │
   ├─ AgentViewGenerator（新建）
   │    每信号 → 路由匹配派别 → severity 门槛 → 60s 限频
   │    → LLM Prompt A → 新 currentView（覆盖式存到 state）
   │
   ├─ FocusEventDetector（新建）
   │    每信号 + 当前 cardViews → 检测集体/高 severity/派别冲突
   │    → 触发时调 LLM Prompt B (主) + Prompt C (副)
   │    → 新 focusEvent 显示在中央卡（覆盖式）
   │
   └─ HistorySedimentation（task-09 已落地）
        ring buffer 持续累积 → CollapsedHistory 展开时读取
```

**关键点**：currentView 和 focusEvent 都是**覆盖式**state（不是 array），新值替换旧值。stream 形式只在折叠历史里保留（来自 sedimentation）。

---

## 5. LLM Prompt 分层

`src/lib/llmFallbackChain.ts` 修改，新增 3 套 prompt：

### Prompt A — 派别 currentView 生成

```
你是 [派别名]·[Agent 人设]。基于以下输入，生成你对当前市场的最新判断。

[新信号]
type: NEAR_HIGH
symbol: BTC
severity: high
description: BTC 距前高 0.42%，正在测压

[你上一条 currentView]
symbol: PUMP
judgment: PUMP 先看关键位和放量确认...

[全局市场上下文]
主流：BTC/ETH/SOL 测压前高
机会：BLEND +162%, PUMP +7.78%

请输出 JSON：
{
  "currentSymbol": "...",
  "judgment": "1-2 句主判断，必须基于实际信号",
  "trigger": "1 句触发条件",
  "invalidation": "1 句失效条件",
  "evidenceSignalIds": ["sig_xxx"]
}

约束：
- 不能脱口而出"可能"、"建议"、"或许"
- judgment 必须引用具体 symbol 和数据点，不能空谈
- 派别人设保持稳定（Alpha 突破/Beta 趋势/Gamma 极端）
```

### Prompt B — 焦点事件主响应（单派别长气泡）

```
你是 [主派别]，焦点事件触发你出来主讲。

[焦点事件]
type: collective
symbols: BTC, ETH, SOL
description: 三个主流币 30s 内同时测压前高

[你的 currentView]
...

请输出 3-5 句主判断，必须：
- 引用具体信号 ids
- 给出明确观点（不是"可能"、"建议"）
- 派别口诀可用但 5min 内只用 1 次（避免复读）
- 字数 80-150
```

### Prompt C — 焦点事件副响应（副派别短评）

```
你是 [副派别]，[主派别] 刚说完话，你补 1-2 句。

[主响应]
"ETH 先盯 5m 放量和前高反应..."

请输出 1-2 句副响应，必须：
- 不复读主响应内容
- 给出本派别独特角度（认同/补充/反驳/中立观察）
- 字数 20-40
- 格式：「[派别角度词] [短判断]」例："趋势没破，认同 Alpha 等回踩"
```

---

## 6. 文件结构

### 新建（5 个）

```
src/lib/agentViewGenerator.ts          # currentView 生成器
src/lib/focusEventDetector.ts          # 焦点事件检测
src/modules/agent-watch/components/AgentCardStage.tsx       # 升级版 RowCard
src/modules/agent-watch/components/FocusEventCard.tsx       # 焦点卡
src/modules/agent-watch/components/CollapsedHistory.tsx     # 折叠历史
```

### 修改（6 个）

```
src/modules/agent-watch/AgentWatchBoard.tsx    # 整体 layout 重构（删 stream 渲染，加 stage 三组件）
src/lib/llmFallbackChain.ts                    # 加 3 套 prompt（A/B/C）
src/lib/types.ts                               # AgentCardView / FocusEvent 类型
src/i18n/types.ts                              # 新 i18n key
src/i18n/dicts/*.json                          # 10 语 dict 同步
src/app/globals.css                            # pulse-border keyframes
```

### 删除（2 个）

```
src/modules/agent-watch/components/MessageStream.tsx        # stream 整删
src/modules/agent-watch/components/AgentRowCard.tsx         # 由 AgentCardStage 替代
```

注：v1.4 设计的 `SystemSignalBubble.tsx` 已在 v1.2 M11 删除。

### 保留（task-09 沉淀数据）

```
src/lib/signalBuffer.ts                # ring buffer，作为折叠历史 Tab1 数据源
src/lib/llmHistorySummary.ts           # 派别聚合摘要，作为 Tab2 数据源
```

### 注意：v1.4 M18 设计转用

原 v1.4 M18 设计的"消息流 accent bar"代码仍有用——直接搬到 `FocusEventCard.tsx` 内的 `PrimaryResponse` + `EchoResponse` 组件。

---

## 7. i18n 新增 key

```ts
// src/i18n/types.ts 新增
watch: {
  // ... 已有
  agentCard: {
    statusSilent: '静默',
    statusObserving: '观察中',
    statusSpeaking: '发言中',
    statusAlert: '高警戒',
    focusLabel: '当前关注',
    triggerLabel: '触发',
    invalidationLabel: '失效条件',
    updateAtSuffix: '更新',
  },
  focusCard: {
    typeCollective: '集体信号',
    typeHighSeverity: '关键事件',
    typeFactionConflict: '派别分歧',
    folded: '暂无焦点 · 静默 {minutes}min',
  },
  history: {
    expandLabel: '展开历史',
    collapseLabel: '收起历史',
    tabTimeline: '时间流',
    tabFaction: '派别聚合',
  },
}
```

10 语 dict 全部同步翻译。

---

## 8. 验收清单

### 8.1 AgentCardStage（3 张观点卡）

- [ ] 3 张卡片横向并排，单卡 ≤ 240px 高
- [ ] 头像 56px（task-11 M8 落地保留）
- [ ] 状态 chip 4 种（silent/observing/speaking/alert）按规则切换
- [ ] 卡片内容覆盖式更新，不追加（grep 确认无 `setCardViews((prev) => [...prev, ...])` 这种 append 模式）
- [ ] 60s 内同派别多个信号只触发 1 次更新
- [ ] severity=low 信号不触发更新
- [ ] 派别路由表生效：BREAKOUT/NEAR_HIGH/NEAR_LOW → Alpha；EMA_CROSS/VOLUME_SPIKE → Beta；RANGE_CHANGE → Gamma
- [ ] 更新时 pulse-border 动画 600ms 派别色
- [ ] 失效条件默认折叠（`<details>`）
- [ ] last update 时间戳显示 HH:MM 格式
- [ ] 派别色仅在头像光晕 + 左 2px accent bar 出现，卡片主体灰白（不"花"）

### 8.2 FocusEventCard（焦点卡）

- [ ] 集体信号触发：≥3 个 symbol 同向异动 30s 内
- [ ] 高 severity 触发：BREAKOUT/NEAR_HIGH/NEAR_LOW 在主流 BTC/ETH/SOL
- [ ] 派别冲突触发：≥2 派对同一 symbol 给出方向相反判断
- [ ] 主响应是大气泡（80-150 字），含派别 accent bar
- [ ] 副响应 2 条，每条 1-2 行（20-40 字），格式 `[派别名] · [短判断]`
- [ ] 副响应不复读主响应内容（LLM 验证 + 长度门槛）
- [ ] 焦点事件 3min 无新事件 → 折叠成 1 行 "暂无焦点 · 静默 5min"
- [ ] 折叠条 click 不展开（仅显示状态）
- [ ] 新焦点切入：旧 fade-out 200ms → 新 fade-in 300ms

### 8.3 CollapsedHistory（折叠历史）

- [ ] 默认折叠，按钮显示 "展开历史 (N)"
- [ ] N = 过去 30min 内 Agent 发言总数（来自 task-09 sedimentation）
- [ ] click 展开，按钮变 "收起历史"
- [ ] 双 tab：「时间流」/「派别聚合」
- [ ] Tab1 倒序排列消息，复用 MessageBubble 简化版（无派别色 glow）
- [ ] Tab2 三列布局，每列时间倒序
- [ ] 展开区域 max-height: 480px，超出滚动
- [ ] 关闭后下次 mount 仍默认折叠（不持久化展开状态）

### 8.4 整体页面

- [ ] AgentWatchBoard.tsx 不再渲染 MessageStream（grep 确认）
- [ ] 首屏不出现"消息流"形态，只有 3 卡 + 焦点卡（条件出现）+ 历史按钮
- [ ] task-11 v1.3 已落地的非 stream 项保留：M7（涨绿跌红）/ M8（头像）/ M9+M12（当前关注）/ M10（severity 高亮）/ M13（USDT 取消）/ M15（hero 回归）/ M16（hover）/ M17（click）
- [ ] task-11 v1.4 中作废项不残留：MessageStream.tsx 已删（grep 无引用）/ AgentRowCard.tsx 已删（被 AgentCardStage 替代）

### 8.5 数据层

- [ ] task-09 signalBuffer.ts ring buffer 仍持续接收信号（作为 Tab1 数据源）
- [ ] task-09 llmHistorySummary.ts 仍生成派别聚合（作为 Tab2 数据源）
- [ ] 新建 agentViewGenerator.ts 60s 限频生效（dev mode 验证连续多信号只触发 1 次 LLM 调用）
- [ ] 新建 focusEventDetector.ts 不会同一事件触发 2 次（去重 by event id）
- [ ] LLM 调用频率不超预期：每派 currentView ≤1次/min + 焦点事件 ≤1次/3min

---

## 9. 提交命令

```sh
# 从 v1.3 已落地的非 stream 项分支分出新分支
git checkout feature/act1-5-watch-sedimentation-01
git pull origin feature/act1-5-watch-sedimentation-01
git checkout -b feature/act1-5-watch-stage-mode-01

# 实施 task-12 全量改动（一次大 commit 或拆分阶段，Codex 自决）

# 阶段 1：数据层（不破坏现有渲染）
git add src/lib/types.ts src/lib/agentViewGenerator.ts src/lib/focusEventDetector.ts src/lib/llmFallbackChain.ts
git commit -m "feat(stage): add card view + focus event data layer (task-12 stage 1)

- AgentCardView type: covering current state per faction (replaces append-only message stream)
- agentViewGenerator: severity gate + 60s rate limit + faction routing (M21 reused)
- focusEventDetector: collective / high-severity / faction-conflict triggers
- LLM prompts A/B/C: card view + primary response + echo response"

# 阶段 2：UI 组件
git add src/modules/agent-watch/components/AgentCardStage.tsx \
        src/modules/agent-watch/components/FocusEventCard.tsx \
        src/modules/agent-watch/components/CollapsedHistory.tsx \
        src/app/globals.css
git commit -m "feat(stage): add stage-mode UI components (task-12 stage 2)

- AgentCardStage: covering-update card with status chip + accent bar + pulse animation
- FocusEventCard: amber-themed focus event with primary + echo responses, 3min collapse
- CollapsedHistory: default-collapsed, dual tab (timeline / faction aggregate)
- pulse-border keyframe animation in globals.css"

# 阶段 3：整合 + 删除旧
git rm src/modules/agent-watch/components/MessageStream.tsx \
       src/modules/agent-watch/components/AgentRowCard.tsx
git add src/modules/agent-watch/AgentWatchBoard.tsx \
        src/i18n/types.ts \
        src/i18n/dicts/*.json
git commit -m "refactor(stage): replace stream with stage layout (task-12 stage 3)

- AgentWatchBoard: drop MessageStream + AgentRowCard, render 3 AgentCardStage + FocusEventCard + CollapsedHistory
- Removed: MessageStream.tsx (stream model deprecated)
- Removed: AgentRowCard.tsx (replaced by AgentCardStage)
- i18n 10 locales: agentCard / focusCard / history sections added
- task-09 signalBuffer + llmHistorySummary kept as CollapsedHistory data source"

git push origin feature/act1-5-watch-stage-mode-01
```

新建 PR：`feature/act1-5-watch-stage-mode-01` → `feature/act1-5-watch-page-01`

---

## 10. 风险与边界

| 风险                  | 说明                                        | 缓解                                                                                                 |
| --------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| LLM 成本翻倍          | currentView + 焦点事件主+副各 1 次 LLM 调用 | currentView 60s 限频 + focusEvent 3min 内不重复触发；按当前信号频率估算每小时增加 ~30 次调用，可接受 |
| 派别冲突检测过敏      | 任何 currentView 不同就当冲突               | 必须方向相反（看涨/看跌）+ 同 symbol，强度门槛                                                       |
| 折叠历史数据滞后      | sedimentation buffer 24h 滚动               | OK，本来就不是实时主区，30min 视图够用                                                               |
| 用户首次看页面"很空"  | 3 张卡刚启动可能都是 silent                 | 启动时调用 LLM 生成初始 currentView（基于当前信号快照）                                              |
| stream 用户习惯被打断 | 部分用户可能习惯滚动看消息                  | 折叠历史里保留时间流 tab，按需展开                                                                   |

---

## 11. 与既有任务的依赖

**前置依赖**（必须先合入）：

- task-11 v1.3 非 stream 项已落地：M7/M8/M9/M10/M12/M13/M15/M16/M17
  - 这些是当前 PR #16 内容，等 PR #16 merge 到 `feature/act1-5-watch-page-01` 后再开 task-12 工作

**作废**：

- task-11 v1.4 M11/M14/M18/M19/M21（围绕 stream 的设计）
- task-11 v1.4 中"撤掉 stream system msg"已被"删整个 stream"覆盖

**保留并强化**：

- task-09 数据沉淀（buffer + summary）作为折叠历史数据源
- task-11 M21 信号→派别路由表（在 agentViewGenerator 复用）

---

_维护者: F_
_创建: 2026-04-29_
_执行者: Codex_
_基于: task-11 v1.3 非 stream 项 + task-09 数据沉淀_
_分支: feature/act1-5-watch-stage-mode-01（从 sedimentation-01 分出）_
_PR target: feature/act1-5-watch-page-01（不变）_
