# Task 12 Draft — Watch 页信号驱动 Agent 工作台

> 状态：产品/技术规格草案，用于下一轮和 Claude/F 碰撞，不直接作为已批准实现 spec。
>
> 背景：Task 09-11 已把 `/agent` 从单纯聊天流推进到多币种 ticker、信号流、AgentRowCard 和更强 prompt。但 Dan 在 v1.3 preview 继续反馈：Stream 内容仍有重复感。核心根因不是 prompt 单点问题，而是“按时间固定让三位 Agent 发言”的产品机制本身会制造重复。

---

## 1. 核心判断

用户需要感觉 Agent 一直在工作，但不需要 Agent 一直说话。

当前旧逻辑：

```text
每 60s 请求一次 analysis
→ 如果 generatedAt 变化
→ 固定追加 Alpha / Beta / Gamma 三条
→ 行情没变化时，LLM 被迫围绕同一信号换说法
→ 用户看到语义重复
```

目标新逻辑：

```text
行情数据高频刷新
→ 低成本信号持续计算
→ Agent 工作状态持续变化
→ 只有出现新信号 / 判断变化 / 风险失效时才进入 Stream
```

一句话原则：

> 高频展示“正在工作”，低频输出“有价值结论”。

---

## 2. 产品目标

用户停留在 Watch 页时，要持续看到三种价值：

1. **工作感**：Agent 正在扫描、验证、等待、更新，而不是页面静止。
2. **判断感**：每个 Agent 当前关注什么、为什么关注、下一步看什么。
3. **事件感**：市场发生新变化时，页面能把变化提出来，而不是定时刷三句。

验收口径：

- 打开 10 秒内：用户知道 3 个 Agent 正在做什么。
- 停留 1 分钟：即使没有新结论，也能看到扫描状态、信号计数、更新时间在变化。
- 停留 5-10 分钟：Stream 只出现有新信息的消息，不再为了“热闹”重复发言。
- 市场无明显变化时：页面显示“继续观察”，而不是硬生成同质分析。

---

## 3. 信息层级

### 3.1 高频层：Market Heartbeat

刷新频率：30-60s。

目的：证明系统在持续工作，但不制造聊天噪音。

展示建议：

```text
正在扫描 9 个币 · 新信号 2 · 上次更新 12:24
CoinW K线正常 · LLM 上轮 3 分钟前
```

字段建议：

```ts
interface WatchHeartbeat {
  scannedSymbols: number;
  newSignalCount: number;
  activeSignalCount: number;
  lastScanAt: number;
  marketSource: MarketDataSource;
  llmLastRunAt: number | null;
  llmNextEligibleAt: number | null;
}
```

UI 位置：

- 放在 ticker 下、MarketEventFeed 上方。
- 样式克制，像系统状态条，不做大卡片。

### 3.2 中频层：Agent Work State

刷新频率：60s 或随信号更新。

目的：让用户看到每个 Agent 的“工作中状态”，不用靠发言刷存在感。

每个 AgentRowCard 固定展示：

```text
Alpha
状态：扫描突破位
当前关注：ETH
为什么：5m 放量 + 接近前高
下一步看：站稳 3,xxx / 缩量失效
更新时间：12:24
```

状态枚举建议：

```ts
type AgentWorkStatus =
  | "scanning" // 扫描中
  | "validating" // 验证信号
  | "watching" // 持续观察
  | "updated" // 刚更新判断
  | "quiet"; // 暂无新信号
```

数据结构建议：

```ts
interface AgentWorkState {
  agentId: AgentId;
  status: AgentWorkStatus;
  statusText: string;
  currentFocus: string;
  reason: string;
  nextCondition: string;
  invalidation: string;
  updatedAt: number;
  signalIds: string[];
}
```

关键点：

- AgentRowCard 是“持续状态承载”，不是 Stream 的复读。
- 无新信号时，卡片状态可以更新为“继续观察 ETH，等待回踩确认”。
- 卡片可以高频变，但文案必须短，不做长分析。

### 3.3 事件层：MarketEventFeed

刷新频率：60s。

目的：让用户看到市场变化，而不是只有 Agent 主观话术。

事件进入规则：

- 新 `SignalRecord.id` 才进入。
- 同 symbol + type + direction 在 cooldown 内不重复。
- severity 高的事件视觉强调。

事件示例：

```text
ETH 5m 放量 2.1x，接近前高
SOL 跌回 EMA13 下方，趋势降级
PUMP 24h +7.8%，进入 Gamma 极端观察池
```

这一层负责“实时感”，不是 LLM。

### 3.4 低频层：Insight Stream

刷新方式：信号驱动，不再固定三人发言。

允许每轮输出：

- 0 条：没有新结论。
- 1 条：只有一个 Agent 有新判断。
- 2 条：两个 Agent 对同一信号有不同视角。
- 3 条：只有在市场明显变化或集体信号出现时才三人都说。

Stream 进入条件：

1. 新 signal fingerprint 出现。
2. Agent 当前关注 symbol 变化。
3. trigger / invalidation 发生变化。
4. 高 severity 信号出现。
5. 上一次判断被市场打破。

Stream 不进入条件：

1. 同一 Agent 对同一 symbol 重复同一结论。
2. 只是 ticker 价格小幅变化。
3. LLM 只是换词复述上轮。
4. 没有新增 signal evidence。

---

## 4. 去重与触发机制

### 4.1 Signal Fingerprint

先在非 LLM 层生成稳定 fingerprint：

```ts
interface SignalFingerprint {
  symbol: string;
  type: SignalType;
  timeframe?: "5m" | "15m" | "4h" | "24h";
  direction?: "up" | "down" | "flat";
  levelBucket?: string; // priceLevel 做粗粒度 bucket
  severity: SignalSeverity;
}
```

fingerprint key 示例：

```text
ETH:volume_spike:5m:up:watch
BTC:near_low:5m:down:alert
PUMP:range_change:24h:up:watch
```

### 4.2 Agent Decision Fingerprint

Agent 输出前也生成判断 fingerprint：

```ts
interface AgentDecisionFingerprint {
  agentId: AgentId;
  symbol: string;
  stance: "breakout" | "trend" | "reversion" | "wait" | "risk";
  triggerBucket: string;
  invalidationBucket: string;
}
```

去重规则：

- exact content：30 分钟内不重复。
- decision fingerprint：10-15 分钟内不重复进 Stream。
- signal fingerprint：同一 symbol/type/timeframe 在 5-10 分钟内不重复进 Stream，除非 severity 升级。

### 4.3 Stream Suppression Log

不要只丢弃重复，要记录为什么没发：

```ts
interface StreamSuppression {
  reason: "no_new_signal" | "same_decision" | "cooldown" | "low_severity" | "llm_not_needed";
  suppressedCount: number;
  lastSuppressedAt: number;
}
```

这可以反向服务 UI：

```text
过去 4 分钟无新结论，3 个 Agent 继续观察当前信号。
```

这句话比重复发三条更有价值。

---

## 5. LLM 调用策略

### 5.1 默认不按分钟强制生成

保留前端 60s polling，但后端不必每次都跑 LLM。

后端决策：

```text
每次请求:
1. 更新 ticker 和 signal buffer
2. 计算 heartbeat + workState
3. 判断是否有 Stream-worthy change
4. 有 → 且超过 min interval → 调 LLM
5. 无 → 返回上一轮 stream + 最新 heartbeat/workState，streamDelta = []
```

### 5.2 最小间隔

建议：

- LLM 最小间隔：90s。
- 普通 LLM 刷新：3-5min。
- 高 severity 事件可提前触发，但仍要过 90s min interval。

### 5.3 Prompt 改造

Prompt 不再要求每次输出 3 条 stream。

改为：

```text
你只在有新判断时输出 stream。
如果某个 Agent 的判断与上轮相同，stream 中不要输出该 Agent。
但必须输出 workState，说明该 Agent 当前正在观察什么。
```

输出结构建议：

```json
{
  "heartbeat": {},
  "workState": [],
  "streamDelta": [],
  "suppression": {}
}
```

---

## 6. UI 结构建议

页面从上到下：

1. **TopicHeader**
   - 标题不变。
   - subtitle 可强化“Agent 正在盯盘，不是定时播报”。

2. **CoinTickerStrip**
   - 高频行情。

3. **WatchHeartbeatBar**
   - 扫描币数 / 新信号 / 更新时间 / 数据源。

4. **MarketEventFeed**
   - 横向事件流。

5. **AgentRowCard × 3**
   - 当前工作状态 + 当前关注 + 下一步条件。
   - 不需要每轮都变成长文。

6. **MessageStream**
   - 只显示有价值的新结论。
   - 如果没有新结论，底部显示轻量系统提示，不追加 Agent 气泡。

---

## 7. MVP 切分

### Commit 1 — 后端触发与去重合同

范围：

- `types.ts`
- `signalBuffer` / `marketSignals`
- `llmFallbackChain`

内容：

- 新增 `WatchHeartbeat`
- 新增 `AgentWorkState`
- 新增 `streamDelta`
- 新增 signal / decision fingerprint
- 加 stream suppression 记录

验收：

- 无新 signal 时，API 可返回空 `streamDelta`
- `npx tsc --noEmit` 通过

### Commit 2 — Agent 工作台 UI

范围：

- `AgentWatchBoard`
- `AgentRowCard`
- 新增 `WatchHeartbeatBar`
- i18n

内容：

- 展示扫描状态、当前关注、下一步条件、更新时间。
- AgentRowCard 承接持续状态。

验收：

- 不依赖 Stream 也能看到 Agent 正在工作。
- 无新结论时页面不空。

### Commit 3 — Stream 改为信号驱动

范围：

- `useAgentAnalysis`
- `MessageStream`
- `llmFallbackChain` prompt

内容：

- 允许一轮 0-3 条 Agent stream。
- 只有 `streamDelta` 追加到 liveQueue。
- 同一 fingerprint cooldown 内不追加。

验收：

- 市场无变化时，5 分钟内不出现换词复读。
- 有高 severity 新信号时，能触发对应 Agent 发言。

### Commit 4 — 观察与调参

内容：

- Preview 连续观察 20-30 分钟。
- 记录 Stream 触发原因、suppression reason。
- 根据重复率调 cooldown。

验收：

- Dan 看页面时能感到 Agent 在工作。
- Stream 少但更有信息量。

---

## 8. 非目标

本 task 不做：

- 自动交易。
- 用户登录态。
- WebSocket。
- 长期数据库持久化。
- 复杂回测。
- 订单/仓位/账户数据。

这仍是 preview demo memory + realtime-ish watch page，不承诺 24h 持久服务。

---

## 9. 验收标准

### 9.1 重复控制

- [ ] 同一 Agent exact content 30 分钟内不重复出现。
- [ ] 同一 Agent 对同一 symbol + stance + trigger 的判断 10 分钟内不重复进 Stream。
- [ ] 无新 signal 时，Stream 不追加 Agent 气泡。
- [ ] 允许 `streamDelta.length === 0`。

### 9.2 工作感

- [ ] 页面每 30-60s 能看到 heartbeat 更新时间变化。
- [ ] 3 个 AgentRowCard 始终显示当前状态。
- [ ] Agent 状态文案能区分 Alpha / Beta / Gamma 的方法论。
- [ ] 无新结论时，有“继续观察”类系统状态，但不刷 Agent 气泡。

### 9.3 价值感

- [ ] 每个 AgentRowCard 都有“为什么关注”和“下一步看什么”。
- [ ] Stream 每条都必须说明新变化或判断变化。
- [ ] MarketEventFeed 与 Stream 不三重重复。
- [ ] 用户不用翻历史，也能知道当前最值得看的币和条件。

### 9.4 稳定性

- [ ] `npx tsc --noEmit` 通过。
- [ ] `npm run build` 通过。
- [ ] `npm run lint` 通过。
- [ ] Preview 观察 20-30 分钟，无明显复读。

---

## 10. Claude 碰撞问题

请 Claude 重点挑战以下点：

1. “高频工作状态 + 低频结论”是否足够让用户感到价值？
2. AgentRowCard 是否会变成 dashboard，削弱“Agent 感”？
3. `streamDelta.length === 0` 是否会让页面显得冷清？如何用 heartbeat 和 workState 承接？
4. fingerprint cooldown 10-15 分钟是否合理？
5. 哪些信号值得触发 Stream，哪些只应留在 MarketEventFeed？
6. 是否应该允许一条高 severity 信号触发 2 个 Agent 对同一币给不同视角？
7. LLM 输出 workState 是否必要，还是 workState 应完全由本地规则生成？
8. 当前 preview memory 架构下，suppression log 放内存是否足够？
9. MVP 是否应先只做后端 suppression + UI heartbeat，暂不改 prompt？
10. 如果只能做 1 天版本，应该保留哪两项？

---

_维护者: Codex_
_创建: 2026-04-29_
_状态: Draft for review_
