# Spec: claw42 v2.0 Batch 0 — Engineering Foundation (T28 / T29 / T31 / T32)

## 目标

claw42 v2.0 的 4 个工程基础 task，**自包含**（不依赖 v2-master-plan-locked-v2 已 merge main），独立可验。每个 task 一个独立 PR + commit。这 4 个 task 之间**无依赖**，可并发开 PR。

| Task | 内容                                              | PR 分支                         |
| ---- | ------------------------------------------------- | ------------------------------- |
| T28  | Web Vitals 上报（CLS/LCP/FCP/TTFB/INP）+ beacon   | `feature/v2-t28-web-vitals`     |
| T29  | a11y WCAG AA + axe-core verify + ar_SA RTL 测试   | `feature/v2-t29-a11y`           |
| T31  | Error Boundary + 全局错误埋点                     | `feature/v2-t31-error-boundary` |
| T32  | metrics: KV-based + log drain（JSONL 仅本地兜底） | `feature/v2-t32-metrics`        |

每个 PR base = `main`，互不依赖，可乱序 merge。

## 变更范围（共同约束）

### 不动

- claw42 当前 working tree 的 dirty state（dirty 文件是别的 task 的活）
- main 分支历史
- 现有 src 代码（除非本 task 明确要修改的文件）
- task-18 PR #27（验收中，与本 spec 无关）

### 临时切换 + 还原（GitHub 账号）

操作前记录原 active 账号 → `gh auth switch --user agentxmain-collab` → cleanup 时切回原账号（参考 `spec-v2-pr-push-via-worktree.md` 已验证模式）。

### 依赖政策（Dan 已豁免）

以下包**直接安装不走单独 SCA**（v2.0 项目级豁免）：

- `web-vitals`（T28）
- `axe-core`（T29，dev dep）
- `playwright`（T29，dev dep；v2.0 安装但不强制跑 e2e）
- `vitest`（T32 测试用，dev dep）
- `@vercel/kv`（T32）

每个 task PR 提交 `package.json` + `package-lock.json` 双向锁定。

## Hot Pursuit 资产复用源

参考但**不直接 cherry-pick**（HP 是 Next 15 / React 19，claw42 是 Next 14 / React 18）：

| Task | HP 源代码路径                                                                                                              |
| ---- | -------------------------------------------------------------------------------------------------------------------------- |
| T28  | `Hotpursuit/src/lib/observability/web-vitals.ts` + `Hotpursuit/src/components/observability/WebVitalsBeacon.tsx`（如存在） |
| T29  | `Hotpursuit/scripts/verify-a11y.mjs`（如存在）+ axe-core 集成示例                                                          |
| T31  | `Hotpursuit/src/components/AppErrorBoundary.tsx` + `Hotpursuit/src/lib/observability/error-reporter.ts`                    |
| T32  | `Hotpursuit/src/lib/storage/jsonl-writer.ts` + `Hotpursuit/src/lib/observability/metrics.ts`                               |

Codex 实施时：

1. 读 HP 源代码理解模式
2. 在 claw42 用 Next 14 / React 18 兼容方式重写
3. 不直接复制（避免 React 19 API / Next 15 API 兼容问题）

---

## T28: Web Vitals 上报

### 文件

- 新建：`src/lib/observability/web-vitals.ts`
- 新建：`src/components/observability/WebVitalsBeacon.tsx`（client component）
- 修改：`src/app/[locale]/layout.tsx`（在 root layout 引入 WebVitalsBeacon）
- 新建：`src/app/api/observability/web-vitals/route.ts`（接收 beacon）
- 修改：`package.json`（加 `web-vitals` 依赖）

### 实现要求

**`src/lib/observability/web-vitals.ts`**：

- 用 `web-vitals` 包的 `onCLS / onLCP / onFCP / onTTFB / onINP` 注册回调
- 回调统一调 `reportVital(name, value, id, navigationType)` 函数
- `reportVital` 用 `navigator.sendBeacon(url, body)`（POST），fallback `fetch(..., { keepalive: true })`
- POST 目标：`/api/observability/web-vitals`
- body：`{ name, value, id, navigationType, url, ts, sessionId }`
- sessionId：本次浏览器 session 唯一（用 `crypto.randomUUID()` + sessionStorage 缓存）

**`src/components/observability/WebVitalsBeacon.tsx`**：

- `'use client'`
- `useEffect` 一次注册所有 5 个 vitals
- 仅在生产环境 + 非测试环境 + 用户未 opt-out 时注册（opt-out 暂用 localStorage flag `claw42_observability_optout`）
- 不渲染任何 UI

**`/api/observability/web-vitals` POST**：

- 接收 body 写入 KV：key = `vitals:${date}:${name}`，value = ndjson append
- 同时写本地 JSONL（`reports/vitals/YYYY-MM-DD.jsonl`，仅 dev/preview 环境）
- 不需要鉴权（公开端点，但 rate-limit 5 req/sec/IP）

### 验收标准

- [ ] 浏览器开 claw42.ai 后 DevTools Network 有 `/api/observability/web-vitals` POST（5 个 metric 各一条）
- [ ] KV 中能 query 到当天数据
- [ ] `prefers-reduced-motion: reduce` 不影响 web-vitals 注册
- [ ] 用户加 `localStorage.claw42_observability_optout=true` 后不再发 beacon

---

## T29: a11y WCAG AA + axe-core verify

### 文件

- 新建：`scripts/verify-a11y.mjs`（用 axe-core 自动测试 a11y）
- 修改：`src/app/[locale]/layout.tsx`（确保 `lang` + `dir` attrs 正确，按 locale）
- 修改：所有 `button` / `Link` / `input`（在主要组件中）补 `aria-label` + `focus-visible` 样式
- 修改：`tailwind.config.js`（确认 `focus-visible:` variant）
- 修改：`package.json`（加 `axe-core` + `playwright` dev deps + script `verify:a11y`）
- 新建：`docs/a11y-audit.md`（首次跑完 axe 后落差报告）

### 实现要求

**color contrast**：扫描所有 Tailwind 用色，确认 4.5:1 ≥（用 axe 自动检测）。如果命中违规：

- 罗列违规位置 + 当前 ratio + 建议替代色
- 不擅自改色（写入 `docs/a11y-audit.md` 让 Dan 决策）

**focus management**：

- 所有交互元素（button / link / input）有 `focus-visible:ring-2` 或类似可见焦点样式
- modal 打开时焦点进 modal，关闭时焦点回触发元素

**aria-label**：

- icon-only button 必须有 `aria-label`
- decorative image 用 `aria-hidden="true"`
- form input 必须有 `<label>` 或 `aria-labelledby`

**`scripts/verify-a11y.mjs`**：

- 用 Playwright 启动 Chromium → 加载 `http://localhost:3000/zh_CN`、`/en_US`、`/ar_SA`、`/agent`、`/share/<id>`（如果存在）等关键路由
- 每个路由跑 axe-core 检测
- 输出 JSON report 到 `reports/a11y/YYYY-MM-DD.json`
- 失败条件：critical/serious 违规 > 0 → exit 1
- moderate / minor 违规：警告但不失败

**ar_SA RTL 测试**：

- 单独跑 `/ar_SA` 路由，确认 `<html dir="rtl">`
- 截图对比 LTR vs RTL 的关键页面（hero / agent / share），输出到 `reports/a11y/screenshots/`

### 验收标准

- [ ] `npm run verify:a11y` 跑通无 critical/serious 违规
- [ ] ar_SA 路由 `<html dir="rtl">` 正确设置
- [ ] 关键交互元素 focus-visible 样式可见（手测 + Playwright 自动测）
- [ ] `docs/a11y-audit.md` 含 color contrast / focus management / aria-label 三段审计结果

---

## T31: Error Boundary + 全局错误埋点

### 文件

- 新建：`src/components/AppErrorBoundary.tsx`（class component，捕获 React render 错误）
- 新建：`src/app/[locale]/error.tsx`（Next.js global error boundary）
- 新建：`src/lib/observability/error-reporter.ts`（统一错误上报函数）
- 修改：`src/app/[locale]/layout.tsx`（在根布局包 `AppErrorBoundary`）
- 新建：`src/app/api/observability/errors/route.ts`（接收错误 beacon）

### 实现要求

**`AppErrorBoundary.tsx`**：

- React class component（class-based，因为 Hooks 不能 catch render error）
- `componentDidCatch(error, errorInfo)` → 调 `errorReporter.report(error, errorInfo)`
- fallback UI：友好的"出错了 - 刷新重试 / 返回首页"+ 错误 ID（用于 Dan 排查）
- 不要在 fallback UI 暴露 stack trace 给用户

**`src/app/[locale]/error.tsx`**：

- Next.js App Router 自带 error boundary
- Server-side error 由这个捕获（client-side 由 AppErrorBoundary）
- 同样调 `errorReporter.report`

**`error-reporter.ts`**：

- `report(error, context)` → `navigator.sendBeacon('/api/observability/errors', body)`
- body：`{ message, stack, context, url, ts, sessionId, errorId }`
- errorId = uuid，用户在 fallback UI 看到的 ID

**`/api/observability/errors` POST**：

- 写 KV：`errors:${date}:${errorId}`
- 写本地 JSONL：`reports/errors/YYYY-MM-DD.jsonl`（dev/preview）
- rate-limit 10 req/sec/IP（防爆量）

### 验收标准

- [ ] 强制抛出 React 错误（dev mode）→ 见 fallback UI + errorId
- [ ] DevTools Network 见 `/api/observability/errors` POST
- [ ] 用户看到的 fallback UI **不含** stack trace
- [ ] errorId 在 fallback UI 可见（让 Dan 能根据 ID 查 KV）
- [ ] Server-side 错误被 `app/[locale]/error.tsx` 捕获并上报

---

## T32: Metrics — KV-based + Log Drain

### 文件

- 新建：`src/lib/observability/metrics.ts`（统一 metric 上报）
- 新建：`src/lib/storage/jsonl-writer.ts`（本地 JSONL 兜底，dev/preview only）
- 新建：`src/lib/observability/kv-metrics.ts`（KV-based metrics store）
- 修改：`package.json`（加 `@vercel/kv` + `vitest` dev dep）
- 新建：`scripts/verify-metrics.mjs`（vitest 测试覆盖）
- 修改：env 加 `KV_URL` + `KV_REST_API_URL` + `KV_REST_API_TOKEN`（仅生产）

### 实现要求

**`metrics.ts`**：

- 统一接口：`emit(metricName, properties, value?)`
- 内部分发：
  - 生产 + KV 配置存在 → 写 `@vercel/kv`
  - dev/preview → 写本地 JSONL
  - 双写都失败 → console.warn 不抛异常

**`kv-metrics.ts`**：

- 用 `@vercel/kv` 包的 `kv.set` / `kv.lpush`
- key schema：`metrics:${date}:${metricName}` 用 lpush（list）
- 每个 metric 自带 TTL 7 天（KV `ex` 参数）
- 失败重试 1 次，仍失败 fallback 到 console.warn

**`jsonl-writer.ts`**（仅 dev/preview）：

- append 到 `reports/metrics/YYYY-MM-DD.jsonl`
- 文件大小 > 10MB 自动轮转：`YYYY-MM-DD.1.jsonl`、`.2.jsonl`...
- 最多保留 5 个文件，超出删除最旧

**vitest 测试覆盖**：

- `metrics.emit` 在 dev 模式写 JSONL
- `metrics.emit` 在生产模式（mock KV）写 KV
- 失败重试逻辑
- JSONL 轮转逻辑

### 验收标准

- [ ] `npm run verify:metrics` 跑通（vitest）
- [ ] dev 模式调 `metrics.emit('test', {a: 1})` → `reports/metrics/YYYY-MM-DD.jsonl` 有记录
- [ ] 生产模式（env 变量配置）→ KV 中能 query 到
- [ ] JSONL 文件 > 10MB 自动轮转
- [ ] 双写失败时不抛异常（只 warn）

---

## 共同约束

### 每个 task PR 独立

每个 task 一个独立分支 + 独立 PR + 独立 commit message。**4 个 PR 互不依赖**，可乱序 merge。

### Branch reality audit

每个 task 实施前先：

```bash
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git fetch origin
git log --oneline -5 origin/main
```

确认 main 当前 HEAD 状态。worktree 创建用 `origin/main` 作 base。

### Worktree 模式

复用已验证的 worktree 模式（spec-v2-pr-push-via-worktree.md）：

- 每个 task 一个 worktree（`/tmp/claw42-t28` / `/tmp/claw42-t29` / `/tmp/claw42-t31` / `/tmp/claw42-t32`）
- 互不影响 claw42 主 working tree
- 完成后 cleanup

### 验收顺序（Codex 自检）

每个 task 实施完成后，**在该 worktree 内**跑：

```bash
npx tsc --noEmit          # 类型检查
npm run lint              # ESLint
npm run build             # 确保能编译
# 如果该 task 含测试：
npm run verify:<task>     # 例如 verify:a11y / verify:metrics
```

全绿后才能 push + 开 PR。

## Cleanup

```bash
cd /Users/dannybrown/Claude/职业规划/web-dev/claw42
git worktree remove /tmp/claw42-t28
git worktree remove /tmp/claw42-t29
git worktree remove /tmp/claw42-t31
git worktree remove /tmp/claw42-t32
git worktree list  # 确认只剩主 worktree
gh auth switch --user "$ORIGINAL_GH_USER"  # 切回原账号
```

## 完成后输出

```
T28 (web-vitals): PR #X https://github.com/agentxmain-collab/claw42/pull/X (status: open/draft)
T29 (a11y):       PR #X https://...
T31 (error-bnd):  PR #X https://...
T32 (metrics):    PR #X https://...

Verify per task:
  T28: tsc/lint/build pass; manual verify needed (Dan opens devtools)
  T29: verify:a11y pass / fail with N critical violations
  T31: tsc/lint/build pass; manual verify needed (Dan throws test error)
  T32: verify:metrics vitest pass

Worktree cleanup: done
GitHub account restored: <ORIGINAL_GH_USER>
Main worktree dirty state: <unchanged> (verify: count of dirty files == before)
```

## 约束

- ❌ 不要 stash / commit claw42 主 worktree 的 dirty state
- ❌ 不要 force push
- ❌ 不要 commit 到 main
- ❌ 不要修改 task-18 PR #27 的代码
- ❌ 不要把 4 个 task 合并到一个 PR
- ❌ 不要直接 cherry-pick HP 代码（必须重写适配 Next 14 / React 18）
- ❌ 不要用真名 Mike（用 Dan）
- ❌ 不要在 fallback UI 暴露 stack trace
- ❌ 不要给 web-vitals beacon 加鉴权（公开端点，rate-limit 即可）
- ✅ 允许临时切到 `agentxmain-collab` 跑 push / cleanup 时切回

## 失败处理

- **任一 task 编译失败**：停下，不 push，报回错误信息（Codex 不擅自加 polyfill 或绕过）
- **axe-core 检出 critical 违规**：T29 PR 不开，写 `docs/a11y-audit.md` 报告，Dan 决定怎么改
- **`web-vitals` package 安装失败**：检查 npm registry + Node 版本，stop and report
- **KV env 变量缺失**：T32 实施时 env 不写死，文档里说明需要 Dan 在 Vercel 配置 KV_URL 等
- **任何意外**：停下报回，**不要 force**

---
