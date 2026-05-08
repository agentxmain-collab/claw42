# Task 11 — Watch 页面 UX 整体重构（合并 task-10 + Dan v1.1 二轮反馈 + v1.1 三轮修订）

> **v1.1 修订（2026-04-28）**：Dan 在 task-11 v1 落地后跑了 4 轮 preview 反馈，累计 6 条修订（M1 跑马灯 / M2 标题层级 / M3 stream 系统消息 / M4 横向卡片 / M5 渐次出现 / M6 dot 对齐），全部追加到本 spec 末尾的 §15 v1.1 修订段。Codex 看 spec 时**先看末尾 §15 全 6 条 M1-M6**，再实施全文，1 个 commit 出齐。

> **目标**：Dan 在 PR #16 preview 上跑了两轮反馈，本 task 把 task-10 的 5 条 UI/Prompt 修订 + 二轮反馈的 7 条产品级问题合并到一个 task 里一次跑完。**核心方向：把 watch 页面从"功能堆砌"转向"用户可感知高价值"**。
>
> **执行者**：Codex
>
> **基于**：PR #16 (`feature/act1-5-watch-sedimentation-01`) 已落地的 task-09 v1.1 4 段 commit
>
> **分支**：在 PR #16 同分支 `feature/act1-5-watch-sedimentation-01` 加新 commit。**task-10 已合入本 task，不再单独执行**。
>
> **PR target**：保持 PR #16 → `feature/act1-5-watch-page-01`，不变
>
> **吸收**：原 task-10（5 条 UI/Prompt 修订）已合入本 task

---

## 0. 7 个 Track 修订对位

| Track  | 来源                                                   | 修订摘要                                                                                             |
| ------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| **T1** | Dan v1.1 反馈 4（标题文案）                            | Hero 标题 / subtitle / Bottom CTA 全部"说人话"重写，10 语                                            |
| **T2** | Dan v1.1 反馈 2（FocusCard + Sidebar 重复）            | AgentFocusCard 合并到 Sidebar，单卡放大；删独立 FocusCard 区                                         |
| **T3** | Dan v1.1 反馈 1（信号流位置 + 重复感）                 | 信号流紧贴 Ticker 下方 + 横向滚动 + 阈值收紧到 0.5%                                                  |
| **T4** | task-10 R2/R4 + Dan v1.1 反馈 3                        | LLM Prompt 升级：禁套话 + 禁复读 + 强制信号引用 + 集体信号检测 + 派别口诀限频 + 上轮 stream 摘要注入 |
| **T5** | task-10 R3（气泡配色）                                 | MessageBubble 按 agentId 应用 AGENT_COLOR_TOKEN                                                      |
| **T6** | task-10 R1（信号去重）                                 | range_change 主流不生成，仅热门/机会保留                                                             |
| **T7** | Dan 新增（K 线延迟 badge 删除 + 全文案"说人话"扫一遍） | CoinTickerStrip 删除 source/降级 badge；其他文案扫一遍                                               |

---

## 1. 修改清单

| 文件                                                     | 改动                                                                                 | Track  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------ |
| `src/i18n/dicts/zh_CN.json`                              | Hero 文案重写 + Sidebar 文案 + 信号流文案 + 删除 source 状态文案                     | T1, T7 |
| `src/i18n/dicts/{其他 9 语}.json`                        | 同步占位英文                                                                         | T1, T7 |
| `src/i18n/types.ts`                                      | 增减字段（删除 status badge 字段）                                                   | T7     |
| `src/modules/agent-watch/AgentWatchBoard.tsx`            | layout 重构：Ticker 顶 + 信号流横向滚 + Sidebar 放大（含 focus）+ MessageStream 主区 | T2, T3 |
| `src/modules/agent-watch/components/AgentSidebar.tsx`    | 单卡内嵌 FocusCard 内容（symbol + judgment + trigger）                               | T2     |
| `src/modules/agent-watch/components/AgentFocusCard.tsx`  | **删除文件**（合并入 Sidebar）                                                       | T2     |
| `src/modules/agent-watch/components/MarketEventFeed.tsx` | 改横向滚动 + 紧凑文案 + 自动滚动 5s                                                  | T3     |
| `src/modules/agent-watch/components/CoinTickerStrip.tsx` | 删除 source/状态 badge；改为只显 ticker chip                                         | T7     |
| `src/modules/agent-watch/components/MessageBubble.tsx`   | 按 agentId 配色（AGENT_COLOR_TOKEN）                                                 | T5     |
| `src/lib/marketSignals.ts`                               | range_change 加 majors 守卫；NEAR_HIGH/LOW 阈值 1.5% → 0.5%                          | T6, T3 |
| `src/lib/llmFallbackChain.ts`                            | Prompt 6 条新约束（禁套话 / 禁复读 / 强制引用 / 集体信号 / 口诀限频 / 上轮摘要注入） | T4     |

---

## 2. Track 1 — 文案重写（Dan 拍板版本）

### zh_CN 修订

```json
"hero": {
  // ... 现有字段
  // task-09 加的字段保留，不动
},
"agentWatch": {
  "pageTitle": "Live · 加密市场",                      // ← Dan 选 (b)
  "pageSubtitle": "3 个 Agent 同时盯盘。Alpha 看突破，Beta 看趋势，Gamma 看极端。",  // ← Dan 调整顺序后定稿
  "pageHeroTagline": "Live · 加密市场",                // 与 pageTitle 一致或可去掉重复
  "bottomCta": "开始使用 Agent →",                     // ← Dan 选 (b) 调整版（去掉"登录"前缀）
  // ... 其他字段
  "focusCard": {
    "watching": "关注",
    "trigger": "触发",
    "fail": "失效",
    "expandFail": "失效条件",
    "evidenceCount": "{count} 条信号支撑",
    "minutesAgo": "{minutes} 分钟前",
    "warmup": "Agent 准备中",                          // ← T7 顺便改，原"Agent 正在累积市场信号"太冗
    "thinking": "思考中"
  },
  "marketEvent": {
    "title": "市场信号",                               // ← T7 删掉"流"字简化
    "empty": "等待新信号..."                            // ← T7 改简洁
  },
  "sidebarStatus": {
    "thinking": "思考中",
    "speaking": "发言中",
    "idle": "静默"
  }
  // ⚠️ 删除 statusLabel.warmingUp 等冗余字段
}
```

### 其他 9 语处理

仅 zh_CN 进 `/agent` 路由（middleware redirect 其他 locale 回主页）。其他 9 语字段保持结构一致但用英文 fallback：

- pageTitle: `Live · Crypto Market`
- pageSubtitle: `3 Agents on watch. Alpha hunts breakouts, Beta follows trends, Gamma waits for extremes.`
- bottomCta: `Open Agent →`

### Track 1 验收

- [ ] 访问 `/zh_CN/agent` 顶部标题是 `Live · 加密市场`
- [ ] subtitle 一字不差：`3 个 Agent 同时盯盘。Alpha 看突破，Beta 看趋势，Gamma 看极端。`
- [ ] 底部 CTA 是 `开始使用 Agent →`
- [ ] 删除 zh_CN dict 里 `agentWatch.statusLabel.warmingUp` 等冗余字段（grep 不到）
- [ ] zh_CN dict 里没有 `AI 已经在干活了` 字符串（grep 不到）

---

## 3. Track 2 — Sidebar 合并 FocusCard

### 当前布局

```
┌─────────────────────────────────────────────┐
│ Ticker 三组                                  │
├──────┬──────────────────────────────────────┤
│ Side │ MarketEventFeed (大网格)             │
│ bar  │                                      │
│ A·静默├──────────────────────────────────────┤
│ B·静默│ FocusCard A | FocusCard B | FocusCard C│
│ G·静默├──────────────────────────────────────┤
│      │ MessageStream                        │
└──────┴──────────────────────────────────────┘
```

### 改后布局

```
┌─────────────────────────────────────────────┐
│ Ticker 三组                                  │
├─────────────────────────────────────────────┤
│ MarketEventFeed (横向单行滚动条)             │
├──────────┬──────────────────────────────────┤
│ Sidebar  │ MessageStream (占据主区)         │
│ 拓宽到   │                                  │
│ ~340px   │                                  │
│          │                                  │
│ Alpha 卡 │                                  │
│ - 头像   │                                  │
│ - 突破派 │                                  │
│ - 关注 X │                                  │
│ - judgmt │                                  │
│ - trigger│                                  │
│ ▸ 失效   │                                  │
│          │                                  │
│ Beta 卡  │                                  │
│ ...      │                                  │
│          │                                  │
│ Gamma 卡 │                                  │
│ ...      │                                  │
└──────────┴──────────────────────────────────┘
```

### AgentSidebar 单卡结构

```tsx
function AgentSidebarCard({
  agentId,
  focus,
  status,
}: {
  agentId: AgentId;
  focus: AgentFocus | null;
  status: "thinking" | "speaking" | "idle";
}) {
  const { t } = useI18n();
  const meta = AGENT_META[agentId];
  const token = AGENT_COLOR_TOKEN[agentId];

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl bg-[#111] p-4"
      style={{
        border: `1px solid ${token.soft}`,
        borderLeft: `2px solid ${token.primary}`,
      }}
    >
      {/* Header: 头像 + 名字 + tagline + 状态 */}
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-black text-white"
          style={{
            background: `linear-gradient(135deg, ${token.primary}, ${token.soft})`,
            boxShadow: `0 0 16px ${token.glow}`,
          }}
        >
          {meta.avatar}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-bold text-white">{meta.name}</span>
            <StatusDot status={status} />
          </div>
          <div className="truncate text-xs text-white/50">{meta.tagline}</div>
        </div>
      </div>

      {/* Focus 内容（合并自 FocusCard）*/}
      {focus ? (
        <>
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
              {t.agentWatch.focusCard.watching}
            </span>
            <span className="text-sm font-bold text-white">{focus.symbol}</span>
          </div>

          <p className="text-sm leading-relaxed text-white/85">{focus.judgment}</p>

          <div className="flex items-start gap-2 text-xs">
            <span className="shrink-0 rounded bg-[#7c5cff]/15 px-1.5 py-0.5 font-semibold text-[#b49cff]">
              {t.agentWatch.focusCard.trigger}
            </span>
            <span className="flex-1 text-white/70">{focus.trigger.description}</span>
          </div>

          <details className="text-xs">
            <summary className="flex cursor-pointer select-none list-none items-center gap-1 text-white/40 hover:text-white/60">
              <span className="text-[10px]">▸</span>
              {t.agentWatch.focusCard.expandFail}
            </summary>
            <div className="mt-1 flex items-start gap-2">
              <span className="shrink-0 rounded bg-[#ff5f5f]/15 px-1.5 py-0.5 font-semibold text-[#ff8a8a]">
                {t.agentWatch.focusCard.fail}
              </span>
              <span className="flex-1 text-white/70">{focus.fail.description}</span>
            </div>
          </details>

          <div className="border-t border-white/[0.06] pt-1 text-[10px] text-white/35">
            {t.agentWatch.focusCard.evidenceCount.replace("{count}", String(focus.evidenceCount))}
          </div>
        </>
      ) : (
        <div className="py-3 text-center text-xs text-white/40">
          {t.agentWatch.focusCard.warmup}
        </div>
      )}
    </div>
  );
}
```

### Mobile 适配

`< lg` 断点：

- Sidebar 整列改成上下堆叠
- 3 张卡片改为水平 swipe 横滑（每屏 1 张）
- MessageStream 占满屏幕底部

### 文件操作

- **删除** `src/modules/agent-watch/components/AgentFocusCard.tsx`
- **改写** `src/modules/agent-watch/components/AgentSidebar.tsx` 为新版（单卡内嵌 focus）
- **改写** `src/modules/agent-watch/AgentWatchBoard.tsx` layout

### Track 2 验收

- [ ] `src/modules/agent-watch/components/AgentFocusCard.tsx` **不存在**（grep `AgentFocusCard` 无输出）
- [ ] Sidebar 卡片高度 ~200-280px（取决于 trigger 内容长短）
- [ ] 用户首屏（不滚动）能看到 Sidebar 3 张卡 + MessageStream 第一条消息
- [ ] Mobile lg 断点以下 sidebar 横向 swipe

---

## 4. Track 3 — 信号流横向滚动 + 阈值收紧

### MarketEventFeed 改成横向滚动

```tsx
"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { SignalRecord, SignalSeverity } from "../types";

const SEVERITY_DOT: Record<SignalSeverity, string> = {
  info: "bg-white/30",
  watch: "bg-[#b49cff]",
  alert: "bg-[#ff5f5f] animate-pulse",
};

interface MarketEventFeedProps {
  signals: SignalRecord[];
  labels: { title: string; empty: string };
}

export function MarketEventFeed({ signals, labels }: MarketEventFeedProps) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  // 自动滚动 5s/次（一屏滚动一格），hover 时暂停
  useEffect(() => {
    if (reduceMotion || isHovering || signals.length <= 4) return;
    const container = containerRef.current;
    if (!container) return;

    const timer = setInterval(() => {
      const scrollWidth = container.scrollWidth;
      const clientWidth = container.clientWidth;
      const currentScroll = container.scrollLeft;

      if (currentScroll + clientWidth >= scrollWidth - 4) {
        container.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        container.scrollBy({ left: clientWidth * 0.4, behavior: "smooth" });
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [signals.length, isHovering, reduceMotion]);

  if (signals.length === 0) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-white/40">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b49cff] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7c5cff]" />
        </span>
        {labels.title}：{labels.empty}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/50">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b49cff] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7c5cff]" />
        </span>
        {labels.title}
      </div>

      <div
        ref={containerRef}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 flex flex-1 items-center gap-3 overflow-x-auto scroll-smooth py-1"
      >
        <AnimatePresence>
          {signals
            .slice()
            .reverse()
            .map((sig) => {
              const dotClass = SEVERITY_DOT[sig.severity];
              return (
                <motion.div
                  key={sig.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.18 }}
                  className="flex shrink-0 items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.04] px-2.5 py-1.5 transition-colors hover:bg-white/[0.06]"
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
                  <span className="shrink-0 font-mono text-[10px] text-white/40">
                    {formatTime(sig.ts)}
                  </span>
                  <span className="whitespace-nowrap text-xs text-white/85">
                    {sig.payload.description ?? ""}
                  </span>
                </motion.div>
              );
            })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
```

视觉位置：在 AgentWatchBoard 里，紧贴 CoinTickerStrip 下方一行，**不再独立卡片**：

```tsx
<div className="flex flex-col gap-3">
  <CoinTickerStrip pool={pool} />
  <MarketEventFeed signals={marketSignals} labels={t.agentWatch.marketEvent} />
</div>
```

### 阈值收紧（marketSignals.ts）

```ts
const THRESHOLDS = {
  VOLUME_SPIKE_RATIO: 1.8,
  NEAR_LEVEL_PCT: 0.005, // ← 1.5% → 0.5% 真"接近"才报
  RANGE_CHANGE_PCT: 10,
};
```

### 信号文案突出动作（payload.description 模板更新）

| 类型         | 旧文案（状态）                     | 新文案（动作）                    |
| ------------ | ---------------------------------- | --------------------------------- |
| near_high    | `BTC 接近前高 $77,143（距 1.08%）` | `BTC 距前高 0.4%，正在测压`       |
| near_low     | `BTC 接近前低 $75,677（距 0.45%）` | `BTC 距前低 0.5%，下方止损单密集` |
| breakout     | `BTC 5m 突破前高 $77,143`          | `BTC 突破前高 $77,143`            |
| ema_cross    | `BTC 5m EMA12 跌破 EMA13`          | `BTC 5m EMA 死叉`                 |
| volume_spike | `BTC 5m 放量 2.1x`                 | `BTC 5m 放量 2.1x`                |
| range_change | `PROS 24h -19.5%`                  | `PROS 24h -19.5%（机会区异动）`   |

实现：在 `marketSignals.ts` 的 `description` 模板里改文字。

### Track 3 验收

- [ ] `THRESHOLDS.NEAR_LEVEL_PCT === 0.005` 在 `src/lib/marketSignals.ts`
- [ ] MarketEventFeed 单行横向滚动，不再是网格
- [ ] hover 时暂停滚动，离开恢复
- [ ] 信号文案是动作型（"距前高 0.4%，正在测压"）不是状态型
- [ ] 信号流紧贴 ticker 下方，不再独立大卡片区

---

## 5. Track 4 — Prompt 升级（合并 task-10 + 新增）

`src/lib/llmFallbackChain.ts` 的 `buildPrompt` 末尾追加完整新约束段（替换 task-10 R2/R4 的简版）：

```
## 输出纪律（task-11，硬性遵守）

### A 禁止套话开头
不要以以下模式开头：
- "X 现价 $Y，24h Z%"
- "ETH/BTC/SOL 强弱排序已拉开"
- "目前市场偏 X"
- 任何行情概览或价格描述类开头

### B 禁止复读 Ticker
用户已在 Ticker 看到当前价 + 24h 涨跌。不要在 stream 或 focus.judgment 复读"现价 $X" / "24h X%"。直接说判断。

### C 必须引用 buffer 信号事件
每个 Agent 的 stream + focus 必须引用至少 1 条 buffer 摘要里**具体的**信号事件（symbol + 数据 + 信号类型）作为论据。
- ✅ "BTC 距前高 0.4% 已第 3 次"
- ❌ "市场偏弱"

### D 集体信号检测
如果 buffer 摘要里 ≥3 个主流币同方向同类型信号（例 BTC ETH SOL 都 NEAR_LOW），3 Agent stream **至少 1 条**必须引用集体信号。

### E 派别口诀限频（任务 11 新增）
每个 Agent 的口头禅 / 标志性短句**每个 batch 最多用 1 次**：
- Alpha "突破回踩不破才是真突破" 等
- Beta "趋势是朋友" / "回撤越深加仓机会越好" / "让利润奔跑" 等
- Gamma "树不会长到天上" / "数字不会骗人" / "宁可错过不接飞刀" 等

如果同一 batch 里 stream 和 focus.judgment 都用了同一个口诀 → 输出无效，必须改其中一个。

### F 上轮 stream 摘要避免连续重复（任务 11 新增）
你上一轮（{lastBatchAgo} 分钟前）的 stream 输出摘要：
{lastBatchSummary}

本轮**禁止**和上轮内容相似度过高（同 symbol + 同核心论点 + 类似句式）。如果信号没变化导致没新角度，可以：
- 引用更细粒度的信号差异（如 buffer 里新加的 1-2 条信号）
- 切换币（focus 换成不同 symbol）
- 给 trigger/fail 条件更具体的数字

### G 每条 stream 必须含具体币 symbol（继承 task-08）

### H 句式风格（继承 task-07）
- Alpha 短促 + 江湖气
- Beta 中长 + 克制
- Gamma 数据 + 谨慎
```

### 实现：上轮摘要注入

在 `buildPrompt()` 里加：

```ts
import { getLastBatchSummary } from "./llmHistorySummary"; // 新增 helper

export async function buildPrompt(): Promise<string> {
  await triggerSignalGeneration();
  const summary = buildSignalSummary();
  // ...

  const lastBatch = getLastBatchSummary(); // 取上一次成功 LLM 输出的 stream + focus 摘要
  const lastBatchSection = lastBatch
    ? `## 上轮输出摘要（{${Math.round(lastBatch.ageMs / 60_000)}} 分钟前）\n${lastBatch.summary}\n`
    : "";

  return `${existing}\n${lastBatchSection}\n${disciplineSection}`;
}
```

新增 `src/lib/llmHistorySummary.ts`：

```ts
import type { AgentAnalysisPayload } from "./marketDataCache";

let lastSuccessfulPayload: { value: AgentAnalysisPayload; ts: number } | null = null;

export function recordSuccessfulPayload(payload: AgentAnalysisPayload) {
  lastSuccessfulPayload = { value: payload, ts: Date.now() };
}

export function getLastBatchSummary(): { summary: string; ageMs: number } | null {
  if (!lastSuccessfulPayload) return null;

  const { value, ts } = lastSuccessfulPayload;
  const ageMs = Date.now() - ts;
  if (ageMs > 30 * 60_000) return null; // 超过 30 分钟视为陈旧不参考

  // 摘要：3 Agent 各 1 行 stream content + focus.symbol
  const lines: string[] = [];
  if (value.focus) {
    for (const f of value.focus) {
      lines.push(`- ${f.agentId}: 关注 ${f.symbol}, judgement: "${f.judgment.slice(0, 30)}..."`);
    }
  }
  if (value.stream) {
    lines.push("stream:");
    for (const s of value.stream) {
      lines.push(`  - ${s.agentId}: "${s.content.slice(0, 40)}..."`);
    }
  }
  return { summary: lines.join("\n"), ageMs };
}
```

在 `refreshAnalysis()` 成功路径调用 `recordSuccessfulPayload(value)`。

### Track 4 验收

- [ ] `grep "派别口诀限频\|上轮 stream 摘要" src/lib/llmFallbackChain.ts` 存在
- [ ] `src/lib/llmHistorySummary.ts` 存在含 getLastBatchSummary 导出
- [ ] LLM 输出连续两轮在 preview 上观察 5 轮 batch（25-50 分钟），相同 symbol 内容差异明显（不再 Gamma 两轮一字不差）
- [ ] LLM 输出不含 "现价 $X 24h -X%" 套话开头（grep preview JSON 输出）

---

## 6. Track 5 — MessageBubble 派别配色

（task-10 R3 内容直接迁移，详见 task-10 v1.2 spec §4 实现）

### Track 5 验收

- [ ] Alpha 气泡左侧 2px 暖红 #ff5f5f accent
- [ ] Beta 气泡左侧 2px 蓝 #3a7bff accent
- [ ] Gamma 气泡左侧 2px 紫 #9b6bff accent
- [ ] 气泡边框配色淡（透明度 0.18），不喧宾夺主

---

## 7. Track 6 — range_change 主流不生成

（task-10 R1 内容直接迁移）

```ts
// marketSignals.ts
if (
  Math.abs(coin.change24h) >= THRESHOLDS.RANGE_CHANGE_PCT &&
  coin.category !== "majors"
) { ... }
```

### Track 6 验收

- [ ] 信号流不再出现 `BTC RANGE` / `ETH RANGE` / `SOL RANGE` / `USDT RANGE`
- [ ] 热门 / 机会币的 RANGE 信号正常出现（如 `PROS 24h -19.5%`）

---

## 8. Track 7 — K 线延迟 badge 删除 + 全文案扫一遍

### CoinTickerStrip 删除 status badge

```tsx
// 当前代码段（task-09 v1.1 落地）：
<span
  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
    source === "coinw-kline"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : "border-yellow-400/30 bg-yellow-400/10 text-yellow-200"
  }`}
>
  {statusLabel}
</span>

// 改后：删除整段，CoinTickerStrip 不再渲染 badge
```

`isStale` / `source` 等 props 仍传入（保留为类型完整性 / 调试用），但**前端不可视化展示**。降级状态用户感知不到。

### 文案扫一遍

zh_CN dict 里如果还有以下表达，全部替换或删除：

- "K 线延迟" / "降级数据" / "CoinW 实盘 K 线" → 全删
- "AI 已经在干活了" → 已删（T1 替换）
- "Agent 正在累积市场信号..." → 改 "Agent 准备中"（T1 已修订）
- "等待第一波信号..." → 改 "等待新信号..."（T1 已修订）

### Track 7 验收

- [ ] CoinTickerStrip 不渲染任何 source/状态 badge
- [ ] `grep "K 线延迟\|降级数据\|CoinW 实盘" src/i18n/dicts/zh_CN.json` 无输出
- [ ] `grep "AI 已经在干活" src/i18n/dicts/zh_CN.json` 无输出
- [ ] `grep "正在累积市场信号" src/i18n/dicts/zh_CN.json` 无输出（已改成 "Agent 准备中"）

---

## 9. 整体验收

### 类型 / 构建

- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 成功
- [ ] `npm run lint` 无新增错误

### 行为（preview 跑 30 分钟）

**首屏密度**：

1. 访问 `/zh_CN/agent` 不滚动
2. 应能看到：Ticker 三组 + 信号流单行横滚 + Sidebar 3 张焦点卡（左）+ MessageStream 顶部消息（右）
3. **不应**看到：独立 3 张 FocusCard 区块、独立大块 MarketEventFeed、K 线延迟 badge

**文案**：4. Hero 区显示 `Live · 加密市场` 5. subtitle 显示 `3 个 Agent 同时盯盘。Alpha 看突破，Beta 看趋势，Gamma 看极端。` 6. 底部 CTA 显示 `开始使用 Agent →`

**信号流**：7. 信号流横向滚动 5 秒/次，hover 暂停 8. 不出现 BTC/ETH/SOL/USDT 的 RANGE 信号 9. 信号文案是动作型（"距前高 0.4%，正在测压"）

**Agent 输出（核心，跑 5 轮 batch ~ 25-50 分钟）**：10. 每个 batch 不再以"X 现价 $Y, 24h Z%" 开头 11. Alpha 短促 / Beta 中长 / Gamma 数据型，3 风格明显差异 12. **连续两轮 stream 不再相似**（Gamma 不再两轮一字不差）13. 派别口诀每 batch 最多 1 次，不再每条都"树不会长到天上" 14. 主流 ≥3 币同向时 3 Agent 至少 1 个引用集体信号

**Sidebar 配色**：15. Sidebar 3 卡 + MessageBubble 都有派别配色 accent（红/蓝/紫）

### 不退化

- [ ] task-09 v1.1 数据流（buffer / signal / pool / focus）仍工作
- [ ] 三入口 triggerSignalGeneration 仍工作
- [ ] static fallback 路径输出 focus（图标 / 文案不挂）
- [ ] middleware 非中文 redirect 仍工作

---

## 10. 约束

- 不引入新依赖（所有改动用现有库）
- 不改 task-09 的数据流主架构（buffer / signal / LLM)
- 不改 task-07 Agent 人设（仅输出纪律加强）
- 不改 production-fix-batch 的任何文件
- LLM 调用频率不变（10min fresh / 30min stale）
- 不动 Hero / SiteHeader / 4 币 modal / 其他 Section

## 11. 提交

PR #16 同分支加 commit（建议拆 3 段，每段独立可编译）：

```sh
# Commit 1: i18n 文案重写 + Sidebar 合并 FocusCard
git add src/i18n/types.ts src/i18n/dicts/*.json \
        src/modules/agent-watch/components/AgentSidebar.tsx \
        src/modules/agent-watch/AgentWatchBoard.tsx
git rm src/modules/agent-watch/components/AgentFocusCard.tsx
git commit -m "feat(watch-ux): rewrite copy + merge focus into sidebar (T1+T2+T7 part1)

- Hero title: 3 个 Agent 正在分析行情 → Live · 加密市场
- Hero subtitle: 'AI 已经在干活了...' → '3 个 Agent 同时盯盘。Alpha 看突破...'
- Bottom CTA: 登录后让 Agent 替你下单 → 开始使用 Agent
- Drop AgentFocusCard standalone, merge into AgentSidebar (each card now ~280px)
- AgentSidebar layout: avatar + name + tagline + symbol + judgment + trigger + fail (collapsed)
- Mobile: lg breakpoint stacks sidebar above MessageStream
- Drop redundant warmingUp/loading status copy"

# Commit 2: 信号流横向滚动 + 阈值收紧 + 信号文案动作化 + range_change 主流去重
git add src/modules/agent-watch/components/MarketEventFeed.tsx \
        src/modules/agent-watch/components/CoinTickerStrip.tsx \
        src/lib/marketSignals.ts \
        src/modules/agent-watch/AgentWatchBoard.tsx
git commit -m "feat(watch-ux): horizontal signal feed + tightened thresholds + drop status badges (T3+T6+T7 part2)

- MarketEventFeed: vertical card grid → horizontal auto-scrolling strip (5s tick, hover-pause)
- Position: directly below CoinTickerStrip (no separate large block)
- THRESHOLDS.NEAR_LEVEL_PCT 1.5% → 0.5% (only true 'near' shows)
- Signal description templates: state-style → action-style (e.g. '距前高 0.4%，正在测压')
- range_change skipped for majors (BTC/ETH/SOL/USDT no longer duplicate ticker info)
- CoinTickerStrip: drop K线延迟/降级/coinw-kline status badge (implementation detail)"

# Commit 3: LLM Prompt 升级（套话/复读/集体信号/口诀限频/上轮摘要）+ MessageBubble 配色
git add src/lib/llmFallbackChain.ts \
        src/lib/llmHistorySummary.ts \
        src/modules/agent-watch/components/MessageBubble.tsx
git commit -m "feat(watch-ux): LLM prompt discipline overhaul + bubble faction color (T4+T5)

- Add llmHistorySummary.ts: record last successful batch, expose summary for next prompt
- Prompt: 8 new disciplines (banned openers, no ticker readback, mandatory signal evidence, collective signal detection, faction motto rate-limit 1/batch, last-batch summary injected, mandatory symbol per stream, faction style)
- MessageBubble: per-agent left accent border + soft frame using AGENT_COLOR_TOKEN (Alpha red / Beta blue / Gamma purple)
- LLM output expected: less mechanical, less repetitive, more signal-anchored"

git push origin feature/act1-5-watch-sedimentation-01
```

PR #16 自动更新。

---

## 12. 副审

不要求副审。Dan preview 验收为最终关卡：

1. 跑 1 个 LLM batch（首次 ~5 分钟）看 sidebar focus 内容到位
2. 跑 5 轮 batch（25-50 分钟）观察连续 batch 不重复
3. 横向 scroll 信号流是否流畅
4. 文案是否"说人话"

如果任一项不合格，告诉 Dan 后 F 落微修订（不再走整 spec 流程）。

---

## 13. 已知风险

| #   | 风险                                                                                  | 缓解                                                                          |
| --- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | 上轮摘要注入让 prompt token 变多（+200-300 tokens）                                   | 月成本 +$5-10，可接受                                                         |
| 2   | 派别口诀限频 + 上轮摘要 + 集体信号约束三层叠加 → LLM 输出过于受限可能输出"观察中"占位 | task-09 v1.1 已经允许 LLM "观察中"输出 + fallback 路径完善                    |
| 3   | 信号流横向滚动 mobile 体验                                                            | 横向 swipe 自然，比垂直网格更适合 mobile                                      |
| 4   | Sidebar 拓宽到 ~340px 挤压 MessageStream                                              | desktop 1440px 主流屏 OK，1280px 有点紧但可读                                 |
| 5   | "K 线延迟" badge 删了用户不知道数据降级                                               | 数据真降级时 LLM 仍有 static fallback，用户感知不到细节符合"产品而非工具"定位 |

---

## 14. v2 路线图（不在本 spec 范围）

- 事件触发 LLM 提前调用（buffer 出现极强信号时 90s 间隔内可触发新一轮）
- Pattern match（"上次类似情况"引用 buffer 历史）
- Vercel KV 跨实例 buffer 同步
- Mobile sidebar 横向 swipe 增强（手势 + 指示器）
- Agent 头像换成真实风格图

---

## 15. v1.1 修订（task-11 已落地后 Dan 第三轮反馈）

> 2026-04-28 task-11 v1 落地后，Dan 看 preview 提出 3 条修订。本节是 task-11 v1.1 增量，Codex 在已有 task-11 改动基础上继续修。

### M1 — MarketEventFeed 改 CSS 跑马灯连续滚动

**问题**：当前 setInterval 5s 滚 0.4 屏宽 = 视觉上"动一下停一下"，被误判成手动滑动。

**修订**：删掉 setInterval 实现，改用 CSS `@keyframes` 连续滚动。

`globals.css` 加（或在 MarketEventFeed 模块作用域 inline style）：

```css
@keyframes claw42-marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}
```

`MarketEventFeed.tsx` 改：

```tsx
// 删除 useEffect setInterval 那段
// 删除 isHovering state（改成纯 CSS hover 暂停）

// JSX:
<div ref={containerRef} className="flex-1 overflow-hidden">
  <div
    className="flex w-max items-center gap-3"
    style={{
      animation: signals.length > 0 ? "claw42-marquee 60s linear infinite" : "none",
      animationPlayState: "running",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.animationPlayState = "paused";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.animationPlayState = "running";
    }}
  >
    {/* 关键：信号 chip 渲染两遍（首尾相接）实现无缝循环 */}
    {[...signals.reverse(), ...signals.reverse()].map((sig, idx) => (
      <SignalChip key={`${sig.id}-${idx < signals.length ? "a" : "b"}`} signal={sig} />
    ))}
  </div>
</div>
```

参数：60s 滚完一屏（约 10 像素/秒），人眼能跟上的连续动效。

reduce-motion 用户：

```tsx
const reduceMotion = useReducedMotion();
const animationStyle = reduceMotion ? "none" : "claw42-marquee 60s linear infinite";
```

### M2 — 标题层级修正

**问题**：当前 `Live · 加密市场` 是顶部紫色小标签，`3 个 Agent 同时盯盘...` 反而是大字 H1。Dan 要求层级颠倒。

**修订**：`AgentWatchBoard.tsx` 顶部标题区改：

```tsx
// 删除当前顶部紫色 LIVE dot 标签（冗余）
// 把 pageTitle 渲染成 H1 大字
// pageSubtitle 改成灰字 subtitle

<div className="mb-6 px-2 md:mb-8 md:px-0">
  <h1 className="mb-3 text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl lg:text-5xl">
    {t.agentWatch.pageTitle} {/* "Live · 加密市场" */}
  </h1>
  <p className="max-w-2xl text-base leading-relaxed text-white/55 md:text-lg">
    {t.agentWatch.pageSubtitle} {/* "3 个 Agent 同时盯盘。Alpha 看突破..." */}
  </p>
</div>
```

i18n 字段不动（`pageTitle` / `pageSubtitle` 已经是对的内容），仅渲染层级对调。

### M3 — MessageStream 持续感（Dan 已确认 2026-04-28）

**问题**：3 条 Agent 消息 5-10 分钟才更新，stream "感觉是死的"。

**修订**：让 MarketEventFeed 信号事件**同时作为系统消息**注入 MessageStream，按时间戳穿插显示。

#### 数据流

`AgentWatchBoard.tsx`：

```tsx
import { useMemo } from "react";
import type { WatchFeedItem, AgentWatchMessage, SignalRecord } from "./types";

function buildFeedItems(messages: AgentWatchMessage[], signals: SignalRecord[]): WatchFeedItem[] {
  // Agent 消息
  const agentItems: WatchFeedItem[] = messages.map((m) => ({
    type: "agent" as const,
    agentId: m.agentId,
    content: m.content,
    timestamp: m.timestamp,
    id: m.id,
  }));

  // 系统消息（按 60s 窗口去重 + 总数限制 max 12 条系统消息）
  const dedupedSignals = dedupeSystemSignals(signals, 60_000);
  const systemItems: WatchFeedItem[] = dedupedSignals.slice(-12).map((s) => ({
    type: "market-event" as const,
    signal: s,
    id: `sys-${s.id}`,
  }));

  // 按时间戳合并 + 排序
  const all = [...agentItems, ...systemItems];
  all.sort((a, b) => {
    const tsA = a.type === "agent" ? a.timestamp : a.signal.ts;
    const tsB = b.type === "agent" ? b.timestamp : b.signal.ts;
    return tsA - tsB;
  });
  return all;
}

function dedupeSystemSignals(signals: SignalRecord[], windowMs: number): SignalRecord[] {
  // 单 symbol 60s 内只保留最新 1 条
  const result: SignalRecord[] = [];
  const lastBySymbol = new Map<string, number>();
  for (const sig of signals) {
    const last = lastBySymbol.get(sig.symbol);
    if (last && sig.ts - last < windowMs) continue;
    lastBySymbol.set(sig.symbol, sig.ts);
    result.push(sig);
  }
  return result;
}

const feedItems = useMemo(
  () => buildFeedItems(combinedMessages, marketSignals),
  [combinedMessages, marketSignals],
);

<MessageStream items={feedItems} ... />
```

#### MessageStream.tsx 接收新 type

```tsx
interface MessageStreamProps {
  items: WatchFeedItem[]; // 替换原 messages: AgentWatchMessage[]
  // ... 其他 prop 不变
}

return (
  <div ref={containerRef} className="...">
    {items.map((item) => {
      if (item.type === "agent") {
        return <MessageBubble key={item.id} message={item} />;
      } else {
        return <SystemSignalBubble key={item.id} signal={item.signal} />;
      }
    })}
  </div>
);
```

#### 新组件 SystemSignalBubble

视觉特征：**明显小于** Agent 消息，居中，灰色，胶囊形：

```tsx
function SystemSignalBubble({ signal }: { signal: SignalRecord }) {
  return (
    <div className="my-2 flex items-center justify-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1">
        <span className="font-mono text-[10px] text-white/40">{formatTime(signal.ts)}</span>
        <span className="text-xs text-white/55">{signal.payload.description}</span>
      </div>
    </div>
  );
}
```

#### 限频纪律

- **单 symbol 60s 内最多 1 条系统消息**（dedupeSystemSignals 已实现）
- **系统消息总量上限 12 条**（dedupeSystemSignals 后 slice(-12)）
- **MarketEventFeed 跑马灯保留**（顶部一眼扫所有近期信号）+ Stream 系统消息（时序融合到对话流）—— 两层互补

#### 视觉密度参考

```
[Agent A] 08:41  ETH 先盯 5m 放量...
       ───────  08:42 · BTC 距前高 0.4%  ───────
       ───────  08:43 · SOL 5m 放量 2.1x  ───────
[Agent B] 08:43  ETH 暂时只看 EMA12/13...
       ───────  08:44 · PROS 24h -12.4%  ───────
[Agent C] 08:44  ETH 和 SOL 都还没给出极端...
       ───────  08:45 · BIO 5m 突破前高  ───────
```

每分钟有 1-2 条系统消息进来，整个 Stream **每分钟都在动**，不再 5-10 分钟干等。

### M4 — 3 Agent 卡片改横向上方 + MessageStream 全宽（Dan 已确认 2026-04-28）

**问题**：左 sidebar 3 张 AgentCard 总高 ~840px > 右 MessageStream 容器 ~560px，视觉不对齐 + MessageStream 横向被挤窄。

**修订**：删除左 sidebar 列，3 AgentCard 横向放在 Ticker + MarketEventFeed 之下、MessageStream 之上。

#### 新 layout

```
Hero (H1 大标题 + subtitle)
   ↓
CoinTickerStrip 三组
   ↓
MarketEventFeed 跑马灯（紧贴 ticker）
   ↓
3 AgentCard 横向并排（grid-cols-1 md:grid-cols-3）
   ↓
MessageStream 全宽（agent + system 混合 feed）
```

#### AgentSidebarCard → AgentRowCard 改造

横向卡片单卡 ~33% 宽，~200px 高（不可超过这个高度，避免再次"sidebar 挤压 stream"问题）：

```tsx
function AgentRowCard({
  agentId,
  focus,
  status,
}: {
  agentId: AgentId;
  focus: AgentFocus | null;
  status: "thinking" | "speaking" | "idle";
}) {
  const { t } = useI18n();
  const meta = AGENT_META[agentId];
  const token = AGENT_COLOR_TOKEN[agentId];

  return (
    <div
      className="flex min-h-[180px] flex-col gap-2 rounded-2xl bg-[#111] p-4"
      style={{
        border: `1px solid ${token.soft}`,
        borderLeft: `2px solid ${token.primary}`,
      }}
    >
      {/* Top row: 头像 + 名字 + tagline + 状态 + 关注币 */}
      <div className="flex items-center gap-2">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white"
          style={{
            background: `linear-gradient(135deg, ${token.primary}, ${token.soft})`,
            boxShadow: `0 0 12px ${token.glow}`,
          }}
        >
          {meta.avatar}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-bold text-white">{meta.name}</span>
            <StatusDot status={status} />
          </div>
          <div className="truncate text-[11px] text-white/45">{meta.tagline}</div>
        </div>
        {focus && (
          <div className="shrink-0 rounded-md border border-white/[0.08] bg-white/[0.06] px-2 py-0.5">
            <span className="mr-1 text-[10px] font-bold uppercase text-white/45">
              {t.agentWatch.focusCard.watching}
            </span>
            <span className="text-xs font-bold text-white">{focus.symbol}</span>
          </div>
        )}
      </div>

      {/* Middle: judgment 限制 2 行 */}
      {focus ? (
        <p className="line-clamp-2 flex-1 text-xs leading-relaxed text-white/85">
          {focus.judgment}
        </p>
      ) : (
        <div className="flex flex-1 items-center text-xs text-white/40">
          {t.agentWatch.focusCard.warmup}
        </div>
      )}

      {/* Bottom: trigger 一行（必显），fail 折叠 */}
      {focus && (
        <>
          <div className="line-clamp-1 flex items-start gap-1.5 text-[11px]">
            <span className="shrink-0 rounded bg-[#7c5cff]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#b49cff]">
              {t.agentWatch.focusCard.trigger}
            </span>
            <span className="truncate text-white/65">{focus.trigger.description}</span>
          </div>
          <details className="text-[11px]">
            <summary className="flex cursor-pointer select-none list-none items-center gap-1 text-white/35 hover:text-white/55">
              <span className="text-[9px]">▸</span>
              {t.agentWatch.focusCard.expandFail}
            </summary>
            <div className="mt-1 flex items-start gap-1.5 pl-3">
              <span className="shrink-0 rounded bg-[#ff5f5f]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#ff8a8a]">
                {t.agentWatch.focusCard.fail}
              </span>
              <span className="line-clamp-2 text-white/65">{focus.fail.description}</span>
            </div>
          </details>
        </>
      )}

      {/* 注意：删除 evidenceCount 显示（"X 条信号支撑"）—— 横向空间不够，且用户少看 */}
    </div>
  );
}
```

#### AgentWatchBoard layout 改造

```tsx
return (
  <main className="...">
    {/* Hero (M2 修订后) */}
    <HeroSection />

    {/* Ticker */}
    <CoinTickerStrip pool={pool} />

    {/* MarketEventFeed 跑马灯（M1 修订后） */}
    <MarketEventFeed signals={marketSignals} labels={t.agentWatch.marketEvent} />

    {/* M4: 3 AgentCard 横向 */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <AgentRowCard agentId="alpha" focus={focusByAgent.alpha} status={statusByAgent.alpha} />
      <AgentRowCard agentId="beta"  focus={focusByAgent.beta}  status={statusByAgent.beta}  />
      <AgentRowCard agentId="gamma" focus={focusByAgent.gamma} status={statusByAgent.gamma} />
    </div>

    {/* MessageStream 全宽（M3 含系统消息） */}
    <MessageStream items={feedItems} emptyLabel={...} />
  </main>
);
```

#### 文件变更

- **删除** `src/modules/agent-watch/components/AgentSidebar.tsx`
- **新建** `src/modules/agent-watch/components/AgentRowCard.tsx`
- **改写** `src/modules/agent-watch/AgentWatchBoard.tsx` 的 layout（去掉左 sidebar 列）

#### Mobile 适配（自然 free）

- `grid-cols-1 md:grid-cols-3` 自动处理：lg/md 下 3 列横排，sm 下 1 列纵排（每张 AgentCard 占满宽度）
- MessageStream 在所有断点都全宽
- 不需要双套布局逻辑

### M5 — Stream 交错出现（Dan 第四轮反馈 2026-04-28）

**问题**：当前 batch 进入是同时——LLM 一轮 3 条 Agent 消息 + 同时 5 条 signal——一次性刷下来 8 条全是 `11:01`，用户感受是"批次刷屏"，不像"持续在动"。

**根因**：M3 引入的 `buildFeedItems(messages, signals)` 用 useMemo 一次性合并并渲染。task-09 v1 原本有的 typing timer（Agent 消息每条间隔 1.6s 入栈）在 M3 改造中被绕过了——signal 没走 timer 直接全部 visible。

**修订**：让 signal 也走 typing-style timer 入栈，与 Agent 消息时序混合自然交错。

#### 实现路径

`AgentWatchBoard.tsx`：

```tsx
const [visibleAgentMessages, setVisibleAgentMessages] = useState<AgentWatchMessage[]>([]);
const [visibleSignalIds, setVisibleSignalIds] = useState<Set<string>>(new Set());

// task-09 v1 已有的 typing timer 保留 — Agent 消息逐条 push（间隔 1.6s）
useEffect(() => {
  /* 现有 LLM batch typing 时序，不动 */
}, [latest]);

// M5 新增 — signal 也走 progressive push（间隔 1.5s）
const lastSignalPushedRef = useRef<string | null>(null);
useEffect(() => {
  if (!marketSignals.length) return;

  // 取出尚未 visible 的新 signal（按 ts 升序）
  const pendingSignals = marketSignals
    .filter((s) => !visibleSignalIds.has(s.id))
    .sort((a, b) => a.ts - b.ts);

  if (pendingSignals.length === 0) return;

  // 第一条立即 push，后续每条间隔 1500ms
  const timers: number[] = [];
  pendingSignals.forEach((sig, idx) => {
    const delay = idx === 0 ? 0 : idx * 1500;
    const timer = window.setTimeout(() => {
      setVisibleSignalIds((prev) => {
        const next = new Set(prev);
        next.add(sig.id);
        return next;
      });
    }, delay);
    timers.push(timer);
  });

  return () => {
    timers.forEach((t) => window.clearTimeout(t));
  };
}, [marketSignals]);

// 合并 visible signals + visible agent messages 给 MessageStream
const visibleSignals = useMemo(
  () => marketSignals.filter((s) => visibleSignalIds.has(s.id)),
  [marketSignals, visibleSignalIds],
);

const feedItems = useMemo(
  () => buildFeedItems(visibleAgentMessages, visibleSignals),
  [visibleAgentMessages, visibleSignals],
);
```

#### 时序自然交错效果

数据进来：

- LLM batch 11:01:00 含 3 Agent 消息
- signals 11:01:00, 11:01:05, 11:01:15, 11:01:30 (4 条)

时间线（用户视角）：

- t+0s : signal 1 (11:01:00) 入栈
- t+1.5s : signal 2 (11:01:05) 入栈
- t+1.6s : Agent A 进入 typing → 进入 visible
- t+3s : signal 3 (11:01:15) 入栈
- t+3.2s : Agent B 进入 typing → 进入 visible
- t+4.5s : signal 4 (11:01:30) 入栈
- t+4.8s : Agent C 进入 typing → 进入 visible

视觉效果：8 秒内消息陆续出现，用户感受"事件持续发生"。

#### 限制

- 每条 signal 进入间隔 1.5s（避免太密）
- Agent typing 间隔保留 task-09 v1 的 1.6s
- 两个 timer 互不阻塞（独立 useEffect）

### M6 — 系统消息 dot 对齐（Dan 第四轮反馈 2026-04-28）

**问题**：当前 `SystemSignalBubble` 是 hug-content + 居中（`flex justify-center` + 内容自适应宽度），不同消息长度不同 → 容器宽度不同 → dot 位置在不同水平。

**修订**：固定容器宽度 + 居中 + dot 在容器内左侧固定位置。

```tsx
function SystemSignalBubble({ signal }: { signal: SignalRecord }) {
  return (
    <div className="my-2 flex justify-center">
      <div className="flex w-full max-w-md items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1.5">
        {/* dot 在固定左位置，所有 SystemSignalBubble 的 dot 在同一垂直线 */}
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[signal.severity]}`} />
        <span className="shrink-0 font-mono text-[10px] text-white/40">
          {formatTime(signal.ts)}
        </span>
        <span className="flex-1 truncate text-xs text-white/55">{signal.payload.description}</span>
      </div>
    </div>
  );
}
```

关键改动：

- 容器：`w-full max-w-md` 固定宽度（28rem = 448px）+ 外层 `flex justify-center` 居中放置
- 内部：dot + 时间 + 描述 横向排列，dot 永远在 max-w-md 容器的左侧 12px 位置
- `truncate` 让长描述不破坏对齐
- 所有 SystemSignalBubble 的 dot 在同一垂直线对齐

视觉效果：5 条系统消息所有 dot 都在容器左缘（屏幕大约 38% 位置），垂直对齐成一条线。

### v1.1 验收

- [ ] MarketEventFeed CSS animation 持续滚动（5s+ 观察看是否流畅）
- [ ] Hover 跑马灯暂停，离开恢复
- [ ] Reduce motion 用户跑马灯停在原位
- [ ] Hero 区 H1 是 `Live · 加密市场` 大字号
- [ ] Hero 区 subtitle `3 个 Agent 同时盯盘。Alpha 看突破，Beta 看趋势，Gamma 看极端。` 灰字
- [ ] 顶部紫色 LIVE dot 标签删除
- [ ] MessageStream 含 SystemSignalBubble 类型消息（M3）
- [ ] 系统消息单 symbol 60s 内只 1 条（M3）
- [ ] 系统消息视觉明显小于 Agent 消息，居中胶囊形（M3）
- [ ] AgentSidebar.tsx **不存在**（M4，grep 无输出）
- [ ] AgentRowCard.tsx **存在**（M4）
- [ ] 3 AgentCard 横向并排在 ticker/feed 下方（M4）
- [ ] MessageStream 横向占满全宽（M4）
- [ ] AgentRowCard 单卡高度 ≤ 220px（M4，避免再次挤压 stream）
- [ ] mobile (sm) 下 3 卡纵向堆叠，stream 仍全宽（M4）
- [ ] (M5) Stream 内消息**逐条**渐次出现，不是批量同时出现
- [ ] (M5) 系统消息进入间隔 ≈ 1.5s（visibleSignalIds setTimeout 链）
- [ ] (M5) Agent 消息保持原 typing 节奏，不被信号 timer 干扰
- [ ] (M5) 已显示过的消息 id 不会重复触发动画（visibleSignalIds Set 去重）
- [ ] (M5) 卸载/依赖更新时 setTimeout 全部 clear（无内存泄漏 / 无幽灵动画）
- [ ] (M6) 所有 SystemSignalBubble dot 在同一垂直线对齐（容器固定 max-w-md）
- [ ] (M6) 长描述被 truncate 截断，不破坏 dot/时间对齐
- [ ] (M6) desktop 容器宽度 ≈ 448px（max-w-md），mobile 撑满 w-full 不破版

### v1.1 提交（M1+M2+M3+M4+M5+M6 全做，1 个 commit）

```sh
git checkout feature/act1-5-watch-sedimentation-01
git pull origin feature/act1-5-watch-sedimentation-01

# 实施全部 6 条修订
git rm src/modules/agent-watch/components/AgentSidebar.tsx        # M4 删除
git add src/modules/agent-watch/components/MarketEventFeed.tsx \  # M1 跑马灯
        src/modules/agent-watch/components/AgentRowCard.tsx \      # M4 新建
        src/modules/agent-watch/components/MessageStream.tsx \     # M3 接收 WatchFeedItem
        src/modules/agent-watch/components/SystemSignalBubble.tsx \ # M3 新建 + M6 容器固定宽度
        src/modules/agent-watch/AgentWatchBoard.tsx \              # M2 + M4 layout + M5 visibleSignalIds 渐次推送
        src/app/globals.css                                         # M1 marquee keyframes

git commit -m "fix(watch-ux): marquee + title hierarchy + stream system msgs + horizontal agent cards + progressive stream + dot align (task-11 v1.1)

M1: MarketEventFeed setInterval step → CSS @keyframes continuous marquee (60s/loop, hover-pause, reduce-motion guard)
M2: Hero pageTitle now H1 large 'Live · 加密市场', pageSubtitle as gray supporting text (was inverted)
M2: Drop top purple LIVE dot label (redundant with title)
M3: MessageStream accepts WatchFeedItem[] (agent + market-event union from task-09 v1 type)
M3: New SystemSignalBubble — centered pill, dimmer than Agent bubble, per-symbol 60s dedup, max 12 items
M3: Stream now updates every 1-2min instead of every 5-10min
M4: AgentSidebar removed, replaced by 3 AgentRowCard arranged horizontally above MessageStream
M4: AgentRowCard ≤ 220px tall (line-clamp judgment, single-line trigger, fail collapsed)
M4: Drop evidenceCount display ('X 条信号支撑' was rarely read in horizontal layout)
M4: MessageStream now occupies full width below cards; mobile (sm) stacks 3 cards vertically
M5: Stream 渐次出现 — visibleSignalIds Set + setTimeout 链 (1.5s/条 间隔)；不再批量同步出现
M5: Agent 消息 typing timer 与信号 timer 解耦，互不干扰
M5: 卸载/marketSignals 变化时 clearTimeout 全部 timer，避免内存泄漏
M6: SystemSignalBubble 容器改 max-w-md 居中固定宽度，dot 永远在容器左缘 12px 位置
M6: 所有系统消息 dot 在同一垂直线对齐；长描述 truncate 兜底"

git push origin feature/act1-5-watch-sedimentation-01
```

PR #16 自动更新。

---

## 16. v1.2 修订（task-11 v1.1 落地后 Dan 第五轮反馈，2026-04-29）

> Dan 在 v1.1 落地后看 preview 给出 5 条新反馈，全部采纳。**M11 是结构性决策**：撤掉 stream 里的 SystemSignalBubble，分析和短信息彻底分开——根因是系统信号已在跑马灯（M1）+ ticker 双重曝光，再进 stream 就是三次重复，M5 调节奏治标不治本。
>
> v1.2 = M7 + M8 + M9 + M10 + M11，1 个 commit 出齐。

### M7 — 涨绿跌红（行业标准颜色）

**问题**：当前 ticker / feed / bubble 里 +涨幅是红色、−跌幅是绿色（A 股习惯）。加密行业通用是 Binance / Coinbase / CMC / CoinGecko 全部涨绿跌红，用户在加密语境下看到红色 +162% 会瞬间懵。

**修订**：全站 PRICE_DELTA 颜色翻转。

```ts
// 改成中心化 helper（如已存在则就地翻转）
export function priceDeltaColor(pct: number): string {
  if (pct > 0) return "text-emerald-400"; // 涨绿（行业标准）
  if (pct < 0) return "text-rose-400"; // 跌红
  return "text-white/40"; // 0% 灰
}
```

涉及文件（grep 确认）：

- `src/modules/agent-watch/components/CoinTickerStrip.tsx`
- `src/modules/agent-watch/components/MarketEventFeed.tsx`
- `src/modules/agent-watch/components/AgentRowCard.tsx`（如果卡片里展示 % 变化）
- 任何 `text-red-` / `text-green-` / `text-rose-` / `text-emerald-` 出现在涨跌幅渲染处的地方

**Codex 实施前**：grep `+\$\{` / `text-red-` / `text-rose-` / `text-emerald-` / `text-green-` 在 `src/modules/agent-watch/` 范围找出所有涨跌渲染点，统一收敛到 `priceDeltaColor()` helper（或就地翻转）。

### M8 — AgentRowCard 头像放大

**问题**：M4 横向卡片落地后，头像太小（约 36px），3 卡横向并排时视觉重心全在文字。Dan 反馈"头像太小了"。

**修订**：头像尺寸 `w-9 h-9` → `w-14 h-14`（56px），保持卡片整体 ≤ 220px 高度约束。

```tsx
// AgentRowCard.tsx
<div className="shrink-0">
  <AgentAvatar agentId={agent.id} className="h-14 w-14 rounded-2xl" />
</div>
```

如果放大后内容溢出 220px → 缩 line-clamp（judgment 从 3 行 → 2 行）。

### M9 — "关注 PUMP" 文案歧义

**问题**：右上角 chip "关注 PUMP" / "关注 ETH" 含义模糊——是 Agent 当前盯防的（动态）？长期主轨的（固定）？关注关系（社交）？Dan 看不出来。

**修订**：

1. 文案改 "关注 {symbol}" → "盯防 {symbol}"（更明确表达"主动观察"）
2. 加 `title` 属性 tooltip：「Agent 当前重点观察的标的，会随市场信号变化」
3. i18n 10 语同步

i18n key 对位：

- 当前 `dict.watch.agentSidebar.focusLabel = "关注"` → 改 `"盯防"`
- 新增 `dict.watch.agentSidebar.focusTooltip = "Agent 当前重点观察的标的，会随市场信号变化"`
- 9 个非 zh_CN locale 用英文占位：`focusLabel = "Watching"`，`focusTooltip = "Agent's current primary target, rotates with market signals"`

```tsx
// AgentRowCard.tsx
<button
  type="button"
  title={t.watch.agentSidebar.focusTooltip}
  className="shrink-0 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-white/70 hover:bg-white/[0.06]"
>
  {t.watch.agentSidebar.focusLabel}{" "}
  <span className="font-mono text-white/90">{agent.currentFocus.symbol}</span>
</button>
```

### M10 — 机会区异动 / 高 severity 信号视觉提示

**问题**：跑马灯里所有信号 chip 视觉权重一致（灰底 + 灰描述 + dot）。"机会区异动 +162%" 这种高价值信号被淹没在普通信号里。

**修订**：跑马灯 chip 按 severity 分级视觉：

| severity                                                      | 视觉                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `high`（机会区异动 / NEAR_HIGH / NEAR_LOW / BREAKOUT 在主流） | 左边框 `border-l-2 border-l-amber-400/70` + 文字 `text-white/85` + dot `bg-amber-400` |
| `medium`（默认）                                              | 当前样式（dot 按 type 分色，文字 white/55）                                           |
| `low`                                                         | dot `bg-white/30` + 文字 `text-white/40`                                              |

涉及文件：`src/modules/agent-watch/components/MarketEventFeed.tsx`（跑马灯 chip 渲染）

**注意**：severity 在 `marketSignals.ts` 已有，不需要新增类型字段。直接读 `signal.severity` 切样式。

### M11 — 撤掉 stream 里的 SystemSignalBubble，分析与短信息彻底分开（结构性）

**问题**：Dan 反馈"信息出现逻辑依旧不对"。根因不是 M5 节奏没调好，是 SystemSignalBubble 进 stream 这个设计本身有结构性重复——系统信号已经在跑马灯（M1）+ ticker 出现过，进 stream 是第三次曝光，再调节奏也只是把"批量重复"拆成"渐次重复"。

**修订**：

1. **MessageStream 只渲染 AgentMessage**，不再接受 WatchFeedItem
2. **删除** `SystemSignalBubble.tsx`
3. AgentWatchBoard 不再向 MessageStream 注入 SystemSignal
4. 系统信号统一在跑马灯（MarketEventFeed）里展示，M10 提升其视觉表现力补偿
5. M5 setTimeout 链保留，但只对 AgentMessage 生效（agentId 区分 typing 节奏）
6. M6 容器对齐问题随 SystemSignalBubble 删除自动消失

**类型还原**：

```ts
// MessageStream.tsx
type Props = {
  messages: AgentMessage[]; // 退回 v1，不再是 WatchFeedItem[]
  // ...
};
```

**Agent 消息密度问题如何解决**：

- 当前 Agent 消息每 1-2min 一条 → 用户感觉"死的"是因为 stream 里只有 Agent 消息时显得稀疏
- 解决：保持 LLM 调用频率不变，但 stream 增加"信号事件触发即评论"机制——任何 signal 进入触发对应派别 Agent 5s 内回应（已在 task-11 T4 部分实现，verify 落地）
- 跑马灯系统信号继续滚动（用户视觉不会"死"）

涉及文件：

- `src/modules/agent-watch/components/MessageStream.tsx`（类型 + 渲染简化）
- `src/modules/agent-watch/AgentWatchBoard.tsx`（撤 SystemSignal 注入逻辑）
- `src/modules/agent-watch/components/SystemSignalBubble.tsx`（**删除**）

### v1.2 验收

- [ ] (M7) BTC/ETH/SOL/USDT/BLEND/PUMP/TAO 涨幅显示绿色，跌幅显示红色
- [ ] (M7) 跑马灯里所有 % 颜色和 ticker 一致（涨绿跌红）
- [ ] (M7) `priceDeltaColor()` helper 集中导出（grep 确认无散落 `text-red-`/`text-green-` 在涨跌渲染处）
- [ ] (M8) AgentRowCard 头像 ≥ 56px，视觉重心明显平衡
- [ ] (M8) 卡片高度仍 ≤ 220px（M4 约束保留）
- [ ] (M9) 3 卡片右上角 chip 文案为"盯防 {symbol}"
- [ ] (M9) hover chip 显示 tooltip
- [ ] (M9) i18n 10 语 `focusLabel` + `focusTooltip` 字段都存在（types.ts 加字段，每语 dict 都有）
- [ ] (M10) 跑马灯里 severity=high 信号有左边框 + 文字提亮
- [ ] (M10) severity=medium/low 维持当前样式
- [ ] (M11) `SystemSignalBubble.tsx` **不存在**（grep 无输出）
- [ ] (M11) MessageStream `messages` prop 类型为 `AgentMessage[]`，不是 `WatchFeedItem[]`
- [ ] (M11) Stream 里不再出现"11:27 BTC 距前高 0.08%, 正在测压"这种系统信号，只有 Agent 头像气泡
- [ ] (M11) 系统信号在跑马灯里继续显示，未丢失
- [ ] (M11) M5 setTimeout 链保留，但只对 Agent 消息生效

### v1.2 提交（M7+M8+M9+M10+M11，1 个 commit）

```sh
git checkout feature/act1-5-watch-sedimentation-01
git pull origin feature/act1-5-watch-sedimentation-01

# 实施全部 5 条修订
git rm src/modules/agent-watch/components/SystemSignalBubble.tsx   # M11 删除
git add src/modules/agent-watch/components/CoinTickerStrip.tsx \   # M7 涨绿跌红
        src/modules/agent-watch/components/MarketEventFeed.tsx \   # M7 + M10 severity 高亮
        src/modules/agent-watch/components/AgentRowCard.tsx \      # M7 + M8 头像 + M9 文案
        src/modules/agent-watch/components/MessageStream.tsx \     # M11 退回 AgentMessage[]
        src/modules/agent-watch/AgentWatchBoard.tsx \              # M11 撤 SystemSignal 注入
        src/i18n/types.ts \                                         # M9 字段
        src/i18n/dicts/zh_CN.json \                                 # M9 中文文案
        src/i18n/dicts/zh_TW.json \                                 # M9
        src/i18n/dicts/en_US.json \                                 # M9
        src/i18n/dicts/ja_JP.json \                                 # M9
        src/i18n/dicts/ru_RU.json \                                 # M9
        src/i18n/dicts/uk_UA.json \                                 # M9
        src/i18n/dicts/fr_FR.json \                                 # M9
        src/i18n/dicts/es_ES.json \                                 # M9
        src/i18n/dicts/ar_SA.json \                                 # M9
        src/i18n/dicts/en_XA.json                                   # M9 占位

git commit -m "fix(watch-ux): industry color + bigger avatar + clearer chip + severity hint + split stream (task-11 v1.2)

M7: PRICE_DELTA color flipped to industry standard — green for gains, red for losses (Binance/Coinbase/CMC convention)
M7: Centralized priceDeltaColor() helper, replaced scattered text-red-/text-green- in ticker/feed/cards
M8: AgentRowCard avatar w-9 h-9 → w-14 h-14 (56px), card still ≤ 220px tall (line-clamp judgment to 2 lines if overflow)
M9: '关注 {symbol}' → '盯防 {symbol}' for clarity (was ambiguous: relationship? long-term? dynamic?)
M9: Added title tooltip on focus chip: 'Agent 当前重点观察的标的，会随市场信号变化'
M9: i18n 10 locales updated (focusLabel + focusTooltip new field in types.ts)
M10: MarketEventFeed chip — severity=high gets left border + amber dot + brighter text (机会区异动 / NEAR_HIGH / NEAR_LOW / BREAKOUT)
M10: severity=medium/low keep current visual; high signals no longer drowned in noise
M11: SystemSignalBubble.tsx removed — system signals were exposed 3x (ticker + marquee + stream), redundant by design
M11: MessageStream messages prop reverted from WatchFeedItem[] to AgentMessage[] (v1 type)
M11: AgentWatchBoard drops SystemSignal injection logic; stream now only renders Agent bubbles
M11: M5 setTimeout chain retained but applies only to Agent messages now"

git push origin feature/act1-5-watch-sedimentation-01
```

PR #16 自动更新。

---

## 17. v1.3 修订（task-11 v1.2 落地后 Dan 第六轮反馈，2026-04-29）

> Dan 看 v1.2 preview 给出 6 条反馈：3 条 watch 页修订（M12 文案再迭代 / M13 USDT 取消 / M14 stream 重复 bug）+ 3 条 hero 修订（M15 机器人位置回归 / M16 hover 接行情 / M17 click 跳转）。M14 是 bug，需 Codex 先诊断再修。M16/M17 虽属 hero 不属 watch，但塞同一 commit 节省转发成本。
>
> v1.3 = M12 + M13 + M14 + M15 + M16 + M17，1 个 commit 出齐。

### M12 — "盯防" 改 "当前关注"（v1.2 M9 的二次迭代）

**问题**：M9 把"关注"改"盯防"，Dan 反馈"逻辑还是不清"，直接给文案"当前关注 XXX"。"当前"两字自带动态语义，不需要 tooltip 解释。

**修订**：

1. `focusLabel`: `"盯防"` → `"当前关注"`
2. **删除** `focusTooltip` 字段（"当前"两字已自解释）+ 删 button title 属性
3. i18n 10 语同步：当前关注 / Watching now / 現在ウォッチ / Сейчас следит за / Зараз стежить / Suit actuellement / Vigilando / يراقب الآن / etc

**types.ts 改动**：移除 `focusTooltip` 字段（v1.2 刚加，v1.3 删掉）。

```tsx
// AgentRowCard.tsx — 简化版
<button
  type="button"
  className="shrink-0 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-white/70 hover:bg-white/[0.06]"
>
  {t.watch.agentSidebar.focusLabel}{" "}
  <span className="font-mono text-white/90">{agent.currentFocus.symbol}</span>
</button>
```

### M13 — USDT 从主流币池取消 + Gamma 改盯极端波动币

**问题**：USDT 是 USD-pegged 稳定币，24h 波动 ±0.01-0.05%，无分析价值。当前 ticker 主流栏含 USDT、Gamma（极端值狙击手）盯 USDT——两个位置都要修。

**修订**：

**13.1 主流币池 BTC / ETH / SOL（3 个，删 USDT）**

- 文件：`src/lib/marketSignals.ts` 主流币常量数组
- 当前定义：`MAJOR_SYMBOLS = ['BTC', 'ETH', 'SOL', 'USDT']`（grep 实际名）
- 改为：`MAJOR_SYMBOLS = ['BTC', 'ETH', 'SOL']`
- ticker 主流栏自动跟随
- range_change majors 守卫（task-11 T6）跟随更新

**13.2 Gamma 当前关注从 USDT 换 PUMP**

- Gamma 人设是"回归派 · 极端值狙击手"——盯极端涨跌的，USDT 不动他没法狙
- PUMP 当前 24h +7.78%（机会区），适合 Gamma 当前关注
- 实际 currentFocus 应该是动态的，按 task-09 设计基于市场信号选当前最极端币
- 修订：currentFocus 选择逻辑里 Gamma 优先选**机会/热门栏中波动最大的**，主流栏排除（避免选回 BTC/ETH/SOL 太稳）
- 默认 fallback：如果没满足条件信号则 currentFocus = '—' 显示"等待信号"

涉及文件：

- `src/lib/marketSignals.ts`（主流栏常量）
- `src/lib/agentLogic.ts` 或类似（Gamma currentFocus 选择，grep 找）
- 任何 hardcode "USDT" 在 hero/agent 配置的位置都要删

### M14 — Stream 消息字字相同重复出现（bug，需先诊断后修）

**问题**：Dan 截图显示 Alpha / Beta / Gamma 同时间戳（11:44）各发了 1 条消息，紧接着又**字字相同**地各发 1 条——3 条消息变 6 条。

**嫌疑路径（Codex 调查时按以下顺序排查）**：

1. **AgentWatchBoard messages state 管理**：
   - grep `setMessages` / `setBatches` 找所有写入点
   - 检查是否同一 batch 被 append 两次（race condition：fetch 返回 + setTimeout 触发同时 setState）
   - 验证 reducer/setState 对相同 id 的消息是否去重

2. **M5 setTimeout 链是否触发已显示消息再渲染**（v1.1 引入的 visibleSignalIds 是否泄漏到 messages）：
   - M11 已撤掉 SystemSignalBubble，M5 现在只对 Agent 消息生效
   - 检查 visibleAgentMessageIds 之类的 Set 是否被 marketSignals useEffect 误触

3. **LLM polling 重复请求**：
   - grep `triggerSignalGeneration` 三入口（ticker/events/analysis route）
   - 检查同一信号是否在 5s 内被多 route 重复 trigger 同一 batch
   - LLM cache key 是否漏算 batchId 导致重复写入

4. **MessageStream 渲染层去重**：
   - 检查 `messages.map((m) => <MessageBubble key={m.id} />)` 的 key 是否唯一
   - 如果 message.id 不唯一则 React 不会去重 → 表现为重复渲染

**修复要求**：

- Codex 在 commit message 里**写明 root cause**（哪一层导致重复）
- 修复后强制按 `message.id` 在 messages state 层去重（即使上游有 bug 也兜底）
- 加单元测试或 dev-mode warning：如果 messages 数组出现重复 id，console.warn

**验收**：

- Stream 5min 内不再出现连续 2 条 id 相同 / 内容字字相同的消息
- Dan 截图比对，无重复气泡

### M15 — Hero 机器人位置回归

**问题**：Dan 截图显示 hero 机器人位置变了（具体不知道改前是什么样，需要 git log 找）。

**调查 + 修订**：

1. Codex 先跑：

   ```sh
   git log --oneline -- src/app/[locale]/page.tsx | head -20
   git log --oneline -- src/app/page.tsx | head -20  # 兼容 root layout
   ```

   找出 task-09 v1.1 落地后到 v1.2 落地前所有动过 hero 的 commit

2. 对比 hero 区现状 vs `task-09-v1.1-final` 落地时的状态（用 `git show <commit>:src/app/[locale]/page.tsx`）

3. 找到位移点 → revert hero 部分（`<HeroSection>` 或 `<Hero>` 组件的 layout/positioning class）

4. 如果是 task-11 commit 误伤（layout 重构波及 page.tsx）→ 把 hero 区单独还原

**注意**：hero 位置如果是 CSS 变量或 Tailwind class 改的，单点 revert；不要碰其他 hero 之外的内容（避免回归连锁）。

**验收**：Dan 比对最新 preview 和"M15 之前"截图，hero 机器人位置一致。

### M16 — Hero 机器人 + 4 个币图标 hover 接行情

**问题**：当前 hero 区机器人 + 4 个币图标（BTC/ETH/SOL/USDT 即将变 BTC/ETH/SOL/BNB？或保持 BTC/ETH/SOL + 1 个 placeholder）hover 时无内容显示，应接入实时行情。

**币图标 hover 内容**（每个币）：

```
BTC
$76,820.85
+0.10% (24h)
```

样式：tailwind tooltip 或 framer-motion AnimatePresence 弹窗，深色半透明背景 + 圆角 + 12px 内边距，距离 icon 8px 上方或下方（避开屏幕边缘）。

**机器人 hover 内容**：

```
3 个 AI Agent · 实时盯盘
点击查看
```

说明机器人是 watch 页入口（配合 M17 click）。

**实现要求**：

- 复用现有 ticker API（`/api/ticker` 或 `useMarketSignals` hook，grep 找）
- 客户端 fetch 一次（mount 时），SWR / 1min revalidate
- hover 时显示 tooltip，离开消失（150ms delay 避免抖动）

**hero 币图标列表决策（Dan 已拍板 2026-04-29）**：**保留当前 4 个币图标 BTC/ETH/SOL/USDT 不动**。

- 取舍逻辑：hero 4 个币是**装饰视觉**（机器人周围对称环绕的品牌符号），不是分析对象——和 M13 watch 页主流栏（BTC/ETH/SOL，3 个，分析用）**解耦**
- Codex 实施 M16 时按 hero 现状 4 个 hardcode 列表渲染，不要从 `MAJOR_SYMBOLS` 常量读（避免 M13 删 USDT 时 hero 也跟着掉一个币破坏视觉对称）
- 如果 hero 当前确实是从 `MAJOR_SYMBOLS` 读的，Codex 在 M16 实施时**显式新建 hero 局部常量** `HERO_DISPLAY_SYMBOLS = ['BTC', 'ETH', 'SOL', 'USDT']`，注释写明"hero 装饰用，与 watch 主流栏解耦"

**验收**：

- **4 个**币图标（BTC/ETH/SOL/USDT）hover 显示行情 tooltip
- 机器人 hover 显示"点击查看"提示
- 行情数据非 hardcode price 数值（数据从 ticker API 实时拿，但**币种列表**是 hero 局部 hardcode 4 个）
- USDT 在 hero 中保留，但 watch 页 ticker 主流栏（M13）已删 USDT —— 两处独立

### M17 — Hero 机器人 + 币图标 click 跳转 watch 页

**问题**：hero 机器人 + 币图标当前不可点击。

**修订**：

- **机器人 click** → `router.push('/{locale}/agent')`（保持当前 locale）
- **币图标 click** → `router.push('/{locale}/agent#{symbol}')`（hash 锚点）
  - watch 页 `useEffect` 监听 `window.location.hash`，若 `hash === '#BTC'` 则滚动到 BTC ticker chip 并加亮 1.5s（CSS animation pulse）
  - 如果 hash 不存在或 symbol 不在 ticker 列表则忽略

**实现细节**：

- 机器人和币图标加 `cursor-pointer` + hover scale-105 微动画
- Click 用 Next.js `useRouter` 的 `push`，不要 `<Link>` 标签（hero 是 client component，跳转更可控）
- 滚动用 `scrollIntoView({ behavior: 'smooth', block: 'center' })`

**验收**：

- Click hero 机器人 → 跳 `/zh_CN/agent`
- Click BTC 图标 → 跳 `/zh_CN/agent#BTC`，watch 页打开自动滚到 BTC 并加亮
- 其他 locale 同样规则

### M18 — 气泡去 glow，左 2px accent bar 替代派别色边框

**问题**：每条 Agent 气泡都有派别色边框 + 外发光（红橙/蓝/紫），密集出现时屏幕全是发光彩条，"花"。派别识别已经在头像光晕表达过了，气泡再发光是重复。

**修订**：

```tsx
// MessageBubble.tsx
// 旧（v1.2 M5）：边框 + 阴影 + 派别色 glow
className="border border-[var(--agent-color)] shadow-[0_0_12px_var(--agent-color-glow)]"

// 新（v1.4 M18）：左 2px accent bar 派别色 + 主体灰白
<div className="relative bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
  <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full" style={{ background: AGENT_COLOR_TOKEN[agentId] }} />
  {/* 内容 */}
</div>
```

派别色 mapping 不变（`AGENT_COLOR_TOKEN`），但只在 2px bar 出现，不刷屏。

### M19 — 删除每条消息的 LIVE chip，板块标题加全局 LIVE 指示

**问题**：每条气泡都带 `[LIVE]` 紫色 chip，6 条消息就有 6 个 LIVE 标签，视觉冗余且无信息增量（所有消息都是 LIVE 来的，没有"非 LIVE"对照组）。

**修订**：

1. **删** MessageBubble 里的 LIVE chip 渲染
2. **加** AgentWatchBoard 顶部 stream 区标题：`Live · 加密市场` 旁边一个常驻绿色 dot + "LIVE" 小字（已存在的 LIVE 指示器）
3. 每条消息保留时间戳 `16:21`，去 LIVE chip

```tsx
// MessageBubble.tsx 头部行
<div className="mb-1 flex items-center gap-2">
  <span className="font-semibold text-white/85">{agentName}</span>
  {/* 删除 <LiveBadge /> */}
  <span className="font-mono text-[11px] text-white/40">{formatTime(message.ts)}</span>
</div>
```

i18n：删除 `dict.watch.messageBubble.liveLabel`（如果存在），types.ts 同步删字段。

### M20 — AgentRowCard glow 减弱，保留派别色但收敛

**问题**：3 卡片当前外发光强（box-shadow blur 派别色），3 卡并排时屏幕上方一片彩虹光。

**修订**：

- 边框：保留 `border border-[var(--agent-color-faint)]`（派别色 30% 透明度）
- 阴影：删除 `box-shadow` 派别色 glow，改用 `bg-white/[0.02]` 微低对比内填充
- hover 时才加微弱 glow（`hover:shadow-[0_0_8px_var(--agent-color-glow)]`）

```tsx
// AgentRowCard.tsx
className =
  "relative rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:border-[color:var(--agent-color-faint)] hover:bg-white/[0.03] transition-colors";
// 删除：shadow-[0_0_24px_var(--agent-color-glow)]
```

派别识别靠头像光晕（已有，未改）+ 卡内 "突破派 / 趋势派 / 回归派" 文字标签，不靠卡片本身发光。

### M21 — 触发频率优化：信号只触发相关派别 Agent

**问题**：当前架构下任何信号到达都触发 3 个 Agent 同步发言，导致 stream 一波 3 条。视觉密度高 + 内容相关性低（Beta 趋势派被迫聊 PUMP 突破、Gamma 回归派被迫聊 ETH 趋势）。

**修订**（task-11 T4 已部分设计，v1.4 强化落地）：

**信号 → 派别路由表**（`src/lib/agentRouter.ts` 或类似新建）：

| signal type                                  | 触发派别         |
| -------------------------------------------- | ---------------- |
| `BREAKOUT` / `NEAR_HIGH` / `NEAR_LOW`        | Alpha（突破派）  |
| `EMA_CROSS` / `VOLUME_SPIKE`（持续型）       | Beta（趋势派）   |
| `RANGE_CHANGE`（机会区异动 / 极端涨跌）      | Gamma（回归派）  |
| **集体信号**（≥3 个 symbol 同向异动 30s 内） | 全 3 派各发 1 条 |

**实现**：

1. signal 进入触发器时按 type 路由到对应派别 LLM
2. 单派别 5min 内最多发 3 条（限频）
3. 集体信号触发"全派别集合"——这是 stream 高峰时刻，3 条出现合理；非集体信号 stream 应该相对稀疏

**预期效果**：

- 单一信号 → 1 条 Agent 消息（不是 3 条）
- 集体信号 → 3 条（合理高峰）
- 5min 内 stream 平均 ~5-8 条（vs 当前 ~15-18 条）

**verify task-11 T4 已落地的部分**：grep `triggerSignalGeneration` / `agentRouter` / `factionDispatch`，看是否已有路由逻辑，若有则强化条件，若无则新建。

### v1.3 + v1.4 验收

- [ ] (M12) 3 卡 chip 文案为"当前关注 {symbol}"
- [ ] (M12) chip 上无 title tooltip（删除）
- [ ] (M12) types.ts 不再有 focusTooltip 字段
- [ ] (M12) i18n 10 语 focusLabel 全部更新（grep 无残留"盯防"）
- [ ] (M13) ticker 主流栏只有 BTC/ETH/SOL，无 USDT
- [ ] (M13) Gamma currentFocus 不会再选 USDT，优先机会/热门栏波动大的币
- [ ] (M13) `MAJOR_SYMBOLS` 常量只 3 个值（grep 确认）
- [ ] (M14) Codex commit message 写明 root cause
- [ ] (M14) Stream 5min 内无 id 重复 / 内容字字相同的消息
- [ ] (M14) messages state 层按 id 兜底去重
- [ ] (M15) hero 机器人位置和 task-09 v1.1 落地时一致
- [ ] (M15) git log 显示 hero 误伤的 commit 已 revert
- [ ] (M16) **4 个**币图标（BTC/ETH/SOL/USDT，hero 装饰保留 USDT，Dan 拍板）hover 显示行情 tooltip（symbol + price + 24h%）
- [ ] (M16) hero 币列表使用局部常量 `HERO_DISPLAY_SYMBOLS`，**不**从 `MAJOR_SYMBOLS` 读（解耦 watch 主流栏）
- [ ] (M16) 机器人 hover 显示"点击查看"
- [ ] (M16) 行情数据来自 ticker API，非 hardcode
- [ ] (M17) 机器人 click 跳 `/{locale}/agent`
- [ ] (M17) 币图标 click 跳 `/{locale}/agent#{symbol}`
- [ ] (M17) watch 页接收 hash 后滚动到对应 ticker chip 并加亮 1.5s
- [ ] (M17) 不存在的 symbol hash 被忽略（不报错）
- [ ] (M18) MessageBubble 不再有派别色边框 + 外 glow shadow
- [ ] (M18) MessageBubble 左侧 2px accent bar 显示派别色
- [ ] (M18) 气泡主体灰白（bg-white/[0.03]），密集出现时不刷屏
- [ ] (M19) MessageBubble 内不再有 LIVE chip（grep 无残留）
- [ ] (M19) AgentWatchBoard 顶部 stream 区有全局 LIVE 指示
- [ ] (M19) i18n 中 liveLabel 字段已删（types.ts + 10 语 dict）
- [ ] (M20) AgentRowCard 默认无 box-shadow glow，仅 hover 时弱 glow
- [ ] (M20) 卡片边框为 white/[0.08]，hover 时变派别色
- [ ] (M20) 派别识别不依赖卡片发光（靠头像 + 文字）
- [ ] (M21) 单一信号只触发 1 个对应派别 Agent，不是 3 个全发言
- [ ] (M21) 集体信号（≥3 个 symbol 同向异动 30s 内）才触发全 3 派
- [ ] (M21) 5min 内 stream 消息数从 ~15-18 降到 ~5-8（Codex preview 截图验证）
- [ ] (M21) 信号 → 派别路由逻辑落 `agentRouter.ts` 或类似集中位置（grep 可定位）

### v1.3 + v1.4 提交（M12-M17 + M18-M21，可拆 2 commit 或合 1 commit，Codex 自决）

```sh
git checkout feature/act1-5-watch-sedimentation-01
git pull origin feature/act1-5-watch-sedimentation-01

# Codex 实施前先调查（M14 root cause + M15 hero diff）：
git log --oneline -- src/app/\[locale\]/page.tsx | head -20
grep -rn "MAJOR_SYMBOLS\|setMessages\|setBatches\|focusTooltip" src/

# 实施 6 条修订
git add src/modules/agent-watch/components/AgentRowCard.tsx \      # M12 文案
        src/i18n/types.ts \                                         # M12 删 focusTooltip
        src/i18n/dicts/*.json \                                     # M12 10 语
        src/lib/marketSignals.ts \                                  # M13 主流栏
        src/lib/agentLogic.ts \                                     # M13 Gamma focus + M14 messages 去重（如 root cause 在此）
        src/modules/agent-watch/AgentWatchBoard.tsx \              # M14 messages 兜底去重
        src/modules/agent-watch/components/MessageStream.tsx \     # M14 渲染层去重 + key 唯一
        src/app/\[locale\]/page.tsx \                              # M15 hero revert + M16/M17 hover & click
        src/modules/landing/HeroSection.tsx                         # M16/M17 如 hero 拆出独立组件

git commit -m "fix(watch+hero): copy iteration + drop USDT + dedup stream + hero regression + hover ticker + click jump (task-11 v1.3)

M12: '盯防 {symbol}' → '当前关注 {symbol}'; removed focusTooltip field (self-explanatory now)
M12: i18n 10 locales updated; types.ts focusTooltip field deleted
M13: USDT removed from MAJOR_SYMBOLS (stablecoin, no analytical value); ticker now BTC/ETH/SOL
M13: Gamma currentFocus selection logic — exclude majors, prefer 机会/热门 with biggest 24h move
M14: ROOT CAUSE: <Codex 填> (e.g., 'AgentWatchBoard appended same batch twice via concurrent fetch + setTimeout')
M14: Added id-based dedup in messages reducer; React key uniqueness enforced; dev-mode warn on dup id
M15: Hero robot positioning reverted — task-11 layout commit accidentally moved hero, restored to task-09 v1.1 baseline
M16: Hero coin icons (BTC/ETH/SOL/USDT — Dan kept 4 for decorative symmetry, decoupled from watch MAJOR_SYMBOLS) + robot now show hover tooltips
M16: New HERO_DISPLAY_SYMBOLS local constant — hero icon list independent from watch ticker majors
M16: Coin tooltip — symbol + live price + 24h %; data via ticker API (SWR 1min revalidate)
M16: Robot tooltip — '3 个 AI Agent · 实时盯盘 · 点击查看'
M17: Robot click → /{locale}/agent; coin icon click → /{locale}/agent#{symbol}
M17: Watch page useEffect monitors location.hash, scrolls to matching ticker chip + 1.5s highlight pulse
M18: MessageBubble — removed faction-color border + outer glow shadow; left 2px accent bar carries faction identity
M19: Removed per-message LIVE chip; global LIVE indicator at stream header replaces
M20: AgentRowCard — default no faction-color glow; subtle white/0.08 border; hover gains faint colored glow
M21: Signal → faction router — BREAKOUT/NEAR_HIGH/NEAR_LOW → Alpha; EMA_CROSS/VOLUME_SPIKE → Beta; RANGE_CHANGE → Gamma
M21: Collective signals (≥3 symbols moving same direction within 30s) trigger all 3 factions; non-collective triggers single faction
M21: Per-faction rate limit — max 3 messages per 5min; expected stream density drops from ~15-18 to ~5-8 per 5min"

git push origin feature/act1-5-watch-sedimentation-01
```

PR #16 自动更新。

---

_维护者: F_
_创建: 2026-04-28_
_v1.1 修订: 2026-04-28（task-11 v1 落地后 Dan 第三+第四轮反馈）_
_v1.2 修订: 2026-04-29（task-11 v1.1 落地后 Dan 第五轮反馈，5 条 M7-M11）_
_v1.3 修订: 2026-04-29（task-11 v1.2 落地后 Dan 第六轮反馈，6 条 M12-M17）_
_v1.4 修订: 2026-04-29（task-11 v1.3 设计阶段 Dan 第七轮反馈"太花"，4 条 M18-M21，合并入 v1.3 commit）_
_执行者: Codex_
_基于: PR #16 task-09 v1.1 落地 + 二/三/四/五/六/七轮反馈累计 21 条修订（M1-M21 + T1-T7）_
_吸收: task-10（5 条）+ Dan 文案决策（Q1）+ K 线延迟 badge 删除_
_分支: 在 PR #16 同分支 feature/act1-5-watch-sedimentation-01 加 commit_
_PR target: feature/act1-5-watch-page-01（不变）_
