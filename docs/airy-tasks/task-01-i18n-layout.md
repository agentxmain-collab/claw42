# Task 01 — i18n 双语切换 + 排版收敛

**分支**: `feature/claw42-i18n-layout`
**执行者**: Airy
**审核者**: F（总调度）

---

## 目标

一句话：为 claw42 加中英文切换（自建 Context + JSON 文件）+ 收敛全站 section 排版间距。

完成后世界变成什么样：
- 页面右上角多一个圆形 `EN / 中` 切换按钮
- 点击切换中英文，刷新后记住选择（localStorage）
- 所有可见文案（Hero / QuickStart / Scenarios / Why / Disclaimer）都能切换
- 页面总高度减少 15%+（section 间距收敛）
- 无新增 npm 依赖

---

## 技术上下文

- Next.js 14.2.35 App Router
- 所有组件当前在 `src/app/page.tsx` 单文件（361 行）
- layout.tsx 是 Server Component
- page.tsx 顶部是 `"use client"`
- Tailwind v3.4.1

**关键约束**：
- i18n 方案 = 自建 Context + JSON，**禁用** next-intl / next-i18next / react-intl
- Provider 必须是 Client Component（要用 useState）
- 语言切换不改 URL（不走 /zh /en 路由方案）
- localStorage key = `claw42-locale`
- 首次 SSR 输出中文（初始 state = "zh"），客户端 useEffect 再读 localStorage 覆盖

---

## 变更范围

### 新建

- `src/i18n/types.ts`
- `src/i18n/zh.json`
- `src/i18n/en.json`
- `src/i18n/I18nProvider.tsx`
- `src/i18n/LanguageSwitcher.tsx`

### 修改

- `src/app/layout.tsx` — 包裹 `<I18nProvider>` + 渲染 `<LanguageSwitcher>`
- `src/app/page.tsx` — 所有硬编码文案改为 `t.xxx.yyy` 引用 + section padding 收敛

### 不动（禁止碰）

- `src/app/globals.css`
- `tailwind.config.ts`
- `next.config.mjs`
- `postcss.config.mjs`
- `public/images/`
- `package.json` / `package-lock.json`（本任务零新依赖）
- `src/app/fonts/`
- Scenarios 的 grid 布局结构（Task 02 再重做）

---

## 具体要求

### 1. 文件结构

```
src/
  i18n/
    types.ts
    zh.json
    en.json
    I18nProvider.tsx
    LanguageSwitcher.tsx
```

### 2. `src/i18n/types.ts`

```typescript
export type Locale = "zh" | "en";

export interface Dict {
  nav: {
    switchLangToEn: string; // 当前中文时按钮显示
    switchLangToZh: string; // 当前英文时按钮显示
  };
  hero: {
    title: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  quickStart: {
    title: string;
  };
  scenarios: {
    sectionTitle: string;
    sectionSubtitle: string;
    daily: {
      title: string;
      badge: string;
      desc: string;
      inputPlaceholder: string;
      cta: string;
      chatSpeaker: string;
      chatTime: string;
      chatTitle: string;
      chatBullets: string[];
    };
    realtime: {
      title: string;
      desc: string;
      ticker: string;
    };
    autoTrade: {
      title: string;
      desc: string;
      cta: string;
    };
  };
  why: {
    title: string;
    subtitle: string;
    cards: Array<{ title: string; desc: string }>;
  };
  disclaimer: {
    title: string;
    paragraphs: string[];
  };
}
```

### 3. `src/i18n/I18nProvider.tsx`

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import zh from "./zh.json";
import en from "./en.json";
import type { Dict, Locale } from "./types";

const DICTS: Record<Locale, Dict> = {
  zh: zh as Dict,
  en: en as Dict,
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Dict;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh");

  // 客户端挂载后从 localStorage 读取
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

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
```

### 4. `src/i18n/LanguageSwitcher.tsx`

```tsx
"use client";

import { useI18n } from "./I18nProvider";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const nextLabel = locale === "zh" ? t.nav.switchLangToEn : t.nav.switchLangToZh;

  return (
    <button
      onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
      className="fixed top-5 right-5 z-50 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 hover:scale-105 transition-all text-white text-sm font-semibold flex items-center justify-center shadow-lg"
      aria-label="Switch language"
    >
      {nextLabel}
    </button>
  );
}
```

### 5. `src/app/layout.tsx` 改造

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Claw 42 — AI Trading Agent Platform",
  description:
    "The world's first AI Agent competitive cultivation ecosystem dedicated to cryptocurrency trading",
  icons: {
    icon: "/images/robot-hero.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className={inter.className}>
        <I18nProvider>
          <LanguageSwitcher />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
```

**关键**：`@/i18n/...` 路径别名走现有 `tsconfig.json` 的 `@/*` 配置（已存在，不需要改）。如果不确认，用相对路径 `../i18n/I18nProvider` 也行。

### 6. `src/app/page.tsx` 文案替换

每个 Section 组件里加 `const { t } = useI18n();`，所有硬编码字符串替换为 `t.xxx.yyy`。

**示例改造**（Hero）：

```tsx
// BEFORE
function HeroSection() {
  return (
    <section className="relative pt-8 md:pt-16">
      ...
      <h1>Meet Your AI Trading Partner</h1>
      <p>The world's first AI Agent competitive cultivation ecosystem...</p>
      <button>立即开始</button>
      <button>API文档</button>
      ...
    </section>
  );
}

// AFTER
function HeroSection() {
  const { t } = useI18n();
  return (
    <section className="relative pt-6 md:pt-10">
      ...
      <h1>{t.hero.title}</h1>
      <p>{t.hero.subtitle}</p>
      <button>{t.hero.ctaPrimary}</button>
      <button>{t.hero.ctaSecondary}</button>
      ...
    </section>
  );
}
```

对所有 Section 重复此模式。

**特殊处理**：
- `whyCards` 数组当前在组件外定义。改为组件内 `const cards = t.why.cards;`
- Scenarios 的 chat bullets 当前硬编码 5 行 `<p>`。改为 `t.scenarios.daily.chatBullets.map((line, i) => <p key={i}>{line}</p>)`
- Disclaimer 4 段文字同理 map
- Scenarios 的 chatBullets 内部包含带颜色的 span（`<span className="text-green-400">`）。保留硬编码结构，只把整行文本做 i18n：`<p>{bullet}</p>`。**颜色层暂不做富文本 i18n**，Task 02 有机会再优化。

### 7. 排版收敛参数

改动的 padding / margin：

| 位置 | Before | After |
|------|--------|-------|
| `<Section>` wrapper | `py-20 md:py-28` | `py-12 md:py-16` |
| HeroSection 外 | `pt-8 md:pt-16` | `pt-6 md:pt-10` |
| HeroSection 内 content | `pb-20` | `pb-12` |
| Hero h1 | `mb-5` | `mb-4` |
| Hero p（subtitle） | `mb-10` | `mb-8` |
| QuickStart h2 | `mb-12` | `mb-10` |
| Scenarios header | `mb-14` | `mb-10` |
| Scenarios subtitle `mb-4` | `mb-4` | `mb-3` |
| Why header subtitle | `mb-6` | `mb-4` |
| Why cards grid | `mt-14` | `mt-10` |
| DisclaimerSection | `mt-20 py-16` | `mt-10 py-10` |

其余不动（gap-6 / 卡片内 padding / max-width 等保持）。

---

## 文案清单

### `src/i18n/zh.json`

```json
{
  "nav": {
    "switchLangToEn": "EN",
    "switchLangToZh": "中"
  },
  "hero": {
    "title": "遇见你的 AI 交易伙伴",
    "subtitle": "全球首个专注加密货币交易的 AI Agent 竞技养成生态",
    "ctaPrimary": "立即开始",
    "ctaSecondary": "API 文档"
  },
  "quickStart": {
    "title": "30 秒遇见你的第一个 AI Agent"
  },
  "scenarios": {
    "sectionTitle": "常用场景",
    "sectionSubtitle": "从新手入门到资深策略，AI Agent 正在接管加密交易的每一个关键环节。",
    "daily": {
      "title": "生成加密货币日报",
      "badge": "推荐场景",
      "desc": "一键唤醒 AI 获取全球市场动态。AI 将自动扫描主流币种波动、热门社交媒体情绪、重要链上数据与宏观新闻，输出结构化的中文研报，助你开启每日交易。",
      "inputPlaceholder": "点击复制内容，发送给你的 agent 即可体验",
      "cta": "立即试用",
      "chatSpeaker": "Claw 42 Agent",
      "chatTime": "just now",
      "chatTitle": "📊 今日加密货币市场日报",
      "chatBullets": [
        "BTC: $67,432 (+2.3%) — 突破关键阻力位",
        "ETH: $3,521 (+1.8%) — Layer2 TVL 创新高",
        "SOL: $178 (-0.5%) — Meme 币热度回落",
        "市场情绪: 贪婪 72",
        "链上大额转账: 3 笔 > 1000 BTC"
      ]
    },
    "realtime": {
      "title": "实时行情监控",
      "desc": "24/7 监控市场行情，大涨大跌及时知晓",
      "ticker": "BTC/USDT · Real-time"
    },
    "autoTrade": {
      "title": "Agent 自动化交易",
      "desc": "如需使用交易功能，请先创建 apikey",
      "cta": "Create API Key to start"
    }
  },
  "why": {
    "title": "为什么要做这个产品？",
    "subtitle": "我们搭建这个生态，是为了让每一位交易者都能遇见契合自己的数字同行者，以竞技和养成，重塑加密交易的全新格局。",
    "cards": [
      {
        "title": "竞技公信力",
        "desc": "战绩即信任，拒绝纸上谈兵。我们用公开榜单、实时数据和全真回测，让每一次选择都有据可依。"
      },
      {
        "title": "养成共生力",
        "desc": "从通用模板到你的专属交易大师。领养一个「龙虾」Agent，喂养数据、打磨策略，让它陪你一起成长。"
      },
      {
        "title": "生态自驱力",
        "desc": "Agent 成为 KOL，工具场进化为生态圈。这里不只有交易，还有观点、粉丝、合作与挑战。"
      }
    ]
  },
  "disclaimer": {
    "title": "免责声明",
    "paragraphs": [
      "1. Claw 42 Skills 仅作为信息参考工具。Claw 42 Skills 及其输出的报告以「现状」及「现有」基础提供，不作任何形式的陈述或保证。其内容不构成投资、财务、交易或任何其他形式的建议；不代表买入、卖出或持有任何资产的推荐；不保证所呈现数据或分析的准确性、及时性或完整性。",
      "2. 您使用 Claw 42 Skills 及其相关任意的风险由您自行承担。您需独立负责评估和获得的信息对于自身特定需求的适用性。Claw 42 不认可或保证任何 AI 生成的信息，且 AI 生成的信息内容不作为决策的唯一依据。AI 生成的内容可能包含或反映第三方的观点，并可能存在错误、偏差或过时信息。",
      "3. 对于因使用或禁止使用 Claw 42 Skills 功能而导致的任何损失，Claw 42 概不负责。Claw 42 有权自行决定终止或限制此功能。数字资产价格具有高市场风险和波动性。您的投资价值可能下降也可能上涨，且可能无法收回投资本金。您应对自己的投资决策负全责。Claw 42 对您可能遭受的任何损失不承担责任。",
      "4. 记住过去的并非未来表现的可靠预测指标。在做出任何投资前，您应仔细考虑自己的投资经验、财务状况、投资目标和风险承受能力，并咨询独立财务顾问。更多信息请参阅我们的风险提示和使用条款。"
    ]
  }
}
```

### `src/i18n/en.json`

```json
{
  "nav": {
    "switchLangToEn": "EN",
    "switchLangToZh": "中"
  },
  "hero": {
    "title": "Meet Your AI Trading Partner",
    "subtitle": "The world's first AI Agent competitive cultivation ecosystem dedicated to cryptocurrency trading",
    "ctaPrimary": "Get Started",
    "ctaSecondary": "API Docs"
  },
  "quickStart": {
    "title": "Meet Your First AI Agent in 30 Seconds"
  },
  "scenarios": {
    "sectionTitle": "Popular Scenarios",
    "sectionSubtitle": "From beginner workflows to advanced strategies, AI Agents are taking over every key step of crypto trading.",
    "daily": {
      "title": "Generate Crypto Daily Report",
      "badge": "Recommended",
      "desc": "Wake up your AI with one click to capture global market dynamics. The AI scans price action of major coins, social sentiment, on-chain signals and macro news, then delivers a structured report to kick off your trading day.",
      "inputPlaceholder": "Click to copy, then send to your agent to try it out",
      "cta": "Try Now",
      "chatSpeaker": "Claw 42 Agent",
      "chatTime": "just now",
      "chatTitle": "📊 Today's Crypto Market Report",
      "chatBullets": [
        "BTC: $67,432 (+2.3%) — Breaking key resistance",
        "ETH: $3,521 (+1.8%) — Layer 2 TVL hits new high",
        "SOL: $178 (-0.5%) — Meme coin heat cooling",
        "Sentiment: Greed 72",
        "On-chain whale moves: 3 transfers > 1000 BTC"
      ]
    },
    "realtime": {
      "title": "Real-Time Market Monitor",
      "desc": "24/7 market monitoring — catch every surge and drop instantly",
      "ticker": "BTC/USDT · Real-time"
    },
    "autoTrade": {
      "title": "Agent Automated Trading",
      "desc": "To enable trading, please create an API key first",
      "cta": "Create API Key to start"
    }
  },
  "why": {
    "title": "Why This Product?",
    "subtitle": "We built this ecosystem so every trader can meet a digital companion tailored to them — reshaping crypto trading through competition and cultivation.",
    "cards": [
      {
        "title": "Competitive Credibility",
        "desc": "Track record over talk. Public leaderboards, real-time data and full backtests back every choice."
      },
      {
        "title": "Cultivation Symbiosis",
        "desc": "From generic template to your dedicated trading master. Adopt a \"Claw\" Agent, feed it data, refine its strategies — grow together."
      },
      {
        "title": "Self-Driven Ecosystem",
        "desc": "Agents become KOLs, tools evolve into a community. Beyond trading — opinions, followers, collaborations and challenges."
      }
    ]
  },
  "disclaimer": {
    "title": "Disclaimer",
    "paragraphs": [
      "1. Claw 42 Skills is provided as an informational reference tool only. Claw 42 Skills and its output reports are provided on an \"as-is\" and \"as-available\" basis, without any representation or warranty of any kind. The content does not constitute investment, financial, trading or any other form of advice; it is not a recommendation to buy, sell, or hold any asset; and we do not guarantee the accuracy, timeliness or completeness of data or analysis presented.",
      "2. Your use of Claw 42 Skills and any related risks are borne by you at your sole discretion. You are independently responsible for evaluating whether the information obtained suits your specific needs. Claw 42 does not endorse or guarantee any AI-generated content, and such content should not be the sole basis of any decision. AI-generated content may contain or reflect third-party views and may include errors, bias or outdated information.",
      "3. Claw 42 bears no responsibility for any loss arising from use or inability to use Claw 42 Skills. Claw 42 reserves the right to terminate or restrict this feature at its sole discretion. Digital asset prices carry high market risk and volatility. The value of your investment may go down as well as up, and you may not recover your principal. You are fully responsible for your investment decisions. Claw 42 assumes no liability for any loss you may suffer.",
      "4. Past performance is not a reliable indicator of future performance. Before making any investment, carefully consider your experience, financial situation, investment objectives and risk tolerance, and consult an independent financial advisor. For more information, see our Risk Notice and Terms of Use."
    ]
  }
}
```

---

## 验收标准

编译/类型：
- [ ] `npm run build` 通过无 error
- [ ] `npx tsc --noEmit` 通过无 error
- [ ] `npm run lint` 通过（allow warning，不允许 error）

功能：
- [ ] 页面默认显示中文（初次访问）
- [ ] 右上角切换按钮固定显示，不遮挡 Hero 主内容
- [ ] 点击按钮 → 立即切换语言，所有可见文案同步切换
- [ ] 切换后刷新页面 → 保持上次选择的语言
- [ ] 切换时 `<html lang>` 属性从 `zh-CN` ↔ `en` 同步变化（DevTools 验证）

覆盖完整性：
- [ ] `grep -n "Meet Your AI Trading Partner" src/app/page.tsx` 无结果
- [ ] `grep -n "立即开始" src/app/page.tsx` 无结果
- [ ] `grep -n "生成加密货币日报" src/app/page.tsx` 无结果
- [ ] `grep -n "免责声明" src/app/page.tsx` 无结果
- [ ] page.tsx 中所有 UI 可见字符串都通过 `t.xxx` 引用

结构：
- [ ] `ls src/i18n/` 显示 5 个文件：types.ts / zh.json / en.json / I18nProvider.tsx / LanguageSwitcher.tsx
- [ ] `package.json` dependencies 未增加任何条目

排版：
- [ ] 页面总高度对比前后，新版本减少 ≥ 15%（浏览器开发者工具验证 body 总高度）
- [ ] 无视觉错位 / 溢出 / 内容被遮挡

---

## 不要做的事

- 不要引入任何新 npm 包（zero dependency 本任务硬要求）
- 不要重构 Scenarios 的 grid 布局结构（Task 02 才做）
- 不要改 globals.css 的动画定义
- 不要把 layout.tsx 改成 Client Component
- 不要把 `<html lang>` 初始值从 `zh-CN` 改掉（初始 SSR 必须和初始 state 一致，避免 hydration mismatch）
- 不要把 localStorage 读取放到 useState 初始值里（SSR/CSR 不一致会报错）
- 不要把 i18n Dict 类型做成 `Record<string, any>`（用严格的 Dict interface 保证类型安全）

---

## 执行顺序建议

1. `git checkout -b feature/claw42-i18n-layout`
2. 建 `src/i18n/types.ts`（纯类型，先立契约）
3. 建 `src/i18n/zh.json` + `src/i18n/en.json`（复制本 spec 附录的 JSON）
4. 建 `src/i18n/I18nProvider.tsx`（Context + Provider + useI18n）
5. 建 `src/i18n/LanguageSwitcher.tsx`
6. 改 `src/app/layout.tsx`（包裹 Provider + 切换器）
7. 改 `src/app/page.tsx`：按 Hero → QuickStart → Scenarios → Why → Disclaimer 顺序替换文案
8. 应用排版收敛参数
9. `npm run build` + `npx tsc --noEmit` 验证
10. `npm run dev` 本地目测切换 + 刷新持久化 + 页面高度
11. commit + push + 开 PR

---

## 提交信息建议

```
feat(i18n): add bilingual (zh/en) switcher + tighten section padding

- New: src/i18n/{types.ts,zh.json,en.json,I18nProvider.tsx,LanguageSwitcher.tsx}
- I18nProvider wraps app in layout.tsx, LanguageSwitcher fixed top-right
- All hardcoded copy in page.tsx extracted to t.xxx references
- localStorage persist key: claw42-locale
- Section padding py-20/28 → py-12/16 (total height -15%+)
- No new npm dependencies
```

---

*F @ 2026-04-20 23:xx*
