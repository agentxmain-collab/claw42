# Spec: claw42 v2.0 Batch 1B — KV Abstractions (T1.1 Lock + T1.2 Rate Limiter)

## 目标

为 v2.0 多 instance（Vercel serverless）场景提供 distributed coordination：

| Task | 内容                                                              | PR 分支                        |
| ---- | ----------------------------------------------------------------- | ------------------------------ |
| T1.1 | KV-based distributed lock（SETNX with TTL）+ vitest               | `feature/v2-t1-1-kv-lock`      |
| T1.2 | KV-based rate limiter / quota store（替代 HP file-based）+ vitest | `feature/v2-t1-2-kv-ratelimit` |

**两 task 互不依赖，可并发开 PR。**

依赖：T1-core（Batch 1A）必须 merge main 后再启动 Batch 1B（因为本 task 需要 `src/lib/storage/file-lock.ts` 作 dev fallback 参考）。如果 T1-core 仍在 PR 状态未合 main，本 spec 实施可暂用本地 main + T1-core PR 分支并行。

## 共同约束

继承 `spec-batch1a-signalengine-internalization.md` 的共同约束（不动 dirty state / 临时账号切换 / Branch reality audit / Worktree 模式 / 跨域重写规则 / 依赖政策已豁免 6 包）。

新增依赖：`@vercel/kv`（已在 v2.0 项目级豁免清单内，可直接安装）。

## 技术上下文

### Vercel KV 简介

`@vercel/kv` 是 Vercel 官方的 Redis-compatible 客户端，serverless-friendly。基础 API：

- `kv.set(key, value, options?)` —— 写入，options 含 `ex` (TTL seconds), `nx` (only if not exists)
- `kv.get(key)`
- `kv.del(key)`
- `kv.expire(key, seconds)`
- `kv.incr(key)` / `kv.incrby(key, n)` —— 原子递增
- `kv.lpush(key, value)` / `kv.lrange(key, start, end)` —— 列表
- `kv.eval(script, keys, args)` —— Redis Lua 脚本（高级用法，本 spec 暂不用）

### Env 配置

需要 Vercel 项目配置 KV 实例（Dan 在 Vercel dashboard 操作）后自动注入：

```
KV_URL
KV_REST_API_URL
KV_REST_API_TOKEN
KV_REST_API_READ_ONLY_TOKEN
```

dev/preview 环境若 KV 未配置 → fallback 到 in-memory（`Map<string, value>`）+ console.warn 一次。

---

## T1.1: KV-based Distributed Lock

### 文件

- 新建：`src/lib/storage/kv-lock.ts`（核心 lock 实现）
- 新建：`src/lib/storage/__tests__/kv-lock.test.ts`（vitest）
- 修改：`package.json`（加 `@vercel/kv` 依赖）

### 实现要求

**`kv-lock.ts`** 核心 API：

```typescript
import { kv } from "@vercel/kv";

export interface LockOptions {
  /** TTL in milliseconds. After this, lock auto-expires (safety net). Default 30000. */
  ttlMs?: number;
  /** How long to wait for lock before giving up. 0 = fail immediately. Default 0. */
  waitMs?: number;
}

export interface LockHandle {
  key: string;
  token: string; // 唯一 lock owner token，用于安全释放
  acquiredAt: number;
}

/**
 * 尝试获取分布式锁。SETNX with TTL pattern。
 * 多 instance 同时调用同一 key 时，只有一个返回 LockHandle，其他返回 null。
 */
export async function tryAcquireLock(
  key: string,
  options: LockOptions = {},
): Promise<LockHandle | null>;

/**
 * 释放锁。仅当 token 匹配时才释放（避免误释放别人的锁）。
 * 用 Lua 脚本保证 check + del 原子性，否则用乐观并发 fallback。
 */
export async function releaseLock(handle: LockHandle): Promise<boolean>;

/**
 * 高级封装：在 lock 保护下执行 fn。lock 失败则 throw LockBusyError。
 */
export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  options?: LockOptions,
): Promise<T>;
```

### 实施细节

**Acquire（用 `kv.set` 的 `nx` + `px` 选项）**：

```typescript
const token = crypto.randomUUID();
const ttlMs = options.ttlMs ?? 30000;

const result = await kv.set(`lock:${key}`, token, {
  nx: true, // only if not exists
  px: ttlMs, // TTL in milliseconds
});

if (result === "OK") {
  return { key, token, acquiredAt: Date.now() };
}
return null;
```

**Release（用 Lua 保证原子性）**：

```typescript
// 注意：Vercel KV 支持 eval（Redis EVAL）
const RELEASE_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

const result = await kv.eval(RELEASE_SCRIPT, [`lock:${key}`], [token]);
return result === 1;
```

**`waitMs` 实现**：如果 `acquireLock` 失败 + `waitMs > 0`，poll 重试（间隔 50-200ms 指数退避，cap at 1s）直到 timeout。

**Fallback：dev/preview 无 KV 时**：

- 用进程内 `Map<string, { token, expiresAt }>` 模拟
- console.warn 一次："KV not configured, using in-memory lock fallback (single instance only)"
- 仍然支持 SETNX + TTL 语义

**LockBusyError**：

```typescript
export class LockBusyError extends Error {
  constructor(
    public readonly key: string,
    public readonly waitedMs: number,
  ) {
    super(`Failed to acquire lock for "${key}" within ${waitedMs}ms`);
    this.name = "LockBusyError";
  }
}
```

### 测试覆盖（`__tests__/kv-lock.test.ts`）

vitest 用 mock `@vercel/kv` 测试：

- ✅ `tryAcquireLock` 第一次成功返回 LockHandle
- ✅ 同 key 第二次（无释放）返回 null
- ✅ TTL 到期后第三次成功
- ✅ `releaseLock` token 匹配释放成功
- ✅ `releaseLock` token 不匹配返回 false（不误删）
- ✅ `withLock` 包裹的函数正常返回值
- ✅ `withLock` 包裹的函数抛错时锁被释放
- ✅ `withLock` 锁繁忙抛 LockBusyError
- ✅ in-memory fallback：dev 环境无 KV 时正常工作
- ✅ in-memory fallback：TTL 过期机制正确

### 验收标准

- [ ] `npm run test:kv-lock` 跑通（vitest）
- [ ] tsc + lint + build 全绿
- [ ] dev 环境（无 KV env）测试用 in-memory 自动 fallback
- [ ] commit message 含 SETNX + TTL pattern + Lua release script 说明

---

## T1.2: KV-based Rate Limiter / Quota Store

### 文件

- 新建：`src/lib/storage/kv-rate-limiter.ts`
- 新建：`src/lib/storage/kv-quota.ts`
- 新建：`src/lib/storage/__tests__/kv-rate-limiter.test.ts`
- 新建：`src/lib/storage/__tests__/kv-quota.test.ts`

### 实现要求

**`kv-rate-limiter.ts`**：固定窗口 rate limiter

```typescript
export interface RateLimitOptions {
  /** Max requests in the window */
  max: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // epoch ms
}

/**
 * 检查给定 key 在窗口内是否还有配额。如有，配额-1 并 allow；否则 deny。
 *
 * Pattern: kv.incr(key) with TTL on first increment.
 * 多 instance 共享同一 KV → 全局一致 rate limit。
 */
export async function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult>;
```

**实现核心**：

```typescript
const fullKey = `rate:${key}:${windowStart}`; // windowStart = floor(Date.now() / windowMs) * windowMs
const count = await kv.incr(fullKey);
if (count === 1) {
  // 首次增加，set TTL
  await kv.expire(fullKey, Math.ceil(options.windowMs / 1000));
}

const allowed = count <= options.max;
const remaining = Math.max(0, options.max - count);
const resetAt = windowStart + options.windowMs;

return { allowed, remaining, resetAt };
```

**`kv-quota.ts`**：每日/每月配额（基于日期 key）

```typescript
export interface QuotaOptions {
  /** Quota period: 'daily' | 'monthly' */
  period: "daily" | "monthly";
  /** Max usage in period */
  limit: number;
}

export interface QuotaResult {
  allowed: boolean;
  used: number;
  remaining: number;
  resetAt: number;
}

/**
 * 检查并扣减配额。同一 key + 同一 period 共享 counter。
 *
 * Daily key: `quota:daily:${key}:${YYYY-MM-DD}`
 * Monthly key: `quota:monthly:${key}:${YYYY-MM}`
 */
export async function consumeQuota(
  key: string,
  amount: number,
  options: QuotaOptions,
): Promise<QuotaResult>;

/**
 * 仅查询不扣减
 */
export async function peekQuota(key: string, options: QuotaOptions): Promise<QuotaResult>;
```

**实现核心（consume）**：

```typescript
const periodKey = options.period === 'daily'
  ? new Date().toISOString().slice(0, 10)  // YYYY-MM-DD
  : new Date().toISOString().slice(0, 7);   // YYYY-MM

const fullKey = `quota:${options.period}:${key}:${periodKey}`;
const used = await kv.incrby(fullKey, amount);

if (used === amount) {
  // 首次写入，set TTL
  const ttlSeconds = options.period === 'daily' ? 86400 * 2 : 86400 * 35;
  await kv.expire(fullKey, ttlSeconds);
}

if (used > options.limit) {
  // 超额，回滚
  await kv.decrby(fullKey, amount);
  return { allowed: false, used: used - amount, remaining: 0, resetAt: ... };
}

return { allowed: true, used, remaining: options.limit - used, resetAt: ... };
```

**Fallback：dev/preview 无 KV 时**：

- 用进程内 `Map<string, number>` 模拟 counter
- 不支持跨 instance 一致（warn 一次）

### 测试覆盖

`__tests__/kv-rate-limiter.test.ts`：

- ✅ 窗口内 N 次请求都 allow（N <= max）
- ✅ 第 max+1 次 deny
- ✅ TTL 过期后窗口重置，第 max+1 次又 allow
- ✅ 不同 key 独立计数
- ✅ in-memory fallback 正确
- ✅ `remaining` / `resetAt` 计算正确

`__tests__/kv-quota.test.ts`：

- ✅ daily 配额累计扣减
- ✅ 跨日 key 自动切换
- ✅ monthly 配额累计扣减
- ✅ 跨月 key 自动切换
- ✅ 超额时自动回滚 amount，不部分扣减
- ✅ `peekQuota` 不修改状态
- ✅ in-memory fallback 正确

### 验收标准

- [ ] `npm run test:kv-rate-limiter` + `npm run test:kv-quota` 跑通
- [ ] tsc + lint + build 全绿
- [ ] daily / monthly 跨期切换测试通过
- [ ] 超额回滚测试通过
- [ ] in-memory fallback 在 dev 环境工作

---

## Cleanup

```bash
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git worktree remove /tmp/claw42-t1-1-kv-lock
git worktree remove /tmp/claw42-t1-2-kv-ratelimit
git worktree list

gh auth switch --user "$ORIGINAL_GH_USER"
```

## 完成后输出

```
T1.1 (kv-lock):       PR #X (test count: Y)
T1.2 (kv-ratelimit):  PR #X (test count: Y)

Verify per task:
  T1.1: vitest pass (10 cases) / tsc/lint/build pass
  T1.2: vitest pass (13 cases) / tsc/lint/build pass

Worktree cleanup: done
GitHub account restored: <ORIGINAL_GH_USER>
Main worktree dirty state: <unchanged>

Note: KV not configured in CI/dev env, fallback to in-memory tested. Production KV requires Dan to configure Vercel KV instance.
```

## 约束

- ❌ 不要 commit @vercel/kv 之外的新依赖（已豁免清单仅含这一个 KV 包）
- ❌ 不要 force push
- ❌ 不要绕过 SETNX + TTL pattern（不要用单纯 set + del，不安全）
- ❌ 不要在 release 时无 token 校验直接 del（会误删别人的 lock）
- ❌ 不要把 4 个 task（T1.1 + T1.2）合到一个 PR
- ❌ 不要用真名 Mike（用 Dan）
- ✅ 允许临时切到 `agentxmain-collab` push / cleanup 时切回

## 失败处理

- **`@vercel/kv` 安装失败**：检查 npm registry + Node 版本，stop and report。**不要替换为别的 KV 客户端**
- **`kv.eval` Lua 脚本不被 Vercel KV 支持**（API limit）：fallback 用 GET + DEL 两步乐观并发（接受罕见误删风险，写在 spec 里说明）
- **vitest mock `@vercel/kv` 失败**：用 `vi.mock('@vercel/kv', ...)` 重写 mock，参考 vitest 官方 mock 文档
- **任何 KV API 行为偏离 spec**（如 TTL 不准 / SETNX 行为异常）：报回，不擅自调整
- **build 失败**：报回错误信息 + 文件路径

---
