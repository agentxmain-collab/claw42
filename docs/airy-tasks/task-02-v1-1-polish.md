# Task 02 — v1.1 Polish：Header + Hero 稳定 + AI Skills 生态 + Scenarios 布局重构 + 全站动效

> 分支：`feature/claw42-v1-1-polish`
> 依赖：Task 01（i18n + 排版收敛，已合并到 `main` @ 14616a2）
> 预估：1-1.5 个工作日（比原版多 0.5 天，因 Scenarios 从"视觉重做"升级为"布局重构"）

## 目标

一段话：站点从"Task 01 能看"升级到"v1.1 能打磨上评审"——Header 变好看且固定、Hero 切语言不再错位、补一个主入口级的"AI Skills 生态"板块、全站加一层 framer-motion 动效、**Scenarios 整体重构**（主板块 2 列 = 日报入口 + Chat Preview，次要栏 2 列 = 实时监控 + 自动化交易缩小版）、输入框 click-to-copy、Agent 头像思考动画。

## 变更范围

### 新建
- `src/components/SiteHeader.tsx` — 从 `src/i18n/LanguageSwitcher.tsx` 搬过来，重命名 export 为 `SiteHeader`
- `src/modules/landing/SkillsEcoSection.tsx` — 新板块组件
- 可选：`src/lib/motion.ts` — 复用的 motion variant（如 `fadeUp`, `fadeIn`）

### 修改
- `src/app/layout.tsx` — import `SiteHeader` 替换 `TopBar`
- `src/app/page.tsx` — Hero 布局修正、在 Scenarios 和 Why 之间插入 `<SkillsEcoSection />`、Scenarios 卡片加 motion
- `src/i18n/zh.json` / `src/i18n/en.json` — 新增 `skillsEco` section
- `src/i18n/types.ts` — 新增 `skillsEco` 类型
- `package.json` — 加 `framer-motion` 依赖
- `tailwind.config.ts` — 可选：加 `@keyframes float` 如果不用 framer-motion 做 robot 浮动

### 删除
- `src/i18n/LanguageSwitcher.tsx` — 内容搬到 `SiteHeader.tsx` 后删掉
- `public/images/claw42-logo.png` — 2MB 死资源，代码里从未 import

### 不动
- `src/i18n/I18nProvider.tsx`（Task 01 已验收通过，不要动 Provider 逻辑）
- `src/i18n/zh.json` / `en.json` 里 Task 01 的字段（只追加，不改已有）
- `src/app/globals.css` 里 `.fade-in-section` / `.card-glow` / `.hero-fade` 规则（可在 motion 方案里共存或迁移，详见 #4）
- `tailwind.config.ts` 里已有 brand 色、圆角、font 设定
- `next.config.mjs`、`tsconfig.json`、`eslint` 相关
- Why / QuickStart / Disclaimer 三个板块的结构和文案

## 技术上下文

### 技术栈基线（重申，硬约束）
- Next.js 14.2.35（App Router）
- React 18
- Tailwind CSS 3.4.1
- TypeScript 5.x
- 新允许依赖：**`framer-motion` ^11.x**（本 task 白名单唯一新增）

### 禁用清单
- ❌ Tailwind v4 语法（`@theme` / `@utility`）
- ❌ React 19 only 特性（async client component / use() hook）
- ❌ next-intl / next-i18next
- ❌ 除 `framer-motion` 之外的新依赖（动画库、UI 库、图标库都不许加）
- ❌ 改 I18nProvider 逻辑（hydration-safe 初始 state 已经过审，别动）

### 当前 origin/main 关键代码片段（canonical @ 14616a2）

**`src/i18n/LanguageSwitcher.tsx`**（要搬走 + 删除）：
```tsx
"use client";
import { useI18n } from "./I18nProvider";

export function TopBar() {
  const { locale, setLocale, t } = useI18n();
  const nextLabel = locale === "zh" ? t.nav.switchLangToEn : t.nav.switchLangToZh;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-[60px] bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between px-6 md:px-10 lg:px-16">
        <a href="/" className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-full bg-[#6c4fff] flex items-center justify-center text-white font-bold text-lg">
            C
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">
            Claw 42
          </span>
        </a>
        <button
          onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
          className="w-11 h-11 rounded-full bg-white/[0.08] border border-white/[0.12] hover:bg-white/[0.15] transition-all text-white/80 hover:text-white text-sm font-semibold flex items-center justify-center"
          aria-label="Switch language"
        >
          {nextLabel}
        </button>
      </div>
    </nav>
  );
}
```

**`src/app/layout.tsx`**（`TopBar` import 要换成 `SiteHeader`）：
```tsx
import { I18nProvider } from "@/i18n/I18nProvider";
import { TopBar } from "@/i18n/LanguageSwitcher";
// ...
<I18nProvider>
  <TopBar />
  {children}
</I18nProvider>
```

**`src/app/page.tsx` Hero（当前有问题的片段）**：
```tsx
function HeroSection() {
  const { t } = useI18n();
  return (
    <section className="relative pt-20 md:pt-24">
      <div className="relative w-full hero-fade">
        <Image src="/images/hero-robot-scene.png" alt="Claw 42 AI Trading"
          width={1440} height={548}
          className="w-full h-auto object-cover" priority />
      </div>
      {/* ↓ 问题点：-mt-8 / -mt-16 是固定的负 margin，中文短标题会被拉进机器人脚下 */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 -mt-8 md:-mt-16 pb-12">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] font-bold tracking-tight mb-4 text-white leading-tight">
          {t.hero.title}
        </h1>
        {/* ... */}
      </div>
    </section>
  );
}
```

### Dan 的参考截图内容（「探索 AI Skills 生态」板块）

- 板块标题（中）：`探索 AI Skills 生态`
- 板块副标题（中）：`AI 调用的不只是接口，而是整个交易系统。从研究、策略到风控的全链路闭环。`
- 板块标题（英）：`Explore the AI Skills Ecosystem`
- 板块副标题（英）：`AI doesn't just call APIs — it orchestrates the whole trading system. From research to strategy to risk, a full-loop closed workflow.`

两张卡片（2 列 grid）：

**卡片 1：Contract**
- 图标：占位（灰色圆角方块 + `⚙️` emoji 或 SVG，Airy 自定，不要用图片）
- 标题（中）：`Contract`
- 描述（中）：`合约专用 skill：涵盖市场数据、下单 / 取消订单、止盈 / 止损、持仓和订单查询、账户资产、持仓模式和杠杆查询`
- 标题（英）：`Contract`
- 描述（英）：`Contract-specific skills: market data, order placement & cancellation, TP/SL, positions & orders queries, account assets, position mode and leverage queries.`
- 链接：`了解详情 →` / `Learn more →`（`href="#"` 占位，别跳外链）

**卡片 2：Spot**
- 图标：占位（灰色圆角方块 + `📊` emoji 或 SVG）
- 标题（中）：`Spot`
- 描述（中）：`现货专用 skill：涵盖市场数据、下单 / 取消订单、订单查询、账户余额和资金划转`
- 标题（英）：`Spot`
- 描述（英）：`Spot-specific skills: market data, order placement & cancellation, order queries, account balance and fund transfers.`
- 链接：`了解详情 →` / `Learn more →`

---

## 具体要求

### 1. Header 打磨（`SiteHeader`）

#### 1.1 组件搬家
- 新建 `src/components/SiteHeader.tsx`，把 `LanguageSwitcher.tsx` 的内容搬过来
- export `SiteHeader`（不再叫 `TopBar`）
- `layout.tsx` import 从 `@/i18n/LanguageSwitcher` 改为 `@/components/SiteHeader`
- 删掉 `src/i18n/LanguageSwitcher.tsx`（`LanguageSwitcher.tsx` 整个文件删除，不是清空）

#### 1.2 Logo 替换
- 当前的 "C" 圆形占位（`<div className="w-10 h-10 rounded-full bg-[#6c4fff] ...">C</div>`）替换为：
  ```tsx
  <Image
    src="/images/claw42-logo-trimmed.png"
    alt="Claw 42"
    width={40}
    height={40}
    priority
    className="w-10 h-10 object-contain"
  />
  ```
- import `next/image`

#### 1.3 Header 高度 + 固定
- 高度从 `h-[60px]` 改为 `h-[72px]`
- 保留 `fixed top-0 left-0 right-0 z-50`（已经是固定顶部，确认不要改）
- 保留 `backdrop-blur-xl bg-black/80 border-b border-white/[0.06]`
- 确保 `z-50` 足够盖在任何页面内容之上（现在 Hero/Scenarios/其他板块都没有比 z-50 高的层，OK）

#### 1.4 Hero 避让
- 因为 Header 从 60px 变 72px，`HeroSection` 顶部 padding 从 `pt-20 md:pt-24` 调整为 `pt-24 md:pt-28`——别让 Header 挡住 robot 图顶部

#### 1.5 删除死资源
- 删除 `public/images/claw42-logo.png`（2MB，没被任何代码 import）
- 保留 `public/images/claw42-logo-trimmed.png`（新 logo 用的就是这个）

### 2. Hero 语言切换稳定性

#### 2.1 问题根因
当前 Hero 用 `-mt-8 md:-mt-16` 负 margin 把标题区拉进 hero-robot-scene 图片的下部（让机器人和标题视觉上"连接"）。但负 margin 是**固定值**，不随标题文字长度变化。英文标题 `Meet Your AI Trading Partner`（28 字符）会自动换行，实际占两行；中文标题 `遇见你的 AI 交易伙伴`（11 字符）只占一行。结果：中文版本标题被拉得比英文更靠上，直接叠进机器人脚下。

#### 2.2 修法
**方案（采用）**：移除负 margin，改为 Hero 图片 + 内容区用 `flex flex-col`，内容区用正常 padding。

改成：
```tsx
function HeroSection() {
  const { t } = useI18n();
  return (
    <section className="relative pt-24 md:pt-28 pb-12">
      {/* Hero background image — 固定宽高比，不再让内容叠进去 */}
      <div className="relative w-full hero-fade mb-8 md:mb-12">
        <Image
          src="/images/hero-robot-scene.png"
          alt="Claw 42 AI Trading"
          width={1440}
          height={548}
          className="w-full h-auto object-cover"
          priority
        />
      </div>

      {/* Content — 完全独立于 hero image，不再用负 margin */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] font-bold tracking-tight mb-4 text-white leading-tight">
          {t.hero.title}
        </h1>
        <p className="text-gray-400 text-sm sm:text-base md:text-lg max-w-2xl mb-8 leading-relaxed">
          {t.hero.subtitle}
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          {/* 主 CTA：立即开始 / Get Started — href 锁定 #signup */}
          <a
            href="#signup"
            className="px-8 py-3 bg-[#7c5cff] text-white text-base font-semibold rounded-xl
                       hover:bg-[#8e6bff] hover:shadow-[0_0_24px_rgba(124,92,255,0.5)]
                       transition-all inline-flex items-center justify-center"
          >
            {t.hero.ctaPrimary}
          </a>
          {/* 次 CTA：API 文档 / API Docs — href 占位 #api-docs */}
          <a
            href="#api-docs"
            className="px-8 py-3 bg-white/10 border border-white/20 text-white text-base font-semibold rounded-xl
                       hover:bg-white/15 transition-all inline-flex items-center justify-center"
          >
            {t.hero.ctaSecondary}
          </a>
        </div>
      </div>
    </section>
  );
}
```

要点：
- 移除 `-mt-8 md:-mt-16`
- hero image 之后加 `mb-8 md:mb-12`（图片和标题之间固定间距）
- 中英文切换后布局必须稳定（标题不叠进图片）
- **两个 CTA href 必须固定**：`#signup` / `#api-docs`（Dan 后续给真实 URL 时统一改）
- **Scenarios 的「立即试用」按钮 href 必须和 Hero 主 CTA 完全一致**（都用 `#signup`）

#### 2.3 验收
- 中文状态下截图（Header + Hero + Scenarios 前半），机器人和标题之间有清晰间距
- 英文状态下同位置截图，和中文版视觉差异只有**文字**，没有**位置**差异
- 两张截图并排对比，标题 baseline 基本对齐（±8px 内）

### 3. 新增 `SkillsEcoSection` 板块

#### 3.1 位置
插在 `ScenariosSection` 之后、`WhySection` 之前。`page.tsx` 最终页面顺序：
```tsx
<HeroSection />
<QuickStartSection />
<ScenariosSection />
<SkillsEcoSection />   {/* ← 新加 */}
<WhySection />
<DisclaimerSection />
```

#### 3.2 组件结构
`src/modules/landing/SkillsEcoSection.tsx`：

```tsx
"use client";
import { useI18n } from "@/i18n/I18nProvider";

export function SkillsEcoSection() {
  const { t } = useI18n();
  const cards = t.skillsEco.cards;

  return (
    <section className="relative py-16 md:py-20 px-6 md:px-12 lg:px-20 max-w-7xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-white">
          {t.skillsEco.title}
        </h2>
        <p className="text-gray-400 text-base md:text-lg max-w-3xl mx-auto leading-relaxed">
          {t.skillsEco.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card, i) => (
          <div
            key={i}
            className="card-glow bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col"
          >
            {/* 图标占位 */}
            <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] border border-white/10 flex items-center justify-center mb-4 text-2xl">
              {card.icon}
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-white mb-3">{card.title}</h3>
            <p className="text-gray-400 text-sm md:text-base leading-relaxed mb-5 flex-1">
              {card.desc}
            </p>
            <a
              href="#"
              className="text-[#d1ff55] text-sm font-semibold hover:brightness-110 transition-colors self-start"
            >
              {card.cta} →
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
```

#### 3.3 i18n 字典
`zh.json` 追加（根对象内，和 `scenarios` 同级）：
```json
"skillsEco": {
  "title": "探索 AI Skills 生态",
  "subtitle": "AI 调用的不只是接口，而是整个交易系统。从研究、策略到风控的全链路闭环。",
  "cards": [
    {
      "icon": "⚙️",
      "title": "Contract",
      "desc": "合约专用 skill：涵盖市场数据、下单 / 取消订单、止盈 / 止损、持仓和订单查询、账户资产、持仓模式和杠杆查询",
      "cta": "了解详情"
    },
    {
      "icon": "📊",
      "title": "Spot",
      "desc": "现货专用 skill：涵盖市场数据、下单 / 取消订单、订单查询、账户余额和资金划转",
      "cta": "了解详情"
    }
  ]
}
```

`en.json` 追加：
```json
"skillsEco": {
  "title": "Explore the AI Skills Ecosystem",
  "subtitle": "AI doesn't just call APIs — it orchestrates the whole trading system. From research to strategy to risk, a full-loop closed workflow.",
  "cards": [
    {
      "icon": "⚙️",
      "title": "Contract",
      "desc": "Contract-specific skills: market data, order placement & cancellation, TP/SL, positions & orders queries, account assets, position mode and leverage queries.",
      "cta": "Learn more"
    },
    {
      "icon": "📊",
      "title": "Spot",
      "desc": "Spot-specific skills: market data, order placement & cancellation, order queries, account balance and fund transfers.",
      "cta": "Learn more"
    }
  ]
}
```

`types.ts` 追加到 `Dict` interface：
```ts
skillsEco: {
  title: string;
  subtitle: string;
  cards: Array<{
    icon: string;
    title: string;
    desc: string;
    cta: string;
  }>;
};
```

### 4. 全站动效（framer-motion）

#### 4.1 引入
- `npm install framer-motion@^11`
- 只用 `motion.*` + `AnimatePresence`，不用 `LayoutGroup` / `LazyMotion` 等高级特性
- 所有动效组件必须 `"use client"`（本项目 page.tsx 已经是）

#### 4.2 全局动效规则
- **入场**：任何 Section 级别组件第一次进入视口 → `opacity 0 → 1 + y: 24 → 0`，duration 0.6s，ease `"easeOut"`
- **Stagger**：Section 内多个卡片按顺序延迟入场，每张间隔 0.08s
- **Hover**：按钮 `scale: 1.05`（已有 Tailwind 写法可保留，也可改 motion）、卡片 `y: -4` + glow 增强
- **Tap**：按钮 `scale: 0.98`
- **Reduced motion**：用 `useReducedMotion` 探测，用户偏好 reduce → 所有动效降级为 `opacity 0 → 1`，不做位移
- **关键约束**：动效不能影响 layout（用 `transform` 不用 margin），不能引起 CLS

#### 4.3 落地方案
封装一个公共 motion wrapper（`src/lib/motion.ts` 或直接在 page.tsx 顶部）：
```ts
export const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.6, ease: "easeOut" },
};
```

替换现有 `fade-in-section` CSS 方案（`useScrollFadeIn` hook + `.fade-in-section.is-visible`）为 framer-motion 的 `whileInView`：
- 删掉 `useScrollFadeIn` hook 的调用
- `Section` wrapper 用 `motion.section` 替代 `<section>`
- `globals.css` 里 `.fade-in-section` 规则可以保留（不影响），但不再有 `useScrollFadeIn` 给它加 class
- 或者：保留 CSS `.fade-in-section`，只在**新组件**（SkillsEcoSection、hero）用 motion，不统一替换——Airy 自己选一个方案全站一致，不要一半 CSS 一半 motion

#### 4.4 Hero robot 浮动（可选提升）
`hero-robot-scene.png` 给轻微浮动：
```tsx
<motion.div
  animate={{ y: [0, -8, 0] }}
  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
  className="relative w-full hero-fade mb-8 md:mb-12"
>
  <Image ... />
</motion.div>
```
注意：振幅 8px 足够 subtle，不要做大，避免喧宾夺主。

### 5. Scenarios 布局重构 + 视觉（dict 已有字段不改，追加两个新字段）

> 参考：`docs/airy-tasks/assets/scenarios-reference-zh.png`（中文设计稿，pixel 对齐目标）
> 对照：`docs/airy-tasks/assets/scenarios-current-en.png`（当前上线英文版，视觉缺失项参考）
>
> **本节替代上一版"视觉重做不改结构"的策略**。Airy 第一版按 bento 2x2 做了视觉重做，结构不对——Dan 反馈后按下方布局重构一次性重做。

#### 5.1 新布局（结构要改）

页面从当前 bento grid（左大卡 `lg:row-span-2` + 右两小卡）重构为**两层结构**：

```
┌────────────────────────────────────────────────────┐
│              Section header (title + subtitle)      │
├──────────────────────────┬─────────────────────────┤
│                          │                          │
│   ① 生成加密货币日报       │   ② Chat Preview         │
│      (左，日报入口)         │      (右，Agent 运行效果) │
│                          │                          │
│   + 描述文案              │   + Claw 42 Agent + 思考 │
│   + 输入框（click 复制）    │     三点跳动            │
│   + 立即试用 CTA          │   + chatTitle           │
│                          │   + chatBullets          │
│                          │                          │
│         (主板块，lg:grid-cols-2 等宽)                 │
├──────────────┬───────────────────────────────────────┤
│  ③ 实时行情   │  ④ 自动化交易                           │
│    监控       │   (缩小版，单行 desc + 单 CTA)          │
│  (缩小版)    │                                        │
└──────────────┴───────────────────────────────────────┘
       ↑ 次要栏，lg:grid-cols-2，高度 / 字号显著小于主板块
       ↑ 原来 Airy 在两张小卡下方加的大块占位图全部删除
```

**关键点**：
- ① + ② 是**同一个大板块**，等宽两列（`lg:grid-cols-2 gap-6`），不是原来的左大右小
- ③ + ④ 是次要栏，放在主板块**下方**，另起一个 grid（`lg:grid-cols-2 gap-4`）
- 次要栏两张卡的**体量**（padding、字号、icon 尺寸）明显小于主板块，形成主次对比
- 次要栏卡片下方**没有**大块占位图 / placeholder 插画——Airy 第一版里有，删掉
- 整个 Scenarios section 背景 radial glow（紫 + 粉星云）保持

#### 5.2 dict 字段处理

**不改**（Task 01 已验收）：
- `scenarios.sectionTitle` / `sectionSubtitle`
- `scenarios.daily.title` / `badge` / `desc` / `inputPlaceholder` / `cta` / `chatSpeaker` / `chatTime` / `chatTitle` / `chatBullets`
- `scenarios.realtime.title` / `desc` / `ticker`
- `scenarios.autoTrade.title` / `desc` / `cta`

**追加**（这次 task 新加的两个 key，不碰已有字段）：

`zh.json` 的 `scenarios.daily` 下加：
```json
"defaultPrompt": "帮我生成今日加密货币市场日报：扫描 BTC/ETH/SOL 等主流币种 24 小时价格波动、主要社交媒体的情绪变化、链上大额转账和宏观新闻，输出结构化的中文日报，帮我开启今天的交易。",
"copiedToast": "已复制到剪贴板"
```

`en.json` 的 `scenarios.daily` 下加：
```json
"defaultPrompt": "Generate today's crypto market report for me: scan 24h price moves of BTC/ETH/SOL, social sentiment shifts, major on-chain whale transfers and macro news, then deliver a structured report to start my trading day.",
"copiedToast": "Copied to clipboard"
```

`types.ts` 的 `scenarios.daily` 类型里追加：
```ts
defaultPrompt: string;
copiedToast: string;
```

> **注**：`defaultPrompt` 文案是 F 的初稿，Dan 会 review。如果 Dan 改了，以 Dan 为准。Airy 不要自己改 prompt 内容。

#### 5.3 输入框点击复制交互

主板块 ① 的输入框当前是纯展示，改成 click-to-copy：

```tsx
"use client";
import { useState } from "react";

function DailyReportInput() {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(t.scenarios.daily.defaultPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // 回退：选中文本让用户手动复制
      console.warn("Clipboard API 不可用", e);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        className="w-full text-left bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3
                   text-sm text-gray-400 hover:border-[#7c5cff]/40 hover:text-gray-300
                   transition-colors cursor-pointer"
      >
        {t.scenarios.daily.inputPlaceholder}
      </button>
      {/* Toast */}
      {copied && (
        <div className="absolute -top-10 left-0 px-3 py-1.5 rounded-md bg-[#7c5cff] text-white text-xs font-semibold shadow-lg">
          {t.scenarios.daily.copiedToast}
        </div>
      )}
    </div>
  );
}
```

要求：
- 点击整个输入框区域都能复制（用 `<button>` 而不是 `<input readOnly>`，避免 focus 状态干扰）
- 复制成功后在输入框上方浮出 toast `已复制到剪贴板` / `Copied to clipboard`，2 秒后自动消失
- 浏览器不支持 `navigator.clipboard`（如 HTTP 站点或老浏览器）时静默失败，不报错、不 alert
- 不引入任何 toast 库（react-hot-toast / sonner 等），纯 useState + Tailwind 实现

#### 5.4 立即试用 CTA 的 href

主板块 ① 的「立即试用 / Try Now」按钮：

```tsx
<a
  href="#signup"
  className="px-5 py-3 bg-[#7c5cff] text-white text-sm font-semibold rounded-lg
             hover:bg-[#8e6bff] hover:shadow-[0_0_20px_rgba(124,92,255,0.4)]
             transition-all shrink-0 inline-flex items-center"
>
  {t.scenarios.daily.cta}
</a>
```

- 当前 Airy 版本可能是 `<button>`，改为 `<a href="#signup">`
- **href 必须和 Hero 「立即开始」按钮 href 完全一致**（Dan：两个按钮跳转目标相同）
- 现阶段两个按钮 href 都用 `#signup` 占位，Dan 后续给真实 URL 时一起改
- 在 #2 Hero 修法里同步把 Hero 主 CTA 按钮的 href 锁定为 `#signup`

#### 5.5 Agent 头像思考动画（C 方案：三点省略号跳动）

Chat Preview ② 的 header 区域（`chatSpeaker` + `chatTime` 行）加一个 typing dots 指示器，放在 `chatSpeaker` 后面、`chatTime` 前面：

```tsx
<div className="flex items-center gap-2 mb-3">
  {/* Agent 头像（保持上版粉紫渐变方块 + ✨） */}
  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ff8ad4] via-[#a78bfa] to-[#7c5cff]
                  flex items-center justify-center shadow-[0_0_12px_rgba(167,139,250,0.5)]">
    <span className="text-sm">✨</span>
  </div>
  <span className="text-sm font-semibold text-white">{t.scenarios.daily.chatSpeaker}</span>
  {/* Typing dots — 三点交替跳动，视觉表达"Agent 正在思考" */}
  <div className="flex gap-1 items-end pb-0.5">
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        className="w-1.5 h-1.5 rounded-full bg-[#a78bfa]"
        animate={{ y: [0, -3, 0], opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
      />
    ))}
  </div>
  <span className="text-xs text-gray-500 ml-auto">{t.scenarios.daily.chatTime}</span>
</div>
```

要点：
- 三个圆点紫色 `#a78bfa`，直径 6px，间距 4px
- 动画：y 方向 0 → -3px → 0，opacity 0.3 → 1 → 0.3，循环
- 三点之间 delay 0.15s 错开，形成"波浪跳动"
- 循环周期 1.2s
- `useReducedMotion` 为 true 时三点改为纯静态（不跳动，保持 opacity 0.5 常亮）

#### 5.6 视觉细节（上版已做的保留，补齐）

**a. 主按钮配色紫色**（已上版 Airy 做了，保留）：`bg-[#7c5cff] hover:bg-[#8e6bff]`

**b. Agent 头像渐变方形 + ✨**（已上版 Airy 做了，保留）

**c. Chat preview 彩虹渐变描边**（已上版 Airy 做了，保留）：
```tsx
<div className="rounded-xl p-[1.5px] bg-gradient-to-br from-[#7c5cff] via-[#ff8ad4] to-[#d1ff55]
                shadow-[0_0_32px_-4px_rgba(124,92,255,0.35)]">
  <div className="h-full bg-[#0a0a0a] rounded-[10px] p-5">
    {/* header 行（5.5 的 typing dots）+ chatTitle + chatBullets */}
  </div>
</div>
```

**d. 主板块两张卡 glow**（主板块 ① 和 ② 都是主卡，都要较强 glow）：
```tsx
shadow-[0_0_40px_-10px_rgba(124,92,255,0.4),0_0_80px_-20px_rgba(255,138,212,0.2)]
hover:shadow-[0_0_60px_-8px_rgba(124,92,255,0.6),0_0_120px_-20px_rgba(255,138,212,0.3)]
transition-shadow duration-500
```

**e. 次要栏两张卡 glow**（弱于主板块，形成主次对比）：
```tsx
shadow-[0_0_16px_-8px_rgba(124,92,255,0.25)]
hover:shadow-[0_0_28px_-6px_rgba(124,92,255,0.4)]
```

**f. 次要栏卡片内部结构**（体量缩小）：
- padding：`p-5`（主板块是 `p-6 md:p-8`）
- 标题：`text-base md:text-lg font-semibold`（主板块是 `text-xl md:text-2xl font-bold`）
- desc：`text-xs md:text-sm`（主板块是 `text-sm md:text-base`）
- 不设高度撑满，内容多高卡片就多高
- 无 emoji 图标 / 大占位图 / 底部插画——只有 title + 1 行 desc（+ `realtime.ticker` 或 `autoTrade.cta` 两者其一）
- 次要栏整体最大高度控制在 160px 左右（靠内容控制，不硬设 `max-h`）

**g. 板块整体粒子 / 星云底色**（上版已做，保留）：
```tsx
<div className="absolute inset-0 pointer-events-none -z-10 opacity-60">
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,92,255,0.15),transparent_60%)]" />
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,138,212,0.08),transparent_50%)]" />
</div>
```

**h. "M" 黄色徽标**：不加（Dan 明确说不要）。

#### 5.7 ScenariosSection 完整骨架

```tsx
"use client";
import { motion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { fadeUp } from "@/lib/motion";

export function ScenariosSection() {
  const { t } = useI18n();

  return (
    <motion.section
      {...fadeUp}
      className="relative max-w-7xl mx-auto px-6 md:px-12 lg:px-20 py-16 md:py-20"
    >
      {/* 星云底 */}
      <div className="absolute inset-0 pointer-events-none -z-10 opacity-60">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,92,255,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,138,212,0.08),transparent_50%)]" />
      </div>

      {/* Section header */}
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-white">
          {t.scenarios.sectionTitle}
        </h2>
        <p className="text-gray-400 text-base md:text-lg max-w-3xl mx-auto leading-relaxed">
          {t.scenarios.sectionSubtitle}
        </p>
      </div>

      {/* ① + ② 主板块（等宽两列） */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <DailyReportCard />   {/* ① */}
        <ChatPreviewCard />   {/* ② */}
      </div>

      {/* ③ + ④ 次要栏（等宽两列，体量小） */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RealtimeMonitorCard />  {/* ③ */}
        <AutoTradeCard />        {/* ④ */}
      </div>
    </motion.section>
  );
}
```

子组件（`DailyReportCard` / `ChatPreviewCard` / `RealtimeMonitorCard` / `AutoTradeCard`）可以放同文件内，也可以拆到 `src/modules/landing/scenarios/` 下——Airy 自行决定，但要保持代码可读性，主文件不超过 300 行。

#### 5.8 动效（同 #4 全局规则，在 Scenarios 落地）

- 整个 Section 用 `motion.section` + `fadeUp`（已在骨架里）
- 主板块 ① + ② 两张卡 stagger 入场（`fadeUp` + `transition.delay: i * 0.08`）
- 次要栏 ③ + ④ 在主板块之后延迟 0.3s 入场，两张卡再 stagger 0.08s
- Chat Preview 里 `chatBullets` 逐条 fade-in（父级 delay 0.3s + 每条间隔 0.06s）
- 卡片 hover：`scale: 1.02` + glow 加强
- Typing dots 动画独立循环（不受 whileInView 影响，进入视口后一直跳）

#### 5.9 验收对照（替代原 #5.4）

- [ ] 主板块布局：日报入口左、Chat Preview 右，等宽两列（`lg:grid-cols-2`）
- [ ] 次要栏布局：实时监控 + 自动化交易两张小卡，位于主板块下方，等宽两列
- [ ] 次要栏卡片**没有**任何大块占位图 / 插画 / emoji 集合图
- [ ] 次要栏体量小于主板块（padding、字号、glow 强度都降档）
- [ ] 输入框点击后复制 `defaultPrompt` 到剪贴板，并浮出 toast
- [ ] 立即试用按钮 href = `#signup`，和 Hero 立即开始按钮一致
- [ ] Agent 头像旁有三点跳动动画（C 方案），循环播放
- [ ] Reduce motion 打开时三点变静态
- [ ] dict 字段：`scenarios.daily.defaultPrompt` + `scenarios.daily.copiedToast` 两个新 key 已加到 zh.json / en.json / types.ts，其他字段**一个字没改**
- [ ] 中英文切换时，Scenarios 布局不错位、不跳动

### 6. Why / QuickStart / Disclaimer 动效

- Why 三卡：stagger 入场
- QuickStart 终端：入场 `opacity 0 → 1 + scale 0.98 → 1`
- Disclaimer：简单 fade in，不要 stagger
- 都不改结构和文案

---

## 验收标准

- [ ] `npm install` 干净通过，`package.json` 里 `framer-motion` 在 `dependencies`，version `^11.x`
- [ ] `npm run build` 通过，无 TypeScript 报错、无 ESLint 报错
- [ ] `npm run dev` 本地跑起来，浏览器打开：
  - [ ] Header 固定在顶部，logo 是 claw42-logo-trimmed 的 PNG（不是紫色圆形 "C"）
  - [ ] Header 高度 72px
  - [ ] 点右上语言按钮，中英切换正常
  - [ ] 中文和英文两种状态下，Hero 的标题都和机器人图片之间有清晰间距，不叠加
  - [ ] Hero 主 CTA 「立即开始 / Get Started」 href = `#signup`
  - [ ] 滑到中间看到新板块「探索 AI Skills 生态」，两张卡（Contract + Spot），图标占位 + 标题 + 描述 + "了解详情 →"
  - [ ] 首次滚动到每个 section，都有 fade-up 入场动画
  - [ ] **Scenarios 布局**：主板块等宽两列（日报入口 + Chat Preview）+ 次要栏等宽两列（实时监控 + 自动化交易，缩小版）
  - [ ] **Scenarios 次要栏**：卡片下方没有任何大块占位图 / 插画 / emoji 集合图
  - [ ] **Scenarios 次要栏体量**：padding / 字号 / glow 强度都小于主板块
  - [ ] Scenarios 主板块两卡和次要栏两卡依次 stagger 入场
  - [ ] Chat preview 里 chatBullets 逐条 fade-in
  - [ ] **Scenarios 输入框点击后**：默认 prompt 复制到剪贴板，输入框上方浮现 toast `已复制到剪贴板` / `Copied to clipboard`，2 秒后消失
  - [ ] **Scenarios 立即试用按钮**：`<a href="#signup">`（和 Hero 主 CTA href 一致）
  - [ ] **Scenarios Agent 头像旁**：三点跳动动画（紫色 #a78bfa，波浪 delay）循环播放
  - [ ] Scenarios 主按钮是紫色（#7c5cff），不是绿色
  - [ ] Scenarios Agent 头像是粉紫渐变圆角方块 + ✨，不是小圆 🤖
  - [ ] Scenarios Chat preview 卡片有紫/粉/绿彩虹渐变描边
  - [ ] Scenarios 整个 section 背景有紫/粉星云 radial glow（不是纯黑）
  - [ ] 按钮 hover 有 scale 反馈，tap 时回弹
  - [ ] 系统设置 reduce-motion 打开时，所有入场动效降级为简单 fade，typing dots 变静态
- [ ] **i18n 字段校验**：
  - [ ] `zh.json` / `en.json` 里 `scenarios.daily.defaultPrompt` 和 `scenarios.daily.copiedToast` 两个新 key 存在
  - [ ] `scenarios.daily.defaultPrompt` 文案和 spec #5.2 给的初稿一致（Dan review 后定稿）
  - [ ] 其他所有已有字段一个字没改（跑 `git diff src/i18n/zh.json src/i18n/en.json` 只能看到追加）
  - [ ] `types.ts` 的 `scenarios.daily` 类型里有 `defaultPrompt: string; copiedToast: string;`
  - [ ] 顶层 `skillsEco` 字段已加（zh/en/types 三处）
- [ ] `git grep -l "LanguageSwitcher"` 无任何匹配（老文件已删、老 import 已改完）
- [ ] `git grep -l "TopBar"` 在 src/ 下无匹配（export 已改 `SiteHeader`）
- [ ] `ls public/images/claw42-logo.png` 报文件不存在（死资源已删）
- [ ] `ls public/images/claw42-logo-trimmed.png` 存在
- [ ] `git grep "useScrollFadeIn"` 和 `git grep "fade-in-section"` 只能两个都匹配或两个都不匹配（不能一半 motion 一半 CSS 并存）
- [ ] 中文 + 英文两个语言下分别截图 Hero 区域 + Scenarios 区域，发在 PR 里

## 约束 / 不要做的事

- ❌ 不要重构 `I18nProvider`。Task 01 已经审核通过 hydration 安全，任何改动都要重审
- ❌ 不要改 Why / QuickStart / Disclaimer 的文案或结构
- ❌ Scenarios 的 **结构**：按 #5.1 的新布局（主板块 2 列 + 次要栏 2 列）重做，不保留原 bento grid
- ❌ Scenarios 的 **i18n 已有字段**：一个字不改，只追加 `scenarios.daily.defaultPrompt` 和 `scenarios.daily.copiedToast` 两个新 key（详见 #5.2）
- ❌ 不要加除 `framer-motion` 之外的任何新依赖（toast 库、utility 库都不行）
- ❌ 不要自作主张改 Tailwind config（除了可选的 keyframes，其他不动）
- ❌ 不要改 Dan 上传的图片（hero-robot-scene.png / claw42-logo-trimmed.png），就用现有文件
- ❌ 不要用绝对 URL 当 href。全站 CTA 跳转占位：
  - Hero 「立即开始 / Get Started」→ `#signup`
  - Scenarios 「立即试用 / Try Now」→ `#signup`（和 Hero 一致）
  - Hero 「API 文档 / API Docs」→ `#api-docs`
  - SkillsEco 「了解详情 / Learn more」→ `#`
- ❌ 不要用 localStorage 以外的持久化方式（Task 01 已经用 `claw42-locale` key，不要动）
- ❌ 不要改 zh.json / en.json 里**已有字段**（`scenarios.*` 已有字段 + Task 01 所有字段）。只追加：顶层 `skillsEco` + `scenarios.daily.defaultPrompt` + `scenarios.daily.copiedToast`
- ❌ 不要自己改 `defaultPrompt` 的文案（用 spec 给的初稿，Dan review 后定稿）

## Commit 策略

建议按原子 commit：
1. `refactor: rename TopBar → SiteHeader, move to components/`
2. `fix(header): real logo png + 72px height`
3. `feat(hero): decouple title from image, lock CTA href to #signup, fix language switch layout`
4. `feat: add SkillsEcoSection between Scenarios and Why`
5. `feat(i18n): add skillsEco + scenarios.daily.defaultPrompt/copiedToast`
6. `feat: add framer-motion, replace fade-in-section with motion whileInView`
7. `refactor(scenarios): rebuild layout — 2-col main block (daily + chat) + smaller 2-col aux row (realtime + autoTrade)`
8. `feat(scenarios): click-to-copy prompt with toast + href=#signup on CTA`
9. `feat(scenarios): typing dots animation next to Claw 42 Agent avatar (C plan)`
10. `chore: delete unused claw42-logo.png (2MB)`

一次 PR 全套交，别拆 PR。

---

## 有歧义时问 F

遇到以下情况停手、在 PR 里或通过 Dan 问 F：
- framer-motion 和现有 `fade-in-section` CSS 方案不知道怎么合并
- Hero 修复后中英文截图对比还是不对齐，不知道是不是我的方案本身有问题
- 新板块的卡片 hover 想做 3D tilt 但不确定是不是超范围
- 发现任何和 Task 01 I18nProvider 相关的现有 bug

不要自己猜、不要默默扩大范围。

---

*Spec: F（总调度）*
*日期: 2026-04-21（v2：Scenarios 从视觉重做升级为布局重构 + 交互补齐）*
*技术栈版本: Next.js 14.2.35 + React 18 + Tailwind 3.4.1 + 新增 framer-motion ^11*
