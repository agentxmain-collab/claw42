# Spec: claw42 v2.0 Batch 1A — SignalEngine Internalization (T1-core / T1-observability / T1-auth-projection / T4-core)

## 目标

把 Hot Pursuit 的核心数据底座（SignalEngine + data-sources + types + dev metrics sink）内化到 claw42 repo，作为 v2.0 后续所有 task（T2/T3/T5/T9/T13 等）的依赖底座。**4 个 task 各开独立 PR，互不依赖，可并发。**

| Task               | 内容                                                                           | PR 分支                         |
| ------------------ | ------------------------------------------------------------------------------ | ------------------------------- |
| T1-core            | SignalEngine + data-sources + types 内化（30+ 文件 Next 14/React 18 兼容重写） | `feature/v2-t1-core`            |
| T1-observability   | metric sink 接口（dev/preview JSONL 兜底）                                     | `feature/v2-t1-observability`   |
| T1-auth-projection | 仅搭 stub，v2.0 默认不启用（auth 实现等 v2.5+）                                | `feature/v2-t1-auth-projection` |
| T4-core            | SignalEngine vitest 测试覆盖                                                   | `feature/v2-t4-core`            |

**自包含**：本 spec 含 Codex 副审 § 2 的完整文件清单，不依赖 PR #29/#30 已 merge。

## 共同约束（全 4 task 适用）

### 不动

- claw42 当前 working tree 的 dirty state
- main 分支历史
- task-18 PR #27 代码
- v2.0 master plan + codex review PR（#29/#30）

### 临时账号切换 + 还原

操作前 `ORIGINAL_GH_USER=$(...)` → `gh auth switch --user agentxmain-collab` → cleanup 时切回原账号。模式同 `spec-v2-pr-push-via-worktree.md`。

### 依赖政策（已豁免）

不需要单独 SCA：

- `vitest`（T4-core，dev dep，已豁免）
- `@vercel/kv`（T1-observability 占位，T1.1/T1.2 实施时启用，已豁免）

**新增包**走标准 `dependency-policy.md`。

### Branch reality audit（每个 task 实施前必跑）

```bash
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git fetch origin
git log --oneline -5 origin/main

cd /Users/dannybrown/Claude/职业规划/academy/Ai生态项目/Hotpursuit
git fetch origin
git log --oneline -5
```

确认 main HEAD + HP 最近 commit 状态。

### Worktree 模式

每个 task 独立 worktree（`/tmp/claw42-t1-core` / `/tmp/claw42-t1-obs` / `/tmp/claw42-t1-auth` / `/tmp/claw42-t4-core`），互不影响。完成 cleanup。

### 跨域重写规则（Codex 副审第六维：实施现实）

**严禁直接 cherry-pick HP 代码**。HP 是 Next 15 / React 19，claw42 是 Next 14 / React 18。每个文件内化时：

1. 读 HP 原文件理解模式
2. 在 claw42 用 Next 14 / React 18 兼容方式**重写**
3. 不用 React 19 only API（`use()` / `cache()` Server Components beta API 等）
4. 不用 Next 15 only API（`unstable_after()` / `forbidden()` / 新 metadata API 等）
5. 类型导入路径按 claw42 当前 `tsconfig.json` `paths` 配置

如发现 HP 代码用了 React 19 / Next 15 only API：**注释 + 标记 TODO + 用 React 18 兼容写法替代**，不要直接复制。

---

## T1-core: SignalEngine + Data Sources + Types

### 文件清单（按 Codex 副审 § 2 Q-Codex-2）

#### Must internalize（必须复制 + Next 14/React 18 重写）

**SignalEngine 核心 16 文件**（`HP/src/lib/signal-engine/` → `claw42/src/lib/signal-engine/`）：

```
action-match.ts
action-rules.ts
agent-helpers.ts
dedup.ts
derate.ts
distribution-policy.ts
filter.ts
health.ts
index.ts
ingest.ts
score.ts
schema-guard.ts
store.ts
structure.ts
types.ts
views.ts
```

**Providers 子目录 3 文件**（`HP/src/lib/signal-engine/providers/` → `claw42/src/lib/signal-engine/providers/`）：

```
index.ts
types.ts
stub.ts
```

**Data sources 7 文件**（`HP/src/lib/data-sources/` → `claw42/src/lib/data-sources/`）：

```
cryptocompare-provider.ts
health.ts
index.ts
news-provider.ts
news-translator.ts
price-provider.ts
quality.ts
```

**Storage（仅 dev fallback）**：

```
HP/src/lib/storage/jsonl-writer.ts → claw42/src/lib/storage/jsonl-writer.ts
HP/src/lib/storage/file-lock.ts → claw42/src/lib/storage/file-lock.ts
```

**注释**：file-lock 仅 dev/preview 用，不作生产 Vercel 锁。生产锁由 T1.1 KV-based lock 替代。

**辅助文件**：

```
HP/src/lib/llm-json.ts → claw42/src/lib/llm-json.ts
HP/src/lib/data/mock-db.ts → claw42/src/lib/data/mock-db.ts
```

**Types**（`HP/src/types/` → `claw42/src/types/`）：

```
common.ts
news.ts
signal.ts
calendar.ts
events.ts        (mock-db 依赖)
market.ts        (mock-db 依赖)
topics.ts        (mock-db 依赖)
```

#### Should defer（占位 stub，T2 接管）

```
HP/src/lib/signal-engine/providers/llm.ts          → stub 占位
HP/src/lib/signal-engine/llm-cache.ts              → stub 占位
HP/src/lib/signal-engine/llm-budget-tracker.ts     → stub 占位
HP/src/lib/signal-engine/llm-log.ts                → stub 占位
```

每个 stub 文件内容：

```typescript
// TODO: T2 LLM provider unification will replace this stub.
// Until then, throw to prevent silent fallback.
export const PLACEHOLDER_FOR_T2 = true;
```

并在 `providers/index.ts` 内若 import 到这些，加 `if (process.env.NODE_ENV === 'production') throw new Error('LLM providers pending T2');` 防止生产误用。

#### Do NOT internalize in T1-core

**这些文件留给后续 task 处理**：

- `HP/src/lib/signal-engine/display-labels.ts` → 留给 UI tasks（T5/T9）
- `HP/src/lib/signal-engine/dynamic-headline.ts` → 留给 T21 (Today Brief)
- `HP/src/lib/signal-engine/integration-payloads.ts` → 留给 v2.5+ /docs API
- `HP/src/lib/signal-engine/kline-chart-series.ts` → 留给 T13 (K 线 + Agent 战绩)
- `HP/src/lib/auth/*` → T1-auth-projection 只搭 stub
- `HP/src/lib/observability/*` → T28（已开 PR #31）+ T31（PR #32）+ T32（PR #33）+ T1-observability 拆分
- `HP/src/app/docs/*` → 不内化（v2.0 不开 /docs UI）
- `HP/src/app/api/signals/*` → 不内化（v2.0 不开公开 API）
- `HP/src/components/signals/*` → 不内化（v2.0 不开 /signals 列表）
- HP i18n message files → 留给后续 i18n task

### 实施步骤

```bash
# Audit
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git fetch origin

# 切账号 + 创建 worktree
ORIGINAL_GH_USER=$(gh auth status 2>&1 | awk '/Active account: true/{found=1} found && /account /{print $NF; exit}')
gh auth switch --user agentxmain-collab

git worktree add /tmp/claw42-t1-core -b feature/v2-t1-core origin/main
cd /tmp/claw42-t1-core

# Step 1: 创建目录结构
mkdir -p src/lib/signal-engine/providers
mkdir -p src/lib/data-sources
mkdir -p src/lib/storage
mkdir -p src/lib/data
mkdir -p src/types

# Step 2: 逐文件内化（重写 + Next 14/React 18 兼容）
# 工作流：
#   for each file in must-internalize list:
#     a. cat HP/src/{path} → 读原文件
#     b. 检查 React 19 / Next 15 only API
#     c. 重写为 Next 14 / React 18 + claw42 paths 兼容
#     d. 写到 claw42/src/{path}
#     e. tsc --noEmit 验证（每加一个文件后跑）

# Step 3: stub 占位 4 个 LLM-related 文件（占位待 T2）

# Step 4: tsc --noEmit 全量验证（claw42 整体）
cd /tmp/claw42-t1-core
npx tsc --noEmit
# 必须 0 错误

# Step 5: lint + build
npm run lint
npm run build

# Step 6: commit
git add src/lib/signal-engine/ src/lib/data-sources/ src/lib/storage/ src/lib/data/ src/lib/llm-json.ts src/types/
git commit -m "feat(backend): internalize signal engine + data sources + types from hot pursuit

Source: Hotpursuit/src/lib/{signal-engine,data-sources,storage,data}, src/lib/llm-json.ts, src/types/*
Target: claw42/src/lib/{signal-engine,data-sources,storage,data}, src/lib/llm-json.ts, src/types/*

- 16 SignalEngine core files (action-match/score/dedup/derate/structure/store/etc.)
- 3 providers (index/types/stub)
- 7 data sources (cryptocompare/news/price/quality/health)
- 2 storage helpers (jsonl-writer + file-lock, dev/preview only; production lock replaced by T1.1 KV-based lock)
- llm-json.ts + mock-db.ts
- 4 type files (common/news/signal/calendar) + 3 mock-db deps (events/market/topics)

LLM-related providers (providers/llm.ts, llm-cache.ts, llm-budget-tracker.ts, llm-log.ts) are stub-only,
T2 will replace with unified 5-provider abstraction (Q5 decision: \"彻底废弃 llmFallbackChain.ts\").

Files NOT internalized in T1-core (left for later tasks):
- display-labels.ts → T5/T9 UI
- dynamic-headline.ts → T21 Today Brief
- integration-payloads.ts → v2.5+ /docs
- kline-chart-series.ts → T13 K-line + Agent performance viz
- auth/* → T1-auth-projection (stub only)
- observability/* → T28/T31/T32 (already in PRs)

Refs: docs/v2-master-plan-locked-v2.md § 4 Batch 1A; docs/codex-specs/v2-master-plan-codex-review.md § 2 Q-Codex-2"

git push -u origin feature/v2-t1-core
gh pr create --base main --head feature/v2-t1-core \
  --title "feat(backend): T1-core SignalEngine + data-sources internalization" \
  --body "claw42 v2.0 Batch 1A T1-core. 30+ files internalized from Hot Pursuit, Next 14/React 18 compatible rewrite.

Stub: 4 LLM-related providers (waiting for T2)
Defer: display-labels / kline-chart-series / auth / observability / dynamic-headline / integration-payloads (other tasks)

Refs: docs/v2-master-plan-locked-v2.md § 4 Batch 1A"
```

### 验收标准

- [ ] `npx tsc --noEmit` 0 错误
- [ ] `npm run lint` 0 错误
- [ ] `npm run build` 编译通过
- [ ] 30+ 文件按清单内化完整
- [ ] 4 个 LLM-related providers 是 stub（不能直接调用）
- [ ] HP `display-labels.ts` / `kline-chart-series.ts` / `auth/*` **未**内化（按 spec 留给后续 task）
- [ ] commit message 含 source 路径 + Codex review § 2 引用
- [ ] PR base = main，diff 干净

---

## T1-observability: Metric Sink Interface

### 文件

- 新建：`src/lib/observability/metric-sink.ts`（统一 metric 接口）
- 新建：`src/lib/observability/dev-jsonl-sink.ts`（dev/preview JSONL 兜底）
- 修改：`package.json`（不加新依赖）

### 实现要求

**`metric-sink.ts`**：

```typescript
export interface MetricSink {
  emit(name: string, properties: Record<string, unknown>, value?: number): Promise<void>;
}

// 占位实现：dev 用 JSONL，生产留给 T1.1 + T32 接 KV
export const metricSink: MetricSink =
  process.env.NODE_ENV === "production"
    ? {
        emit: async () => {
          /* T1.1 + T32 will provide KV-based sink */
        },
      }
    : devJsonlSink;
```

**`dev-jsonl-sink.ts`**：

- 用 `src/lib/storage/jsonl-writer.ts`（T1-core 内化的）
- 写到 `reports/metrics/YYYY-MM-DD.jsonl`
- 大小 > 10MB 自动轮转（jsonl-writer 已支持）

### 注意

T1-observability 不做生产 KV 持久化——那是 T32（已开 PR #33）+ T1.1 / T1.2 的活。本 task 只搭**接口契约**，让 SignalEngine 调 `metricSink.emit(...)` 不报错。

### 验收标准

- [ ] `metricSink.emit('test', {a: 1})` 在 dev 环境写 `reports/metrics/YYYY-MM-DD.jsonl`
- [ ] `metricSink.emit('test', {a: 1})` 在生产环境**不抛异常**（noop）
- [ ] tsc + lint + build 全绿

---

## T1-auth-projection: Stub Only（v2.0 不启用）

### 文件

- 新建：`src/lib/auth/api-guard.ts`（stub）
- 新建：`src/lib/auth/quota.ts`（stub）
- 新建：`src/lib/auth/rate-limiter.ts`（stub）
- 新建：`src/lib/auth/types.ts`（stub）

### 实现要求

每个文件只导出**类型 + 接口**，**不实现真实 logic**。例如：

**`api-guard.ts`**：

```typescript
import type { AuthLevel } from "./types";

// TODO: v2.5+ implementation (when /docs API opens)
// Reference: HP/src/lib/auth/api-guard.ts
export async function guardApiRequest(
  request: Request,
  requiredLevel: AuthLevel,
): Promise<{ ok: boolean; reason?: string }> {
  // v2.0 default: all routes treated as public/internal
  return { ok: true };
}
```

**`types.ts`**：

```typescript
// Mirror HP auth types for future implementation parity
export type AuthLevel = "public" | "internal" | "api_key";
export interface AuthContext {
  level: AuthLevel;
  userId?: string;
  apiKey?: string;
}
```

`quota.ts` + `rate-limiter.ts` 同样 stub（noop）。

### 验收标准

- [ ] 4 个文件存在，types 完整
- [ ] 所有函数返回 noop / passthrough
- [ ] tsc + lint + build 全绿
- [ ] commit message 标 "stub only, real implementation deferred to v2.5+"

---

## T4-core: SignalEngine Vitest Coverage

### 文件

- 新建：`src/lib/signal-engine/__tests__/ingest.test.ts`
- 新建：`src/lib/signal-engine/__tests__/score.test.ts`
- 新建：`src/lib/signal-engine/__tests__/dedup.test.ts`
- 新建：`src/lib/signal-engine/__tests__/derate.test.ts`
- 新建：`src/lib/signal-engine/__tests__/structure.test.ts`
- 新建：`src/lib/signal-engine/__tests__/store.test.ts`
- 新建：`src/lib/signal-engine/__tests__/providers.test.ts`
- 新建：`vitest.config.ts`
- 修改：`package.json`（加 `vitest` dev dep + script `test:signal-engine`）

### 实现要求

**`vitest.config.ts`**：

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/lib/signal-engine/__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**测试覆盖关键 case**（按 master plan § 4 Batch 1A T4 描述）：

- 低置信度降级（`score.test.ts`）
- 多源共振（`dedup.test.ts`）
- cooldown 触发（`store.test.ts`）
- fallback 链（`providers.test.ts`，验证 stub 行为）
- ingest 异常输入（`ingest.test.ts`）
- structure schema validation（`structure.test.ts`）
- derate logic（`derate.test.ts`）

**HP 测试参考**：`HP/src/lib/signal-engine/__tests__/`（如存在）—— 不直接复制，用 vitest 风格重写。

### 验收标准

- [ ] `npm run test:signal-engine` 跑通
- [ ] ≥ 7 个 test file，每个 ≥ 3 个 test case
- [ ] 关键 case 全覆盖（低置信度 / 多源共振 / cooldown / fallback / 异常 / schema / derate）
- [ ] tsc + lint 全绿

---

## Cleanup（4 task 都完成后跑）

```bash
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git worktree remove /tmp/claw42-t1-core
git worktree remove /tmp/claw42-t1-obs
git worktree remove /tmp/claw42-t1-auth
git worktree remove /tmp/claw42-t4-core
git worktree list

# 切回原账号
gh auth switch --user "$ORIGINAL_GH_USER"
```

## 完成后输出

```
T1-core (signal-engine):  PR #X (status: open/draft, file count: Y)
T1-observability:         PR #X
T1-auth-projection:       PR #X
T4-core (vitest):         PR #X (test files: Y, test cases: Z)

Verify per task:
  T1-core: tsc/lint/build pass; HP file count Y vs internalized count Z (should equal)
  T1-observability: tsc/lint/build pass; metricSink dev test passed
  T1-auth-projection: tsc/lint/build pass; stub functions verified
  T4-core: vitest passed (Y test files, Z cases)

Worktree cleanup: done
GitHub account restored: <ORIGINAL_GH_USER>
Main worktree dirty state: <unchanged>
```

## 约束

- ❌ 不要直接 cherry-pick HP 代码（必须 Next 14 / React 18 重写）
- ❌ 不要把 4 个 task 合到一个 PR
- ❌ 不要内化 `display-labels` / `kline-chart-series` / `auth` 真实实现 / `observability/*`
- ❌ 不要实现 LLM-related providers（4 个 stub 占位等 T2）
- ❌ 不要 commit 到 main / force push
- ❌ 不要把 claw42 主 worktree dirty state 带进来
- ❌ 不要用真名 Mike（用 Dan）
- ✅ 允许临时切到 `agentxmain-collab` 跑 push / cleanup 时切回

## 失败处理

- **任一文件用了 React 19 / Next 15 only API**：注释 + TODO + React 18 兼容替代，不抛异常
- **HP 文件中含的依赖在 claw42 没有**（比如 HP 用了 `react-server-dom` 等）：报回告诉 Dan + Session C，**不要擅自加包**
- **tsc 报错**：报回错误信息 + 文件路径 + 行号，不擅自禁用 tsconfig
- **HP 文件不存在或路径偏差**：检查实际 HP 目录 + 报回偏差，不假设
- **某个文件确实需要新依赖**（如 ws / pino 等）：停下报回，等 Dan 走 dependency-policy SCA

---
