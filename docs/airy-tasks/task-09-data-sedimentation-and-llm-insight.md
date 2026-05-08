# Task 09 v1.1 — Watch 行情旁观台：数据沉淀 + LLM 解读架构

> **版本**：v1.1（基于 Dan 审核 6 条 blocker 修订）
>
> **目标**：把 `/agent` 旁观秀从"3-5min 出 3 句话的消息流"升级成"持续看见信号 + 基于沉淀做判断的行情旁观台"。LLM 不再每次看当前快照，而是看过去累积信号摘要，输出有论据的 Agent 判断 + 触发/失效条件。
>
> **执行者**：Codex
>
> **基于**：**`feature/act1-5-watch-page-01` 分支**（PR #11，未合 main）。task-07 在同 PR #11 分支累加。production-fix-batch 已在 main，但本 spec 不依赖。
>
> **本 spec 吸收**：原 task-08（多币种池）—— 单独落 task-08 后还要回头改接口。task-08 文件保留作历史参考，本 spec 为准。
>
> **分支**：从 `feature/act1-5-watch-page-01` 拉子分支或直接加 commit。**PR 目标也是 `feature/act1-5-watch-page-01`，不直接 target main**。Act 1.5 整体 stack 上预发，预发评审通过后再统一进 main。
>
> **Dan 决策（2026-04-28）**：
>
> - 不做"最小版本"——按 session 时间跑完 A1-A8 全套
> - 数据沉淀 + LLM 解读方向确认
> - 频率从 5min 上升到 10-15min，靠 buffer 摘要保密度

---

## 0.0 v1.1 修订记录（vs v1，基于 Dan 审核 PR）

| #      | 来源                                           | 修订                                                                                                                                                                                                                                       |
| ------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **M1** | Blocker 1（前置不成立）+ Blocker 2（分支冲突） | 基底改成 `feature/act1-5-watch-page-01` 分支（PR #11）；PR 目标 PR #11 分支不直接 target main；Act 1.5 整体走预发评审                                                                                                                      |
| **M2** | Blocker 3（commit 边界破编译）                 | 4 段 commit 重拆为"可编译渐进"：commit 1 兼容型数据模型 + 新增 pool（保留旧 tickers）；commit 2 buffer + signal + events API（多入口触发）；commit 3 LLM focus 输出（向下兼容，前端可不读）；commit 4 UI 升级 + i18n                       |
| **M3** | Blocker 4（信号触发链路漏洞）                  | 信号生成改"多入口冗余触发"：ticker route + events route + agents/analysis route 都跑 `generateSignals + pushSignals`，buffer 写时去重保证不重复。任一入口活着就能填 buffer                                                                 |
| **M4** | Blocker 5（in-memory 24h 产品承诺过重）        | 文案降级为"preview demo memory / 实例内最近 500 条信号"。验收章删除"24h 滚动"表述。多实例 / 冷启动不一致明确标注为 preview MVP 限制                                                                                                        |
| **M5** | Blocker 6（信号类型超数据范围）                | **v1 删除 `rsi_extreme` 和 `deviation` 两类**（无 RSI / 布林带 / 偏离 EMA144 算法）。v1 保留 5 类：`range_change` / `volume_spike` / `near_high` / `near_low` / `breakout` / `ema_cross`（共 6 type 但 near_high/near_low 是同一概念两面） |
| **M6** | M5 衍生                                        | LLM prompt 加"v1 数据范围"段：禁止 LLM 编造 RSI/布林带/偏离 EMA144 这些 buffer 没有的指标。Gamma（回归派）v1 用"24h 极端涨跌 + 接近近期高低"代替 RSI/布林带视角；术语词典不动（v2 补 RSI/布林带算法后自然激活）                            |

---

## 0. 整体数据流（v1.1 多入口触发）

```
CoinGecko ticker (30s)        CoinW K线 (60s)
       \                          /
        \                        /
         v                      v
   [getCoinPool() 多币种]   [getMarketAnalysisContext() 含 signals]
                  \         /
                   v       v
            [generateSignals(pool, lastPool)] ← 任一 API 入口被调用都触发
                       |
                       v
            [signalBuffer 实例内 ring buffer (max 500，preview demo memory)]
                       |
                ┌──────┴──────┐
                v             v
        前端 30s polling   LLM 摘要消费 (10min fresh / 30min stale)
        /api/agents/events  /api/agents/analysis
                |                |
                v                v
        [MarketEventFeed]    [LLM 输出 JSON: focus + stream + heroBubbles]
                |                |
                v                v
       用户看到「实时市场信号」   用户看到「基于沉淀的 Agent 判断」
                                 |
                                 v
                       [AgentFocusCard 3 张持续展示]
                       [MessageStream 详细推理]
                       [Hero speechBubble 中文优先]
                       [CoinModal 4 主流币点击]
```

**关键 — 多入口冗余触发**（M3 修订）：

`generateSignals + pushSignals` 不只在 ticker route 触发，**三个入口都跑**：

1. `/api/market/ticker` — 老前端 / 外部仍 poll 它时
2. `/api/agents/events` — 新前端 useMarketEventFeed 30s polling 必经路径
3. `/api/agents/analysis` — LLM 调用前 last-mile 触发一次

任一入口活着就持续推动 buffer。buffer 内部按 `id` 写时去重 + 60s 同 symbol/type 折叠，多入口不会重复写入。

**关键 — 实例内记忆**（M4 修订）：

signalBuffer 是 Vercel serverless 实例内 in-memory ring buffer，**不是稳定 24h 记忆**：

- 实例 idle 后 spin down → buffer 清零
- 多实例并发 → 各自独立 buffer，用户随机命中
- 部署更新 → buffer 重置

定位：**preview MVP demo memory**，max 500 条信号 / 单实例。生产级跨实例稳定记忆走 v2 Vercel KV。

---

## 1. 修改清单

### 新建

- `src/lib/signalBuffer.ts` —— ring buffer 模块（in-memory，max 500 条，24h 滚动）
- `src/lib/marketSignals.ts` —— 5 类信号生成算法（消费 task-08 signals，diff 后输出 SignalRecord）
- `src/lib/signalSummary.ts` —— buffer 摘要生成器（给 LLM prompt 用）
- `src/app/api/market/signals/route.ts` —— 信号生成器周期任务的 trigger（或者用 cron-like 模式，详见 Section 3）
- `src/app/api/agents/events/route.ts` —— 前端实时拉 signal feed（30s polling）
- `src/modules/agent-watch/components/MarketEventFeed.tsx` —— 实时事件流前端组件
- `src/modules/agent-watch/components/AgentFocusCard.tsx` —— 3 张 focus card（持续展示）
- `src/modules/agent-watch/hooks/useMarketEventFeed.ts` —— 前端 polling hook

### 修改

- `src/modules/agent-watch/types.ts` —— 加 `SignalRecord` / `AgentFocus` / `WatchFeedItem` 类型
- `src/lib/marketDataCache.ts` —— `getCoinPool()` 同时返回 `signals`（吸收 task-08 修订）+ 加 trending / opportunity 拉取
- `src/app/api/market/ticker/route.ts` —— 返回 `CoinPoolPayload` 而不是 `MarketTickerPayload`（向后兼容字段保留）
- `src/lib/llmFallbackChain.ts` —— `buildPrompt` 重写为消费 buffer 摘要 + 输出 JSON 含 `focus[]` 结构化字段，TTL 10min/30min
- `src/modules/agent-watch/AgentWatchBoard.tsx` —— 新 layout：Ticker + MarketEventFeed + 3 AgentFocusCard + MessageStream
- `src/modules/agent-watch/components/CoinTickerStrip.tsx` —— 三组横向（沿用 task-08 设计）
- `src/i18n/types.ts` + 10 dict —— 加 `agentWatch.focusCard.*` / `agentWatch.marketEvent.*` / `agentWatch.statusLabel.*` 字段

### 不动

- task-05 stale-while-revalidate 主结构 cache（仅 TTL 改成 10min/30min）
- task-06 history buffer（消息级历史，independent of signalBuffer）
- task-07 Agent 人设 + 术语 + 禁用词（继续生效）
- 视觉骨架（card-glow / 蓝光 / 紫色 LIVE 等）
- middleware / Hero / 4 币 modal / SiteHeader / LocaleDropdown

---

## 2. 数据模型

### 2.1 `src/modules/agent-watch/types.ts` 新增

```ts
// 信号记录（写入 signalBuffer）
// v1.1 修订（M5）：删除 rsi_extreme / deviation / rotation 三类
// 原因：当前 marketDataCache 没 RSI / 布林带 / 跨组轮动算法，让 LLM 引用 buffer 没有的字段会导致编造
// v2 补算法时再加回 SignalType
export type SignalType =
  | "volume_spike" // 放量 ≥ 1.8x（CoinW 主流 4 币）
  | "near_high" // 距前高 ≤ 1.5%（CoinW 主流 4 币）
  | "near_low" // 距前低 ≤ 1.5%（CoinW 主流 4 币）
  | "breakout" // 突破前高/前低（CoinW 主流 4 币）
  | "ema_cross" // EMA12/13 金叉死叉（CoinW 主流 4 币）
  | "range_change"; // 24h 涨跌幅 ≥ |10%|（10 币全适用，CoinGecko 数据足够）

export type SignalSeverity = "info" | "watch" | "alert";

export interface SignalRecord {
  id: string; // `${ts}-${symbol}-${type}`
  ts: number;
  symbol: string;
  type: SignalType;
  severity: SignalSeverity;
  payload: {
    volumeRatio?: number;
    priceLevel?: number;
    distancePct?: number;
    emaState?: "golden_cross" | "dead_cross" | "above" | "below";
    rsi?: number;
    deviationPct?: number;
    change24h?: number;
    description?: string; // 自然语言短句（前端 feed 直接显示）
  };
}

// LLM 输出的 Agent focus（结构化）
export type AgentId = "alpha" | "beta" | "gamma";

export interface AgentFocus {
  agentId: AgentId;
  symbol: string; // 当前关注的币
  judgment: string; // 当前判断（≤80 字）
  trigger: {
    // 触发条件（结构化，v2 反向验证用）
    type:
      | "breakout_with_volume"
      | "retest_hold"
      | "ema_cross"
      | "rsi_reversal"
      | "range_break"
      | "custom";
    symbol: string;
    priceLevel?: number;
    volumeRatio?: number;
    description: string; // 自然语言版本
  };
  fail: {
    type: "price_break" | "volume_dry" | "ema_break" | "custom";
    symbol: string;
    priceLevel?: number;
    description: string;
  };
  evidenceCount: number; // 引用了 buffer 里多少条 signal
  generatedAt: number;
}

// MarketEventFeed item（前端展示）
export type WatchFeedItem =
  | { type: "agent"; agentId: AgentId; content: string; timestamp: number; id: string }
  | { type: "market-event"; signal: SignalRecord; id: string };

// 升级 AgentAnalysisPayload
export interface AgentAnalysisPayload {
  generatedAt: number;
  servedAt: number;
  ttl: number;
  source: "minimax" | "deepseek" | "claude" | "cache" | "static-fallback";
  pool: CoinPoolPayload; // 替代旧 tickers，含三组 + signals
  focus: AgentFocus[]; // 新增：3 Agent 各自当前关注（焦点卡用）
  stream: StreamMessage[]; // Agent 详细推理（沿用 task-07）
  heroBubbles: string[]; // Hero 短句（沿用）
  coinComments: Record<MajorCoinSymbol, Record<AgentId, string>>; // 主流 4 币 modal 用
}

// 多币种池（吸收 task-08）
export type MajorCoinSymbol = "BTC" | "ETH" | "SOL" | "USDT";
export type CoinCategory = "majors" | "trending" | "opportunity";

export interface CoinTickerEntry {
  symbol: string;
  name?: string;
  price: number;
  change24h: number;
  category: CoinCategory;
}

export interface CoinPoolPayload {
  ts: number;
  majors: CoinTickerEntry[]; // 固定 4
  trending: CoinTickerEntry[]; // 动态 3
  opportunity: CoinTickerEntry[]; // 动态 3
  signals?: Record<string, CoinMarketContext>; // 仅主流 4 币的 K 线 signals（CoinW）
  source: MarketDataSource;
  isStale?: boolean;
  isFallback?: boolean;
  error?: string;
}
```

---

## 3. Section A1 — 多币种池（吸收原 task-08）

### 3.1 数据源

- **majors**：固定 BTC/ETH/SOL/USDT，CoinGecko `/simple/price` + CoinW K 线（已实现）
- **trending**：CoinGecko `/search/trending` 取前 3，再调 `/simple/price` 拉价格 + 24h 涨跌
- **opportunity**：CoinGecko `/coins/markets?per_page=100&order=market_cap_desc` 排除 majors 后按 24h change 取涨幅 top 2 + 跌幅 top 1

### 3.2 缓存

| 数据             | TTL  |
| ---------------- | ---- |
| majors ticker    | 30s  |
| majors K 线      | 60s  |
| trending list    | 5min |
| opportunity list | 5min |

### 3.3 实现

`src/lib/marketDataCache.ts` 加：

```ts
const TRENDING_CACHE_KEY = "coingecko:trending:v1";
const OPPORTUNITY_CACHE_KEY = "coingecko:opportunity:v1";
const TRENDING_TTL_MS = 5 * 60_000;
const OPPORTUNITY_TTL_MS = 5 * 60_000;
const MAJORS_SYMBOLS = ["BTC", "ETH", "SOL", "USDT"] as const;

async function fetchTrendingPool(): Promise<CoinTickerEntry[]> {
  /* CoinGecko trending */
}
async function fetchOpportunityPool(): Promise<CoinTickerEntry[]> {
  /* CoinGecko markets */
}

export async function getCoinPool(): Promise<CoinPoolPayload> {
  const tickerPayload = await getMarketTickers(); // 现有 CoinGecko + 已有
  const analysisContext = await getMarketAnalysisContext(); // 含 K 线 signals

  const majors: CoinTickerEntry[] = MAJORS_SYMBOLS.map((sym) => ({
    symbol: sym,
    price: tickerPayload.tickers[sym].price,
    change24h: tickerPayload.tickers[sym].change24h,
    category: "majors",
  }));

  let trending: CoinTickerEntry[] = [];
  let opportunity: CoinTickerEntry[] = [];
  try {
    trending = await getCached(TRENDING_CACHE_KEY, TRENDING_TTL_MS, fetchTrendingPool);
  } catch {
    /* graceful */
  }
  try {
    opportunity = await getCached(OPPORTUNITY_CACHE_KEY, OPPORTUNITY_TTL_MS, fetchOpportunityPool);
  } catch {
    /* graceful */
  }

  return {
    ts: Date.now(),
    majors,
    trending,
    opportunity,
    signals: analysisContext.coinw, // ← 关键：把 K 线 signals 一并暴露给 task-09 信号层
    source: tickerPayload.source ?? "coingecko-ticker",
    isStale: tickerPayload.isStale,
    isFallback: tickerPayload.isFallback,
    error: tickerPayload.error,
  };
}
```

### 3.4 Ticker route

`src/app/api/market/ticker/route.ts`：

```ts
import { NextResponse } from "next/server";
import { getCoinPool } from "@/lib/marketDataCache";

export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(await getCoinPool());
}
```

---

## 4. Section A2 — signalBuffer 后端

### 4.1 新建 `src/lib/signalBuffer.ts`

```ts
import type { SignalRecord } from "@/modules/agent-watch/types";

const BUFFER_MAX = 500;
const BUFFER_TTL_MS = 24 * 60 * 60_000; // 24h 滚动

let signalBuffer: SignalRecord[] = [];
const seenIds = new Set<string>();

export function pushSignals(records: SignalRecord[]): SignalRecord[] {
  const accepted: SignalRecord[] = [];
  const now = Date.now();

  // 写入时去重 + 60s 同 symbol+type 折叠
  for (const r of records) {
    if (seenIds.has(r.id)) continue;

    // 60s 内同 symbol+type 已存在 → 升级 severity 而非新增
    const recentDup = signalBuffer.find(
      (s) => s.symbol === r.symbol && s.type === r.type && now - s.ts < 60_000,
    );
    if (recentDup) {
      // severity 升级（info < watch < alert）
      const order = { info: 0, watch: 1, alert: 2 };
      if (order[r.severity] > order[recentDup.severity]) {
        recentDup.severity = r.severity;
        recentDup.payload = { ...recentDup.payload, ...r.payload };
        recentDup.ts = r.ts;
      }
      continue;
    }

    signalBuffer.push(r);
    seenIds.add(r.id);
    accepted.push(r);
  }

  // 24h 滚动清理 + 总量上限
  const cutoff = now - BUFFER_TTL_MS;
  signalBuffer = signalBuffer.filter((s) => s.ts >= cutoff);
  if (signalBuffer.length > BUFFER_MAX) {
    const removed = signalBuffer.slice(0, signalBuffer.length - BUFFER_MAX);
    signalBuffer = signalBuffer.slice(-BUFFER_MAX);
    removed.forEach((r) => seenIds.delete(r.id));
  }

  return accepted;
}

export function getRecentSignals(limit: number = 12): SignalRecord[] {
  return signalBuffer.slice(-Math.min(limit, BUFFER_MAX));
}

export function getSignalsByWindow(windowMs: number): SignalRecord[] {
  const cutoff = Date.now() - windowMs;
  return signalBuffer.filter((s) => s.ts >= cutoff);
}

export function getSignalCount(): number {
  return signalBuffer.length;
}
```

### 4.2 实例隔离风险（已知）

Vercel serverless 多实例时每个实例独立 buffer。v1 acceptable——每个实例累积自己的"市场记忆"，对单用户体验无害。v2 上 Vercel KV 跨实例同步。

### 4.3 Cold start warmup

实例启动 buffer 空时，前 30 秒用户访问 `/agent`：

- ticker / MarketEventFeed 正常工作（无 buffer 依赖）
- LLM 调用延迟到 buffer 至少 5 条信号后再触发（避免 LLM 输出空摘要）
- AgentFocusCard 显示 "Agent 正在累积市场信号..." warmup 文案

---

## 5. Section A3 — 信号生成器（5 类信号）

### 5.1 新建 `src/lib/marketSignals.ts`

```ts
import type { CoinPoolPayload, SignalRecord, CoinTickerEntry } from "@/modules/agent-watch/types";

// 阈值（v1 保守，v2 调）
const THRESHOLDS = {
  VOLUME_SPIKE_RATIO: 1.8,
  NEAR_LEVEL_PCT: 0.015, // 1.5%
  RANGE_CHANGE_PCT: 10,
  RSI_OVERBOUGHT: 75,
  RSI_OVERSOLD: 25,
  DEVIATION_FROM_EMA: 0.05, // 5%
};

export function generateSignals(
  pool: CoinPoolPayload,
  lastPool: CoinPoolPayload | null,
): SignalRecord[] {
  const signals: SignalRecord[] = [];
  const now = Date.now();
  const allCoins = [...pool.majors, ...pool.trending, ...pool.opportunity];

  for (const coin of allCoins) {
    // Type 1: range_change（24h 大涨/大跌）
    if (Math.abs(coin.change24h) >= THRESHOLDS.RANGE_CHANGE_PCT) {
      signals.push({
        id: `${now}-${coin.symbol}-range_change`,
        ts: now,
        symbol: coin.symbol,
        type: "range_change",
        severity: Math.abs(coin.change24h) >= 20 ? "alert" : "watch",
        payload: {
          change24h: coin.change24h,
          description: `${coin.symbol} 24h ${coin.change24h >= 0 ? "+" : ""}${coin.change24h.toFixed(1)}%`,
        },
      });
    }

    // 主流 4 币才有 K 线 signals（来自 CoinW）
    if (!pool.signals || coin.category !== "majors") continue;
    const ctx = pool.signals[coin.symbol as keyof typeof pool.signals];
    if (!ctx) continue;

    // Type 2: volume_spike（5m volumeRatio）
    const m5 = ctx.m5;
    if (m5?.volumeRatio && m5.volumeRatio >= THRESHOLDS.VOLUME_SPIKE_RATIO) {
      signals.push({
        id: `${now}-${coin.symbol}-volume_spike-m5`,
        ts: now,
        symbol: coin.symbol,
        type: "volume_spike",
        severity: m5.volumeRatio >= 3 ? "alert" : "watch",
        payload: {
          volumeRatio: m5.volumeRatio,
          description: `${coin.symbol} 5m 放量 ${m5.volumeRatio.toFixed(1)}x`,
        },
      });
    }

    // Type 3: near_high / near_low（距 5m high/low 1.5% 内）
    if (m5) {
      const distHigh = (m5.high - m5.latestClose) / m5.latestClose;
      const distLow = (m5.latestClose - m5.low) / m5.latestClose;
      if (distHigh >= 0 && distHigh <= THRESHOLDS.NEAR_LEVEL_PCT) {
        signals.push({
          id: `${now}-${coin.symbol}-near_high`,
          ts: now,
          symbol: coin.symbol,
          type: "near_high",
          severity: distHigh <= 0.005 ? "alert" : "watch",
          payload: {
            priceLevel: m5.high,
            distancePct: distHigh * 100,
            description: `${coin.symbol} 接近前高 $${m5.high.toFixed(2)}（距 ${(distHigh * 100).toFixed(2)}%）`,
          },
        });
      }
      if (distLow >= 0 && distLow <= THRESHOLDS.NEAR_LEVEL_PCT) {
        signals.push({
          id: `${now}-${coin.symbol}-near_low`,
          ts: now,
          symbol: coin.symbol,
          type: "near_low",
          severity: distLow <= 0.005 ? "alert" : "watch",
          payload: {
            priceLevel: m5.low,
            distancePct: distLow * 100,
            description: `${coin.symbol} 接近前低 $${m5.low.toFixed(2)}（距 ${(distLow * 100).toFixed(2)}%）`,
          },
        });
      }
    }

    // Type 4: breakout（5m latestClose 突破上一周期 high/low）
    if (m5 && lastPool?.signals?.[coin.symbol as keyof typeof lastPool.signals]?.m5) {
      const lastM5 = lastPool.signals[coin.symbol as keyof typeof lastPool.signals]!.m5!;
      if (m5.latestClose > lastM5.high) {
        signals.push({
          id: `${now}-${coin.symbol}-breakout-up`,
          ts: now,
          symbol: coin.symbol,
          type: "breakout",
          severity: "alert",
          payload: {
            priceLevel: lastM5.high,
            description: `${coin.symbol} 5m 突破前高 $${lastM5.high.toFixed(2)}`,
          },
        });
      } else if (m5.latestClose < lastM5.low) {
        signals.push({
          id: `${now}-${coin.symbol}-breakout-down`,
          ts: now,
          symbol: coin.symbol,
          type: "breakout",
          severity: "alert",
          payload: {
            priceLevel: lastM5.low,
            description: `${coin.symbol} 5m 跌破前低 $${lastM5.low.toFixed(2)}`,
          },
        });
      }
    }

    // Type 5: ema_cross（EMA12/13 金叉死叉，对比上一周期 trend）
    if (m5 && lastPool?.signals?.[coin.symbol as keyof typeof lastPool.signals]?.m5) {
      const lastTrend = lastPool.signals[coin.symbol as keyof typeof lastPool.signals]!.m5!.trend;
      if (lastTrend !== m5.trend) {
        if (m5.trend === "bullish") {
          signals.push({
            id: `${now}-${coin.symbol}-ema_cross-up`,
            ts: now,
            symbol: coin.symbol,
            type: "ema_cross",
            severity: "watch",
            payload: {
              emaState: "golden_cross",
              description: `${coin.symbol} 5m EMA12 重新站上 EMA13`,
            },
          });
        } else if (m5.trend === "bearish") {
          signals.push({
            id: `${now}-${coin.symbol}-ema_cross-down`,
            ts: now,
            symbol: coin.symbol,
            type: "ema_cross",
            severity: "watch",
            payload: {
              emaState: "dead_cross",
              description: `${coin.symbol} 5m EMA12 跌破 EMA13`,
            },
          });
        }
      }
    }
  }

  return signals;
}
```

### 5.2 信号生成调度（v1.1 多入口冗余触发）

**M3 修订**：单一入口（ticker route）触发不可靠——新前端 layout 后 ticker 数据可能从 `latest.pool` 拿（LLM 输出里），不再独立 poll ticker route → buffer 不增长。

**v1.1 方案**：把 `generateSignals + pushSignals` 抽成共享函数 `triggerSignalGeneration()`，**三个 API 入口都调用**：

```ts
// src/lib/marketSignals.ts 加共享 trigger
let lastPoolForSignals: CoinPoolPayload | null = null;

export async function triggerSignalGeneration(): Promise<void> {
  try {
    const pool = await getCoinPool();
    const newSignals = generateSignals(pool, lastPoolForSignals);
    pushSignals(newSignals);
    lastPoolForSignals = pool;
  } catch (error) {
    console.warn("[claw42] signal generation failed", error);
  }
}
```

**入口 1 — `/api/market/ticker` GET**：

```ts
export async function GET() {
  await triggerSignalGeneration(); // ← 推动 buffer
  return NextResponse.json(await getCoinPool());
}
```

**入口 2 — `/api/agents/events` GET**（前端 useMarketEventFeed 必经）：

```ts
export async function GET(request: Request) {
  await triggerSignalGeneration();   // ← 30s polling 持续推动
  const signals = getRecentSignals(limit);
  return NextResponse.json({ servedAt: Date.now(), count: signals.length, signals }, ...);
}
```

**入口 3 — `/api/agents/analysis` 内部 last-mile**：

```ts
// llmFallbackChain.ts buildPrompt 里:
export async function buildPrompt(): Promise<string> {
  await triggerSignalGeneration(); // ← LLM 用 buffer 摘要前 last-mile 触发
  const summary = buildSignalSummary();
  // ...
}
```

**buffer 内部去重保证不重复**：同一 batch 30s 内被 3 个入口各调一次，写入时按 `id` 检查 + 60s 同 symbol+type 折叠，最终 buffer 只长 1 条。

**好处**：任一入口活着 buffer 就动。新前端如果改成只 poll events route，仍能推动 buffer；老前端 poll ticker route 仍能推动 buffer。LLM 调用本身也兜底。

**成本**：本地计算（CoinGecko / CoinW K 线已经在 cache 里），即使三入口频繁触发也不会爆 LLM 成本，buffer 写时去重让冗余触发对 buffer 内容无影响。

---

## 6. Section A4 — buffer 摘要 + LLM prompt 升级

### 6.1 新建 `src/lib/signalSummary.ts`

```ts
import type { SignalRecord } from "@/modules/agent-watch/types";
import { getSignalsByWindow } from "./signalBuffer";

const SUMMARY_WINDOW_MS = 2 * 60 * 60_000; // 过去 2 小时

export interface BufferSummary {
  windowMs: number;
  totalSignals: number;
  bySymbol: Record<
    string,
    {
      count: number;
      latest: number;
      types: SignalRecord["type"][];
      descriptions: string[]; // 最多 5 条最近 signal 的描述
    }
  >;
  topAlerts: SignalRecord[]; // severity=alert 最近 5 条
}

export function buildSignalSummary(): BufferSummary {
  const signals = getSignalsByWindow(SUMMARY_WINDOW_MS);
  const bySymbol: BufferSummary["bySymbol"] = {};

  for (const sig of signals) {
    if (!bySymbol[sig.symbol]) {
      bySymbol[sig.symbol] = { count: 0, latest: 0, types: [], descriptions: [] };
    }
    const entry = bySymbol[sig.symbol];
    entry.count++;
    entry.latest = Math.max(entry.latest, sig.ts);
    if (!entry.types.includes(sig.type)) entry.types.push(sig.type);
    if (entry.descriptions.length < 5 && sig.payload.description) {
      entry.descriptions.push(sig.payload.description);
    }
  }

  const topAlerts = signals
    .filter((s) => s.severity === "alert")
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 5);

  return {
    windowMs: SUMMARY_WINDOW_MS,
    totalSignals: signals.length,
    bySymbol,
    topAlerts,
  };
}

export function formatSummaryForPrompt(summary: BufferSummary): string {
  const lines: string[] = [];
  lines.push(
    `## 过去 ${Math.round(summary.windowMs / 60_000)} 分钟市场信号沉淀（共 ${summary.totalSignals} 条）`,
  );
  lines.push("");

  for (const [symbol, entry] of Object.entries(summary.bySymbol).sort(
    (a, b) => b[1].count - a[1].count,
  )) {
    lines.push(`### ${symbol}（${entry.count} 条信号，类型：${entry.types.join("/")}）`);
    entry.descriptions.forEach((d) => lines.push(`- ${d}`));
    lines.push("");
  }

  if (summary.topAlerts.length > 0) {
    lines.push("## 高优警报");
    summary.topAlerts.forEach((a) =>
      lines.push(`- [${new Date(a.ts).toISOString().slice(11, 16)}] ${a.payload.description}`),
    );
  }

  return lines.join("\n");
}
```

### 6.2 LLM prompt 升级

`src/lib/llmFallbackChain.ts` 重写 `buildPrompt`：

```ts
import { buildSignalSummary, formatSummaryForPrompt } from "./signalSummary";
import { getCoinPool } from "./marketDataCache";

export async function buildPrompt(): Promise<string> {
  const pool = await getCoinPool();
  const summary = buildSignalSummary();
  const summaryText = formatSummaryForPrompt(summary);

  // task-07 Agent 人设保留
  const personas = `
## Agent 人设

### Alpha — ${alphaSkill.tagline}
${alphaSkill.persona}
术语词典：${alphaSkill.terminology.required.join("/")}
禁用：${alphaSkill.style.bannedPhrases.join("/")}

### Beta — ${betaSkill.tagline}
${betaSkill.persona}
术语词典：${betaSkill.terminology.required.join("/")}
禁用：${betaSkill.style.bannedPhrases.join("/")}

### Gamma — ${gammaSkill.tagline}
${gammaSkill.persona}
术语词典：${gammaSkill.terminology.required.join("/")}
禁用：${gammaSkill.style.bannedPhrases.join("/")}
`;

  const tickerLine = `## 当前实时锚点
${pool.majors.map((c) => `${c.symbol} $${c.price} ${c.change24h >= 0 ? "+" : ""}${c.change24h.toFixed(2)}%`).join("  ")}
${pool.trending.length > 0 ? `\n热门：${pool.trending.map((c) => c.symbol).join("/")}` : ""}
${pool.opportunity.length > 0 ? `\n机会：${pool.opportunity.map((c) => c.symbol).join("/")}` : ""}
`;

  return `
你扮演 3 个加密交易 Agent 同时基于**累积市场信号**做判断。每个 Agent 必须：
1. 从过去 2 小时信号沉淀中**选 1 个**最值得关注的币
2. 给出基于多条信号的**论据型判断**（不是看单点价格反应）
3. 给出**可验证的**触发/失效条件
4. 输出风格严格按各派人设和术语

${personas}

${summaryText}

${tickerLine}

## 选币纪律

- Alpha（突破派）优先选有"接近前高/前低 + 放量"特征的币
- Beta（趋势派）优先选有"EMA 排列稳定 + 主流热门"特征的币
- Gamma（回归派）优先选有"24h 极端涨跌 + 接近近期高低"特征的币
- 3 Agent 选币**最好不重复**，但允许同一币不同视角

## v1 数据范围限制（M6 修订，硬性遵守）

当前 buffer 里**只有 6 类信号**：volume_spike / near_high / near_low / breakout / ema_cross / range_change。

**禁止 LLM 输出 buffer 没有数据支撑的指标**：
- ❌ 不要引用 RSI 数值或超买超卖（v1 没 RSI 算法）
- ❌ 不要引用布林带上下轨（v1 没布林带）
- ❌ 不要引用偏离 EMA144 X% 的具体百分比（v1 没算这个偏离）
- ❌ 不要假装看见 KDJ / MACD / 等 buffer 没有的指标

**Gamma（回归派）v1 用本派术语词典里的"极端 / 偏离"概念，但表达层换成 buffer 里有的数据**：
- 用"24h 涨幅 18% 进入极端区"代替"RSI 75 进入超买"
- 用"接近 5m 前高 0.4% 距离已经压回 3 次"代替"偏离 EMA144 5%"
- Gamma 仍然是回归派人格，但 v1 的"极端"基于 24h 涨跌幅 + 接近高低位的统计，不是 RSI/布林带

LLM 必须从 buffer 实际有的字段拿论据。如果当前 buffer 里完全没 Gamma 视角的数据（比如行情平静无极端涨跌），Gamma 输出"市场偏静，等极端位"+ judgement 写"暂不进场"，**不要编造**。

## 输出格式（严格 JSON，不加 markdown）

{
  "focus": [
    {
      "agentId": "alpha",
      "symbol": "<选定币 symbol>",
      "judgment": "<基于信号的当前判断，<= 80 字，必须包含至少 1 个本派术语>",
      "trigger": {
        "type": "<breakout_with_volume|retest_hold|ema_cross|rsi_reversal|range_break|custom>",
        "symbol": "<symbol>",
        "priceLevel": <number 可选>,
        "volumeRatio": <number 可选>,
        "description": "<自然语言版本的触发条件>"
      },
      "fail": {
        "type": "<price_break|volume_dry|ema_break|custom>",
        "symbol": "<symbol>",
        "priceLevel": <number 可选>,
        "description": "<自然语言版本的失效条件>"
      },
      "evidenceCount": <引用了 buffer 里多少条 signal，1-10>
    },
    { "agentId": "beta", ... },
    { "agentId": "gamma", ... }
  ],
  "stream": [
    { "agentId": "alpha", "content": "<详细推理 ≤50 字，引用具体信号>" },
    { "agentId": "beta",  "content": "..." },
    { "agentId": "gamma", "content": "..." }
  ],
  "heroBubbles": [
    "<行情相关短句 ≤40 字>", "<>", "<>"
  ],
  "coinComments": {
    "BTC":  { "alpha": "<>", "beta": "<>", "gamma": "<>" },
    "ETH":  { "alpha": "<>", "beta": "<>", "gamma": "<>" },
    "SOL":  { "alpha": "<>", "beta": "<>", "gamma": "<>" },
    "USDT": { "alpha": "<>", "beta": "<>", "gamma": "<>" }
  }
}

硬性规则：
- 全部中文输出
- 直接 JSON，不加 markdown 代码块
- focus 必须基于 signal 沉淀做判断，不能编造
- 触发/失效条件必须包含具体价格 / volume / 时间锚点
- 严格遵守各派术语和禁用词
`;
}
```

### 6.3 Cache TTL 升级

`src/lib/llmFallbackChain.ts`：

```ts
// before (task-05):
const FRESH_TTL_MS = 5 * 60_000;
const STALE_TTL_MS = 30 * 60_000;

// after (task-09):
const FRESH_TTL_MS = 10 * 60_000; // 10 分钟内 cache hit
const STALE_TTL_MS = 30 * 60_000; // 10-30 分钟 stale + bg refresh
```

注：保留 task-05 的 stale-while-revalidate 主结构 + provider chain（DeepSeek primary）+ idle detection。仅 TTL 调整。

---

## 7. Section A5 — AgentFocusCard 组件

### 7.1 新建 `src/modules/agent-watch/components/AgentFocusCard.tsx`

```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { AGENT_META, AGENT_COLOR_TOKEN } from "../agents";
import type { AgentFocus, AgentId } from "../types";

interface AgentFocusCardProps {
  focus: AgentFocus | null;
  isStale: boolean; // LLM 失败 / 数据过老
  generatedAt?: number;
}

export function AgentFocusCard({ focus, isStale, generatedAt }: AgentFocusCardProps) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  if (!focus) {
    return (
      <div className="card-glow rounded-2xl border border-white/10 bg-[#111] p-5">
        <p className="text-sm text-white/40">{t.agentWatch.focusCard.warmup}</p>
      </div>
    );
  }

  const meta = AGENT_META[focus.agentId];
  const token = AGENT_COLOR_TOKEN[focus.agentId];
  const minutesAgo = generatedAt ? Math.round((Date.now() - generatedAt) / 60_000) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.3 }}
      className={`card-glow flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#111] p-5 ${isStale ? "opacity-60" : ""}`}
    >
      {/* Header: agent + symbol */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-white"
            style={{
              background: `linear-gradient(135deg, ${token.primary}, ${token.soft})`,
              boxShadow: `0 0 12px ${token.glow}`,
            }}
          >
            {meta.avatar}
          </span>
          <div>
            <div className="text-sm font-bold text-white">{meta.name}</div>
            <div className="text-xs text-white/40">{meta.tagline}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
          <span className="text-xs font-bold text-white/70">{t.agentWatch.focusCard.watching}</span>
          <span className="text-sm font-bold text-white">{focus.symbol}</span>
        </div>
      </div>

      {/* Judgment */}
      <p className="text-sm leading-relaxed text-white/85">{focus.judgment}</p>

      {/* Trigger / Fail */}
      <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-2">
        <div className="flex items-start gap-2 text-xs">
          <span className="shrink-0 rounded bg-[#7c5cff]/15 px-1.5 py-0.5 font-semibold text-[#b49cff]">
            {t.agentWatch.focusCard.trigger}
          </span>
          <span className="text-white/70">{focus.trigger.description}</span>
        </div>
        <div className="flex items-start gap-2 text-xs">
          <span className="shrink-0 rounded bg-[#ff5f5f]/15 px-1.5 py-0.5 font-semibold text-[#ff8a8a]">
            {t.agentWatch.focusCard.fail}
          </span>
          <span className="text-white/70">{focus.fail.description}</span>
        </div>
      </div>

      {/* Footer: evidence + time */}
      <div className="flex items-center justify-between pt-2 text-xs text-white/35">
        <span>
          {t.agentWatch.focusCard.evidenceCount.replace("{count}", String(focus.evidenceCount))}
        </span>
        {minutesAgo > 0 && (
          <span>{t.agentWatch.focusCard.minutesAgo.replace("{minutes}", String(minutesAgo))}</span>
        )}
      </div>
    </motion.div>
  );
}
```

### 7.2 i18n 字段（zh_CN 主，其他 9 语 占位英文）

```json
"focusCard": {
  "warmup": "Agent 正在累积市场信号...",
  "watching": "关注",
  "trigger": "触发",
  "fail": "失效",
  "evidenceCount": "{count} 条信号支撑",
  "minutesAgo": "{minutes} 分钟前"
}
```

---

## 8. Section A6 — MarketEventFeed 组件

### 8.1 新建 `src/modules/agent-watch/hooks/useMarketEventFeed.ts`

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SignalRecord } from "../types";

const POLL_INTERVAL_MS = 30_000;
const MAX_FEED_ITEMS = 12;

export function useMarketEventFeed(opts: { enabled: boolean }) {
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<number | null>(null);
  const isVisibleRef = useRef(typeof document !== "undefined" ? !document.hidden : true);

  const fetchSignals = useCallback(async () => {
    if (!opts.enabled || !isVisibleRef.current) return;
    try {
      const res = await fetch(`/api/agents/events?limit=${MAX_FEED_ITEMS}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`events ${res.status}`);
      const data = (await res.json()) as { signals: SignalRecord[] };
      setSignals(data.signals);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [opts.enabled]);

  useEffect(() => {
    if (!opts.enabled) return;

    function start() {
      if (intervalRef.current !== null) return;
      void fetchSignals();
      intervalRef.current = window.setInterval(fetchSignals, POLL_INTERVAL_MS);
    }
    function stop() {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    function onVisibility() {
      isVisibleRef.current = !document.hidden;
      if (!document.hidden) start();
      else stop();
    }

    document.addEventListener("visibilitychange", onVisibility);
    if (isVisibleRef.current) start();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [opts.enabled, fetchSignals]);

  return { signals, error };
}
```

### 8.2 events API route

`src/app/api/agents/events/route.ts`：

```ts
import { NextResponse } from "next/server";
import { getRecentSignals } from "@/lib/signalBuffer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 12;
  if (Number.isNaN(limit) || limit <= 0)
    return NextResponse.json({ error: "invalid limit" }, { status: 400 });

  const signals = getRecentSignals(limit);

  return NextResponse.json(
    {
      servedAt: Date.now(),
      count: signals.length,
      signals,
    },
    {
      headers: { "Cache-Control": signals.length === 0 ? "no-store" : "public, s-maxage=10" },
    },
  );
}
```

### 8.3 MarketEventFeed 组件

`src/modules/agent-watch/components/MarketEventFeed.tsx`：

```tsx
"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import type { SignalRecord, SignalSeverity } from "../types";

const SEVERITY_STYLES: Record<SignalSeverity, { dot: string; bg: string }> = {
  info: { dot: "bg-white/30", bg: "border-white/10" },
  watch: { dot: "bg-[#b49cff]", bg: "border-[#7c5cff]/20" },
  alert: { dot: "bg-[#ff5f5f] animate-pulse", bg: "border-[#ff5f5f]/30" },
};

interface MarketEventFeedProps {
  signals: SignalRecord[];
}

export function MarketEventFeed({ signals }: MarketEventFeedProps) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b49cff] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7c5cff]" />
        </span>
        {t.agentWatch.marketEvent.title}
      </div>

      <AnimatePresence>
        {signals.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-3 py-2 text-xs text-white/30"
          >
            {t.agentWatch.marketEvent.empty}
          </motion.div>
        )}

        {signals
          .slice()
          .reverse()
          .map((sig) => {
            const style = SEVERITY_STYLES[sig.severity];
            return (
              <motion.div
                key={sig.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
                className={`flex items-center gap-2 rounded-lg border ${style.bg} bg-black/40 px-3 py-2 text-xs`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                <span className="shrink-0 font-mono text-white/40">
                  {new Date(sig.ts).toISOString().slice(11, 16)}
                </span>
                <span className="truncate text-white/80">
                  {sig.payload.description ?? `${sig.symbol} ${sig.type}`}
                </span>
              </motion.div>
            );
          })}
      </AnimatePresence>
    </div>
  );
}
```

---

## 9. Section A7 — AgentWatchBoard 新 layout

```
┌──────────────────────────────────────────────────────────────┐
│ <CoinTickerStrip pool={pool} />  ← 顶部三组 ticker             │
├──────────────────────────────────────────────────────────────┤
│ <TopicHeader />                                               │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────┐  <MarketEventFeed signals=... />                 │
│ │ Sidebar  │  ← 左 sidebar 3 Agent + 状态                    │
│ │  Alpha   │  <AgentFocusCard focus={alpha} />               │
│ │  Beta    │  <AgentFocusCard focus={beta} />                │
│ │  Gamma   │  <AgentFocusCard focus={gamma} />               │
│ │          │  <MessageStream messages=... />                  │
│ └──────────┘                                                  │
└──────────────────────────────────────────────────────────────┘
```

`AgentWatchBoard.tsx` 整合：

```tsx
function AgentWatchBoard() {
  const { t, locale } = useI18n();
  const isZh = locale === "zh_CN";

  const { entries: historyMessages, refreshHistory } = useAgentHistory({ enabled: isZh, initialLimit: 60 });
  const { data: latest, hasNewContent, dismissNewContent } = useAgentAnalysis({ enabled: isZh });
  const { signals: marketSignals } = useMarketEventFeed({ enabled: isZh });

  // 取 pool.majors 转 TickerMap 喂 CoinModal
  const majorsTicker = latest?.pool ? toTickerMap(latest.pool.majors) : undefined;

  // 提取 3 Agent focus
  const focusByAgent: Record<AgentId, AgentFocus | null> = {
    alpha: latest?.focus.find(f => f.agentId === "alpha") ?? null,
    beta:  latest?.focus.find(f => f.agentId === "beta")  ?? null,
    gamma: latest?.focus.find(f => f.agentId === "gamma") ?? null,
  };
  const focusStale = !latest || (latest.source === "cache" && Date.now() - latest.generatedAt > 15 * 60_000);

  return (
    <main className="...">
      <CoinTickerStrip pool={latest?.pool} />
      <TopicHeader />
      <NewContentBanner ... />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <AgentSidebar />
        <div className="flex flex-col gap-4">
          <MarketEventFeed signals={marketSignals} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <AgentFocusCard focus={focusByAgent.alpha} isStale={focusStale} generatedAt={latest?.generatedAt} />
            <AgentFocusCard focus={focusByAgent.beta}  isStale={focusStale} generatedAt={latest?.generatedAt} />
            <AgentFocusCard focus={focusByAgent.gamma} isStale={focusStale} generatedAt={latest?.generatedAt} />
          </div>
          <MessageStream messages={...} emptyLabel={t.agentWatch.emptyHistory} />
        </div>
      </div>
    </main>
  );
}
```

Mobile 适配：lg 以下单列堆叠，3 个 focus card 改横向滑动。

---

## 10. Section A8 — 降级保底 + i18n

### 10.1 降级路径

| 失败场景                            | UX 表现                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| CoinGecko trending 失败             | 隐藏热门组 ticker，主流不动                                                                    |
| CoinGecko opportunity 失败          | 隐藏机会组 ticker，主流不动                                                                    |
| CoinW K 线失败                      | majors signals 空，前端只能产生 range_change 信号（基于 24h 涨跌）                             |
| signalBuffer 空（cold start < 30s） | AgentFocusCard 显示 warmup 文案 + MarketEventFeed 显示 empty 文案                              |
| LLM 全部 provider 失败 + cache 过期 | AgentFocusCard 显示上次 focus + 灰化 + "X 分钟前" 时间标 + warmup 提示，MarketEventFeed 仍工作 |
| 全失败（网络断 / 后端挂）           | 主页面降级到 static fallback，显示"Agent 正在等待新信号确认"                                   |

### 10.2 i18n 完整字段（zh_CN）

```json
"agentWatch": {
  // ... 现有字段
  "focusCard": {
    "warmup": "Agent 正在累积市场信号...",
    "watching": "关注",
    "trigger": "触发",
    "fail": "失效",
    "evidenceCount": "{count} 条信号支撑",
    "minutesAgo": "{minutes} 分钟前"
  },
  "marketEvent": {
    "title": "实时市场信号",
    "empty": "等待第一波信号..."
  },
  "statusLabel": {
    "warmingUp": "Agent 正在观察市场",
    "stale": "上次更新 {minutes} 分钟前"
  }
}
```

其他 9 语：占位英文（v1 仅 zh_CN 可访问 `/agent`，其他 locale middleware redirect）。

---

## 11. 验收

### Grep 验证（v1.1）

- [ ] `src/lib/signalBuffer.ts` 存在
- [ ] `src/lib/marketSignals.ts` 存在
- [ ] `src/lib/signalSummary.ts` 存在
- [ ] `src/app/api/agents/events/route.ts` 存在
- [ ] `src/modules/agent-watch/components/MarketEventFeed.tsx` 存在
- [ ] `src/modules/agent-watch/components/AgentFocusCard.tsx` 存在
- [ ] `grep "triggerSignalGeneration" src/app/api/market/ticker/route.ts` 存在（入口 1）
- [ ] `grep "triggerSignalGeneration" src/app/api/agents/events/route.ts` 存在（入口 2）
- [ ] `grep "triggerSignalGeneration" src/lib/llmFallbackChain.ts` 存在（入口 3 last-mile）
- [ ] `grep "buildSignalSummary\|formatSummaryForPrompt" src/lib/llmFallbackChain.ts` 存在（buildPrompt 消费摘要）
- [ ] `grep "FRESH_TTL_MS = 10" src/lib/llmFallbackChain.ts` 存在（cache TTL 10min）
- [ ] `grep "focus" src/modules/agent-watch/types.ts | grep -i "agentanalysispayload"` AgentAnalysisPayload 含 focus 字段
- [ ] `grep "trending\|opportunity" src/modules/agent-watch/types.ts` 三组类型存在
- [ ] `grep "rsi_extreme\|deviation" src/modules/agent-watch/types.ts` **无输出**（v1 删除两类）
- [ ] `grep "tickers" src/modules/agent-watch/types.ts` 仍存在（commit 1-3 兼容期保留，commit 4 后保留作向下兼容）
- [ ] static fallback 输出含 focus[]：`grep "focus" src/lib/llmFallbackChain.ts | grep -i "fallback"` 存在

### 类型 / 构建

- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 成功
- [ ] `npm run lint` 无新增错误

### 行为（preview 上跑）

**场景 1 — 首次访问密度**：

1. 部署后访问 `/zh_CN/agent`
2. 30 秒内看到 ticker 三组（10 币）
3. 60 秒内 MarketEventFeed 出现至少 2-3 条信号（基于 24h 涨跌幅 + volume）
4. 5-10 分钟首次 LLM 调用完成 → 3 个 AgentFocusCard 填充
5. AgentFocusCard 含 symbol / judgment / trigger / fail，文案有论据感

**场景 2 — 持续停留**：

1. 在页面停留 15 分钟
2. ticker 持续静默更新（数字渐变）
3. MarketEventFeed 累积 10+ 条信号（fade-in）
4. focus card 在 10-15min 时刷新一次（基于新一轮 LLM）
5. focus card 内容前后两次有变化（不同 symbol 或 judgment）

**场景 3 — 切走 tab 回来**：

1. 切走 6 分钟
2. 切回看到 banner（task-06 现有逻辑）
3. focus card 显示新 LLM 输出
4. MarketEventFeed 显示这 6 分钟累积的新事件

**场景 4 — LLM 全挂降级**：

1. 临时删除所有 LLM env
2. focus card 灰化显示上次 focus + 时间标
3. MarketEventFeed 仍正常工作（信号生成不依赖 LLM）
4. ticker 仍正常工作

**场景 5 — 阈值校准**：

1. 持续观察 30 分钟，统计信号产生频率
2. 平均 12 分钟最多 12 条信号（避免刷屏）
3. 没有同 symbol+type 60s 内重复信号

### 不退化

- [ ] task-05 stale-while-revalidate 主结构仍工作（仅 TTL 调到 10min）
- [ ] task-06 history buffer + banner 仍工作
- [ ] task-07 Agent 人设术语 + 禁用词在新 prompt 下仍生效
- [ ] Hero 中文 dynamic pool 注入仍工作（消费 latest.heroBubbles）
- [ ] CoinModal 4 主流币点击仍工作（消费 pool.majors）
- [ ] middleware 非中文 redirect 仍工作

---

## 12. 约束

- **不引新依赖**——所有信号算法用现成的 EMA/volume_ratio/range（marketDataCache.ts 已计算）
- **不上 Vercel KV**——v1 in-memory buffer，跨实例不一致 acceptable
- **不做 pattern match**（"上次类似情况"）——v2 才做
- **不做触发条件反向验证**——LLM 输出结构化字段但前端只展示，不验证。v2 才做事件触发 LLM
- **buffer 不持久化进 task-06 history**——signalBuffer 和 historyBuffer 是两层独立模块
- **MarketEventFeed 上限 12 条 / 60s**——避免刷屏
- **LLM frequency 10min fresh / 30min stale**——成本控制 + 体验密度由 buffer 摘要承接
- **focus card v1 只读**——不可点击不可展开（v2 才加触发条件可视化）

## 13. 提交与 PR（v1.1 修订：可编译渐进 4 段）

### M2 commit 边界纪律

**每段必须独立 `npx tsc --noEmit` + `npm run build` 通过**，不能依赖后段才能编译。

关键策略：**前置兼容性**——commit 1 引入新数据结构时**保留旧字段**，前端可继续读旧结构；commit 3 LLM 输出加 `focus[]` 是 optional 字段，前端不读也能跑；commit 4 才真正切到新字段消费。

### 分支策略（M1 修订）

```sh
git fetch origin
git checkout feature/act1-5-watch-page-01
git pull origin feature/act1-5-watch-page-01
git checkout -b feature/act1-5-watch-sedimentation-01    # 子分支
# 实施 4 段
git push origin feature/act1-5-watch-sedimentation-01
# 开 PR 目标 feature/act1-5-watch-page-01（不直接 target main）
# Act 1.5 整体 stack 上预发，预发评审通过后再统一进 main
```

### Commit 1：兼容型数据模型 + Coin Pool 增量（A1）

**目标**：types 加新结构 + ticker route 增量返回 pool，**保留旧 tickers 字段**，前端 UI 不动也能编译过。

```ts
// types.ts 修订要点
export interface AgentAnalysisPayload {
  generatedAt: number;
  servedAt: number;
  ttl: number;
  source: ...;

  tickers: TickerMap;            // ← 保留（旧前端继续读）
  pool?: CoinPoolPayload;        // ← 新增 optional

  stream: StreamMessage[];
  heroBubbles: string[];
  coinComments: Record<MajorCoinSymbol, Record<AgentId, string>>;
  // focus[] 在 commit 3 加，本 commit 不加
}
```

```ts
// /api/market/ticker route 此时不动信号触发
// 仅扩展返回字段
export async function GET() {
  const pool = await getCoinPool(); // 新函数
  return NextResponse.json(pool); // 直接返回新结构（向下兼容：CoinTickerStrip 仍可从 pool.majors 抽 TickerMap）
}
```

```ts
// CoinTickerStrip 兼容适配（防止编译挂）
// 接收 pool 时拿 pool.majors，不接收时回退 tickers——v1.1 commit 1 阶段保留 tickers prop
export function CoinTickerStrip({
  pool,
  tickers,
}: {
  pool?: CoinPoolPayload;
  tickers?: TickerMap;
}) {
  const majors =
    pool?.majors ??
    Object.entries(tickers ?? {}).map(([sym, t]) => ({
      symbol: sym,
      ...t,
      category: "majors" as const,
    }));
  // 渲染 4 主流币，commit 4 加上 trending/opportunity
}
```

```sh
git add src/modules/agent-watch/types.ts \
        src/lib/marketDataCache.ts \
        src/app/api/market/ticker/route.ts \
        src/modules/agent-watch/components/CoinTickerStrip.tsx
git commit -m "feat(market): coin pool with majors/trending/opportunity (backward compat)

- New types: CoinTickerEntry / CoinPoolPayload / SignalRecord / AgentFocus / WatchFeedItem
- New: getCoinPool() returning majors+trending+opportunity+signals
- /api/market/ticker now returns CoinPoolPayload (TickerMap derivable from pool.majors)
- AgentAnalysisPayload.tickers retained, .pool added optional (no consumer breaks)
- CoinTickerStrip accepts both pool and tickers props (compat shim)"
# 验证：npx tsc --noEmit 过；preview 上 ticker 仍正常显示
```

### Commit 2：signalBuffer + 信号生成 + Events API（A2 + A3）

**目标**：buffer 模块完整 + generateSignals 5 类 + events API + **三入口冗余触发**。

新增：

- `src/lib/signalBuffer.ts`
- `src/lib/marketSignals.ts`（含 `triggerSignalGeneration()`）
- `src/lib/signalSummary.ts`
- `src/app/api/agents/events/route.ts`

修改：

- `src/app/api/market/ticker/route.ts` 加 `await triggerSignalGeneration()`
- `src/app/api/agents/events/route.ts` 加 `await triggerSignalGeneration()`

不动：LLM route（commit 3 才动），前端（commit 4 才动）

```sh
git add src/lib/signalBuffer.ts \
        src/lib/marketSignals.ts \
        src/lib/signalSummary.ts \
        src/app/api/agents/events/route.ts \
        src/app/api/market/ticker/route.ts
git commit -m "feat(signal): in-memory buffer + 5-type signal generator + events API + multi-entry trigger

- signalBuffer.ts: 500-cap ring buffer with 60s same-symbol/type fold + dedup
- marketSignals.ts: 5 types (range_change/volume_spike/near_high/near_low/breakout/ema_cross)
- signalSummary.ts: build BufferSummary for LLM prompt consumption
- /api/agents/events GET: returns recent N signals + triggers generation
- /api/market/ticker GET: also triggers generation (multi-entry redundancy)
- Buffer write-time dedup ensures multi-entry triggers don't duplicate"
# 验证：npx tsc --noEmit 过；preview 上 /api/agents/events 调通；持续访问后 buffer 累积
```

### Commit 3：LLM focus 输出（向下兼容）+ static fallback 同步（A4）

**目标**：buildPrompt 消费 buffer 摘要 + payload 加 `focus[]`（optional），static fallback 也输出 focus，cache hit 也带 focus。前端不读 focus 也能跑。

```ts
// types.ts 修订
export interface AgentAnalysisPayload {
  // ... 现有字段
  focus?: AgentFocus[]; // ← 新增 optional，commit 3 加
}
```

```ts
// llmFallbackChain.ts buildPrompt 重写消费 buffer
// LLM 输出 JSON 必须含 focus[]
// static fallback 也输出 hardcoded focus（每 Agent 用 fallbacks.coinComments[BTC] 当兜底 focus）
// cache hit 时 focus 跟随 payload 一起返回（不重算）
```

```sh
git add src/lib/llmFallbackChain.ts \
        src/modules/agent-watch/types.ts \
        src/lib/marketSignals.ts   # 加 triggerSignalGeneration 的 last-mile 调用入口
git commit -m "feat(llm): consume buffer summary + structured focus output + cache TTL 10min

- buildPrompt now reads buildSignalSummary() instead of raw tickers
- AgentAnalysisPayload.focus[] added (optional, doesn't break existing UI)
- LLM prompt enforces v1 data range (no RSI/Bollinger/EMA-deviation references)
- static-fallback path now produces focus[] from skill fallbacks (no LLM-dependent path leaves UI empty)
- cache hit retains focus from last successful generation
- FRESH_TTL_MS 5min → 10min (buffer summary density compensates lower frequency)
- /api/agents/analysis last-mile triggers signal generation (third entry point)"
# 验证：npx tsc --noEmit 过；preview LLM 输出含 focus[] 字段；前端继续读 stream/heroBubbles 无破坏
```

### Commit 4：UI 升级 + i18n + AgentWatchBoard 新 layout（A5 + A6 + A7 + A8）

**目标**：前端切换到消费 `pool` + `focus`，移除 commit 1 引入的 tickers backward-compat shim。

新增：

- `src/modules/agent-watch/components/MarketEventFeed.tsx`
- `src/modules/agent-watch/components/AgentFocusCard.tsx`
- `src/modules/agent-watch/hooks/useMarketEventFeed.ts`

修改：

- `src/modules/agent-watch/AgentWatchBoard.tsx` 新 layout
- `src/modules/agent-watch/components/CoinTickerStrip.tsx` 删除 commit 1 backward-compat shim，纯消费 pool
- `src/i18n/types.ts` + 10 dict 全部加新字段

```sh
git add src/modules/agent-watch/components/MarketEventFeed.tsx \
        src/modules/agent-watch/components/AgentFocusCard.tsx \
        src/modules/agent-watch/hooks/useMarketEventFeed.ts \
        src/modules/agent-watch/AgentWatchBoard.tsx \
        src/modules/agent-watch/components/CoinTickerStrip.tsx \
        src/i18n/types.ts src/i18n/dicts/*.json
git commit -m "feat(ui): MarketEventFeed + 3x AgentFocusCard + tri-group ticker + i18n

- AgentWatchBoard: new layout with sidebar + feed + focus cards + stream
- MarketEventFeed: 30s polling /api/agents/events, max 12 items, fade-in animation
- AgentFocusCard: 3 cards displaying symbol/judgment/trigger/fail/evidenceCount
- CoinTickerStrip: drop tickers backward-compat shim, consume pool only
- i18n: agentWatch.focusCard.* + agentWatch.marketEvent.* + agentWatch.statusLabel.*
- zh_CN full text + 9 other locales placeholder English (only zh_CN can access /agent per middleware)"
# 验证：npx tsc --noEmit + npm run build 全过；preview 上完整体验跑通
```

### PR 描述

PR 目标 `feature/act1-5-watch-page-01`，描述里标注：

- v1.1 应用了 Dan 审核 6 条 blocker
- 4 段每段独立可编译（M2）
- 三入口冗余触发（M3）
- preview demo memory 限制（M4）
- v1 信号 6 类，v2 补 RSI/布林带（M5/M6）

PR 描述提醒：preview 至少观察 15 分钟（一个 LLM 周期）确认 focus card 内容质量。

### PR 描述提醒

- Vercel env 已有的 `MINIMAX_API_KEY` / `DEEPSEEK_API_KEY` 仍生效
- 可选 `COINGECKO_API_KEY` 提升 trending/opportunity 限频
- preview 上**至少观察 15 分钟**（一个完整 LLM 周期）确认 focus card 内容质量

---

## 14. 风险记录（v1.1 修订）

| #   | 风险                                             | 严重   | 缓解                                                                                                                                                   |
| --- | ------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Buffer 实例化（Vercel serverless）**           | **P1** | M4 修订：明确产品定位为"preview demo memory"，文案不承诺 24h；多实例并发 / 冷启动 / 部署重置导致 buffer 重置 = preview MVP 已知限制；v2 Vercel KV 升级 |
| 2   | 信号阈值不准（噪音 / 漏报）                      | P1     | preview 调阈值，单 symbol+type 60s 折叠；上限 12 条/feed 防刷屏                                                                                        |
| 3   | LLM 输出 focus/trigger/fail JSON 解析失败        | P1     | parseAnalysisJson 已 try/catch，失败切下一 provider；static fallback 也输出 focus（M2 修订）                                                           |
| 4   | Cold start buffer 空 → LLM 输出空摘要            | P2     | warmup 文案 + LLM 等 buffer ≥3 条信号再触发（首次访问可能等 30-60s）                                                                                   |
| 5   | focus card 和 message stream 视觉重复            | P2     | focus = 持续判断（slow update），stream = 详细推理（fast update）；CSS 上 focus 卡片简洁、stream 详细                                                  |
| 6   | Mobile 屏占满                                    | P2     | lg 断点单列堆叠 + focus 横向滑动                                                                                                                       |
| 7   | **数据源信号不全（无 RSI / 布林带 / EMA 偏离）** | **P1** | M5/M6 修订：v1 删 rsi_extreme / deviation 类型；LLM prompt 限制 v1 数据范围；Gamma 用 24h 极端 + 接近近期高低代替；v2 补算法后激活完整术语             |
| 8   | **多入口触发数据竞争**（M3 引入）                | P2     | buffer 写时按 id 去重 + 60s 同 symbol+type 折叠；triggerSignalGeneration 内部 try/catch 不阻塞调用方                                                   |
| 9   | **commit 1-3 期间前端读旧 tickers**（M2 兼容期） | P2     | tickers 字段保留至 commit 4 才删；CoinTickerStrip backward-compat shim 在 commit 1 引入 commit 4 移除                                                  |

---

## 15. 副审

不强制副审。本 spec 已经过：

- 一轮"方案碰撞"（task-09 草案 → F Part A-F 反馈 → Dan 数据沉淀方向 → F 深挖）
- 任意可争议点 Dan 已拍板（频率 / 范围 / 没有最小版本）

Codex 实施时**自检**（PR 描述里 4 段 commit + 验收 checkbox 自填）。F 收到 PR 做 final review。

如果实施时发现 spec 真错（编译失败 / 行为冲突），停手 → 告诉 Dan → F 修订 spec → 不要自己猜。

---

## 16. v2 路线图（不在本 spec 范围）

- 触发/失效条件反向验证 → 信号触发 LLM 提前调用
- Pattern match（"上次类似情况" 引用 buffer 历史）
- buffer 持久化（Vercel KV）
- Agent 头像（task-09 spec 不含，复用 task-07 占位字母 A/B/G）
- 移动端 focus card 折叠抽屉
- MarketEvent 多语言（v1 只 zh_CN）

---

_维护者: F_
_创建: 2026-04-28_
_v1.1 修订: 2026-04-28（基于 Dan 审核 6 条 blocker）_
_执行者: Codex_
_基于: 方案碰撞讨论（Dan 数据沉淀方向）+ Dan v1 审核反馈_
_吸收: 原 task-08（多币种池）合入本 spec_
_分支基底: feature/act1-5-watch-page-01（PR #11，未合 main）_
_PR 目标: feature/act1-5-watch-page-01（不直接 target main，Act 1.5 整体走预发评审）_
