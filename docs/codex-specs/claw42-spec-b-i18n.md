# Spec B — 10 语言支持 + URL locale 路由

## 目标

一句话：做完后 `claw42.ai/zh_CN` 显示中文站、`claw42.ai/ja_JP` 显示日文站，根路径 `/` 自动重定向到用户语言或默认 `en_US`，Header 右上角下拉选 10 种语言切换，URL 同步变化。

## 锁定的 10 个 locale

| URL 段 | 字典键 | HTML lang | 方向 | 显示名（英） | 显示名（本地） |
|---|---|---|---|---|---|
| `zh_CN` | `zh_CN` | `zh-CN` | ltr | Chinese (Simplified) | 简体中文 |
| `zh_TW` | `zh_TW` | `zh-TW` | ltr | Chinese (Traditional) | 繁體中文 |
| `en_US` | `en_US` | `en-US` | ltr | English | English |
| `ru_RU` | `ru_RU` | `ru-RU` | ltr | Russian | Русский |
| `uk_UA` | `uk_UA` | `uk-UA` | ltr | Ukrainian | Українська |
| `ja_JP` | `ja_JP` | `ja-JP` | ltr | Japanese | 日本語 |
| `fr_FR` | `fr_FR` | `fr-FR` | ltr | French | Français |
| `es_ES` | `es_ES` | `es-ES` | ltr | Spanish | Español |
| `ar_SA` | `ar_SA` | `ar-SA` | **rtl** | Arabic | العربية |
| `en_XA` | `en_XA` | `en` | ltr | English (East Asia) | English (EA) |

**默认 locale**：`en_US`

**URL 大小写**：必须是 `zh_CN` 这种格式（locale 码 + 下划线 + 区域码），不是 `zh-CN` 也不是 `zh`。middleware 命中规则要严格按这 10 个。

---

## 变更范围

### 新建
- `src/middleware.ts`（和 `src/app/` 同级，Next 14 使用 src/ 目录结构时的规范位置）
- `src/app/[locale]/layout.tsx`
- `src/app/[locale]/page.tsx`
- `src/i18n/locales.ts`（locale 元数据中心，供 middleware + UI 共用）
- `src/i18n/dicts/zh_CN.json`（内容复制自现有 `src/i18n/zh.json`）
- `src/i18n/dicts/en_US.json`（内容复制自现有 `src/i18n/en.json`）
- `src/i18n/dicts/zh_TW.json`（内容复制自 `en_US.json`，作为占位）
- `src/i18n/dicts/ru_RU.json`（复制自 `en_US.json`，占位）
- `src/i18n/dicts/uk_UA.json`（复制自 `en_US.json`，占位）
- `src/i18n/dicts/ja_JP.json`（复制自 `en_US.json`，占位）
- `src/i18n/dicts/fr_FR.json`（复制自 `en_US.json`，占位）
- `src/i18n/dicts/es_ES.json`（复制自 `en_US.json`，占位）
- `src/i18n/dicts/ar_SA.json`（复制自 `en_US.json`，占位）
- `src/i18n/dicts/en_XA.json`（复制自 `en_US.json`，占位）

### 修改
- `src/i18n/types.ts`（扩展 `Locale` 联合类型）
- `src/i18n/I18nProvider.tsx`（locale 源从 localStorage 改为 URL path；提供 switchLocale 做 router 跳转）
- `src/components/SiteHeader.tsx`（改原生 `<select>` 下拉，10 选项）
- `src/app/layout.tsx`（移除 `<I18nProvider>` 和 `<SiteHeader>` 挂载，只保留 `<html>`、`<body>`、字体、metadata）

### 删除
- `src/app/page.tsx`（移动到 `src/app/[locale]/page.tsx`，内容不变）
- `src/i18n/zh.json`（内容已迁到 `src/i18n/dicts/zh_CN.json`）
- `src/i18n/en.json`（内容已迁到 `src/i18n/dicts/en_US.json`）

### 不动
- `src/modules/landing/ScenariosSection.tsx`（保持当前 Codex 版本，不改）
- `src/modules/landing/SkillsEcoSection.tsx`
- `src/lib/motion.ts`
- `src/lib/constants.ts`
- `src/app/globals.css`
- `next.config.mjs`（不需要改，本 spec 不引入任何 i18n 第三方库）
- `package.json`（不加新依赖）

---

## 技术上下文

### 现有 I18nProvider（将被重写）

```tsx
// src/i18n/I18nProvider.tsx 当前版本
"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import zh from "./zh.json";
import en from "./en.json";
import type { Dict, Locale } from "./types";

const DICTS: Record<Locale, Dict> = { zh: zh as Dict, en: en as Dict };

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh");
  useEffect(() => {
    const saved = localStorage.getItem("claw42-locale");
    if (saved === "zh" || saved === "en") {
      setLocaleState(saved);
      document.documentElement.lang = saved === "zh" ? "zh-CN" : "en";
    }
  }, []);
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("claw42-locale", l);
    document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
  }, []);
  return (
    <I18nContext.Provider value={{ locale, setLocale, t: DICTS[locale] }}>
      {children}
    </I18nContext.Provider>
  );
}
```

### 现有 SiteHeader（将被重写）

```tsx
// src/components/SiteHeader.tsx 当前版本
"use client";
import Image from "next/image";
import { useI18n } from "@/i18n/I18nProvider";

export function SiteHeader() {
  const { locale, setLocale, t } = useI18n();
  const nextLabel = locale === "zh" ? t.nav.switchLangToEn : t.nav.switchLangToZh;
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between px-6 md:px-10 lg:px-16">
        <a href="/" className="flex items-center gap-3 shrink-0">
          <Image src="/images/claw42-logo-trimmed.png" alt="Claw 42" width={40} height={40} priority className="w-10 h-10 object-contain" />
          <span className="text-white font-semibold text-lg tracking-tight">Claw 42</span>
        </a>
        <button onClick={() => setLocale(locale === "zh" ? "en" : "zh")} className="w-11 h-11 rounded-full bg-white/[0.08] border border-white/[0.12] hover:bg-white/[0.15] transition-all text-white/80 hover:text-white text-sm font-semibold flex items-center justify-center" aria-label="Switch language">
          {nextLabel}
        </button>
      </div>
    </nav>
  );
}
```

### 现有 layout.tsx（将瘦身）

```tsx
// src/app/layout.tsx 当前版本
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/i18n/I18nProvider";
import { SiteHeader } from "@/components/SiteHeader";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Claw 42 — AI Trading Agent Platform",
  description: "The world's first AI Agent competitive cultivation ecosystem dedicated to cryptocurrency trading",
  icons: { icon: "/images/robot-hero.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className={inter.className}>
        <I18nProvider>
          <SiteHeader />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
```

### 现有 Dict 类型

```ts
// src/i18n/types.ts — 保留 Dict 接口不动，只改 Locale 联合类型
export type Locale = "zh" | "en";  // ← 替换为 10 个 locale
export interface Dict { /* 保持不变 */ }
```

---

## 具体要求

### R1：新建 `src/i18n/locales.ts`

```ts
import type { Locale } from "./types";

export const LOCALES = [
  "zh_CN", "zh_TW", "en_US", "ru_RU", "uk_UA",
  "ja_JP", "fr_FR", "es_ES", "ar_SA", "en_XA",
] as const;

export const DEFAULT_LOCALE: Locale = "en_US";

export const RTL_LOCALES: ReadonlySet<Locale> = new Set(["ar_SA"]);

// URL 段 → HTML lang 属性值（短横线）
export const HTML_LANG: Record<Locale, string> = {
  zh_CN: "zh-CN",
  zh_TW: "zh-TW",
  en_US: "en-US",
  ru_RU: "ru-RU",
  uk_UA: "uk-UA",
  ja_JP: "ja-JP",
  fr_FR: "fr-FR",
  es_ES: "es-ES",
  ar_SA: "ar-SA",
  en_XA: "en",
};

// 下拉菜单显示：英文名 + 本地名
export const LOCALE_LABELS: Record<Locale, { en: string; native: string }> = {
  zh_CN: { en: "Chinese (Simplified)", native: "简体中文" },
  zh_TW: { en: "Chinese (Traditional)", native: "繁體中文" },
  en_US: { en: "English", native: "English" },
  ru_RU: { en: "Russian", native: "Русский" },
  uk_UA: { en: "Ukrainian", native: "Українська" },
  ja_JP: { en: "Japanese", native: "日本語" },
  fr_FR: { en: "French", native: "Français" },
  es_ES: { en: "Spanish", native: "Español" },
  ar_SA: { en: "Arabic", native: "العربية" },
  en_XA: { en: "English (East Asia)", native: "English (EA)" },
};

export function isLocale(x: string): x is Locale {
  return (LOCALES as readonly string[]).includes(x);
}

// Accept-Language 头匹配：取第一个匹配项，没命中返回 DEFAULT_LOCALE
// 简单前缀匹配：`zh` → zh_CN，`en` → en_US，`pt` → 默认
export function matchLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const prefs = acceptLanguage
    .split(",")
    .map((s) => s.trim().split(";")[0].toLowerCase());
  for (const pref of prefs) {
    // 完全匹配（zh-cn → zh_CN）
    const normalized = pref.replace("-", "_");
    for (const l of LOCALES) {
      if (l.toLowerCase() === normalized) return l;
    }
    // 前缀匹配（zh → zh_CN；en → en_US；ar → ar_SA）
    const primary = pref.split("-")[0];
    const primaryMap: Record<string, Locale> = {
      zh: "zh_CN", en: "en_US", ru: "ru_RU", uk: "uk_UA",
      ja: "ja_JP", fr: "fr_FR", es: "es_ES", ar: "ar_SA",
    };
    if (primaryMap[primary]) return primaryMap[primary];
  }
  return DEFAULT_LOCALE;
}
```

### R2：改 `src/i18n/types.ts`

只改 `Locale` 一行，Dict 接口保持不动：

```ts
export type Locale =
  | "zh_CN" | "zh_TW" | "en_US" | "ru_RU" | "uk_UA"
  | "ja_JP" | "fr_FR" | "es_ES" | "ar_SA" | "en_XA";

// 下面的 Dict interface 保持原样，不要改字段
export interface Dict {
  nav: { switchLangToEn: string; switchLangToZh: string; };
  hero: { /* ... 原样保留 ... */ };
  // ... 其他字段原样保留
}
```

**重要**：`Dict.nav.switchLangToEn` 和 `switchLangToZh` 两个字段**保留不动**（不要改成新结构），即使下拉菜单不再用它们——删掉会破坏 zh_CN/en_US JSON 的现有结构。10 个 JSON 字典都必须有这俩字段（占位值见下）。

### R3：迁移 dict 文件

1. 把 `src/i18n/zh.json` 完整内容复制到 `src/i18n/dicts/zh_CN.json`，内容 1:1 不改。
2. 把 `src/i18n/en.json` 完整内容复制到 `src/i18n/dicts/en_US.json`，内容 1:1 不改。
3. 删除 `src/i18n/zh.json` 和 `src/i18n/en.json`。
4. 把 `src/i18n/dicts/en_US.json` **完整内容**复制 8 份，文件名分别是 `zh_TW.json`、`ru_RU.json`、`uk_UA.json`、`ja_JP.json`、`fr_FR.json`、`es_ES.json`、`ar_SA.json`、`en_XA.json`。这 8 个文件的**内容完全等同 en_US.json**，作为架构占位（翻译后续迭代）。

**不要**自作主张翻译那 8 个文件。**不要**修改 zh_CN 和 en_US 的内容。

### R4：新建 `src/middleware.ts`

放在 `src/` 目录下（和 `src/app/` 同级的 `src/middleware.ts`）。项目使用 Next 14 的 src/ 目录结构，middleware 必须放 src/ 内，不是项目根：

```ts
import { NextResponse, type NextRequest } from "next/server";
import { LOCALES, DEFAULT_LOCALE, matchLocale } from "@/i18n/locales";

const LOCALE_COOKIE = "claw42-locale";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 已含 locale 前缀 → 放行
  const hasLocale = LOCALES.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)
  );
  if (hasLocale) return NextResponse.next();

  // 决定 locale：cookie > Accept-Language > 默认
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const isValidCookie = cookieLocale && (LOCALES as readonly string[]).includes(cookieLocale);
  const locale = isValidCookie
    ? (cookieLocale as typeof LOCALES[number])
    : matchLocale(request.headers.get("accept-language"));

  // 重定向
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // 跳过 _next、api、静态资源、favicon
  matcher: ["/((?!_next|api|images|fonts|.*\\..*).*)"],
};
```

注意：middleware 从 `@/i18n/locales` 导入（即 `src/i18n/locales`）。Next 14 允许 middleware 放项目根或 src/ 内——本项目用 src/ 目录结构，所以 middleware 必须放 `src/middleware.ts`，不能放项目根。

### R5：移动 page.tsx

1. 新建目录 `src/app/[locale]/`。
2. 把 `src/app/page.tsx` 内容**原封不动**移动到 `src/app/[locale]/page.tsx`，代码零改动。
3. 删除 `src/app/page.tsx`。

### R6：新建 `src/app/[locale]/layout.tsx`

```tsx
import { notFound } from "next/navigation";
import { I18nProvider } from "@/i18n/I18nProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { LOCALES, HTML_LANG, RTL_LOCALES, isLocale } from "@/i18n/locales";
import type { Locale } from "@/i18n/types";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const typedLocale = locale as Locale;
  const dir = RTL_LOCALES.has(typedLocale) ? "rtl" : "ltr";

  return (
    <div lang={HTML_LANG[typedLocale]} dir={dir}>
      <I18nProvider initialLocale={typedLocale}>
        <SiteHeader />
        {children}
      </I18nProvider>
    </div>
  );
}
```

注意：`params` 在 Next 14.2+ 已经是 Promise，必须 `await`。`<html>` 和 `<body>` 标签只能在 root layout `src/app/layout.tsx` 里有——这里用 `<div lang dir>` 替代。

### R7：改 `src/app/layout.tsx`（root layout 瘦身）

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Claw 42 — AI Trading Agent Platform",
  description:
    "The world's first AI Agent competitive cultivation ecosystem dedicated to cryptocurrency trading",
  icons: { icon: "/images/robot-hero.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

**关键改动**：
- 不再挂 `<I18nProvider>` 和 `<SiteHeader>`（移到 `[locale]/layout.tsx`）
- `<html>` 不再写死 `lang="zh-CN"`——locale-specific lang 在 `[locale]/layout.tsx` 里通过 `<div lang dir>` 应用到内容

### R8：重写 `src/i18n/I18nProvider.tsx`

```tsx
"use client";

import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { Dict, Locale } from "./types";
import { LOCALES, HTML_LANG } from "./locales";

import zh_CN from "./dicts/zh_CN.json";
import zh_TW from "./dicts/zh_TW.json";
import en_US from "./dicts/en_US.json";
import ru_RU from "./dicts/ru_RU.json";
import uk_UA from "./dicts/uk_UA.json";
import ja_JP from "./dicts/ja_JP.json";
import fr_FR from "./dicts/fr_FR.json";
import es_ES from "./dicts/es_ES.json";
import ar_SA from "./dicts/ar_SA.json";
import en_XA from "./dicts/en_XA.json";

const DICTS: Record<Locale, Dict> = {
  zh_CN: zh_CN as Dict,
  zh_TW: zh_TW as Dict,
  en_US: en_US as Dict,
  ru_RU: ru_RU as Dict,
  uk_UA: uk_UA as Dict,
  ja_JP: ja_JP as Dict,
  fr_FR: fr_FR as Dict,
  es_ES: es_ES as Dict,
  ar_SA: ar_SA as Dict,
  en_XA: en_XA as Dict,
};

interface I18nContextValue {
  locale: Locale;
  t: Dict;
  switchLocale: (next: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = useCallback(
    (next: Locale) => {
      // cookie 记忆（365 天）
      document.cookie = `claw42-locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      // 替换 URL 中的 locale 段
      const segments = pathname.split("/").filter(Boolean);
      if (segments.length > 0 && (LOCALES as readonly string[]).includes(segments[0])) {
        segments[0] = next;
      } else {
        segments.unshift(next);
      }
      router.push("/" + segments.join("/"));
    },
    [pathname, router]
  );

  return (
    <I18nContext.Provider
      value={{ locale: initialLocale, t: DICTS[initialLocale], switchLocale }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
```

**关键**：
- 不再用 `useState` 管 locale——locale 从 URL 段由 `[locale]/layout.tsx` 通过 prop 注入
- `setLocale` 改名为 `switchLocale`（语义：切换并跳转）
- 移除 `localStorage`，改用 cookie（middleware 读 cookie 做首次重定向）
- 保留 `useI18n()` 钩子的接口：`{ locale, t, switchLocale }`

### R9：重写 `src/components/SiteHeader.tsx`

```tsx
"use client";

import Image from "next/image";
import { useI18n } from "@/i18n/I18nProvider";
import { LOCALES, LOCALE_LABELS } from "@/i18n/locales";
import type { Locale } from "@/i18n/types";

export function SiteHeader() {
  const { locale, switchLocale } = useI18n();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between px-6 md:px-10 lg:px-16">
        <a href={`/${locale}`} className="flex items-center gap-3 shrink-0">
          <Image
            src="/images/claw42-logo-trimmed.png"
            alt="Claw 42"
            width={40}
            height={40}
            priority
            className="w-10 h-10 object-contain"
          />
          <span className="text-white font-semibold text-lg tracking-tight">
            Claw 42
          </span>
        </a>

        <label className="relative" aria-label="Select language">
          <select
            value={locale}
            onChange={(e) => switchLocale(e.target.value as Locale)}
            className="appearance-none h-11 pl-4 pr-9 rounded-full bg-white/[0.08] border border-white/[0.12] hover:bg-white/[0.15] transition-all text-white/90 hover:text-white text-sm font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7c5cff]/50"
          >
            {LOCALES.map((l) => (
              <option key={l} value={l} className="bg-[#111] text-white">
                {LOCALE_LABELS[l].native}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </label>
      </div>
    </nav>
  );
}
```

**注意**：
- Logo 链接改为 `/${locale}`，避免点 Logo 回根路径触发重定向
- 用原生 `<select>`，因为不引入新依赖；option 里用 native 名（用户看得懂）
- 下拉箭头用 inline SVG（避免 lucide 等依赖）

### R10：构建验证

Next.js 14 `generateStaticParams` 会预渲染 10 个 locale 的静态页。构建需通过，无运行时 console 报错。

---

## 验收标准

执行前确保本地 `main` 分支已合并 Spec A（`feature/claw42-scenarios-fix`）。从 main 拉新分支 `feature/claw42-i18n-10langs`。

- [ ] `git diff --name-only main` 列表**只包含**上面"变更范围"声明的文件
- [ ] `ls src/i18n/dicts/ | wc -l` → **10**
- [ ] `ls src/i18n/zh.json src/i18n/en.json 2>&1 | grep -c "No such"` → **2**（确认已删除）
- [ ] `ls src/middleware.ts` 存在；`ls middleware.ts` 不存在（项目根不能有 middleware.ts）
- [ ] `cat src/i18n/dicts/zh_CN.json | head -5` 显示 `"遇见你的 AI 交易伙伴"` 字样（证明从 zh.json 迁移未丢失）
- [ ] `cat src/i18n/dicts/ja_JP.json` 内容和 `src/i18n/dicts/en_US.json` 完全一致（`diff` 无输出）
- [ ] `grep -r "from \"@/i18n/zh\"" src/` → 无输出；`grep -r "from \"@/i18n/en\"" src/` → 无输出
- [ ] `grep -rn "localStorage" src/i18n/` → 无输出（已改为 cookie）
- [ ] `grep -rn "useState" src/i18n/I18nProvider.tsx` → 无输出（locale 不再由 useState 管）
- [ ] `npx tsc --noEmit` 退出 0
- [ ] `npm run lint` 输出 `No ESLint warnings or errors`
- [ ] `npm run build` 成功，日志中看到 10 个 locale 路由被静态生成（`/zh_CN`、`/en_US`…）
- [ ] `npm run dev` 后：
  - [ ] 访问 `/` → 自动 302 到 `/en_US`（默认）
  - [ ] 访问 `/zh_CN` → 显示中文站，Header 下拉选中 `简体中文`
  - [ ] 访问 `/ja_JP` → 页面文案是英文（占位正常），Header 下拉选中 `日本語`
  - [ ] 在 `/en_US` 页切换到 `简体中文` → URL 变为 `/zh_CN`，文案变中文
  - [ ] 访问 `/ar_SA` → 开发者工具查看：包裹内容的 `<div>` 有 `dir="rtl"` 属性
  - [ ] 访问 `/bogus` → 404（不匹配 locale 规则）

---

## 约束（不要做的事）

1. **不加任何 npm 依赖**：不用 `next-intl`、`next-i18next`、`react-intl`、`@formatjs/*`、`negotiator`、`@formatjs/intl-localematcher`。自建，保持依赖树干净。
2. **不翻译 8 个占位字典**：zh_TW/ru_RU/uk_UA/ja_JP/fr_FR/es_ES/ar_SA/en_XA 的内容**必须**和 en_US.json 完全一致。不要机翻，不要 AI 翻译，不要用英文"改写"。Dan 后续专门安排翻译。
3. **不改 Dict 接口字段**：`src/i18n/types.ts` 里的 Dict interface 字段结构保留原样（nav/hero/quickStart/scenarios/why/skillsEco/disclaimer），只改 Locale 联合类型。
4. **不改 `src/modules/landing/ScenariosSection.tsx`**：Spec A 已经最终版，本 spec 不碰。
5. **不改 hero/quickStart/scenarios/skillsEco 任何组件逻辑**：它们通过 `useI18n()` 拿数据，接口不变，所以不需要改。
6. **不用 React state 管 locale**：locale 必须从 URL 段驱动（通过 `[locale]/layout.tsx` 的 params 传入 I18nProvider 的 `initialLocale` prop）。
7. **不在 root layout (`src/app/layout.tsx`) 里挂 I18nProvider / SiteHeader**：它们必须在 `[locale]/layout.tsx` 里，才能拿到 locale。
8. **不写 `<html>` 的 `lang` 属性**（保持原值或移除）——locale-specific lang 通过 `[locale]/layout.tsx` 的 `<div lang dir>` 应用。
9. **cookie 名必须用 `claw42-locale`**：middleware 和 I18nProvider 读写同一个名字。
10. **URL 格式严格用下划线**：`/zh_CN` 对，`/zh-CN` 错，`/zh` 错。

---

## 交付

- 分支：`feature/claw42-i18n-10langs`
- 基于：`main`（必须先合并 Spec A）
- PR 标题建议：`feat(i18n): 10 语言 + URL locale 路由（zh_CN/en_US/… 10 个 locale）`
- PR 描述需说明：8 个非 zh_CN/en_US 字典为 en_US 内容占位，翻译后续迭代
