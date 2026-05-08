# Task 08 — 币种池扩展（固定 4 + 热门 3 + 机会 3）

> **⚠️ 状态：已合并入 task-09（2026-04-28）**
>
> Dan 决策"按 session 时间不按人时间 + 没有最小版本"后，task-08 单独落地的意义消失（输出是 task-09 的输入）。
>
> **以 `task-09-data-sedimentation-and-llm-insight.md` 为准**。task-09 §3 "Section A1 多币种池" 完整吸收了本 task-08 的所有设计（majors/trending/opportunity 三组 + getCoinPool API + CoinTickerStrip 三组渲染 + LLM 选币），并新增了 signals 暴露字段供 task-09 信号层消费。
>
> 本文件保留作历史参考，**不要执行**。
>
> ---

> **目标**：把当前只有 BTC/ETH/SOL/USDT 4 个固定币的 ticker 扩展为三组结构——主流（固定）+ 热门（动态轮换）+ 机会（涨跌幅极值）。LLM 输出时 3 Agent 选自己关注的币评论，不再都说 BTC。
>
> **执行者**：Codex
>
> **基于**：task-07 完成后的 main（Agent 人设已重设）。task-07 是前置依赖
>
> **分支**：`feature/coin-pool-expansion-01`，PR 目标 main

---

## 1. 背景

当前 `/api/market/ticker` 只返回 4 个固定币（BTC/ETH/SOL/USDT），CoinTickerStrip 渲染这 4 个，LLM batch prompt 也只有 4 个币的行情。

问题：

- 信息密度低，旁观秀页面看起来"信息少"
- 每轮 batch 3 Agent 只能在 4 币范围发挥，导致都说 BTC（最大波动）
- 错过了"今天 SOL 暴涨 12%" 这种 hot opportunity 信号

Dan 决策（已拍板）：

- **Q1 = 否**：热门/机会**不进 modal**，只 ticker 显示（控成本）
- **Q2 = 3**：每组 3 个币（4 + 3 + 3 = 10 ticker）
- **Q3 = 是**：每个 Agent 在 batch 输出时**选自己关注的币**评论，不强求都说同一个币

## 2. 修改清单

| 文件                                                     | 改动                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| `src/modules/agent-watch/types.ts`                       | 加 `CoinPoolPayload` / `CoinCategory` 类型                  |
| `src/lib/marketDataCache.ts`                             | 加 trending / opportunity 数据获取                          |
| `src/app/api/market/ticker/route.ts`                     | 返回结构扩展为三组                                          |
| `src/lib/llmFallbackChain.ts`                            | `buildPrompt` 调整：行情数据按三组列出，让 Agent 选币       |
| `src/modules/agent-watch/components/CoinTickerStrip.tsx` | 三组 chip 横向显示                                          |
| `src/modules/agent-watch/AgentWatchBoard.tsx`            | 传入扩展 ticker 数据                                        |
| `src/i18n/types.ts` + `src/i18n/dicts/zh_CN.json`        | 加 `agentWatch.coinPool.{majors,trending,opportunity}` 标签 |

不动：CoinModal（仅主流 4 币能弹）、history buffer、cache 策略、Agent 人设。

---

## 3. 数据模型

### 3.1 types.ts 新增

```ts
export type CoinCategory = "majors" | "trending" | "opportunity";

export interface CoinTickerEntry {
  symbol: string; // 如 "DOGE", "PEPE"
  name?: string; // 显示名（CoinGecko 返回）
  price: number;
  change24h: number;
  category: CoinCategory;
}

export interface CoinPoolPayload {
  ts: number;
  majors: CoinTickerEntry[]; // 固定 4 个：BTC/ETH/SOL/USDT
  trending: CoinTickerEntry[]; // 动态 3 个：CoinGecko trending
  opportunity: CoinTickerEntry[]; // 动态 3 个：24h 涨跌幅极值
  source: MarketDataSource;
  isStale?: boolean;
  isFallback?: boolean;
  error?: string;
}

// 现有 TickerMap 保留（CoinModal / Hero 4 币 modal 仍只用主流）
// CoinPoolPayload 是 ticker bar 用的扩展类型
```

### 3.2 旧 `TickerMap` 兼容

`TickerMap` 仍保留——CoinModal / Hero 4 币逻辑不动，仍取 majors 部分作为 TickerMap。

---

## 4. 任务 A — 后端 ticker 数据扩展

### 4.1 trending 数据源

CoinGecko `/search/trending`（free tier 可用）：

```
https://api.coingecko.com/api/v3/search/trending
```

返回 7 个 trending coin。取前 3 个，再调 `/simple/price` 拉这 3 个币的当前价 + 24h 涨跌。

### 4.2 opportunity 数据源

CoinGecko `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100`，从前 100 大币中筛选：

- 涨幅 top 2（按 `price_change_percentage_24h` 降序前 2）
- 跌幅 top 1（按 `price_change_percentage_24h` 升序前 1）
- 排除 majors（避免和固定 4 重复）

### 4.3 实现

`src/lib/marketDataCache.ts` 加：

```ts
const TRENDING_CACHE_KEY = "coingecko:trending:v1";
const OPPORTUNITY_CACHE_KEY = "coingecko:opportunity:v1";
const TRENDING_TTL_MS = 5 * 60_000; // trending 5 分钟刷新
const OPPORTUNITY_TTL_MS = 5 * 60_000; // opportunity 5 分钟刷新

const MAJORS_SYMBOLS = ["BTC", "ETH", "SOL", "USDT"] as const;

async function fetchTrendingPool(): Promise<CoinTickerEntry[]> {
  const trendingRes = await fetch("https://api.coingecko.com/api/v3/search/trending", {
    cache: "no-store",
  });
  if (!trendingRes.ok) throw new Error(`coingecko trending ${trendingRes.status}`);
  const trendingData = await trendingRes.json();

  const top3 = (trendingData.coins ?? []).slice(0, 3);
  const ids = top3.map((c: any) => c.item.id).join(",");

  const priceRes = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
    { cache: "no-store" },
  );
  if (!priceRes.ok) throw new Error(`coingecko price ${priceRes.status}`);
  const priceData = await priceRes.json();

  return top3.map(
    (c: any): CoinTickerEntry => ({
      symbol: c.item.symbol.toUpperCase(),
      name: c.item.name,
      price: priceData[c.item.id]?.usd ?? 0,
      change24h: priceData[c.item.id]?.usd_24h_change ?? 0,
      category: "trending",
    }),
  );
}

async function fetchOpportunityPool(): Promise<CoinTickerEntry[]> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&price_change_percentage=24h",
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`coingecko markets ${res.status}`);
  const data = await res.json();

  // 排除 majors
  const filtered = data.filter(
    (c: any) => !MAJORS_SYMBOLS.includes(c.symbol.toUpperCase() as (typeof MAJORS_SYMBOLS)[number]),
  );

  // 按涨跌幅排序
  const byChange = [...filtered].sort(
    (a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h,
  );

  // 涨幅 top 2
  const winners = byChange.slice(0, 2);
  // 跌幅 top 1（数组末尾）
  const losers = byChange.slice(-1);

  return [...winners, ...losers].map(
    (c: any): CoinTickerEntry => ({
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      price: c.current_price,
      change24h: c.price_change_percentage_24h ?? 0,
      category: "opportunity",
    }),
  );
}

export async function getCoinPool(): Promise<CoinPoolPayload> {
  // majors 复用现有 ticker 逻辑
  const majorsTicker = await getMarketTickers();
  const majors: CoinTickerEntry[] = MAJORS_SYMBOLS.map((sym) => ({
    symbol: sym,
    price: majorsTicker.tickers[sym].price,
    change24h: majorsTicker.tickers[sym].change24h,
    category: "majors",
  }));

  let trending: CoinTickerEntry[] = [];
  let opportunity: CoinTickerEntry[] = [];

  try {
    trending = await getCached(TRENDING_CACHE_KEY, TRENDING_TTL_MS, fetchTrendingPool);
  } catch (error) {
    console.warn("[claw42] trending fallback", error);
  }

  try {
    opportunity = await getCached(OPPORTUNITY_CACHE_KEY, OPPORTUNITY_TTL_MS, fetchOpportunityPool);
  } catch (error) {
    console.warn("[claw42] opportunity fallback", error);
  }

  return {
    ts: Date.now(),
    majors,
    trending,
    opportunity,
    source: majorsTicker.source ?? "coingecko-ticker",
    isStale: majorsTicker.isStale,
    isFallback: majorsTicker.isFallback,
    error: majorsTicker.error,
  };
}
```

### 4.4 ticker route 扩展

`src/app/api/market/ticker/route.ts`：

```ts
import { NextResponse } from "next/server";
import { getCoinPool } from "@/lib/marketDataCache";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getCoinPool();
  return NextResponse.json(payload);
}
```

返回结构变成 `CoinPoolPayload`，前端要适配。

**向后兼容**：保留旧的 `TickerMap` 衍生逻辑——CoinModal 仍只用 majors。

---

## 5. 任务 B — CoinTickerStrip 三组显示

```tsx
"use client";

import type { CoinPoolPayload, MarketDataSource } from "../types";
import { useI18n } from "@/i18n/I18nProvider";

function formatPrice(price: number, isStablecoin = false) {
  return `$${price.toLocaleString("en-US", {
    minimumFractionDigits: isStablecoin ? 4 : 0,
    maximumFractionDigits: isStablecoin ? 4 : price < 1 ? 6 : 2,
  })}`;
}

export function CoinTickerStrip({ pool }: { pool?: CoinPoolPayload }) {
  const { t } = useI18n();
  if (!pool) return null;

  return (
    <div className="card-glow overflow-x-auto rounded-2xl border border-white/10 bg-[#111]/90 px-4 py-3">
      <div className="flex min-w-fit items-center gap-4 md:gap-6">
        {/* 主流组 */}
        <Group label={t.agentWatch.coinPool.majors} icon="●" iconColor="text-white/50">
          {pool.majors.map((c) => (
            <CoinChip key={c.symbol} entry={c} isStablecoin={c.symbol === "USDT"} />
          ))}
        </Group>

        {pool.trending.length > 0 && (
          <>
            <Divider />
            <Group label={t.agentWatch.coinPool.trending} icon="🔥" iconColor="text-orange-400">
              {pool.trending.map((c) => (
                <CoinChip key={c.symbol} entry={c} />
              ))}
            </Group>
          </>
        )}

        {pool.opportunity.length > 0 && (
          <>
            <Divider />
            <Group label={t.agentWatch.coinPool.opportunity} icon="🎯" iconColor="text-[#b49cff]">
              {pool.opportunity.map((c) => (
                <CoinChip key={c.symbol} entry={c} />
              ))}
            </Group>
          </>
        )}
      </div>
    </div>
  );
}

function Group({ label, icon, iconColor, children }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className={`text-xs font-semibold ${iconColor}`}>
        {icon} {label}
      </span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function CoinChip({ entry, isStablecoin }) {
  const up = entry.change24h >= 0;
  return (
    <div className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 font-mono text-xs">
      <span className="font-bold text-white">{entry.symbol}</span>
      <span className="text-white/70">{formatPrice(entry.price, isStablecoin)}</span>
      <span className={up ? "text-[#b49cff]" : "text-[#ff5f5f]"}>
        {up ? "+" : ""}
        {entry.change24h.toFixed(2)}%
      </span>
    </div>
  );
}

function Divider() {
  return <span className="h-6 w-px shrink-0 bg-white/10" />;
}
```

视觉特点：

- 三组横向排列，分隔线分组
- 主流组无 emoji（克制），热门 🔥，机会 🎯
- 整体 `overflow-x-auto`：mobile 上横向滚动看得过来
- 每个 chip 紧凑（高 24px 左右）

---

## 6. 任务 C — LLM batch prompt 扩展

`buildPrompt(pool: CoinPoolPayload)` 改造：

```ts
function buildPrompt(pool: CoinPoolPayload): string {
  const formatGroup = (entries: CoinTickerEntry[]) =>
    entries
      .map(
        (e) => `${e.symbol} $${e.price} ${e.change24h >= 0 ? "+" : ""}${e.change24h.toFixed(2)}%`,
      )
      .join("  ");

  return `
你扮演 3 个加密交易 Agent 同时点评当前市场。每个 Agent 有独立人设、术语和禁用词，输出风格必须明显差异化。

## 当前实时行情（按组）

【主流】 ${formatGroup(pool.majors)}
【热门】 ${formatGroup(pool.trending)}
【机会】 ${formatGroup(pool.opportunity)}

## Agent 人设规则

[沿用 task-07 的 Alpha/Beta/Gamma 段，含 persona/术语/禁用词]

## 选币纪律（关键改动）

每个 Agent **必须从 10 个币里选自己关注的 1-2 个币评论**：

- **Alpha（突破派）** 优先选**热门**或**机会**币（盘整后可能突破的）；如果热门币都没到关键位，选主流币谈"等盘整破位"
- **Beta（趋势派）** 优先选**主流**或**热门**币（趋势明显的）；不选机会币（极端涨跌不属于趋势分析范畴）
- **Gamma（回归派）** 优先选**机会**或**主流**币（涨跌幅大 = 偏离均线大 = 回归视角的天然标的）

3 Agent 选的币**最好不重复**，覆盖更多信息密度。如果实在要选同一个币，必须从不同视角分析。

## 输出格式（严格 JSON）

{
  "stream": [
    { "agentId": "alpha", "content": "<必须包含 Alpha 选的币 symbol>" },
    { "agentId": "beta",  "content": "<必须包含 Beta 选的币 symbol>" },
    { "agentId": "gamma", "content": "<必须包含 Gamma 选的币 symbol>" }
  ],
  "heroBubbles": [ "...", "...", "..." ],
  "coinComments": {
    "BTC":  { "alpha": "<>", "beta": "<>", "gamma": "<>" },
    "ETH":  { "alpha": "<>", "beta": "<>", "gamma": "<>" },
    "SOL":  { "alpha": "<>", "beta": "<>", "gamma": "<>" },
    "USDT": { "alpha": "<>", "beta": "<>", "gamma": "<>" }
  }
}

注：coinComments 仍只覆盖主流 4 币（CoinModal 用），不要覆盖热门/机会币（控成本）。
stream 里 3 条必须各自含一个具体币 symbol。

[硬性规则沿用 task-07]
`;
}
```

---

## 7. 任务 D — i18n

### types.ts

```ts
agentWatch: {
  // ... 现有字段
  coinPool: {
    majors: string; // "主流"
    trending: string; // "热门"
    opportunity: string; // "机会"
  }
}
```

### zh_CN.json

```json
"coinPool": {
  "majors": "主流",
  "trending": "热门",
  "opportunity": "机会"
}
```

其他 9 语：占位（majors=Majors / trending=Trending / opportunity=Opportunity）

---

## 8. 任务 E — AgentWatchBoard 适配

```tsx
// useAgentAnalysis 返回的 data 现在含 pool 而不是单纯 tickers
// CoinTickerStrip 改成接收 pool
<CoinTickerStrip pool={pool} />;

// CoinModal / Hero 4 币交互仍只用 pool.majors，转换成 TickerMap 后传入
const majorsTickerMap: TickerMap = pool.majors.reduce((acc, c) => {
  acc[c.symbol as keyof TickerMap] = { price: c.price, change24h: c.change24h };
  return acc;
}, {} as TickerMap);
```

---

## 9. 验收

### 类型 / 构建

- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 通过

### Grep

- [ ] `grep "trending\|opportunity\|CoinPoolPayload" src/modules/agent-watch/types.ts` 存在
- [ ] `grep "fetchTrendingPool\|fetchOpportunityPool" src/lib/marketDataCache.ts` 存在
- [ ] `grep "Group\|CoinChip" src/modules/agent-watch/components/CoinTickerStrip.tsx` 存在

### 行为（live preview）

- [ ] ticker bar 显示三组：主流（4）+ 🔥 热门（3）+ 🎯 机会（3）
- [ ] 热门 / 机会区的币 5 分钟内一致，5 分钟后可能换币
- [ ] LLM stream 输出每条至少含一个币 symbol
- [ ] 跑 5 轮观察 3 Agent 是否选不同币（不再都说 BTC）
- [ ] CoinModal 点击仍只主流 4 币能弹（热门/机会 chip 没有 onclick）

### 不退化

- [ ] task-05 cache + idle detection 仍生效
- [ ] task-06 history buffer 仍累积（pushHistoryFromBatch 不变，仍 flatten stream）
- [ ] task-07 Agent 人设输出风格仍差异化
- [ ] DeepSeek primary chain 仍生效

### 边界

- [ ] CoinGecko trending API 失败 → trending 数组返回 [] → ticker bar 隐藏热门组
- [ ] CoinGecko markets API 失败 → opportunity 数组返回 [] → ticker bar 隐藏机会组
- [ ] majors 失败 → 仍走 fallbackTickers（既有逻辑不变）
- [ ] 三组都失败 → ticker bar 显示降级状态

---

## 10. 约束

- **CoinModal 不扩展**——仅主流 4 币能弹（Q1 决策）
- **每组上限 3 个**——不要扩到 5 个（Q2 决策）
- **LLM stream 必须含币 symbol**——不能输出"今天市场不错"这种泛泛而谈
- 不引新依赖
- **ticker API 必须优雅降级**——任何分组失败都不阻塞其他组渲染
- coinComments 仍只覆盖主流 4 币（不浪费 LLM token）

## 11. 提交与 PR

```sh
git checkout main
git pull origin main
git checkout -b feature/coin-pool-expansion-01
# 实现
git add src/modules/agent-watch/types.ts \
        src/lib/marketDataCache.ts \
        src/app/api/market/ticker/route.ts \
        src/lib/llmFallbackChain.ts \
        src/modules/agent-watch/components/CoinTickerStrip.tsx \
        src/modules/agent-watch/AgentWatchBoard.tsx \
        src/i18n/types.ts src/i18n/dicts/*.json
git commit -m "feat(market): expand coin pool to majors + trending + opportunity

- Add CoinGecko /search/trending fetch (3 coins, 5min cache)
- Add CoinGecko /coins/markets sort by 24h change extreme (winners + losers, 3 coins, 5min cache)
- CoinTickerStrip renders three groups with dividers (majors / 🔥 热门 / 🎯 机会)
- LLM prompt: include all 10 coins, instruct each agent to pick relevant coins by 派系
- CoinModal scope unchanged (still majors-only per Dan Q1=否)
- coinComments still only covers majors (cost control)
- Graceful degrade: trending/opportunity fetch failures hide their group, don't block majors"
git push origin feature/coin-pool-expansion-01
```

PR 描述提醒 Dan：preview 上观察 5 轮 batch（25 分钟）确认 3 Agent 选不同币。

---

## 12. 副审

不要求副审。新功能 + Codex 实现工时 4-6 小时，Dan preview 验收为最终关卡。

---

_维护者: F_
_创建: 2026-04-28_
_执行者: Codex_
_前置: task-07 已合并_
