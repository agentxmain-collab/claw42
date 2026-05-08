# Spec — Production Code 13 条 P0/P1 修订批次

> **背景**：F 对 claw42.ai 生产代码（main HEAD `c01f76d`）做了完整审核，落地报告 `docs/reviews/production-review-2026-04-28-by-f.md`，发现 5 条 P0 + 8 条 P1 共 13 条问题。Dan 决策"全部都要修"。本 spec 让 Codex 一次性 PR 修完。
>
> **执行者**：Codex
>
> **基于**：`origin/main` 当前状态（PR #11 / task-05/06/07/08 都还没合）
>
> **分支**：`feature/production-fix-batch-01`，PR 目标 `main`

---

## 0. 必读输入

1. `docs/reviews/production-review-2026-04-28-by-f.md` —— 完整审核报告（13 条 finding 详情 + 修订片段 + 决策依据）
2. 当前 main 代码：`src/app/layout.tsx` / `src/app/[locale]/layout.tsx` / `src/app/[locale]/app/page.tsx` / `src/middleware.ts` / `src/lib/analytics.ts` / `src/lib/constants.ts` / `src/i18n/locales.ts` / `src/i18n/dicts/*.json` / `src/i18n/types.ts`

读完审核报告再动手——审核报告里每一条 P0/P1 都给了具体修订片段，本 spec 是简化任务清单，**详情看审核报告**。

## 1. 修改清单（13 条）

### P0（5 条）

| #    | finding                            | 文件                                                                | 修订要点                                                                                                                                   |
| ---- | ---------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| P0-1 | `<html>` 缺 lang                   | `src/app/layout.tsx` + `src/app/[locale]/layout.tsx`                | 把 `<html><body>` 包装移到 `[locale]/layout.tsx`，按 `HTML_LANG[locale]` 设 lang，按 `RTL_LOCALES.has(locale)` 设 dir                      |
| P0-2 | SkillsEcoSection 两张卡 URL 不细分 | `src/modules/landing/SkillsEcoSection.tsx` + `src/lib/constants.ts` | Contract 卡跳 `/tree/main/contract`，Spot 卡跳 `/tree/main/spot`。Hero ctaSecondary label **保留不改**，URL 也保留指 repo 主页（Dan 决策） |
| P0-3 | 无 robots/sitemap                  | 新建 `src/app/robots.ts` + `src/app/sitemap.ts`                     | Next.js 14 metadata routes，详见审核报告 P0-3                                                                                              |
| P0-4 | `/app` duplicate content           | `src/app/[locale]/app/page.tsx`                                     | 加 `metadata = { robots: { index: false, follow: true } }`                                                                                 |
| P0-5 | analytics fetch 无 timeout         | `src/lib/analytics.ts`                                              | 加 `AbortController` + 3s timeout                                                                                                          |

### P1（8 条）

| #    | finding                         | 文件                                                                                     | 修订要点                                                                                                                                                               |
| ---- | ------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1-1 | middleware 没用 Accept-Language | `src/middleware.ts`                                                                      | 调用 `matchLocale(request.headers.get('accept-language'))`，cookie miss 时用它替代 DEFAULT_LOCALE 直接 fallback                                                        |
| P1-2 | Inter 无 CJK                    | `src/app/layout.tsx` + `src/app/globals.css`                                             | 加 Noto Sans SC 字体，配 CSS 变量 `--font-stack`                                                                                                                       |
| P1-3 | favicon 用 PNG                  | 新建 `src/app/icon.png`（32×32）                                                         | 用 sharp resize `public/images/brand/claw42-horizontal-blue.png` 或 `public/images/robot-hero.png` 到 32×32，删 root metadata 里的 `icons.icon` 让 App Router 自动处理 |
| P1-4 | SEO meta 极简                   | `src/app/layout.tsx` + `src/app/[locale]/layout.tsx`                                     | 加 OG / Twitter / metadataBase / hreflang alternates，详见审核报告 P1-4                                                                                                |
| P1-5 | analytics 不持久化              | `src/lib/analytics.ts` + `package.json`                                                  | 接 PostHog（dual-write，env 缺失时 graceful skip），新增 `posthog-js` 依赖 + `NEXT_PUBLIC_POSTHOG_KEY` env                                                             |
| P1-6 | constants.ts 单常量             | `src/lib/constants.ts` + 全仓引用                                                        | 拆成 `URLS` 对象，老 `COINW_SKILLS_URL` 作 backward-compat alias 保留                                                                                                  |
| P1-7 | 缺 apple-icon + manifest        | 新建 `src/app/apple-icon.png`（180×180）+ `src/app/manifest.ts`                          | 详见审核报告 P1-7                                                                                                                                                      |
| P1-8 | 缺 error/not-found 页           | 新建 `src/app/not-found.tsx` + `src/app/[locale]/error.tsx` + `src/app/global-error.tsx` | 品牌化错误页，简单文案 + "回首页" CTA                                                                                                                                  |

---

## 2. P0-2 SkillsEcoSection URL 细分

**Dan 决策（最新）**：

- Hero ctaSecondary label 和 URL **保留不改**
- 两个变更点都集中在 **SkillsEcoSection.tsx**：
  - 卡片 `i === 0`（Contract）→ `https://github.com/connectCoinw/coinw-skills/tree/main/contract`
  - 卡片 `i === 1`（Spot）→ `https://github.com/connectCoinw/coinw-skills/tree/main/spot`
- 当前所有卡都 `href={COINW_SKILLS_URL}` 跳 repo 主页 → 改为按 index 取细分 URL

**实现**（配合 §5 P1-6 URLS 重构）：

`src/modules/landing/SkillsEcoSection.tsx` 加 ECO_HREFS 常量（和已有的 `ECO_ICON_SLUGS` 对位）：

```tsx
import { URLS } from "@/lib/constants";

const ECO_ICON_SLUGS = ["eco-contract", "eco-spot"] as const;
const ECO_HREFS = [URLS.CLAW42_SKILLS_REPO_CONTRACT, URLS.CLAW42_SKILLS_REPO_SPOT] as const;

// ...在卡片渲染处：
<a
  href={ECO_HREFS[i] ?? URLS.CLAW42_SKILLS_REPO}
  target="_blank"
  rel="noopener noreferrer"
  onClick={() => trackEvent("skill_card_click", { locale, skill: card.title, index: i })}
  className="..."
>
  {card.cta} →
</a>;
```

**i18n 不动**——`hero.ctaSecondary` 保持现有 "API 文档/API Docs/etc." 10 语文案不改。这个 commit 不动 i18n dict。

---

## 3. P1-3 favicon 生成路径

Codex 自由决策方案：

**方案 A（推荐）**：用 `sharp` 处理现有图片

```ts
// 临时脚本（执行后删除）
import sharp from "sharp";
await sharp("public/images/robot-hero.png")
  .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile("src/app/icon.png");

await sharp("public/images/robot-hero.png")
  .resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile("src/app/apple-icon.png");
```

**方案 B**：如果 Codex 觉得现有 PNG 不适合（比如图标内容不居中、对比度差），自己用 SVG 程序化绘制简单图标（claw42 蓝色 "42" 字样 + 蟹钳几何）。

PR 描述说明用了哪个方案。

---

## 4. P1-5 PostHog 接入路径

### 依赖

```sh
npm install posthog-js@^1
```

### env var（PR 描述提醒 Dan 在 Vercel 配）

- `NEXT_PUBLIC_POSTHOG_KEY` —— PostHog Project API key（必须 NEXT_PUBLIC 前缀让客户端可读）
- `NEXT_PUBLIC_POSTHOG_HOST` —— 可选，默认 `https://app.posthog.com`，自托管时改

### 实现

`src/lib/analytics.ts` 改造：

```ts
import posthog from "posthog-js";

let posthogInited = false;

function ensurePosthog() {
  if (posthogInited || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return; // env 缺失 graceful skip

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
    autocapture: false,
    capture_pageview: false,
  });
  posthogInited = true;
}

export function trackEvent(name: AnalyticsEventName, properties: AnalyticsProperties = {}) {
  ensurePosthog();

  // 现有 /api/analytics dual-write
  const body = JSON.stringify({ event: name, properties, context: getContext() });
  const controller = new AbortController(); // P0-5 timeout
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    signal: controller.signal,
  })
    .catch(() => {})
    .finally(() => clearTimeout(timeoutId));

  // PostHog dual-send
  if (posthogInited) {
    posthog.capture(name, properties);
  }
}
```

注：dual-write 让现有 `/api/analytics` console log 仍然工作（备份），新加 PostHog 是增量。

---

## 5. P1-6 constants 重构

`src/lib/constants.ts`：

```ts
export const URLS = {
  COINW_MAIN: "https://www.coinw.com",
  COINW_API_DOCS: "https://api-doc.coinw.com",
  CLAW42_SKILLS_REPO: "https://github.com/connectCoinw/coinw-skills",
  CLAW42_SKILLS_REPO_CONTRACT: "https://github.com/connectCoinw/coinw-skills/tree/main/contract",
  CLAW42_SKILLS_REPO_SPOT: "https://github.com/connectCoinw/coinw-skills/tree/main/spot",
  CLAW42_TWITTER: "",
  CLAW42_TELEGRAM: "",
} as const;

// 向后兼容 - Hero ctaSecondary 仍指 repo 主页
export const COINW_SKILLS_URL = URLS.CLAW42_SKILLS_REPO;
```

引用调整：

- `src/modules/landing/HeroScene/HeroScene.tsx` —— `COINW_SKILLS_URL` 不动（仍指 repo 主页，Dan 决策保留）
- `src/modules/landing/SkillsEcoSection.tsx` —— 新增 `ECO_HREFS = [URLS.CLAW42_SKILLS_REPO_CONTRACT, URLS.CLAW42_SKILLS_REPO_SPOT]`，卡片 href 改为 `ECO_HREFS[i]`（详见 §2 P0-2）
- `src/modules/landing/StartTradeSection.tsx` 如有用到也保留指 repo 主页（不细分）

---

## 6. P1-8 错误页骨架

### `src/app/not-found.tsx`

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6">
      <div className="text-center">
        <p className="mb-4 font-mono text-sm text-[#7c5cff]">404</p>
        <h1 className="mb-4 text-3xl font-bold text-white md:text-4xl">Page not found</h1>
        <p className="mb-8 text-gray-400">The page you're looking for doesn't exist.</p>
        <Link
          href="/"
          className="inline-flex items-center rounded-xl bg-[#7c5cff] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#8e6bff]"
        >
          ← Back to Claw 42
        </Link>
      </div>
    </main>
  );
}
```

### `src/app/[locale]/error.tsx`

```tsx
"use client";

import { useEffect } from "react";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6">
      <div className="text-center">
        <p className="mb-4 font-mono text-sm text-[#ff5f5f]">Something went wrong</p>
        <h1 className="mb-4 text-2xl font-bold text-white md:text-3xl">We hit a snag</h1>
        <p className="mb-8 text-gray-400">An unexpected error occurred. Try reloading.</p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-xl bg-[#7c5cff] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#8e6bff]"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
```

### `src/app/global-error.tsx`

```tsx
"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          background: "#000",
          color: "#fff",
          fontFamily: "sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", padding: "24px" }}>
          <h1>Application error</h1>
          <p style={{ color: "#888", margin: "16px 0" }}>A critical error occurred.</p>
          <button
            onClick={reset}
            style={{
              background: "#7c5cff",
              color: "#fff",
              padding: "12px 24px",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
```

注：`global-error.tsx` 不能用 i18n（在 RootLayout fail 之前触发），用纯英文 + 内联样式。

---

## 7. 验收

### 类型 / 构建

- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 成功
- [ ] `npm run lint` 无新增错误

### Grep 验证

- [ ] `grep "lang=" src/app/\[locale\]/layout.tsx` 存在（lang 动态绑定）
- [ ] `grep "<html className=\"dark\">" src/app/layout.tsx` 不存在（root layout 已重构）
- [ ] `grep "ECO_HREFS" src/modules/landing/SkillsEcoSection.tsx` 存在
- [ ] `grep "CLAW42_SKILLS_REPO_CONTRACT\|CLAW42_SKILLS_REPO_SPOT" src/lib/constants.ts` 两个都在
- [ ] `grep "API 文档" src/i18n/dicts/zh_CN.json` **仍存在**（label 不改）
- [ ] `src/app/robots.ts` 存在
- [ ] `src/app/sitemap.ts` 存在
- [ ] `src/app/manifest.ts` 存在
- [ ] `src/app/icon.png` 存在
- [ ] `src/app/apple-icon.png` 存在
- [ ] `grep "robots: { index: false" src/app/\[locale\]/app/page.tsx` 存在
- [ ] `grep "AbortController\|signal" src/lib/analytics.ts` 存在
- [ ] `grep "matchLocale" src/middleware.ts` 存在
- [ ] `grep "Noto_Sans_SC" src/app/layout.tsx` 存在
- [ ] `grep "openGraph\|twitter" src/app/layout.tsx` 存在
- [ ] `grep "alternates" src/app/\[locale\]/layout.tsx` 存在
- [ ] `grep "posthog-js" package.json` 存在
- [ ] `grep "URLS = {" src/lib/constants.ts` 存在
- [ ] `src/app/not-found.tsx` 存在
- [ ] `src/app/\[locale\]/error.tsx` 存在
- [ ] `src/app/global-error.tsx` 存在

### 行为（preview 上跑）

- [ ] 访问根 URL `/`（不带 locale）→ 中文 Accept-Language 用户跳到 `/zh_CN/`，英文用户跳到 `/en_US/`
- [ ] `/zh_CN/` html lang="zh-CN"，`/ar_SA/` html lang="ar-SA" + dir="rtl"
- [ ] `/zh_CN/app` 页面 head 含 `<meta name="robots" content="noindex,follow">`
- [ ] `/robots.txt` 返回有效内容
- [ ] `/sitemap.xml` 返回 10 个 locale URLs
- [ ] `/manifest.webmanifest` 返回有效 PWA manifest
- [ ] 浏览器 tab 显示新 favicon（清晰，不模糊）
- [ ] iOS Safari "添加到主屏" 看到 apple-touch-icon
- [ ] 访问 `/zh_CN/nonexistent` 显示 not-found 品牌页（不是 Next.js 默认错误页）
- [ ] Vercel Function Logs 看 analytics 事件仍输出（dual-write 保留）
- [ ] 配上 `NEXT_PUBLIC_POSTHOG_KEY` 后 PostHog dashboard 收到 event

### Lighthouse（preview 上跑）

- [ ] a11y score ≥ 95（lang 属性补完后应该提高）
- [ ] SEO score ≥ 95（OG + sitemap + meta 补完后应该满分接近）

### 不退化

- [ ] Hero CTA 复制 + toast 仍工作
- [ ] 加密日报 CTA 复制 + toast 仍工作
- [ ] 语言切换下拉仍工作
- [ ] 所有 trackEvent 调用点未变（PostHog 是新增 dual-write，不影响现有 `/api/analytics`）

---

## 8. 约束

- **不动产品功能**——只做基础设施 + a11y + SEO + 错误页 + 字体 + 分析平台接入
- **不引入除 posthog-js 外的新依赖**
- **不动 Hero CTA / Scenarios / Why / SkillsEco / StartTrade 业务逻辑**——只动 i18n 文案 + URL 集中
- **不破坏现有 trackEvent 调用点**——PostHog 是 dual-write 增量，旧的 `/api/analytics` POST 保留
- **constants.ts backward-compat**：保留 `COINW_SKILLS_URL` 别名，老 import 不动
- 不写任何文档（spec 文档 F 已经维护）

---

## 9. 提交与 PR

### 分支

```sh
git checkout main
git pull origin main
git checkout -b feature/production-fix-batch-01
```

### Commit 拆分（推荐 4 段，每段独立可编译）

```sh
# Commit 1: a11y + SEO 基础（P0-1 + P0-3 + P0-4 + P1-4）
git add src/app/layout.tsx src/app/\[locale\]/layout.tsx src/app/\[locale\]/app/page.tsx \
        src/app/robots.ts src/app/sitemap.ts
git commit -m "fix(a11y,seo): html lang/dir + sitemap/robots + app route noindex + OG/twitter/hreflang

- Move <html><body> to [locale]/layout.tsx with dynamic lang/dir per HTML_LANG/RTL_LOCALES
- Add app/robots.ts + app/sitemap.ts (10 locale URLs)
- /app route metadata robots: { index: false, follow: true } to avoid duplicate content
- Add openGraph, twitter, metadataBase, alternates.languages hreflang
- Closes production-review P0-1, P0-3, P0-4, P1-4"

# Commit 2: URL 细分 + constants 重构（P0-2 + P1-6）
git add src/lib/constants.ts src/modules/landing/SkillsEcoSection.tsx
git commit -m "fix(eco,constants): split skills repo URLs by category + URLs config block

- SkillsEcoSection: card[0] (Contract) → /tree/main/contract, card[1] (Spot) → /tree/main/spot
- New ECO_HREFS constant array, mirrors existing ECO_ICON_SLUGS pattern
- constants.ts: extract URLS block with REPO/REPO_CONTRACT/REPO_SPOT/COINW_MAIN/etc.
- COINW_SKILLS_URL alias kept (Hero ctaSecondary still points to repo root)
- i18n dicts unchanged (label 'API 文档' kept per Dan decision)
- Closes production-review P0-2, P1-6"

# Commit 3: 字体 + favicon + manifest + analytics timeout/posthog（P0-5 + P1-1 + P1-2 + P1-3 + P1-5 + P1-7）
git add src/app/layout.tsx src/app/icon.png src/app/apple-icon.png src/app/manifest.ts \
        src/middleware.ts src/lib/analytics.ts package.json package-lock.json
git commit -m "fix(infra): CJK font + favicon + manifest + middleware Accept-Language + analytics timeout/PostHog

- Layout: add Noto Sans SC font alongside Inter, CSS var --font-stack
- Add app/icon.png (32x32) and app/apple-icon.png (180x180) generated from robot-hero
- Add app/manifest.ts for PWA install
- middleware.ts: cookie miss now goes through matchLocale(Accept-Language) before DEFAULT_LOCALE
- analytics.ts: AbortController + 3s timeout for fetch /api/analytics
- analytics.ts: dual-write to PostHog when NEXT_PUBLIC_POSTHOG_KEY env present
- Add posthog-js dependency
- Closes production-review P0-5, P1-1, P1-2, P1-3, P1-5, P1-7"

# Commit 4: 错误页（P1-8）
git add src/app/not-found.tsx src/app/\[locale\]/error.tsx src/app/global-error.tsx
git commit -m "feat(ux): brand-styled not-found / error / global-error pages

- 404: '/not-found' shows claw42-styled page with 'Back to Claw 42' CTA
- Locale error: client-side error fallback with 'Try again' reset
- Global error: minimal English fallback for RootLayout-level failures
- Closes production-review P1-8"

git push origin feature/production-fix-batch-01
```

### PR 描述模板

```markdown
## Production Code Fix Batch (13 issues)

Fixes all P0/P1 findings from `docs/reviews/production-review-2026-04-28-by-f.md`.

### P0 (5)

- [x] P0-1 html lang/dir attribute
- [x] P0-2 SkillsEco URL split (Contract → /contract, Spot → /spot)
- [x] P0-3 robots/sitemap
- [x] P0-4 /app route noindex
- [x] P0-5 analytics fetch timeout

### P1 (8)

- [x] P1-1 middleware Accept-Language
- [x] P1-2 CJK font (Noto Sans SC)
- [x] P1-3 favicon ICO via Next App Router conventions
- [x] P1-4 OG/Twitter/hreflang
- [x] P1-5 PostHog persistence (dual-write)
- [x] P1-6 constants URLs block
- [x] P1-7 apple-icon + manifest
- [x] P1-8 not-found / error / global-error pages

### 需要 Dan 在 Vercel 配置 env

- `NEXT_PUBLIC_POSTHOG_KEY`（PostHog API key，没配会 graceful skip）
- `NEXT_PUBLIC_POSTHOG_HOST`（可选，默认 https://app.posthog.com）

### Lighthouse 预期改进

- a11y score: 现 ~85 → 修后 ≥ 95
- SEO score: 现 ~75 → 修后 ≥ 95

### 不在本 PR 范围

P2 锦上添花（globals.css 颜色变量化、Sentry 错误监控等），按审核报告 P2 章节单独处理。
```

---

## 10. 副审

Codex 实施时**自检**（PR 描述里逐条 ✅ checkbox）。F 收到 PR 做 final review，主要看：

1. 13 条都改了
2. tsc / build / lint 干净
3. preview 上 a11y / SEO score 提升
4. 现有功能不退化

**不要再走副审循环**——本 spec 内每条修订都有具体代码片段，无歧义。如果 Codex 实施时发现某条 spec 真的写错（比如 import 路径不存在），停手 → 告诉 Dan → F 修订 spec，不要自己猜。

---

## 11. 时间预算

- Codex 实施：4-5 小时
- F final review：30 分钟
- Dan preview 验收：30 分钟
- Vercel env 配 + 重新 build：10 分钟

**总：5-6 小时全部完成**。集中一上午做完。

---

_维护者: F_
_创建: 2026-04-28_
_执行者: Codex_
_基于: docs/reviews/production-review-2026-04-28-by-f.md_
