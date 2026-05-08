# Task 06 — Act 1.5 历史沉淀 + 切回提示（v4，三次副审收口版）

> **版本**：v4（基于 Codex 三次副审 PR #14 收口修订，**最终版**，不再副审）
> **目标**：让每次成功 LLM batch 沉淀成消息级历史档案——新用户首次访问立即看到累积的 60 条评论；切回 tab 时显式提示有新内容。
>
> **执行者**：Codex（编译断层风险高，需要一次性打通类型链路）
>
> **基于**：Task 05 已合并的 stale-while-revalidate cache + PR #11
>
> **分支**：在同一分支 `feature/act1-5-watch-page-01` 上加新 commit，分 3 段拆分（每段独立 tsc 通过）：
>
> 1. **后端合同**（types 仅含 HistoryMessageEntry / AgentAnalysisPayload `generatedAt` / `servedAt` 拆分 + llmFallbackChain + analysis route + history route，全仓类型可编译）
> 2. **Watch UI + i18n**（hooks + AgentWatchBoard 数据流分层 + MessageStream ref 增补 + NewContentBanner + **i18n types/dicts 全量新增**：`agentWatch.banner.*` / `agentWatch.emptyHistory` / `agentWatch.loadingHistory`，10 dict 同时落字段）
> 3. **文案收尾**（formatAgentMessageTime + MessageBubble 时间格式替换）
>
> **段②为什么含 i18n**：NewContentBanner 引用 `t.agentWatch.banner.*`、AgentWatchBoard 引用 `t.agentWatch.emptyHistory` / `loadingHistory`——i18n types 必须和消费组件同 commit 落地，否则段② tsc 失败（Codex 三段拆分实战发现的边界错位，PR 已停在此处）。
>
> **副审历史**：
>
> - v1 一次副审：`docs/reviews/task-06-cross-review-by-codex.md`（Part A 13 节 + Part B 13 条）
> - v2 二次副审：`docs/reviews/task-06-v2-cross-review-by-codex.md`（验收 R1-R12 + 7 条新问题）
> - v3 三次副审：`docs/reviews/task-06-v3-cross-review-by-codex.md`（NO-GO + 5 条阻塞清单）
> - **v4 收口：F 直接落 5 条修订，不再副审**

---

## 0.00 v4 修订记录（vs v3，基于三次副审 PR #14 NO-GO 阻塞清单）

| #   | 来源（v3 副审 Part C） | 严重          | 修订                                                                                                                                              |
| --- | ---------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | C1                     | **P0 编译挂** | `useAgentHistory` import 行从 `import { useEffect, useState }` 改成 `import { useCallback, useEffect, useRef, useState }`                         |
| W2  | C2                     | P1 用户可见   | `useAgentAnalysis` 加 `latestGeneratedAtRef`，每次 setData 后同步；hidden 时读 ref 不读闭包 data                                                  |
| W3  | C3                     | P1 行为退化   | `MessageStream` forwardRef 实施时**保留 PR #11 外层 card div + 内层 scroll div 双层结构**，imperative handle 绑现有内层 scroll ref，不改 DOM 层级 |
| W4  | C4                     | P2 lint       | `NewContentBanner` 删未使用的 `useCallback` import                                                                                                |
| W5  | C5                     | P2 i18n 落点  | `MessageStream` 接收 `emptyLabel?: string` prop（由 `AgentWatchBoard` 从 `useI18n` 取后传入），**不在组件内部 useI18n**                           |

---

## 0.0 v3 修订记录（vs v2，基于二次副审 PR #13）

| #   | 来源（v2 副审） | 严重          | 修订                                                                                                                                                                         |
| --- | --------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1  | B1 / D1         | **P0 编译挂** | 类型名对齐 PR #11 现有：`TickerMap` → `TickerMap`，`StreamMessage` → `StreamMessage`                                                                                         |
| V2  | B6 / D4         | **P0 编译挂** | `AgentWatchBoard` snippet 必须 `const { t, locale } = useI18n();` 解构 `locale`                                                                                              |
| V3  | B2 / D3         | P1 字段语义   | `generatedAt = Date.now()` 移到 provider `parseAnalysisJson` 成功之后取，不在 `refreshAnalysis` 函数开头                                                                     |
| V4  | B3 / D2         | P1 用户可见   | `useAgentHistory` 暴露 `refreshHistory()` 函数，banner 显示时 + 用户点击 banner 时调用刷新                                                                                   |
| V5  | B4              | P1 dedup      | liveQueue message id 必须用 `${latest.generatedAt}-${agentId}-${index}`（和 history entry id 一致）                                                                          |
| V6  | B5              | P1 行为退化   | `MessageStream` forwardRef **保留** PR #11 现有 `autoScroll` 状态、用户上滑暂停、回到最新按钮，**只在同一 ref 上** `useImperativeHandle` 增补 `scrollToLatest`，不要重写组件 |
| V7  | R11 / Part E    | P1 grep gate  | 改 `grep -q ... \|\| exit 1` 真硬退出，不是 `\|\| echo`                                                                                                                      |
| V8  | B7 / D5         | P2 i18n       | `emptyHistory` 替换 `MessageStream.tsx:37-40` 硬编码空态文案；`loadingHistory` 替换 `AgentWatchBoard.tsx:92-94` 硬编码 loading 态                                            |

---

## 0. v2 修订记录（vs v1）

| #   | 来源                                | 修订                                                                                                                                                                     |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Codex Part A §1 / §3 / §6 + Part B1 | 数据模型从 batch 级改成消息级：`HistoryMessageEntry { id, generatedAt, agentId, content, tickerSnapshot, source }`                                                       |
| R2  | Codex Part B9 + Part A §5           | payload 字段拆分：加 `generatedAt`（LLM 实际生成时间，永不更改）和 `servedAt`（响应时间）。所有去重 / 时间排序 / 新增判断都用 `generatedAt`，cache hit 只更新 `servedAt` |
| R3  | Codex Part B1 + Part A §6           | `historyMessages` 和 `liveTypingQueue` 数据流彻底分离。`keepFivePerAgent` 只作用于 live 路径，历史路径不截断                                                             |
| R4  | Codex Part C "最小可落地"           | 砍 v1：load more 整体砍掉（v2 再加）；banner 不显示精确数量，只显示"有新内容 →"；history API 不要 since 参数                                                             |
| R5  | Codex Part B5 / B13                 | IntersectionObserver 整体砍（因 R4 砍 load more）                                                                                                                        |
| R6  | Codex Part B6                       | 切回 tab 后**先 fetch、再判断**——不在 visibility event 当场判断（避免 race）                                                                                             |
| R7  | Codex Part A §4 + Part B4           | history API 空响应 `Cache-Control: no-store`，非空短缓存 10s                                                                                                             |
| R8  | Codex Part B7                       | 时间显示加 `formatAgentMessageTime(ts, locale)` 用 `Intl.DateTimeFormat`，替换 PR #11 现有 `formatTime`                                                                  |
| R9  | Codex Part B10                      | 类型 import 路径修正：所有前端 hook / 组件从 `@/modules/agent-watch/types` import，**不**从 `@/lib/llmFallbackChain` 反向 import                                         |
| R10 | Codex Part B12                      | 历史语义明确：**全站 LLM 历史**（Hero 触发的 batch 也进 buffer）——这是 batch 内容本身共享的自然结果，不影响产品定位                                                      |
| R11 | Codex Part A §12                    | 实现前置 grep gate：必须确认 task-05 已合并（`FRESH_TTL_MS` / `STALE_TTL_MS` / `backgroundRefreshInFlight` / `visibilitychange` 都存在），否则不开工                     |
| R12 | Codex Part A §10                    | 验收行为测试改成"观察 logs + history entries source 字段"，不要 ssh 删 env 触发 fallback                                                                                 |

---

## 1. 背景（修订后定位）

经过 Task 05 合并后，`/api/agents/analysis` 已经是 stale-while-revalidate 模式：

- **fresh 期 5 分钟**：直接返回 cache，不调 LLM
- **stale 期 5-30 分钟**：返回 stale + 后台 refresh
- **>30 分钟**：同步等待 LLM

这意味着真正的 LLM 生成频率取决于流量。低流量场景下可能 30 分钟才生成一次新 batch。

Task 06 v2 的目标：把每次"真正生成新 batch"的内容沉淀成消息级历史档案，让用户访问时立即有内容密度，离开后再回来时知道"有新东西"。

---

## 2. 数据模型（核心修订 R1 / R2 / R10）

### 2.1 修改 `src/modules/agent-watch/types.ts`

**新增 `HistoryMessageEntry` 类型**（消息级，UI 直接消费）：

```ts
export interface HistoryMessageEntry {
  id: string; // `${batchGeneratedAt}-${agentId}-${index}`
  generatedAt: number; // batch LLM 生成时间（epoch ms），永不修改
  agentId: AgentId; // alpha | beta | gamma
  content: string; // 该 Agent 该条 stream 内容
  tickerSnapshot: TickerMap; // 生成时的 ticker 快照（用于显示"当时 BTC 67k"上下文）
  source: "minimax" | "deepseek" | "claude"; // 不含 "cache" / "static-fallback"
}
```

### 2.2 修改 `AgentAnalysisPayload`

**字段拆分**（R2）：

```ts
export interface AgentAnalysisPayload {
  generatedAt: number; // ← 新增：LLM 实际生成时间，永不被 cache 改写
  servedAt: number; // ← 新增（替代旧 `ts`）：响应时间，cache hit 时是 Date.now()
  ttl: number;
  source: "minimax" | "deepseek" | "claude" | "cache" | "static-fallback";
  tickers: TickerMap;
  stream: StreamMessage[];
  heroBubbles: string[];
  coinComments: Record<CoinSymbol, Record<AgentId, string>>;
}
```

旧 `ts` 字段**完全替代**为 `servedAt`（不向后兼容旧 API consumer）—— Hero / agent-watch / hooks 全部改用 `generatedAt` / `servedAt`。

### 2.3 `StreamMessage` 不动

`StreamMessage { agentId, content }` 保持现状，仅作为 LLM JSON output 的中间态。flatten 成 `HistoryMessageEntry` 在后端 `pushHistory` 时做。

---

## 3. 修改清单

| 文件                                                      | 改动                                                                                                                               |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/agent-watch/types.ts`                        | 加 `HistoryMessageEntry` + `AgentAnalysisPayload` 字段拆分                                                                         |
| `src/lib/llmFallbackChain.ts`                             | payload 字段适配（generatedAt/servedAt）+ ring buffer 改消息级 + 只在 LLM 真生成时 push                                            |
| `src/app/api/agents/analysis/route.ts`                    | 输出格式更新（generatedAt/servedAt）                                                                                               |
| `src/app/api/agents/history/route.ts`                     | **新建** GET 历史接口（无 since 参数，简单 limit）                                                                                 |
| `src/modules/agent-watch/hooks/useAgentHistory.ts`        | **新建** 历史预灌 hook                                                                                                             |
| `src/modules/agent-watch/hooks/useAgentAnalysis.ts`       | visibility 切回**先 fetch 后判断**：generatedAt > lastSeenGeneratedAt 即触发 banner                                                |
| `src/modules/agent-watch/AgentWatchBoard.tsx`             | 数据流分层：`historyMessages` + `liveTypingQueue`                                                                                  |
| `src/modules/agent-watch/components/MessageStream.tsx`    | 接收消息级数组，砍 IntersectionObserver                                                                                            |
| `src/modules/agent-watch/components/MessageBubble.tsx`    | 用 `formatAgentMessageTime(ts, locale)` 替换 `formatTime`                                                                          |
| `src/modules/agent-watch/components/NewContentBanner.tsx` | **新建** banner（无数量版本）                                                                                                      |
| `src/modules/agent-watch/utils/formatTime.ts`             | **新建** `formatAgentMessageTime(ts, locale)`                                                                                      |
| `src/i18n/types.ts`                                       | 加 `agentWatch.banner.newContent` / `agentWatch.banner.dismissAriaLabel` / `agentWatch.emptyHistory` / `agentWatch.loadingHistory` |
| `src/i18n/dicts/zh_CN.json`                               | 完整中文文案                                                                                                                       |
| `src/i18n/dicts/{其他 9 个}.json`                         | 占位英文文案                                                                                                                       |

**显式不在范围**：

- IntersectionObserver / load more（v2 砍）
- 200 条上限的滚动加载（v2 砍）
- Banner 显示具体数量（v2 砍）
- `since` 查询参数（v2 砍）
- 历史归档独立页 `/agent/archive`（v2 砍）

不动：middleware、视觉骨架（task-05 视觉修订独立 commit）、其他 Section 组件、Hero 注入逻辑（仅 type 字段适配，行为不动）

---

## 4. 任务 A — Backend ring buffer（修订 R1 / R10）

### 4.1 在 `llmFallbackChain.ts` 加 buffer

```ts
const HISTORY_BUFFER_MAX_MESSAGES = 200;
let historyBuffer: HistoryMessageEntry[] = [];
const seenIds = new Set<string>();

function pushHistoryFromBatch(payload: AgentAnalysisPayload) {
  // 仅成功 LLM 生成才进 buffer。cache 命中（source: "cache"）和 static-fallback 不进。
  if (payload.source === "cache" || payload.source === "static-fallback") return;

  payload.stream.forEach((item, index) => {
    const id = `${payload.generatedAt}-${item.agentId}-${index}`;
    if (seenIds.has(id)) return; // dedup by id

    const entry: HistoryMessageEntry = {
      id,
      generatedAt: payload.generatedAt,
      agentId: item.agentId,
      content: item.content,
      tickerSnapshot: payload.tickers,
      source: payload.source as "minimax" | "deepseek" | "claude",
    };
    historyBuffer.push(entry);
    seenIds.add(id);
  });

  // ring buffer trim
  if (historyBuffer.length > HISTORY_BUFFER_MAX_MESSAGES) {
    const trimCount = historyBuffer.length - HISTORY_BUFFER_MAX_MESSAGES;
    const removed = historyBuffer.slice(0, trimCount);
    historyBuffer = historyBuffer.slice(trimCount);
    removed.forEach((e) => seenIds.delete(e.id));
  }
}

export function getHistoryMessages(limit: number): HistoryMessageEntry[] {
  const safe = Math.max(1, Math.min(limit, HISTORY_BUFFER_MAX_MESSAGES));
  return historyBuffer.slice(-safe);
}

export function getNewestGeneratedAt(): number | null {
  if (historyBuffer.length === 0) return null;
  return historyBuffer[historyBuffer.length - 1].generatedAt;
}
```

### 4.2 在 `refreshAnalysis` 成功路径调用 pushHistoryFromBatch

```ts
async function refreshAnalysis(): Promise<AgentAnalysisPayload> {
  const { tickers } = await getMarketTickers();
  const prompt = buildPrompt(tickers);

  for (const provider of PROVIDERS) {
    try {
      const text = await provider.call(prompt);
      const parsed = parseAnalysisJson(text);
      // V3 修订: generatedAt 移到 parse 成功之后取，反映 LLM 真实生成完成时刻
      // 不在函数开头取——provider 调用可能耗时 5s 或失败切换，会让字段语义变脏
      const generatedAt = Date.now();
      const value: AgentAnalysisPayload = {
        ...validateAnalysis(parsed, tickers),
        generatedAt, // ← LLM 实际生成完成时间
        servedAt: generatedAt, // ← 首次响应 = generatedAt
        source: provider.name,
      };
      liveCache = {
        value,
        freshUntil: generatedAt + FRESH_TTL_MS,
        staleUntil: generatedAt + STALE_TTL_MS,
      };
      pushHistoryFromBatch(value); // ← 写入历史
      return value;
    } catch (error) {
      /* fallback */
    }
  }
  // static fallback / cache fallback paths 不写入历史
  // ...
}

// cache hit 时只更新 servedAt:
export async function getAgentAnalysis(): Promise<AgentAnalysisPayload> {
  const now = Date.now();
  if (liveCache && liveCache.freshUntil > now) {
    return { ...liveCache.value, source: "cache", servedAt: now }; // generatedAt 保持原值
  }
  if (liveCache && liveCache.staleUntil > now) {
    if (!backgroundRefreshInFlight) {
      backgroundRefreshInFlight = true;
      void refreshAnalysis().finally(() => {
        backgroundRefreshInFlight = false;
      });
    }
    return { ...liveCache.value, source: "cache", servedAt: now }; // generatedAt 保持原值
  }
  return await refreshAnalysis();
}
```

**核心**：cache hit 路径只更新 `servedAt`，`generatedAt` 永远是 LLM 真实生成时刻。前端用 `generatedAt` 做去重 / 排序 / 新增判断。

---

## 5. 任务 B — `/api/agents/history` route（修订 R7）

### 5.1 新建 `src/app/api/agents/history/route.ts`

```ts
import { NextResponse } from "next/server";
import { getHistoryMessages, getNewestGeneratedAt } from "@/lib/llmFallbackChain";

export const runtime = "nodejs"; // ring buffer 需要 in-memory，不能用 edge

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 60;

  if (Number.isNaN(limit) || limit <= 0) {
    return NextResponse.json({ error: "invalid limit" }, { status: 400 });
  }

  const entries = getHistoryMessages(limit);
  const newestGeneratedAt = getNewestGeneratedAt();

  // R7: 空响应不缓存（避免 cold start 空数组被 CDN 缓存住）
  // 非空响应短缓存 10s（同实例多用户共享，但不掩盖新写入）
  const cacheControl =
    entries.length === 0 ? "no-store" : "public, s-maxage=10, stale-while-revalidate=20";

  return NextResponse.json(
    {
      servedAt: Date.now(),
      count: entries.length,
      newestGeneratedAt,
      entries,
    },
    {
      headers: { "Cache-Control": cacheControl },
    },
  );
}
```

### 5.2 响应格式

```json
{
  "servedAt": 1712345678901,
  "count": 60,
  "newestGeneratedAt": 1712345400000,
  "entries": [
    {
      "id": "1712345400000-alpha-0",
      "generatedAt": 1712345400000,
      "agentId": "alpha",
      "content": "BTC 突破 67k 但资金费率抬头...",
      "tickerSnapshot": { "BTC": { "price": 67432.12, "change24h": 2.14 }, ... },
      "source": "minimax"
    },
    ...
  ]
}
```

注：v2 不返回 `hasMore`（因为没 load more），不接受 `since` 参数。

---

## 6. 任务 C — `useAgentHistory` hook（修订 R9）

### 6.1 新建 `src/modules/agent-watch/hooks/useAgentHistory.ts`

```ts
"use client";

// W1 修订: 必须 import useCallback / useRef，否则 fetchHistory / cancelledRef 用到时编译失败
import { useCallback, useEffect, useRef, useState } from "react";
import type { HistoryMessageEntry } from "../types"; // R9: 从模块本地 import，不从 @/lib

interface UseAgentHistoryOpts {
  enabled: boolean;
  initialLimit?: number;
}

interface AgentHistoryState {
  entries: HistoryMessageEntry[];
  isLoading: boolean;
  error: Error | null;
  refreshHistory: () => Promise<void>; // V4 修订: 暴露主动刷新接口
}

export function useAgentHistory(opts: UseAgentHistoryOpts): AgentHistoryState {
  const [entries, setEntries] = useState<HistoryMessageEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cancelledRef = useRef(false);

  const fetchHistory = useCallback(async () => {
    if (!opts.enabled) return;
    setIsLoading(true);
    try {
      const limit = opts.initialLimit ?? 60;
      const res = await fetch(`/api/agents/history?limit=${limit}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`history ${res.status}`);
      const data = (await res.json()) as { entries: HistoryMessageEntry[] };
      if (!cancelledRef.current) setEntries(data.entries);
    } catch (err) {
      if (!cancelledRef.current) setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (!cancelledRef.current) setIsLoading(false);
    }
  }, [opts.enabled, opts.initialLimit]);

  useEffect(() => {
    cancelledRef.current = false;
    void fetchHistory();
    return () => {
      cancelledRef.current = true;
    };
  }, [fetchHistory]);

  return { entries, isLoading, error, refreshHistory: fetchHistory };
}
```

V4 修订：`refreshHistory()` 在以下两个时机被父组件调用：

- `useAgentAnalysis` 切回 tab 检测到 `hasNewContent === true` 时立即调一次（让 banner 出现的同时历史已经更新）
- 用户**点击 banner** 跳转最新前再调一次（防止 stale-while-revalidate 期间又有更新）

无 `loadMore` 函数（v2 砍）。

---

## 7. 任务 D — `useAgentAnalysis` 切回 tab 行为（修订 R6）

### 7.1 修改 visibilitychange 处理

**关键**（R6 + W2）：切回时**先 fetch 再判断**，**不读闭包 `data`**——用 `latestGeneratedAtRef` 持续跟踪最新值。

```ts
const lastSeenGeneratedAtRef = useRef<number | null>(null);
const latestGeneratedAtRef = useRef<number | null>(null); // W2 修订: 跟踪最新 generatedAt 不依赖闭包
const [hasNewContent, setHasNewContent] = useState(false);

// W2: 每次 setData(payload) 之后立刻同步 latestGeneratedAtRef
// 这样 visibility handler 即使在 effect 只初始化一次的情况下也能读到最新值
function applyPayload(payload: AgentAnalysisPayload) {
  setData(payload);
  latestGeneratedAtRef.current = payload.generatedAt;
}

function onVisibilityChange() {
  const visible = !document.hidden;
  if (visible) {
    // 切回：先 fetch 再判断
    void (async () => {
      try {
        const res = await fetch("/api/agents/analysis", { cache: "no-store" });
        if (!res.ok) return;
        const fresh = (await res.json()) as AgentAnalysisPayload;
        // R6 + W2: 用 ref 比较，不读闭包 data；用 generatedAt 不用 servedAt
        if (
          lastSeenGeneratedAtRef.current !== null &&
          fresh.generatedAt > lastSeenGeneratedAtRef.current
        ) {
          setHasNewContent(true);
        }
        applyPayload(fresh);
      } catch {
        /* swallow */
      }
    })();
    startPolling();
  } else {
    // 切走：从 ref 读最新 generatedAt 写入 lastSeen，不依赖闭包 data
    if (latestGeneratedAtRef.current !== null) {
      lastSeenGeneratedAtRef.current = latestGeneratedAtRef.current;
    }
    stopPolling();
  }
}

// 实现注意：所有 fetchOnce / polling / 强制 fetch 拿到 payload 后都走 applyPayload，
// 不能直接 setData()——否则 latestGeneratedAtRef 不同步，W2 修复失效

// 暴露 hasNewContent 和 dismissNewContent 给消费者
return { data, error, isLoading, hasNewContent, dismissNewContent: () => setHasNewContent(false) };
```

注意：`hasNewContent` 是 boolean，不是数量。

---

## 8. 任务 E — `AgentWatchBoard` 数据流分层（修订 R3）

### 8.1 历史和实时分离

```tsx
function AgentWatchBoard() {
  const { t, locale } = useI18n(); // V2 修订: 必须解构 locale，否则 isZh 引用未定义
  const isZh = locale === "zh_CN";

  // 历史：消息级数组，最多 200，无 keepFivePerAgent 截断
  const { entries: historyMessages, refreshHistory } = useAgentHistory({
    enabled: isZh,
    initialLimit: 60,
  });

  // 实时：保留 PR #11 现有 typing 队列逻辑（最多 3 条 typing + 5 条/Agent 滑动窗口）
  // 但 typing queue 只是动画展示层，不和 history 混存
  const { data: latest, hasNewContent, dismissNewContent } = useAgentAnalysis({ enabled: isZh });
  const [liveQueue, setLiveQueue] = useState<AgentWatchMessage[]>([]);

  // V4 修订: hasNewContent 变 true 时立刻刷一次历史，让 banner 出现时背后已经有最新数据
  useEffect(() => {
    if (hasNewContent) void refreshHistory();
  }, [hasNewContent, refreshHistory]);

  // latest 来一份新 batch 时，触发 typing 动画 + push 到 liveQueue
  useEffect(() => {
    if (!latest) return;
    // V5 修订: liveQueue message id 必须用 `${latest.generatedAt}-${agentId}-${index}`
    // 不能继续用 PR #11 的 ${data.ts}-${agentId}-${index}（ts 字段已废弃，且 generatedAt 才是稳定的去重 key）
    // 这样 history entry 和 live entry id 一致，mergeHistoryAndLive 的 dedup 才能生效
    const newMessages: AgentWatchMessage[] = latest.stream.map((item, index) => ({
      id: `${latest.generatedAt}-${item.agentId}-${index}`,
      agentId: item.agentId,
      content: item.content,
      timestamp: latest.generatedAt,
    }));
    // 现有 PR #11 typing 动画时序逻辑保留——逐条 typing 后追加，期间显示 TypingIndicator
    // liveQueue 用 keepFivePerAgent 限制（只作用于 live 路径，不截断 history）
    // ... 详细时序看 PR #11 AgentWatchBoard.tsx 现有 useEffect 实现
  }, [latest]);

  // 合并 history + liveQueue（history 在前，live 在后）
  // 用 generatedAt + agentId + content 做 dedup（防止 history 已经有的 message 又出现在 live）
  const combinedMessages = mergeHistoryAndLive(historyMessages, liveQueue);

  const messageStreamRef = useRef<MessageStreamHandle>(null);

  return (
    <>
      <CoinTickerStrip />
      <TopicHeader />

      <NewContentBanner
        visible={hasNewContent}
        onDismiss={dismissNewContent}
        onJumpToLatest={async () => {
          // V4 修订: 点击 banner 前再 refresh 一次，防止 stale-while-revalidate 期间又有更新
          await refreshHistory();
          messageStreamRef.current?.scrollToLatest();
          dismissNewContent();
        }}
      />

      <MessageStream ref={messageStreamRef} messages={combinedMessages} />
    </>
  );
}

function mergeHistoryAndLive(
  history: HistoryMessageEntry[],
  live: AgentWatchMessage[],
): AgentWatchMessage[] {
  const liveIds = new Set(live.map((m) => m.id));
  const historyAsLive: AgentWatchMessage[] = history
    .filter((h) => !liveIds.has(h.id))
    .map((h) => ({
      id: h.id,
      agentId: h.agentId,
      content: h.content,
      timestamp: h.generatedAt,
    }));
  return [...historyAsLive, ...live];
}
```

### 8.2 `keepFivePerAgent` 仅作用于 live

```ts
// before: setMessages((current) => keepFivePerAgent([...current, newMsg]));
// after:
setLiveQueue((current) => keepFivePerAgent([...current, newMsg]));
// historyMessages 永远不被 keepFivePerAgent 截断
```

---

## 9. 任务 F — `MessageStream` 简化（修订 R5）

### 9.1 砍 IntersectionObserver

```tsx
// before: useEffect 里 new IntersectionObserver(...) 监测 sentinel
// after: 直接渲染 messages 数组，无 load more
```

### 9.2 暴露 scrollToLatest（用 forwardRef）

**V6 + W3 修订（核心）**：**保留** PR #11 现有 `MessageStream` 的所有逻辑——`autoScroll` 状态、用户上滑暂停自动滚动、底部"回到最新"按钮（MessageStream.tsx:16-24, 52-63）——**只在同一个 ref 上**用 `useImperativeHandle` 增补 `scrollToLatest` 给父层调用。**不要重写组件**。

**W3 修订（DOM 结构必读）**：PR #11 当前 `MessageStream.tsx:27-35` 是**双层 DOM**：外层 `<div className="card-glow ...">` 视觉容器 + 内层 `<div className="overflow-y-auto h-[560px] ...">` 真正的滚动容器，`ref` 绑在内层 scroll div。

**实施时必须保留双层 DOM**，不要按下面 snippet 简化成单 div。imperative handle 绑现有内层 scroll ref（PR #11 已经有这个 ref，把它改名 `containerRef` + 通过 `forwardRef` 暴露即可）。改 DOM 层级会丢外层 card 视觉或内层滚动行为。

```tsx
import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from "react";

export interface MessageStreamHandle {
  scrollToLatest: () => void;
}

export const MessageStream = forwardRef<MessageStreamHandle, MessageStreamProps>(
  ({ messages, typingAgent }, ref) => {
    // ↓↓↓ 保留 PR #11 现有所有 state / effect / handler ↓↓↓
    const containerRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    // useEffect: 监听 messages 变化，autoScroll=true 时滚到底
    // onScroll handler: 检测用户主动上滑 → setAutoScroll(false)，回到底 → setAutoScroll(true)
    // "回到最新"按钮：autoScroll=false 时显示
    // ... 所有这些不动 ...
    // ↑↑↑ 保留 PR #11 现有所有逻辑 ↑↑↑

    // V6 增补: 父层（NewContentBanner 点击）能通过 ref 强制滚到最新
    useImperativeHandle(
      ref,
      () => ({
        scrollToLatest: () => {
          if (!containerRef.current) return;
          setAutoScroll(true); // ← 重置 auto-scroll，让后续新消息也跟着滚
          containerRef.current.scrollTo({
            top: containerRef.current.scrollHeight,
            behavior: "smooth",
          });
        },
      }),
      [],
    );

    return (
      <div ref={containerRef} className="..." onScroll={/* PR #11 现有 onScroll */}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {typingAgent && <TypingIndicator agentId={typingAgent} />}
        {/* "回到最新" 按钮：PR #11 现有，不动 */}
      </div>
    );
  },
);
```

注：messages 已经按 `generatedAt` 升序，最新在底部。首次渲染时容器自动滚到底（PR #11 现有 autoScroll 默认 true 行为，保留）。用户上翻历史看旧消息时不会被新消息打断（PR #11 现有 onScroll 检测，保留）。

---

## 10. 任务 G — `NewContentBanner`（修订 R4）

### 10.1 新建 `src/modules/agent-watch/components/NewContentBanner.tsx`

```tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
// W4 修订: 删 useCallback（组件内未使用，留着会被 lint unused-import 命中）
import { useEffect } from "react";
import { useI18n } from "@/i18n/I18nProvider";

interface NewContentBannerProps {
  visible: boolean;
  onDismiss: () => void; // 关闭按钮 / 30s timeout
  onJumpToLatest: () => void; // 主按钮：滚到最新 + 关闭
}

export function NewContentBanner({ visible, onDismiss, onJumpToLatest }: NewContentBannerProps) {
  const { t } = useI18n();

  // 30s 自动消失。父组件用 useCallback 稳定 onDismiss 防止 effect 重置
  useEffect(() => {
    if (!visible) return;
    const id = window.setTimeout(onDismiss, 30_000);
    return () => window.clearTimeout(id);
  }, [visible, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <div className="sticky top-2 z-30 flex justify-center" aria-live="polite">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 rounded-full border border-[#7c5cff]/30 bg-[#7c5cff]/15 backdrop-blur-md"
          >
            <button
              type="button"
              onClick={onJumpToLatest}
              className="flex items-center gap-2 rounded-l-full px-4 py-1.5 text-xs font-semibold text-[#c4b0ff] transition-colors hover:bg-[#7c5cff]/25"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b49cff] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7c5cff]" />
              </span>
              {t.agentWatch.banner.newContent}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t.agentWatch.banner.dismissAriaLabel}
              className="rounded-r-full px-3 py-1.5 text-xs text-white/50 transition-colors hover:text-white/80"
            >
              ✕
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
```

注：v2 文案是固定的"有新内容 →"——i18n key `t.agentWatch.banner.newContent` 不含数量占位符。

---

## 11. 任务 H — 时间格式化（修订 R8）

### 11.1 新建 `src/modules/agent-watch/utils/formatTime.ts`

```ts
import { isLocale } from "@/i18n/locales";
import type { Locale } from "@/i18n/types";

export function formatAgentMessageTime(timestamp: number, locale: Locale): string {
  // locale 形如 zh_CN，转 BCP-47 zh-CN
  const bcp47 = locale.replace("_", "-");

  try {
    return new Intl.DateTimeFormat(bcp47, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(timestamp);
  } catch {
    // 极端 fallback
    const d = new Date(timestamp);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
}
```

### 11.2 修改 `MessageBubble.tsx`

```tsx
import { formatAgentMessageTime } from "../utils/formatTime";

// before: const formatTime = (ts) => `${date.getHours()}:${...}`;
// after:
const { locale } = useI18n();
const timeLabel = formatAgentMessageTime(message.timestamp, locale);
```

---

## 12. 任务 I — i18n（修订 R4 简化）

### types.ts

```ts
agentWatch: {
  // ... 现有字段
  banner: {
    newContent: string; // "有新内容 →"
    dismissAriaLabel: string;
  }
  emptyHistory: string; // 空 buffer 时显示
  loadingHistory: string;
}
```

### zh_CN.json

```json
"agentWatch": {
  // ... 现有字段
  "banner": {
    "newContent": "有新内容 →",
    "dismissAriaLabel": "关闭新内容提示"
  },
  "emptyHistory": "历史正在积累中，等下一批 Agent 分析进来",
  "loadingHistory": "加载中..."
}
```

其他 9 语：占位英文文案。

### V8 + W5 修订：明确替换 PR #11 现有硬编码点 + 文案传入方式

**`emptyHistory` 替换位置**：`src/modules/agent-watch/components/MessageStream.tsx` L37-40 当前空消息状态硬编码中文 `"暂无消息"` 之类。

**W5 修订（文案传入方式）**：`MessageStream` **不在内部** `useI18n()`——改为接收 `emptyLabel?: string` prop，由父组件 `AgentWatchBoard` 从 `useI18n()` 取 `t.agentWatch.emptyHistory` 后传入：

```tsx
// MessageStream props 扩展
interface MessageStreamProps {
  messages: AgentWatchMessage[];
  typingAgent: AgentId | null;
  emptyLabel?: string;        // W5 新增，由父组件传入空态文案
}

// 组件内：
{messages.length === 0 ? (
  <div className="flex h-full items-center justify-center text-sm text-white/40">
    {emptyLabel ?? "暂无消息"}   // fallback 留 PR #11 中文，避免传不进时白屏
  </div>
) : (
  /* 渲染 messages */
)}

// AgentWatchBoard 调用方：
<MessageStream
  ref={messageStreamRef}
  messages={combinedMessages}
  typingAgent={typingAgent}
  emptyLabel={t.agentWatch.emptyHistory}   // 父组件统一传入
/>
```

**`loadingHistory` 替换位置**：`src/modules/agent-watch/AgentWatchBoard.tsx` L92-94 当前 loading 态硬编码中文——`AgentWatchBoard` 本身已经在 `useI18n()` 上下文里，直接 `{t.agentWatch.loadingHistory}` 替换即可，不需要 prop 传递。

实现时在这两个文件 grep 现有硬编码字符串确认替换点。新增字段加了但不替换的话 type 校验过但 UI 仍硬编码——和 v4 多语字典纪律不一致。

---

## 13. 实现前置 grep gate（修订 R11）

Airy 开工前**必须验证** task-05 已经合到当前 main / PR 分支：

```sh
#!/bin/bash
# V7 修订: 任一缺失立即 exit 1，让 CI / 手动跑都真正 fail，不只是打印 echo
set -e
git pull origin feature/act1-5-watch-page-01
grep -q "FRESH_TTL_MS" src/lib/llmFallbackChain.ts || { echo "FAIL: task-05 FRESH_TTL_MS missing"; exit 1; }
grep -q "STALE_TTL_MS" src/lib/llmFallbackChain.ts || { echo "FAIL: task-05 STALE_TTL_MS missing"; exit 1; }
grep -q "backgroundRefreshInFlight" src/lib/llmFallbackChain.ts || { echo "FAIL: task-05 backgroundRefreshInFlight missing"; exit 1; }
grep -q "visibilitychange" src/modules/agent-watch/hooks/useAgentAnalysis.ts || { echo "FAIL: task-05 visibilitychange missing"; exit 1; }
echo "OK: task-05 prerequisites all present"
```

任一 FAIL → 退出码非 0，自动停止后续操作。手动跑时看到 FAIL 也立即停手，告诉 Dan task-05 还没合。

---

## 14. 验收（修订 R12）

### Grep 验证

- [ ] `grep "HistoryMessageEntry" src/modules/agent-watch/types.ts` 存在
- [ ] `grep "generatedAt" src/lib/llmFallbackChain.ts` 至少 4 处（pushHistory / refreshAnalysis / cache hit / stale hit）
- [ ] `grep "servedAt" src/lib/llmFallbackChain.ts` 替代旧 `ts`
- [ ] `grep "pushHistoryFromBatch" src/lib/llmFallbackChain.ts` 在 LLM 成功路径调用，不在 cache / static-fallback 路径
- [ ] `grep "IntersectionObserver" src/modules/agent-watch/components/MessageStream.tsx` **无输出**（v2 砍）
- [ ] `grep "loadMore\|hasMore" src/modules/agent-watch/` **无输出**（v2 砍）
- [ ] `grep "{count}\|{minutes}" src/i18n/dicts/zh_CN.json` **无输出**（banner v2 不带数量占位）
- [ ] `grep "Intl.DateTimeFormat" src/modules/agent-watch/utils/formatTime.ts` 存在
- [ ] `grep "from \"@/lib/llmFallbackChain\"" src/modules/agent-watch/hooks/` **无输出**（R9：前端 hook 不反向 import lib）

### 类型 / 构建

- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 成功

### 行为测试（修订 R12，可观察 logs / API 响应，不删 env）

**场景 1：first batch 后历史开始累积**

1. 访问 `/zh_CN/agent`，等 first analysis 调用成功
2. 调 `/api/agents/history` 看 entries 是否有 3 条（来自第一批 batch）
3. 验证每条 `id` 格式 `${generatedAt}-${agentId}-${index}`，`source` ∈ {minimax, deepseek, claude}（不是 cache 也不是 static-fallback）

**场景 2：cache hit 不进 history**

1. 等 fresh cache 命中（第二次 polling 应该返回 source: "cache"）
2. 调 `/api/agents/history`，count 应该和上次相同（cache hit 没新增）

**场景 3：切回 tab 提示新内容**

1. 在 `/agent` 停留，等至少 1 batch 进 history
2. 切到其他 tab，等 6 分钟（足够触发新 LLM 生成）
3. 切回 → banner 显示"有新内容 →"
4. 点击 → 滚到最新 + banner 消失
5. 30s 不点击 → banner 自动消失

**场景 4：empty history graceful**

1. 调 `/api/agents/history` 在 cold start 后立即调（buffer 还空）
2. 返回 `entries: []` + `Cache-Control: no-store`（curl -i 看响应头）
3. 前端显示 `agentWatch.emptyHistory` 文案

**场景 5：generatedAt 不被 cache 改写**

1. 看 console log / Network response
2. 第一次 LLM 调用：`generatedAt = 1712345400000` `servedAt = 1712345400123`
3. 60s 后 cache 命中：`generatedAt = 1712345400000`（不变）`servedAt = 1712345460000`（更新）
4. 5min 后新 LLM 调用：`generatedAt = 1712345700000`（更新）`servedAt = 1712345700100`

### 不退化

- [ ] middleware 非中文 redirect 仍生效
- [ ] task-05 stale-while-revalidate 行为不变
- [ ] Hero 中文 dynamic pool 注入仍生效
- [ ] 4 币 modal 数据正常

---

## 15. 风险 / 注意（修订后）

1. **buffer 内存占用**：每条 ~500 字节，200 条 ≈ 100KB。可忽略。
2. **多实例 buffer 不一致**：实例 A 和实例 B 各有自己的 buffer。用户随机命中不同实例可能看到稍有差异的历史 head。**v1 acceptable**——不阻塞核心 UX，反而每个实例都在累积内容。
3. **cold start empty history**：实例首次启动时 buffer 空。文案 `emptyHistory` 处理：显示"历史正在积累中"。后端 first batch 后开始填充，5-10s 内用户感知到内容。**不要给虚假承诺"必有 60 条"**。
4. **gap 检测仅 boolean**：v2 不显示具体数量，避免 task-05 stale-while-revalidate 后频率不稳定造成数量错算。用户体验上"有新内容"足够清晰。
5. **historyMessages 不被 keepFivePerAgent 截断**：所以同一 Agent 历史可能 30+ 条。前端 scroll 性能：200 条 React node 渲染无压力（每条 < 1KB DOM）。
6. **`/api/agents/history` 未做 SSR**：mount 后 client-side fetch。首次进入页面有 < 1s 空白后内容填充——v1 acceptable。

---

## 16. 提交

```sh
git checkout feature/act1-5-watch-page-01
git pull origin feature/act1-5-watch-page-01
# 实现前先跑 grep gate（Section 13）
# 实现 8 个改动点（数据模型 / buffer / API / hooks / UI / 时间格式 / banner / i18n）
git add src/modules/agent-watch/types.ts \
        src/lib/llmFallbackChain.ts \
        src/app/api/agents/analysis/route.ts \
        src/app/api/agents/history/route.ts \
        src/modules/agent-watch/hooks/useAgentHistory.ts \
        src/modules/agent-watch/hooks/useAgentAnalysis.ts \
        src/modules/agent-watch/AgentWatchBoard.tsx \
        src/modules/agent-watch/components/MessageStream.tsx \
        src/modules/agent-watch/components/MessageBubble.tsx \
        src/modules/agent-watch/components/NewContentBanner.tsx \
        src/modules/agent-watch/utils/formatTime.ts \
        src/i18n/types.ts src/i18n/dicts/*.json
git commit -m "feat(act1-5): message-level history buffer + new-content banner (v2)

- Type: HistoryMessageEntry message-level entries (was batch-level in v1)
- Type: AgentAnalysisPayload split ts → generatedAt + servedAt
- Backend: ring buffer 200 messages, push only on real LLM success
- Backend: GET /api/agents/history?limit=N (no since, no hasMore in v2)
- Backend: empty response no-store, non-empty short cache 10s
- Frontend: useAgentHistory preloads 60 messages on mount
- Frontend: useAgentAnalysis visibility-fetch-then-judge (no race)
- Frontend: AgentWatchBoard splits historyMessages and liveQueue
- Frontend: NewContentBanner (boolean has-new, no count display)
- Frontend: keepFivePerAgent only applies to liveQueue
- Frontend: formatAgentMessageTime via Intl.DateTimeFormat
- v2 dropped: load more, IntersectionObserver, banner count, since param

Closes Codex cross-review P0 #1-4 + P1 #5-9 (see PR #12)"
git push origin feature/act1-5-watch-page-01
```

PR #11 自动更新。

---

## 17. v4 收口声明

**本 v4 是最终版，不再走副审循环**。

副审历史：

- v1 → 一次副审（PR #12）找到 13 条问题 → 改出 v2
- v2 → 二次副审（PR #13）找到 8 条问题 → 改出 v3
- v3 → 三次副审（PR #14）NO-GO + 5 条阻塞清单 → F 直接落 v4

v4 已在文件顶部 v4 修订记录里逐条应用三次副审 5 条阻塞清单。Codex 实现时按本 spec 执行即可，不需要继续副审。

如果实现过程中发现 spec 有错（比如某处 snippet 仍编译失败），停手 → 告诉 Dan → F 修订 spec → 不要自己猜。

---

_维护者: F_
_创建: 2026-04-26_
_v2 修订: 2026-04-28（基于 PR #12 副审）_
_v3 修订: 2026-04-28（基于 PR #13 副审）_
_v4 修订: 2026-04-28（基于 PR #14 三次副审收口，**最终版**）_
_执行者: Codex（编译断层风险高，需要一次性打通类型链路）_
