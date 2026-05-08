# claw42.ai Production 代码审核报告

> 评审者：F（claw42 web-dev session）
> 评审日期：2026-04-28
> 评审范围：`origin/main` HEAD `c01f76d`（4-26）
> 范围说明：**PR #11（act1.5 旁观秀）尚未合并到 main**，本审核针对当前生产域名（claw42.ai）跑的版本——只有 Act 1（Hero / QuickStart / Scenarios / Why / SkillsEco / StartTrade / Disclaimer）+ analytics + LocaleDropdown
> 代码体量：43 个 src 文件 / 4168 LoC
> 自动化校验：✅ ESLint 0 warnings 0 errors
> 用途：人工评审就绪材料 + Codex 修复 spec 的输入

---

## 总体评价

基础工程质量 OK，可上线但有一批必须修的小问题。模块结构清晰、动效精致、ESLint 干净、a11y 大部分到位、合规免责中文版齐全。

但有 **5 条 P0 会被外部评审者立刻指出**，必须先修；另有 **8 条 P1** 是产品/品牌一致性问题，建议人工评审前一起修。

---

## P0 必修（评审硬伤）

### P0-1. `<html>` 缺 `lang` 属性 ⚠️ a11y + SEO

**位置**：`src/app/layout.tsx`

```tsx
<html className="dark">    // ← 缺 lang=
```

**影响**：屏幕阅读器无法判断语言、SEO crawler 给 lang 信号缺失、Lighthouse a11y 扣分。

**修订**：移除 root layout 的 `<html><body>` 包装，把它放到 `[locale]/layout.tsx`，按 locale 动态设置 lang + dir：

```tsx
return (
  <html lang={HTML_LANG[locale]} dir={RTL_LOCALES.has(locale) ? "rtl" : "ltr"} className="dark">
    <body className={inter.className}>...</body>
  </html>
);
```

注：会自动解决 RTL 阿语用户阅读体验问题（当前阿语没 dir="rtl"）。

### P0-2. SkillsEcoSection 两张卡 URL 不细分

**位置**：`src/modules/landing/SkillsEcoSection.tsx` + `src/lib/constants.ts`

SkillsEcoSection 渲染 2 张卡（Contract / Spot），`ECO_ICON_SLUGS = ["eco-contract", "eco-spot"]` 已经按 index 区分了图标——但所有卡片的 `href` 都指 `COINW_SKILLS_URL`（repo 主页），点击不会落到对应分类的代码。

附属问题：Hero ctaSecondary（"API 文档"按钮）也跳同一个 repo 主页 URL，label 文不对题，且 URL 暴露 `connectCoinw` 字面。

**修订决策（Dan 拍板 2026-04-28）**：

- **Hero ctaSecondary label 和 URL 保留不改**——Dan 接受 "API 文档" 按钮跳 repo 主页这个现状
- **SkillsEcoSection URL 按 index 拆分**：
  - 卡片 `i === 0`（Contract）→ `https://github.com/connectCoinw/coinw-skills/tree/main/contract`
  - 卡片 `i === 1`（Spot）→ `https://github.com/connectCoinw/coinw-skills/tree/main/spot`

**实现**：加 `ECO_HREFS` 常量数组（和 `ECO_ICON_SLUGS` 对位），卡片 href 用 `ECO_HREFS[i]`。详见 spec-production-fix-batch.md §2 / §5。

**i18n 不动**——保留 "API 文档/Docs/etc." 现有 10 语文案。

### P0-3. 无 `robots.txt` / `sitemap.xml`

10 个 locale 路由 + `/app` 路由，全部没有 sitemap。SEO 大幅打折。

**修订**：用 Next.js 14 内置 metadata routes：

```ts
// src/app/robots.ts
import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: "https://claw42.ai/sitemap.xml",
  };
}

// src/app/sitemap.ts
import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n/locales";
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://claw42.ai";
  return LOCALES.map((locale) => ({
    url: `${baseUrl}/${locale}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: locale === "en_US" ? 1.0 : 0.8,
  }));
}
```

### P0-4. `/app` 路由 duplicate content（SEO 风险）

**位置**：`src/app/[locale]/app/page.tsx` 内容完全复用 `/{locale}/`，duplicate content 风险。

**修订**：在 `/app/page.tsx` 加 metadata 标记 noindex：

```tsx
import Home from "../page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function AppSurfacePage() {
  return (
    <div className="claw42-app-surface" data-surface="app">
      <Home />
    </div>
  );
}
```

注：`/app` 是 mobile-first 容器版本，主路由 `/` 才是 SEO 入口。`/app` noindex 让搜索引擎只收录 `/`。

### P0-5. analytics fetch 无 timeout 控制

**位置**：`src/lib/analytics.ts`

当前 fetch 带 `keepalive: true` 但无 AbortSignal，后端慢时浏览器最多挂 30s+。

**修订**：

```ts
const controller = new AbortController();
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
```

---

## P1 强烈建议修（产品 / 品牌 / 体验）

### P1-1. `DEFAULT_LOCALE = en_US` + middleware 没用 Accept-Language

**位置**：`src/middleware.ts`

middleware 当前只读 cookie，**完全没读 Accept-Language**——已经实现的 `matchLocale()` 函数（在 `src/i18n/locales.ts`）没被调用。中文用户首次访问 → 直接 fallback `DEFAULT_LOCALE = en_US`。

**修订**：

```ts
import { matchLocale } from "./i18n/locales";

export function middleware(request: NextRequest) {
  // ... 现有 hasLocale 检查 ...

  // 改 fallback 顺序：cookie → Accept-Language → DEFAULT_LOCALE
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const isValidCookie = cookieLocale && (LOCALES as readonly string[]).includes(cookieLocale);

  let locale: (typeof LOCALES)[number];
  if (isValidCookie) {
    locale = cookieLocale as (typeof LOCALES)[number];
  } else {
    const acceptLanguage = request.headers.get("accept-language");
    locale = matchLocale(acceptLanguage); // ← 启用现有但未用的函数
  }

  // ... 现有 redirect 逻辑 ...
}
```

`DEFAULT_LOCALE` 保留 `en_US`（claw42 是面向全球加密用户的产品，英文为底）。Accept-Language 命中中文 → 自动 zh_CN。

### P1-2. Inter 字体仅 latin subset，CJK 走系统 fallback

**位置**：`src/app/layout.tsx`

**修订**：加 Noto Sans SC 作为 CJK 字体：

```tsx
import { Inter, Noto_Sans_SC } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sc",
  display: "swap",
});

// body className: `${inter.variable} ${notoSansSC.variable} font-sans`
```

`globals.css` 加：

```css
:root {
  --font-stack:
    var(--font-inter), var(--font-noto-sc), -apple-system, BlinkMacSystemFont, sans-serif;
}
body {
  font-family: var(--font-stack);
}
```

### P1-3. favicon 用 PNG（`/images/robot-hero.png`）

PNG 通常 > 100KB 不是 1:1，浏览器缩放变模糊。

**修订**：导出 32x32 + 16x16 ICO（或 SVG）放到 `src/app/icon.png` 或 `src/app/icon.ico`。Next.js App Router 自动处理 favicon。

执行细节：

- 让 Codex 用现有 `public/images/brand/claw42-horizontal-blue.png` 或 `public/images/robot-hero.png` 作源材料
- 用 `sharp` resize + 裁剪成 32x32 PNG 放 `src/app/icon.png`
- 或用 SVG（更优，但需要矢量源）

### P1-4. SEO meta 极简——缺 OG / Twitter Card / 多语言 alternate

**位置**：`src/app/layout.tsx`

**修订**：

```tsx
const baseUrl = "https://claw42.ai";
const ogImage = `${baseUrl}/og-image.png`;

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "Claw 42 — AI Trading Agent Platform",
  description:
    "The world's first AI Agent competitive cultivation ecosystem dedicated to cryptocurrency trading",
  icons: { icon: "/icon.png" }, // 配合 P1-3
  openGraph: {
    title: "Claw 42 — AI Trading Agent Platform",
    description: "...",
    url: baseUrl,
    siteName: "Claw 42",
    images: [{ url: ogImage, width: 1200, height: 630, alt: "Claw 42" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Claw 42 — AI Trading Agent Platform",
    description: "...",
    images: [ogImage],
  },
};

// [locale]/layout.tsx 加 hreflang:
export async function generateMetadata({ params }): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: {
      canonical: `${baseUrl}/${locale}`,
      languages: Object.fromEntries(LOCALES.map((l) => [HTML_LANG[l], `${baseUrl}/${l}`])),
    },
  };
}
```

OG image (`og-image.png`, 1200x630)：

- 让 Codex 复用 hero 机器人 + claw42 logo + tagline 拼一张 OG image
- 或者放占位（Codex 的 SVG 程序化版），Dan 后续美术替换

### P1-5. analytics route 只 console.info 不持久化

**位置**：`src/app/api/analytics/route.ts`

事件只写 Vercel Function Logs（retention 短期）。

**修订决策**：接 **PostHog**（免费 1M event/月，5min 接入）：

```ts
// src/lib/analytics.ts 客户端：
import posthog from 'posthog-js';

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
    autocapture: false,  // 我们只用显式 trackEvent
    capture_pageview: false,  // 已有 AnalyticsPageView 组件
  });
}

// trackEvent 内部 dual-write：
export function trackEvent(name, properties) {
  // 现有 /api/analytics POST 保留作 backup
  void fetch('/api/analytics', {...});

  // PostHog 同步发送
  if (typeof window !== 'undefined' && (window as any).posthog) {
    posthog.capture(name, properties);
  }
}
```

**新增 env var**：`NEXT_PUBLIC_POSTHOG_KEY`（Vercel 配上后激活）。如果不配 PostHog，行为退化为只走 `/api/analytics`（fallback 不影响功能）。

**新增依赖**：`posthog-js@^1`

### P1-6. constants.ts 仅 1 个常量，扩展性差

**位置**：`src/lib/constants.ts`

**修订**：拆成 URL 配置块，未来加链接（Twitter / Telegram / Docs）有地方放：

```ts
export const URLS = {
  COINW_MAIN: "https://www.coinw.com",
  COINW_API_DOCS: "https://api-doc.coinw.com", // 真实 API 文档地址，需要 Dan 确认
  CLAW42_SKILLS_REPO: "https://github.com/connectCoinw/coinw-skills",
  CLAW42_TWITTER: "", // 占位
  CLAW42_TELEGRAM: "", // 占位
} as const;

// 兼容旧引用
export const COINW_SKILLS_URL = URLS.CLAW42_SKILLS_REPO;
```

注：本 task 不动 Hero ctaSecondary 的实际 URL（P0-2 已经决定保留 GitHub URL，只改 label），但把常量重命名 + 集中。Hero / SkillsEco / StartTrade 的引用全部改成 `URLS.CLAW42_SKILLS_REPO`。

### P1-7. 移动端无 Apple Touch Icon / Web App Manifest

**修订**：

- `src/app/apple-icon.png`（180×180，Next.js App Router 自动处理）
- `src/app/manifest.ts`（Web App Manifest）：

```ts
import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Claw 42",
    short_name: "Claw 42",
    description: "AI Trading Agent Platform",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#7c5cff",
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
```

### P1-8. 缺 error.tsx / not-found.tsx

访客访问不存在路径会看默认 Next.js error 页。

**修订**：

- `src/app/not-found.tsx` —— 品牌化 404 页（claw42 配色 + 简单 CTA "回首页"）
- `src/app/[locale]/error.tsx` —— 客户端错误兜底
- `src/app/global-error.tsx` —— root layout 级错误兜底

---

## P2 锦上添花（不在本次修复范围）

记录但不强制修：

- P2-1. globals.css 品牌色 hex 散落各处（`#7c5cff` `#b49cff` `#ff5f5f`），未来抽 Tailwind theme extension
- P2-2. ScenariosSection daily input box 和 daily cta 都触发 copy，UX 略困惑
- P2-3. analytics 事件 `skill_card_click` 缺 `card_id` 区分点击哪张卡
- P2-4. 没接 Sentry 错误监控

---

## 安全审查 ✓ 全部通过

| 检查项                           | 结论                       |
| -------------------------------- | -------------------------- |
| `dangerouslySetInnerHTML`        | 0 处 ✓                     |
| `eval` / `new Function`          | 0 处 ✓                     |
| Analytics route 输入校验         | 完整 ✓                     |
| 外链 `rel="noopener noreferrer"` | 全部到位 ✓                 |
| API key / secret 硬编码          | grep 干净 ✓                |
| Clipboard API 错误处理           | try/catch + console.warn ✓ |

---

## 修订总工时估算

13 条修订（5 P0 + 8 P1）总工时 **4-5 小时**。集中一上午能做完。

---

## 附录：人工评审常见问题预案

| 问题                                   | 修复后答案                                               |
| -------------------------------------- | -------------------------------------------------------- |
| Q1 "为什么 'API 文档' 按钮跳 GitHub？" | 已改 label 为 "查看 Skills 源码" 坦白用途（P0-2）        |
| Q2 "中文用户进站为什么是英文？"        | 已加 Accept-Language detect（P1-1）                      |
| Q3 "上线后怎么看数据？"                | 已接 PostHog（P1-5）                                     |
| Q4 "SEO 怎么做的？"                    | 已加 robots.txt + sitemap + OG + hreflang（P0-3 + P1-4） |
| Q5 "为什么 favicon 模糊？"             | 已换 ICO（P1-3）                                         |
| Q6 "10 语都翻译完了吗？"               | ✅ 全部到位                                              |
| Q7 "无障碍做了吗？"                    | ✅ html lang/dir 已补（P0-1）                            |
| Q8 "代码质量如何？"                    | ESLint 0 warning，模块清晰，安全审查全通 ✓               |

---

_维护者: F_
_创建: 2026-04-28_
_下游：docs/codex-specs/spec-production-fix-batch.md（修订 spec）_
