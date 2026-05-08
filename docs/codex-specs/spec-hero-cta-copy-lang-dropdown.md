# Spec — Hero CTA 复制化 + 日报 CTA 复制化 + 语言切换下拉 UI

## 目标

三项独立改动合一 PR：

1. **Hero ctaPrimary「立即开始」按钮**：当前外链跳 `COINW_SKILLS_URL` → 改为点击复制 `npx skills add GitHub - connectCoinw/coinw-skills` 到剪贴板 + 显示 toast
2. **加密日报 CTA「立即试用」按钮**：当前外链跳 `COINW_SKILLS_URL` → 改为点击复制定时订阅 prompt + 显示 toast（按钮 label 不改）
3. **SiteHeader 语言切换**：原生 `<select>`（桌面浏览器弹 OS 系统级下拉）→ 改为自定义 React 下拉菜单（完全由 CSS 控制，和站内视觉统一）

所有改动保持现有视觉骨架不扩散。

## 分支策略

```
git fetch origin
git checkout main
git pull origin main
git checkout -b feature/hero-cta-copy-lang-dropdown-01
# 实现
git push origin feature/hero-cta-copy-lang-dropdown-01
# 开 PR 到 main
```

## 变更范围

### 修改

- `src/modules/landing/HeroScene/HeroScene.tsx`
- `src/modules/landing/ScenariosSection.tsx`
- `src/components/SiteHeader.tsx`
- `src/i18n/types.ts`
- `src/i18n/dicts/zh_CN.json` / `zh_TW.json` / `en_US.json` / `ja_JP.json` / `ru_RU.json` / `uk_UA.json` / `fr_FR.json` / `es_ES.json` / `ar_SA.json` / `en_XA.json`

### 新建

- `src/components/LocaleDropdown.tsx`（把语言切换独立成组件——便于维护 + SiteHeader 减负）

### 不动（明确禁止碰）

- `src/app/globals.css`
- `src/app/[locale]/page.tsx`
- `src/app/[locale]/layout.tsx`
- `src/i18n/locales.ts`
- `src/i18n/I18nProvider.tsx`
- 除加密日报外的其他场景卡（`RealtimeMonitorCard` / `AutoTradeCard` 的 CTA 保持外链，不动）
- 其他 Section 组件（`WhySection` / `SkillsEcoSection` / `StartTradeSection` / `DisclaimerSection` / `QuickStartSection`）
- Hero `ctaSecondary`「API 文档」按钮（保持外链现状）
- `DailyReportInput`（input box 的 click-to-copy 保持现行为，内容是 `daily.defaultPrompt`——不改）
- Tailwind 配置 / `package.json` / `package-lock.json`（不新增依赖）

### 不在本 spec 范围

- ctaSecondary 文不对题问题（另起单独需求）
- 其他场景卡（realtime / autoTrade）的 CTA 改造
- 语言切换的 URL 重写策略（继续复用 `useI18n().switchLocale`）

## 当前状态快照

### Hero ctaPrimary（`HeroScene.tsx` L112-121）

```tsx
<motion.a
  href={COINW_SKILLS_URL}
  target="_blank"
  rel="noopener noreferrer"
  whileHover={reduceMotion ? undefined : { scale: 1.05 }}
  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
  className="inline-flex items-center justify-center rounded-xl bg-[#7c5cff] px-8 py-3 text-base font-semibold text-white transition-all hover:bg-[#8e6bff] hover:shadow-[0_0_24px_rgba(124,92,255,0.5)]"
>
  {t.hero.ctaPrimary}
</motion.a>
```

### DailyReportCard 立即试用（`ScenariosSection.tsx` L112-121）

```tsx
<motion.a
  href={COINW_SKILLS_URL}
  target="_blank"
  rel="noopener noreferrer"
  whileHover={reduceMotion ? undefined : { scale: 1.05 }}
  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
  className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#7c5cff] px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-[#8e6bff] hover:shadow-[0_0_20px_rgba(124,92,255,0.4)]"
>
  {t.scenarios.daily.cta}
</motion.a>
```

### SiteHeader 语言切换（`SiteHeader.tsx` L41-66）

```tsx
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
  <svg ... />  {/* 下拉箭头 */}
</label>
```

### 现有 toast 模板（可参考）

`ScenariosSection.tsx` 的 `DailyReportInput` 已有成熟 toast 模式（L36-48）：

```tsx
<AnimatePresence>
  {copied && (
    <motion.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
      transition={{ duration: 0.18 }}
      className="absolute -top-10 left-0 rounded-md bg-[#7c5cff] px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
    >
      {t.scenarios.daily.copiedToast}
    </motion.div>
  )}
</AnimatePresence>
```

两个新按钮的 toast 视觉要**对齐这套样式**（紫色 pill + shadow + fade+translate 动效），只是锚点位置和字段不同。

## 技术上下文

- Next.js 14.2.x (App Router)
- React 18
- Tailwind CSS 3.4.x
- TypeScript 5.x
- framer-motion ^11.x
- `useI18n()` 已提供 `{ t, locale, switchLocale }`
- `LOCALES` / `LOCALE_LABELS` 已在 `@/i18n/locales`

### 禁用清单

- ❌ 新增依赖（不要引 react-hot-toast / radix / headless-ui）
- ❌ `localStorage` / `sessionStorage`
- ❌ `next/image` 用于装饰性图标
- ❌ 原生 `<select>`（本 spec 就是要替换它）
- ❌ 纯 CSS `:hover` 驱动的下拉（无障碍 + 移动端 broken）

---

## Section 1 — Hero ctaPrimary 改复制 + toast

### 目标行为

- 点击按钮 → `navigator.clipboard.writeText(t.hero.ctaPrimaryClipboard)` → 显示 toast 2 秒 → 自动消失
- 按钮视觉完全不变（紫色 rounded-xl，文字不变）
- 无 href，无 target
- clipboard API 不可用（HTTP / 老浏览器）→ 静默 fail，不崩溃
- reduce-motion：toast 只淡入淡出，不带 translate

### 实现

在 `HeroScene` 组件内加 state + handler：

```tsx
const [heroCopied, setHeroCopied] = useState(false);

const handleHeroCtaClick = async () => {
  try {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(t.hero.ctaPrimaryClipboard);
    setHeroCopied(true);
    window.setTimeout(() => setHeroCopied(false), 2000);
  } catch (error) {
    console.warn("Clipboard API unavailable", error);
  }
};
```

改按钮 + 加 toast（包在一个定位容器里）：

```tsx
<div className="relative">
  <motion.button
    type="button"
    onClick={handleHeroCtaClick}
    whileHover={reduceMotion ? undefined : { scale: 1.05 }}
    whileTap={reduceMotion ? undefined : { scale: 0.98 }}
    className="inline-flex items-center justify-center rounded-xl bg-[#7c5cff] px-8 py-3 text-base font-semibold text-white transition-all hover:bg-[#8e6bff] hover:shadow-[0_0_24px_rgba(124,92,255,0.5)]"
  >
    {t.hero.ctaPrimary}
  </motion.button>
  <AnimatePresence>
    {heroCopied && (
      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
        transition={{ duration: 0.18 }}
        className="absolute -top-10 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#7c5cff] px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
      >
        {t.hero.ctaPrimaryCopiedToast}
      </motion.div>
    )}
  </AnimatePresence>
</div>
```

注意：

- 两个 `<motion.a>` 原来是并排 flex item——改按钮后仍保持并排结构（外层 `<div className="flex flex-col sm:flex-row gap-4 ...">` 不动，新 `<div className="relative">` 作为 ctaPrimary 的外层，ctaSecondary 保持原 `<motion.a>`）
- toast 位置 `-top-10 left-1/2 -translate-x-1/2`（按钮上方中心），`whitespace-nowrap` 防止换行
- `z-10` 防止被兄弟元素覆盖

### 保持不动

- ctaSecondary（「API 文档」按钮）完全不动
- 外层 flex 容器不动
- AnimatePresence / motion 动画属性不改

---

## Section 2 — DailyReportCard CTA 改复制 + toast

### 目标行为

- 点击按钮 → `navigator.clipboard.writeText(t.scenarios.daily.ctaClipboard)` → toast 2 秒
- **label 保持 `t.scenarios.daily.cta`（「立即试用」/ "Try Now"）不变**
- 按钮视觉完全不变
- clipboard 不可用 → 静默 fail
- reduce-motion 同 Section 1

### 实现

在 `DailyReportCard` 组件内加 state + handler（和 Section 1 结构一致）：

```tsx
function DailyReportCard({ delay }: { delay: number }) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const [ctaCopied, setCtaCopied] = useState(false);

  const handleCtaClick = async () => {
    try {
      if (!navigator.clipboard) return;
      await navigator.clipboard.writeText(t.scenarios.daily.ctaClipboard);
      setCtaCopied(true);
      window.setTimeout(() => setCtaCopied(false), 2000);
    } catch (error) {
      console.warn("Clipboard API unavailable", error);
    }
  };

  return (
    /* ... 原 motion.div 卡片 ... */
    <div className="mt-auto flex flex-col items-start gap-5">
      <DailyReportInput />
      <div className="relative">
        <motion.button
          type="button"
          onClick={handleCtaClick}
          whileHover={reduceMotion ? undefined : { scale: 1.05 }}
          whileTap={reduceMotion ? undefined : { scale: 0.98 }}
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#7c5cff] px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-[#8e6bff] hover:shadow-[0_0_20px_rgba(124,92,255,0.4)]"
        >
          {t.scenarios.daily.cta}
        </motion.button>
        <AnimatePresence>
          {ctaCopied && (
            <motion.div
              initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
              transition={{ duration: 0.18 }}
              className="absolute -top-10 left-0 z-10 whitespace-nowrap rounded-md bg-[#7c5cff] px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
            >
              {t.scenarios.daily.ctaCopiedToast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    /* ... */
  );
}
```

注意：

- 两个 copy 机制独立：`DailyReportInput`（copy `defaultPrompt` + `copiedToast`）保持不动；新按钮 copy `ctaClipboard` + `ctaCopiedToast`
- toast 位置 `-top-10 left-0`（按钮上方左对齐，和 `DailyReportInput` 现有 toast 锚点一致）
- 不动 `COINW_SKILLS_URL` 的 import（在 Section 1 / 其他卡片仍在用，**只有本按钮不再引用**）

---

## Section 3 — SiteHeader 语言切换自定义下拉

### 目标行为

- 点击按钮 → 下方 fade-in 下拉面板，显示 10 语 option
- 面板中当前 locale 有高亮标识（紫色左边框 + 浅紫背景）
- 点击某项 → `switchLocale(locale)` + 关闭面板
- 面板外点击 → 关闭
- ESC 键 → 关闭
- 键盘可访问性：
  - 按钮：`aria-haspopup="listbox"` / `aria-expanded={isOpen}` / `aria-label="Select language"`
  - 面板：`role="listbox"` / `aria-activedescendant`
  - 每项：`role="option"` / 当前选中 `aria-selected="true"`
- 上/下方向键：在项之间移动高亮（可选，不做也能 accept，但 aria 必做）
- Enter / Space：触发当前 focused 项
- reduce-motion：只 opacity，无 translate

### 实现

新建 `src/components/LocaleDropdown.tsx`：

```tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { LOCALES, LOCALE_LABELS } from "@/i18n/locales";
import type { Locale } from "@/i18n/types";

export function LocaleDropdown() {
  const { locale, switchLocale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 外点击关闭
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isOpen]);

  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const handleSelect = (next: Locale) => {
    setIsOpen(false);
    if (next !== locale) switchLocale(next);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select language"
        className="relative inline-flex h-11 cursor-pointer items-center rounded-full border border-white/[0.12] bg-white/[0.08] pl-4 pr-9 text-sm font-semibold text-white/90 transition-all hover:bg-white/[0.15] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#7c5cff]/50"
      >
        <span>{LOCALE_LABELS[locale].native}</span>
        <svg
          className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.ul
            role="listbox"
            aria-label="Available languages"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-[calc(100%+8px)] z-50 max-h-[360px] min-w-[200px] overflow-y-auto rounded-xl border border-white/10 bg-[#111] py-2 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
          >
            {LOCALES.map((l) => {
              const isSelected = l === locale;
              return (
                <li
                  key={l}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(l)}
                  className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors ${
                    isSelected
                      ? "border-l-2 border-[#7c5cff] bg-[#7c5cff]/15 text-[#c4b0ff]"
                      : "border-l-2 border-transparent text-white/80 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="font-medium">{LOCALE_LABELS[l].native}</span>
                  <span className="shrink-0 text-xs text-white/40">{LOCALE_LABELS[l].en}</span>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
```

然后在 `SiteHeader.tsx` 把第 41-66 行的 `<label><select>...</select></label>` 整块替换成：

```tsx
<LocaleDropdown />
```

并 import：

```tsx
import { LocaleDropdown } from "./LocaleDropdown";
```

删除 `SiteHeader.tsx` 里对 `LOCALES` / `LOCALE_LABELS` / `Locale` 的直接 import（全转到 LocaleDropdown 内部）。

### reduce-motion 处理

`LocaleDropdown.tsx` 里 `motion.ul` 的 initial / exit 的 `y: -4` 在 reduce-motion 下改为 `y: 0`：

```tsx
const reduceMotion = useReducedMotion();
// ...
initial={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
transition={{ duration: reduceMotion ? 0 : 0.15 }}
```

箭头旋转动画也加 reduce-motion 守卫：

```tsx
className={`... transition-transform ${isOpen ? "rotate-180" : ""} ${reduceMotion ? "transition-none" : ""}`}
```

### RTL (ar_SA)

`dir="rtl"` 下：

- 下拉面板 `right-0` 会被 RTL 翻转到左侧——保留默认行为，视觉上对称
- `border-l-2` 在 RTL 下会自动成为右边框，框架默认行为，不特殊处理

---

## Section 4 — i18n types.ts + 10 dict

### types.ts 新增字段

在 `hero` 区加：

```ts
hero: {
  title: string;
  subtitle: string;
  ctaPrimary: string;
  ctaPrimaryClipboard: string;       // 新增
  ctaPrimaryCopiedToast: string;     // 新增
  ctaSecondary: string;
  speechBubble: string[];
  speechBubbleAriaLabel: string;
};
```

在 `scenarios.daily` 区加：

```ts
daily: {
  title: string;
  badge: string;
  desc: string;
  inputPlaceholder: string;
  defaultPrompt: string;
  copiedToast: string;
  cta: string;
  ctaClipboard: string; // 新增
  ctaCopiedToast: string; // 新增
}
```

### 10 dict 文案定稿

**`hero.ctaPrimaryClipboard`**（10 语全部统一英文命令，因为是 CLI 命令）：

```
npx skills add GitHub - connectCoinw/coinw-skills
```

**`hero.ctaPrimaryCopiedToast`** 和 **`scenarios.daily.ctaCopiedToast`** 按 locale 翻译（两个字段文案内容完全相同——shared toast）：

| Locale | 文案                                                                                         |
| ------ | -------------------------------------------------------------------------------------------- |
| zh_CN  | `已复制到剪贴板，发给你的 Agent 开启加密新体验`                                              |
| zh_TW  | `已複製到剪貼簿，發給你的 Agent 開啟加密新體驗`                                              |
| en_US  | `Copied to clipboard — send it to your Agent to unlock the crypto experience`                |
| ja_JP  | `クリップボードにコピーしました——あなたの Agent に送って新しい暗号体験へ`                    |
| ru_RU  | `Скопировано в буфер обмена — отправьте своему Agent, чтобы открыть новый крипто-опыт`       |
| uk_UA  | `Скопійовано в буфер обміну — надішліть своєму Agent, щоб відкрити новий крипто-досвід`      |
| fr_FR  | `Copié dans le presse-papiers — envoyez-le à votre Agent pour débloquer l'expérience crypto` |
| es_ES  | `Copiado al portapapeles — envíalo a tu Agent para desbloquear la experiencia cripto`        |
| ar_SA  | `تم النسخ إلى الحافظة — أرسله إلى وكيلك الذكي لفتح تجربة التشفير الجديدة`                    |
| en_XA  | 同 en_US                                                                                     |

**`scenarios.daily.ctaClipboard`**（按 locale 翻译 prompt，保留 `GitHub - connectCoinw/coinw-skills` 为英文字面）：

| Locale | 文案                                                                                                                                                                                                                          |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| zh_CN  | `使用 GitHub - connectCoinw/coinw-skills 中的 skills，在每天早上 9:00 发送给我过去 24 小时的加密日报，包含大盘数据、主流币种行情。`                                                                                           |
| zh_TW  | `使用 GitHub - connectCoinw/coinw-skills 中的 skills，在每天早上 9:00 發送給我過去 24 小時的加密日報，包含大盤數據、主流幣種行情。`                                                                                           |
| en_US  | `Use the skills from GitHub - connectCoinw/coinw-skills to send me a 24-hour crypto daily report every morning at 9:00 AM, including market data and major coin prices.`                                                      |
| ja_JP  | `GitHub - connectCoinw/coinw-skills の skills を使って、毎朝 9:00 に過去 24 時間の暗号通貨デイリーレポート（相場データ、主要通貨の動向を含む）を送ってください。`                                                             |
| ru_RU  | `С помощью skills из GitHub - connectCoinw/coinw-skills присылай мне каждое утро в 9:00 ежедневный крипто-отчёт за последние 24 часа с данными рынка и котировками основных монет.`                                           |
| uk_UA  | `Використовуй skills з GitHub - connectCoinw/coinw-skills, щоб щоранку о 9:00 надсилати мені крипто-звіт за останні 24 години з даними ринку та котируваннями основних монет.`                                                |
| fr_FR  | `Utilise les skills de GitHub - connectCoinw/coinw-skills pour m'envoyer chaque matin à 9h00 un rapport crypto quotidien des dernières 24 heures, incluant les données du marché et les prix des principales cryptomonnaies.` |
| es_ES  | `Usa los skills de GitHub - connectCoinw/coinw-skills para enviarme cada mañana a las 9:00 AM un informe diario cripto de las últimas 24 horas, incluyendo datos del mercado y precios de las principales monedas.`           |
| ar_SA  | `استخدم مهارات GitHub - connectCoinw/coinw-skills لإرسال تقرير يومي عن العملات المشفرة لآخر 24 ساعة إليّ كل صباح الساعة 9:00، بما في ذلك بيانات السوق وأسعار العملات الرئيسية.`                                               |
| en_XA  | 同 en_US                                                                                                                                                                                                                      |

---

## 验收标准

### 编译 / 类型

- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 成功
- [ ] `npm run lint` 无新增错误
- [ ] `git diff --name-only main..HEAD` 只显示 14 个文件（3 tsx + 1 types.ts + 10 dict + 1 新建 LocaleDropdown.tsx = 15；如果 SiteHeader 导入变化算作已有文件修改则 14~15 都正常）

### Grep 验证

- [ ] `grep "navigator.clipboard.writeText" src/modules/landing/HeroScene/HeroScene.tsx` 有输出
- [ ] `grep "navigator.clipboard.writeText" src/modules/landing/ScenariosSection.tsx` ≥ 2 处（input box 原有 + 新按钮）
- [ ] `grep "<select" src/components/SiteHeader.tsx` 无输出（原生 select 被移除）
- [ ] `grep "LocaleDropdown" src/components/SiteHeader.tsx` 有输出
- [ ] `grep "ctaPrimaryClipboard\|ctaCopiedToast\|ctaClipboard" src/i18n/types.ts` 全部存在
- [ ] `grep -c "ctaPrimaryClipboard" src/i18n/dicts/*.json` 每个 dict 都有 1 处

### 功能（桌面）

- [ ] Hero「立即开始」点击 → 剪贴板拿到 `npx skills add GitHub - connectCoinw/coinw-skills`
- [ ] Hero toast 在按钮上方居中显示，2 秒后消失
- [ ] Hero「API 文档」按钮仍是外链跳转（不动）
- [ ] 加密日报「立即试用」点击 → 剪贴板拿到对应 locale 的 prompt 文案
- [ ] 加密日报 toast 在按钮上方显示，文案等于 `ctaCopiedToast`
- [ ] 加密日报 input box 保持原 click-to-copy 行为（复制 `defaultPrompt`，show `copiedToast`——不变）
- [ ] Navbar 语言按钮点击 → 自定义下拉面板 fade-in
- [ ] 下拉面板显示 10 语选项 + native + english 双名字
- [ ] 当前 locale 有紫色左边框高亮
- [ ] 点击某项 → 切到对应 locale 路由 + 面板关闭
- [ ] 面板外点击 → 关闭
- [ ] ESC 键 → 关闭 + 焦点回按钮
- [ ] 下拉箭头 open 时旋转 180°

### 功能（移动 < 768px）

- [ ] Hero 两个 CTA 按钮 stack 纵向（sm 断点以下），交互一致
- [ ] 加密日报 CTA 在卡片底部正常，toast 位置不溢出卡片
- [ ] Navbar 下拉面板位置正确（right-0 + 按钮下方）

### RTL (ar_SA)

- [ ] 下拉面板在 RTL 下位置合理（`right-0` 自动翻转）
- [ ] 高亮左边框在 RTL 下变成右边框（Tailwind 默认行为）
- [ ] 阿语文本正常显示

### reduce-motion

- [ ] Hero / 日报按钮 whileHover / whileTap 无动效（motion.button 返回 undefined 时 framer-motion 不做 transform）
- [ ] Toast 无 translate，只 fade
- [ ] 下拉面板无 y 动画，只 fade
- [ ] 下拉箭头无旋转过渡

### 无障碍

- [ ] 按钮 type="button" 正确（避免表单内被当 submit）
- [ ] 下拉 button 有 aria-haspopup / aria-expanded / aria-label
- [ ] 下拉 ul 有 role="listbox"
- [ ] 下拉 li 有 role="option" + aria-selected
- [ ] Tab 焦点能进 button，Enter 能打开
- [ ] ESC 关闭后焦点回到按钮

### 边界 / 禁止

- [ ] 不改 globals.css
- [ ] 不改 page.tsx
- [ ] 不改 RealtimeMonitorCard / AutoTradeCard 的 CTA
- [ ] 不改 Hero ctaSecondary（API 文档）
- [ ] 不改 DailyReportInput 的 click-to-copy 行为
- [ ] 不引入新依赖
- [ ] 原生 `<select>` 已完全删除
- [ ] i18n 新字段 4 个：`hero.ctaPrimaryClipboard` / `hero.ctaPrimaryCopiedToast` / `scenarios.daily.ctaClipboard` / `scenarios.daily.ctaCopiedToast`，不多不少

---

## 约束

- `GitHub - connectCoinw/coinw-skills` 字符串**原样字面**出现在 clipboard 内容里（带空格、带破折号），不要自动修正成标准 URL 或 npm package 格式
- 10 语 toast / clipboard 文案按本 spec 原样落地，不做二次创作
- 下拉项显示 `native + english` 两个名字（当前原生 select 只显示 native，增强可识别性）
- reduce-motion 所有动效关掉，但不关功能
- 不要给 LocaleDropdown 加 portal（React Portal）——简单 absolute 定位即可
- 下拉面板 `z-50` 在 Navbar `z-50` 下会被 Navbar 盖住——把 LocaleDropdown 的面板 `z-index` 设为更高或让面板作为 Navbar 的子元素（当前实现是 Navbar 的子元素，z-50 够用；如果 merge 后发现盖住问题再升级）

## 提交与 PR

1. 从 main 拉 `feature/hero-cta-copy-lang-dropdown-01`
2. 实现 + 自测（desktop / mobile / ar_SA RTL / reduce-motion）
3. Commit message：

   ```
   feat(ux): hero cta copy + daily report cta copy + custom locale dropdown

   - Hero ctaPrimary: swap href for clipboard copy of skills install command + toast
   - DailyReportCard cta: swap href for clipboard copy of subscription prompt + toast
   - SiteHeader: replace native <select> with LocaleDropdown component (listbox a11y)
   - i18n: add hero.ctaPrimaryClipboard/ctaPrimaryCopiedToast + daily.ctaClipboard/ctaCopiedToast across 10 locales
   ```

4. Push + 开 PR 到 `main`
5. 等 Dan `npx vercel` 出 preview URL 交 F 审核

## 有疑问不要猜

- `GitHub - connectCoinw/coinw-skills` 字符串格式让命令解析异常 → 保持字面不改，告诉 Dan
- 下拉面板被 Navbar 其他元素盖住 → 调 z-index 或改 portal，告诉 Dan 选哪个
- 某个 dict 的 JSON 结构改动产生 top-level key 重复 → 告诉 Dan，不合并
- tsc 报某 dict Dict 类型不一致（漏加 4 个新字段之一）→ 先排查哪个 dict 漏改，不要回滚 types
- RTL 下下拉视觉错位 → 标记为已知问题，不 hack 修

---

_维护者: F_
_创建: 2026-04-23_
_执行者: Codex_
_基于: main（含 14c3faa + 2d75d22）_
