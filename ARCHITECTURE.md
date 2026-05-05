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

```text
src/
  app/                    # Next.js App Router
    [locale]/             # i18n 路由根（10 语）
    api/                  # API routes（agents / market / analytics）
  components/             # 跨模块共享 UI
  lib/                    # 服务端 + 客户端工具
    llmFallbackChain.ts   # LLM 调用 + fallback
    marketDataCache.ts    # CoinGecko cache + stale-while-revalidate
    analytics.ts          # 客户端事件上报
    rateLimit.ts          # API 限流
  i18n/                   # 10 语 dict + Provider
  modules/
    landing/              # 首页（Hero / Scenarios / Skills / StartTrade）
    agent-watch/          # /agent watch 页（task-09 ~ task-12）
```

**模块边界**：

- `lib/` 不依赖 `modules/`
- `modules/landing` 不依赖 `modules/agent-watch`，反之亦然
- API routes 只调用 `lib/`，不直接调 `modules/`

## 4. 状态管理 / 数据流

```text
[CoinGecko] --30s cache--> marketDataCache.ts --> /api/market/ticker
                                                        |
                                                        v
[client useEffect 60s poll] --> setMarketData state --> watch UI
                                                        |
[LLM provider chain] --60s cache--> llmFallbackChain.ts --> /api/agents/analysis
```

主要数据流：客户端 60s 轮询服务端，服务端缓存 30s 真实 API。stale-while-revalidate 策略保证降级。

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
- Lighthouse CI 移动端分数 >= 85

工具：Lighthouse CI（Phase 2 接入）+ web-vitals 真实用户上报（Phase 3 接入）。

## 7. 测试策略

按 Testing Trophy：

- 静态层：TS strict + ESLint（已有）
- Unit：仅 pure utility（lib/marketDataCache / rateLimit / analytics 字段清洗等）
- Integration：API route 端到端 + 关键组件交互（Phase 2 接入 Vitest）
- E2E：Playwright 10-20 条 critical path（Hero CTA / Watch 页加载 / 语言切换 / API 降级 / 错误页 等）

## 8. 部署流程

```text
本地 push -> feature/* 分支 -> Vercel 自动 preview deployment
                                    |
                                    v
                                Dan 验收
                                    |
                                    v
            merge to feature/act1-5-watch-page-01（act1.5 集成分支）
                                    |
                                    v
            merge to main（手动）-> Vercel auto deploy production
```

**Rollback**：Vercel instant rollback（dashboard 点击上一版本）+ git revert + redeploy。

## 9. 禁止路径（AI 协作专用）

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

**已知债**（按规范允许的 "A 级存量不强改" 豁免）：

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
