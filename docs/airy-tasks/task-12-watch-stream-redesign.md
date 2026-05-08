# Task 12 — Watch Stream 重新设计（v2，2026-04-29）

> **决策迭代记录**：上午 Dan 拍板 stage mode（推翻 stream），下午 Dan 二次拍板"还是恢复 stream，但要重新设计"。**stage mode 方案作废**（保留在 `task-12-watch-stage-mode.md` 备案，不实施），本文件是 v2 当前生效方案。
>
> **执行者**：Codex
>
> **基于**：task-11 v1.3 非 stream 项已落地（M7/M8/M9/M10/M12/M13/M15/M16/M17）+ task-09 sedimentation
>
> **新分支**：从 PR #16 merge 后的 `feature/act1-5-watch-page-01` 分出 `feature/act1-5-watch-stream-redesign-01`
>
> **PR target**：`feature/act1-5-watch-page-01`（不变）
>
> **作废**：
>
> - task-11 v1.4 M11（撤 stream system msg）/ M14（重复 bug 转用途）/ M18-M21（部分作废、部分转用途）—— 见 §10
> - task-12 v1（stage mode）整体废止

---

## 1. 设计原理：保留 stream，但加两层关键约束

**当前 stream 的三个根因病**：

1. **Agent 被迫发言**：每个信号都触发 LLM 生成判断，即使没东西可说也强行编造空话
2. **3 派同步刷屏**：每个信号触发所有 3 派同步发言，stream 一波 3 条
3. **节奏均匀化**：发言节奏过于稳定，缺呼吸感（少了不行多了不行）

**v2 的三个对应约束**：

1. **agentSpeechGuard 前置过滤**：LLM 调用前先 evaluate 信号——派别匹配 + severity ≥ medium + 60s 限频，三个条件都满足才调用 LLM；不满足就直接静默
2. **派别路由 + 集体事件分流**：单一信号只触发对应派别（M21 路由）；多 symbol 同向异动时升级为"集体事件卡"，3 派各发短评
3. **事件卡引入戏剧节奏**：3 类事件卡（集体/焦点/冲突）作为 stream 内特殊条目，平时静默 + 事件爆发，节奏曲线自然形成

**类比**：交易室 + 突发事件——平时各自盯屏（stream 稀疏 Agent 独白），重大事件触发时几个人同时围过来讨论（事件卡多派响应）。

---

## 2. Stream 内容模型（混合条目）

```ts
// src/lib/types.ts 新增
export type StreamEntry =
  | { kind: "agent_message"; data: AgentMessage }
  | { kind: "collective_event"; data: CollectiveEvent }
  | { kind: "focus_event"; data: FocusEvent }
  | { kind: "conflict_event"; data: ConflictEvent };

export type AgentMessage = {
  id: string;
  ts: number;
  agentId: "alpha" | "beta" | "gamma";
  content: string;
  triggerSignalId: string; // 必须有触发信号，无则不应存在
};

export type CollectiveEvent = {
  id: string;
  ts: number;
  symbols: string[]; // ≥3
  direction: "up" | "down";
  description: string;
  primaryResponse: { agentId: AgentId; content: string };
  echoResponses: Array<{ agentId: AgentId; content: string }>; // 长度 2
};

export type FocusEvent = {
  id: string;
  ts: number;
  symbol: string; // 仅主流币
  signalType: SignalType;
  severity: "high";
  description: string;
  primaryResponse: { agentId: AgentId; content: string };
};

export type ConflictEvent = {
  id: string;
  ts: number;
  symbol: string;
  conflictingAgents: [AgentId, AgentId]; // 给方向相反判断的 2 派
  responses: Array<{ agentId: AgentId; content: string }>; // 至少 2 派对话
};
```

Stream 渲染时按 `ts` 倒序排列，不同 kind 用不同 React 组件渲染（同一 stream 视觉容器）。

---

## 3. agentSpeechGuard：真实性前置过滤（**核心**）

```ts
// src/lib/agentSpeechGuard.ts 新建
type SpeechCheckResult =
  | { shouldSpeak: false; reason: "no_match" | "low_severity" | "rate_limited" }
  | { shouldSpeak: true; trigger: SignalRecord };

export function checkAgentSpeech(
  agentId: AgentId,
  recentSignals: SignalRecord[], // 最近 30s 信号
  lastSpokeAt: number,
): SpeechCheckResult {
  // 1. 60s 限频
  if (Date.now() - lastSpokeAt < 60_000) {
    return { shouldSpeak: false, reason: "rate_limited" };
  }

  // 2. 派别匹配（M21 路由表）
  const matched = recentSignals.filter((s) => matchesFaction(agentId, s.type));
  if (matched.length === 0) {
    return { shouldSpeak: false, reason: "no_match" };
  }

  // 3. severity 门槛（low 不发言）
  const eligible = matched.filter((s) => s.severity !== "low");
  if (eligible.length === 0) {
    return { shouldSpeak: false, reason: "low_severity" };
  }

  // 4. 选最强信号作为触发器
  const trigger = eligible.sort(
    (a, b) => severityWeight(b.severity) - severityWeight(a.severity),
  )[0];

  return { shouldSpeak: true, trigger };
}

const FACTION_SIGNAL_MATCH: Record<AgentId, SignalType[]> = {
  alpha: ["BREAKOUT", "NEAR_HIGH", "NEAR_LOW"],
  beta: ["EMA_CROSS", "VOLUME_SPIKE"],
  gamma: ["RANGE_CHANGE"],
};
```

**调用流程**：

```ts
// AgentWatchBoard 内或 polling loop
for (const agentId of ["alpha", "beta", "gamma"] as const) {
  const result = checkAgentSpeech(agentId, recentSignals, lastSpokeAt[agentId]);
  if (!result.shouldSpeak) continue; // 不调用 LLM，跳过

  const message = await llmGenerateAgentMessage(agentId, result.trigger);
  appendStreamEntry({ kind: "agent_message", data: message });
  lastSpokeAt[agentId] = Date.now();
}
```

**关键纪律**：`checkAgentSpeech` 返回 `shouldSpeak: false` 时**绝不调用 LLM**——这是真实性的硬门槛。LLM 拿到的输入永远是有真实信号触发的，不存在"无信号但被迫生成"的场景。

---

## 4. 三类事件卡触发逻辑

```ts
// src/lib/eventDetectors.ts 新建
export function detectCollectiveEvent(
  recentSignals: SignalRecord[],
): Pick<CollectiveEvent, "symbols" | "direction" | "description"> | null {
  const within30s = recentSignals.filter((s) => Date.now() - s.ts < 30_000);
  const grouped = groupBy(within30s, "s.direction");

  for (const [direction, sigs] of Object.entries(grouped)) {
    const uniqSymbols = uniq(sigs.map((s) => s.symbol));
    if (uniqSymbols.length >= 3) {
      return {
        symbols: uniqSymbols,
        direction: direction as "up" | "down",
        description: formatCollectiveDescription(uniqSymbols, direction),
      };
    }
  }
  return null;
}

export function detectFocusEvent(
  recentSignals: SignalRecord[],
): Pick<FocusEvent, "symbol" | "signalType" | "severity" | "description"> | null {
  const focus = recentSignals.find(
    (s) =>
      s.severity === "high" &&
      MAJOR_SYMBOLS.includes(s.symbol) &&
      ["BREAKOUT", "NEAR_HIGH", "NEAR_LOW"].includes(s.type),
  );
  return focus
    ? {
        symbol: focus.symbol,
        signalType: focus.type,
        severity: focus.severity,
        description: focus.description,
      }
    : null;
}

export function detectConflictEvent(
  cardViews: Record<AgentId, AgentCardView>,
): Pick<ConflictEvent, "symbol" | "conflictingAgents"> | null {
  // ≥2 派对同 symbol 给方向相反判断
  const groups = groupByDirection(Object.values(cardViews));
  for (const symbol of getCommonSymbols(cardViews)) {
    const stances = getStances(cardViews, symbol);
    if (stances.up.length >= 1 && stances.down.length >= 1) {
      return { symbol, conflictingAgents: [stances.up[0], stances.down[0]] };
    }
  }
  return null;
}
```

**事件卡触发节奏**：

- 每个 detector 5min 内最多触发 1 个事件卡（去重 by signal-set 哈希）
- 同一时间 3 类事件卡可并存（不互斥）
- 集体事件触发后立即生成 1 主响应 + 2 副响应（LLM 调用 3 次）
- 焦点事件只生成 1 主响应（1 次 LLM 调用）
- 冲突事件生成 2 派对话（2 次 LLM 调用）

---

## 5. 三套 LLM Prompt（强制 cite + 真实性）

### Prompt A — Agent 独白发言

```
你是 [派别] · [人设]。

[触发信号]
type: NEAR_HIGH
symbol: BTC
severity: high
description: BTC 距前高 0.42% 正在测压
data: { current: 76820.85, previousHigh: 77150 }

输出 1-2 句分析气泡，必须：
- 引用 BTC 这个具体 symbol（不能换其他币）
- 引用具体数据（0.42% 距前高）
- 给出明确判断（不用"可能"/"建议"/"或许"等空词）
- 派别口诀本周内最多用 2 次
- 字数 30-80
- 派别人设保持稳定

只输出气泡内容文本，不要 JSON。
```

### Prompt B — 集体事件主响应

```
你是 [主派别]，刚检测到集体信号——3 个 symbol 30s 内同向异动。

[集体事件]
symbols: BTC, ETH, SOL
direction: up（同向上行）
signals: [...]

输出 3-5 句主判断，必须：
- 解释这种集体异动你怎么看（派别角度）
- 至少引用 2 个具体 symbol 和数据点
- 给出后续观察重点
- 字数 80-150
```

### Prompt C — 集体/冲突事件副响应

```
你是 [副派别]，[主派别 / 对立派别] 刚说完话，你补 1-2 句。

[他们说的]
"ETH 先盯 5m 放量和前高反应..."

输出 1-2 句副响应，必须：
- 不复读他们的内容
- 给本派别独特角度（认同/补充/反驳/中立观察）
- 字数 20-40
- 格式：「[短判断]」，无前缀
```

---

## 6. UI 渲染

### 6.1 顶部 3 张 AgentRowCard（保留 task-11 已落地设计，不改）

task-11 v1.3 的 AgentRowCard（横向 3 卡 + 头像 56px + 当前关注 + judgment + 触发 + 失效）保持不变。currentView 数据继续维护（用于派别冲突检测 + 状态 chip 计算），但 UI 不强制做覆盖式 pulse 动画——保持当前 task-11 静态显示即可。

### 6.2 Stream 区（新设计）

```tsx
// src/modules/agent-watch/components/Stream.tsx 替代旧 MessageStream
<div className="space-y-2">
  {entries.map((entry) => {
    switch (entry.kind) {
      case "agent_message":
        return <AgentMessageBubble key={entry.data.id} message={entry.data} />;
      case "collective_event":
        return <CollectiveEventCard key={entry.data.id} event={entry.data} />;
      case "focus_event":
        return <FocusEventCard key={entry.data.id} event={entry.data} />;
      case "conflict_event":
        return <ConflictEventCard key={entry.data.id} event={entry.data} />;
    }
  })}
</div>
```

**AgentMessageBubble**（task-11 v1.4 M18 设计转用）：

- 灰白主体 + 左 2px accent bar 派别色
- 无外发光、无 LIVE chip（M19）
- 头像 + 派别名 + 时间戳

**CollectiveEventCard**：

```
┌─ ⚡ 集体信号 · 16:26 ────────────────────┐
│ BTC/ETH/SOL 同时测压前高                  │
│ ──                                       │
│ Alpha · 主响应大气泡                      │
│ Beta  · 短评 1 行                         │
│ Gamma · 短评 1 行                         │
└─────────────────────────────────────────┘
背景：amber/[0.05]，左边框 amber/40
```

**FocusEventCard**（更紧凑）：

```
┌─ 🎯 关键事件 · 16:21 ────────────────┐
│ BTC NEAR_HIGH · 距前高 0.42% 正在测压 │
│ Alpha · 1-2 句主响应                  │
└─────────────────────────────────────┘
背景：白色 highlight，左边框 white/30
```

**ConflictEventCard**：

```
┌─ ⚔ 派别分歧 · 16:30 ───────────────┐
│ Alpha vs Gamma · ETH                │
│ ──                                  │
│ Alpha · 5m 放量已确认，破前高就跟    │
│ Gamma · 极端涨速比单根重要，先等失速 │
└────────────────────────────────────┘
背景：rose/[0.04]，左边框 rose/30
```

3 类事件卡视觉差异：amber（机会）/ white（关注）/ rose（冲突），不同 icon 但同样紧凑。

### 6.3 Stream 渐次出现（task-11 M5 保留）

新条目按 setTimeout 链 1.5s 间隔出现，不批量同时弹出（task-11 v1.1 M5 落地保留）。Agent 独白 + 事件卡共用同一队列。

---

## 7. 文件结构

### 新建（4 个）

```
src/lib/agentSpeechGuard.ts            # 真实性前置过滤（核心）
src/lib/eventDetectors.ts              # 3 类事件卡检测
src/modules/agent-watch/components/CollectiveEventCard.tsx
src/modules/agent-watch/components/FocusEventCard.tsx
src/modules/agent-watch/components/ConflictEventCard.tsx
```

### 修改（5 个）

```
src/modules/agent-watch/components/MessageStream.tsx → 重命名为 Stream.tsx，渲染 StreamEntry union
src/modules/agent-watch/components/MessageBubble.tsx → 改为 AgentMessageBubble.tsx，应用 accent bar 设计
src/modules/agent-watch/AgentWatchBoard.tsx          # 主循环加 speechGuard + eventDetector 调用
src/lib/llmFallbackChain.ts                          # 加 Prompt A/B/C
src/lib/types.ts                                     # StreamEntry / 4 个事件类型
src/i18n/types.ts + dicts/*.json                     # 事件卡 i18n key
```

### 不动（task-11 已落地）

```
src/modules/agent-watch/components/AgentRowCard.tsx  # 顶部 3 卡保留
src/modules/agent-watch/components/CoinTickerStrip.tsx
src/modules/agent-watch/components/MarketEventFeed.tsx  # 跑马灯保留
src/lib/marketSignals.ts
src/lib/signalBuffer.ts                              # task-09 sedimentation
src/lib/llmHistorySummary.ts
```

---

## 8. 验收清单

### 8.1 真实性约束（核心）

- [ ] 没有 severity ≥ medium 的派别匹配信号时，**LLM 不被调用**（grep `llmGenerate` 调用前必有 `checkAgentSpeech` 返回 true）
- [ ] dev mode 添加 console.log：每次 `checkAgentSpeech` 输出 reason，验证 5min 内 reason 分布合理
- [ ] 60s 限频生效：连续多信号 60s 内同派别只 1 条 Agent 气泡
- [ ] severity=low 信号不会出现在 stream 中（不触发 Agent 独白也不触发事件卡）
- [ ] LLM 输出验证：每条 AgentMessage 必须 cite 触发信号的 symbol（grep 文本验证）

### 8.2 事件卡

- [ ] 集体事件触发：≥3 symbol 同向 30s 内 → CollectiveEventCard 1 主+2 副
- [ ] 焦点事件触发：high severity 在主流 BTC/ETH/SOL → FocusEventCard 1 主
- [ ] 冲突事件触发：≥2 派 currentView 对同 symbol 反向 → ConflictEventCard 2 派对话
- [ ] 同 detector 5min 内只触发 1 次（去重 by signal-set 哈希）
- [ ] 3 类事件卡视觉差异：amber/white/rose 不同色调
- [ ] 副响应不复读主响应（LLM prompt 强制 + 字数门槛 20-40）

### 8.3 Stream 渲染

- [ ] Stream 按 ts 倒序排列，混合 4 种 kind
- [ ] AgentMessageBubble 无外发光、无 LIVE chip、左 2px accent bar 派别色
- [ ] 新条目 setTimeout 链 1.5s 间隔出现（task-11 M5 保留）
- [ ] 5min 平静时段 stream 稀疏（≤3 条）
- [ ] 5min 高潮时段 stream 中等（5-10 条），含至少 1 个事件卡

### 8.4 整体页面

- [ ] task-11 v1.3 已落地的 AgentRowCard 顶部 3 卡保留不变
- [ ] task-11 v1.3 涨绿跌红/头像/当前关注/USDT 取消/hero 修订/hover/click 全部保留
- [ ] task-09 sedimentation buffer 仍持续接收信号（暂未在 v2 stream 中独立消费，留作后续扩展）
- [ ] MessageStream.tsx 重命名为 Stream.tsx，无残留旧引用

### 8.5 数据正确性

- [ ] 不会出现 task-11 M14 的"字字相同重复消息" bug（speechGuard 60s 限频 + 触发信号 id 关联防止同信号重复触发）
- [ ] AgentMessage 的 triggerSignalId 必有值，`grep "triggerSignalId.*null"` 无结果
- [ ] dev mode warning：StreamEntry 数组出现重复 id 时 console.warn

---

## 9. 提交命令

```sh
# 前置：PR #16（task-11 v1.3 非 stream 项）已 merge 到 feature/act1-5-watch-page-01

git checkout feature/act1-5-watch-page-01
git pull origin feature/act1-5-watch-page-01
git checkout -b feature/act1-5-watch-stream-redesign-01

# 阶段 1：核心真实性约束 + 数据层
git add src/lib/agentSpeechGuard.ts \
        src/lib/eventDetectors.ts \
        src/lib/types.ts \
        src/lib/llmFallbackChain.ts
git commit -m "feat(stream-v2): add speechGuard + event detectors + new types (task-12 v2 stage 1)

- agentSpeechGuard: pre-LLM filter — faction match + severity gate + 60s rate limit, returns reason on rejection
- eventDetectors: collective (≥3 symbols same direction in 30s) + focus (high severity on majors) + conflict (factions opposing on same symbol)
- StreamEntry union type: agent_message | collective_event | focus_event | conflict_event
- LLM prompts A/B/C: agent monologue / event primary / event echo, all with cite-signal enforcement"

# 阶段 2：事件卡 UI 组件
git add src/modules/agent-watch/components/CollectiveEventCard.tsx \
        src/modules/agent-watch/components/FocusEventCard.tsx \
        src/modules/agent-watch/components/ConflictEventCard.tsx
git commit -m "feat(stream-v2): add 3 event card components (task-12 v2 stage 2)

- CollectiveEventCard: amber-themed, primary + 2 echo responses
- FocusEventCard: compact white-highlighted, single primary response
- ConflictEventCard: rose-themed, 2-faction back-and-forth"

# 阶段 3：Stream 整合 + 旧组件改造
git mv src/modules/agent-watch/components/MessageStream.tsx \
       src/modules/agent-watch/components/Stream.tsx
git mv src/modules/agent-watch/components/MessageBubble.tsx \
       src/modules/agent-watch/components/AgentMessageBubble.tsx
git add src/modules/agent-watch/components/Stream.tsx \
        src/modules/agent-watch/components/AgentMessageBubble.tsx \
        src/modules/agent-watch/AgentWatchBoard.tsx \
        src/i18n/types.ts \
        src/i18n/dicts/*.json
git commit -m "refactor(stream-v2): integrate stream with mixed entries + speechGuard loop (task-12 v2 stage 3)

- Stream.tsx renders StreamEntry union (4 kinds)
- AgentMessageBubble: applied left 2px accent bar design, no glow, no LIVE chip (v1.4 M18+M19 design retained)
- AgentWatchBoard polling loop: per-faction speechGuard check → LLM only if shouldSpeak=true
- Event detector loop runs alongside, appends event cards to stream
- task-11 v1.1 M5 setTimeout chain retained for staggered appearance
- i18n 10 locales: collective/focus/conflict event labels added"

git push origin feature/act1-5-watch-stream-redesign-01
```

新建 PR：`feature/act1-5-watch-stream-redesign-01` → `feature/act1-5-watch-page-01`

---

## 10. task-11 v1.4 项的处置

| 项                       | v2 处置                    | 原因                                                                    |
| ------------------------ | -------------------------- | ----------------------------------------------------------------------- |
| M11 撤 stream system msg | ✅ 已落地保留              | stream 仍不放系统信号 chip，跑马灯里展示                                |
| M14 重复消息 bug         | 🔄 转用途                  | speechGuard 60s 限频 + triggerSignalId 关联防止同信号重复触发，等价修复 |
| M18 气泡 accent bar      | ✅ 转用途                  | 用在 AgentMessageBubble + 事件卡内的 PrimaryResponse                    |
| M19 删消息级 LIVE chip   | ✅ 保留                    | AgentMessageBubble 不再有 LIVE chip                                     |
| M20 RowCard glow 减弱    | ✅ task-11 已落地          | AgentRowCard 设计不变                                                   |
| M21 信号→派别路由        | ✅ 强化为 speechGuard 核心 | 路由表移到 FACTION_SIGNAL_MATCH 常量                                    |

---

## 11. 风险与边界

| 风险                                  | 缓解                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| LLM 静默时段 Stream 太空              | 跑马灯仍持续滚动信号，用户视觉不会"死"；事件卡爆发时戏剧感补偿                 |
| speechGuard 过严导致 Agent 半天不发言 | dev mode 监控 reason 分布；若 90% 都是 `low_severity` 拒绝则下调 severity 门槛 |
| 事件卡和独白时间戳冲突                | StreamEntry 排序按 ts，同 ts 时事件卡优先（dom 顺序在前）                      |
| LLM 仍可能 hallucinate 不 cite 信号   | Prompt 强制 + 后处理 grep 验证（symbol 不在文本中则丢弃此输出，重生成 1 次）   |

---

## 12. 与既有任务依赖

**前置必须**：

- PR #16（task-11 v1.3 非 stream 项 M7-M17）merge 完成

**复用**：

- task-09 signalBuffer（持续接收信号，未来扩展）
- task-09 llmHistorySummary（暂不在 v2 消费，未来扩展）
- task-11 M21 路由表（移到 FACTION_SIGNAL_MATCH）
- task-11 v1.4 M18 accent bar 设计（用在 AgentMessageBubble + 事件卡）

**作废**：

- task-12 v1（stage mode）整体废止
- task-11 v1.4 M14（重复 bug）转为 speechGuard 防御

---

## 13. v2 UI 精简修订（2026-04-29 Dan 反馈"又花又密"，8 条 U1-U8 合入 v2 同 commit）

> **触发**：task-12 v2 spec 出后 Dan 反馈整体 UI 信息密度过高，需要精简。8 条 UI 修订合并入 v2 stream redesign 实施 commit。

### U1 — AgentRowCard 字段砍半

**问题**：单卡 7 个信息块（头像 / 派别名 / 派别人设小字 / 状态 / 当前关注 / judgment / 触发 + ▸ 失效）×3 卡 = 21 块/行。

**修订**：

```tsx
// AgentRowCard.tsx 精简版
<div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
  <header className="mb-3 flex items-center gap-3">
    <AgentAvatar agentId={id} className="h-14 w-14" />
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <span className="font-semibold">{name}</span>
        <StatusDot status={status} /> {/* 仅 dot 不带文字 */}
      </div>
      <FocusChip symbol={currentSymbol} /> {/* "当前关注 PUMP" */}
    </div>
  </header>

  <p className="mb-3 text-sm text-white/85">{judgment}</p>

  <details className="text-xs text-white/40">
    <summary className="cursor-pointer">▸ 详情</summary>
    <div className="mt-2 space-y-1">
      <p>触发：{trigger}</p>
      <p>失效：{invalidation}</p>
    </div>
  </details>
</div>
```

**去掉**：

- 派别人设小字（"突破派·关键位猎手"）—— 头像光晕 + 派别名已表达身份
- 状态 chip 文字（"静默"/"观察中"等）—— 改为单个 dot 颜色（鼠标 hover 显示 tooltip）
- 触发条件外露 —— 合并到 ▸ 详情折叠

**合并折叠**：原 ▸ 失效条件 + 触发条件 → ▸ 详情（一处折叠 vs 两处分散）

单卡信息块从 7 → 5（外露）+ 2（折叠内）。

i18n：删除 `agentSidebar.factionLabel`（派别人设字段），保留其他。

### U2 — CoinTickerStrip 默认折叠到主流单行（v3.1 修订 2026-04-29）

**v3 原方案问题**（Dan 反馈）：Codex 把展开/收起按钮做成**全宽横条**，每个按钮独占整行高度。结果：

- 折叠状态 = 主流 1 行 + 横条 1 行 + 横条 1 行 = 3 行（没省）
- 展开状态 = 5 行（比原 3 行更糟）

**v3.1 正确设计**：按钮做成 **chip 大小内嵌在主流行右侧**，不占独立行高。

**视觉示例**：

```
默认 1 行：
主流 [BTC][ETH][SOL]   热门(3)▾   机会(3)▾

展开 1 个 → 2 行：
主流 [BTC][ETH][SOL]   热门(3)▴   机会(3)▾
     [AI][ULTIMA][PI]              ← 新增行，缩进对齐主流 chip 起点

全展开 → 3 行：
主流 [BTC][ETH][SOL]   热门(3)▴   机会(3)▴
     [AI][ULTIMA][PI]
     [DOGE][RAIN][DEXE]
```

**实现**：

```tsx
// CoinTickerStrip.tsx
<div className="space-y-1">
  {/* 主流行：label + chips + 内嵌折叠按钮 */}
  <div className="flex flex-wrap items-center gap-2">
    <span className="w-10 shrink-0 text-xs text-white/50">主流</span>
    {MAJOR_SYMBOLS.map((sym) => (
      <TickerChip key={sym} symbol={sym} />
    ))}

    {/* 内嵌按钮：chip 大小，不占独立行 */}
    <button
      type="button"
      onClick={() => setHotExpanded(!hotExpanded)}
      className="ml-2 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-white/60 hover:bg-white/[0.06]"
    >
      热门({HOT_SYMBOLS.length}) {hotExpanded ? "▴" : "▾"}
    </button>
    <button
      type="button"
      onClick={() => setOpExpanded(!opExpanded)}
      className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-white/60 hover:bg-white/[0.06]"
    >
      机会({OPPORTUNITY_SYMBOLS.length}) {opExpanded ? "▴" : "▾"}
    </button>
  </div>

  {/* 展开行：仅 chip，缩进对齐主流 chip 起点（pl-12 = 主流 label 宽度 + gap）*/}
  {hotExpanded && (
    <div className="flex flex-wrap items-center gap-2 pl-12">
      {HOT_SYMBOLS.map((sym) => (
        <TickerChip key={sym} symbol={sym} />
      ))}
    </div>
  )}
  {opExpanded && (
    <div className="flex flex-wrap items-center gap-2 pl-12">
      {OPPORTUNITY_SYMBOLS.map((sym) => (
        <TickerChip key={sym} symbol={sym} />
      ))}
    </div>
  )}
</div>
```

**关键约束**：

- 展开/收起按钮 **必须** 是 chip 大小（`px-2.5 py-1` ≈ 10px×4px padding，配合 `text-xs` ≈ 32px 高），**不能** 做成 `w-full` 横条
- 折叠状态总高度 = 1 行（主流 chips + 内嵌按钮在同一 `flex` 容器）
- 展开 1 个 = 2 行 / 全展开 = 3 行
- 展开行用 `pl-12`（48px 左缩进）对齐主流 chip 起点，视觉上 label 列保持空白

**localStorage 持久化**：用户折叠状态记忆 30 天（`watch:ticker:hotExpanded` / `opExpanded`），下次访问保持上次选择。

**v3.1 验收追加**：

- [ ] 展开/收起按钮 chip 大小，不是全宽横条（grep 无 `w-full` 在该按钮上）
- [ ] 折叠状态 ticker 区总高度 = 1 行（≤ 36px）
- [ ] 展开行缩进对齐主流 chip 起点（`pl-12` 或类似 spacing）
- [ ] 按钮文案 "热门(3)▾" / "机会(3)▾"，点击后 ▾ → ▴

### U3 — AgentRowCard hover glow 删除

**问题**：task-11 M20 当前 hover 时仍有派别色弱 glow（`hover:shadow-[0_0_8px_var(--agent-color-glow)]`），鼠标移上去屏幕一片闪亮。

**修订**：删除 hover shadow，仅 hover 边框颜色变化（white/[0.08] → 派别色 faint）。

```tsx
// 旧：
className =
  "... hover:border-[color:var(--agent-color-faint)] hover:shadow-[0_0_8px_var(--agent-color-glow)]";
// 新：
className = "... hover:border-[color:var(--agent-color-faint)]"; // 删 shadow
```

### U4 — 整体留白增加

**问题**：组件之间间距过紧，信息黏在一起。

**修订**：

- AgentWatchBoard 顶层 layout `space-y-4` → `space-y-6`（区块间 16px → 24px）
- AgentRowCard 内 padding `p-4` → `p-5`（16px → 20px）
- 3 卡之间 gap `gap-3` → `gap-4`（12px → 16px）
- Stream 内条目 `space-y-2` → `space-y-3`（8px → 12px）

### U5 — 字号层级收敛到 3 级

**问题**：当前混用 5-6 个字号（10/11/12/13/14/15/16/18px），视觉乱。

**修订**：收敛到 3 级 + tailwind 标准 token：

| 用途                        | tailwind class            | px  |
| --------------------------- | ------------------------- | --- |
| heading（区块标题）         | `text-base font-semibold` | 16  |
| body（正文/judgment）       | `text-sm`                 | 14  |
| caption（时间戳/状态/标签） | `text-xs`                 | 12  |

特殊例外：

- 跑马灯保持原字号（Dan 拍板不动）
- 数据强调（如 +162.92%）允许 font-mono `text-sm`

grep 确认：`text-[10px]` / `text-[11px]` / `text-[13px]` / `text-[15px]` / `text-base` 等非标准字号 → 收敛到上表 3 级。

### U6 — 头像光晕减弱

**问题**：当前头像 box-shadow blur 较大，3 卡并排时头像光晕扩散到卡片之间。

**修订**：

```css
/* AgentAvatar.tsx 或对应 CSS */
/* 旧 */
box-shadow: 0 0 24px var(--agent-color-glow);
/* 新 */
box-shadow: 0 0 12px var(--agent-color-glow-faint);
```

派别识别保留，光晕克制 50%。

### U7 — Stream AgentMessageBubble 头像缩到 24px

**问题**：stream 内每条气泡左侧头像 32px（task-11 M8 落地），气泡密集时头像占用过多视觉权重。

**修订**：stream 内头像 32px → 24px。AgentRowCard 顶部 3 卡的头像保持 56px（M8 落地不动）——卡片是身份主表达，stream 是次要锚点。

```tsx
// AgentMessageBubble.tsx
<AgentAvatar agentId={agentId} className="h-6 w-6" /> // 24px
```

### U8 — 颜色 palette 删 purple，收敛到三组

**问题**：当前 palette 混用了 6+ 种色相：派别 3（red/blue/violet）+ amber（severity high）+ rose/emerald（涨跌）+ purple（旧 LIVE 装饰）+ white 透明度梯度。色多无系统。

**修订**：收敛到 3 组：

| 组       | 用途             | 色                                                      |
| -------- | ---------------- | ------------------------------------------------------- |
| 派别身份 | Alpha/Beta/Gamma | `#ff5f5f` / `#3a7bff` / `#9b6bff`                       |
| 数据语义 | 涨/跌/警示       | `text-emerald-400` / `text-rose-400` / `text-amber-400` |
| 灰阶层级 | 文本/背景/边框   | `white/[0.04~0.85]` 透明度梯度                          |

**删除**：

- 紫色 LIVE 装饰（旧 LIVE chip 已 v1.4 M19 删，残留 purple 主题色检查 globals.css 是否有 `--accent-purple` 之类未用变量）
- grep `purple-` / `violet-` 在 src/ 范围，凡和 Gamma 派别色无关的实例都清掉

**注意**：Gamma 的 `#9b6bff` 是 violet 系派别色，**保留**。删的是装饰用 purple/violet。

### v3 验收清单

- [ ] (U1) AgentRowCard 单卡外露 ≤ 5 个信息块
- [ ] (U1) 派别人设小字（"突破派·关键位猎手"）不再外露
- [ ] (U1) 状态 chip 仅 dot 不带文字（hover tooltip 显示状态名）
- [ ] (U1) 触发条件 + 失效条件合并到 ▸ 详情，默认折叠
- [ ] (U2) CoinTickerStrip 默认只显示主流单行（3 chip）
- [ ] (U2) "热门 (3)"/"机会 (3)" 折叠按钮可展开
- [ ] (U2) localStorage 持久化展开状态（30 天）
- [ ] (U3) AgentRowCard hover 时无 box-shadow glow
- [ ] (U3) hover 仅边框颜色变化（white/[0.08] → 派别色 faint）
- [ ] (U4) 区块间距 16 → 24px / 卡内 padding 16 → 20px / 3 卡间 12 → 16px / stream 条目 8 → 12px
- [ ] (U5) 字号收敛到 text-base / text-sm / text-xs 三级（除跑马灯保持 + 特殊数字 mono 外）
- [ ] (U5) grep 无 `text-[10px]` / `text-[11px]` / `text-[13px]` / `text-[15px]` 残留
- [ ] (U6) 头像光晕 box-shadow blur 24 → 12px
- [ ] (U7) stream 内头像 32 → 24px；AgentRowCard 顶部头像保持 56px
- [ ] (U8) globals.css 无残留 `--accent-purple` 之类装饰紫色变量
- [ ] (U8) src/ 范围内无 `purple-` / `violet-` 类（除 Gamma 派别色 `#9b6bff` 用法）

### v2 + v3 提交（合并入 stream redesign 第 3 个 commit）

```sh
# v2 stream redesign 阶段 3 commit message 扩展
git commit -m "refactor(stream-v2 + ui-density): integrate stream + UI simplification (task-12 v2 + v3 stage 3)

[stream redesign]
- Stream.tsx renders StreamEntry union (4 kinds)
- AgentMessageBubble: left 2px accent bar, no glow, no LIVE chip
- AgentWatchBoard polling: speechGuard → LLM only if shouldSpeak=true
- Event detector loop appends event cards to stream
- task-11 M5 setTimeout chain retained for staggered appearance

[UI density U1-U8]
U1: AgentRowCard fields halved — removed faction-tagline, status text→dot, trigger/invalidation merged into ▸ 详情 collapse
U2: CoinTickerStrip default collapses to majors row (3 chips); hot/opportunity behind expand buttons; localStorage 30d persist
U3: AgentRowCard removed hover box-shadow glow; only border color shifts
U4: Spacing increased — section gap 16→24, card padding 16→20, 3-card gap 12→16, stream space 8→12
U5: Font-size collapsed to 3 tiers (text-base/sm/xs); non-standard sizes purged except marquee
U6: Avatar halo shadow blur 24→12px (50% restraint)
U7: Stream avatar 32→24px; AgentRowCard top avatars stay 56px
U8: Color palette consolidated — removed decorative purple, kept Gamma faction violet only"
```

---

## 14. v3.2 修订（v2 + v3 落地 preview 后 Dan 第八轮反馈，2026-04-29）

> Codex 把 v2 stream redesign + v3 UI 精简推到 preview 后，Dan 截图反馈 stream **4 个 bug**：
>
> - B1: 同信号事件卡 1min 内触发 2 次（20:57 + 20:58 同内容）
> - B2: 事件卡内 Gamma 响应 + 60s 内 Gamma 又独立发 AgentMessage 重复同样内容
> - B3: LLM 输出文字 "AI AI 24h..." 首字母双重前缀 bug
> - B4: stream 视觉缺活跃感（"Gamma 正在思考..." 只是文字 placeholder 无动画）
>
> 4 条修复 F1-F4 合入当前 PR `feature/act1-5-watch-stream-redesign-01`，1 个 fix commit 推过去。

### F1 — 事件卡响应纳入 speechGuard 60s 限频（修 B2）

**根因**：当前架构允许 Gamma 在事件卡内发主响应 + 60s 内又调用 `checkAgentSpeech` 通过限频 → 独立发 AgentMessage 说同样内容。事件卡响应**没有**记录到 `lastSpokeAt` map。

**修复**：

```ts
// agentSpeechGuard.ts 加 recordAgentSpoke API
const lastSpokeAt: Record<AgentId, number> = { alpha: 0, beta: 0, gamma: 0 };

export function recordAgentSpoke(agentId: AgentId, ts: number = Date.now()) {
  lastSpokeAt[agentId] = ts;
}

export function checkAgentSpeech(
  agentId: AgentId,
  recentSignals: SignalRecord[],
): SpeechCheckResult {
  if (Date.now() - lastSpokeAt[agentId] < 60_000) {
    return { shouldSpeak: false, reason: "rate_limited" };
  }
  // ... 其他逻辑
}
```

**事件卡触发时**（FocusEventDetector / CollectiveDetector / ConflictDetector 内）：

```ts
async function handleCollectiveEvent(event: CollectiveEvent) {
  // 主响应
  const primaryContent = await llmGeneratePrimaryResponse(event.primaryAgent, event);
  recordAgentSpoke(event.primaryAgent); // ← 加这行

  // 副响应
  for (const echoAgent of event.echoAgents) {
    const echoContent = await llmGenerateEchoResponse(echoAgent, primaryContent);
    recordAgentSpoke(echoAgent); // ← 加这行
  }

  appendStreamEntry({ kind: "collective_event", data: { ...event, primaryContent, echoes } });
}
```

**验收**：dev mode log 显示 `recordAgentSpoke` 调用次数 = 事件卡内派别响应数 + AgentMessage 数。同 Agent 60s 内两条消息（含事件卡内）不可能出现。

### F2 — Detector 去重 key 用 signal-set hash（修 B1）

**根因**：当前 detector 5min 去重可能只按事件 type（"high_severity" 维度），但 20:57/20:58 触发的是同一个 signal（AI 24h -58.7%），signal id 不同（每次 polling 生成新 id）但**signal 内容**相同。

**修复**：去重 key 用 `signal.symbol + signal.type + signal.severity` 组合 hash，不是 signal.id。

```ts
// eventDetectors.ts
const recentEventHashes = new Map<string, number>(); // hash → ts

function makeFocusEventHash(signal: SignalRecord): string {
  return `focus:${signal.symbol}:${signal.type}:${signal.severity}`;
}

export function detectFocusEvent(recentSignals: SignalRecord[]): FocusEvent | null {
  const focus = recentSignals.find(/* ... */);
  if (!focus) return null;

  const hash = makeFocusEventHash(focus);
  const lastTs = recentEventHashes.get(hash) ?? 0;

  // 5min 去重窗口
  if (Date.now() - lastTs < 5 * 60_000) {
    return null; // 同 signal-set 5min 内已触发，跳过
  }

  recentEventHashes.set(hash, Date.now());
  return {
    /* event */
  };
}
```

CollectiveEvent / ConflictEvent 同理，hash 含触发条件的关键字段。定期清理 30min+ 老 hash 防止内存泄漏。

**验收**：同 (symbol + type + severity) signal 5min 内只触发 1 次事件卡（grep dev log "skipped duplicate" 验证）。

### F3 — LLM 输出文字 "AI AI" 重复前缀修复（修 B3）

**双管齐下**：

**3.1 改 Prompt 让 LLM 不要在开头复述 symbol**：

```
你是 [派别] · [人设]。

[触发信号]
symbol: AI（DeFi-AI 项目）
type: RANGE_CHANGE
severity: high
description: AI 24h -58.7%

输出 1-2 句分析气泡。

⚠️ 重要约束：
- symbol 已在卡片头部展示，气泡正文**不要**用 symbol 开头
- ❌ 错误："AI 24h -58.7%, 极端位置只进观察区"（重复 symbol）
- ✅ 正确："24h -58.7% 已进极端位置，只进观察区"（symbol 隐含）
```

**3.2 服务端后处理兜底**：

```ts
// llmFallbackChain.ts 输出后处理
function sanitizeAgentMessage(content: string, symbol: string): string {
  // 去除开头重复的 symbol 前缀
  // "AI AI 24h..." → "AI 24h..."
  // "AI 24h..." → "24h..."（symbol 单次也去掉，因为卡片头部已显示）
  const symbolPrefix = new RegExp(`^(${symbol}\\s+)+`, "i");
  return content.replace(symbolPrefix, "").trim();
}
```

**验收**：grep stream 渲染内容无 `^([A-Z]+\s+)\1` 双前缀；symbol 在气泡正文不再以开头形式重复出现（symbol 在内容中间引用 OK）。

### F4 — Stream 活跃感：typing 动画 + 错峰节奏（修 B4）

**4.1 "正在思考" 加 dot 闪烁动画**：

```tsx
// AgentTypingIndicator.tsx 新建（或扩展现有 placeholder）
<div className="flex items-center gap-2 text-xs text-white/40">
  <AgentAvatar agentId={agentId} className="h-6 w-6 opacity-60" />
  <span>{agent.name} 正在思考</span>
  <span className="flex gap-0.5">
    <span className="animate-typing-dot-1 h-1 w-1 rounded-full bg-white/40" />
    <span className="animate-typing-dot-2 h-1 w-1 rounded-full bg-white/40" />
    <span className="animate-typing-dot-3 h-1 w-1 rounded-full bg-white/40" />
  </span>
</div>
```

```css
/* globals.css */
@keyframes typing-dot {
  0%,
  60%,
  100% {
    opacity: 0.3;
    transform: scale(1);
  }
  30% {
    opacity: 1;
    transform: scale(1.3);
  }
}
.animate-typing-dot-1 {
  animation: typing-dot 1.4s infinite;
  animation-delay: 0s;
}
.animate-typing-dot-2 {
  animation: typing-dot 1.4s infinite;
  animation-delay: 0.2s;
}
.animate-typing-dot-3 {
  animation: typing-dot 1.4s infinite;
  animation-delay: 0.4s;
}
```

**4.2 LLM 调用前后插入 typing 阶段**：

```ts
// AgentWatchBoard.tsx 内
async function triggerAgentSpeak(agentId: AgentId, signal: SignalRecord) {
  // 1. 显示 typing indicator
  setTypingAgents((prev) => new Set(prev).add(agentId));

  // 2. 错峰延迟（800-2000ms 随机），让"思考过程"有真实感
  const thinkDuration = 800 + Math.random() * 1200;
  await sleep(thinkDuration);

  // 3. 真实 LLM 调用
  const content = await llmGenerateAgentMessage(agentId, signal);

  // 4. 移除 typing，加入 stream（200ms 滑入动画）
  setTypingAgents((prev) => {
    const next = new Set(prev);
    next.delete(agentId);
    return next;
  });

  appendStreamEntry({ kind: "agent_message", data: { agentId, content, ts: Date.now() } });
  recordAgentSpoke(agentId);
}
```

**4.3 滑入动画**：新条目 fade-in + translate-y-2 → translate-y-0，300ms ease-out。

```css
@keyframes stream-entry-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-stream-in {
  animation: stream-entry-in 300ms ease-out;
}
```

### v3.2 验收

- [ ] (F1) 事件卡内派别响应触发后调用 `recordAgentSpoke`，60s 内同 Agent 不能再独立发 AgentMessage
- [ ] (F1) dev log 显示 `recordAgentSpoke` 调用次数包含事件卡响应
- [ ] (F2) 同 (symbol + type + severity) signal 5min 内只触发 1 次事件卡
- [ ] (F2) Detector 内部维护 `recentEventHashes` Map，30min+ 老 hash 自动清理
- [ ] (F3) LLM Prompt 加"不要复述 symbol"约束
- [ ] (F3) 后处理函数 `sanitizeAgentMessage` 移除开头 symbol 前缀
- [ ] (F3) grep stream 内容无 `^(\w+\s+)\1` 双前缀
- [ ] (F4) "正在思考" 显示 3 dot 闪烁动画（typing-dot keyframe）
- [ ] (F4) LLM 调用前 sleep 800-2000ms 随机模拟思考时长
- [ ] (F4) 新条目滑入动画 300ms（stream-entry-in）
- [ ] (F4) 不同 Agent 的 typing duration 错开，stream 不会同时弹出 3 条

### v3.2 提交（fix commit，单独推送到当前 PR）

```sh
git checkout feature/act1-5-watch-stream-redesign-01
git add src/lib/agentSpeechGuard.ts \
        src/lib/eventDetectors.ts \
        src/lib/llmFallbackChain.ts \
        src/modules/agent-watch/AgentWatchBoard.tsx \
        src/modules/agent-watch/components/AgentTypingIndicator.tsx \
        src/app/globals.css

git commit -m "fix(stream-v2): 4 bugs from preview review (task-12 v3.2)

F1: Event card responses now call recordAgentSpoke — fixes Gamma double-speak (event card primary + 60s-later AgentMessage)
F2: Detector dedup key changed from signal.id to (symbol+type+severity) hash — fixes same-signal triggering 2x within 1min (20:57/20:58 case)
F3: LLM prompt + post-process sanitize — removed 'AI AI 24h' double symbol prefix
F4: Typing indicator with dot animation + 800-2000ms randomized think delay + 300ms slide-in — restored stream liveliness"

git push origin feature/act1-5-watch-stream-redesign-01
```

---

_v3 修订: 2026-04-29 (Dan UI 密度反馈，8 条 U1-U8 合入 v2 commit)_
_v3.2 修订: 2026-04-29 (Dan preview 反馈 4 bug，F1-F4 单独 fix commit)_
