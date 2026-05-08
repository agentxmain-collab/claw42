# task-18 v3.final.locked — 锁定方案（Codex 实施版）

> **状态**：LOCKED — 所有决策点已拍板，Codex 按 §16 commit 计划实施
> **替代**：原 `docs/task-18-v3-final-comprehensive-plan.md`（保留作详细 reference，冲突时以本文档为准）
> **配套审阅**：`docs/codex-specs/task-18-v3-final-codex-review.md`（Codex 副审意见，5 P0 + 4 P1 已全部接受并整合）
> **核心架构变更**：每人独立 thread → **币种级共享 thread**（v3.final 原稿假设错误，本版本修正）

---

## § 0. 锁定决策清单

### 0.1 Dan 拍板的 5 个核心决策

| #   | 维度             | 决策                                                                                                                                                                              |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | 持久化模型       | **In-memory + Vercel KV 双写 + env flag**。dev/preview 默认 in-memory；生产 env flag `USE_PERSISTENT_KV=true` 切换 KV。算法层面双写不双读（KV 为副本，故障时 fallback in-memory） |
| Q2  | 全局上限策略     | **N/A**。共享 thread 模型让 LLM 成本与用户数脱钩，原"30/min global"问题消失。新上限模型见 § 1.5                                                                                   |
| Q3  | Slang policy     | **zh_CN 限"卧槽 / 草 / 靠"**，禁"操 / 妈的"。en/ja/ru/uk/fr/es 译为 `damn / hell / wtf` 级别，禁 `fuck / shit`。ar 走中性（不带情绪词）。详见 § 6                                 |
| Q4  | i18n 共享 thread | **主 thread 用 zh + en 双语生成**（成本 ×2，可接受）。其他 locale 选择最近的兜底语言展示，**不做实时翻译**。详见 § 11                                                             |
| Q5  | 用户互动         | **纯观众**。watch 页无 input 框、无 reaction 按钮。"X 人正在观看"展示在 v3.final 不接真实 presence（mocked）。详见 § 12                                                           |

### 0.2 Codex Review 5 P0 接受清单

| #    | Codex P0                   | 处理                                                                       | 落地章节 |
| ---- | -------------------------- | -------------------------------------------------------------------------- | -------- |
| P0-1 | 持久化模型必须锁清楚       | ✅ Q1 选 C：in-memory + KV 双写 env flag                                   | § 2      |
| P0-2 | 缺少可执行验收 harness     | ✅ 新增 `npm run verify:chat-v3-final` + JSON report + CI                  | § 3      |
| P0-3 | Seed 内容所有权不清        | ✅ locked spec 只定义 schema，seed 文案由 F 单独起草后注入，Codex 不临场编 | § 5      |
| P0-4 | 语言/slang policy 冲突     | ✅ Q3 决策 + `PERSONA_SLANG_POLICY_BY_LOCALE` 配置                         | § 6      |
| P0-5 | mention floor 用概率不靠谱 | ✅ 改为前 6 条 ≥ 2 条 mention + citedQuote 硬下限，orchestrator 补齐       | § 4      |

### 0.3 Codex Review 4 P1 接受清单

| #    | Codex P1                              | 处理                                                                | 落地章节 |
| ---- | ------------------------------------- | ------------------------------------------------------------------- | -------- |
| P1-1 | Scroll control 没定义                 | ✅ 用户上滚暂停 auto-follow + "有新讨论"浮动按钮                    | § 7      |
| P1-2 | Message contract 缺数据来源/staleness | ✅ 加 `dataSource / snapshotAt / fetchedAt / failureFallback`       | § 8      |
| P1-3 | Analytics schema 太松                 | ✅ 固定 10 个 properties                                            | § 9      |
| P1-4 | 旧 R1/R2/R3 迁移边界软                | ✅ API projection 保留 / UI 不渲染 roundNumber / 新代码不依赖 round | § 10     |

### 0.4 Codex 参数调整接受清单

| 参数                              | 原 v3.final | 锁定值                                            |
| --------------------------------- | ----------- | ------------------------------------------------- |
| `react` typing                    | 200-600ms   | **500-900ms**                                     |
| `concede` typing                  | 2500-4000ms | **1800-3000ms**                                   |
| Few-shot 每派条数                 | 5 条        | **8-10 条 + 反例**                                |
| `MAX_LLM_CALLS_PER_MINUTE_GLOBAL` | 30          | **N/A**（共享 thread 模型替代）                   |
| `MAX_THREADS_PER_DAY`             | 50          | **N/A**（替换为 `THREAD_COOLDOWN_PER_COIN=5min`） |
| `same-agent merge`                | 10s         | 10s（保留），仅同 thread 内                       |
| Strategy auto-scroll              | 无条件      | 仅"用户在底部 OR 主动点击"时                      |

---

## § 1. 核心架构：币种级共享 thread

> **本节是 v3.final 相对原稿最大的架构升级**。原稿默认每个用户进 watch 页都触发新 thread，这导致 100 个用户看 BTC 时出现 100 份矛盾分析（A 看到多头赢，B 同时看到空头赢），且 LLM 成本随用户数线性扩张。新模型让 watch 页定位回归"观众视角"——所有人看同一场戏。

### 1.1 数据模型

```ts
// src/modules/watch-chat-immersive/lib/types.ts

export type CoinSymbol = 'BTC' | 'ETH' | 'SOL' | 'BNB' | /* ... */;

export type ThreadStatus =
  | 'active'        // 正在生成消息
  | 'completing'    // 等待最后 strategy synthesis
  | 'completed'     // 已生成 strategy，等 cooldown
  | 'cooldown'      // 5min cooldown 内不重生成
  | 'archived';     // 移出 active set，仅作历史展示

export interface CoinThread {
  threadId: string;              // `${symbol}-${createdAt-epoch}`
  symbol: CoinSymbol;
  locale: 'zh' | 'en';           // 主语言（其他 locale fallback 到这两个之一）
  status: ThreadStatus;
  createdAt: number;             // epoch ms
  completedAt: number | null;
  cooldownUntil: number | null;  // = completedAt + 5min
  triggerReason: TriggerReason;
  messages: ChatMessage[];
  strategy: StrategyCard | null;
  factionState: FactionState;    // emotionalDebt / relationship
  snapshotData: TickerSnapshot;  // 创建时锁定的市场快照
  llmCallsUsed: number;
  retryCount: number;
}

export type TriggerReason =
  | 'cooldown_expired'    // 上个 thread completed + 5min 已过
  | 'breaking_news'       // RSS 推一条相关新闻
  | 'price_volatility'    // >2% 波动 30min 窗口
  | 'dev_override'        // 测试 / 手动触发
  | 'cold_start';         // KV 中没有该 symbol 的活跃 thread

export interface ChatMessage {
  messageId: string;
  threadId: string;
  agentId: string;             // 'alpha-bull' | 'beta-bear' | 'gamma-neutral'
  faction: string;             // 来自 Faction Registry，无硬编码
  action: ChatAction;          // 11 种之一
  content: string;
  contentEn?: string;          // i18n 双语生成（仅 zh 主 thread 时）
  contentZh?: string;          // i18n 双语生成（仅 en 主 thread 时）
  replyTo: string | null;      // messageId
  mentioning: string | null;   // agentId
  citedQuote: string | null;   // 引用对方的原话片段
  expectsReply: boolean;
  mood: AgentMood;
  createdAt: number;
  typingStartAt: number;
  typingEndAt: number;
  // P1-2: 数据来源 + staleness
  dataSource: 'coinw' | 'coingecko' | 'fallback';
  snapshotAt: number;          // 引用的市场数据快照时刻
  fetchedAt: number;           // 数据实际拉取时刻
  failureFallback: boolean;    // true = 数据拉取失败兜底生成
}

export type ChatAction =
  | 'open' | 'rebut' | 'agree' | 'question'
  | 'taunt' | 'derail' | 'refocus' | 'comment'
  | 'react' | 'concede' | 'gloat';
```

### 1.2 触发条件矩阵

```ts
// src/modules/watch-chat-immersive/lib/triggers.ts

export const TRIGGER_RULES = {
  cooldown_expired: {
    condition: (thread: CoinThread) =>
      thread.status === "cooldown" &&
      thread.cooldownUntil != null &&
      Date.now() >= thread.cooldownUntil,
    priority: 1,
  },
  breaking_news: {
    condition: (thread: CoinThread, signal: NewsSignal) =>
      signal != null &&
      signal.symbol === thread.symbol &&
      signal.relevanceScore >= 0.7 &&
      Date.now() - thread.createdAt > 60_000, // 至少隔 1 分钟避免连发
    priority: 2, // 优先级最高，可中断 cooldown
  },
  price_volatility: {
    condition: (thread: CoinThread, ticker: TickerSnapshot) =>
      Math.abs(ticker.changePercent30m) >= 0.02 && Date.now() - thread.createdAt > 120_000,
    priority: 3,
  },
  dev_override: {
    condition: () => process.env.WATCH_DEV_FORCE_NEW === "true",
    priority: 0, // dev only
  },
};

// 触发规则：同一时刻同一 symbol 只能有 1 个 active thread
// breaking_news 可强制结束当前 cooldown 立即生成新 thread
// price_volatility 需要等当前 thread 走完
```

### 1.3 SSE 广播流程

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  User A     │     │ /api/watch/stream│     │ ThreadOrchestrator
│  (browser)  │◄────┤   (SSE endpoint) │◄────┤ (server-side)
└─────────────┘     └──────────────────┘     └─────────────────┘
                            │                          │
┌─────────────┐             │                          │
│  User B     │◄────────────┤                          │
│  (browser)  │             │                          │
└─────────────┘             ▼                          ▼
                    ┌──────────────┐            ┌──────────────┐
                    │ in-memory    │◄───────────┤ KV (optional)│
                    │ thread cache │   双写     │  Vercel KV   │
                    └──────────────┘            └──────────────┘
```

**流程**：

1. User A 进 watch 页 → GET `/api/watch/threads/{symbol}` 拉当前 thread snapshot
2. User A 订阅 GET `/api/watch/stream?symbol=BTC`（SSE）
3. ThreadOrchestrator 生成新 message → 写 in-memory cache + (可选) KV → 广播到所有该 symbol 的 SSE 订阅者
4. User A、User B、User C... 几乎同时收到这条 message
5. Orchestrator 检测触发条件（cooldown/news/volatility）→ 决定是否开新 thread

### 1.4 持久化策略（in-memory + KV 双写）

详见 § 2。

### 1.5 上限模型（币种 × 时间窗口）

```ts
// src/modules/watch-chat-immersive/lib/limits.ts

export const LIMITS = {
  // 每个币种同时只能有 1 个 active thread
  MAX_ACTIVE_THREADS_PER_SYMBOL: 1,

  // 每个币种 thread 之间的最小间隔（cooldown）
  THREAD_COOLDOWN_PER_COIN_MS: 5 * 60 * 1000,

  // 单 thread 最大消息数
  MAX_MESSAGES_PER_THREAD: 20,

  // 单 thread 最大 LLM 调用次数（含 retry）
  MAX_LLM_CALLS_PER_THREAD: 25,

  // 单 thread 最大 retry 次数
  MAX_RETRY_PER_THREAD: 5,

  // 全局活跃 symbol 数（上限 = 同时维护多少个币的 thread）
  MAX_CONCURRENT_SYMBOLS: 10,

  // 单 symbol 24h 内最多生成 thread 数（防同币高频翻车）
  MAX_THREADS_PER_SYMBOL_PER_DAY: 50,

  // dev/preview 默认值（生产 env 可调）
  // 计算：10 symbol × 25 call/thread × (60min ÷ 5min) = 3000 call/小时 = 50 call/分钟
  // 用户数与此完全无关
};
```

**和 v3.final 原稿的差异**：

- 删除 `MAX_LLM_CALLS_PER_MINUTE_GLOBAL=30`（和用户数耦合，不再需要）
- 删除 `MAX_THREADS_PER_DAY=50` 全局值（替换为按 symbol 维度的 cooldown）
- 新增 `MAX_CONCURRENT_SYMBOLS=10` 控制同时活跃币种数
- 新增 `MAX_THREADS_PER_SYMBOL_PER_DAY=50` 防止同币种刷屏

---

## § 2. Persistence Model（in-memory + KV 双写，D19）

### 2.1 模式切换

```ts
// src/modules/watch-chat-immersive/lib/persistence.ts

const USE_KV = process.env.USE_PERSISTENT_KV === "true";

export const persistence = {
  async getThread(symbol: CoinSymbol): Promise<CoinThread | null> {
    // 优先 in-memory
    const inMem = inMemoryStore.threads.get(symbol);
    if (inMem) return inMem;

    // KV fallback
    if (USE_KV) {
      const kvData = await kv.get<CoinThread>(`thread:${symbol}`);
      if (kvData) {
        inMemoryStore.threads.set(symbol, kvData); // 回填 in-memory
        return kvData;
      }
    }
    return null;
  },

  async saveThread(thread: CoinThread): Promise<void> {
    inMemoryStore.threads.set(thread.symbol, thread);

    if (USE_KV) {
      // 不阻塞，失败不影响主流程
      kv.set(`thread:${thread.symbol}`, thread, { ex: 24 * 3600 }).catch((e) =>
        logger.warn("KV write failed", { symbol: thread.symbol, error: e }),
      );
    }
  },

  async appendMessage(threadId: string, message: ChatMessage): Promise<void> {
    const symbol = message.threadId.split("-")[0] as CoinSymbol;
    const thread = await persistence.getThread(symbol);
    if (!thread) throw new Error(`Thread not found for ${symbol}`);

    thread.messages.push(message);
    thread.llmCallsUsed += 1;
    await persistence.saveThread(thread);
  },
};
```

### 2.2 KV Key Schema

| Key                       | Value                               | TTL |
| ------------------------- | ----------------------------------- | --- |
| `thread:{SYMBOL}`         | 当前活跃 / 最近 thread JSON         | 24h |
| `thread:{SYMBOL}:history` | 最近 5 个 archived thread IDs       | 7d  |
| `thread:{THREAD_ID}`      | 单个 thread 完整数据（含 messages） | 7d  |
| `presence:{SYMBOL}`       | viewer count（如启用真实 presence） | 60s |

### 2.3 并发策略

- 单进程内 in-memory 用 `Map<CoinSymbol, CoinThread>` + 写时浅复制（单 thread 写永远走 orchestrator queue 串行化）
- 跨实例（Vercel multi-instance）通过 KV `last_writer_wins`（同一 symbol 同一时间多实例写竞态时，先到先得，后写覆盖；接受短暂不一致，因为 cooldown 机制会让所有实例下个 thread 重新对齐）
- **不做分布式锁**——dev/preview 环境单实例无问题；生产万一多 instance 出现少量 thread 重复，是可接受退化

### 2.4 故障降级

- KV 读失败 → fall back 到 in-memory（如果 in-memory 有数据）→ 否则当作 cold start 触发新 thread
- KV 写失败 → 仅 log，主流程继续（in-memory 已写）
- in-memory miss + KV miss → cold start

---

## § 3. Acceptance Harness（D20，新增）

### 3.1 入口脚本

```bash
npm run verify:chat-v3-final
```

```json
// package.json
{
  "scripts": {
    "verify:chat-v3-final": "tsx scripts/verify-chat-v3-final.ts"
  }
}
```

### 3.2 验收脚本

```ts
// scripts/verify-chat-v3-final.ts

const SAMPLE_SIZE = 50;
const MOCK_LLM = createMockLLM({ deterministic: true });

async function main() {
  const results: VerifyResult[] = [];

  for (let i = 0; i < SAMPLE_SIZE; i++) {
    const thread = await runSyntheticThread({
      symbol: pickRandomSymbol(),
      llm: MOCK_LLM,
      seed: i, // deterministic
    });

    results.push({
      threadId: thread.threadId,
      messageCount: thread.messages.length,
      first6MentionCount: countMentions(thread.messages.slice(0, 6)),
      first6CitedQuoteCount: thread.messages.slice(0, 6).filter((m) => m.citedQuote).length,
      forbiddenPrefixHits: countForbiddenPrefixes(thread.messages),
      ambiguousActionHits: countAmbiguousActions(thread.messages),
      strategyValid: validateStrategy(thread.strategy),
      hasNoDataDegradation: thread.snapshotData == null && thread.strategy?.type === "no_consensus",
    });
  }

  const summary = {
    total: SAMPLE_SIZE,
    pass_min_messages: results.filter((r) => r.messageCount >= 6).length,
    pass_mention_floor: results.filter((r) => r.first6MentionCount >= 2).length,
    pass_cited_quote_floor: results.filter((r) => r.first6CitedQuoteCount >= 2).length,
    forbidden_prefix_total: results.reduce((s, r) => s + r.forbiddenPrefixHits, 0),
    ambiguous_action_total: results.reduce((s, r) => s + r.ambiguousActionHits, 0),
    strategy_pass: results.filter((r) => r.strategyValid).length,
    timestamp: new Date().toISOString(),
  };

  // 写 JSON report
  fs.writeFileSync(
    "reports/chat-v3-final-verify.json",
    JSON.stringify({ summary, details: results }, null, 2),
  );

  // 失败条件
  const failures = [];
  if (summary.pass_min_messages < SAMPLE_SIZE) failures.push("min_messages");
  if (summary.pass_mention_floor < SAMPLE_SIZE) failures.push("mention_floor");
  if (summary.pass_cited_quote_floor < SAMPLE_SIZE) failures.push("cited_quote_floor");
  if (summary.forbidden_prefix_total > 0) failures.push("forbidden_prefix");
  if (summary.ambiguous_action_total > 0) failures.push("ambiguous_action");
  if (summary.strategy_pass < SAMPLE_SIZE * 0.95) failures.push("strategy_validity_95");

  if (failures.length > 0) {
    console.error(`FAIL: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log("PASS: all 50 synthetic threads verified");
}

main();
```

### 3.3 CI Hookup

```yaml
# .github/workflows/verify-chat.yml
name: verify-chat-v3-final
on:
  pull_request:
    paths:
      - "src/modules/watch-chat-immersive/**"
      - "scripts/verify-chat-v3-final.ts"
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - run: npm run verify:chat-v3-final
      - uses: actions/upload-artifact@v4
        with:
          name: verify-report
          path: reports/chat-v3-final-verify.json
```

### 3.4 JSON Report Schema

```ts
type VerifyReport = {
  summary: {
    total: number;
    pass_min_messages: number;
    pass_mention_floor: number;
    pass_cited_quote_floor: number;
    forbidden_prefix_total: number;
    ambiguous_action_total: number;
    strategy_pass: number;
    timestamp: string;
  };
  details: Array<{
    threadId: string;
    messageCount: number;
    first6MentionCount: number;
    first6CitedQuoteCount: number;
    forbiddenPrefixHits: number;
    ambiguousActionHits: number;
    strategyValid: boolean;
    hasNoDataDegradation: boolean;
  }>;
};
```

---

## § 4. Mention Floor 硬下限（D5 修订，P0-5）

### 4.1 锁定规则

- 前 4 条消息 `expectsReply` **必须**为 `true`（硬性，非概率）
- 前 6 条消息 **至少 2 条** `mentioning != null && citedQuote != null`
- `MIN_TOTAL_MESSAGES=6` 才能进入 strategy synthesis
- Orchestrator 在生成第 N 条消息前，先检查"如果到第 6 条结束 mention 还是不够，本条必须强制 mention"

### 4.2 算法

```ts
// src/modules/watch-chat-immersive/lib/orchestrator.ts

function shouldForceMention(thread: CoinThread, currentTurn: number): boolean {
  if (currentTurn >= 6) return false; // 仅前 6 条受约束

  const mentionsSoFar = thread.messages
    .slice(0, currentTurn)
    .filter((m) => m.mentioning && m.citedQuote).length;

  const remainingTurns = 6 - currentTurn;
  const stillNeed = 2 - mentionsSoFar;

  // 剩余轮数刚好够补齐 mention floor → 强制
  if (stillNeed > 0 && remainingTurns <= stillNeed) {
    return true;
  }
  // 概率补齐
  return Math.random() < FORCE_MENTION_PROBABILITY;
}

const FORCE_MENTION_PROBABILITY = 0.7; // 概率层（保留），但不依赖
```

### 4.3 backfill 策略

如果 LLM 输出违规被 sanitize/drop，导致 thread 实际消息数 < 6：

1. Retry 同 agent 同 action（max 2 次）
2. Retry 失败 → orchestrator 切换 agent，强制 `expectsReply=true` + mention 上一条
3. 若 retry budget 耗尽 → thread 进入 `degraded` 状态，strategy 走 "InsufficientConsensus" 模板
4. degraded thread 不计入 cooldown（避免坏 thread 占住 5 分钟窗口）

---

## § 5. Seed 内容所有权（D12 修订，P0-3）

### 5.1 切割

- locked spec **只定义 schema**（见 § 5.2）
- seed 文案由 **F 单独起草**并以 `docs/airy-tasks/task-18-seed-threads.md` 形式注入仓库
- Codex 实施时只接 schema + 读 seed 文件 → 注入 in-memory 初始数据

### 5.2 Seed Schema

```ts
// src/modules/watch-chat-immersive/data/seed-threads.ts

export interface SeedThread {
  symbol: CoinSymbol;
  locale: "zh" | "en";
  scenario: "bullish_consensus" | "bearish_consensus" | "no_consensus" | "no_data_wait";
  triggerReason: TriggerReason;
  snapshotData: TickerSnapshot;
  messages: SeedMessage[];
  strategy: StrategyCard | null;
  factionState: FactionState;
  // 标识：这是历史样例，不冒充实时
  isHistorical: true;
  historicalLabel: string; // "5 月 1 日 BTC 暴跌讨论复盘" 等
  createdAt: number; // 真实历史时刻（不能是 Date.now()）
}

export const SEED_THREADS: SeedThread[] = [
  // 由 F 单独起草，3 场 minimum，必须含 1 场 no_consensus 或 no_data_wait
];
```

### 5.3 F 起草约束（写入 task-18-seed-threads.md）

- **3 场最少**，4-5 场更佳
- 必须含场景：
  - 1 场 BTC 多头共识
  - 1 场 ETH 分歧但出策略
  - 1 场 SOL 无共识 OR 等数据
- 每场 6-12 条消息
- 每场必须满足前 6 条 ≥ 2 mention + citedQuote
- 历史时间戳：使用过去 7-30 天内的真实历史时刻（防"刚发生"错觉）
- UI 展示标识："历史复盘"或"5 月 1 日讨论"

### 5.4 Cold Start 流程

1. User 进 watch 页 → 拉 `thread:BTC` from in-memory/KV
2. Miss → 检查是否有 `SEED_THREADS.find(s => s.symbol === 'BTC')`
3. 有 → 渲染 seed thread（带"历史复盘"标签）+ 后台异步生成真实 thread
4. 真实 thread ready → 自动切换（或 user 手动点"切到当前讨论"）

---

## § 6. Slang Policy by Locale（D21，新增，P0-4）

### 6.1 配置

```ts
// src/modules/watch-chat-immersive/lib/slang-policy.ts

export const PERSONA_SLANG_POLICY_BY_LOCALE = {
  zh_CN: {
    allowed: ["卧槽", "草", "靠"],
    banned: ["操", "妈的", "他妈", "cao", "操你", "妈逼"],
    intensity: "mild",
  },
  zh_TW: {
    allowed: ["靠", "草", "靠北"], // tw 不用"卧槽"
    banned: ["操", "妈的", "幹"],
    intensity: "mild",
  },
  en_US: {
    allowed: ["damn", "hell", "wtf", "bs", "jeez"],
    banned: ["fuck", "shit", "bitch", "asshole"],
    intensity: "mild",
  },
  ja_JP: {
    allowed: ["まじか", "やばい", "うわ"],
    banned: ["くそ", "バカ", "クソ"],
    intensity: "mild",
  },
  ru_RU: {
    allowed: ["блин", "чёрт", "ё-моё"],
    banned: ["блядь", "хуй", "пизда"],
    intensity: "mild",
  },
  uk_UA: {
    allowed: ["блін", "чорт", "дідько"],
    banned: ["блядь", "хуй"],
    intensity: "mild",
  },
  fr_FR: {
    allowed: ["mince", "zut", "flûte", "merde"], // merde 在法语属轻度
    banned: ["putain", "enculé"],
    intensity: "mild",
  },
  es_ES: {
    allowed: ["vaya", "caray", "jolín"],
    banned: ["joder", "mierda", "cojones"],
    intensity: "mild",
  },
  ar_SA: {
    allowed: [], // 中性
    banned: ["*"], // 通配，禁所有粗口
    intensity: "neutral",
  },
  en_XA: {
    allowed: [],
    banned: [],
    intensity: "neutral", // 伪本地化
  },
};
```

### 6.2 Sanitize 流程

LLM 输出 → 检查输出 locale 的 banned list → 命中则 retry（max 2 次）→ 仍命中则 drop

### 6.3 Prompt 注入

每个 agent 的 system prompt 末尾按当前 locale 注入：

```
你的语气可以带情绪，但限于以下情绪词：{ALLOWED_SLANG}
绝对不能用：{BANNED_SLANG}
```

---

## § 7. Scroll Ergonomics（D22，新增，P1-1）

### 7.1 行为规则

```ts
// src/modules/watch-chat-immersive/components/ChatScrollContainer.tsx

const NEAR_BOTTOM_THRESHOLD_PX = 100;

function useScrollFollow() {
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  // 用户上滚 → 暂停 auto-follow
  const onScroll = (e: Event) => {
    const el = e.currentTarget as HTMLDivElement;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distanceFromBottom < NEAR_BOTTOM_THRESHOLD_PX;
    setIsNearBottom(near);
    if (near) setHasNewMessages(false);
  };

  // 新消息到达
  const onNewMessage = () => {
    if (isNearBottom) {
      scrollToBottom("smooth");
    } else {
      setHasNewMessages(true); // 显示"有新讨论"按钮
    }
  };

  return { isNearBottom, hasNewMessages, scrollToBottom };
}
```

### 7.2 Strategy 卡 auto-scroll

仅在以下情况 auto-scroll 到 strategy：

- 用户在 thread 底部附近（距离 < 100px）
- 用户主动点击"看策略"按钮

### 7.3 Reduced Motion

`prefers-reduced-motion: reduce` 时：

- 取消 typing 动画
- 取消 fade-in / pulse
- 滚动用 `behavior: 'auto'` 而非 `'smooth'`

---

## § 8. Message Contract 增强（D23，新增，P1-2）

### 8.1 字段

见 § 1.1 `ChatMessage` 已定义：

- `dataSource: 'coinw' | 'coingecko' | 'fallback'`
- `snapshotAt: number`
- `fetchedAt: number`
- `failureFallback: boolean`

### 8.2 校验

```ts
// 每条 message 写入前校验
function validateMessageContract(m: ChatMessage): void {
  if (!m.dataSource) throw new Error("dataSource required");
  if (m.snapshotAt > m.createdAt) throw new Error("snapshotAt must be ≤ createdAt");
  if (Date.now() - m.fetchedAt > 60 * 60 * 1000 && !m.failureFallback) {
    logger.warn("stale data >1h not flagged as failureFallback", { messageId: m.messageId });
  }
}
```

### 8.3 防"所有币价格一样" bug

LLM prompt 注入时显式带：

```
当前 BTC 数据：${snapshot.symbol === 'BTC' ? snapshot.price : 'N/A'} (snapshotAt: ${snapshot.snapshotAt})
你的分析必须仅引用上述数据，不能编造其他币种的数字。
```

---

## § 9. Analytics Schema（D24，新增，P1-3）

### 9.1 固定 properties

```ts
// src/modules/watch-chat-immersive/lib/analytics.ts

export type ChatAnalyticsEvent =
  | "thread_created"
  | "thread_completed"
  | "thread_degraded"
  | "message_generated"
  | "message_dropped"
  | "strategy_revealed"
  | "user_scroll_pause"
  | "user_click_show_strategy"
  | "cooldown_triggered"
  | "breaking_news_triggered";

export interface ChatAnalyticsProperties {
  thread_id: string;
  symbol: CoinSymbol;
  seed_type: "real" | "seed" | "degraded";
  agent_id: string | null;
  action: ChatAction | null;
  retry_count: number;
  llm_calls: number;
  duration_ms: number;
  strategy_direction: "long" | "short" | "wait" | "no_consensus" | null;
  failure_reason: string | null;
}

export function emitAnalytics(
  event: ChatAnalyticsEvent,
  props: Partial<ChatAnalyticsProperties>,
): void {
  posthog.capture(event, {
    thread_id: props.thread_id ?? "unknown",
    symbol: props.symbol ?? "unknown",
    seed_type: props.seed_type ?? "real",
    agent_id: props.agent_id ?? null,
    action: props.action ?? null,
    retry_count: props.retry_count ?? 0,
    llm_calls: props.llm_calls ?? 0,
    duration_ms: props.duration_ms ?? 0,
    strategy_direction: props.strategy_direction ?? null,
    failure_reason: props.failure_reason ?? null,
  });
}
```

---

## § 10. R1/R2/R3 迁移边界（D25，新增，P1-4）

### 10.1 兼容矩阵

| 层                                             | R1/R2/R3 处理                                         |
| ---------------------------------------------- | ----------------------------------------------------- |
| API projection (`/api/watch/threads/{symbol}`) | 保留 `roundNumber` 字段（默认 null），向旧前端兼容    |
| 内部数据模型 (`CoinThread`)                    | 不再有 `rounds` 概念，仅 `messages` 链                |
| UI (`ChatMessageBubble`, `ThreadView`)         | **不再渲染 R1/R2/R3 chip 或分隔线**                   |
| 旧组件 (`DebateRoundCard`)                     | 保留代码不删（其他页面可能引用），watch 页不再 import |
| 新增代码                                       | 不允许 import `DebateRound` 或读取 `roundNumber`      |

### 10.2 grep 校验

```bash
# 验收：watch-chat-immersive 模块下不能 import 旧 round 模型
grep -rn "DebateRound\|roundNumber" src/modules/watch-chat-immersive/ && exit 1 || exit 0
```

---

## § 11. i18n 双语策略（D18，新增，Q4）

### 11.1 主 thread 双语生成

```ts
// 每条 message 由 LLM 同时生成 zh + en 两个版本
async function generateBilingualMessage(
  prompt: string,
  agent: AgentPersona,
): Promise<{ zh: string; en: string }> {
  // 一次 LLM 调用产出双语（节省一半 token vs 两次调用）
  const response = await llm.generate({
    prompt: `${prompt}\n请用中文和英文各输出一句，JSON 格式：{"zh": "...", "en": "..."}`,
    format: "json",
  });
  return response;
}
```

### 11.2 Locale fallback 表

| 用户 locale | 显示语言                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------- |
| zh_CN       | zh                                                                                             |
| zh_TW       | zh（不做繁简转换，由 LLM 直接生成时考虑 locale；watch 页 v3.final 范围内 zh_TW 看 zh_CN 简体） |
| en_US       | en                                                                                             |
| ja_JP       | en（兜底）                                                                                     |
| ru_RU       | en                                                                                             |
| uk_UA       | en                                                                                             |
| fr_FR       | en                                                                                             |
| es_ES       | en                                                                                             |
| ar_SA       | en（RTL 容器但内容 en）                                                                        |
| en_XA       | en（伪本地化）                                                                                 |

### 11.3 UI 标识

非主语言用户进入时，watch 页顶部显示一行小字：

```
{locale_in_native} | Discussion shown in English / 讨论以中文展示
```

按钮可切 zh ↔ en（如果两者都有）。

---

## § 12. 用户互动（D26，新增，Q5）

### 12.1 v3.final 范围内不做

- watch 页**无 input 框**
- watch 页**无 reaction 按钮**（赞/踩/疑问）
- 用户只能：选币（symbol switcher）、滚动、看 strategy

### 12.2 Presence 展示

`X 人正在观看`数字在 v3.final：

- A. **不展示**（最简单）
- B. **mocked 数字**（基于 viewer 浏览器指纹估算 + 随机扰动）
- C. **真实 SSE connection 计数**（需 KV 存活数）

锁定 **A 不展示**，避免假数据风险。下一版若做互动再加。

---

## § 13. Typing 时长（D8 修订）

```ts
// src/modules/watch-chat-immersive/lib/typing.ts

export const TYPING_DURATION_BY_ACTION: Record<ChatAction, [number, number]> = {
  open: [800, 1500],
  rebut: [1200, 2500], // 反驳要思考
  agree: [600, 1200],
  question: [1200, 2200],
  taunt: [400, 900], // 嘲讽快
  derail: [500, 1100],
  refocus: [800, 1400],
  comment: [700, 1300],
  react: [500, 900], // ⬅ 调整：原 200-600 太短
  concede: [1800, 3000], // ⬅ 调整：原 2500-4000 上限太长
  gloat: [600, 1200],
};
```

`prefers-reduced-motion: reduce` → 全部减半，最大不超过 800ms。

---

## § 14. Few-shot 扩充 + 反例（D7 修订）

### 14.1 每派 8-10 条

```ts
// src/modules/watch-chat-immersive/data/few-shots.ts

export const AGENT_DIALOGUE_FEW_SHOTS: Record<AgentId, FewShot[]> = {
  "alpha-bull": [
    // 8-10 条正例，按 action 类型分布
    { action: "open", good: "...", bad: "破位：..." },
    { action: "rebut", good: "...", bad: "..." },
    { action: "agree", good: "...", bad: "..." },
    { action: "question", good: "...", bad: "..." },
    { action: "taunt", good: "...", bad: "..." },
    { action: "concede", good: "...", bad: "..." },
    { action: "gloat", good: "...", bad: "..." },
    { action: "no-data/wait", good: "没数据，先观察", bad: "实时上下文还在刷新..." },
  ],
  "beta-bear": [
    /* same structure */
  ],
  "gamma-neutral": [
    /* same structure */
  ],
};
```

### 14.2 反例规则（每条 fewshot 必带 bad）

bad 示例必须涵盖：

- 报告口吻（"破位:"/"趋势:"/"Gamma 复核:"）
- 派别前缀（"X 视角:"）
- 有动作无方向（"再追"/"动手"）
- AI 客套（"实时上下文还在刷新"/"刚上线"）

详见 § 4.2 D2 在原 v3.final-comprehensive-plan.md 中的 FORBIDDEN_PREFIX_PATTERNS。

---

## § 15. 维度优先级（按 Codex 建议）

| 优先级   | 维度                                                                                                                                                                                                                                                                                          |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 必做     | D1 文案 / D2 禁词 / D3 plain speech / D4 i18n / D5 mention floor / D6 方向 / D8 typing / D9 IM UI / D12 seed cold start / D15 上限 / D16 共享 thread / D17 触发 / D18 双语 / D19 持久化 / D20 harness / D21 slang / D22 scroll / D23 contract / D24 analytics / D25 round 迁移 / D26 用户互动 |
| 弱化保留 | D10 strategy 动效 / D11 thread lifecycle 视觉 / D13 长会话折叠 / D14 深度 persona                                                                                                                                                                                                             |
| 不做     | 关系图 visualizer / 真实 presence / 用户 reaction / 用户输入                                                                                                                                                                                                                                  |

---

## § 16. Commit 计划（按 Codex 6-commit 顺序）

### Commit 1: contracts + guardrails + harness

- ChatMessage / ChatThread schema 落定
- FORBIDDEN_PREFIX_PATTERNS 10 类正则
- sanitize fallback
- 方向硬约束（动作词必须跟"多/空/等/不动"之一）
- mention/citedQuote schema
- `verify:chat-v3-final` 最小 harness（先跑 forbidden_prefix + ambiguous_action）
- CI workflow 接入

**验收**：`npm run verify:chat-v3-final` 跑通；grep 验证旧 R1/R2/R3 import 在新模块下为零。

### Commit 2: orchestrator + budget + 共享 thread 模型

- ThreadOrchestrator 实现（singleton per process）
- 触发条件矩阵
- deterministic mention floor（前 6 条 ≥ 2 mention 强制）
- min_total_messages enforcement
- retry/drop/backfill 策略
- LIMITS（per-thread / per-symbol / cooldown）
- in-memory cache + KV 双写（env flag）
- SSE endpoint `/api/watch/stream`

**验收**：harness 跑 50 场 synthetic thread，全部通过 mention floor + min_messages；多浏览器同时打开同币 → 收到同一序列消息。

### Commit 3: prompt + persona + few-shot

- 每派 8-10 条 few-shot + 反例
- PERSONA_PROMPTS 完整版
- no-data / ticker-fail prompt
- PERSONA_SLANG_POLICY_BY_LOCALE 接入
- 双语生成 prompt 模板

**验收**：harness forbidden_prefix_total = 0；ambiguous_action_total = 0。

### Commit 4: chat UI + scroll ergonomics

- ChatMessageBubble（IM 风格）
- mention 高亮 + citedQuote 引用块
- same-agent merge（同 thread 10s 内）
- action badge
- ChatScrollContainer + 用户上滚检测 + "有新讨论"浮动按钮
- prefers-reduced-motion 支持

**验收**：手测 - 用户上滚后新消息不打断阅读；点"有新讨论"回到底部。

### Commit 5: cold start + thread lifecycle + persistence

- SEED_THREADS schema + F 提供的 seed 文件接入
- recent threads preload
- presence bar（仅文案）
- thread active/completing/completed/cooldown 状态机
- strategy reveal 动效
- long thread 折叠

**验收**：清空 in-memory + KV，进 watch 页看到 seed thread；后台异步生成真实 thread 后切换。

### Commit 6: i18n + analytics + docs

- zh + en 双语生成接入
- 其他 locale fallback 到 en（按 § 11.2 表）
- PostHog 10 个固定 properties
- README / ARCHITECTURE 注记
- Performance budget docs

**验收**：harness 全绿；PostHog dashboard 看到所有事件 + 全部固定 properties。

---

## § 17. 锁定验收清单

### 17.1 自动化验收

```bash
npm run verify:chat-v3-final
# 输出 reports/chat-v3-final-verify.json
# 失败条件：
#  - pass_min_messages < 50
#  - pass_mention_floor < 50
#  - pass_cited_quote_floor < 50
#  - forbidden_prefix_total > 0
#  - ambiguous_action_total > 0
#  - strategy_pass < 47 (95%)
```

### 17.2 手动验收

| #   | 项                                          | 期望                                        |
| --- | ------------------------------------------- | ------------------------------------------- |
| 1   | 两个浏览器同时打开 watch?symbol=BTC         | 看到完全一致的消息序列                      |
| 2   | 一个浏览器进 watch，一个进 watch?symbol=ETH | 看到不同 thread                             |
| 3   | watch 页停留 5 分钟（thread completed）     | cooldown 后自动开新 thread                  |
| 4   | 模拟新闻推送（dev tool）                    | breaking_news 触发，立即开新 thread         |
| 5   | 无网络（mock fetch fail）                   | 看到 InsufficientConsensus 降级，不冒充实时 |
| 6   | 切 zh → en                                  | 同 thread 内容切到英文                      |
| 7   | 切 ja_JP                                    | 显示英文兜底 + 顶部提示                     |
| 8   | 滚动到中部，新消息到达                      | 不打断阅读 + 显示"有新讨论"按钮             |
| 9   | DevTools 限速到 3G                          | typing 节奏不漂移（client-side timer）      |
| 10  | `prefers-reduced-motion: reduce`            | 动画全部关闭，typing 时长减半               |

### 17.3 grep 校验

```bash
# 旧 round 模型不被新代码引用
! grep -rn "DebateRound\|roundNumber" src/modules/watch-chat-immersive/

# 禁词不出现在 dict 文件
! grep -rE "^.*(?:破位|趋势|Gamma 复核|实时上下文还在刷新|刚上线)" src/i18n/dict/

# 所有 message 都有 dataSource
grep -c "dataSource" src/modules/watch-chat-immersive/lib/orchestrator.ts | awk '{ if ($1 < 3) exit 1 }'
```

---

## § 18. Codex 实施指令

### 18.1 阅读顺序

1. 本文档（task-18-v3-final-locked.md）—— **决策来源，冲突时以此为准**
2. 原 plan（task-18-v3-final-comprehensive-plan.md）—— 详细 code pattern reference（D1-D15）
3. Codex review（task-18-v3-final-codex-review.md）—— 自己之前的副审意见，确认整合一致

### 18.2 冲突处理

- locked 与原 plan 冲突 → locked 赢
- locked 内有歧义 → 写信问 F（不自决）
- 原 plan 详细 code pattern 在 locked 没明说 → 直接采用原 plan 版本

### 18.3 工作分支

- 继续在 `feature/watch-chat-immersive-01` 上推进
- 6 commit 拆分（每 commit 独立可验）
- 最终一个 PR（PR #27）合并到 main

### 18.4 不能做的事

- 临场编 seed 内容（等 F 提供 `task-18-seed-threads.md`）
- 改本文档结构 / 删 § 0 决策清单
- 引入新外部依赖（除 `@vercel/kv`，且需过墨菲扫描）
- 用真名 `Mike`（用 `Dan`）

### 18.5 待 F 提供的输入

| #   | 资产                                                                     | 状态     | 阻塞 commit              |
| --- | ------------------------------------------------------------------------ | -------- | ------------------------ |
| 1   | `docs/airy-tasks/task-18-seed-threads.md`（3-5 场 seed thread 完整内容） | F 待起草 | Commit 5                 |
| 2   | `@vercel/kv` 墨菲扫描结果                                                | Dan 待跑 | Commit 2（KV flag 启用） |
| 3   | PostHog event keys 命名最终确认                                          | Dan 待拍 | Commit 6                 |

Commit 1-4 可以**先跑**，不阻塞。

---

## § 19. Anti-Rationalization（防 Codex 偷懒）

| 逃逸路径           | 表现                                                        | 不行的原因                                  | 正确做法                                      |
| ------------------ | ----------------------------------------------------------- | ------------------------------------------- | --------------------------------------------- |
| harness 走过场     | 写了 50 场但 mock LLM 只输出固定模板                        | 测不出 forbidden_prefix 在真实 LLM 下的偏离 | mock LLM 必须随机选 fewshot 或带轻度噪声      |
| KV 双写跳过        | env flag false 时不写 KV，flag true 时也忘写                | 生产环境无副本 = 出问题没法回滚             | KV 写失败必须 log + alert                     |
| seed 改名换皮      | "刚上线"→"已就绪" / "实时上下文还在刷新"→"市场数据正在同步" | 第二层风格规则禁的是行为不是字符串          | seed 文案由 F 提供，Codex 不替换措辞          |
| mention floor 软化 | 第 6 条还差 1 个 mention，retry 不到就放过                  | 用户看到的就是没 mention 的 thread          | 强制 backfill orchestrator 切换 agent         |
| 双语生成偷懒       | en thread 直接 LLM 翻译 zh thread                           | 翻译损失语气 + 双倍成本                     | 一次 LLM 调用直接出 JSON {zh, en}             |
| 共享 thread 退化   | 多 instance 时各自 in-memory 各自一份 thread                | 用户看到的依然是"独立 thread"               | KV 写为 source of truth，多 instance 拉同一份 |

---

## § 20. 文档元信息

- **创建**：2026-05-07 by F
- **基于**：v3-final-comprehensive-plan.md (主稿) + v3-final-codex-review.md (副审)
- **决策版本**：locked-v1
- **下一次允许变更**：发现实施中阻塞且 Dan 拍板时
- **冻结清单**：§ 0 决策清单 / § 1.5 上限 / § 6 slang policy / § 11 i18n fallback 表 / § 12 用户互动范围

---
