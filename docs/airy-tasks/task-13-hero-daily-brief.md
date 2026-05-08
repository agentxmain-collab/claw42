# Task 13 — Hero 区 Claw 42 Agent 日报卡接入真实数据

> **目标**：claw42 首页 hero 区"Claw 42 Agent"消息卡当前所有数据是 hardcode 占位（BTC $67,432 / ETH $3,521 等不对应真实行情）。改为接入实时数据 + 缓存解读，**全部用免费或已付费数据源**，不引入新付费 API。
>
> **执行者**：Codex
>
> **新分支**：`feature/hero-daily-brief-realtime-01`
>
> **PR target**：`feature/act1-5-watch-page-01`（不变，统一与其他 hero 修订合入主线）
>
> **独立**：不依赖 task-12 stream redesign，可并行实施

---

## 1. 内容设计：5 字段精简版

```
📊 今日加密货币市场日报           [实时数据 · X 分钟前]

• BTC: $76,820 (+0.10%) — Layer2 TVL 创新高     ← 价格实时 / narrative 6h 缓存
• ETH: $2,298 (+0.64%) — 跨链桥流入活跃
• SOL: $84.55 (+0.54%) — Meme 币热度回落
• 市场情绪：贪婪 72                              ← Fear & Greed 免费 API
• 今日异动：BLEND 24h +162% (机会区)            ← 从 ticker 派生 0 成本
```

**字段决策**（vs 原 hardcode 卡）：
| 字段 | v1 | v2 (现) | 数据源 | 状态 |
|---|---|---|---|---|
| 价格 + 24h % | ✅ hardcode | ✅ 实时 | Ticker（已有） | 复用 |
| 每币 narrative | ✅ hardcode | ✅ LLM 6h 缓存 | LLM（deepseek 已付费） | 已付费 |
| 市场情绪 | ✅ hardcode "贪婪 72" | ✅ 实时拉 | `api.alternative.me/fng/` | 🆕 免费 |
| 链上大额转账 | ✅ hardcode "3 笔" | ❌ 删除 | Whale Alert 付费 | 跳过 |
| 今日异动 | ❌ 无 | ✅ 派生 | Ticker 派生 | 0 成本 |

**今日异动派生逻辑**：

- 取过去 24h 涨跌幅最大的 1 个**非主流**币（excludes BTC/ETH/SOL）
- 优先取 abs(24h%) 最大值，正负方向都可能
- 文案：`{symbol} 24h {±X.X}% ({tier_label})`
  - tier_label 来自 ticker 三层分类：`机会区` / `热门区` / `主流区`

---

## 2. 数据流

```
首页访问
  │
  ├─ Server Component（Next.js App Router）
  │  ├─ fetch Ticker API → BTC/ETH/SOL 价格 + 派生今日异动
  │  ├─ fetch Fear & Greed API → 情绪指数
  │  └─ fetch /api/daily-narratives → 6h 缓存 narrative tags
  │
  └─ Client（轻刷新）
     setInterval 60s → 重新 fetch 实时部分（不重 fetch narrative）
```

**Cache 分层**：

| 层         | 字段                           | TTL | 实现                                                      |
| ---------- | ------------------------------ | --- | --------------------------------------------------------- |
| **实时层** | 价格、涨跌、情绪指数、今日异动 | 60s | Next.js fetch `next: { revalidate: 60 }`                  |
| **缓存层** | 每币 narrative tag             | 6h  | Next.js fetch `next: { revalidate: 21600 }` 或 file cache |

**LLM 调用频率**：narrative 每 6h 生成 1 次（每天 4 次），每次 1 个 prompt 输出 3 币 narrative，共 **每天 4 次 LLM 调用 ≈ 0 成本压力**。

---

## 3. API 接入

### 3.1 Fear & Greed Index

**Endpoint**: `https://api.alternative.me/fng/?limit=1&format=json`

**Response 示例**:

```json
{
  "data": [
    {
      "value": "72",
      "value_classification": "Greed",
      "timestamp": "1735563600",
      "time_until_update": "3600"
    }
  ]
}
```

**封装函数**：

```ts
// src/lib/api/fearGreed.ts
type FearGreedData = { value: number; classification: string };

const CLASSIFICATION_ZH: Record<string, string> = {
  "Extreme Fear": "极度恐慌",
  Fear: "恐慌",
  Neutral: "中性",
  Greed: "贪婪",
  "Extreme Greed": "极度贪婪",
};

export async function fetchFearGreed(): Promise<FearGreedData | null> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1", {
      next: { revalidate: 3600 }, // FGI 每小时更新 1 次，缓存 1h
    });
    const json = await res.json();
    const item = json.data[0];
    return {
      value: parseInt(item.value, 10),
      classification: CLASSIFICATION_ZH[item.value_classification] ?? item.value_classification,
    };
  } catch (err) {
    console.warn("[fearGreed] fetch failed", err);
    return null; // 失败兜底
  }
}
```

### 3.2 Ticker 复用 + 今日异动派生

```ts
// src/lib/dailyBrief.ts
import { fetchTicker } from "@/lib/api/ticker"; // 已有

type DailyBriefData = {
  majors: Array<{
    symbol: "BTC" | "ETH" | "SOL";
    price: number;
    change24h: number;
    narrative: string;
  }>;
  fearGreed: { value: number; classification: string } | null;
  todayMover: { symbol: string; change24h: number; tier: "机会" | "热门" } | null;
  generatedAt: number;
};

export async function getDailyBrief(): Promise<DailyBriefData> {
  const [ticker, fgi, narratives] = await Promise.all([
    fetchTicker(),
    fetchFearGreed(),
    fetchNarratives(),
  ]);

  // 主流：BTC/ETH/SOL
  const majors = (["BTC", "ETH", "SOL"] as const).map((sym) => ({
    symbol: sym,
    price: ticker.majors[sym].price,
    change24h: ticker.majors[sym].change24h,
    narrative: narratives[sym] ?? "—",
  }));

  // 今日异动：非主流中 abs(24h%) 最大
  const candidates = [...ticker.hot, ...ticker.opportunity].filter(
    (s) => !["BTC", "ETH", "SOL"].includes(s.symbol),
  );
  const todayMover = candidates.length
    ? candidates.reduce((max, cur) =>
        Math.abs(cur.change24h) > Math.abs(max.change24h) ? cur : max,
      )
    : null;

  return {
    majors,
    fearGreed: fgi,
    todayMover: todayMover
      ? { symbol: todayMover.symbol, change24h: todayMover.change24h, tier: tierOf(todayMover) }
      : null,
    generatedAt: Date.now(),
  };
}
```

### 3.3 Narrative 缓存 + LLM 生成

**新增 API route**: `src/app/api/daily-narratives/route.ts`

```ts
// 每 6h 调用一次 LLM 生成 BTC/ETH/SOL 的 narrative
import { getCachedNarratives, setCachedNarratives } from "@/lib/cache/fileCache";
import { llmGenerate } from "@/lib/llmFallbackChain";

export const revalidate = 21600; // 6h

export async function GET() {
  const cached = await getCachedNarratives();
  if (cached && Date.now() - cached.generatedAt < 6 * 60 * 60 * 1000) {
    return Response.json(cached.data);
  }

  // 调用 LLM 生成新的
  const ticker = await fetchTicker();
  const recentSignals = await getRecentSignals24h();

  const prompt = `
基于过去 24h 的市场数据，给 BTC、ETH、SOL 各生成 1 句 narrative tag。

[市场数据]
BTC: 价格 ${ticker.majors.BTC.price}, 24h ${ticker.majors.BTC.change24h}%
ETH: 价格 ${ticker.majors.ETH.price}, 24h ${ticker.majors.ETH.change24h}%
SOL: 价格 ${ticker.majors.SOL.price}, 24h ${ticker.majors.SOL.change24h}%

[24h 信号摘要]
${summarizeSignals(recentSignals)}

输出 JSON：
{
  "BTC": "...",
  "ETH": "...",
  "SOL": "..."
}

约束：
- 每币 narrative ≤ 12 个汉字
- 体现币种当前的关键叙事（突破/趋势/链上活跃/Layer2/Meme/质押 等）
- 不用"可能"/"或许"/"建议"等空词
- 不引用具体价格数字（数字会变，narrative 是定性）
`;

  const result = await llmGenerate(prompt);
  const narratives = JSON.parse(result);

  await setCachedNarratives({ data: narratives, generatedAt: Date.now() });
  return Response.json(narratives);
}
```

**fileCache 实现**（最简）：

```ts
// src/lib/cache/fileCache.ts
import fs from "fs/promises";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), ".cache");
const NARRATIVES_FILE = path.join(CACHE_DIR, "daily-narratives.json");

export async function getCachedNarratives() {
  try {
    const data = await fs.readFile(NARRATIVES_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function setCachedNarratives(payload: { data: any; generatedAt: number }) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(NARRATIVES_FILE, JSON.stringify(payload, null, 2));
}
```

---

## 4. UI 实现

### 4.1 DailyBriefCard 组件

```tsx
// src/modules/landing/DailyBriefCard.tsx 新建
type Props = { data: DailyBriefData };

export default function DailyBriefCard({ data }: Props) {
  const minutesAgo = Math.floor((Date.now() - data.generatedAt) / 60_000);

  return (
    <div className="max-w-md rounded-2xl border border-white/[0.08] bg-gradient-to-br from-purple-900/20 to-black/40 p-5">
      <header className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-400 to-purple-600">
          ✨
        </div>
        <div className="flex-1">
          <div className="font-semibold">Claw 42 Agent</div>
          <div className="text-xs text-white/40">
            {minutesAgo === 0 ? "just now" : `${minutesAgo} 分钟前`}
          </div>
        </div>
      </header>

      <h3 className="mb-3 flex items-center gap-1.5 font-semibold">
        <span>📊</span> 今日加密货币市场日报
      </h3>

      <ul className="space-y-2 text-sm">
        {data.majors.map((m) => (
          <li key={m.symbol} className="flex items-baseline gap-2">
            <span className="text-white/40">•</span>
            <span className="font-mono font-semibold">{m.symbol}:</span>
            <span className="font-mono">${formatPrice(m.price)}</span>
            <span className={priceDeltaColor(m.change24h)}>
              ({m.change24h >= 0 ? "+" : ""}
              {m.change24h.toFixed(2)}%)
            </span>
            <span className="mx-1 text-white/40">—</span>
            <span className="text-white/70">{m.narrative}</span>
          </li>
        ))}

        {data.fearGreed && (
          <li className="flex items-baseline gap-2">
            <span className="text-white/40">•</span>
            <span>市场情绪：</span>
            <span className="font-semibold">
              {data.fearGreed.classification} {data.fearGreed.value}
            </span>
          </li>
        )}

        {data.todayMover && (
          <li className="flex items-baseline gap-2">
            <span className="text-white/40">•</span>
            <span>今日异动：</span>
            <span className="font-mono font-semibold">{data.todayMover.symbol}</span>
            <span className="font-mono">24h</span>
            <span className={priceDeltaColor(data.todayMover.change24h)}>
              {data.todayMover.change24h >= 0 ? "+" : ""}
              {data.todayMover.change24h.toFixed(1)}%
            </span>
            <span className="text-xs text-white/50">({data.todayMover.tier}区)</span>
          </li>
        )}
      </ul>
    </div>
  );
}
```

### 4.2 集成到首页 Hero

```tsx
// src/app/[locale]/page.tsx
import DailyBriefCard from "@/modules/landing/DailyBriefCard";
import { getDailyBrief } from "@/lib/dailyBrief";

export default async function HomePage() {
  const brief = await getDailyBrief();

  return (
    <main>
      <HeroSection />
      <DailyBriefCard data={brief} />
      {/* ... 其他 */}
    </main>
  );
}
```

**SSR**：Server Component 在每次访问时 fetch（受 `revalidate: 60` 控制，60s 缓存）。

---

## 5. i18n

```ts
// src/i18n/types.ts 新增
landing: {
  // ... 已有
  dailyBrief: {
    title: '今日加密货币市场日报',
    sentimentLabel: '市场情绪',
    sentimentNeutral: '中性',
    sentimentExtremeFear: '极度恐慌',
    sentimentFear: '恐慌',
    sentimentGreed: '贪婪',
    sentimentExtremeGreed: '极度贪婪',
    todayMoverLabel: '今日异动',
    tierOpportunity: '机会',
    tierHot: '热门',
    justNow: 'just now',
    minutesAgo: '{n} 分钟前',
  },
}
```

10 语 dict 全部同步。Narrative 内容是 LLM 生成的中文（首期只支持中文 narrative，其他 locale 显示英文 fallback "Narrative unavailable"）。

---

## 6. 验收清单

### 6.1 数据接入

- [ ] BTC/ETH/SOL 价格不再是 hardcode（grep page.tsx / DailyBriefCard 无 `67432` `3521` `178` 等占位数）
- [ ] Fear & Greed Index 从 `api.alternative.me/fng/` 实时拉取
- [ ] FGI API 失败时显示"市场情绪：—"或整行隐藏（不报错）
- [ ] 今日异动从 ticker 数据派生，取非主流币 abs(24h%) 最大值
- [ ] Narrative 通过 `/api/daily-narratives` 拿，6h 缓存

### 6.2 缓存与刷新

- [ ] 实时数据 60s 刷新（Next.js `revalidate: 60`）
- [ ] Narrative 6h 缓存（fileCache 或 Next.js ISR）
- [ ] LLM 调用频率 ≤ 4 次/天（grep dev log 或观察 6h 才更新）
- [ ] 用户访问 60s 内多次刷新页面不重复调用任何外部 API

### 6.3 UI

- [ ] 卡片标题"Claw 42 Agent" + 时间戳"X 分钟前"或"just now"
- [ ] 5 行内容：3 主流币 + 情绪 + 今日异动
- [ ] 涨跌色用 task-11 M7 落地的 `priceDeltaColor()` helper（涨绿跌红）
- [ ] 卡片 max-w-md，符合 hero 区视觉比例
- [ ] FGI 或今日异动数据缺失时整行隐藏，不显示空字段

### 6.4 容错

- [ ] FGI API 失败 → 显示其他字段，不影响整卡渲染
- [ ] LLM narrative 失败 → 显示 `—` 占位
- [ ] Ticker API 失败 → 显示卡片但价格区显示"—"
- [ ] 任一 API 不阻塞其他字段（Promise.all 内每个独立 try-catch）

### 6.5 i18n

- [ ] 10 语 dict 都有 landing.dailyBrief 字段
- [ ] zh_CN 显示中文 narrative
- [ ] 其他 locale 显示英文 narrative fallback（首期）

---

## 7. 提交命令

```sh
git checkout feature/act1-5-watch-page-01
git pull origin feature/act1-5-watch-page-01
git checkout -b feature/hero-daily-brief-realtime-01

# 1 个 commit 出齐
git add src/lib/api/fearGreed.ts \
        src/lib/dailyBrief.ts \
        src/lib/cache/fileCache.ts \
        src/app/api/daily-narratives/route.ts \
        src/modules/landing/DailyBriefCard.tsx \
        src/app/\[locale\]/page.tsx \
        src/i18n/types.ts \
        src/i18n/dicts/*.json

git commit -m "feat(hero): real data for daily brief card (task-13)

- Replaced all hardcoded prices with realtime Ticker API data
- Fear & Greed Index integrated from api.alternative.me/fng/ (free)
- Daily mover derived from ticker hot/opportunity tiers (no extra API)
- Narrative tags generated by LLM, 6h file cache (4 LLM calls/day)
- DailyBriefCard component with graceful fallback per field
- Skipped: on-chain whale transfers (Whale Alert is paid, deferred)
- 5 rows: BTC + ETH + SOL + sentiment + today's mover
- i18n 10 locales updated; non-zh locales use English narrative fallback"

git push origin feature/hero-daily-brief-realtime-01
```

新建 PR：`feature/hero-daily-brief-realtime-01` → `feature/act1-5-watch-page-01`

---

## 8. 边界

**不做的**：

- 链上大额转账（Whale Alert 付费，延后）
- 新闻 narrative 接入（RSS 复杂，首期 LLM 只看价格 + 信号）
- 多语言 narrative 生成（首期只生成中文，其他 locale 用 fallback）
- 历史日报回溯（首期不存历史，每 6h 覆盖）

**未来扩展**：

- v2 接入 Whale Alert 大额转账
- v2 LLM narrative 生成多语言版本
- v2 加"日报历史" tab（用户看过去 7 天的日报）

---

_维护者: F_
_创建: 2026-04-29_
_执行者: Codex_
_分支: feature/hero-daily-brief-realtime-01_
_PR target: feature/act1-5-watch-page-01（不变）_
_独立: 不依赖 task-12，可并行实施_
