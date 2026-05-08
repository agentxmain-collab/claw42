# Task 14 — claw42 工程化基线建立（按 A 级规范深度评审 + 修复）

> **触发**：Dan directive 2026-04-30。F 按 `总调度/methodology/engineering-standards.md` v1.0.1 对 claw42（A 级）做深度评审，43 个 .ts/.tsx 文件 / 4168 行 / Next 14.2.35 + React 18 + TS 5 + npm。
>
> **结论**：claw42 当前处于 **Phase 1（基线建立）阶段中后期**。已落地：TS strict / lockfile / dependency-policy.md / 输入校验初步 / fallback 链。**严重缺失**：测试套件 / CI / Sentry / web-vitals / Lighthouse / ARCHITECTURE.md / ADR / 安全头 / Prettier / typecheck script。
>
> **执行者**：Codex（分 3 阶段 commit，P0-P2）
>
> **新分支**：`feature/engineering-baseline-p0-01`（先做 P0，P1/P2 后续 task）
>
> **PR target**：`feature/act1-5-watch-page-01`（不变，最终走主线）
>
> **不影响**：当前在跑的 task-12 stream redesign + task-13 hero daily brief（这两个是产品功能，本 task 是工程化基础设施，并行）

---

## § A 评审报告（按 engineering-standards.md 9 维度逐项）

### 当前事实清单

```
项目：claw42 (package.json name="claw42-temp" 仍未改)
技术栈：Next 14.2.35 / React 18 / TypeScript 5 / Tailwind 3.4
代码量：43 个 .ts/.tsx 文件 / 4168 行
部署：Vercel（claw42.ai 已上线）
分支：docs/architecture-review-cross-check-01
依赖文档：dependency-policy.md（A 级 + 墨菲 SCA）✅
```

### A.1 测试维度（§ 2）— 0 分

| 项               | A 级要求            | 现状           | Δ   |
| ---------------- | ------------------- | -------------- | --- |
| typecheck script | 必跑                | 无             | ❌  |
| lint script      | 必跑                | ✅ `next lint` | OK  |
| unit/integration | Vitest + 60% 覆盖   | **0 测试文件** | ❌  |
| E2E              | Playwright 10-20 条 | **未接入**     | ❌  |
| Testing Library  | DOM 组件测试        | 无             | ❌  |

**风险点**：AI 代码（Claude/Codex 主写）4168 行 0 测试 → 任何 PR 改动靠人眼 + Dan 手测验收。规范明确"AI 代码最容易看起来能跑、边界错"。

### A.2 性能维度（§ 3）— 0 分

| 项                  | A 级要求               | 现状 | Δ   |
| ------------------- | ---------------------- | ---- | --- |
| Lighthouse CI       | 核心页面预算阻塞       | 无   | ❌  |
| web-vitals 真实用户 | LCP/INP/CLS p75 上报   | 无   | ❌  |
| bundle 监控         | size-limit 或 analyzer | 无   | ❌  |
| 首屏 JS 预算        | < 170KB gzip           | 未测 | ❌  |

**风险点**：HeroScene（CoinsLayer 442 行 + framer-motion）+ AgentWatchBoard 都是客户端组件，bundle 可能已超预算无人知道。

### A.3 监控维度（§ 4）— 1/5 分

| 项             | A 级要求                | 现状                  | Δ              |
| -------------- | ----------------------- | --------------------- | -------------- |
| Sentry         | 必接 + release/version  | **无**                | ❌             |
| PostHog        | funnel + session replay | **自建 console.info** | ❌             |
| OpenTelemetry  | 可选                    | 无                    | OK（B-A 才需） |
| 错误告警 owner | 有                      | 无                    | ❌             |

**严重发现**：`/api/analytics/route.ts` 收到事件后 `console.info(JSON.stringify(event))` 直接打 stdout —— Vercel logs 里能看，但**没存储 / 没分析 / 没 funnel / 没 session replay**。事实上是"假装有 analytics"。空 catch 块吞异常 2 处（`page.tsx:81` / `analytics.ts:44`）。

### A.4 架构维度（§ 5）— 1/3 分

| 项                       | A 级要求 | 现状                                                                      | Δ   |
| ------------------------ | -------- | ------------------------------------------------------------------------- | --- |
| ARCHITECTURE.md（10 段） | 必有     | **无**（有 `docs/claw42-agent-service-architecture.md` 但不是 10 段格式） | ❌  |
| ADR 目录 + 重大决策      | 必有     | **无 docs/adr/**                                                          | ❌  |
| 禁止路径明文             | 必有     | 无                                                                        | ❌  |

**风险点**：AI 协作没有"禁止路径"清单 → Codex 可以任意改 middleware / env / API auth → 这是 AI 代码最大的失控源。

### A.5 代码质量维度（§ 6）— 2/5 分

| 项                             | A 级要求     | 现状                  | Δ   |
| ------------------------------ | ------------ | --------------------- | --- |
| TypeScript strict              | strict: true | ✅                    | OK  |
| 禁止 any 扩散                  | 无           | ✅ grep 无 `any` 滥用 | OK  |
| ESLint                         | flat config  | v8 + 极简 extends     | ⚠️  |
| Prettier                       | 必有         | **无 .prettierrc**    | ❌  |
| typecheck script               | 必有         | **无 `tsc --noEmit`** | ❌  |
| simple-git-hooks + lint-staged | 必有         | 无                    | ❌  |

**当前 .eslintrc.json 仅 1 行**：`{"extends": ["next/core-web-vitals", "next/typescript"]}` — 没有自定义规则集，没有 import order / unused / no-console 等规则。

### A.6 发布维度（§ 7）— 1/5 分

| 项                        | A 级要求 | 现状                                  | Δ   |
| ------------------------- | -------- | ------------------------------------- | --- |
| GitHub Actions CI         | 必有     | **无 .github/workflows**              | ❌  |
| main 分支保护 + PR checks | 必有     | 未配置                                | ❌  |
| Preview 验收              | 已用     | ✅ Vercel preview                     | OK  |
| 发布前 checklist          | 必有     | 无                                    | ❌  |
| Conventional Commits      | 必有     | ⚠️ 部分遵守                           | ⚠️  |
| CHANGELOG / Releases      | 必有     | 无                                    | ❌  |
| Rollback 路径             | 明确     | Vercel instant rollback ✅ 但无文档化 | ⚠️  |

### A.7 依赖维度（§ 8）— 3/5 分

| 项                   | A 级要求   | 现状                                       | Δ   |
| -------------------- | ---------- | ------------------------------------------ | --- |
| dependency-policy.md | 必有       | ✅                                         | OK  |
| lockfile committed   | 必         | ✅ package-lock.json                       | OK  |
| frozen install in CI | 必         | 无 CI                                      | ❌  |
| 墨菲 SCA             | 必扫       | 流程已写但靠 Dan 手动                      | ⚠️  |
| 高危漏洞处理         | 上线前卡点 | known_baseline=4 高危 1 中危**存量未升级** | ⚠️  |

**判断**：next 14.2.35 已知 4 高危是规范允许的"A 级存量不强改"原则下豁免，OK。但**新增依赖时 sync 块流程依赖 Dan 路由**，缺少 PR 自动检测 package.json 变更触发提示。

### A.8 安全维度（§ 9）— 2/5 分

| 项                        | A 级要求     | 现状                                                                        | Δ   |
| ------------------------- | ------------ | --------------------------------------------------------------------------- | --- |
| Secret scanning           | 必开         | GitHub 默认开 ✅                                                            | OK  |
| Secret 不入 repo          | 硬底线       | ✅ env 都用 process.env                                                     | OK  |
| API 输入校验              | 覆盖外部输入 | ✅ /api/analytics 手写校验（可接受）                                        | ⚠️  |
| CSP / HSTS                | 必开         | **next.config.mjs 无 security headers**                                     | ❌  |
| Zod / Valibot             | 推荐         | 无                                                                          | ⚠️  |
| API 鉴权                  | 必有         | `/api/agents/analysis` `/api/market/ticker` **完全公开**无鉴权无 rate limit | ❌  |
| /api/analytics rate limit | 推荐         | 无                                                                          | ⚠️  |

**严重发现**：

- `/api/agents/analysis` GET 公开 → 任何人调用消耗 LLM 配额（minimax/deepseek/anthropic API key）→ **拒绝服务 + 成本漏洞**
- `/api/market/ticker` GET 公开 → 任何人当 CoinGecko 中转
- 无 CSP / 无 HSTS → 浏览器安全基线缺失

### A.9 跨维度（§ 10）— 2/6 分

| 项                      | A 级要求                 | 现状                                   | Δ   |
| ----------------------- | ------------------------ | -------------------------------------- | --- |
| Node 版本锚定           | .nvmrc 或 packageManager | **无**                                 | ❌  |
| README 含启动命令       | 必有                     | **README 是 create-next-app 默认模板** | ❌  |
| Conventional Commits    | 推荐                     | 部分                                   | ⚠️  |
| `codex/` 分支前缀       | 推荐                     | ⚠️ 部分（`feature/codex-*`）           | ⚠️  |
| PR template             | 推荐                     | 无                                     | ❌  |
| 调试说明                | 推荐                     | 无                                     | ❌  |
| Source map 策略         | 推荐                     | 默认（生产打开）                       | ⚠️  |
| AI handoff（spec 保留） | 必                       | ✅ docs/airy-tasks 完整                | OK  |

### 总评分

| 维度     | A 级满分 | 当前得分 | 关键债                            |
| -------- | -------- | -------- | --------------------------------- |
| 测试     | 5        | 0        | 全无                              |
| 性能     | 5        | 0        | 全无                              |
| 监控     | 5        | 1        | 假 analytics                      |
| 架构     | 5        | 1        | 无 ARCHITECTURE 无 ADR            |
| 代码质量 | 5        | 2        | 无 typecheck script / 无 Prettier |
| 发布     | 5        | 1        | 无 CI                             |
| 依赖     | 5        | 3        | 无 frozen install in CI           |
| 安全     | 5        | 2        | API 公开 + 无 CSP                 |
| 跨维度   | 5        | 2        | README 默认 / 无 .nvmrc           |
| **合计** | **45**   | **12**   | 26.7%                             |

**结论**：claw42 作为 A 级项目当前工程化基线达成度约 **27%**，**没达到上线 production 标准**（按规范 Phase 1 要求）。但产品功能仍在快速迭代中，不能停下来全面整改 → 分阶段补，不阻塞产品开发。

---

## § B 修复 spec（分 P0/P1/P2，3 个独立 commit）

按 § 11 Phase 落地路径优先级 + 防事故 ROI 排序。

### P0 — 立即必做（Phase 1 基线）

**目标**：补完工程化最低门槛，AI 代码不再失控。

#### P0.1 — package.json scripts + 工具补全

```json
{
  "name": "claw42",
  "version": "0.1.0",
  "private": true,
  "packageManager": "npm@10.8.0",
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,md,json,css}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx,md,json,css}\"",
    "verify": "npm run typecheck && npm run lint && npm run format:check && npm run build"
  },
  "devDependencies": {
    /* 已有依赖保留 */
    "prettier": "^3.3.0",
    "prettier-plugin-tailwindcss": "^0.6.0"
  }
}
```

**改动**：

- `name`: `claw42-temp` → `claw42`（dependency-policy 已 flag 待改）
- 加 `packageManager` + `engines.node`
- 加 `typecheck` / `format` / `format:check` / `verify` 4 个 script
- 加 `prettier` + `prettier-plugin-tailwindcss` devDep

#### P0.2 — `.nvmrc`

```
20.18.0
```

文件路径：`.nvmrc`（项目根）

#### P0.3 — `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

#### P0.4 — `next.config.mjs` 加安全头

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // CSP 起步用 Report-Only，确认无破坏后再 enforce
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.coingecko.com https://api.alternative.me https://api.minimaxi.com https://api.deepseek.com https://api.anthropic.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

**注意**：CSP 用 `Report-Only` 起步（不 enforce），观察一周确认无误伤再升级到强制模式（Phase 2 落地）。

#### P0.5 — API 路由加最小限流（防 LLM 配额耗尽）

新建 `src/lib/rateLimit.ts`：

```ts
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}

// 5min 自动清理过期 buckets
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}, 5 * 60_000);
```

修改 `/api/agents/analysis/route.ts`：

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getAgentAnalysis } from "@/lib/llmFallbackChain";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  // 单 IP 每分钟最多 30 次（保守值，可后续调）
  if (!rateLimit(`agents:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const payload = await getAgentAnalysis();
  return NextResponse.json(payload);
}
```

`/api/market/ticker/route.ts` 同处理（限频 60/min/ip，CoinGecko 中转更宽松）。

`/api/analytics/route.ts` 加限频（限频 60/min/ip，防刷分析事件）。

#### P0.6 — `ARCHITECTURE.md`（10 段）

新建 `ARCHITECTURE.md` 在项目根。10 段按规范模板：

```markdown
# claw42 Architecture

## 1. 项目定位

Claw 42 — 加密货币 AI Agent 竞技养成生态对外产品站。当前阶段：Act 1 落地页 + Act 1.5 Watch（实时盯盘）。

## 2. 技术栈

| 层         | 选型                        | 版本     | 选型理由                            |
| ---------- | --------------------------- | -------- | ----------------------------------- |
| 框架       | Next.js                     | 14.2.35  | App Router + React 18 + Vercel 一体 |
| 样式       | Tailwind CSS                | 3.4.1    | 工程团队熟悉，Next 一体集成         |
| 动效       | framer-motion               | 11.18.2  | Hero 场景 + 渐次出现动画必需        |
| TypeScript | strict                      | 5.x      | 最低成本测试层                      |
| LLM        | minimax / deepseek / claude | API      | fallback chain，可降级              |
| 行情       | CoinGecko API               | demo key | 免费层 + 30s cache                  |

## 3. 目录结构 + 模块边界

\`\`\`
src/
app/ # Next.js App Router
[locale]/ # i18n 路由根（10 语）
api/ # API routes（agents / market / analytics）
components/ # 跨模块共享 UI
lib/ # 服务端 + 客户端工具
llmFallbackChain.ts # LLM 调用 + fallback
marketDataCache.ts # CoinGecko cache + stale-while-revalidate
analytics.ts # 客户端事件上报
rateLimit.ts # API 限流（P0.5 新加）
i18n/ # 10 语 dict + Provider
modules/
landing/ # 首页（Hero / Scenarios / Skills / StartTrade）
agent-watch/ # /agent watch 页（task-09 ~ task-12）
\`\`\`

**模块边界**：

- `lib/` 不依赖 `modules/`
- `modules/landing` 不依赖 `modules/agent-watch`，反之亦然
- API routes 只调用 `lib/`，不直接调 `modules/`

## 4. 状态管理 / 数据流

\`\`\`
[CoinGecko] ──30s cache──> marketDataCache.ts ──> /api/market/ticker
│
▼
[client useEffect 60s poll] ──> setMarketData state ──> watch UI
│
[LLM provider chain] ──60s cache──> llmFallbackChain.ts ──> /api/agents/analysis
\`\`\`

主要数据流：客户端 60s 轮询服务端 → 服务端缓存 30s 真实 API。stale-while-revalidate 策略保证降级。

## 5. 认证 / 权限边界

**当前状态**：claw42 是只读公开站，**无用户系统、无登录、无支付**。

**API 路由策略**：

- `/api/market/ticker` — 公开 + 限流 60/min/ip
- `/api/agents/analysis` — 公开 + 限流 30/min/ip（保护 LLM 配额）
- `/api/analytics` — 公开 + 限流 60/min/ip + 事件白名单

未来若加用户系统，必须新增 ADR 决策认证方案。

## 6. 性能预算

- LCP p75 < 2.5s（移动端）
- INP p75 < 200ms
- CLS p75 < 0.1
- 首屏 JS bundle < 170KB gzip
- Lighthouse CI 移动端分数 ≥ 85

工具：Lighthouse CI（Phase 2 接入）+ web-vitals 真实用户上报（Phase 3 接入）。

## 7. 测试策略

按 Testing Trophy：

- 静态层：TS strict + ESLint（已有）
- Unit：仅 pure utility（lib/marketDataCache / rateLimit / analytics 字段清洗等）
- Integration：API route 端到端 + 关键组件交互（Phase 2 接入 Vitest）
- E2E：Playwright 10-20 条 critical path（Hero CTA / Watch 页加载 / 语言切换 / API 降级 / 错误页 等）

## 8. 部署流程

\`\`\`
本地 push → feature/\* 分支 → Vercel 自动 preview deployment
↓
Dan 验收
↓
merge to feature/act1-5-watch-page-01（act1.5 集成分支）
↓
merge to main（手动）→ Vercel auto deploy production
\`\`\`

**Rollback**：Vercel instant rollback（dashboard 点击上一版本）+ git revert + redeploy。

## 9. ❗ 禁止路径（AI 协作专用）

任何 Codex / Claude spec **不允许触碰**以下路径，触碰必须先 Dan 显式批准：

- `next.config.mjs` — security headers / CSP 改动需要安全评估
- `src/middleware.ts` — i18n 路由 + 后续认证中间件，逻辑改动需 Dan 评估
- `src/app/api/**/route.ts` — API 鉴权 / 限流 / 输入校验逻辑（仅可加新 route，改既有 route 需 ADR）
- `package.json` 依赖列表 — 必走 dependency-policy 11 步流程
- `.env.local` / 任何 secret 文件 — 不入 git
- `vercel.json` / `.vercel/` — 部署配置
- `tsconfig.json` 的 `strict` 字段 — 不允许关
- 生产 secret（API key / token）— 不直接写 fallback 默认值

**AI 改动这些路径前必须显式声明**："本改动涉及禁止路径 X，原因 Y，请 Dan 确认"。

## 10. 升级路径 + 已知技术债

**已知债**（按规范允许的"A 级存量不强改"豁免）：

- next 14.2.35 — 4 高危漏洞（dependency-policy known_baseline 已记录）
- 无 Sentry / web-vitals / PostHog（Phase 3 接入）
- 无 Vitest / Playwright（Phase 2 接入）
- 无 GitHub Actions CI（Phase 3 接入）
- /api/analytics 仅 console.info（Phase 3 接入 PostHog 替代）
- HeroScene/CoinsLayer.tsx 442 行（可 Phase 4 拆分）

**升级路径**：

- Phase 2（task-15）：Vitest + Playwright + Lighthouse CI + size-limit
- Phase 3（task-16）：Sentry + PostHog + GitHub Actions CI + Release checklist
- Phase 4（task-17+）：测试覆盖率 60% + ADR 沉淀 + 性能优化
```

#### P0.7 — `docs/adr/0001-architecture-baseline.md`（首个 ADR）

```markdown
# ADR 0001: 工程化基线建立路径

## Status

Accepted

## Context

2026-04-30 Dan directive：claw42 是 A 级项目，按 engineering-standards.md v1.0.1 评审基线达成度仅 27%。直接全面整改会阻塞产品功能迭代（task-12 stream redesign / task-13 hero daily brief 在跑），需要分阶段方案。

## Decision

分 3 阶段补：

- P0（立即）：scripts / Prettier / .nvmrc / 安全头 / API 限流 / ARCHITECTURE.md / ADR 目录 — task-14
- P1（产品功能稳定后）：Vitest + Playwright + Lighthouse CI + size-limit — task-15
- P2（上线评审前）：Sentry + PostHog + GitHub Actions CI + Release checklist — task-16

P0 不阻塞当前在跑 task，独立 PR 推。P1/P2 等当前 task 落地后启动。

## Consequences

**收益**：

- AI 协作有"禁止路径"明文（ARCHITECTURE.md § 9），降低 Codex 失控风险
- 安全头 + API 限流 → 立即降低成本/拒绝服务漏洞
- typecheck script + Prettier → CI 接入前提

**代价**：

- 当前 PR review 流程不变（仍靠 Dan 手测）— 直到 P1 测试套件落地
- CSP 用 Report-Only 起步可能需要后续调整放行域名

**不可逆性**：低。每个改动都可独立 revert。

## 关联

- engineering-standards.md v1.0.1
- task-14（本任务）
- task-15 / task-16（待启动）
```

#### P0.8 — `README.md` 重写

```markdown
# claw42

加密货币 AI Agent 竞技养成生态对外产品站。

🌐 **Production**: https://claw42.ai

## 技术栈

- Next.js 14.2 (App Router) + React 18 + TypeScript 5
- Tailwind CSS 3.4 + framer-motion
- 部署：Vercel

## 开发

### 前置

- Node.js >= 20.0.0（见 `.nvmrc`）
- npm 10.x（见 `package.json` packageManager）

### 启动

\`\`\`bash
nvm use # 切到 .nvmrc 指定版本
npm install # 装依赖
cp .env.local.example .env.local # 配置 env（首次）
npm run dev # 启动开发服务器 http://localhost:3000
\`\`\`

### Env 变量

`.env.local` 必填（见 `.env.local.example`）：

- `MINIMAX_API_KEY` — 主 LLM provider（fallback 链首）
- `DEEPSEEK_API_KEY` — 备用 LLM provider
- `ANTHROPIC_API_KEY` — 第三 fallback
- `COINGECKO_API_KEY` — 行情数据（demo key 即可）

### 验证

\`\`\`bash
npm run verify # 跑 typecheck + lint + format:check + build
\`\`\`

PR 提交前必须 verify 通过。

## 目录结构

见 `ARCHITECTURE.md`。

## 文档

- `ARCHITECTURE.md` — 架构 + 禁止路径
- `dependency-policy.md` — 依赖变更流程
- `docs/adr/` — 架构决策记录
- `docs/airy-tasks/` — 任务 spec（按 task-NN 命名）
- `docs/codex-specs/` — Codex 派发 spec
- `docs/reviews/` — 评审记录

## 协作

本项目代码主要由 AI（Claude/Codex）写，Dan 路由 + 验收。
**AI 不允许触碰 `ARCHITECTURE.md § 9` 列出的禁止路径**，必须显式 Dan 批准。

## License

Private. Owned by Dan.
```

#### P0.9 — `.env.local.example`

新建（不 commit 真实值）：

```bash
# LLM Providers (fallback chain order: minimax → deepseek → claude)
MINIMAX_API_KEY=your_key_here
MINIMAX_MODEL=MiniMax-Text-01
MINIMAX_ENDPOINT=https://api.minimaxi.com/v1/text/chatcompletion_v2
DEEPSEEK_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

# Market Data
COINGECKO_API_KEY=your_demo_key_here
```

#### P0.10 — `CHANGELOG.md`

```markdown
# Changelog

## [Unreleased]

### Added

- Engineering baseline (task-14): typecheck/format scripts, Prettier, .nvmrc, security headers, API rate limit, ARCHITECTURE.md, first ADR
- (task-12) Watch stream redesign with speechGuard + event cards
- (task-13) Hero daily brief realtime data integration

### Changed

- package.json name: `claw42-temp` → `claw42`

### Security

- Added X-Frame-Options / X-Content-Type-Options / Referrer-Policy / HSTS / CSP-Report-Only headers
- API routes now rate-limited (30/min for LLM-backed, 60/min for cache-backed)

## Versioning

Following Conventional Commits + SemVer post-launch. Pre-launch: track changes here only.
```

#### P0.11 — `.github/workflows/ci.yml`（最小 CI，先跑不阻塞）

```yaml
name: CI

on:
  pull_request:
    branches: [main, "feature/**"]
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run format:check
      - run: npm run build
        env:
          # build-time fallback 防止缺 env 报错（实际值在 Vercel 上）
          MINIMAX_API_KEY: ${{ secrets.MINIMAX_API_KEY || 'dummy' }}
```

**说明**：CI 起步只跑 verify 不跑 test（test 在 P1 接入后再加）。`npm ci` 用 frozen lockfile。

#### P0.12 — `.github/PULL_REQUEST_TEMPLATE.md`

```markdown
## 改动概要

<!-- 1-3 句说明这个 PR 做什么 -->

## 关联 task / spec

<!-- task-NN-... / docs/airy-tasks/... -->

## 改动类型

- [ ] feat（新功能）
- [ ] fix（bug 修复）
- [ ] refactor（重构）
- [ ] perf（性能）
- [ ] docs（文档）
- [ ] chore（杂项）

## 触碰路径核对

- [ ] 未触碰 `ARCHITECTURE.md § 9` 禁止路径
- [ ] 如触碰，已在 PR description 显式标注 + Dan 批准

## 验证

- [ ] `npm run verify` 通过
- [ ] Vercel preview 已访问验收
- [ ] 移动端 + 桌面端都看过

## Bundle / 性能

- [ ] 未引入大依赖（>50KB）
- [ ] 未明显增加首屏 JS

## Rollback 计划

<!-- 如何回滚？git revert / Vercel instant rollback / 其他 -->
```

#### P0 验收清单

- [ ] `package.json` name 改 `claw42`，加 packageManager + engines
- [ ] `npm run typecheck` 通过（0 错误）
- [ ] `npm run lint` 通过
- [ ] `npm run format:check` 通过（首次跑 `npm run format` 全文件格式化）
- [ ] `npm run verify` 通过
- [ ] `.nvmrc` 存在
- [ ] `.prettierrc` 存在
- [ ] `next.config.mjs` 有 6 项 security headers（CSP 用 Report-Only）
- [ ] 3 个 API route 都有 `rateLimit` 调用
- [ ] `ARCHITECTURE.md` 存在且含 10 段
- [ ] `ARCHITECTURE.md § 9` 禁止路径 ≥ 8 项明文
- [ ] `docs/adr/0001-architecture-baseline.md` 存在
- [ ] `README.md` 重写完成（不再是 create-next-app 默认）
- [ ] `.env.local.example` 存在
- [ ] `CHANGELOG.md` 存在
- [ ] `.github/workflows/ci.yml` 存在
- [ ] `.github/PULL_REQUEST_TEMPLATE.md` 存在
- [ ] CI 在 PR 上能跑通 `verify`

#### P0 提交命令

```sh
git checkout -b feature/engineering-baseline-p0-01
# 阶段实施 P0.1-P0.12 全部 → 1 个 commit

# 先全文件 format（避免 format:check 失败）
npm install --save-dev prettier prettier-plugin-tailwindcss
npm run format

# 改 package.json name + scripts + engines
# 加文件：.nvmrc / .prettierrc / .env.local.example / CHANGELOG.md / ARCHITECTURE.md
#       docs/adr/0001-architecture-baseline.md
#       .github/workflows/ci.yml / .github/PULL_REQUEST_TEMPLATE.md
#       src/lib/rateLimit.ts
# 改文件：next.config.mjs / README.md / package.json
#       src/app/api/agents/analysis/route.ts
#       src/app/api/market/ticker/route.ts
#       src/app/api/analytics/route.ts

git add -A
git commit -m "feat(eng): engineering baseline P0 (task-14)

- package.json: rename claw42-temp → claw42, add packageManager/engines, add typecheck/format/verify scripts
- Prettier 3.3 + tailwindcss plugin; .prettierrc with project conventions
- .nvmrc pinning Node 20.18.0
- next.config.mjs: 6 security headers (X-Frame-Options/X-Content-Type-Options/Referrer-Policy/HSTS/Permissions-Policy/CSP-Report-Only)
- API rate limit (30/min for LLM-backed, 60/min for cache-backed) prevents quota exhaustion
- ARCHITECTURE.md (10 sections per engineering-standards.md spec); section 9 lists 8 AI协作 forbidden paths
- ADR 0001: engineering baseline 3-phase rollout
- README.md rewritten (was create-next-app default)
- .env.local.example for new dev onboarding
- CHANGELOG.md initialized
- .github/workflows/ci.yml: typecheck + lint + format:check + build on PR/push
- .github/PULL_REQUEST_TEMPLATE.md with forbidden-path checklist"

git push origin feature/engineering-baseline-p0-01
```

---

### P1 — 测试 + 监控基础（task-15，等 P0 merge 后启动）

**简述**（详细 spec 后续 task-15 出）：

| 项              | 内容                                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest 接入     | 装 vitest + @testing-library/react + jsdom，写 lib/\* 的 unit 测试（marketDataCache stale 逻辑 / rateLimit 边界 / analytics 字段清洗 / llmFallbackChain provider 切换） |
| Playwright 接入 | 装 @playwright/test，写 5 条 smoke E2E（首页加载 / Hero CTA / 语言切换 / Watch 页 / 404 页）                                                                            |
| Lighthouse CI   | `@lhci/cli` autorun，配置 budget（LCP < 2.5s / INP < 200ms / CLS < 0.1 / JS < 170KB）                                                                                   |
| size-limit      | 配置 bundle 预算 + CI 报告                                                                                                                                              |
| CI 扩展         | ci.yml 加 `npm test` + `npm run test:e2e` + `npm run lhci`                                                                                                              |

**目标**：测试覆盖率 ≥ 30%（关键 lib + API route），E2E 5 条 smoke 全过。

### P2 — 监控 + 发布流程（task-16，等 P1 merge + 产品对外发布）

| 项         | 内容                                                                                 |
| ---------- | ------------------------------------------------------------------------------------ |
| Sentry     | `@sentry/nextjs` 接入；release/version 必填；source map 上传                         |
| PostHog    | 替代 `console.info` analytics；funnel + session replay；保留 ANALYTICS_EVENTS 白名单 |
| web-vitals | 真实用户 LCP/INP/CLS 上报到 PostHog                                                  |
| 发布流程   | release-checklist.md；Vercel rollback 文档化；CHANGELOG 自动化（changesets）         |
| CSP 升级   | Report-Only → enforce（观察 1-2 周后）                                               |
| 高危漏洞   | next 升级到无高危版本（届时评估 14.x 还是迁移 15.x）                                 |

**目标**：达到 § 11 Phase 3 验收（错误可追踪 + 性能数据 + Staging 强制 + rollback 路径明确）。

---

## § C 风险与边界

| 风险                                                      | 缓解                                                                                   |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| P0 改 `next.config.mjs` 加 CSP 可能误伤现有外部资源       | 用 `Content-Security-Policy-Report-Only` 起步，不阻塞，观察 console 错误后再升级到强制 |
| P0 加 API rate limit 可能误伤 Vercel preview 自动健康检查 | 限值保守（30-60/min），单 IP 维度足够                                                  |
| ARCHITECTURE.md § 9 禁止路径列得太严卡死 Codex 后续工作   | 列 8 项明确路径，超出列表的 AI 自由发挥；列表项触碰需 Dan 显式批准而非禁止             |
| 改 package.json name 触发 Vercel 重新部署                 | name 字段不影响部署；Vercel project 用 `.vercel/project.json` 关联，不依赖 name        |
| typecheck 跑出现存量错误阻塞                              | dev 先跑一次 `tsc --noEmit` 看输出；如有错误一并修，否则 P0 commit 中包含              |
| Prettier 全文件格式化触发大量 diff                        | 拆 2 个 commit：a) 仅 prettier format；b) 真实改动。便于 review                        |

---

## § D 与既有任务依赖

**前置**：无。本 task 独立于 task-12 / task-13 当前在跑的产品功能 PR。

**并行**：可与 task-12 / task-13 同时推进，PR 互不干扰。

**后续**：

- task-15（P1 测试 + 监控基础）等 task-14 merge
- task-16（P2 监控 + 发布流程）等 task-15 merge + 产品对外发布

---

## § E 给 Codex 的派发文本

```
项目：claw42
工作路径：/Users/dannybrown/Claude/职业规划/web-dev/claw42
Spec 目录：docs/airy-tasks/
任务：task-14-engineering-baseline.md（P0 部分，先做）

新分支：feature/engineering-baseline-p0-01（从 main 或当前主线分出）
PR target：feature/act1-5-watch-page-01

12 个改动点 P0.1-P0.12，1 个 commit 出齐：
- scripts/Prettier/.nvmrc/.prettierrc
- next.config.mjs 6 项安全头（CSP 用 Report-Only）
- src/lib/rateLimit.ts + 3 个 API route 加限流
- ARCHITECTURE.md 10 段 + § 9 禁止路径 8 项
- docs/adr/0001 + README.md 重写 + .env.local.example
- CHANGELOG.md + .github/workflows/ci.yml + PR template

实施前执行 npm run format 全文件格式化（避免后续 PR 出现大 format diff）。

CI workflow 起步只跑 verify，test/E2E/lighthouse 在 P1 (task-15) 接入。
```

---

_维护者: F_
_创建: 2026-04-30_
_执行者: Codex（P0），P1/P2 后续 task_
_基于：engineering-standards.md v1.0.1 9 维度评审 + Phase 1 落地路径_
_分支: feature/engineering-baseline-p0-01_
_PR target: feature/act1-5-watch-page-01（不变）_
_独立: 不依赖 task-12 / task-13，可并行_
