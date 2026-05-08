# Task 18 — Watch 页沉浸式聊天 + 实时看盘 + 诚实降级（task-15 v3 产品形态再调）

> **触发**：task-15 + task-17 落地后 Dan 看 preview 给 3 个产品级反馈：
>
> 1. 策略数字脱离实时行情（BTC 当前 81665，TP 给 78500 完全错乱）
> 2. 派别讨论"云里雾里"——术语堆砌，普通用户看不懂
> 3. 巡检卡占太大、聊天占太小、三方会诊太独立——layout 失衡
>
> **核心产品定位重新校准**：watch 页 = **沉浸式 AI 实时看盘聊天室**，不是 dashboard。
>
> **执行者**：Codex
>
> **新分支**：`feature/watch-chat-immersive-01`
>
> **PR target**：`feature/act1-5-watch-page-01`
>
> **前置依赖**：task-15 PR #21 已 merge / task-17 多源 chain 完成（task-18 实施前确认 task-17 已 merge）
>
> **基础不变**：task-15 NewsItem schema / task-15 派别 IP / task-15 复盘 cron / task-15 OG 分享 / task-17 source chain — 全部保留

---

## 1. 5 大改造方向

### M1. AgentCard 自适应状态（Q1 — 不是固定迷你）

不是固定迷你 chip，**动态切换 3 状态**——根据 Agent 当前活跃度决定卡片大小。

| 状态                | 触发                                              | 视觉                                                                                   | 高度   |
| ------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------- | ------ |
| **idle** 静默       | 该派别 5min+ 无发言、无信号触发                   | 迷你 chip 一行：头像 24px + nickname + 当前关注 symbol + win-rate（"7胜4负 64%"）      | ~40px  |
| **speaking** 发言中 | 该派别 60s 内发过言、或正在生成                   | 中卡：头像 56px + nickname + 状态 + 当前 judgment 摘要（≤30 字）+ 派别色 accent border | ~140px |
| **alert** 高警戒    | 5min 内 high severity 信号 ≥ 3 条、或正在三方会诊 | 大卡：speaking 内容 + pulse 边框 + spotlight glow + 跳出来吸引视线                     | ~180px |

**切换动画**：高度 / opacity / 内容用 framer-motion `<AnimatePresence>` 300ms ease 过渡。状态切换不闪烁。

**默认状态**：所有 3 卡 idle —— **整页 3 卡总高度 ~120px**（vs 当前 ~400px），聊天区比例从 ~55% 上升到 **~75%**。

### M2. 三方会诊融入聊天（Q2 confirmed）

task-15 的 `collective_event` / `focus_event` / `conflict_event` 三类事件**不再独立卡**——直接作为 stream entry 在聊天里按时间排：

```
[聊天 stream — 按时间倒序]

🚨 三方会诊 · 22:42  ← 紫底 chip + emoji 标记
├─ 老 K：BTC 81665 突破前高 0.2%，破就追
├─ 老白：等 5 分钟 K 线确认，别梭哈
└─ 老 G：极端涨速可疑，等回踩

老 K 怒怼老白：你这套去年错 8 次……
老白：…
```

视觉差异：会诊 chip 紫底 + ⚡/🚨 emoji，但仍**和普通聊天同一栏宽**——不破坏沉浸感。

### M3. 内容白话化（Q3 — 你之前推的还不够白）

我前一版给的"括号注释"（「EMA12/13 共振」(= 均线合上)）你说**还不够白**。重做规则：

#### 3.1 强禁规则（grep 验证）

- 禁止"EMA"/"MACD"/"RSI"/"布林"/"K 线"/"均线共振"等术语**单独**出现 — 必须翻译成"价格点位"或"具体数字"
- 禁止"突破"/"回踩"/"假突破" 单独出现 — 必须 cite 具体价格："BTC 81665 破前高 81890" 而不是"BTC 突破"

#### 3.2 翻译模板（LLM Prompt 内强制示例）

| ❌ 八股原版        | ✅ 白话版（强制）                                                     |
| ------------------ | --------------------------------------------------------------------- |
| "EMA12/13 共振"    | "短期均线在 80950 / 中期均线在 80920 — 两条线在 80950 这个点位合上了" |
| "BTC 突破前高"     | "BTC 现价 81665，比上周高点 81450 高了 215 块"                        |
| "等 5min K 线确认" | "再看 5 分钟，如果价格稳在 81000 上方，就算确认"                      |
| "极端涨速"         | "30 分钟从 80200 拉到 81665，涨了 1.8%，太快可能要回吐"               |
| "趋势没破"         | "从昨晚到现在 BTC 一直在 80500 上方，这条线没破就是涨势"              |

**核心原则**：**每个判断必须 cite 具体数字**（价格 / 涨跌幅 / 时间窗口），不允许只说趋势词。

#### 3.3 结论锚（强制）

每条发言**必须**有"所以 [具体行动 + 价格触发条件]"结尾：

- ✅ "所以 81700 破了就跟，82000 止盈"
- ❌ "所以等突破"（无具体数字）

LLM Prompt + 服务端后处理双层校验。grep 失败 → retry 1 次 → 仍失败 → 该 Agent 这条发言**直接跳过**（沉默 vs 输出垃圾，沉默更好）。

### M4. 实时看盘（Q4 — 核心卖点重点设计）

#### 4.1 产品定位

"3 个 AI 实时看盘 + 真实分析" —— 这是 claw42 watch 页区别于其他 AI 聊天产品的**核心卖点**。用户感知必须是"AI 真的在看实时数据"，不是"AI 在编故事"。

#### 4.2 实时性强制机制

**每次 LLM 调用前强制拉最新 ticker**——不依赖缓存：

```ts
// src/lib/news/livePriceFetch.ts 新建
const LIVE_PRICE_TTL_MS = 10_000; // 最多缓存 10 秒
let lastFetch = 0;
let lastData: TickerSnapshot | null = null;

export async function fetchLivePriceSnapshot(): Promise<TickerSnapshot | null> {
  const now = Date.now();
  if (lastData && now - lastFetch < LIVE_PRICE_TTL_MS) {
    return lastData;
  }

  try {
    const data = await fetchTickerFresh(); // 不走 cache，直接拉
    lastData = { ...data, fetchedAt: now };
    lastFetch = now;
    return lastData;
  } catch {
    // 拉不到 → 返回 null，让 caller 决定是 retry 还是降级
    return null;
  }
}

export interface TickerSnapshot {
  fetchedAt: number;
  prices: Record<
    string,
    {
      current: number;
      change24h: number; // %
      high24h: number;
      low24h: number;
      high7d: number;
      low7d: number;
      last5min: number[]; // 5 分钟内每分钟价格快照（5 个点）
      last30min: number[]; // 30 分钟（30 个点）
    }
  >;
}
```

#### 4.3 LLM Prompt 注入实时数据（每次调用都注入）

```
[实时市场状态 — 数据于 N 秒前抓取]

BTC:
  当前 $81,665 (24h +0.53%)
  24h 高 $81,890 / 24h 低 $80,210
  7d 高 $82,400 / 7d 低 $78,900
  最近 5 分钟价格变化: 81620 → 81630 → 81655 → 81670 → 81665（基本横盘）
  最近 30 分钟趋势: 80,210 → 81,665 涨了 1.81%

ETH: ...
SOL: ...
[以及辩论关注的非主流币]

[硬约束]
- 你的发言必须 cite 上面至少 1 个具体数字
- 不许说"BTC 突破"、必须说"BTC 81665 突破前高 81890"
- 不许说"涨幅大"、必须说"30 分钟涨了 1.81%"
- 时间引用必须有具体窗口（"5 分钟内 / 30 分钟内 / 24 小时内"）
```

#### 4.4 UI 实时性证明

聊天每条发言带**数据时间戳**（小灰字）：

```
[🤠] 老 K · 22:42 · 数据 8 秒前
💥 BTC 现价 81665 比 24h 高点 81890 还差 225 块。所以 81700 破了就跟，82000 止盈。
```

`数据 N 秒前` 显示该条发言依据的 ticker 抓取时间——证明实时性。

#### 4.5 实时性失败时的 Agent 表态

ticker API 拉不到（超时 / 限流 / 网络问题）→ **Agent 主动表态**，不是用旧数据假装：

```
[🤠] 老 K · 22:43
🤔 数据没刷出来，等 1 分钟再说。
```

LLM Prompt 接收 `tickerFailed: true` flag 时强制输出"暂停发言"模板（5 种短句轮换）。这比硬出脱离实际的策略好太多。

#### 4.6 验收

- [ ] 每条发言渲染时显示 "数据 N 秒前"
- [ ] N ≤ 30（10s TTL + LLM 调用 ~10-20s）
- [ ] grep stream 内容：每条都有具体价格数字
- [ ] ticker 拉不到时，Agent 输出短句"等数据 / 等会再说"，不输出策略
- [ ] 服务端后处理 grep："`\d+\.?\d*` 数字模式"必须命中 ≥ 1 次

### M5. 诚实降级（Q5 — 重新设计，不要模板）

#### 5.1 问题

我前一版推"校验失败 → 固定模板文案"，Dan 说**早晚穿帮**——用户看几次同一句话立刻 get 这是 fallback，信任崩塌。

#### 5.2 重新设计：3 层决策树（无模板）

```
LLM R3 输出 FinalStrategy
   │
   ├─ 校验通过（数字合理）→ 渲染策略卡 + 跟单按钮
   │
   ├─ 校验失败 #1（数字偏离 ≥10%）
   │     │
   │     └─ retry 1 次（注入校验失败原因 + 当前价）
   │           │
   │           ├─ retry 通过 → 渲染（commit message 标 "retried":true）
   │           │
   │           └─ retry 仍失败 → 降级到 #2
   │
   └─ 降级 #2：**策略卡不渲染**
         │
         显示替代区块：
         ┌─────────────────────────────────────┐
         │ ⚠️ 本场 AI 共识不足                  │
         │                                     │
         │ 老 K 看突破 / 老白等趋势 / 老 G 看反转 │
         │                                     │
         │ 3 派分歧大，没有清晰策略。            │
         │ 看上方讨论自己判断。                  │
         │                                     │
         │ [📊 看相关数据 →]  [💬 看讨论历史]   │
         └─────────────────────────────────────┘
```

#### 5.3 替代区块比模板优秀的 3 个理由

1. **诚实**：明说"AI 自己说不准"——比硬出脱离实际的数字更信任
2. **不会穿帮**：每场辩论的派别意见摘要不一样，区块内容不重复
3. **导流**：用户被引到"看讨论 / 看数据" 而非"看策略"——延长停留 + 信任建立

#### 5.4 触发频率监控

PostHog 加事件 `strategy_synthesis_failed` —— 监控降级触发率。

**预期**：< 15% 触发率为健康。
**> 30% 触发**：说明 LLM 整体输出质量低 —— 触发产品级 review，可能要换 LLM provider 或调 Prompt。

#### 5.5 验收

- [ ] 策略卡 component 接受 `strategy: FinalStrategy | null` —— null 时渲染"AI 共识不足"区块，不渲染原策略卡
- [ ] retry 1 次后仍失败才降级（grep `retryCount` 验证）
- [ ] PostHog `strategy_synthesis_failed` 事件含 `validation_error` 字段
- [ ] dev mode 模拟 LLM 输出错误数字 → UI 正确显示替代区块

---

## 2. 数据流（4 大模块协作）

```
[用户进 watch 页 / 新闻触发辩论]
     │
     ▼
[debateOrchestrator]
     │
     ├─ 拉 fetchLivePriceSnapshot()        ← M4: 强制 ≤ 10s 实时
     │     │
     │     ├─ 成功 → 注入 LLM Prompt
     │     └─ 失败 → 触发 "Agent 暂停" 短句
     │
     ▼
[LLM R1 / R2 / R3]
     │
     ├─ Prompt 含实时数据 + 白话翻译模板 + 结论锚要求
     ├─ 输出后服务端 grep 校验
     │   ├─ 含术语但无白话 → retry
     │   ├─ 无具体数字 → retry
     │   ├─ 无"所以 X" 结论锚 → retry
     │   └─ retry 仍失败 → 该条 Agent 沉默
     │
     ▼
[FinalStrategy 校验]
     │
     ├─ 数字合理（distance < 10%）→ 渲染策略卡
     ├─ 数字偏离 → retry 1 次
     │   ├─ retry 通过 → 渲染
     │   └─ retry 失败 → 渲染"AI 共识不足"区块
     │
     ▼
[Stream 渲染]
     │
     ├─ 3 个 AgentCard 自适应（idle/speaking/alert）
     ├─ 三方会诊 chip 融入聊天 stream
     ├─ 每条发言带"数据 N 秒前"时间戳
     └─ 策略卡 / 共识不足区块 / 跟单按钮（条件渲染）
```

---

## 3. 文件结构

### 新建（4 个）

```
src/lib/news/livePriceFetch.ts                                  # M4 实时 ticker fetcher（10s TTL，不走 cache）
src/lib/strategyValidator.ts                                     # M5 校验函数 + retry 编排
src/modules/agent-watch/components/InsufficientConsensus.tsx    # M5 "AI 共识不足"替代区块
src/modules/agent-watch/components/AgentMiniCard.tsx            # M1 idle 状态迷你卡（speaking/alert 用 AgentRowCard 升级版）
```

### 修改（7 个）

```
src/lib/llmFallbackChain.ts            # M3 Prompt 强制白话翻译 + 结论锚 + 实时数据 + 后处理校验
src/lib/debateOrchestrator.ts          # M4 调 fetchLivePriceSnapshot 注入 Prompt + M5 retry 编排
src/lib/agentSpeechGuard.ts            # M3 沉默条件加"白话校验失败"
src/modules/agent-watch/components/AgentRowCard.tsx        # M1 自适应 3 状态切换（idle/speaking/alert）
src/modules/agent-watch/components/Stream.tsx              # M2 融入 collective/focus event chip + M4 数据时间戳
src/modules/agent-watch/components/UtteranceBubble.tsx     # M4 加 "数据 N 秒前" 时间戳
src/modules/agent-watch/components/FinalStrategyBlock.tsx  # M5 接受 null + 渲染 InsufficientConsensus
src/modules/agent-watch/AgentWatchBoard.tsx                # M2 删 collective/focus 独立卡，融入 stream
src/lib/analytics.ts                                       # 加 strategy_synthesis_failed 事件
```

### 不动（task-15 / task-17 已落地）

```
NewsItem schema / 派别 IP / Win-rate / 复盘 cron / OG 分享 / NewsSourceRegistry / 多源 chain
```

---

## 4. 4 阶段 commit

| Stage       | 内容                                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| **Stage 1** | M4 实时数据层：livePriceFetch + 注入 LLM Prompt + UI "数据 N 秒前" 时间戳 + ticker 失败时 Agent 沉默 |
| **Stage 2** | M3 Prompt 白话化 + 结论锚 + 后处理 grep 校验 + Agent 沉默条件扩展                                    |
| **Stage 3** | M5 strategyValidator + retry 编排 + InsufficientConsensus 区块 + PostHog 事件                        |
| **Stage 4** | M1 AgentCard 自适应 3 状态 + M2 三方会诊融入 stream + Agent mini card 组件                           |

PR target：`feature/act1-5-watch-page-01`

---

## 5. 验收清单（按 5 大改造）

### M1 — Layout 自适应

- [ ] 3 AgentCard 默认 idle 状态（迷你 1 行）
- [ ] Agent 60s 内发过言 → speaking 状态（中卡 ~140px 高）
- [ ] 5min 内 high severity ≥ 3 → alert 状态（大卡 ~180px + pulse）
- [ ] 状态切换 framer-motion 300ms 平滑过渡，不闪烁
- [ ] 默认整页 3 卡总高度 ≤ 120px
- [ ] 聊天区视觉占比 ≥ 70%（dev tools 量）

### M2 — 三方会诊融入聊天

- [ ] AgentWatchBoard 不再渲染 CollectiveEventCard / FocusEventCard 独立组件
- [ ] Stream.tsx 内部识别 `kind === 'collective'/'focus'/'conflict'` 渲染紫底 chip + emoji 标记
- [ ] 会诊 chip 与普通发言同一栏宽
- [ ] 会诊 chip 内 3 派短发言按时间排（不是矩阵列）

### M3 — 内容白话化

- [ ] LLM Prompt 含 5 个 ❌→✅ 翻译示例
- [ ] 服务端 grep 检测："EMA"/"MACD"/"RSI"/"布林"/"K 线"等术语单独出现 → retry
- [ ] 服务端 grep 检测：发言含 ≥ 1 个具体数字（`\d+\.?\d*`）→ 不通过则 retry
- [ ] 服务端 grep 检测：发言以"所以"开头的句子含具体价格 → 不通过则 retry
- [ ] retry 失败 → Agent 该条沉默（不输出垃圾）

### M4 — 实时看盘

- [ ] livePriceFetch 实现 10s TTL（grep `LIVE_PRICE_TTL_MS = 10_000`）
- [ ] LLM 调用前 100% 触发 livePriceFetch
- [ ] LLM Prompt 含 BTC/ETH/SOL + 关注币 7 字段（current/24h%/24h 高低/7d 高低/5min 序列/30min 序列）
- [ ] UtteranceBubble 显示 "数据 N 秒前" 时间戳
- [ ] N ≤ 30
- [ ] ticker 失败时 Agent 输出"等数据"短句，非策略

### M5 — 诚实降级

- [ ] strategyValidator 实现 distance < 10% 校验 + long/short SL/TP 方向校验
- [ ] 校验失败 → retry 1 次（注入失败原因）
- [ ] retry 仍失败 → FinalStrategyBlock 渲染 InsufficientConsensus，不渲染原策略卡
- [ ] InsufficientConsensus 含 3 派意见摘要 + 跳转链接（看数据 / 看讨论）
- [ ] PostHog `strategy_synthesis_failed` 事件触发
- [ ] dev 模拟 LLM 输出 entry=$50000（远低于当前 BTC）→ 渲染替代区块
- [ ] 触发率监控仪表板（PostHog dashboard 配 > 15% 报警）

---

## 6. 给 Codex 的派发文本

```
项目：claw42
工作路径：/Users/dannybrown/Claude/职业规划/web-dev/claw42
Spec：docs/airy-tasks/task-18-watch-chat-immersive.md

新分支：feature/watch-chat-immersive-01
PR target：feature/act1-5-watch-page-01

前置：task-15 PR #21 已 merge，task-17 多源 chain 已 merge

4 阶段 commit：
  Stage 1: livePriceFetch（10s TTL）+ LLM Prompt 注入实时数据 + UI 数据时间戳 + ticker 失败时 Agent 沉默
  Stage 2: LLM Prompt 白话化（5 翻译示例 + 禁术语 grep）+ 结论锚强制 + retry 不过则 Agent 沉默
  Stage 3: strategyValidator（distance<10% + long/short 校验）+ retry 1 次 + InsufficientConsensus 区块
  Stage 4: AgentCard 自适应 3 状态（idle/speaking/alert）+ 三方会诊融入 stream（CollectiveEventCard / FocusEventCard 删除独立组件）

关键约束：
1. NewsItem schema / 派别 IP / Win-rate / 复盘 cron / OG 分享 / SourceRegistry 全部不动
2. M3 白话化是硬规则——LLM 输出不合规直接 retry，仍不合规 Agent 沉默（不输出垃圾）
3. M4 livePriceFetch 是核心卖点——每次 LLM 调用前必拉，10s 缓存上限
4. M5 fallback **不用固定模板**——失败渲染 InsufficientConsensus 区块（含 3 派摘要），不渲染原策略卡
5. M1 默认 idle，发言/警戒时放大——CSS transition 300ms

⚠️ Stage 2 的 grep 校验是核心——很多 LLM 输出会"看似 OK 但其实违规"，grep 必须严格命中（含术语但无具体数字 / 无"所以"结论 / 句子无数字 等都算 fail）

verify 通过 + Vercel preview 验收 5 项：
- 整页 3 卡默认 idle ≤ 120px
- 任一 Agent 发言时该卡放大到 speaking
- 聊天发言含具体价格数字（grep 验证）
- 数据时间戳显示 ≤ 30s
- 模拟 LLM 输出错误策略 → 渲染 InsufficientConsensus 不是策略卡
```

---

## 7. 风险与边界

| 风险                                              | 缓解                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| livePriceFetch 10s TTL 让 ticker API 调用频率上升 | task-17 已实现 SourceChain，CryptoCompare 100k/月足够；监控 quota 80% 报警 |
| Prompt 白话化让 LLM 输出更长（token 上升）        | 设输出上限（每条 ≤ 80 字），LLM 自己压缩                                   |
| AgentCard 状态频繁切换闪烁                        | 加 100ms debounce，状态不能 1 秒切多次                                     |
| InsufficientConsensus 触发太频繁（>30%）          | PostHog 报警 → 触发产品级 review，可能换 LLM provider                      |
| ticker 拉不到时 Agent 沉默太多 → stream 死寂      | 5 种"等数据"短句轮换，至少有 chitchat                                      |
| Prompt 加白话翻译示例后 LLM 反而僵化              | 示例当 few-shot，不是 RFC；保留派别口诀                                    |

---

## 8. 与既有 task 关系

**前置（必须 merge）**：task-15 PR #21 + task-17 多源 chain

**作废**：

- task-15 § 6 LLM Prompt（被 M3 重写覆盖）
- task-15 collective/focus/conflict event 独立卡组件（被 M2 融入 stream 替代）

**保留**：

- task-15 NewsItem / NewsDebate / FinalStrategy schema（不动）
- task-15 派别 IP / Win-rate / 复盘 cron / OG 分享
- task-17 SourceRegistry / 多源 chain / failureCooler
- task-13 hero daily brief

**后续可能 task**：

- task-19 Layout 移动端深度优化（task-18 桌面优先）
- task-20 PostHog dashboard：strategy_synthesis_failed 触发率监控

---

_维护者: F_
_创建: 2026-05-06_
_执行者: Codex_
_基于: task-15 PR #21 + task-17 多源 chain + Dan task-18 反馈（5/6）_
_产品定位重新校准: 从"watch dashboard" → "AI 实时看盘聊天室"_

---

## 9. v2 修订（Dan 6 大方向 + 10 决策点全确认 2026-05-06）

> v1 spec 落定后 Dan 给 6 大产品级方向 + 10 个细节决策点，**全部默认值确认**。本节是 v2 完整规划，与 § 1-§ 8 v1 内容**叠加生效**——v1 的 5 大改造（M1-M5）保留，v2 加 6 大方向（D1-D6）。

### 9.1 D1 — 全聊天产品形态（巡检 → 发言）

**v1 M1 局限**：M1 还把巡检卡设成"自适应 idle/speaking/alert 3 状态"——但 idle 卡仍展示静态信息（当前关注 symbol / win-rate）。

**v2 修订**：watch 页**没有静态信息**，全部信息通过聊天 stream 传达。AgentRowCard idle 状态进一步精简——只剩头像 + nickname + status dot，**当前关注 symbol / judgment 信息全部下移到聊天发言**。

**实施**：

- AgentMiniCard 删除 `currentFocus.symbol` / `judgment` 字段渲染
- ChatterGenerator（新模块）每隔 3-5min 触发一条派别"自报家门"发言："老 K：现在盯 ZEC，0.04 是关键位，跌破再说"
- 这等于把 task-15 的 currentView 数据**渲染层从 mini card 搬到 stream**

#### A — 闲聊密度（A2 + A3 自适应 + 派别独立）

```ts
// src/lib/chatterGenerator.ts 新建
const BASE_CADENCE_MS = 4 * 60_000; // 4min 基线

const FACTION_CHATTER_MULTIPLIER: Record<AgentId, number> = {
  alpha: 0.7, // 老 K 话痨，发言更勤
  beta: 1.3, // 老白少言
  gamma: 1.0, // 老 G 中等
};

function getNextChatterDelay(agentId: AgentId, marketActivity: "high" | "medium" | "low"): number {
  const base = BASE_CADENCE_MS * FACTION_CHATTER_MULTIPLIER[agentId];
  // 行情活跃时降低闲聊（专注辩论）；行情低密度时提升
  const multiplier = marketActivity === "high" ? 2.0 : marketActivity === "low" ? 0.6 : 1.0;
  return base * multiplier;
}
```

**marketActivity 判断**：30min 内辩论次数 ≥ 3 → high；1-2 → medium；0 → low。

#### B — 闲聊话题源池（B2+B3+B4 三轮换，B1 不做）

| 话题源          | 权重 | 触发数据                           | 例子                                                                            |
| --------------- | ---- | ---------------------------------- | ------------------------------------------------------------------------------- |
| **B2 行情自评** | 40%  | 实时 ticker（livePriceFetch）      | "BTC 80 分钟没动了，磨人" / "ETH 30min 拉了 1.8%，热得有点假"                   |
| **B3 历史回顾** | 30%  | 复盘 cron 数据 / 24-72h 内策略历史 | "上次老 K 说 ZEC 破 0.04 跟，结果 +3%，老白服了？" / "Samsung 那条新闻还在发酵" |
| **B4 派别互问** | 30%  | 关系演化 state（D4）               | "老白你昨天 ETH 那波趋势咋样了？" / "老 G 上次抄底 PUMP 现在亏几个点了"         |

**B1 派别口头禅 / catchphrase 单口** 不单独做话题源——容易复读机。catchphrase 作为辩论中的 cite 工具用（task-15 已有），不入闲聊。

ChatterGenerator 按权重 random 选话题源 → LLM 生成。每 5min 最多 1 条闲聊（防刷屏）。

### 9.2 D2 — Typing Indicator 扩展（C1）

**v1 M4** 已规划"Agent 沉默时输出'等数据'短句"，v2 加 typing indicator 频率扩展：

**C1 — 每条发言前 800-2000ms 都显示 typing**：

- 闲聊 / 分析 / 辩论 / 反驳 — 任何 LLM 输出前都先 typing
- 句库 8+ 种轮换避免重复

```ts
// src/lib/agentTypingPhrases.ts 新建
const TYPING_PHRASES: Record<AgentId, string[]> = {
  alpha: [
    "老 K 正在分析行情...",
    "老 K 在等 EMA 共振...",
    "老 K 正在看 5 分钟 K 线...",
    "老 K 正在算关键位...",
    "老 K 在思考要不要追...",
    "老 K 在看放量数据...",
    "老 K 在比对前高...",
    "老 K 在复盘上次...",
  ],
  beta: [
    "老白正在看趋势...",
    "老白正在判断...",
    "老白在等确认信号...",
    "老白正在看 EMA12/13...",
    "老白在算回撤幅度...",
    "老白在判断真假突破...",
    "老白在看趋势线...",
    "老白在思考反驳...",
  ],
  gamma: [
    "老 G 正在算极端值...",
    "老 G 正在看高低位...",
    "老 G 在等失速信号...",
    "老 G 在判断反转点...",
    "老 G 在算波动率...",
    "老 G 在看回归窗口...",
    "老 G 在等顶部信号...",
    "老 G 在嘲讽老 K...",
  ],
};
```

**注意**：typing 文案允许出现术语（EMA 等）—— 这是**状态标签**不是发言内容，M3 白话化只约束 utterance content，不约束 typing label。

**显示时长**：固定不行（Codex 自决）—— 800-2000ms 随机区间，让节奏自然。LLM 调用比 2000ms 长时 typing 持续到 LLM 完成。

### 9.3 D3 — 跟单按钮保留 D3 文案不变

`FinalStrategyBlock` 跟单按钮文案保持 task-15 设计：

- long: `🚀 一键跟多 →`
- short: `🚀 一键跟空 →`
- wait: `等待信号`（disabled）

**不退到"参考"措辞**——产品定位明确：跟单。合规风险 Dan 接受，spec 不再讨论。

M5 诚实降级（数字错乱不渲染策略卡，渲染 InsufficientConsensus）保留作为合规边界——AI 不靠谱时不出策略 → 不出按钮 → 不引导跟单。

### 9.4 D4 — 派别关系动态演化（task-18 最深的产品创新）

**核心**：关系不是 hardcoded 静态脚本，是基于真实行情 + 派别交互历史**动态演化**的状态。

#### 数据模型

```ts
// src/lib/agentRelationship.ts 新建
export interface RelationshipState {
  pairKey: string; // sort([a, b]).join('-')
  agentA: AgentId;
  agentB: AgentId;
  emotionalDebt: number; // -10 ~ +10，A 对 B 的"心理债"
  // > 0: A 觉得"亏欠"或"忌惮" B（B 最近赢面大）
  // < 0: A 觉得"有底气"嘲讽 B（A 最近赢面大）
  recentScores: Array<{
    debateId: string;
    timestamp: number;
    aOutcome: "win" | "lose" | "neutral";
    bOutcome: "win" | "lose" | "neutral";
    weight: number; // 时间衰减权重（0-1）
  }>;
  unsettledPunchlines: Array<{
    // A 抓 B 没还的"梗"
    debateId: string;
    timestamp: number;
    aSaid: string; // A 当时说的金句
    bMistake: string; // B 当时的失误（hit_sl / no_trigger）
    expiresAt: number; // 7 天后失效
  }>;
  lastUpdatedAt: number;
}
```

#### E — emotionalDebt 算法（E1+E2+E3 全做）

**E1 — 每场辩论 + 24h 复盘后调整**：

```ts
function adjustDebt(state: RelationshipState, replayResult: ReplayResult): RelationshipState {
  // 复盘逻辑：A 对了 B 错了 → A 的 debt -2（A 对 B 更有底气）
  //           A 错了 B 对了 → A 的 debt +2（A 忌惮 B）
  //           都对 / 都错 → debt 不变
  const aRight = replayResult.aOutcome === "win";
  const bRight = replayResult.bOutcome === "win";

  let delta = 0;
  if (aRight && !bRight) delta = -2;
  else if (!aRight && bRight) delta = +2;

  state.emotionalDebt = Math.max(-10, Math.min(10, state.emotionalDebt + delta));
  return state;
}
```

**E2 — 每 7 天自然衰减 30%**（关系愈合）：

```ts
function applyTimeDecay(state: RelationshipState, now: number): RelationshipState {
  const daysSinceLastUpdate = (now - state.lastUpdatedAt) / 86_400_000;
  const decayFactor = Math.pow(0.7, daysSinceLastUpdate / 7); // 7 天衰减 30%
  state.emotionalDebt *= decayFactor;
  if (Math.abs(state.emotionalDebt) < 0.5) state.emotionalDebt = 0;
  state.lastUpdatedAt = now;
  return state;
}
```

**E3 — debt > 5 时 LLM Prompt 注入"对 X 强烈嫉妒/忌惮"**：

```ts
function injectRelationshipContext(agentA: AgentId, allRelations: RelationshipState[]): string {
  const lines: string[] = [];
  for (const rel of allRelations) {
    const debt = rel.agentA === agentA ? rel.emotionalDebt : -rel.emotionalDebt;
    const other = rel.agentA === agentA ? rel.agentB : rel.agentA;

    if (debt > 5) {
      lines.push(`你对 ${other} 当前忌惮强烈（心理上"亏欠"），说话时收敛锋芒，不主动嘲讽`);
    } else if (debt < -5) {
      lines.push(`你对 ${other} 当前底气十足（最近 ${other} 错了几次），可以放开嘲讽`);
    }

    if (rel.unsettledPunchlines.length > 0 && rel.agentA === agentA) {
      const recent = rel.unsettledPunchlines.slice(-1)[0];
      lines.push(
        `你之前抓 ${other} 一次错（"${recent.bMistake}"），下次提到相关话题可以拿出来嘴一次`,
      );
    }
  }
  return lines.join("\n");
}
```

#### F — file cache 持久化（F2）

```
.cache/agent-relationships.json
{
  "alpha-beta": { ...RelationshipState },
  "alpha-gamma": { ...RelationshipState },
  "beta-gamma": { ...RelationshipState }
}
```

复用 task-15 fileCache 模式。每次复盘 cron 跑完后更新一次。LLM Prompt 调用前读取。

#### G — UI 暴露策略（G1 + G3）

**G1 幕后驱动 LLM Prompt**：聊天 / 辩论 LLM 调用时注入 emotionalDebt 上下文，让 Agent 输出语气自然带情绪。**UI 不直接显示 debt 数字**——避免 dashboard 化。

**G3 复盘 tab 加情绪轨迹图**：`/zh_CN/agent/replay` 加新区块"派别关系演化"：

- 折线图：3 对宿敌 emotionalDebt 7 天轨迹
- 时间点标注："5/3 老 K hit_tp +3.2% → 老白对老 K debt +2"
- 这是给深度用户 / 内部 Dan 看的

**G2 派别 mini card 加情绪 emoji** 不做——避免 UI 噪音。

### 9.5 D5 — 新闻流详细规划（关键模块）

#### 5.1 有热点新闻时

**新闻 chip 显示**：

- **原英文标题** + 来源 + "↗原文"链接（信息保真）
- **不翻译标题**到 zh_CN（避免翻译失真）
- 用户点击 ↗原文 跳到 CoinDesk / Cointelegraph 等原文页

**Agent 在聊天里按用户 locale 分析**：
zh_CN 用户：

```
📰 BTC ETF inflows hit $1.2B record · 22:42 [CoinDesk ↗]
   ─
   [🤠] 老 K · 22:43 · 数据 8 秒前
   💥 ETF 一天流入 12 亿美金，比上周高 30%。BTC 现价 81665 比 ETF 公布前的 80200 涨了 1.8%。
        所以 81700 破了再追，82000 止盈。
```

en_US 用户看到同一条新闻 + 老 K 用英文分析：

```
[🤠] Lao K · 22:43 · data 8s ago
💥 $1.2B daily ETF inflow, 30% higher than last week. BTC at $81,665 is up 1.8% from $80,200 pre-announcement.
   So if it breaks $81,700, follow it. Take profit at $82,000.
```

#### H — 多语 Agent 分析的实现（H3 lazy 按需 + 缓存）

```ts
// src/lib/news/newsAgentAnalysis.ts 新建
type AnalysisCacheKey = `${string}:${AgentId}:${Locale}`;
const analysisCache = new Map<AnalysisCacheKey, string>();

export async function getAgentAnalysisForNews(
  newsId: string,
  agentId: AgentId,
  locale: Locale,
  ticker: TickerSnapshot,
): Promise<string> {
  const key: AnalysisCacheKey = `${newsId}:${agentId}:${locale}`;
  if (analysisCache.has(key)) return analysisCache.get(key)!;

  // 首次访问 → LLM 生成对应 locale 解读
  const analysis = await llmGenerateNewsAnalysis({ newsId, agentId, locale, ticker });
  analysisCache.set(key, analysis);

  // 持久化到 file cache（同 task-17 newsTranslate 模式）
  await persistAnalysis(key, analysis);
  return analysis;
}
```

**触发**：用户访问 watch 页 + 该新闻进 stream → 按用户 locale 触发 lazy 生成。**不预生成全部 locale**（避免成本爆炸）。

**预算**：每个新闻 × 3 派 × 活跃 locale 数 LLM 调用，但仅在用户实际访问时触发，闲置 locale 不烧钱。

#### 5.2 无热点新闻时（话题源池）

```ts
// src/lib/topicGenerator.ts 新建
type TopicSource =
  | "price_move"
  | "replay_review"
  | "history_recall"
  | "agent_query"
  | "silence_chitchat";

const TOPIC_WEIGHTS: Record<TopicSource, number> = {
  price_move: 35, // 行情突变（5min ≥0.5% / 30min ≥1.5%）
  replay_review: 25, // 24-72h 内策略复盘结果
  history_recall: 15, // 历史新闻回顾（>24h 但 <7d 的旧新闻）
  agent_query: 15, // 派别互问（基于关系 state）
  silence_chitchat: 10, // 行情死寂时的闲聊（"BTC 80 分钟没动了"）
};

export async function generateNoNewsTopic(
  ticker: TickerSnapshot,
  recentReplays: StrategyReplay[],
  relations: RelationshipState[],
): Promise<TopicSeed> {
  const source = weightedRandom(TOPIC_WEIGHTS);
  switch (source) {
    case "price_move":
      return generateFromPriceMove(ticker);
    case "replay_review":
      return generateFromReplay(recentReplays);
    case "history_recall":
      return generateFromHistory();
    case "agent_query":
      return generateFromRelations(relations);
    case "silence_chitchat":
      return generateSilenceChitchat(ticker);
  }
}
```

**TopicSeed → 触发完整辩论 R1/R2/R3**（按 I1）：

#### I — 无新闻时是否触发完整辩论（I1）

**I1 — 仍触发完整 R1/R2/R3 辩论**——把 TopicSeed（行情突变 / 复盘结果 / 历史回顾）当作"伪新闻"喂给 debateOrchestrator，3 派照常讨论 + 出策略。

理由：**产品体感的核心是"3 个 AI 一直在辩论"**。如果无新闻就退化到闲聊（无策略卡），用户会很快觉得"没东西看"。

**LLM 成本权衡**：

- 完整辩论 7 LLM 调用 / 场
- 假设无新闻时 30min 触发 1 场 → 每天 48 场 + 真新闻触发 ~20 场 = 68 场/天
- 总 LLM 调用 ~476 / 天
- DeepSeek 价格估算 ~¥3-5/天，可接受

**触发频率收紧规则**：

- 无新闻时辩论 30min 内最多触发 1 次
- 同 TopicSeed type 12h 内最多触发 1 次（防止"BTC 没动了"这条 spam）

### 9.6 D6 — 纯旁观 + 跟/没跟反馈（J2）

**无文本输入框 / 无 @ / 无评论 / 无 reply**——避免"AI 给建议 + 用户回复"的法律连带风险。

**保留 PostHog 自报反馈按钮**（不算用户对话，是产品反馈）：

```tsx
// FinalStrategyBlock 加按钮组
<div className="flex gap-2">
  <button onClick={handleFollow}>🚀 一键跟多 →</button>
  <button onClick={() => track("strategy_followed_self_reported", { strategy_id })}>
    ✅ 我跟了
  </button>
  <button onClick={() => track("strategy_skipped_self_reported", { strategy_id })}>
    ❌ 我没跟
  </button>
  <button onClick={handleSave}>💾 保存</button>
  <button onClick={handleShare}>📤 分享</button>
</div>
```

**用途**：对照 24h 复盘 hit_tp 结果 → 算用户**真实跟单转化率** + **跟单后悔率**（跟了但实际亏）。这是产品迭代关键数据。

PostHog 事件：

- `strategy_followed_self_reported` — 用户主动表"我跟了"
- `strategy_skipped_self_reported` — 用户主动表"我没跟"

### 9.7 文件结构（v2 新增）

```
src/lib/chatterGenerator.ts                # 闲聊生成器（D1）
src/lib/topicGenerator.ts                  # 无新闻话题源池（D5.2）
src/lib/agentTypingPhrases.ts              # typing 句库（D2）
src/lib/agentRelationship.ts               # 关系状态管理（D4）
src/lib/news/newsAgentAnalysis.ts          # 新闻多语解读 lazy + cache（D5.1）
.cache/agent-relationships.json            # 关系持久化（F2）
src/modules/agent-watch/components/RelationshipChart.tsx  # 复盘 tab 关系演化图（G3）
```

### 9.8 5 阶段 commit（v1 是 4，v2 加 1）

| Stage                  | 内容                                                    |
| ---------------------- | ------------------------------------------------------- |
| **Stage 1**            | v1 M4 livePriceFetch + 实时数据注入 + UI 数据时间戳     |
| **Stage 2**            | v1 M3 白话化 + 结论锚 + grep 校验 + Agent 沉默          |
| **Stage 3**            | v1 M5 strategyValidator + retry + InsufficientConsensus |
| **Stage 4**            | v1 M1+M2 + v2 D1 chatter + D2 typing + D6 反馈按钮      |
| **Stage 5（v2 新加）** | v2 D4 关系演化 + D5 新闻流详细规划 + 复盘 tab 关系图    |

PR target：`feature/act1-5-watch-page-01`

### 9.9 v2 验收清单（叠加 v1）

#### D1 闲聊系统

- [ ] AgentMiniCard idle 状态不再显示 currentFocus.symbol / judgment（删除字段渲染）
- [ ] ChatterGenerator 按 marketActivity 自适应密度（high 8min / medium 4min / low 2.4min）
- [ ] 派别独立频率：alpha 0.7x / beta 1.3x / gamma 1.0x
- [ ] 闲聊话题 4 类轮换（B2/B3/B4 + 静默闲聊），按权重 random
- [ ] 5min 内最多 1 条闲聊（防刷屏）

#### D2 typing

- [ ] 每条 LLM 输出前 800-2000ms 显示 typing
- [ ] 句库 ≥ 8 句/派（agentTypingPhrases.ts）
- [ ] typing 文案不进 grep M3 校验（白话规则不约束 typing label）

#### D3 跟单按钮

- [ ] 按钮文案保持 task-15 设计（"一键跟多/跟空"）
- [ ] M5 诚实降级时不渲染按钮（替代为 InsufficientConsensus）

#### D4 关系演化

- [ ] agentRelationship.ts 实现 emotionalDebt 算法（E1+E2+E3）
- [ ] file cache `.cache/agent-relationships.json` 持久化
- [ ] 24h 复盘 cron 跑完后更新 debt
- [ ] 7 天自然衰减 30%（dev 测试用 1 hour 模拟 7 天验证）
- [ ] LLM Prompt 注入 debt > 5 / debt < -5 上下文
- [ ] unsettledPunchlines 7 天后自动清理
- [ ] 复盘 tab 加 RelationshipChart 区块（折线图）
- [ ] mini card 不显示 debt 数字 / emoji（G2 不做）

#### D5 新闻流

- [ ] 新闻 chip 显示原英文标题 + 来源 + ↗原文
- [ ] zh_CN / en_US 用户看到对应 locale Agent 分析
- [ ] H3 lazy 缓存：用户首次访问时生成对应 locale，后续命中 cache
- [ ] 无新闻时 TopicGenerator 5 类话题源轮询
- [ ] 无新闻辩论 30min 内最多触发 1 次
- [ ] 同 TopicSeed type 12h 内最多 1 次（防 spam）

#### D6 反馈按钮

- [ ] FinalStrategyBlock 加 "✅ 我跟了" / "❌ 我没跟" 按钮
- [ ] PostHog `strategy_followed_self_reported` / `strategy_skipped_self_reported` 事件
- [ ] 无文本输入框 / 无 @ / 无 reply

### 9.10 给 Codex 的 v2 派发文本

```
项目：claw42
工作路径：/Users/dannybrown/Claude/职业规划/web-dev/claw42
Spec：docs/airy-tasks/task-18-watch-chat-immersive.md（含 § 9 v2 修订段，**先看 § 9 再实施**）

新分支：feature/watch-chat-immersive-01
PR target：feature/act1-5-watch-page-01

前置：task-15 PR #21 已 merge / task-17 多源 chain 已 merge

5 阶段 commit：
  Stage 1: v1 M4 livePriceFetch + 实时数据注入
  Stage 2: v1 M3 白话化 + grep 校验
  Stage 3: v1 M5 诚实降级 + InsufficientConsensus
  Stage 4: v1 M1+M2 + v2 D1 chatterGenerator + D2 typing + D6 反馈按钮
  Stage 5: v2 D4 关系演化 + D5 新闻流详细规划 + 复盘 tab 关系图

关键约束：
1. v1 M3 白话化对 utterance content 强校验，**不约束** typing label / 闲聊话题前缀
2. v2 D4 关系演化是核心创新——emotionalDebt 算法 + file cache 持久化 + 7 天衰减
3. v2 D5 新闻流：原英文 chip + Agent locale 分析（lazy + cache）
4. 无新闻时 TopicGenerator 触发完整辩论（成本可接受 ~¥5/天）
5. 无文本输入框 / 无 @（纯旁观）
6. 跟单按钮文案保持 task-15 不变（不退到"参考"）

⚠️ Stage 5 关系演化复杂度高，建议 Codex 实施前先 dev mode 跑一周模拟测试 emotionalDebt 衰减是否合理

verify + Vercel preview 验收 8 项：
- 整页 idle ≤ 120px / 发言时放大
- 数据时间戳 ≤ 30s
- LLM 输出含具体价格（grep）
- 错策略 → InsufficientConsensus
- typing 频繁出现（>80% 发言前）
- 闲聊每 4-8min 触发一条
- 关系 debt 持久化到 file cache
- 反馈按钮触发 PostHog 事件
```

### 9.11 Dan 待办（v2 新增）

| #   | 项                                                                    | 何时           | 状态 |
| --- | --------------------------------------------------------------------- | -------------- | ---- |
| 1   | task-17 PR merge 后启动 task-18（不能并行）                           | task-17 完成后 | 待办 |
| 2   | dev preview 验证关系演化是否自然（不会出现"老 K 永远嫉妒老白"死循环） | Stage 5 推完后 | 待办 |
| 3   | dev preview 验证无新闻辩论触发是否合理（30min 内不超 1 次）           | Stage 5 推完后 | 待办 |
| 4   | DeepSeek 配额 monitoring（D5 新闻多语 + 无新闻辩论会增加 LLM 调用）   | Stage 5 上线后 | 待办 |

---

_v2 修订: 2026-05-06（Dan 6 大方向 + 10 决策点全确认 — 全聊天产品形态 + 关系动态演化 + 新闻流详细规划）_

---

## 10. v3 修订（2026-05-06 Dan 三反馈拍板：1A/2A/3A/4A — 产品形态级重构）

> **触发**：v2 spec 出后 Dan 看 preview 给 3 反馈：
>
> 1. 首次进入静默过长
> 2. 巡检/三方会诊"干巴"，没聊天感（4 列数据格子 + "X 视角："报告格式）
> 3. 整体是信息流，不是 3 个 Agent 真聊天 — 各说各话不互动
>
> **拍板（Q1A + Q2A + Q3A + Q4A）**：
>
> - 冷启动彻底优化（D7）
> - 内容白话化 + 删数据格子（D8）
> - **推翻 R1/R2/R3 fixed round → 链式聊天引擎**（D9 — 产品形态级重构）
> - 现在落 v3 修订段，task-18 派发时 v1+v2+v3 一起做
>
> **v3 是产品形态级重构**：v1 M2 删独立事件卡 / v2 D4 关系演化 / v2 D5 新闻流 全部保留；**v2 D9 R1/R2/R3 三轮辩论框架作废**，由 D9 链式聊天引擎替代。

### 10.1 D7 — 冷启动彻底优化（Q1A 全做）

#### 7.1 进页面立即可见内容

**当前问题**：用户进 watch 页 → stream 空白 → 等首条新闻 / 信号 → 静默过长。

**修订**：进页面立刻渲染**最近 3 场辩论的最后 5 条 message**（fileCache 持久化的历史聊天数据）：

```ts
// src/app/[locale]/agent/page.tsx server component
export default async function AgentPage() {
  const recentChats = await loadRecentChatHistory({ limit: 3, messagesPerChat: 5 });
  return <AgentWatchBoard initialMessages={recentChats} ... />;
}
```

不再"白屏等首条触发"，而是"进来就有内容看"。

#### 7.2 Hero 状态条（"3 派在线"实时感）

主舞台顶部加一行**派别在线状态**：

```
🟢 3 派在线 · 老 K 5min 前发言 · 老白 2min 前 · 老 G 现在 · 当前关注 BTC/ETH
```

每 30 秒更新一次。用户瞥一眼就知道"AI 真的活着"。

#### 7.3 5 秒铁律

**进页面 ≤ 5 秒必出第一条新 message**（即使没新闻 / 没信号）：

```
T+0       页面 mount，初始 stream 已渲染（历史 message）
T+800ms   typing indicator 开始（"老 K 正在分析早间走势..."）
T+3-5s    第一条新 message 滑入 stream
```

第一条来源优先级：

1. 实时行情突变 trigger（5min 内 ≥ 0.3% 价格变化 → 派别评论）
2. 关注币 chitchat（v2 D1 ChatterGenerator 触发）
3. 派别互问（v2 B4，"老 G 你昨天 SOL 那波咋样了？"）
4. 兜底：派别独白（v2 B1 catchphrase）

#### 7.4 后台预触发辩论

进页面后台**立即**调用 `tryOrchestrateNewsDebate(latestNews)`，用最近 30min 内最高 severity 新闻当种子（不等用户主动等待）。

### 10.2 D8 — 内容白话化 + 删数据格子（Q2A 全做）

#### 8.1 删 4 列数据格子（vs 当前 preview）

**当前 UI**（Dan 截图）：

```
现价        突破观察       回踩确认      失效
81,246      81,694         81,246        81,001
```

像 dashboard，不是聊天。

**修订**：**删除 4 列数据格子组件**。所有数字**融入聊天文字**：

❌ 旧：

```
[数据格子]
现价 81,246 | 突破观察 81,694 | 回踩确认 81,246 | 失效 81,001

老 K：突破视角：BTC 距前低 0.30%，下方止损单密集。触发：跌破 80,700；失效：站稳 81,500 回踩确认。
```

✅ 新：

```
老 K：操，BTC 现价 81246 离前低就 0.3%，下方止损单堆得跟坟头一样厚。
      跌破 80700 跟空，但要是它能稳在 81500 回踩不破，那就是死灰复燃。
```

数据点（81246 / 80700 / 81500）**融入文字**，没有独立格子。

#### 8.2 删"X 视角："报告前缀

❌ 禁止：

- "突破视角：xxx"
- "趋势视角：xxx"
- "回归视角：xxx"
- "Alpha 派认为："
- "基于派别分析："

✅ 强制：直接说话（带派别口吻）：

- "操，BTC 这波..."
- "我看 ETH 趋势没破..."
- "极端涨速太假了..."

LLM Prompt 加禁词 grep：含上面 5 类前缀 → retry → 仍违规 Agent 沉默。

#### 8.3 删"三方会诊"chip 标识

当前 preview 在每条 message 头部显示 `[三方会诊]` 紫色 chip — **这是把"会诊"当成 metadata 暴露了**，破坏聊天感。

**修订**：会诊 metadata 只在 stream 上方一条 chip 显示一次："📰 触发：BTC ETF inflows..." — 不在每条 message 上重复标。

#### 8.4 LLM Prompt 加聊天约束

```
你是 [派别 IP]。

[硬约束 — 违反则 retry]
- 直接说话，禁止 "X 视角：" / "X 派认为：" / "基于 X 分析"
- 禁止 "首先 / 其次 / 最后" 列举
- 输出 1-2 句（≤ 80 字）
- 必含 ≥ 1 个具体数字（价格 / 涨跌幅 / 时间窗口）
- 必有"所以 [行动]"结论锚（含具体价格触发）
- 允许语气词（操 / 妈的 / 草 / 真的服 / 蛇精病）— 但不脏话
```

### 10.3 D9 — 链式聊天引擎（Q3A 选项 A — 推翻 R1/R2/R3）

#### 9.1 产品形态级转向

**v2 R1/R2/R3 fixed round 作废**——9 句固定独白拼接 ≠ 真聊天。

**v3 链式聊天**：

- 每条 message 是独立单元（不是 round 内的一员）
- 每条 message 有 `replyTo` / `mentioning` / `expectsReply` 字段
- LLM 每次只生成 1 句 + 决定下一步谁说
- 总长度**动态**（5 句结束也行，20 句没完也行）
- **自然结束**（连续 3 条 `expectsReply=false`）

#### 9.2 数据模型

```ts
// src/lib/types.ts v3 新增
export interface ChatMessage {
  id: string;
  threadId: string; // 同一场聊天 thread 的标识
  ts: number;
  agentId: AgentId;
  content: string; // 1-2 句，自然聊天长度
  replyTo?: string; // 上一条 message id（cite 关系）
  mentioning?: AgentId; // 显式 @ 某派别（"老白 你..."）
  action: ChatAction;
  expectsReply: boolean; // 期待对方回应
  mood: ChatMood;
  citedQuote?: string; // 引用对方原话（可选）
}

export type ChatAction =
  | "open" // 开场（首次发起话题）
  | "rebut" // 反驳
  | "agree" // 附议
  | "question" // 追问求证
  | "taunt" // 嘲讽
  | "derail" // 跑题
  | "refocus" // 拉回主题
  | "comment" // 自由评论
  | "react" // 短反应（"草" / "卧槽"）
  | "concede" // 让步
  | "gloat"; // 嘚瑟（赢了就要嘚瑟）

export type ChatMood = "aggressive" | "agreeable" | "neutral" | "sarcastic" | "curious";

export interface ChatThread {
  id: string;
  seed: ConversationSeed; // 触发源（新闻 / 行情突变 / chitchat）
  messages: ChatMessage[];
  strategy: FinalStrategy | null; // 聊完后由 meta agent 提取（可能 null = 没共识）
  status: "active" | "completed";
  createdAt: number;
  completedAt?: number;
}
```

#### 9.3 链式编排器（核心算法）

```ts
// src/lib/chatOrchestrator.ts 新建
const MAX_TURNS = 20; // 单 thread 总条数上限（防失控）
const QUIET_STREAK_FOR_END = 3; // 连续 N 条 expectsReply=false 自然结束

export async function runChatThread(seed: ConversationSeed): Promise<ChatThread> {
  const thread: ChatThread = {
    id: makeThreadId(),
    seed,
    messages: [],
    strategy: null,
    status: "active",
    createdAt: Date.now(),
  };

  // 1. 开场
  const openerAgent = pickOpener(seed);
  const opener = await generateMessage({
    agentId: openerAgent,
    action: "open",
    seed,
    history: [],
  });
  thread.messages.push(opener);

  // 2. 链式循环
  while (thread.messages.length < MAX_TURNS) {
    // 自然结束判断
    const tail = thread.messages.slice(-QUIET_STREAK_FOR_END);
    if (tail.length === QUIET_STREAK_FOR_END && tail.every((m) => !m.expectsReply)) {
      break;
    }

    // 决定下一个说话者
    const next = pickNextSpeaker(thread.messages);
    if (!next) break;

    // 决定动作
    const action = pickAction(next, thread.messages);

    // 生成消息
    const msg = await generateMessage({
      agentId: next,
      action,
      seed,
      history: thread.messages.slice(-5), // 最近 5 条作上下文
    });
    thread.messages.push(msg);

    // typing 间隔（task-18 D2）
    await sleep(800 + Math.random() * 1200);
  }

  // 3. Meta agent 提取策略（可能 null = 没共识 → InsufficientConsensus 区块）
  thread.strategy = await synthesizeStrategy(thread.messages, seed);
  thread.status = "completed";
  thread.completedAt = Date.now();

  return thread;
}

function pickNextSpeaker(messages: ChatMessage[]): AgentId | null {
  const last = messages[messages.length - 1];
  if (!last) return null;

  // 优先级 1：被 @ 的人优先回应
  if (last.mentioning && last.mentioning !== last.agentId) {
    return last.mentioning;
  }

  // 优先级 2：expectsReply 时按"派别相关度 + 沉默时间"选
  if (last.expectsReply) {
    const candidates = (["alpha", "beta", "gamma"] as const).filter((a) => a !== last.agentId);
    return weightedPick(candidates, (a) => relevanceScore(a, last) * silenceWeight(a, messages));
  }

  // 优先级 3：随机找长时间没说话的派别（防一人主导）
  const silentAgents = findSilentAgents(messages);
  if (silentAgents.length > 0) {
    return silentAgents[0];
  }

  // 优先级 4：没人想说话 → 自然结束
  return null;
}

function pickAction(agentId: AgentId, history: ChatMessage[]): ChatAction {
  const last = history[history.length - 1];
  if (!last) return "open";

  // 被 @ → 高概率 rebut / question / concede（取决于关系 debt 值，v2 D4）
  if (last.mentioning === agentId) {
    const debt = getRelationshipDebt(agentId, last.agentId);
    if (debt > 5) return weightedPick({ concede: 35, question: 30, agree: 25, rebut: 10 });
    if (debt < -5) return weightedPick({ taunt: 30, gloat: 25, rebut: 30, question: 15 });
    return weightedPick({ rebut: 30, question: 25, agree: 20, taunt: 15, concede: 10 });
  }

  // 上一条 expectsReply → 多种回应
  if (last.expectsReply) {
    return weightedPick({ rebut: 25, agree: 20, question: 20, comment: 15, react: 10, taunt: 10 });
  }

  // 没 expectsReply → 自由评论 / 跑题 / 拉回
  return weightedPick({ comment: 35, react: 25, derail: 15, refocus: 10, taunt: 15 });
}
```

#### 9.4 LLM Prompt（每条 1 次调用）

```
你是 [派别 IP — 老 K / 老白 / 老 G]。

[本场情境]
触发源：${seed.description}
当前实时行情（数据 N 秒前）：
- BTC: $81,246 (24h +0.3%, 5min 序列 [...])
- ETH: $2,361 (...)
- ...

[最近 5 条聊天历史]
[列表 — 每条含 agentId / content / 时间]

[关系 debt 上下文]
- 你对老白当前 debt = ${debt_to_beta}（${interpretDebt(debt)}）
- 你对老 G 当前 debt = ${debt_to_gamma}（...）

[本次任务]
你的动作 = ${action}（${ACTION_DESCRIPTIONS[action]}）

[硬约束]
- 1-2 句聊天，不超 80 字
- 直接说话，禁 "X 视角：" / "X 派认为：" / 列举式
- 必含具体价格数字
- 必有"所以 [行动 + 价格触发]" 结论
- mentioning 字段：仅在显式 @ 某派别时填，否则 null
- expectsReply：你这句话期待回应吗？（true / false）
- mood：表达情绪
- 允许语气词（操 / 妈的 / 草 / 蛇精病）— 不脏话

[输出 JSON]
{
  "content": "...",
  "mentioning": "alpha|beta|gamma|null",
  "expectsReply": true|false,
  "mood": "aggressive|agreeable|neutral|sarcastic|curious",
  "citedQuote": "..." (可选，引用对方原话)
}
```

#### 9.5 Strategy 提取改 meta agent

不再是 fixed R3 共识总结，是**聊天 thread 完成后**由 meta agent 看全文提取：

```ts
async function synthesizeStrategy(messages: ChatMessage[], seed: ConversationSeed): Promise<FinalStrategy | null> {
  const prompt = `
[3 派完整聊天]
${messages.map(m => `${getNickname(m.agentId)}: ${m.content}`).join('\n')}

[实时行情] ${formatTickerContext(...)}

[任务] 整合上面 3 派聊天，提取可执行策略。
- 如果 3 派达成共识 → 输出 FinalStrategy
- 如果分歧大（连续多条互怼无收敛）→ 输出 null

[校验]（task-18 v1 M5 已有 strategyValidator）
- 数字必须相对当前价 ±10% 内
- long/short SL/TP 方向校验

[输出]
{
  "consensusReached": true|false,
  "strategy": FinalStrategy | null
}
`;
  // ... 调 LLM + retry + 校验失败渲染 InsufficientConsensus
}
```

#### 9.6 UI 渲染（chat thread）

```tsx
// Stream.tsx v3 重构
function ChatThreadRenderer({ thread }: { thread: ChatThread }) {
  return (
    <div>
      {/* 顶部触发源 chip（一次） */}
      <SeedChip seed={thread.seed} />

      {/* 链式 message 列表 */}
      {thread.messages.map((msg, idx) => (
        <ChatMessageBubble
          key={msg.id}
          message={msg}
          previousMessage={idx > 0 ? thread.messages[idx - 1] : undefined}
          showCiteIndicator={!!msg.replyTo} // 有 replyTo → 显示 ↘ cite 引用
          showMention={!!msg.mentioning} // 有 mentioning → 高亮被 @ 的派别名
        />
      ))}

      {/* 策略卡（条件渲染：consensusReached=true 才出） */}
      {thread.strategy ? (
        <FinalStrategyBlock strategy={thread.strategy} />
      ) : (
        <InsufficientConsensus messages={thread.messages} />
      )}
    </div>
  );
}
```

`ChatMessageBubble` 视觉关键点：

- @ mention 高亮显示派别名（紫色 / 派别色）
- replyTo 时显示 ↘ 缩进引用气泡（"↘ 老 K 刚才说：操 BTC 这波..."）
- action 决定 emoji 前缀（rebut → 💥 / agree → 🤝 / taunt → 😏 / concede → 😔 / gloat → 😎 / question → ❓ / derail → 🤷 / refocus → 🎯）

#### 9.7 链式编排自然结束的条件

| 条件                 | 触发                                |
| -------------------- | ----------------------------------- |
| 自然结束             | 连续 3 条 `expectsReply=false`      |
| 总长度上限           | `messages.length >= 20`             |
| 没人想说话           | `pickNextSpeaker()` 返回 null       |
| LLM retry 总次数超限 | 单 thread 累计 retry ≥ 5 → 强制结束 |

#### 9.8 v2 R1/R2/R3 部分作废

**作废**：

- task-15 / task-18 v2 内 `runRound1` / `runRound2` / `runRound3` 函数
- task-15 / task-18 v2 内 R1/R2/R3 prompt 模板
- task-15 / task-18 v2 内 fixed 9-utterance 编排逻辑

**保留**（v2 D4/D5/D7/D8 兼容）：

- 派别 IP / Win-rate / 关系 debt 数据模型 → 链式聊天引擎复用
- 新闻流 ConversationSeed 触发 → seed 喂给 chatOrchestrator
- ChatterGenerator 触发空闲聊天 → seed=`{kind: 'chitchat'}` 喂给 chatOrchestrator
- M5 策略数字校验 → synthesizeStrategy 内复用

### 10.4 v3 文件结构（vs v2）

#### 新建（v3）

```
src/lib/chatOrchestrator.ts                    # 链式编排器（D9）
src/lib/chatActions.ts                          # ChatAction 定义 + pickAction 算法
src/lib/chatHistoryStore.ts                    # ChatThread 持久化（fileCache）
src/modules/agent-watch/components/ChatThreadRenderer.tsx
src/modules/agent-watch/components/ChatMessageBubble.tsx     # 替代 v1/v2 UtteranceBubble
src/modules/agent-watch/components/SeedChip.tsx              # 触发源 chip（一次显示）
src/modules/agent-watch/components/FactionPresenceBar.tsx    # D7 hero 状态条（"3 派在线"）
src/modules/agent-watch/components/InitialChatPreloader.tsx  # D7 进页面预加载历史
```

#### 修改（v3）

```
src/lib/llmFallbackChain.ts            # D8 加 prompt 禁词约束 + chat 格式约束
src/lib/debateOrchestrator.ts          # 大改：从 R1/R2/R3 fixed → 调 chatOrchestrator
src/lib/strategyValidator.ts            # 复用 v1 M5 校验，但接入 synthesizeStrategy
src/modules/agent-watch/components/Stream.tsx              # 渲染 ChatThread 不是 utterances
src/modules/agent-watch/components/FinalStrategyBlock.tsx  # 接受 strategy = null 时不渲染
src/app/[locale]/agent/page.tsx        # D7 server component 加 loadRecentChatHistory
src/lib/analytics.ts                   # 加 chat_thread_view / chat_message_action 事件
```

#### 作废（v2 R1/R2/R3）

```
src/lib/llmFallbackChain.ts 内的 R1/R2/R3 prompt 段落
src/lib/debateOrchestrator.ts 内的 runRound1 / runRound2 / runRound3 函数
src/modules/agent-watch/components/UtteranceBubble.tsx     # 被 ChatMessageBubble 替代
src/modules/agent-watch/components/RoundBanner.tsx          # 不再有 round 概念
v2 task-15 § 5 R1/R2/R3 9-utterance 编排逻辑
```

### 10.5 v3 commit 阶段（按 Codex 节奏）

**不预设阶段数 / 不预设顺序时长**——Codex 自决推进。建议合理分组：

- 第一组：数据模型 + chatOrchestrator + 链式 prompt（核心引擎）
- 第二组：UI 重构（ChatThreadRenderer + ChatMessageBubble + 删 UtteranceBubble/RoundBanner）
- 第三组：D7 冷启动（FactionPresenceBar + InitialChatPreloader + 5 秒铁律）
- 第四组：D8 删 4 列数据格子 + 删 X 视角前缀 + LLM 禁词
- 第五组：v2 R1/R2/R3 调用方迁移 + 分析事件 + ARCHITECTURE 同步

每组按 Codex 实施节奏推 commit，commit message 标 `task-18 v3 chunk-N` 即可。

### 10.6 v3 验收清单（叠加 v1+v2，覆盖 R1/R2/R3 部分作废）

#### D7 冷启动

- [ ] 进页面立刻看到最近 3 场辩论的最后 5 条 message（不空白）
- [ ] 顶部 `FactionPresenceBar` 显示"3 派在线 + 上次发言时间 + 当前关注"
- [ ] `FactionPresenceBar` 每 30s 更新一次
- [ ] 进页面 ≤ 5 秒必出第一条**新** message（不算预加载历史）

#### D8 内容白话 + 删数据格子

- [ ] grep `Round` / `R1` / `R2` / `R3` / `runRound` 在 v3 实施后 0 命中（除作废注释）
- [ ] grep "突破视角" / "趋势视角" / "回归视角" / "X 派认为" 在 LLM 输出 0 命中
- [ ] grep "首先" / "其次" / "综上" 在 LLM 输出 0 命中
- [ ] UtteranceBubble.tsx 不再有 4 列数据格子（grep 该组件无 `flex` 4 列布局）
- [ ] 4 列数据组件文件已删（如 `StrategyFactGrid.tsx` 之类）
- [ ] `[三方会诊]` chip 标识不再每条 message 重复显示，只在 SeedChip 顶部显示一次

#### D9 链式聊天引擎

- [ ] `runChatThread` 实现链式编排（pickNextSpeaker / pickAction / generateMessage）
- [ ] 每条 ChatMessage 有 `replyTo / mentioning / action / expectsReply` 字段
- [ ] LLM 每次只生成 1 条 message（grep `llmGenerate` 调用，每次 max_tokens 80 字以内）
- [ ] thread 自然结束：连续 3 条 `expectsReply=false` 触发停止
- [ ] thread 总条数上限 20（防失控）
- [ ] `ChatMessageBubble` 渲染 mention 高亮 + replyTo 缩进引用 + action emoji 前缀
- [ ] strategy 提取改 `synthesizeStrategy` meta agent，可能返回 null
- [ ] strategy=null 时渲染 InsufficientConsensus（v1 M5）

#### v2 R1/R2/R3 作废验证

- [ ] grep `runRound1` / `runRound2` / `runRound3` 0 命中
- [ ] `UtteranceBubble.tsx` / `RoundBanner.tsx` 文件已删
- [ ] task-15 / task-18 v2 内 9-utterance fixed 编排代码已迁移到 chatOrchestrator

#### 性能

- [ ] 单场链式聊天 LLM 调用 ≤ 25 次（20 条 message + 5 次 retry）
- [ ] LLM 总成本：每场聊天 ≤ ¥0.3（DeepSeek 估算，Codex 跑实测验证）

### 10.7 v3 风险与边界

| 风险                                     | 缓解                                                        |
| ---------------------------------------- | ----------------------------------------------------------- |
| 链式编排无限循环                         | MAX_TURNS=20 硬上限 + 连续 3 条 expectsReply=false 强制结束 |
| LLM 决定 expectsReply 不准（永远 true）  | pickNextSpeaker 算法独立判断，不全依赖 expectsReply 字段    |
| 派别永远只有 1 人主导                    | silenceWeight 强制冷门派别加权                              |
| @ mention 错乱（@ 自己 / @ 不存在派别）  | Schema 校验 + retry                                         |
| 关系 debt 注入 prompt 后 LLM 输出脱节    | dev mode 跑 ≥ 50 场 thread 验证 mood / action 分布合理      |
| LLM 输出"突破视角："虽然 retry 仍重复    | 给 5 个具体范例 + 后处理 grep + 沉默兜底                    |
| 用户跟不上聊天节奏（消息出太快）         | typing 间隔 800-2000ms 固定下限，避免用户错过               |
| Strategy 长期出 null（共识不足触发率高） | PostHog 监控，> 30% null 触发产品级 review                  |

### 10.8 v3 派发文本（替代 v2 派发文本）

```
项目：claw42
工作路径：/Users/dannybrown/Claude/职业规划/web-dev/claw42
Spec：docs/airy-tasks/task-18-watch-chat-immersive.md
       含 § 1-§ 8（v1 M1-M5）+ § 9（v2 D1-D6）+ § 10（v3 D7-D9）
       ⚠️ 实施前先看 § 10 v3 修订段（产品形态级重构），再回看 v1/v2 细节

新分支：feature/watch-chat-immersive-01
PR target：feature/act1-5-watch-page-01

前置：task-15 PR #21 + task-17 PR #26（多源 chain）已 merge

═══════════════════════════════════════════════
v3 核心：推翻 R1/R2/R3，链式聊天引擎
═══════════════════════════════════════════════

D7 冷启动（Q1A 全做）：
- 进页面预加载最近 3 场辩论历史
- FactionPresenceBar 顶部"3 派在线"状态条
- 5 秒铁律：进页面 ≤ 5 秒必出第一条新 message
- 后台预触发辩论（不等用户）

D8 内容白话 + 删数据格子（Q2A 全做）：
- 删 4 列数据格子（现价/突破观察/回踩确认/失效）— 数据融入聊天文字
- 删 "X 视角：" / "X 派认为：" 报告前缀
- 删每条 message 上的 [三方会诊] chip（只在 SeedChip 顶部显示一次）
- LLM Prompt 加聊天约束（语气词 + 短句 + 具体数字）

D9 链式聊天引擎（Q3A 选项 A — 产品形态级重构）：
- ChatMessage 数据模型（replyTo / mentioning / action / expectsReply / mood）
- chatOrchestrator 链式编排（pickNextSpeaker + pickAction + 自然结束）
- ChatAction 11 种（open/rebut/agree/question/taunt/derail/refocus/comment/react/concede/gloat）
- 每条 LLM 1 次调用 + 决定下一步谁说
- 自然结束（连续 3 条 expectsReply=false / 上限 20 条）
- synthesizeStrategy meta agent 提取（可能 null → InsufficientConsensus）

【v2 R1/R2/R3 部分作废】
- runRound1/2/3 函数删除
- UtteranceBubble / RoundBanner 组件删除（被 ChatMessageBubble 替代）
- task-15 / task-18 v2 内 9-utterance fixed 编排代码迁移到 chatOrchestrator

【v2 保留】
- 派别 IP / Win-rate / 关系 debt（D4）/ 新闻流 D5 / Stream 自适应 D1 / typing D2 / 跟单按钮 D3 / 反馈按钮 D6 — 全部保留

关键约束：
1. NewsItem schema 严格不变
2. SourceRegistry / 多源 chain（task-17）不动
3. 每条 message ≤ 80 字（聊天自然长度）
4. 必含具体数字 + "所以 X" 结论锚（D8）
5. mention/replyTo 校验严格（schema + grep）
6. 自然结束严格执行（防 LLM 无限循环）
7. synthesizeStrategy 校验失败 → 渲染 InsufficientConsensus（v1 M5）

⚠️ v3 是产品形态级重构，工程量大。Codex 按自己节奏分阶段推 commit，commit message 标 task-18 v3 chunk-N。

verify + Vercel preview 必过 8 项：
- 进页面 ≤ 5 秒看到第一条新 message
- 不空白（预加载历史 + 状态条）
- 4 列数据格子已删（grep 验证）
- "X 视角：" 前缀已删（grep LLM 输出）
- ChatMessageBubble 显示 @ mention 高亮 + replyTo 缩进引用
- thread 自然结束（dev mode 模拟 LLM 全部 expectsReply=false）
- strategy 校验失败 → 渲染 InsufficientConsensus
- 旧 R1/R2/R3 代码已删（grep runRound1 = 0）
```

---

_v3 修订: 2026-05-06（Dan 三反馈拍板 1A/2A/3A/4A — 推翻 R1/R2/R3，链式聊天引擎，产品形态级重构）_

---

## 11. v3.1 紧急 patch（2026-05-06 Dan 看 v3 preview 后 2 个根因）

> **触发**：Codex 推 v3 preview 后 Dan 截图反馈：
>
> 1. "依旧机械输出，没对话和交流的感觉"
> 2. "辩论也是，所谓'动手'、'再追'是什么意思？开多还是开空？需要说清楚"
>
> 诊断 3 根因：
>
> - **R1 报告前缀变体绕过 D8 grep**（截图："破位:"/"趋势:"/"极端:"/"Gamma 复核:" 等）
> - **方向词模糊** — "再追"/"再动手"/"再干" 不说多空
> - **链式聊天没启动** — 3 条 message 独白拼接后就结束，replyTo/mentioning/expectsReply 没真正互动

### 11.1 R1 — 报告前缀完全清扫（D8 grep 扩展）

**v3 D8 禁词漏洞**：只列"X 视角："/"X 派认为：" 字面值，LLM 钻空子用变体。

**v3.1 修订**：扩展禁词模式到**正则**，覆盖所有变体。

#### 11.1.1 禁词正则（grep 校验）

```ts
// src/lib/llmFallbackChain.ts 或 src/lib/news/normalizer.ts 后处理
const FORBIDDEN_PREFIX_PATTERNS = [
  // 派别名 / 派别动作 + 冒号开头
  /^(Alpha|Beta|Gamma|老 ?K|老 ?白|老 ?G)[:：]/i,
  /^(突破|破位|趋势|极端|回归|反转|顺势|逆势|追涨|杀跌|盘整|横盘)[:：]/,
  /^(突破派|趋势派|回归派|破位派|极端派)[:：]/,

  // "派别名 + 动作 + 冒号"组合
  /^(Alpha|Beta|Gamma|老 ?K|老 ?白|老 ?G)\s*(说|看|认为|分析|视角|观察|复核|提点|怒怼|阴阳)[:：]/i,

  // "X 视角:" "X 派认为:" 字面值（v3 已有）
  /(突破|趋势|回归|破位|极端|反转)视角[:：]/,
  /(突破派|趋势派|回归派)认为[:：]/,

  // 列举式
  /^(首先|其次|再次|然后|最后|总之|综上)[，,：:]/,
];

function hasForbiddenPrefix(content: string): boolean {
  return FORBIDDEN_PREFIX_PATTERNS.some((re) => re.test(content.trim()));
}
```

#### 11.1.2 sanitize 函数（兜底，retry 失败仍出现禁词时执行）

```ts
function stripForbiddenPrefix(content: string): string {
  let cleaned = content.trim();
  for (const re of FORBIDDEN_PREFIX_PATTERNS) {
    cleaned = cleaned.replace(re, "").trim();
  }
  return cleaned;
}
```

#### 11.1.3 LLM Prompt 强化（5 个具体反例）

```
[硬约束 — 禁止以下格式开头，违反即重新生成]
❌ "破位: BTC ..." → 不要冒号 + 派别动作词开头
❌ "趋势: SOL ..." → 不要冒号 + 派别动作词开头
❌ "Alpha: BTC ..." → 不要派别名 + 冒号
❌ "老 K 复核: ..." → 不要"派别名 + 动作 + 冒号"
❌ "突破派认为..." → 不要"派别 + 认为"

✅ "操，BTC 这放量 3.8 倍，价格 80936 还磨在 81k 没破前低..."
✅ "我看 SOL 这趋势没共振，仓位别加..."
✅ "$USDUC 现价没到极端位置，等失速再说..."

直接说话，不要任何"派别 + 动作 + 冒号"前缀。
```

### 11.2 R2 — 方向硬约束（关键产品规则）

**用户读 strategy 必须立即知道做多还是做空**。

#### 11.2.1 动作词必带方向（grep 强校验）

LLM 输出含**动作词**时必须紧跟**方向词**：

```ts
const ACTION_WORDS = ["追", "跟", "做", "动手", "干", "上车", "入场", "建仓", "加仓"];
const DIRECTION_WORDS = ["多", "空", "等", "不动"];

function hasAmbiguousAction(content: string): { ambiguous: boolean; offendingPhrase?: string } {
  for (const action of ACTION_WORDS) {
    const regex = new RegExp(`(再|要|就)?\\s*${action}(?!\\s*(${DIRECTION_WORDS.join("|")}))`, "g");
    const match = content.match(regex);
    if (match) {
      return { ambiguous: true, offendingPhrase: match[0] };
    }
  }
  return { ambiguous: false };
}
```

**触发处理**：

1. retry 1 次（注入失败原因："你说了'再追'但没说追多还是追空，重写"）
2. retry 仍失败 → Agent 该条沉默（不输出垃圾）

#### 11.2.2 LLM Prompt 强化（带反例）

```
[方向硬约束 — 用户必须立即知道你想做多还是做空]

❌ "再追" / "再动手" / "再干" — 不说方向用户读不懂
❌ "破位就等失速再动手" — "动手"是开多还是开空？
❌ "站稳 82,752 再追" — 追多还是追空？

✅ "破 80,700 跟空，止损 81,000，止盈 80,200" — 方向 + 价格全有
✅ "站稳 82,752 追多，目标 83,500" — 方向 + 触发 + 目标全有
✅ "现在不动" — 明确不入场也算合规

含"追/做/上车/入场/建仓/动手"等词时，必须紧跟"多"/"空"/"等"/"不动"。
```

#### 11.2.3 strategy 卡 UI 同步加方向 chip

`FinalStrategyBlock` 顶部明确显示方向标签（已有但放大字号 + 加色）：

```
🟢 多头 · BTC · 共识 2:1
🔴 空头 · ETH · 共识 3:0
⚪ 等待 · SOL · 共识 1:2
```

### 11.3 R3 — 链式聊天真正启动

**当前 v3 实现链断在第 3 条**（Codex 实施时太保守）。

#### 11.3.1 强制开场 N 条内必须 expectsReply=true

```ts
// chatOrchestrator.ts 修订
function generateMessage(opts: GenerateOpts): Promise<ChatMessage> {
  // ...
  const isEarlyPhase = opts.history.length < 4;

  // 早期强制开放（不让 LLM 决定 expectsReply）
  if (isEarlyPhase && opts.action === "open") {
    msg.expectsReply = true; // 强制
  }
  if (isEarlyPhase && opts.action !== "open") {
    // R2-R4 段落，70% 概率强制 expectsReply=true（不全靠 LLM 决定）
    if (Math.random() < 0.7) msg.expectsReply = true;
  }
}
```

#### 11.3.2 强制 mention（前 6 条至少 ≥ 2 条带 mention）

```ts
function pickAction(agentId: AgentId, history: ChatMessage[]): ChatAction {
  // ...
  // 第 2-6 条强制鼓励 mention 动作（rebut/question/taunt）
  if (history.length >= 1 && history.length <= 5) {
    const last = history[history.length - 1];
    const mentionedTypes: ChatAction[] = ["rebut", "question", "taunt", "agree"];

    // 70% 概率强制选 mention 类动作 + 强制 mentioning = last.agentId
    if (Math.random() < 0.7) {
      return weightedPick(mentionedTypes);
    }
  }
}

function generateMessage(opts: GenerateOpts) {
  // ...
  // 如果 action 是 rebut/question/taunt/agree，强制 mentioning = 上一条 agentId
  const mentionActions: ChatAction[] = ["rebut", "question", "taunt", "agree"];
  if (mentionActions.includes(opts.action)) {
    msg.mentioning = opts.history[opts.history.length - 1]?.agentId;
  }
}
```

#### 11.3.3 LLM Prompt 强制 cite 对方原话

```
[本次任务]
你的动作 = ${action}
你需要 @ 的派别 = ${mentioning}（${mentioningNickname}）

[最近 5 条聊天]
[列表 — 标注每条的 agentId / content]

[硬约束]
- 你必须 cite 对方某句话的具体内容（在 citedQuote 字段）
- citedQuote 不能是空字符串，必须是从对方某条 message 里**抠出原话**（≤30 字）
- content 必须呼应 citedQuote — 不能完全跑题

[输出 JSON]
{
  "content": "...",
  "mentioning": "${mentioning}",     // 已固定
  "citedQuote": "..."                 // 从对方某条原话抠出
  ...
}
```

后处理 grep：`mentioning` 字段非 null 时，`citedQuote` 必须非空且 ≥ 5 字。空或太短 → retry。

#### 11.3.4 自然结束门槛抬高

**v3 当前**：连续 3 条 `expectsReply=false` → 自然结束。
**v3.1 修订**：抬高到**5 条**，并叠加最小总条数门槛：

```ts
const QUIET_STREAK_FOR_END = 5; // v3 是 3
const MIN_TOTAL_MESSAGES = 6; // 至少 6 条才允许自然结束（防过早终止）

while (thread.messages.length < MAX_TURNS) {
  const tail = thread.messages.slice(-QUIET_STREAK_FOR_END);
  if (
    thread.messages.length >= MIN_TOTAL_MESSAGES &&
    tail.length === QUIET_STREAK_FOR_END &&
    tail.every((m) => !m.expectsReply)
  ) {
    break;
  }
  // ...
}
```

### 11.4 v3.1 验收（叠加 v1+v2+v3）

#### R1 报告前缀清扫

- [ ] grep LLM 输出（最近 50 条 message）：开头不含"破位:"/"趋势:"/"极端:"/"回归:"/"Alpha:"/"Beta:"/"Gamma:"/"老 K:"/"老白:"/"老 G:"/"派别名+动作+冒号"模式
- [ ] FORBIDDEN_PREFIX_PATTERNS 正则覆盖 6+ 类变体
- [ ] sanitize 兜底函数实现且接入 retry 流程

#### R2 方向硬约束

- [ ] grep LLM 输出：含"追/做/上车/入场/建仓/动手/干"动作词的句子，紧跟必有"多/空/等/不动"
- [ ] strategy 卡顶部显示明确方向 chip（🟢多头 / 🔴空头 / ⚪等待）
- [ ] dev mode 模拟 LLM 输出"再追" → 触发 retry，retry 仍失败 → Agent 沉默

#### R3 链式聊天真启动

- [ ] 单 thread 至少 ≥ 6 条 message（MIN_TOTAL_MESSAGES）
- [ ] 前 6 条至少 2 条 `mentioning ≠ null`（grep 验证）
- [ ] 含 mentioning 的 message 必有非空 `citedQuote`（grep 验证）
- [ ] 早期 4 条 `expectsReply` 强制为 true（不全靠 LLM 决定）
- [ ] 自然结束门槛：连续 5 条 `expectsReply=false` 才结束（不是 3 条）

### 11.5 v3.1 commit 推进

按 Codex 节奏单 commit 出齐 R1+R2+R3 patch（变更范围集中在 LLM Prompt + chatOrchestrator + grep 校验，不动 UI 组件结构）。

commit message：

```
fix(chat-v3): close prefix variants + direction enforcement + chain forcing (task-18 v3.1)

R1 — Forbidden prefix patterns extended to regex covering all "派别名/动作 + 冒号" variants;
     sanitize fallback when retry fails

R2 — Direction enforcement on action words ("追/做/动手" must be followed by "多/空/等/不动");
     strategy block UI shows explicit direction chip

R3 — Chain forcing: early-phase expectsReply=true (≥70%) + mention actions in turns 2-6 +
     citedQuote required when mentioning≠null + natural-end threshold raised from 3 to 5
     (with MIN_TOTAL_MESSAGES=6 floor to prevent premature termination)
```

### 11.6 v3.1 派发文本

```
项目：claw42
工作路径：/Users/dannybrown/Claude/职业规划/web-dev/claw42
Spec：docs/airy-tasks/task-18-watch-chat-immersive.md § 11 v3.1（紧急 patch）

分支：feature/watch-chat-immersive-01（同 v3 分支，加 commit 不开新分支）

3 个 patch 单 commit：

R1 — 禁词正则扩展（6+ 模式）
- src/lib/llmFallbackChain.ts 的 FORBIDDEN_PREFIX_PATTERNS 改正则
- 覆盖："破位:" / "趋势:" / "极端:" / "Alpha:" / "Beta:" / "Gamma:" / "老 K:" / "老白:" / "老 G:" / "派别名 + 动作 + 冒号"
- sanitize 兜底函数

R2 — 方向硬约束
- grep 检测含"追/做/动手/干/上车/入场"等动作词时必须紧跟"多/空/等/不动"
- 不合规 → retry 1 次 → 仍失败 Agent 沉默
- LLM Prompt 加 5 个反例
- FinalStrategyBlock 顶部加明确方向 chip（🟢多头 / 🔴空头 / ⚪等待）

R3 — 链式聊天真启动
- 早期 4 条 expectsReply=true 70% 强制（不全靠 LLM 决定）
- 第 2-6 条 70% 选 mention 类动作（rebut/question/taunt/agree）
- mentioning ≠ null 时 citedQuote 必须非空 ≥ 5 字
- QUIET_STREAK_FOR_END: 3 → 5
- MIN_TOTAL_MESSAGES: 0 → 6（防过早终止）

verify + preview 验收：
- 截图任意 thread：≥ 6 条 message，前 6 条 ≥ 2 条带 mention + citedQuote
- 任意 message 不含报告前缀变体（grep）
- 任意 strategy 卡显示明确方向 chip
- 任意 message 含动作词必带方向（grep）
```

---

_v3.1 紧急 patch: 2026-05-06（Dan 看 v3 preview 反馈 — 报告前缀变体清扫 + 方向硬约束 + 链式聊天真启动）_

---

## 12. v3.2 — 产品体验文案级翻译（2026-05-06 Dan 反馈"机械感"）

> **触发**：Dan 看 v3.1 后 preview 反馈：
>
> - "3 派在线 · Alpha **刚上线** · Beta **刚刚**" — UI 状态文案 dev 术语化
> - "$BTC **实时上下文还在刷新**" — 技术细节暴露给用户
> - "**Gamma 复核：** $DOGS 回归窗口未完全打开" — 报告前缀变体仍漏（v3.1 R1 grep 没列"复核"）
> - "等待条件：xxx；失效看 xxx" / "市场摘要：xxx" — 结构化报告格式仍出
>
> **核心反馈**："要从用户的角度考虑整个页面，来了后看到的是**人性化的讨论**，而非机械的信息"
>
> **v3.2 = 整个页面文案级翻译** — 把所有 UI 静态文案 + LLM 输出从"程序员视角"翻译到"用户视角"。

### 12.1 P1 — UI 静态文案人性化（Codex 实施时枚举）

#### 12.1.1 FactionPresenceBar 文案重写

**当前**（错）：

```
🟢 3 派在线 · Alpha 刚上线 · Beta 刚刚 · Gamma 刚上线
```

**修订**（基于派别**当前状态**而非"登录态"）：

```
🟢 3 派都在 · 老 K 在看 BTC 5min · 老白 刚说完话 · 老 G 在算极端值
```

文案动态生成规则：

```ts
function getFactionStatusText(
  agentId: AgentId,
  lastMsg: ChatMessage | null,
  currentFocus: string | null,
): string {
  const nickname = getNickname(agentId); // 老 K / 老白 / 老 G

  // 刚说完话（< 60s）
  if (lastMsg && Date.now() - lastMsg.ts < 60_000) {
    return `${nickname} 刚说完话`;
  }

  // 正在分析特定标的
  if (currentFocus) {
    const focusVerbs = {
      alpha: "盯", // 老 K 盯 BTC 5min
      beta: "看", // 老白 看 ETH 趋势
      gamma: "算", // 老 G 算 SOL 极端值
    };
    return `${nickname} ${focusVerbs[agentId]} ${currentFocus}`;
  }

  // 默认（无特定焦点）
  const idleVerbs = {
    alpha: "在等关键位",
    beta: "在看趋势线",
    gamma: "在算波动率",
  };
  return `${nickname} ${idleVerbs[agentId]}`;
}
```

**禁用词**（grep 验证 UI 组件不出现）：

- ❌ "在线" / "刚上线" / "已上线" / "在线状态" / "登录"
- ❌ "刚刚"（用户视角=刚登录）
- ❌ "已加入" / "已就绪"

允许：

- ✅ "X 在 [做某事]"
- ✅ "X 刚说完话"
- ✅ "X 在等 [触发]"

#### 12.1.2 typing indicator 保留 v2 D2 设计（OK 不改）

`agentTypingPhrases.ts` 已有 8 句/派轮换（"老 K 正在分析行情..." 等），文案 OK 不动。

#### 12.1.3 SeedChip / 触发源 chip 文案

**当前**（可能出现）：

- "**事件触发**：BTC ETF inflows..."
- "**信号触发**：BTC 5m 放量 3.8x"

**修订**：

- ✅ "🔥 BTC ETF inflows hit $1.2B record"（直接显示新闻 / 事件标题）
- ✅ "📊 BTC 5min 放量了"（行情突变用自然描述）

不要"事件" / "信号" / "触发" / "钩子" 等 dev 词。

#### 12.1.4 InsufficientConsensus 区块

**当前**（可能出现）：

- "**等待信号** $BTC | 暂不输出策略 | Agent 已发现行情线索，但入场、止损、止盈点位未通过实时价格校验。"

**修订**（人话）：

- "**老 K 没把握** · BTC | 现在没清晰策略 | 老 K 看到了 BTC 这波 5min 放量 3.8 倍，但 80,946 这个支撑还没真破，先看着，等下一跳。"

**关键词替换**：

- ❌ "Agent 已发现行情线索" → ✅ "老 K 看到了 BTC 这波..."
- ❌ "未通过实时价格校验" → ✅ "[具体原因，自然话]"
- ❌ "暂不输出策略" → ✅ "现在没清晰策略" / "我没把握，先看着"

### 12.2 P2 — LLM 输出禁词扩展（v3.1 R1 patch 漏的全补上）

**v3.1 漏的报告前缀**：

```ts
// FORBIDDEN_PREFIX_PATTERNS 补充（v3.2）
const FORBIDDEN_PREFIX_PATTERNS_V3_2 = [
  // v3.1 已有的 + 补充：
  /^(Alpha|Beta|Gamma|老\s?K|老\s?白|老\s?G)\s*(说|看|认为|分析|视角|观察|复核|提点|怒怼|阴阳|追问|反驳|附议|嘲讽)[:：]/i,

  // 新加：报告式开头变体
  /^(等待条件|市场摘要|本次摘要|当前判断|核心观点|结论|总结|风险提示)[:：]/,

  // 新加：技术状态词
  /^(实时上下文|上下文|信号触发|事件触发|队列|推送|钩子|回调|刷新)[:：]/,
];
```

**v3.2 LLM Prompt 加全清单反例**：

```
[硬约束 — 禁止以下格式]

❌ "破位:" / "趋势:" / "极端:" / "回归:" — 派别动作 + 冒号
❌ "Alpha:" / "Beta:" / "Gamma:" / "老 K:" / "老白:" / "老 G:" — 派别名 + 冒号
❌ "Gamma 复核:" / "老 K 追问:" / "老白 反驳:" — 派别 + 动作 + 冒号
❌ "等待条件:" / "市场摘要:" / "核心观点:" / "结论:" — 报告式开头
❌ "实时上下文还在刷新" / "信号触发" / "事件触发" — 技术词汇

✅ "操，TON 这破位..." / "我看 SOL 趋势..." / "$DOGS 这位置..."
✅ "等数据" / "等 30 秒看新价格" / "现在拉不到，停 1 分钟"
✅ "我看到 X 这波..." / "我没把握" / "现在没清晰策略"

记住：你在和朋友聊天，不是写报告。
```

### 12.3 P3 — "数据等待" 类技术 message 改 Agent 自然话

**问题**：v3 实施时给"实时上下文还在刷新"这种技术状态写成 LLM 输出 message，违反"人性化"。

**修订**：

#### 12.3.1 ticker 拉不到时的 fallback message（v1 M4 重写）

**当前**（错）：

```
[Beta · 11:27]
$BTC 实时上下文还在刷新，所以先等下一跳价格再判断。
```

**修订**（自然话）：

```
[Beta · 11:27]
等 30 秒，BTC 数据还没到，看新价格再说。
```

LLM Prompt 模板（ticker 失败时）：

```
[本次任务]
ticker 数据拉取失败，你需要输出"我在等数据"的自然口语短句。

[硬约束]
- 1 句话 ≤ 30 字
- 不用"实时上下文" / "刷新" / "下一跳" / "信号" 等 dev 词
- 用"等数据" / "等会儿看" / "现在拉不到" / "数据还没到" 等自然话
- 派别口吻保持

[5 个反例]
✅ "等数据，30 秒后看"
✅ "BTC 数据还没到，先停一下"
✅ "现在拉不到，等会儿"
✅ "数据没刷出来，等 1 分钟"
✅ "服务器慢，等等再说"

❌ "实时上下文还在刷新"
❌ "等待下一跳价格"
❌ "信号尚未确认"
❌ "事件队列处理中"
```

#### 12.3.2 SeedChip 触发文案

```ts
// SeedChip.tsx
function getSeedDescription(seed: ConversationSeed): string {
  switch (seed.kind) {
    case "news":
      return seed.newsTitle; // 直接显示新闻标题，不加"事件触发："
    case "price_move":
      return `${seed.symbol} ${seed.changeStr}`; // "BTC 5min 放量 3.8x"，不加"信号触发："
    case "replay_review":
      return `${getNickname(seed.agentId)} 上次说对了`;
    case "history_recall":
      return `${seed.daysAgo}天前的 ${seed.theme}`;
    case "agent_query":
      return `${getNickname(seed.questionerAgentId)} 问 ${getNickname(seed.targetAgentId)}`;
    case "silence_chitchat":
      return `${seed.symbol} 静悄悄`;
  }
}
```

**所有 chip 文案禁词**：grep `事件触发|信号触发|队列|钩子|回调|实时上下文` → 0 命中。

### 12.4 P4 — i18n 同步翻译

`src/i18n/dicts/*.json` 内所有 UI 静态文案 grep 检查：

```bash
grep -rEn '在线|刚上线|刚刚|已上线|实时上下文|信号触发|事件触发|暂不输出策略|未通过.*校验' src/i18n/dicts/
```

每条命中按 § 12.1-12.3 规则翻译到自然话，10 语 dict 全更新。

### 12.5 v3.2 验收清单

#### P1 UI 静态文案人性化

- [ ] grep `src/modules/agent-watch/components/` 内组件无"在线"/"刚上线"/"刚刚"
- [ ] FactionPresenceBar 显示"派别 + 动词 + 当前焦点"格式（"老 K 在看 BTC 5min"）
- [ ] grep i18n dict 无"在线" / "刚上线"等 dev 术语（10 语都改）

#### P2 LLM 输出禁词扩展

- [ ] FORBIDDEN_PREFIX_PATTERNS 含所有 v3.1 + v3.2 补丁正则（≥ 10 类模式）
- [ ] grep 最近 100 条 LLM message：开头不含"复核:"/"追问:"/"反驳:"/"等待条件:"/"市场摘要:"/"实时上下文" 等
- [ ] LLM Prompt 含 v3.2 全清单反例（≥ 12 个 ❌ + 8 个 ✅）

#### P3 技术 message 自然话

- [ ] "ticker 拉不到"场景 LLM 输出自然话（grep 无"实时上下文"/"下一跳"/"信号尚未"等）
- [ ] SeedChip 文案不含"事件触发" / "信号触发" / 任何 dev 词
- [ ] InsufficientConsensus 区块文案改人话（"老 K 没把握" / "现在没清晰策略"）

#### P4 i18n 同步

- [ ] 10 语 dict 都翻译完成（zh_CN / zh_TW / en_US 至少完整，其他可 fallback en_US）

### 12.6 v3.2 commit

按 Codex 节奏单 commit 出齐 P1+P2+P3+P4，commit message：

```
fix(chat-v3.2): UI copy humanization + prefix grep extended + tech message rewrite

P1 — UI static copy: FactionPresenceBar uses verb + focus format ("老 K 在看 BTC 5min");
     forbidden words 在线/刚上线/刚刚 across components and i18n dicts (10 locales)

P2 — LLM forbidden prefix grep extended (v3.1 漏的"复核/追问/反驳"动作 + "等待条件/市场摘要"
     报告式开头 + "实时上下文/信号触发"技术词)

P3 — Tech-state messages rewritten to natural Chinese: ticker-failure fallback uses "等数据"
     instead of "实时上下文还在刷新"; SeedChip drops "事件触发"/"信号触发" prefixes;
     InsufficientConsensus uses "老 K 没把握/现在没清晰策略" instead of "暂不输出策略"

P4 — i18n dicts (10 locales) translated for all humanized strings
```

### 12.7 v3.2 派发文本

```
项目：claw42
工作路径：/Users/dannybrown/Claude/职业规划/web-dev/claw42
Spec：docs/airy-tasks/task-18-watch-chat-immersive.md § 12 v3.2（产品体验文案级翻译）
分支：feature/watch-chat-immersive-01（同分支加 commit）

4 个 patch 单 commit：

P1 — UI 静态文案人性化
- FactionPresenceBar 文案改"派别 + 动词 + 当前焦点"格式
- 删 "在线" / "刚上线" / "刚刚" 等 dev 术语
- AgentMiniCard / 任何派别状态显示改 idle/speaking/alert 自然描述

P2 — LLM 禁词正则扩展（v3.1 漏的全补）
补充 FORBIDDEN_PREFIX_PATTERNS：
- /^(派别名)\s*(复核|追问|反驳|附议|嘲讽)[:：]/
- /^(等待条件|市场摘要|核心观点|结论|总结)[:：]/
- /^(实时上下文|信号触发|事件触发|队列|钩子|回调)[:：]/
LLM Prompt 加 12 个 ❌ + 8 个 ✅ 反例

P3 — 技术 message 改自然话
- ticker 失败 fallback：用 "等数据 / 等 30 秒看新价格" 而非 "实时上下文还在刷新"
- SeedChip 删 "事件触发:" / "信号触发:" 前缀，直接显示新闻 / 事件描述
- InsufficientConsensus 改 "老 K 没把握 / 现在没清晰策略" 而非 "暂不输出策略"

P4 — i18n 10 语 dict 同步翻译
- grep i18n 内"在线"/"刚上线"/"实时上下文"/"信号触发" 等命中 → 全部翻译

verify + preview 必过 4 项：
- FactionPresenceBar 显示"老 K 在看 X" 而非 "Alpha 刚上线"
- 任意 LLM message 不出现"复核:"/"等待条件:"/"实时上下文" 等
- ticker 失败时 Agent 输出"等数据" 自然话
- InsufficientConsensus 文案是"老 K 没把握" 自然话
```

---

_v3.2 紧急 patch: 2026-05-06（Dan 反馈"机械感" — 整个页面文案级用户视角翻译，dev 术语清扫）_
