# Task 05 — Act 1.5 LLM Cache 策略优化 + DeepSeek 接入 + 前端 idle detection

> **目标**：把 LLM 调用频率从"每用户每分钟 1 次"降到"全站每 5 分钟最多 1 次（且无人时不调）"，同时把 DeepSeek 真正激活作为 minimax 的兜底。
>
> **执行者**：Airy
>
> **基于**：PR #11 (`feature/act1-5-watch-page-01`) 的 commit d8cc487
>
> **分支**：在同一分支 `feature/act1-5-watch-page-01` 上加 commit，不开新分支。

---

## 1. 背景

### 当前实现的浪费点

`src/lib/llmFallbackChain.ts` 里 `LLM_CACHE_TTL_MS = 60_000`。前端 `useAgentAnalysis` 每 60 秒 polling 一次 `/api/agents/analysis`，所以单用户在线 1 小时会触发 60 次 LLM 调用。

按当前 minimax 月成本估算 ¥0.014/次，1 用户在线 8 小时/天 = ¥6.7/天 = **~¥200/月**。"外部人不多"场景下浪费明显。

### 优化目标

- LLM 调用频率独立于"在线用户数"——不论 1 个还是 100 个用户在线，每 5 分钟最多调用 1 次 LLM
- 用户视角永远瞬时响应（fresh 或 stale 都不让用户等 LLM）
- 用户全部离开后停止所有 LLM 调用（已经是当前行为，保持）
- 用户切走 tab（minimize / 切到其他 tab）时前端暂停 polling，省客户端资源 + 减少多人在线时的 cache miss 压力

### DeepSeek 现状

`callDeepSeek` 函数已经实现，env 检查也写了（`if (!apiKey) throw "missing DEEPSEEK_API_KEY"`），但 Vercel 还没配 DeepSeek key——所以现在 minimax 挂时直接跳过 deepseek，到 claude（也没 key）也跳过，到静态 fallback。本任务把 deepseek 真正激活。

---

## 2. 修改清单

| 文件                                                | 改动                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| `src/lib/llmFallbackChain.ts`                       | 实现 stale-while-revalidate cache + 启动时 filter 缺 key 的 provider |
| `src/modules/agent-watch/hooks/useAgentAnalysis.ts` | 加 visibilitychange 监听，tab 隐藏时暂停 polling                     |

不改 i18n / 不改 UI / 不改 spec / 不动 LLM prompt / 不动 fallback chain 的 provider 顺序。

---

## 3. 任务 A — Cache 策略升级（stale-while-revalidate）

### 3.1 改 cache TTL 常量

`src/lib/llmFallbackChain.ts` 顶部：

```ts
// before
const LLM_CACHE_TTL_MS = 60_000;
const STALE_SUCCESS_TTL_MS = 5 * 60_000; // 这个常量当前是给"全 provider 挂掉时"用的

// after
const FRESH_TTL_MS = 5 * 60_000; // 5 分钟内：直接返回 cache，不触发 LLM
const STALE_TTL_MS = 30 * 60_000; // 5-30 分钟：返回 stale + 后台 refresh
// >30 分钟：完全过期，用户同步等待 LLM
const PROVIDER_FAILURE_FALLBACK_TTL_MS = 30 * 60_000; // 全 provider 挂掉时多撑久点
```

### 3.2 改 cache 数据结构

`liveCache` 当前只有 `expiresAt`，加 `staleUntil`：

```ts
type LiveCacheEntry = {
  value: AgentAnalysisPayload;
  freshUntil: number;
  staleUntil: number;
};

let liveCache: LiveCacheEntry | null = null;
```

### 3.3 改 getAgentAnalysis 主函数

完整重写 `getAgentAnalysis`：

```ts
let backgroundRefreshInFlight = false;

export async function getAgentAnalysis(): Promise<AgentAnalysisPayload> {
  const now = Date.now();

  // Fresh hit: 直接返回，不触发 LLM
  if (liveCache && liveCache.freshUntil > now) {
    return { ...liveCache.value, source: "cache", ts: now };
  }

  // Stale hit: 立即返回 stale + 后台异步触发 refresh
  if (liveCache && liveCache.staleUntil > now) {
    if (!backgroundRefreshInFlight) {
      backgroundRefreshInFlight = true;
      // 不 await——让用户立即拿 stale 数据
      void refreshAnalysis().finally(() => {
        backgroundRefreshInFlight = false;
      });
    }
    return { ...liveCache.value, source: "cache", ts: now };
  }

  // 完全过期: 用户同步等待
  return await refreshAnalysis();
}

async function refreshAnalysis(): Promise<AgentAnalysisPayload> {
  const now = Date.now();
  const { tickers } = await getMarketTickers();
  const prompt = buildPrompt(tickers);

  for (const provider of PROVIDERS) {
    try {
      const text = await provider.call(prompt);
      const parsed = parseAnalysisJson(text);
      const value = {
        ...validateAnalysis(parsed, tickers),
        source: provider.name,
      } satisfies AgentAnalysisPayload;
      liveCache = {
        value,
        freshUntil: now + FRESH_TTL_MS,
        staleUntil: now + STALE_TTL_MS,
      };
      return value;
    } catch (error) {
      console.warn(
        `[claw42] ${provider.name} analysis fallback`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // 全部 provider 挂掉：用旧 cache 兜底（即使过 staleUntil 也用，最长 30 分钟）
  if (liveCache) {
    const extendedExpire = now + PROVIDER_FAILURE_FALLBACK_TTL_MS;
    if (extendedExpire > now) {
      console.warn("[claw42] all providers failed, using last known cache");
      return { ...liveCache.value, source: "cache", ts: now, tickers };
    }
  }

  // 真没了：静态 fallback
  console.warn("[claw42] using static analysis fallback");
  return buildStaticFallback(tickers);
}
```

### 3.4 启动时 filter 缺 key 的 provider

替换当前 `PROVIDERS` 常量：

```ts
// before
const PROVIDERS: Array<{ name: ProviderName; call: (prompt: string) => Promise<string> }> = [
  { name: "minimax", call: callMiniMax },
  { name: "deepseek", call: callDeepSeek },
  { name: "claude", call: callClaude },
];

// after
type ProviderEntry = {
  name: ProviderName;
  call: (prompt: string) => Promise<string>;
  envKey: string;
};

const ALL_PROVIDERS: ProviderEntry[] = [
  { name: "minimax", call: callMiniMax, envKey: "MINIMAX_API_KEY" },
  { name: "deepseek", call: callDeepSeek, envKey: "DEEPSEEK_API_KEY" },
  { name: "claude", call: callClaude, envKey: "ANTHROPIC_API_KEY" },
];

const PROVIDERS = ALL_PROVIDERS.filter((p) => Boolean(process.env[p.envKey]));

if (PROVIDERS.length === 0) {
  console.warn("[claw42] no LLM provider configured, will use static fallback only");
} else {
  console.info(`[claw42] LLM chain: ${PROVIDERS.map((p) => p.name).join(" → ")}`);
}
```

效果：

- minimax + deepseek 两个 key 都配了 → console 启动时打 `LLM chain: minimax → deepseek`
- 如果未来加 claude key → 重新部署后自动变成三层 chain
- 缺 key 的 provider 完全不在数组里，不再多打"missing key" warning

---

## 4. 任务 B — 前端 idle detection

### 4.1 修改 useAgentAnalysis

`src/modules/agent-watch/hooks/useAgentAnalysis.ts` 加 `visibilitychange` 监听：

```ts
import { useEffect, useState, useRef } from "react";
// ...

export function useAgentAnalysis(opts: { enabled: boolean }) {
  const [data, setData] = useState<AgentAnalysisPayload | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const isVisibleRef = useRef(typeof document !== "undefined" ? !document.hidden : true);

  useEffect(() => {
    if (!opts.enabled) return;

    let cancelled = false;

    async function fetchOnce() {
      if (cancelled || !isVisibleRef.current) return;
      setIsLoading(true);
      try {
        const res = await fetch("/api/agents/analysis", { cache: "no-store" });
        if (!res.ok) throw new Error(`analysis ${res.status}`);
        const payload = (await res.json()) as AgentAnalysisPayload;
        if (!cancelled) {
          setData(payload);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    function startPolling() {
      if (intervalRef.current !== null) return;
      // 立即拉一次再轮询
      void fetchOnce();
      intervalRef.current = window.setInterval(fetchOnce, 60_000);
    }

    function stopPolling() {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    function onVisibilityChange() {
      const visible = !document.hidden;
      isVisibleRef.current = visible;
      if (visible) {
        startPolling(); // 切回来立即 fetch + 恢复 polling
      } else {
        stopPolling(); // 切走暂停 polling
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    if (isVisibleRef.current) startPolling();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopPolling();
    };
  }, [opts.enabled]);

  return { data, error, isLoading };
}
```

### 4.2 行为变化

| 场景                             | 当前行为                   | 改后行为                                                     |
| -------------------------------- | -------------------------- | ------------------------------------------------------------ |
| 用户在 `/agent` 页面看 1 小时    | 60 次 API 请求 + 60 次 LLM | 60 次 API 请求，~12 次 LLM（5min cache）+ 后台 stale refresh |
| 用户切到其他 tab 30 分钟         | 30 次 API 请求             | 0 次 API 请求                                                |
| 用户切回来                       | 等下一个 60s tick 才 fetch | 立即 fetch + 恢复 polling                                    |
| Hero 页面用户停留（中文 locale） | 持续 polling               | 同样 idle detection（同一个 hook）                           |

---

## 5. Vercel Env Var 更新（执行交付时告知 Dan）

确认 Dan 在 Vercel Dashboard `claw42-site` project Settings → Environment Variables 配齐：

| 变量                | 状态     | 备注                    |
| ------------------- | -------- | ----------------------- |
| `MINIMAX_API_KEY`   | 必配     | primary                 |
| `DEEPSEEK_API_KEY`  | **新加** | secondary（本任务激活） |
| `MINIMAX_MODEL`     | 选配     | 默认 `MiniMax-Text-01`  |
| `MINIMAX_ENDPOINT`  | 选配     | 默认国际版              |
| `ANTHROPIC_API_KEY` | 不配     | 跳过 claude provider    |
| `COINGECKO_API_KEY` | 不配     | free tier               |

**Airy 在 PR 描述里提醒 Dan**：

- 加 `DEEPSEEK_API_KEY` 到所有三个 scope（Production / Preview / Development）
- 配完后触发 Vercel 重新 build，验证 console log 出现 `LLM chain: minimax → deepseek`

---

## 6. 验收

### 6.1 Grep 验证

- [ ] `grep "FRESH_TTL_MS\|STALE_TTL_MS" src/lib/llmFallbackChain.ts` 三个常量都有
- [ ] `grep "backgroundRefreshInFlight\|refreshAnalysis" src/lib/llmFallbackChain.ts` 后台 refresh 函数存在
- [ ] `grep "ALL_PROVIDERS" src/lib/llmFallbackChain.ts` filter 模式生效
- [ ] `grep "visibilitychange" src/modules/agent-watch/hooks/useAgentAnalysis.ts` 监听存在

### 6.2 类型 / 构建

- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 成功
- [ ] `npm run lint` 无新增错误

### 6.3 行为测试

**手动测试方法**（Vercel preview 上跑）：

1. 打开 `/zh_CN/agent`，等 first batch 加载（~3-5s）
2. 观察 Network tab：第 1 次 `/api/agents/analysis` 请求 `source: "minimax"` 或 `"deepseek"`
3. 等 60s 自动 polling：第 2 次请求 `source: "cache"`（fresh 命中）
4. 等 6 分钟（fresh 5min + 余量）：下一次请求 `source: "cache"` + 后台触发新 LLM（看 Vercel logs）
5. 切到其他 tab（document.hidden = true）30 秒：Network tab 不再有新请求
6. 切回来：立即一次 `/api/agents/analysis` 请求
7. 临时 unset MINIMAX_API_KEY env（在 Vercel 删除后 redeploy） → 启动 logs 应该显示 `LLM chain: deepseek`

### 6.4 不退化

- [ ] middleware 非中文 redirect 仍生效
- [ ] Hero 中文 dynamic pool 注入仍生效
- [ ] 4 币 modal 数据正常
- [ ] static fallback 在所有 provider 都缺 key 时仍能渲染

---

## 7. 提交

```
git checkout feature/act1-5-watch-page-01
git pull origin feature/act1-5-watch-page-01
# 实现两个任务
git add src/lib/llmFallbackChain.ts src/modules/agent-watch/hooks/useAgentAnalysis.ts
git commit -m "perf(act1-5): stale-while-revalidate cache + idle detection + provider env filter

- llmFallbackChain: 5min fresh + 30min stale (background revalidate on stale hit)
- llmFallbackChain: PROVIDERS filtered by env at boot, log chain on cold start
- useAgentAnalysis: visibilitychange listener, pause polling when tab hidden
- DeepSeek now active as secondary fallback when MINIMAX_API_KEY also configured"
git push origin feature/act1-5-watch-page-01
```

PR #11 自动更新。

---

## 8. 风险 / 注意

1. **stale 期 30 分钟 vs 行情时效性**：30 分钟前的行情评论显示给当前用户——但当前 ticker 数据是实时的（30s cache）。Agent 评论会落后于实际价格——这是可接受的（Agent 是分析视角，不是高频报价）。如果体验差再缩短 STALE_TTL 到 15 分钟。
2. **后台 refresh 失败**：`refreshAnalysis()` 在后台执行，如果失败用户已经拿到 stale 数据，但 cache 不会更新——下一次请求仍然走 stale until staleUntil 真正过期。这是 acceptable—— 比让用户等 LLM 调用强。
3. **visibilitychange 兼容性**：所有现代浏览器都支持，IE 11 不支持但 claw42 不需要支持 IE。
4. **多实例 cache 不共享**：Vercel serverless 多实例时，cache 是 per-instance 的——意味着每个 instance 第一次都需要调一次 LLM。生产监控发现命中率低（比如冷启动多）再考虑加 Vercel KV / Upstash Redis。本任务不上 Redis。

---

_维护者: F_
_创建: 2026-04-26_
_执行者: Airy_
