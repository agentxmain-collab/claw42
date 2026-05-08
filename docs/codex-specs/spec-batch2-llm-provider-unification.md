# Spec: claw42 v2.0 Batch 2 — LLM Provider Unification

## 目标

按 Q5 决策 **彻底废弃 `llmFallbackChain.ts`**，统一 5 家 LLM provider 抽象 + generic `generateText` adapter + budget tracker / cache / log 接 KV + `/api/agents/analysis` 改造调 SignalEngine grounding。

| Task | 内容                                                         | PR 分支                            | 依赖                                     |
| ---- | ------------------------------------------------------------ | ---------------------------------- | ---------------------------------------- |
| T2a  | Provider core + shared interface（5 家 + stub fallback）     | `feature/v2-t2a-provider-core`     | 无（Batch 1A T1-core merge main 后即可） |
| T2b  | generic `generateText` adapter（chat/news/translation 桥梁） | `feature/v2-t2b-generate-text`     | T2a                                      |
| T2c  | Structured signal provider integration                       | `feature/v2-t2c-signal-provider`   | T2a                                      |
| T2d  | Migrate import sites + delete `llmFallbackChain.ts`          | `feature/v2-t2d-migrate-delete`    | T2a + T2b + T2c                          |
| T3   | `/api/agents/analysis` 改造 + SignalEngine grounding         | `feature/v2-t3-analysis-grounding` | T2a + T2c                                |

T2a 必须最先，其他依赖图见上。**T2b/T2c 可并发**。**T2d 等 T2a/b/c 全 merge 后再启**（要确认所有引用迁移完才能删 file）。

## 共同约束

继承 `spec-batch1a-signalengine-internalization.md`（worktree / 临时账号 / 不动 dirty / Next 14 React 18 兼容 / 无新外部依赖）。

**注意**：本 spec 假设 task-18 PR #27 + Hero Stage 1 PR #42 已 merge main（sweep-2 完成后）。如果未 merge，T2d / T3 需要等。

### 依赖政策

不需要新外部依赖（5 家 provider 客户端用现有 fetch / OpenAI SDK / Anthropic SDK，T1-core 内化时已就位）。

### LLM Provider 链锁定（locked-v3 § 6.3）

```typescript
LLM_PROVIDER_CHAIN = {
  primary: "deepseek-chat", // V4 Flash, $0.14/$0.28 per M tokens
  fallback: "minimax",
  emergency: "claude-haiku",
};

// 备用（默认不启用）：
ALTERNATIVE_PROVIDERS = ["openai", "anthropic"];

LLM_MONTHLY_BUDGET_USD = 200;
LLM_BUDGET_ALARM_THRESHOLD = 0.8;
LLM_BUDGET_AUTOPAUSE_THRESHOLD = 0.95;
```

env 变量（生产时配置）：

- `DEEPSEEK_API_KEY` (required)
- `MINIMAX_API_KEY` (required for fallback)
- `ANTHROPIC_API_KEY` (required for emergency)
- `OPENAI_API_KEY` (optional)
- `LLM_PRIMARY_PROVIDER` (default: `deepseek-chat`)

dev 模式无 key 时 fallback 到 stub provider（不抛异常，返回 deterministic mock）。

---

## T2a: Provider Core + Shared Interface

### 文件

```
src/lib/llm/
├── providers/
│   ├── types.ts                    # 新建：LLMProvider interface
│   ├── index.ts                    # 新建：工厂 + chain orchestration
│   ├── deepseek-chat.ts            # 新建：V4 Flash 适配
│   ├── minimax.ts                  # 新建（迁移现有 minimax 实现，从 llmFallbackChain.ts 拆出）
│   ├── claude-haiku.ts             # 新建
│   ├── openai.ts                   # 新建（备用，env 控制启用）
│   ├── anthropic.ts                # 新建（备用）
│   └── stub.ts                     # 新建（dev 无 key 时 deterministic fallback）
└── budget-tracker.ts                # 新建（替代 src/lib/signal-engine/llm-budget-tracker.ts stub）
```

### Interface 定义（types.ts）

```typescript
export interface LLMProvider {
  readonly id: ProviderId;
  readonly displayName: string;

  /**
   * 单次文本生成。返回 plain text + metadata。
   * 上层（generateText / chatOrchestrator）负责 prompt 拼接。
   */
  generate(input: LLMInput): Promise<LLMOutput>;

  /**
   * 健康检查。dev 用 stub 永远返回 true；生产用 ping endpoint 或 cached health.
   */
  isHealthy(): Promise<boolean>;

  /**
   * Cost estimate (per LLM input). 用于 budget tracker 预估。
   */
  estimateCost(input: LLMInput): { inputUsd: number; outputUsd: number };
}

export type ProviderId =
  | "deepseek-chat"
  | "minimax"
  | "claude-haiku"
  | "openai"
  | "anthropic"
  | "stub";

export interface LLMInput {
  prompt: string;
  systemPrompt?: string;
  temperature?: number; // default 0.7
  maxTokens?: number; // default 800
  timeoutMs?: number; // default 10000
  cacheKey?: string; // 如果给，启用 cache
  taskTag: string; // 'chat' | 'news' | 'translation' | 'signal-structuring' | etc.
}

export interface LLMOutput {
  text: string;
  provider: ProviderId;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cached: boolean;
  // 如果 cache hit，cacheHitProvider 是原始 provider；否则 undefined
  cacheHitProvider?: ProviderId;
}
```

### Chain Orchestration（providers/index.ts）

```typescript
export async function callWithChain(input: LLMInput): Promise<LLMOutput> {
  const chain = [
    process.env.LLM_PRIMARY_PROVIDER || "deepseek-chat",
    "minimax",
    "claude-haiku",
  ] as ProviderId[];

  // Cache lookup（如果 cacheKey 给了）
  if (input.cacheKey) {
    const cached = await getFromCache(input.cacheKey);
    if (cached) return { ...cached, cached: true };
  }

  // Budget pre-check
  if (await isBudgetAutopaused()) {
    throw new BudgetExceededError("Monthly LLM budget exceeded autopause threshold");
  }

  // Try chain
  let lastError: Error | null = null;
  for (const providerId of chain) {
    try {
      const provider = getProvider(providerId);
      if (!(await provider.isHealthy())) continue;

      const output = await provider.generate(input);

      // Track budget
      await trackUsage(provider, input, output);

      // Cache
      if (input.cacheKey) await setCache(input.cacheKey, output);

      // Log
      await logCall(provider, input, output);

      return output;
    } catch (e) {
      lastError = e as Error;
      logger.warn(`LLM provider ${providerId} failed`, { error: e });
      continue;
    }
  }

  throw lastError || new Error("All LLM providers in chain failed");
}
```

### Stub Provider（dev 时 fallback）

```typescript
// providers/stub.ts
export const stubProvider: LLMProvider = {
  id: "stub",
  displayName: "Stub (deterministic mock)",

  async generate(input) {
    // Deterministic output based on input hash, useful for testing
    const hash = simpleHash(input.prompt + input.taskTag);
    return {
      text: `[STUB:${input.taskTag}:${hash}] mocked response for testing`,
      provider: "stub",
      inputTokens: Math.ceil(input.prompt.length / 4),
      outputTokens: 20,
      latencyMs: 50,
      cached: false,
    };
  },

  async isHealthy() {
    return true;
  },

  estimateCost() {
    return { inputUsd: 0, outputUsd: 0 };
  },
};
```

### Budget Tracker（升级 stub 为 KV-based）

```typescript
// budget-tracker.ts
import { kv } from "@vercel/kv";

const MONTHLY_BUDGET_USD = parseFloat(process.env.LLM_MONTHLY_BUDGET_USD || "200");

export async function trackUsage(provider: LLMProvider, input: LLMInput, output: LLMOutput) {
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  const cost = provider.estimateCost(input);
  const totalCost = cost.inputUsd + cost.outputUsd;

  // KV: budget:2026-05:deepseek-chat → cumulative cost
  const key = `budget:${month}:${provider.id}`;
  await kv.incrby(key, Math.round(totalCost * 1000)); // store as 1/1000 USD for precision

  // Total budget across providers
  await kv.incrby(`budget:${month}:_total`, Math.round(totalCost * 1000));
}

export async function getMonthlyUsage(): Promise<{ usd: number; pct: number }> {
  const month = new Date().toISOString().slice(0, 7);
  const total = (await kv.get<number>(`budget:${month}:_total`)) || 0;
  const usd = total / 1000;
  return { usd, pct: usd / MONTHLY_BUDGET_USD };
}

export async function isBudgetAutopaused(): Promise<boolean> {
  const { pct } = await getMonthlyUsage();
  return pct >= 0.95;
}

export async function shouldAlarmBudget(): Promise<boolean> {
  const { pct } = await getMonthlyUsage();
  return pct >= 0.8;
}
```

### 验收标准

- [ ] 5 个 provider 模块（deepseek-chat / minimax / claude-haiku / openai / anthropic）+ stub
- [ ] 每 provider 实现 LLMProvider interface
- [ ] `callWithChain` 工厂函数支持 fallback
- [ ] Budget tracker 写 KV（用 T1.2 已就位的 KV 抽象）
- [ ] dev 无 key 时 stub fallback 工作
- [ ] vitest 覆盖：每 provider mock 测 + chain fallback 测 + budget alarm/autopause 测
- [ ] `npm run verify:llm-providers` 跑通
- [ ] tsc + lint + build 全绿

---

## T2b: generic `generateText` Adapter

### 目标

为 chat / news / translation / daily brief 等任务提供统一文本生成入口。**所有非结构化 LLM 调用都走这个**。

### 文件

```
src/lib/llm/
├── generateText.ts                 # 新建
├── guardrails.ts                   # 新建（hasMechanicalOutput / antiMechanicalFallback 迁移过来）
└── cache.ts                        # 新建（替代 src/lib/signal-engine/llm-cache.ts stub）
```

### `generateText` 接口

```typescript
import { callWithChain } from "./providers";
import { applyGuardrails } from "./guardrails";
import { hashCacheKey } from "./cache";

export interface GenerateTextOptions {
  systemPrompt?: string;
  temperature?: number; // default 0.7
  maxTokens?: number; // default 800
  taskTag: string; // required, e.g., 'chat:agent-rebut'
  enableCache?: boolean; // default true
  cacheTTLSeconds?: number; // default 300 (5 min)
  enableGuardrails?: boolean; // default true（应用 hasMechanicalOutput 等）
}

/**
 * 统一文本生成入口。所有 chat/news/translation 调用都走这个。
 */
export async function generateText(prompt: string, options: GenerateTextOptions): Promise<string> {
  const cacheKey =
    options.enableCache !== false
      ? hashCacheKey(prompt, options.taskTag, options.systemPrompt)
      : undefined;

  const output = await callWithChain({
    prompt,
    systemPrompt: options.systemPrompt,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    timeoutMs: 10000,
    cacheKey,
    taskTag: options.taskTag,
  });

  let text = output.text;

  // Guardrails (anti-mechanical output)
  if (options.enableGuardrails !== false) {
    text = await applyGuardrails(text, options.taskTag);
  }

  return text;
}
```

### Guardrails 迁移

从 main 上的 `llmFallbackChain.ts` 迁移以下 helpers 到 `src/lib/llm/guardrails.ts`：

- `hasMechanicalOutput(text: string): boolean` —— 检测是否含禁词或模板话
- `antiMechanicalFallback(text: string): string` —— 替换/重生成机械输出

```typescript
// src/lib/llm/guardrails.ts
const FORBIDDEN_PATTERNS = [
  /^.*?[:：]\s*(破位|趋势|Gamma 复核|观察状态)/, // 报告口吻前缀
  // ... 23 条正则（从 chatGuardrails.ts 复用，不要重复，import 即可）
];

export function hasMechanicalOutput(text: string, taskTag: string): boolean {
  // 用 chatGuardrails.ts 的 patterns（如果 task-18 已合 main 有这文件）
  // 或者本文件自带 patterns
  return FORBIDDEN_PATTERNS.some((p) => p.test(text));
}

export async function applyGuardrails(text: string, taskTag: string): Promise<string> {
  if (hasMechanicalOutput(text, taskTag)) {
    // Retry 1 次
    // 如果还是机械 → return cleaned version + log
    return cleanMechanicalText(text);
  }
  return text;
}
```

### Cache 实现（KV-based，替代 T1-core stub）

```typescript
// src/lib/llm/cache.ts
import { kv } from "@vercel/kv";
import crypto from "crypto";

export function hashCacheKey(prompt: string, taskTag: string, systemPrompt?: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(prompt);
  hash.update("|");
  hash.update(taskTag);
  if (systemPrompt) {
    hash.update("|");
    hash.update(systemPrompt);
  }
  return `llm-cache:${hash.digest("hex").slice(0, 16)}`;
}

export async function getFromCache(cacheKey: string): Promise<LLMOutput | null> {
  return await kv.get<LLMOutput>(cacheKey);
}

export async function setCache(
  cacheKey: string,
  output: LLMOutput,
  ttlSeconds = 300,
): Promise<void> {
  await kv.set(cacheKey, output, { ex: ttlSeconds });
}
```

### 验收标准

- [ ] `generateText(prompt, { taskTag })` 接口工作
- [ ] Guardrails 检测机械输出 + retry 一次
- [ ] Cache 接 KV，TTL 默认 5 min
- [ ] vitest 覆盖：Cache hit / miss / Guardrails 检测 / 重生成
- [ ] `npm run verify:llm-generate-text` 跑通
- [ ] tsc + lint + build 全绿

---

## T2c: Structured Signal Provider Integration

### 目标

替换 `src/lib/signal-engine/providers/llm.ts` stub（T1-core 内化时占位），让 SignalEngine 调 LLM 生成结构化信号时用新 provider chain。

### 文件

```
src/lib/signal-engine/providers/
└── llm.ts                          # 升级（T1-core 时是 stub，现在替换为真实实现）

src/lib/signal-engine/
├── llm-cache.ts                    # 升级（替代 T1-core stub，可直接 re-export src/lib/llm/cache.ts）
├── llm-budget-tracker.ts           # 升级（同上，re-export src/lib/llm/budget-tracker.ts）
└── llm-log.ts                      # 升级
```

### 实施

```typescript
// src/lib/signal-engine/providers/llm.ts
import { callWithChain } from "@/lib/llm/providers";
import type { LLMProvider } from "@/lib/llm/providers/types";

/**
 * SignalEngine 内部 LLM provider —— 用于结构化信号生成（输出 JSON schema）。
 * 区别于 generateText（generic 文本）：本 provider 强制 JSON 输出。
 */
export async function generateStructuredSignal(prompt: string, schema: object): Promise<object> {
  // 1. 拼接 prompt 含 schema description + JSON 输出指令
  const wrappedPrompt = `${prompt}

请严格按以下 JSON schema 输出，**仅返回 JSON 不带任何解释**：

${JSON.stringify(schema, null, 2)}
`;

  // 2. 调 generic chain
  const output = await callWithChain({
    prompt: wrappedPrompt,
    temperature: 0.3, // 结构化任务用低 temperature
    maxTokens: 1500,
    timeoutMs: 15000,
    cacheKey: undefined, // signal 不缓存（每次都要新数据）
    taskTag: "signal-structuring",
  });

  // 3. 解析 JSON + schema validation
  return parseAndValidate(output.text, schema);
}
```

### `llm-cache.ts` / `llm-budget-tracker.ts` / `llm-log.ts` 升级

这些文件 T1-core 时是 stub。本 task 把它们替换为 re-export：

```typescript
// src/lib/signal-engine/llm-cache.ts
export * from "@/lib/llm/cache";
```

```typescript
// src/lib/signal-engine/llm-budget-tracker.ts
export * from "@/lib/llm/budget-tracker";
```

```typescript
// src/lib/signal-engine/llm-log.ts
import { kv } from "@vercel/kv";
import type { LLMInput, LLMOutput, LLMProvider } from "@/lib/llm/providers/types";

export async function logCall(
  provider: LLMProvider,
  input: LLMInput,
  output: LLMOutput,
): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const entry = {
    provider: provider.id,
    taskTag: input.taskTag,
    inputTokens: output.inputTokens,
    outputTokens: output.outputTokens,
    latencyMs: output.latencyMs,
    cached: output.cached,
    timestamp: Date.now(),
  };

  // KV lpush 到 daily list, TTL 7 day
  const key = `llm-log:${date}:${input.taskTag}`;
  await kv.lpush(key, JSON.stringify(entry));
  await kv.expire(key, 7 * 86400);
}
```

### 验收标准

- [ ] SignalEngine 调 `generateStructuredSignal` 输出 JSON schema-validated
- [ ] llm-cache / llm-budget-tracker / llm-log 全部从 stub 升级
- [ ] grep `signal-engine/providers/llm.ts` 内不含 `STUB` / `T2 placeholder` 等占位词
- [ ] vitest 覆盖结构化 provider 调用
- [ ] tsc + lint + build 全绿

---

## T2d: Migrate Imports + Delete `llmFallbackChain.ts`

### 目标

把所有 `llmFallbackChain.ts` 引用替换为新 `generateText` / `callWithChain`，删除文件本身。

### 引用清单（task-18 合 main 后的 main 状态）

8 处 import：

```
src/app/api/agents/analysis/route.ts          # 用 getAgentAnalysis → 改为 generateText
src/app/api/agents/history/route.ts           # 用 getHistoryMessages / getNewestGeneratedAt → 评估是否还需要
src/lib/chatOrchestrator.ts                   # 用 generateLlmText → 改为 generateText
src/lib/news/newsAgentAnalysis.ts             # 用 generateLlmText → 改为 generateText
src/lib/news/normalizer.ts                    # 用 generateLlmText → 改为 generateText
src/lib/newsTranslate.ts                      # 用 generateLlmText → 改为 generateText
```

并 export 这些 generic helpers（迁移到新位置）：

- `generateLlmText` → `src/lib/llm/generateText.ts` 的 `generateText`
- `hasMechanicalOutput` → `src/lib/llm/guardrails.ts` 的 `hasMechanicalOutput`
- `antiMechanicalFallback` → `src/lib/llm/guardrails.ts` 的 `applyGuardrails`

### 实施步骤

```bash
# Audit 所有 llmFallbackChain 引用
grep -rn "from '@/lib/llmFallbackChain'\|from '../../lib/llmFallbackChain'" src/

# 逐文件迁移
# 例：src/lib/chatOrchestrator.ts
#   旧：import { generateLlmText } from '@/lib/llmFallbackChain';
#   新：import { generateText } from '@/lib/llm/generateText';

# 修订调用：
#   旧：const text = await generateLlmText(prompt);
#   新：const text = await generateText(prompt, { taskTag: 'chat:agent-message' });

# T3 改造 /api/agents/analysis 时它已经会用 generateText，T2d 不重复改它

# Verify 删除前
grep -rn "llmFallbackChain" src/
# 应该 0 引用

# 删除文件
rm src/lib/llmFallbackChain.ts

# tsc 验证
npx tsc --noEmit

# 测试
npm run verify:chat-v3-final
```

### 验收标准

- [ ] grep `llmFallbackChain` 在 src/ 下 0 引用
- [ ] 文件 `src/lib/llmFallbackChain.ts` 已删除
- [ ] tsc + lint + build 全绿
- [ ] `verify:chat-v3-final` 50 条 synthetic 全绿
- [ ] `verify:llm-providers` + `verify:llm-generate-text` 跑通

---

## T3: `/api/agents/analysis` 改造 + SignalEngine Grounding

### 目标

把 `/api/agents/analysis` 从凭空生成改为调 SignalEngine + 把 SignalCard 注入 prompt。

**注意**：本 task 只做**基础 grounding**（让 Agent 看 SignalCard 数据）。**派别看不同 SignalCard 层**（alpha→facts/evidence, beta→impact/judgment, gamma→explanation/engine）+ **派别 prompt 模板**（identity/data anchor/style/forbidden）+ **action templates** —— 这些**全部留给 Batch 4 task-18-v2**（locked-v3 § 7.2）。

### 文件

```
src/app/api/agents/analysis/route.ts          # 修改：改为调 SignalEngine + generateText
```

### 实施

```typescript
// src/app/api/agents/analysis/route.ts
import { NextResponse } from "next/server";
import { getMajorEvent, getHotSignals } from "@/lib/signal-engine";
import { generateText } from "@/lib/llm/generateText";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const agentId = searchParams.get("agent") as "alpha" | "beta" | "gamma";

  if (!symbol || !agentId) {
    return NextResponse.json({ error: "symbol and agent required" }, { status: 400 });
  }

  // 1. 拉 SignalCard from SignalEngine
  const majorEvent = await getMajorEvent({ symbol });
  const hotSignals = await getHotSignals({ symbol, limit: 3 });
  const primarySignal = hotSignals[0] || majorEvent;

  if (!primarySignal) {
    // 数据缺失 → 不 fallback，明确告知
    return NextResponse.json({
      content: `${agentId} 暂时没有 ${symbol} 的可靠信号，等数据。`,
      signalCardId: null,
      dataLayer: null,
      generatedAt: Date.now(),
    });
  }

  // 2. 拼 prompt（基础版本，不区分派别看不同层 — 留 Batch 4）
  const systemPrompt = `你是 Agent ${agentId}，对 ${symbol} 给出短句分析。
基于以下 SignalCard 数据：
${JSON.stringify(primarySignal, null, 2)}

要求：
- 30-60 字
- 必须引用 SignalCard 中的具体数据点
- 不能编造未在数据中出现的数字
- 数据缺失某项时明确说"该项数据不足"`;

  // 3. 调 generateText
  const text = await generateText(systemPrompt, {
    taskTag: `analysis:${agentId}:${symbol}`,
    temperature: 0.7,
    maxTokens: 200,
    enableCache: true,
    enableGuardrails: true,
  });

  return NextResponse.json({
    content: text,
    signalCardId: primarySignal.id,
    dataLayer: "all", // Batch 4 会按派别区分
    generatedAt: Date.now(),
  });
}
```

### 验收标准

- [ ] `/api/agents/analysis?symbol=BTC&agent=alpha` 返回真实 SignalCard 引用
- [ ] 数据缺失场景返回明确"等数据"信息（不 fallback 凭空生成）
- [ ] response 含 `signalCardId` 字段
- [ ] vitest mock SignalEngine + generateText，验证 grounding 流程
- [ ] `verify:chat-v3-final` 仍全绿（保 task-18 既有验收）
- [ ] tsc + lint + build 全绿

---

## Cleanup（5 task 都完成后）

```bash
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git worktree remove /tmp/claw42-t2a
git worktree remove /tmp/claw42-t2b
git worktree remove /tmp/claw42-t2c
git worktree remove /tmp/claw42-t2d
git worktree remove /tmp/claw42-t3
git worktree list

gh auth switch --user "$ORIGINAL_GH_USER"
```

## 完成后输出

```
T2a (provider-core):       PR #X (5 providers + stub + budget tracker, vitest Y cases)
T2b (generate-text):       PR #X (generateText + guardrails + cache, vitest Y cases)
T2c (signal-provider):     PR #X (signal-engine/providers/llm.ts upgraded from stub)
T2d (migrate-delete):      PR #X (llmFallbackChain.ts deleted, 8 import sites migrated)
T3 (analysis-grounding):   PR #X (/api/agents/analysis grounded by SignalEngine)

Verify per task:
  T2a: tsc/lint/build/verify:llm-providers pass
  T2b: tsc/lint/build/verify:llm-generate-text pass
  T2c: tsc/lint/build pass; signal-engine providers/llm.ts no longer stub
  T2d: tsc/lint/build pass; grep llmFallbackChain returns 0
  T3: tsc/lint/build/verify:chat-v3-final pass

Worktree cleanup: done
GitHub account restored: <ORIGINAL_GH_USER>
Main worktree dirty state: <unchanged>
```

## 约束

- ❌ 不要直接 cherry-pick HP 的 `signal-engine/providers/` 实现（T1-core 已部分内化，T2 在此基础上扩展，不重新内化）
- ❌ 不要把 5 task 合到一个 PR
- ❌ 不要做 Batch 4 范围的工作（派别 prompt 模板 / action templates / 派别看不同 SignalCard 层 — 都留 Batch 4 task-18-v2）
- ❌ 不要引入新外部依赖
- ❌ 不要 force push / 不要 commit 到 main / 不要 stash 主 worktree dirty
- ❌ 不要在 Provider 实现中 hardcode API key（必须 env）
- ❌ 不要用真名 Mike
- ✅ 允许临时切到 `agentxmain-collab` push / cleanup 时切回

## 失败处理

- **Provider 实现失败**（如 deepseek API 端点错）：报回 + 提议是否升级到 V4 Pro 或备用
- **Migration 时发现某 helper 接口签名不匹配**：报回让 Session C 调整迁移策略
- **删除 llmFallbackChain.ts 后某 build 失败**（grep 漏了某引用）：先 revert 删除 + 找漏掉的文件 + 重 commit
- **Budget tracker KV 写失败**：fallback 到 console.warn，不阻塞主流程
- **task-18 / Hero PR 还没 merge main**：T2d / T3 等待，T2a/T2b/T2c 先做
- **`verify:chat-v3-final` 红**：任 task 实施都不能让既有 verify 红，必修

---
