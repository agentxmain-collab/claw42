# Task 17 — News 数据源多源 Hybrid Chain（task-15 v2 数据层迁移）

> **触发**：task-16 调研报告（`docs/research/news-source-evaluation-by-claude.md`）结论：CryptoPanic 单一源是产品脆弱性根源，无论免费层是否真停服都该改 Hybrid 架构。
>
> **基础**：task-15 News Debate Mode 已落地（PR #21 merged），数据层是 CryptoPanic 单源 + mock fallback。
>
> **目标**：把数据层升级为 SourceChain（CryptoCompare 主 → CoinGecko 备 → 3 RSS 兜底 → Binance/CoinW 专项），UI / 辩论引擎 / event 触发器不变。
>
> **执行者**：Codex
>
> **新分支**：`feature/news-source-multi-chain-01`
>
> **PR target**：`feature/act1-5-watch-page-01`
>
> **前置依赖**：task-15 PR #21 已 merge

---

## 1. 设计原则（不可妥协）

| 纪律                          | 内容                                                                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **数据层重构 ≠ 功能改动**     | task-15 的 NewsDebate / FinalStrategy / Replay / Cron / OG 全部不动；本 task 只改 source adapter 和触发链                                     |
| **CryptoPanic 不删**          | 留作 feature-flag 可回滚源；Dan 验证公告后再决定是否真彻底废弃                                                                                |
| **Source Registry 禁硬编码**  | 任何 source ID（'cryptocompare' / 'coingecko' / 'cryptopanic' 等）字面量**只允许**出现在 `sourceRegistry.ts` 一个文件 — 调用方走 registry API |
| **Schema 兼容**               | 所有 adapter 输出的 NewsItem 形状必须严格匹配 task-15 已有 type（不允许引入新字段）                                                           |
| **Normalizer 仅在缺字段时跑** | 不每条都调 LLM；只补缺失的 sentiment / currencies                                                                                             |

---

## 2. 架构（来自 task-16 § D 推荐）

```
News Source Chain（server-side）
   │
   ├─ Primary  ──►  CryptoCompare /data/news      （free 100k/mo 或 ~$80/mo）
   │      ↓ 错误 / 限流 / 配额耗尽
   ├─ Fallback ──►  CoinGecko /news               （Demo 10k credits/mo）
   │      ↓ 同上
   ├─ Fallback ──►  RSS chain                      （CoinDesk / Cointelegraph / Decrypt，free）
   │
   ├─ Specialty ──►  Binance Announcements RSS    （listings / 上线信号）
   ├─ Specialty ──►  CoinW Announcements          （Dan 后续确认 partner feed）
   ├─ Optional  ──►  CoinMarketCal events          （catalysts，task-18+）
   ├─ Standby   ──►  CryptoPanic                   （feature-flag，按需打开）
   │
   └─ Normalizer (DeepSeek): 缺 sentiment / currencies 时补
       │
       ▼
   Per-source cache (TTL by usage band)
       │
       ▼
   newsTriggers.ts → debateOrchestrator.ts （task-15 已有，不变）
```

---

## 3. 待 Dan 确认（默认值已设，spec 不阻塞）

| Open Question        | 默认值（Codex 按此实施）                       | Dan 可否决                       |
| -------------------- | ---------------------------------------------- | -------------------------------- |
| CryptoPanic 公告原文 | 保留 adapter，feature-flag 默认 OFF            | 验证后 Dan 决定 ON/OFF/删除      |
| 月预算               | $0（先全 free tier + RSS）                     | Dan 给 budget 后升级 paid plan   |
| RSS ToS 显示风险     | 仅显示 title + 短 summary（≤200 字），不抓正文 | 法务说不行就只显 title           |
| CoinW 优先级         | 占位 adapter 但不接真 feed（等 BD 确认）       | Dan 给 partner endpoint 后真接入 |
| 中文源               | 不接，LLM 翻译已在 task-15                     | Dan 要求加 → task-19             |
| 历史窗口             | 24h（对齐 cron 复盘窗口）                      | 可调常量                         |

---

## 4. Source Registry（核心架构）

```ts
// src/lib/news/sourceRegistry.ts 新建
export type NewsSourceId =
  | "cryptocompare"
  | "coingecko"
  | "cryptopanic"
  | "rss-coindesk"
  | "rss-cointelegraph"
  | "rss-decrypt"
  | "binance-announcements"
  | "coinw-announcements";

export type SourceRole = "primary" | "fallback" | "specialty" | "standby" | "optional";

export interface NewsSourceConfig {
  id: NewsSourceId;
  status: "active" | "beta" | "planned" | "standby";
  role: SourceRole;
  displayName: string;
  endpoint: string;
  authMode: "apiKey" | "none";
  envKey?: string; // process.env.X 名字
  rateLimitPerMin?: number;
  monthlyQuota?: number; // free/Pro 配额（用于 quota burn 预警）
  fields: {
    sentimentNative: boolean;
    currenciesNative: boolean;
    votesNative: boolean;
  };
  cspHosts: string[]; // CSP connect-src 需添加的域
  attribution?: string; // 必须在 UI 显示的归属文案
  ipDocFile?: string; // 可选：source-specific 备注
}

export const NEWS_SOURCE_REGISTRY: Record<NewsSourceId, NewsSourceConfig> = {
  cryptocompare: {
    id: "cryptocompare",
    status: "active",
    role: "primary",
    displayName: "CryptoCompare",
    endpoint: "https://min-api.cryptocompare.com/data/v2/news/?lang=EN",
    authMode: "apiKey",
    envKey: "CRYPTOCOMPARE_API_KEY",
    rateLimitPerMin: 50,
    monthlyQuota: 100_000,
    fields: { sentimentNative: false, currenciesNative: false, votesNative: false },
    cspHosts: ["https://min-api.cryptocompare.com"],
    attribution: "Powered by CryptoCompare",
  },
  coingecko: {
    id: "coingecko",
    status: "active",
    role: "fallback",
    displayName: "CoinGecko",
    endpoint: "https://pro-api.coingecko.com/api/v3/news",
    authMode: "apiKey",
    envKey: "COINGECKO_DEMO_KEY",
    rateLimitPerMin: 30,
    monthlyQuota: 10_000,
    fields: { sentimentNative: false, currenciesNative: false, votesNative: false },
    cspHosts: ["https://api.coingecko.com", "https://pro-api.coingecko.com"],
    attribution: "Powered by CoinGecko",
  },
  cryptopanic: {
    id: "cryptopanic",
    status: "standby",
    role: "standby",
    displayName: "CryptoPanic",
    endpoint: "https://cryptopanic.com/api/developer/v2/posts/",
    authMode: "apiKey",
    envKey: "CRYPTOPANIC_API_KEY",
    fields: { sentimentNative: false, currenciesNative: true, votesNative: true },
    cspHosts: ["https://cryptopanic.com"],
    attribution: "Powered by CryptoPanic",
  },
  "rss-coindesk": {
    /* role: 'fallback', endpoint: https://www.coindesk.com/arc/outboundfeeds/rss/, authMode: 'none', cspHosts: ['https://www.coindesk.com'] */
  } as any,
  "rss-cointelegraph": {
    /* https://cointelegraph.com/rss */
  } as any,
  "rss-decrypt": {
    /* https://decrypt.co/feed */
  } as any,
  "binance-announcements": { role: "specialty" } as any,
  "coinw-announcements": { status: "planned", role: "specialty" } as any,
};

// API
export function getActiveSources(role?: SourceRole): NewsSourceConfig[] {
  return Object.values(NEWS_SOURCE_REGISTRY).filter(
    (s) => s.status === "active" && (!role || s.role === role),
  );
}

export function getSourceChain(): NewsSourceConfig[] {
  // 主 → 备 → 兜底（按 role 排序，role 内按 registry 声明顺序）
  const order: SourceRole[] = ["primary", "fallback", "specialty"];
  return order.flatMap((role) => getActiveSources(role));
}
```

**硬规则**：业务代码（adapter / orchestrator / triggers / UI）**禁止**出现 `'cryptocompare'` / `'coingecko'` / `'cryptopanic'` 等字面量。所有调用走 `getActiveSources()` / `getSourceChain()` 遍历或者 `NEWS_SOURCE_REGISTRY[id]` 索引。grep 验证：

```bash
grep -rn "'cryptocompare'\|'coingecko'\|'cryptopanic'\|'rss-" src/ \
  --include='*.ts' --include='*.tsx' \
  | grep -v 'sourceRegistry.ts\|test\|__tests__'
# 预期输出：0 行
```

---

## 5. Adapter 实现要求

每个 adapter 必须实现统一接口：

```ts
// src/lib/news/adapters/types.ts 新建
export interface NewsAdapter {
  sourceId: NewsSourceId;
  fetch(opts: { limit: number }): Promise<NewsItem[]>;
  isAvailable(): boolean; // 检查 env 是否配置 + 上次失败冷却是否结束
}
```

新建 adapter 文件：

```
src/lib/news/adapters/cryptocompare-adapter.ts
src/lib/news/adapters/coingecko-news-adapter.ts
src/lib/news/adapters/rss-adapter.ts             # 通用 RSS（参数化 endpoint）
src/lib/news/adapters/binance-announcements-adapter.ts
src/lib/news/adapters/coinw-announcements-adapter.ts   # 占位，永久返回空数组直到 Dan 给 endpoint
src/lib/news/adapters/cryptopanic-adapter.ts     # 移动现有 src/lib/api/cryptopanic.ts 到这里
```

**字段映射**（每 adapter 实施时按 task-16 § C 第 1-12 项的表落）：

- title / url / source / publishedAt 必须每个 adapter 原生提供
- currencies / sentiment 缺失时打 `{ needsNormalize: true }` 标记，由 normalizer 后置补

**RSS adapter 通用化**：3 个 RSS 源用一个 adapter + 不同 endpoint 配置。`rss-coindesk` / `rss-cointelegraph` / `rss-decrypt` 在 registry 各自一条 entry，但代码用同一 class。装 `rss-parser` 库（注：**新依赖必须走 dependency-policy 11 步流程**，先 ADR 0007 + Dan 批准 + 墨菲扫）。

---

## 6. Normalizer（LLM 后置补字段）

```ts
// src/lib/news/normalizer.ts 新建
export async function normalizeNewsItem(
  item: NewsItem & { needsNormalize?: boolean },
): Promise<NewsItem> {
  if (!item.needsNormalize) return item;

  const missing: string[] = [];
  if (!item.sentiment || item.sentiment === "neutral") missing.push("sentiment");
  if (!item.currencies?.length) missing.push("currencies");

  if (missing.length === 0) return item;

  // 单条 LLM 调用补字段（DeepSeek，prompt 极简）
  const enriched = await llmEnrichNewsItem(item, missing);
  return { ...item, ...enriched, needsNormalize: false };
}
```

**Prompt** （硬约束）：

```
You receive a crypto news headline. Return JSON ONLY, no prose.

Title: ${title}
Summary: ${summary || ''}

Output:
{
  "sentiment": "positive" | "negative" | "neutral",
  "currencies": ["BTC" | "ETH" | "SOL" | ...]   // ISO-style symbols only
}

Rules:
- sentiment based on price/market impact, not editorial tone
- currencies: only include symbols explicitly mentioned or strongly implied
- max 5 currencies
- if uncertain, return ["BTC"] if news is general crypto, [] if no clear coin
```

**配额纪律**：normalizer 只对缺字段的 item 触发。每条 ~80 tokens，DeepSeek 价格忽略。**不允许**在 RSS chain 启动时一次性 normalize 整批 — 必须 lazy（debate engine 实际消费时才补）。

---

## 7. SourceChain Orchestrator

```ts
// src/lib/news/sourceChain.ts 新建
import { failureCooler } from "@/lib/utils/failureCooler"; // task-15 已有

export async function fetchNewsWithChain(opts: { limit: number }): Promise<{
  items: NewsItem[];
  servedBy: NewsSourceId;
  fellBackFrom: NewsSourceId[];
}> {
  const chain = getSourceChain();
  const fellBackFrom: NewsSourceId[] = [];

  for (const source of chain) {
    const adapter = ADAPTERS[source.id];
    if (!adapter || !adapter.isAvailable()) {
      fellBackFrom.push(source.id);
      continue;
    }

    try {
      const items = await failureCooler.run(
        () => adapter.fetch(opts),
        () => [],
      );
      if (items.length > 0) {
        return { items, servedBy: source.id, fellBackFrom };
      }
      fellBackFrom.push(source.id);
    } catch (err) {
      console.warn(`[news] ${source.id} failed, falling back`, err);
      fellBackFrom.push(source.id);
    }
  }

  // 全 fallback 失败 → mock
  return { items: getMockNews(opts), servedBy: "cryptopanic", fellBackFrom };
}
```

**关键纪律**：

- chain 顺序由 registry 决定，不允许在 orchestrator 内 hardcode
- failureCooler 复用 task-15 已有实现（每 source 独立冷却 30min）
- 全失败兜底到 mock（dev 用），打日志

---

## 8. 接入点改动（仅 1 个文件）

**task-15 已有的 `src/lib/api/cryptopanic.ts` 调用方**统一改成 `fetchNewsWithChain`。

```ts
// src/lib/debateOrchestrator.ts 内（task-15 已有）
- import { fetchCryptopanicNews } from '@/lib/api/cryptopanic';
+ import { fetchNewsWithChain } from '@/lib/news/sourceChain';

- const news = await fetchCryptopanicNews({ limit: 10 });
+ const { items: news, servedBy, fellBackFrom } = await fetchNewsWithChain({ limit: 10 });
+ // 监控：上报 servedBy + fellBackFrom 到 PostHog
+ track('news_fetched', { served_by: servedBy, fellback_count: fellBackFrom.length });
```

`src/lib/api/cryptopanic.ts` **删除**（已迁移到 `src/lib/news/adapters/cryptopanic-adapter.ts`）。`src/lib/newsTriggers.ts` 内对 NewsItem 的消费**不变**。

---

## 9. Per-source 缓存

```ts
// src/lib/news/cache.ts 新建
const TTL_BY_BAND: Record<string, number> = {
  low: 5 * 60_000,      // 5min（默认）
  medium: 3 * 60_000,
  high: 60_000,
};

const cache = new Map<string, { items: NewsItem[]; expiresAt: number }>();

export function getCacheKey(sourceId: NewsSourceId, opts: { limit: number }) {
  return `${sourceId}:${opts.limit}`;
}

// 负缓存：429 / 5xx 时短 TTL（30s）防雪崩
export function setNegativeCache(sourceId: NewsSourceId, durationMs = 30_000) { ... }
```

**纪律**：每 source 独立 namespace。不允许跨源缓存污染（CryptoCompare 的 item 不能被存到 CoinGecko 的 cache key）。

---

## 10. CSP 改动

```js
// next.config.mjs connect-src 加：
'https://min-api.cryptocompare.com',
'https://api.coingecko.com',
'https://pro-api.coingecko.com',
'https://www.coindesk.com',
'https://cointelegraph.com',
'https://decrypt.co',
'https://www.binance.com',
// CoinW host 等 Dan 给后再加
// CryptoPanic 保留（standby）
```

---

## 11. 环境变量

`.env.local.example` + README env 段加：

```
# News sources (multi-chain)
CRYPTOCOMPARE_API_KEY=                    # required for primary
COINGECKO_DEMO_KEY=                       # required for fallback
NEWS_PRIMARY_SOURCE=cryptocompare         # runtime override; one of registry IDs
NEWS_USAGE_BAND=low                       # low | medium | high → cache TTL
# CRYPTOPANIC_API_KEY=                    # standby, default OFF
```

`Vercel env` Dan 自己配（同 task-15 § 18 流程）。

---

## 12. Mock 改造

`src/lib/news/mock-news.json` 替换 task-15 的 `mockCryptoPanicNews()`。新 mock 必须用统一 NewsItem schema（无 cryptopanic-specific 字段如 `votes`），让 dev 环境走完整 chain（包括 normalizer）。

加 `mock-all-sources-offline.json`（fixture 用），用于"全 fallback 失败 → 兜底到 mock"路径的测试。

---

## 13. 监控 / Analytics

PostHog `ANALYTICS_EVENTS` 加：

```
"news_fetched"           // properties: served_by, fellback_count
"news_source_failed"     // properties: source_id, error_class
"news_normalizer_run"    // properties: source_id, missing_fields[]
"news_quota_alert"       // properties: source_id, used_pct (≥80% 触发)
```

`src/lib/news/quotaTracker.ts` 新建：跟踪每个 source 月度配额消耗（in-memory，task-18 P2 升级到 Redis/PostHog 持久化）。

---

## 14. Verify 命令

`scripts/verify-news.mjs`（task-15 已有）扩展：

```
$ npm run verify:news
✅ CryptoCompare API: reachable, 47 hot news in last 24h
✅ CoinGecko API: reachable, 23 articles in 1h
✅ RSS CoinDesk: 12 items in feed
✅ RSS Cointelegraph: 18 items
✅ RSS Decrypt: 15 items
⚠️ CryptoPanic: standby (feature-flag OFF)
⚠️ CoinW: planned (no endpoint yet)
✅ FailureCooler: all sources healthy
✅ Cache hit rate (last 1h): 73%
✅ Translation cache: 234 entries, 89% hit
✅ NEWS_SOURCE_REGISTRY hardcode-grep: 0 violations
```

---

## 15. 4 阶段 Commit

| Stage       | 内容                                                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Stage 1** | Source Registry + 6 个 adapter 文件 + types + cryptopanic 迁移                                                                     |
| **Stage 2** | sourceChain orchestrator + per-source cache + failureCooler 接入 + normalizer                                                      |
| **Stage 3** | debateOrchestrator 接入点改动 + mock 改造 + analytics events 添加                                                                  |
| **Stage 4** | env example + CSP + verify:news 扩展 + ADR 0007（rss-parser 依赖）+ ADR 0008（CryptoPanic feature-flag 移到 standby）+ README 更新 |

---

## 16. 文件清单

### 新建

```
src/lib/news/sourceRegistry.ts                              # 核心配置
src/lib/news/sourceChain.ts                                 # orchestrator
src/lib/news/cache.ts                                       # per-source cache
src/lib/news/normalizer.ts                                  # LLM 补字段
src/lib/news/quotaTracker.ts                                # 配额监控
src/lib/news/mock-news.json                                 # 统一 schema mock
src/lib/news/mock-all-sources-offline.json                  # 全失败 fixture
src/lib/news/adapters/types.ts
src/lib/news/adapters/cryptocompare-adapter.ts
src/lib/news/adapters/coingecko-news-adapter.ts
src/lib/news/adapters/rss-adapter.ts
src/lib/news/adapters/binance-announcements-adapter.ts
src/lib/news/adapters/coinw-announcements-adapter.ts        # 占位
src/lib/news/adapters/cryptopanic-adapter.ts                # 从旧位置迁移
docs/adr/0007-rss-parser-dependency.md
docs/adr/0008-cryptopanic-standby-mode.md
```

### 修改

```
src/lib/debateOrchestrator.ts        # 接入点：fetchCryptopanicNews → fetchNewsWithChain
src/lib/analytics.ts                 # ANALYTICS_EVENTS 加 4 个新事件
next.config.mjs                      # CSP connect-src 加多个域
.env.local.example                   # 加 CRYPTOCOMPARE_API_KEY / COINGECKO_DEMO_KEY / NEWS_PRIMARY_SOURCE / NEWS_USAGE_BAND
README.md                            # env 段更新
ARCHITECTURE.md § 9                  # 禁止路径段加 sourceRegistry 例外说明
scripts/verify-news.mjs              # 扩展 multi-source health check
package.json                         # 加 rss-parser（走 dependency-policy）
```

### 删除

```
src/lib/api/cryptopanic.ts                                  # 已迁移到 adapter
```

---

## 17. 验收清单

### 17.1 架构

- [ ] `NEWS_SOURCE_REGISTRY` 单一源配置，业务代码无 source-id 字面量（grep 0 violations）
- [ ] `getSourceChain()` 返回顺序：primary → fallback → specialty
- [ ] 每 adapter 实现统一 `NewsAdapter` 接口
- [ ] RSS adapter 用同一 class + 3 个不同 endpoint 配置（不重复实现）
- [ ] CryptoPanic adapter 保留 + status: 'standby'（不删除）

### 17.2 功能

- [ ] CryptoCompare 主源能拉到真实 news（dev mode 用 Dan 配的 key）
- [ ] CoinGecko 备源能拉到（同上）
- [ ] 3 个 RSS adapter 能解析 feed
- [ ] Binance Announcements adapter 能拉
- [ ] CoinW adapter 占位，永久返回空数组 + console.warn 提示 endpoint 未配
- [ ] 全 source 失败 → fallback 到 mock-news.json
- [ ] Normalizer 仅对缺字段的 item 跑（dev log 验证）

### 17.3 schema 兼容

- [ ] 所有 adapter 输出严格符合 NewsItem type（task-15 已有，不允许新字段）
- [ ] task-15 的 newsTriggers / debateOrchestrator / NewsDebateCard 不需要任何字段适配

### 17.4 缓存与限流

- [ ] Per-source cache namespace 独立
- [ ] 429 / 5xx 触发 30s 负缓存
- [ ] failureCooler 每 source 独立冷却（连续 3 失败 → 30min cooldown）
- [ ] 单 source quota ≥80% 触发 PostHog `news_quota_alert` 事件

### 17.5 工程

- [ ] CSP connect-src 加全 6 个域（CryptoCompare / CoinGecko / CoinDesk / Cointelegraph / Decrypt / Binance）
- [ ] env example 完整
- [ ] verify:news 9 项检查全过
- [ ] ADR 0007 (rss-parser dep) + 0008 (cryptopanic standby) 落地
- [ ] dependency-policy.md 加 rss-parser 条目（known_baseline 段）
- [ ] 墨菲扫描通过（Dan 跑后确认）

### 17.6 监控

- [ ] PostHog 4 个新事件全部入 ANALYTICS_EVENTS 白名单
- [ ] dev mode 看 `news_fetched` 事件 properties 含 served_by / fellback_count

---

## 18. 风险与边界

| 风险                            | 缓解                                                |
| ------------------------------- | --------------------------------------------------- |
| RSS feed 突然加 CAPTCHA / 限流  | 多 RSS 源冗余 + failureCooler + 兜底 mock           |
| Normalizer LLM 输出 schema 不符 | 后处理 zod 验证 + 失败 fallback 到原 item（不阻塞） |
| CryptoCompare 100k/mo 配额低估  | 监控 + 80% 预警 + 缓存 TTL 收紧                     |
| CoinW endpoint 长期没给         | adapter 占位返回空 + 不阻塞主链                     |
| rss-parser 库存在漏洞           | dependency-policy 11 步 + 墨菲扫描必过              |
| RSS 全文显示踩 ToS              | 仅显示 title + ≤200 字 summary，永远附 source link  |

---

## 19. 提交命令

```sh
git checkout feature/act1-5-watch-page-01
git pull origin feature/act1-5-watch-page-01
git checkout -b feature/news-source-multi-chain-01

# Stage 1: Registry + adapters
# ...编辑、git add src/lib/news/sourceRegistry.ts src/lib/news/adapters/*.ts ...
git commit -m "feat(news): source registry + 6 adapters (task-17 stage 1)

- NEWS_SOURCE_REGISTRY single config; business code uses getSourceChain() / registry indexing
- Adapter interface unified across cryptocompare / coingecko / rss-* / binance / coinw / cryptopanic
- RSS adapter parameterized; 3 RSS sources share class
- Migrated old src/lib/api/cryptopanic.ts → src/lib/news/adapters/cryptopanic-adapter.ts (status: standby)
- CoinW adapter stubbed (endpoint pending Dan partner confirmation)"

# Stage 2: orchestrator + cache + normalizer
git commit -m "feat(news): source chain orchestrator + per-source cache + LLM normalizer (task-17 stage 2)

- fetchNewsWithChain: primary → fallback → specialty per registry order
- failureCooler reused per-source (30min cooldown after 3 consecutive failures)
- Per-source cache namespace + 30s negative cache on 429/5xx
- Normalizer: lazy LLM enrichment for missing sentiment/currencies (DeepSeek, ~80 tokens/item)"

# Stage 3: integration + mock + analytics
git commit -m "feat(news): integrate source chain into debate orchestrator (task-17 stage 3)

- debateOrchestrator: fetchCryptopanicNews → fetchNewsWithChain
- New mock-news.json uses unified NewsItem schema (no cryptopanic-specific fields)
- mock-all-sources-offline.json fixture for total-failure path
- ANALYTICS_EVENTS: news_fetched / news_source_failed / news_normalizer_run / news_quota_alert
- Removed src/lib/api/cryptopanic.ts (migrated to adapter)"

# Stage 4: env + CSP + ADR + verify
git commit -m "feat(news): env vars + CSP + verify:news + ADRs (task-17 stage 4)

- next.config.mjs CSP connect-src adds CryptoCompare / CoinGecko / CoinDesk / Cointelegraph / Decrypt / Binance
- .env.local.example: CRYPTOCOMPARE_API_KEY / COINGECKO_DEMO_KEY / NEWS_PRIMARY_SOURCE / NEWS_USAGE_BAND
- README env section updated
- ADR 0007: rss-parser dependency rationale (走 dependency-policy 11-step)
- ADR 0008: CryptoPanic moved to standby; not removed pending Dan verification of discontinuation notice
- verify:news extended to multi-source health report (9 checks)
- ARCHITECTURE.md § 9 footnote: sourceRegistry.ts is the only allowed location for source-id literals"

git push origin feature/news-source-multi-chain-01
```

---

## 20. Dan 自己执行的 4 件事

| #   | 事                                                                                               | 何时做         |
| --- | ------------------------------------------------------------------------------------------------ | -------------- |
| 1   | 注册 CryptoCompare API key（free 100k/mo）→ Vercel env `CRYPTOCOMPARE_API_KEY`（Prod + Preview） | Codex 推 PR 后 |
| 2   | 注册 CoinGecko Demo key → Vercel env `COINGECKO_DEMO_KEY`（同上）                                | 同上           |
| 3   | 跑 dependency-policy 11 步 + 墨菲扫描（rss-parser 新依赖）                                       | Codex 推 PR 后 |
| 4   | 验证 CryptoPanic 公告原文 → 决定 ADR 0008 是否升级到"完全废弃"                                   | 任何时候       |

---

## 21. 与既有 task 关系

**前置依赖**：

- task-15 PR #21（NewsDebate Mode 数据层是 CryptoPanic 单源）
- task-14 P0（PostHog / 安全头 / API 限流）

**作废**：

- task-15 § 6 的 CryptoPanic 单源接入（被 SourceChain 替代）

**保留**：

- task-15 全部 UI / 辩论引擎 / replay / OG 分享 / cron 不动
- task-15 schema (NewsItem / NewsDebate / FinalStrategy) 不动

**后续**：

- task-18 / task-19 加新 source（中文源 / 链上聚合等），全部走 registry 加新 entry，不改核心代码

---

## 22. 给 Codex 的派发文本

```
项目：claw42
工作路径：/Users/dannybrown/Claude/职业规划/web-dev/claw42
Spec：docs/airy-tasks/task-17-news-source-multi-chain.md（含完整研究背景：docs/research/news-source-evaluation-by-claude.md）

新分支：feature/news-source-multi-chain-01
PR target：feature/act1-5-watch-page-01

4 阶段 commit：
  Stage 1: Source Registry + 6 adapters（含 cryptopanic 迁移）
  Stage 2: SourceChain orchestrator + per-source cache + LLM normalizer
  Stage 3: 接入点改动 + mock 改造 + analytics events
  Stage 4: env + CSP + ADR 0007/0008 + verify:news 扩展

关键约束（必读）：
1. NEWS_SOURCE_REGISTRY 是 source-id 字面量唯一允许出现的文件——其他全走 registry API（grep 验证 0 violations）
2. CryptoPanic adapter 保留（status: 'standby'），不删除——Dan 待验证停服公告
3. CryptoPanic adapter 从 src/lib/api/cryptopanic.ts 迁移到 src/lib/news/adapters/cryptopanic-adapter.ts，旧文件删除
4. RSS 3 源用同一 class + 不同 endpoint 配置（rss-parser 库需走 dependency-policy 11 步 + ADR 0007）
5. NewsItem schema 严格不变（task-15 已有），任何 adapter 输出必须严格匹配
6. Normalizer 仅 lazy 触发（消费时缺字段才补，不批量跑）
7. CoinW adapter 占位，返回空数组 + console.warn（endpoint 待 Dan 给）
8. task-15 UI / 辩论引擎 / replay 不动

Dan 自己 4 件事（不阻塞 Codex）：
- 注册 CryptoCompare key → Vercel env CRYPTOCOMPARE_API_KEY
- 注册 CoinGecko Demo key → Vercel env COINGECKO_DEMO_KEY
- rss-parser 墨菲扫描
- CryptoPanic 公告原文验证

verify 命令：
- npm run verify
- npm run verify:agent-ip（task-15 已有）
- npm run verify:news（本 task 扩展）
- GitHub Actions verify
```

---

_维护者: F_
_创建: 2026-05-06_
_执行者: Codex_
_基于: task-16 调研报告 § A 短期/生产/兜底推荐 + § D Hybrid 架构_
_分支: feature/news-source-multi-chain-01_
_PR target: feature/act1-5-watch-page-01（不变）_
_独立: 不依赖 task-14 P1/P2_
